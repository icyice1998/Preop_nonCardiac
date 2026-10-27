// Assembles the full plan from state and renders the plain-text management suggestion.
// Pure functions: (state, data, rules) -> plan -> text.
(function (root) {
  const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  function buildPlan(s, D, R) {
    const d = R.derive(s);
    const plan = { d, consults: [] };
    const consult = c => { if (!plan.consults.includes(c)) plan.consults.push(c); };

    // Cardiac
    plan.cardiac = R.cardiacRisk(s);
    plan.esc = R.escTesting(s, d);
    plan.aha = R.ahaPathway(s, d);
    plan.pci = R.pciTiming(s);
    plan.dapt = R.daptAdvice(s, D.antiplatelets);
    plan.dasi = R.dasi(s, D.dasi);
    plan.specifics = R.cardiacSpecifics(s);
    if (plan.cardiac.status === 'consultCardio') consult('Cardiology: institutional cardiac pathway');
    if (plan.cardiac.status === 'consultMed') consult('Internal Medicine / Cardiology: institutional cardiac pathway');
    if (plan.esc.group === 'cvd' && s.surgRisk === 'high') consult('Cardiology: established CVD with high-risk surgery');
    if (plan.pci && (plan.pci.status === 'delay' || plan.pci.status === 'harm')) consult('Cardiology: surgery timing after PCI');
    if (s.vhd_AS || s.vhd_AR || s.vhd_MS || s.vhd_MR) consult('Cardiology: severe valvular disease (intervention before surgery?)');
    if (s.rm_cied) consult('Cardiology / EP: CIED interrogation and programming');

    // Antithrombotics
    plan.antiplatelet = R.antiplateletPlan(s, D.antiplatelets);
    if (plan.antiplatelet && plan.antiplatelet.action === 'consult') consult('Cardiology: antiplatelet after PCI < 1 year');
    const age = num(s.age) || 0;
    const afItems = { chf: s.hf || s.ac_chf, ht: s.rf_ht, dm: d.dm || s.rf_dm, stroke: s.cvd || s.rm_recentStroke, vascular: s.ihd || s.pad || s.priorPci || s.cabg };
    plan.af = { present: !!s.af, chads: R.chads2(afItems, age), vasc: R.cha2ds2vasc(afItems, age, s.sex) };
    plan.thrombotic = R.thromboticRisk(s, D.thromboticRisk, s.af ? plan.af : null);
    if (s.anticoag === 'warfarin') {
      plan.warfarin = R.warfarinPlan({ bleeding: s.bleedRisk, thrombotic: plan.thrombotic.level });
      if (plan.warfarin.status === 'bridge') plan.bridgeDose = R.bridgingDose({ weight: s.weight, crcl: d.crcl }, D.bemiparin);
    } else if (s.anticoag && s.anticoag !== 'none') {
      const doac = D.doacs.find(x => x.id === s.anticoag);
      const sch = R.doacSchedule({ drug: doac.group === 'dabigatran' ? 'dabigatran' : doac.id, crcl: d.crcl, bleeding: s.bleedRisk });
      plan.doac = Object.assign({ name: doac.name }, sch || { incomplete: true, notes: ['Select the procedural bleeding risk.'] });
      if (plan.doac.notes.some(n => /Hematology/.test(n))) consult('Hematology: DOAC interruption with renal impairment');
    }
    if (s.priorPci && s.anticoag && s.anticoag !== 'none') plan.oacPciNote = 'Prior PCI on OAC monotherapy: substitute aspirin peri-operatively while OAC is held, when feasible (AHA 1).';
    plan.neuraxial = R.neuraxialNotes(s);

    // Generic drugs
    plan.drugs = [];
    for (const g of D.drugGroups) {
      for (const item of g.items) {
        if (!s['drug_' + item.id]) continue;
        let rec, flag = item.flag, stop = item.stop;
        if (item.options) {
          const o = item.options.find(x => x.id === s['opt_' + item.id]);
          rec = o ? `${o.label}: ${o.rec}` : 'Select the indication / clinical status.';
          flag = o && o.flag;
        } else rec = item.rec;
        const dates = stop ? R.stopWindow(stop, s.surgeryDate).dates : null;
        plan.drugs.push({ group: g.title, id: item.id, name: item.name, rec, dates });
        if (flag === 'consult') consult(/psychiatry/i.test(rec) ? `Psychiatry: ${item.name}` : `Internal Medicine: ${item.name}`);
      }
    }

    // Diabetes / steroid
    plan.dm = R.dmPlan(s, d, D.dmDrugs);
    if (plan.dm) {
      plan.dm.drugs.forEach(x => { if (x.stop) x.dates = R.stopWindow(x.stop, s.surgeryDate).dates; });
      if (plan.dm.optimize) consult('Internal Medicine / Endocrinology: optimize glycemia before elective surgery');
    }
    plan.steroid = (s.adrenalInsufficiency || s.chronicSteroid) ? R.steroidPlan(s.stressGrade) : null;

    // Pulmonary
    plan.ppc = R.ppcRisk(s, d);
    if (plan.ppc.consult.length) consult(`Pulmonology: ${plan.ppc.consult.join('; ')}`);
    if (s.site_lungResection) plan.ppo = R.ppoLung({ fev1: s.fev1Pct, dlco: s.dlcoPct, resected: s.resectedSeg, obstructed: s.obstructedSeg, perfusion: s.perfusionPct });
    if ((s.copdStatus === 'uncontrolled' && s.urgency === 'elective') || s.osaSuspected) consult('Anesthesiology: airway / pulmonary optimization');

    // Kidney
    plan.renal = R.renalPlan(s, d);
    if (d.onDialysis) consult('Nephrology: dialysis timing and access');

    // IE prophylaxis
    plan.ie = s.ieHighRisk && s.site_dental ? D.ieRegimens : null;

    const anyMed = Object.keys(s).some(k => /^(ap_|drug_|dm_)/.test(k) && s[k]) || (s.anticoag && s.anticoag !== 'none');
    plan.missing = R.missing(s, d, { cardiacStatus: plan.cardiac.status, anyMed, thromboticLevel: plan.thrombotic.level });
    return plan;
  }

  // ---------- Problem list ----------
  function problemList(s, D) {
    const out = [];
    const skip = new Set(['none', 'never', 'notDone', 'normal']);
    for (const sec of D.questionnaire) {
      for (const f of sec.fields) {
        const v = s[f.k];
        if (f.t === 'cb' && v) out.push(f.label);
        if (f.t === 'radio' && v && !skip.has(v) && !['asa'].includes(f.k)) {
          const o = f.opts.find(x => x.v === v);
          if (o) out.push(`${f.label}: ${o.l}`);
        }
        if (f.t === 'num' && num(v) != null) out.push(`${f.label}: ${v}`);
      }
    }
    return out;
  }

  // ---------- Plain text ----------
  const LINE = '='.repeat(72);
  const SUB = '-'.repeat(72);
  const wrap = (text, indent = 4, width = 72) => {
    const words = String(text).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > width - indent) { lines.push(cur); cur = w; }
      else cur = (cur + ' ' + w).trim();
    }
    if (cur) lines.push(cur);
    return lines.map((l, i) => ' '.repeat(i ? indent + 2 : indent) + l).join('\n');
  };
  const bullet = (t, cls) => wrap(`- ${cls ? '[' + cls + '] ' : ''}${t}`);

  function calendarText(rows, from, to, surgeryDate, R) {
    const days = [];
    for (let x = from; x <= to; x++) days.push(x);
    const col = 7;
    const pad = (t, n) => String(t).padEnd(n).slice(0, n);
    let out = '    ' + pad('Day', 10) + days.map(x => pad(R.dayLabel(x), col)).join('') + '\n';
    if (surgeryDate) out += '    ' + pad('Date', 10) + days.map(x => pad(R.addDays(surgeryDate, x).slice(5).replace('-', '/'), col)).join('') + '\n';
    for (const r of rows) out += '    ' + pad(r.label, 10) + days.map(x => pad(r.cell(x), col)).join('') + '\n';
    return out.trimEnd();
  }

  function toPlainText(s, plan, D, R) {
    const d = plan.d;
    const L = [];
    const urg = (D.urgency.find(u => u.v === s.urgency) || {}).l;
    const sr = s.surgRisk ? D.surgicalRisk[s.surgRisk].label : null;
    const br = s.bleedRisk ? D.bleedingRisk[s.bleedRisk].label : null;
    const an = s.anesthesia ? { ga: 'General anesthesia', neuraxial: 'Neuraxial anesthesia', regional: 'Regional block', local: 'Local ± sedation' }[s.anesthesia] : null;

    L.push(LINE, 'PRE-OPERATIVE ASSESSMENT AND MANAGEMENT SUGGESTION', LINE);
    L.push(`Patient   : ${[s.name, s.hn && 'HN ' + s.hn].filter(Boolean).join('  ') || '-'}`);
    L.push(`Age/Sex   : ${[s.age, s.sex].filter(Boolean).join(' / ') || '-'}   Weight ${s.weight ?? '-'} kg   BMI ${d.bmi ?? '-'}`);
    L.push(`Operation : ${s.operation || '-'}${s.surgeryDate ? '  on ' + R.formatDate(s.surgeryDate) : ''}`);
    L.push(`Surgery   : ${[urg, sr, br, an].filter(Boolean).join(' | ') || '-'}`);
    const labs = [
      s.scr != null && `Cr ${s.scr}`, d.crcl != null && `CrCl ${d.crcl}${d.crclManual ? ' (manual)' : ''}`,
      s.hb != null && `Hb ${s.hb}`, s.albumin != null && `Alb ${s.albumin}`, s.k != null && `K ${s.k}`,
      s.hba1c != null && `HbA1c ${s.hba1c}%`, s.spo2 != null && `SpO2 ${s.spo2}%`
    ].filter(Boolean);
    L.push(`Labs      : ${labs.join('  ') || '-'}`);

    const probs = problemList(s, D);
    L.push('', 'PROBLEM LIST', SUB);
    L.push(probs.length ? probs.map(p => bullet(p)).join('\n') : '    - No significant comorbidity recorded');

    // 1. Cardiovascular
    L.push('', '1. CARDIOVASCULAR', SUB);
    L.push(wrap(`Institutional pathway: ${plan.cardiac.title}`, 2));
    plan.cardiac.detail.forEach(t => L.push(bullet(t)));
    if (plan.cardiac.trail.length) L.push(wrap(`Path: ${plan.cardiac.trail.join(' > ')}`, 4));
    L.push(wrap(`RCRI ${d.rcri.score}: major cardiac complication ${d.rcri.lee} (Lee); 30-day death/MI/arrest ${d.rcri.duceppe} (Duceppe)`, 2));
    if (d.rcri.items.length) L.push(wrap(`Predictors: ${d.rcri.items.join('; ')}`, 4));
    const fcl = (D.functionalCapacity.find(f => f.v === s.fc) || {}).l;
    if (fcl || plan.dasi.answered) L.push(wrap(`Functional capacity: ${fcl || '-'}${plan.dasi.answered ? `; DASI ${plan.dasi.score} (≈ ${plan.dasi.mets} METs${plan.dasi.poor ? ', poor' : ''})` : ''}`, 2));
    if (d.frailty) L.push(wrap(`Frailty phenotype: ${d.frailty}/5`, 2));
    L.push(wrap(`ESC 2022 testing (${plan.esc.groupLabel}):`, 2));
    plan.esc.recs.forEach(r => L.push(bullet(r.text, r.cls)));
    L.push(wrap(`AHA 2024 stepwise${plan.aha.modifiers.length ? ' (risk modifiers: ' + plan.aha.modifiers.join(', ') + ')' : ''}:`, 2));
    plan.aha.steps.forEach(t => L.push(bullet(t)));
    if (plan.pci) L.push(bullet(`PCI timing: ${plan.pci.text}`));
    if (plan.dapt) L.push(bullet(`DAPT: ${plan.dapt.text}`, plan.dapt.cls));
    plan.specifics.forEach(t => L.push(bullet(t)));
    if (plan.ie) {
      L.push(bullet('IE prophylaxis, single dose 30–60 min before procedure:'));
      L.push(wrap(`No penicillin allergy: ${plan.ie.noAllergy.join(' OR ')}`, 6));
      L.push(wrap(`Penicillin allergy: ${plan.ie.allergy.join(' OR ')}`, 6));
    }

    // 2. Pulmonary
    const p = plan.ppc;
    L.push('', '2. PULMONARY', SUB);
    L.push(wrap(`Postoperative pulmonary complication risk: ${p.level.toUpperCase()} - ${p.why}`, 2));
    if (p.patient.length) L.push(wrap(`Patient factors: ${p.patient.join(', ')}`, 4));
    if (p.op.length) L.push(wrap(`Operative factors: ${p.op.join(', ')}`, 4));
    p.pft.forEach(t => L.push(bullet(t)));
    if (plan.ppo) {
      L.push(bullet(`ppoFEV1 ${plan.ppo.ppoFev1 ?? '-'}%, ppoDLCO ${plan.ppo.ppoDlco ?? '-'}% by ${plan.ppo.method}. ${plan.ppo.next}`));
      if (num(s.paco2) != null && s.paco2 > 45) L.push(bullet(`PaCO2 ${s.paco2} mmHg > 45: increased risk of prolonged ventilation.`));
      if (num(s.vo2max) != null) L.push(bullet(`VO2max ${s.vo2max} mL/kg/min${s.vo2max < 10 ? ': < 10, prohibitive risk for resection' : s.vo2max > 20 ? ': > 20, low risk' : ': 10–20, moderate risk'}.`));
    }
    p.recs.forEach(t => L.push(bullet(t)));

    // 3. Kidney
    L.push('', '3. KIDNEY', SUB);
    if (plan.renal.applicable) {
      if (plan.renal.labs.length) L.push(bullet(`Labs: ${plan.renal.labs.join('; ')}`));
      plan.renal.recs.forEach(t => L.push(bullet(t)));
    } else L.push('    - No kidney-specific issue identified');

    // 4. Endocrine
    L.push('', '4. DIABETES AND ENDOCRINE', SUB);
    if (plan.dm) {
      plan.dm.pre.forEach(t => L.push(bullet(t)));
      plan.dm.drugs.forEach(x => L.push(bullet(`${x.name}: ${x.rec}${x.dates ? ' ' + x.dates + '.' : ''}`)));
      if (plan.dm.insulin.length) { L.push(wrap('Insulin adjustment:', 4)); plan.dm.insulin.forEach(t => L.push(wrap('* ' + t, 6))); }
      L.push(wrap('Intra-operative:', 4)); plan.dm.intra.forEach(t => L.push(wrap('* ' + t, 6)));
      L.push(wrap('Post-operative:', 4)); plan.dm.post.forEach(t => L.push(wrap('* ' + t, 6)));
    } else L.push('    - No diabetes');
    if (s.adrenalInsufficiency || s.chronicSteroid) {
      const g = (D.surgicalStress.find(x => x.v === s.stressGrade) || {}).l;
      L.push(bullet(`Glucocorticoid${g ? ' (' + g + ')' : ''}:`));
      (plan.steroid || ['Select surgical stress grade.']).forEach(t => L.push(wrap('* ' + t, 6)));
      if (s.chronicSteroid && !s.adrenalInsufficiency) L.push(wrap('* Steroid for another indication: confirm plan with the prescribing physician.', 6));
    }

    // 5. Medications
    L.push('', '5. MEDICATION PLAN', SUB);
    if (s.bleedRisk) L.push(wrap(`Procedural bleeding risk: ${br}`, 2));
    if (plan.antiplatelet) {
      L.push(wrap(`Antiplatelet: ${plan.antiplatelet.summary}`, 2));
      plan.antiplatelet.drugs.forEach(x => L.push(bullet(`${x.name}: ${x.rec}${x.dates ? ' ' + x.dates + '.' : ''}`)));
    }
    if (plan.doac) {
      const x = plan.doac;
      L.push(wrap(`Anticoagulant: ${x.name}${d.crcl != null ? ` (CrCl ${d.crcl})` : ''}`, 2));
      if (!x.incomplete) {
        L.push(bullet(`Last dose ${R.dayLabel(x.lastDose)}${s.surgeryDate ? ' (' + R.formatDate(R.addDays(s.surgeryDate, x.lastDose)) + ')' : ''}; resume ${R.dayLabel(x.resume)}${s.surgeryDate ? ' (' + R.formatDate(R.addDays(s.surgeryDate, x.resume)) + ')' : ''}.`));
        L.push(calendarText([{ label: x.name.slice(0, 10), cell: n => (n <= x.lastDose || n >= x.resume ? 'dose' : 'HOLD') }], -5, 3, s.surgeryDate, R));
      }
      x.notes.forEach(t => L.push(bullet(t)));
    }
    if (plan.warfarin) {
      const w = plan.warfarin;
      L.push(wrap(`Anticoagulant: Warfarin${plan.thrombotic.level ? ' (thrombotic risk ' + plan.thrombotic.level + ')' : ''}`, 2));
      plan.thrombotic.reasons.forEach(t => L.push(wrap('* ' + t, 6)));
      w.notes.forEach(t => L.push(bullet(t)));
      if (w.status === 'stop' || w.status === 'bridge') {
        const rows = [{ label: 'Warfarin', cell: n => (n <= w.warfarinLast || n >= w.warfarinResume ? 'give' : 'HOLD') }];
        if (w.status === 'bridge') rows.push({ label: 'Heparin', cell: n => (w.heparinDays.includes(n) ? (n === -1 ? 'last*' : 'give') : n >= w.heparinResume ? 'give' : n > -4 ? 'HOLD' : '-') });
        L.push(calendarText(rows, -6, 4, s.surgeryDate, R));
      }
      if (plan.bridgeDose) [plan.bridgeDose.enoxaparin, plan.bridgeDose.bemiparin, plan.bridgeDose.note].forEach(t => L.push(bullet(t)));
    }
    if (plan.oacPciNote) L.push(bullet(plan.oacPciNote));
    plan.neuraxial.forEach(t => L.push(bullet(t)));
    if (plan.drugs.length) {
      L.push(wrap('Other medications:', 2));
      plan.drugs.forEach(x => L.push(bullet(`${x.name}: ${x.rec}${x.dates ? ' ' + x.dates + '.' : ''}`)));
    }
    if (s.noMeds && !plan.drugs.length && !plan.antiplatelet && !plan.doac && !plan.warfarin && !plan.dm) L.push('    - No regular medication');

    // 6. Consults
    L.push('', '6. CONSULTATIONS', SUB);
    L.push(plan.consults.length ? plan.consults.map(c => bullet(c)).join('\n') : '    - None required by the rules');

    if (plan.missing.length) {
      L.push('', 'INCOMPLETE ITEMS', SUB);
      plan.missing.forEach(m => L.push(bullet(m)));
    }
    L.push('', SUB);
    L.push(wrap(`Assessor: ${s.assessor || '-'} | Date: ${s.date ? R.formatDate(s.date) : '-'}`, 0));
    L.push(wrap('Decision support only; final decisions rest with the treating physician. Sources: 2022 ESC NCS, 2024 AHA/ACC perioperative, ADA 2026, CHEST 2022, ADQI, institutional protocol.', 0));
    return L.join('\n');
  }

  const api = { buildPlan, problemList, toPlainText, calendarText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PREOP = root.PREOP || {}).report = api;
})(this);

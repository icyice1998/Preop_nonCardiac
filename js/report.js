// Assembles the full plan from state and renders the stepwise plain-text management suggestion.
// Pure functions: (state, data, rules) -> plan -> text.
(function (root) {
  const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  function buildPlan(s, D, R) {
    const d = R.derive(s);
    const plan = { d, consults: [], meds: [] };
    const consult = c => { if (!plan.consults.includes(c)) plan.consults.push(c); };
    const med = (name, tag, timing, detail) => plan.meds.push({ name, tag, timing: timing || '', detail: detail || '' });

    // Cardiac
    plan.cardiac = R.cardiacRisk(s);
    plan.esc = R.escTesting(s, d);
    plan.aha = R.ahaPathway(s, d);
    plan.pci = R.pciTiming(s);
    plan.dapt = R.daptAdvice(s, D.antiplatelets);
    plan.dasi = R.dasi(s, D.dasi);
    plan.specifics = R.cardiacSpecifics(s, d);
    plan.initiation = R.pharmacoInitiation(s, d);
    if (plan.cardiac.status === 'consultCardio') consult('Cardiology: institutional cardiac pathway');
    if (plan.cardiac.status === 'consultMed') consult('Internal Medicine / Cardiology: institutional cardiac pathway');
    if (plan.esc.group === 'cvd' && s.surgRisk === 'high') consult('Cardiology: established CVD with high-risk surgery');
    if (plan.pci && (plan.pci.status === 'delay' || plan.pci.status === 'harm')) consult('Cardiology: surgery timing after PCI');
    if (s.vhd_AS || s.vhd_ASasx || s.vhd_AR || s.vhd_MS || s.vhd_MR) consult('Cardiology / Heart Team: severe valvular disease');
    if (s.rm_cied) consult('Cardiology / EP: CIED interrogation and programming');

    // Antiplatelet
    plan.antiplatelet = R.antiplateletPlan(s, D.antiplatelets);
    if (plan.antiplatelet) {
      const a = plan.antiplatelet;
      if (a.action === 'consult') consult('Cardiology: antiplatelet after PCI < 1 year');
      a.drugs.forEach(x => {
        const tag = a.action === 'stop' ? 'STOP' : a.action === 'continue' ? 'CONTINUE' : a.action === 'consult' ? 'CONSULT' : 'CHOOSE';
        const m = /last dose (D-\d+(?: to D-\d+)?)/.exec(x.rec);
        med(x.name, tag, m ? `last dose ${m[1]}; restart 24–48 h post-op` : '', x.rec);
      });
    }

    // Anticoagulant
    const age = num(s.age) || 0;
    const afItems = { chf: s.hf || s.ac_chf, ht: s.rf_ht, dm: d.dm || s.rf_dm, stroke: s.cvd || s.rm_recentStroke, vascular: s.ihd || s.pad || s.priorPci || s.cabg };
    plan.af = { present: !!s.af, chads: R.chads2(afItems, age), vasc: R.cha2ds2vasc(afItems, age, s.sex) };
    plan.thrombotic = R.thromboticRisk(s, D.thromboticRisk, s.af ? plan.af : null);
    if (s.anticoag === 'warfarin') {
      const w = plan.warfarin = R.warfarinPlan({ bleeding: s.bleedRisk, thrombotic: plan.thrombotic.level });
      if (w.status === 'bridge') plan.bridgeDose = R.bridgingDose({ weight: s.weight, crcl: d.crcl }, D.bemiparin);
      if (w.status === 'continue') med('Warfarin', 'CONTINUE', 'minimal bleeding risk', w.notes[0]);
      else if (w.status === 'stop') med('Warfarin', 'STOP', 'last dose D-6; INR D0; restart within 24 h', 'No bridging.');
      else if (w.status === 'bridge') {
        med('Warfarin', 'STOP', 'last dose D-6; INR D-1; restart 48–72 h', 'High thrombotic risk.');
        med('LMWH / UFH bridge', 'BRIDGE', 'D-3 to D-1 (last ≈ 24 h pre-op); restart D+2–3', plan.bridgeDose ? plan.bridgeDose.enoxaparin : 'Enter weight and creatinine for dose.');
      } else med('Warfarin', 'CHOOSE', '', w.notes[0]);
    } else if (s.anticoag && s.anticoag !== 'none') {
      const doac = D.doacs.find(x => x.id === s.anticoag);
      const sch = R.doacSchedule({ drug: doac.group === 'dabigatran' ? 'dabigatran' : doac.id, crcl: d.crcl, bleeding: s.bleedRisk });
      plan.doac = Object.assign({ name: doac.name }, sch || { incomplete: true, notes: ['Select the procedural bleeding risk.'] });
      if (plan.doac.notes.some(n => /Hematology/.test(n))) consult('Hematology: DOAC interruption with renal impairment');
      if (plan.doac.incomplete) med(doac.name, 'CHOOSE', '', plan.doac.notes[0]);
      else if (s.bleedRisk === 'minimal') med(doac.name, 'HOLD D0', 'skip day of surgery only; restart after hemostasis', 'No bridging.');
      else med(doac.name, 'STOP', `last dose ${R.dayLabel(plan.doac.lastDose)}; restart ${R.dayLabel(plan.doac.resume)}`, 'No bridging.');
    }
    plan.reversal = R.reversalNotes(s);
    if (s.priorPci && s.anticoag && s.anticoag !== 'none') plan.oacPciNote = 'Prior PCI on OAC monotherapy: substitute aspirin peri-operatively while OAC is held, when feasible (AHA 1).';
    plan.neuraxial = R.neuraxialNotes(s);

    // Generic drugs
    plan.drugs = [];
    for (const g of D.drugGroups) {
      for (const item of g.items) {
        if (!s['drug_' + item.id]) continue;
        let rec, raw, flag = item.flag;
        if (item.options) {
          const o = item.options.find(x => x.id === s['opt_' + item.id]);
          raw = o ? o.rec : 'Select the indication / clinical status.';
          rec = o ? `${o.label}: ${o.rec}` : raw;
          flag = o && o.flag;
        } else rec = raw = item.rec;
        plan.drugs.push({ group: g.title, id: item.id, name: item.name, rec });
        const tag = R.actionTag(raw);
        med(item.name, tag, item.stop ? `last dose D-${item.stop[1] + 1}` : tag === 'HOLD D0' ? 'omit morning of surgery' : '', raw);
        if (flag === 'consult') consult(/psychiatry/i.test(rec) ? `Psychiatry: ${item.name}` : `Internal Medicine: ${item.name}`);
      }
    }

    // Diabetes / steroid
    plan.dm = R.dmPlan(s, d, D.dmDrugs);
    if (plan.dm) {
      plan.dm.drugs.forEach(x => {
        const tag = R.actionTag(x.raw || x.rec);
        med(x.name, tag, x.stop ? `last dose D-${x.stop[1] + 1}` : tag === 'HOLD D0' ? 'omit on day of surgery' : '', x.rec);
      });
      plan.dm.insulin.forEach(t => med('Insulin', 'ADJUST', t.replace(/\s*\(usual [^)]*\)\.?$/, ''), t));
      if (plan.dm.optimize) consult('Internal Medicine / Endocrinology: optimize glycemia before elective surgery');
    }
    plan.steroid = (s.adrenalInsufficiency || s.chronicSteroid) ? R.steroidPlan(s.stressGrade) : null;
    if (plan.steroid) med('Glucocorticoid', 'ADJUST', 'stress dose at induction', plan.steroid.slice(1).join(' ') || plan.steroid[0]);

    // Pulmonary
    plan.ppc = R.ppcRisk(s, d);
    if (plan.ppc.consult.length) consult(`Pulmonology: ${plan.ppc.consult.join('; ')}`);
    if (s.site_lungResection) plan.ppo = R.ppoLung({ fev1: s.fev1Pct, dlco: s.dlcoPct, resected: s.resectedSeg, obstructed: s.obstructedSeg, perfusion: s.perfusionPct });
    if ((s.copdStatus === 'uncontrolled' && s.urgency === 'elective') || s.osaSuspected) consult('Anesthesiology: airway / pulmonary optimization');

    // Kidney
    plan.renal = R.renalPlan(s, d);
    if (d.onDialysis) consult('Nephrology: dialysis timing and access');

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
        if (f.t === 'radio' && v && !skip.has(v) && f.k !== 'asa' && f.k !== 'avrCandidate') {
          const o = f.opts.find(x => x.v === v);
          if (o) out.push(`${f.label}: ${o.l}`);
        }
        if (f.t === 'num' && num(v) != null) out.push(`${f.label}: ${v}`);
      }
    }
    return out;
  }

  // ---------- Plain text helpers (narrow width so it reads on a phone) ----------
  const W = 64;
  const LINE = '='.repeat(W);
  const SUB = '-'.repeat(W);
  function wrap(text, indent = 4, hang = 2) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const lim = W - indent - (lines.length ? hang : 0);
      if (cur && (cur + ' ' + w).length > lim) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
    }
    if (cur) lines.push(cur);
    return lines.map((l, i) => ' '.repeat(indent + (i ? hang : 0)) + l).join('\n');
  }
  const bullet = (t, cls) => wrap(`- ${cls ? '[' + cls + '] ' : ''}${t}`, 4, 2);
  const arrow = t => wrap(`-> ${t}`, 6, 3);
  const head = (n, title) => ['', `STEP ${n}  ${title}`, SUB];

  function calendarText(rows, from, to, R) {
    const days = [];
    for (let x = from; x <= to; x++) days.push(x);
    const pad = (t, n) => String(t).padEnd(n).slice(0, n);
    let out = '    ' + pad('Day', 9) + days.map(x => pad(R.dayLabel(x), 5)).join('') + '\n';
    for (const r of rows) out += '    ' + pad(r.label, 9) + days.map(x => pad(r.cell(x), 5)).join('') + '\n';
    return out.trimEnd();
  }

  function medTableText(meds) {
    if (!meds.length) return ['    - No medication entered'];
    const out = [];
    for (const m of meds) {
      out.push(`    [${m.tag}]`.padEnd(15) + m.name);
      if (m.timing) out.push(wrap(m.timing, 15, 0));
    }
    return out;
  }

  // ---------- Stepwise plain text ----------
  function toPlainText(s, plan, D, R) {
    const d = plan.d;
    const L = [];
    const urg = (D.urgency.find(u => u.v === s.urgency) || {}).l;
    const an = s.anesthesia ? { ga: 'General anesthesia', neuraxial: 'Spinal / epidural', regional: 'Peripheral nerve block', local: 'Local ± sedation' }[s.anesthesia] : null;
    const sites = D.surgeryDetailFields.filter(f => /^site_|longDuration/.test(f.k) && s[f.k]).map(f => f.label);

    L.push(LINE, 'PRE-OPERATIVE ASSESSMENT: STEPWISE PLAN', LINE);
    L.push(wrap(`Patient: ${[s.age && s.age + ' y', s.sex, s.weight && s.weight + ' kg', d.bmi && 'BMI ' + d.bmi, s.hn && 'HN ' + s.hn].filter(Boolean).join(' | ') || '-'}`, 0));
    L.push(wrap(`Operation: ${s.operation || '-'}`, 0));
    const labs = [s.scr != null && `Cr ${s.scr}`, d.crcl != null && `CrCl ${d.crcl}`, s.hb != null && `Hb ${s.hb}`, s.albumin != null && `Alb ${s.albumin}`, s.k != null && `K ${s.k}`, s.hba1c != null && `A1C ${s.hba1c}%`, s.spo2 != null && `SpO2 ${s.spo2}%`].filter(Boolean);
    L.push(wrap(`Labs: ${labs.join(', ') || '-'}`, 0));
    const probs = problemList(s, D);
    L.push('', 'PROBLEM LIST', SUB);
    L.push(probs.length ? probs.map(p => bullet(p)).join('\n') : '    - No comorbidity recorded');

    // STEP 1 type of surgery
    L.push(...head(1, 'TYPE OF SURGERY'));
    L.push(wrap(`1.1 Timing: ${urg || 'not set'}`, 2));
    if (s.urgency) L.push(arrow(D.urgencyMeaning[s.urgency]));
    L.push(wrap(`1.2 Surgical (cardiac) risk: ${s.surgRisk ? D.surgicalRisk[s.surgRisk].label : 'not set'}`, 2));
    if (s.surgRisk) L.push(arrow(D.surgRiskMeaning[s.surgRisk]));
    L.push(wrap(`1.3 Bleeding risk: ${s.bleedRisk ? D.bleedingRisk[s.bleedRisk].label : 'not set'}`, 2));
    if (s.bleedRisk) L.push(arrow(D.bleedMeaning[s.bleedRisk]));
    L.push(wrap(`1.4 Surgical stress: ${(D.surgicalStress.find(x => x.v === s.stressGrade) || {}).l || 'not set'}`, 2));
    if (s.stressGrade) L.push(arrow(D.stressMeaning[s.stressGrade] + ' (relevant if on chronic steroid)'));
    L.push(wrap(`1.5 Anesthesia and site: ${[an].concat(sites).filter(Boolean).join('; ') || 'not set'}`, 2));
    const rcriSurg = d.rcri.items.some(i => /High-risk surgery/.test(i));
    L.push(arrow(`RCRI high-risk surgery: ${rcriSurg ? 'yes' : 'no'}. Pulmonary operative factors: ${plan.ppc.op.join(', ') || 'none'}.`));

    // STEP 2 active conditions
    L.push(...head(2, 'ACTIVE CARDIAC CONDITIONS'));
    const active = D.activeCardiac.filter(f => s[f.k]).map(f => f.label);
    if (active.length) { active.forEach(a => L.push(bullet(a))); L.push(arrow('Stabilize first; defer elective surgery; cardiology consultation.')); }
    else L.push(arrow('None: no cardiac reason to defer surgery.'));

    // STEP 3 risk modifiers and factors
    L.push(...head(3, 'RISK MODIFIERS, RISK FACTORS, RCRI'));
    const rm = D.riskModifying.filter(f => s[f.k]).map(f => f.label).concat(plan.aha.modifiers.filter(m => /stent|Frailty/.test(m)));
    L.push(wrap(`Risk modifiers: ${rm.join(', ') || 'none'}`, 2));
    L.push(wrap(`Frailty phenotype: ${d.frailty}/5${d.frailty >= 3 ? ' (frail)' : ''}`, 2));
    L.push(wrap(`Clinical risk factors: ${D.clinicalRisk.filter(f => s[f.k]).map(f => f.label).join(', ') || 'none'}`, 2));
    L.push(wrap(`RCRI ${d.rcri.score}: MACE ${d.rcri.lee} (Lee); 30-day death/MI/arrest ${d.rcri.duceppe} (Duceppe)`, 2));
    if (d.rcri.items.length) L.push(wrap(`Predictors: ${d.rcri.items.join('; ')}`, 4));

    // STEP 4 functional capacity
    L.push(...head(4, 'FUNCTIONAL CAPACITY'));
    const fcl = (D.functionalCapacity.find(f => f.v === s.fc) || {}).l;
    L.push(wrap(`${fcl || 'not assessed'}${plan.dasi.answered ? `; DASI ${plan.dasi.score} (≈ ${plan.dasi.mets} METs${plan.dasi.poor ? ', poor' : ''})` : ''}`, 2));
    L.push(arrow(d.poorFC ? 'Poor/unknown (< 4 METs, DASI ≤ 34): biomarkers if testing will change management.' : s.fc ? '≥ 4 METs: no further cardiac testing needed for this reason.' : 'Ask: climbs 1–2 flights of stairs without stopping?'));

    // STEP 5 cardiac decision
    L.push(...head(5, 'CARDIAC DECISION AND TESTING'));
    L.push(wrap(`Institutional pathway: ${plan.cardiac.title}`, 2));
    plan.cardiac.detail.forEach(t => L.push(bullet(t)));
    if (plan.cardiac.trail.length) L.push(wrap(`Path: ${plan.cardiac.trail.join(' > ')}`, 4));
    L.push(wrap(`ESC 2022 (${plan.esc.groupLabel}):`, 2));
    plan.esc.recs.forEach(r => L.push(bullet(r.text, r.cls)));
    L.push(wrap('AHA 2024 stepwise:', 2));
    plan.aha.steps.forEach(t => L.push(bullet(t)));

    // STEP 6 specific conditions
    L.push(...head(6, 'SPECIFIC CARDIAC CONDITIONS'));
    const spec = [];
    if (plan.pci) spec.push(`PCI timing: ${plan.pci.text}`);
    if (plan.dapt) spec.push(`DAPT: ${plan.dapt.text}`);
    spec.push(...plan.specifics);
    if (spec.length) spec.forEach(t => L.push(bullet(t)));
    else L.push('    - None');
    if (plan.ie) {
      L.push(bullet('IE prophylaxis, single dose 30–60 min before:'));
      L.push(wrap(`No allergy: ${plan.ie.noAllergy.join(' OR ')}`, 6));
      L.push(wrap(`Penicillin allergy: ${plan.ie.allergy.join(' OR ')}`, 6));
    }

    // STEP 7 medications
    L.push(...head(7, 'MEDICATION MANAGEMENT'));
    let sub = 1;
    const sec7 = t => L.push(wrap(`7.${sub++} ${t}`, 2));
    sec7('Summary (D0 = day of surgery)');
    L.push(...medTableText(plan.meds));
    if (plan.antiplatelet) {
      sec7('Antiplatelet');
      L.push(bullet(plan.antiplatelet.summary));
      plan.antiplatelet.drugs.forEach(x => L.push(bullet(`${x.name}: ${x.rec}`)));
    }
    if (plan.doac || plan.warfarin) {
      sec7('Anticoagulant');
      if (plan.doac && !plan.doac.incomplete) {
        const x = plan.doac;
        L.push(calendarText([{ label: x.name.slice(0, 9), cell: n => (n <= x.lastDose || n >= x.resume ? 'on' : 'OFF') }], -5, 3, R));
      }
      if (plan.doac) plan.doac.notes.forEach(t => L.push(bullet(t)));
      if (plan.warfarin) {
        const w = plan.warfarin;
        plan.thrombotic.reasons.forEach(t => L.push(bullet(`Thrombotic risk: ${t}`)));
        if (w.status === 'stop' || w.status === 'bridge') {
          const rows = [{ label: 'Warfarin', cell: n => (n <= w.warfarinLast || n >= w.warfarinResume ? 'on' : 'OFF') }];
          if (w.status === 'bridge') rows.push({ label: 'Heparin', cell: n => (w.heparinDays.includes(n) || n >= w.heparinResume ? 'on' : n > -4 ? 'OFF' : '-') });
          L.push(calendarText(rows, -6, 4, R));
        }
        w.notes.forEach(t => L.push(bullet(t)));
        if (plan.bridgeDose) [plan.bridgeDose.enoxaparin, plan.bridgeDose.bemiparin, plan.bridgeDose.note].forEach(t => L.push(bullet(t)));
      }
      plan.reversal.forEach(t => L.push(bullet(t)));
      if (plan.oacPciNote) L.push(bullet(plan.oacPciNote));
    }
    if (plan.neuraxial.length) { L.push(wrap('Neuraxial anesthesia:', 2)); plan.neuraxial.forEach(t => L.push(bullet(t))); }
    if (plan.drugs.length) {
      sec7('Other regular medications');
      plan.drugs.forEach(x => L.push(bullet(`${x.name}: ${x.rec}`)));
    }
    if (plan.initiation.length) {
      sec7('Start or avoid');
      plan.initiation.forEach(x => L.push(bullet(x.text, x.cls)));
    }
    if (plan.dm) {
      sec7('Diabetes');
      plan.dm.pre.forEach(t => L.push(bullet(t)));
      plan.dm.drugs.forEach(x => L.push(bullet(`${x.name}: ${x.rec}`)));
      plan.dm.insulin.forEach(t => L.push(bullet(`Insulin: ${t}`)));
      plan.dm.intra.forEach(t => L.push(bullet(`Intra-op: ${t}`)));
    }
    if (s.adrenalInsufficiency || s.chronicSteroid) {
      sec7('Glucocorticoid');
      (plan.steroid || ['Select surgical stress grade.']).forEach(t => L.push(bullet(t)));
      if (s.chronicSteroid && !s.adrenalInsufficiency) L.push(bullet('Steroid for another indication: confirm with the prescribing physician.'));
    }
    if (s.noMeds && !plan.meds.length) L.push('    - No regular medication');

    // STEP 8 pulmonary
    const p = plan.ppc;
    L.push(...head(8, 'PULMONARY'));
    L.push(wrap(`Pulmonary complication risk: ${p.level.toUpperCase()} (${p.why})`, 2));
    if (p.patient.length) L.push(wrap(`Patient factors: ${p.patient.join(', ')}`, 4));
    p.pft.forEach(t => L.push(bullet(t)));
    if (plan.ppo) L.push(bullet(`ppoFEV1 ${plan.ppo.ppoFev1 ?? '-'}%, ppoDLCO ${plan.ppo.ppoDlco ?? '-'}%: ${plan.ppo.next}`));
    p.recs.forEach(t => L.push(bullet(t)));

    // STEP 9 kidney
    L.push(...head(9, 'KIDNEY'));
    if (plan.renal.applicable) {
      if (plan.renal.labs.length) L.push(bullet(`Labs: ${plan.renal.labs.join('; ')}`));
      plan.renal.recs.forEach(t => L.push(bullet(t)));
    } else L.push('    - No kidney-specific issue');

    // STEP 10 post-op
    L.push(...head(10, 'POST-OPERATIVE'));
    const post = [];
    const tn = plan.esc.recs.find(r => /hs-cTn at baseline/.test(r.text));
    if (tn) post.push('hs-troponin at 24 h and 48 h; rise > ULN = PMI: ECG, echo, find cause (ESC I).');
    if (plan.doac || plan.warfarin) post.push('Resume anticoagulant per schedule only after hemostasis is secure (AHA 2a).');
    if (plan.antiplatelet && plan.antiplatelet.action === 'stop') post.push('Restart antiplatelet 24–48 h post-op when hemostasis is secure.');
    if (s.drug_acei) post.push('Restart ACE-I/ARB within 48 h if hemodynamically stable without AKI.');
    if (plan.dm) plan.dm.post.forEach(t => post.push(t));
    if (p.level !== 'low') post.push('I COUGH bundle, early mobilization, adequate analgesia.');
    if (plan.renal.applicable) post.push('Monitor creatinine, potassium and urine output.');
    if (!post.length) post.push('Routine post-operative care.');
    post.forEach(t => L.push(bullet(t)));

    // STEP 11 consults
    L.push(...head(11, 'CONSULTATIONS'));
    L.push(plan.consults.length ? plan.consults.map(c => bullet(c)).join('\n') : '    - None required by the rules');

    if (plan.missing.length) {
      L.push('', 'INCOMPLETE ITEMS', SUB);
      plan.missing.forEach(m => L.push(bullet(m)));
    }
    L.push('', SUB);
    L.push(wrap('Decision support only; final decisions rest with the treating physician. Sources: ESC 2022, AHA/ACC 2024, ADA 2026, CHEST 2022, ADQI, institutional protocol.', 0, 0));
    return L.join('\n');
  }

  const api = { buildPlan, problemList, toPlainText, calendarText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PREOP = root.PREOP || {}).report = api;
})(this);

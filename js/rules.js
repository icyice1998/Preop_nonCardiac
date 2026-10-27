// Decision logic. Pure functions only: no DOM access, so it can be unit-tested in Node.
(function (root) {
  const LEVELS = ['low', 'moderate', 'high'];

  // ---------- Dates ----------
  // Dates are ISO strings (yyyy-mm-dd) handled in UTC to avoid timezone drift.
  function addDays(iso, n) {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return dt.toISOString().slice(0, 10);
  }

  function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  function dayLabel(n) {
    return n === 0 ? 'D0' : (n > 0 ? 'D+' + n : 'D' + n);
  }

  // ---------- Renal function ----------
  function cockcroftGault({ age, weight, scr, sex }) {
    if (!(age > 0 && weight > 0 && scr > 0)) return null;
    const v = ((140 - age) * weight) / (72 * scr);
    return Math.round((sex === 'F' ? v * 0.85 : v) * 10) / 10;
  }

  // ---------- Page 1: cardiac risk pathway ----------
  // Returns { reached: Set of step numbers, status, title, detail[], trail[] }
  // status: incomplete | proceedNow | proceed | consultMed | consultCardio
  function cardiacRisk(s) {
    const reached = new Set([1]);
    const trail = [];
    const done = (status, title, detail = []) => ({ reached, status, title, detail, trail });

    if (!s.urgency) return done('incomplete', 'Select the urgency of surgery (Step 1).');

    if (s.urgency === 'emergency') {
      trail.push('Emergency surgery');
      return done('proceedNow', 'Proceed to surgery without delay.',
        ['No special cardiac investigation (e.g. echocardiography, CAG) should delay surgery.',
          'Focus on perioperative management and monitoring.']);
    }
    if (s.urgency === 'urgent') {
      trail.push('Urgent surgery');
      if (s.urgentNeedsPrep == null) return done('incomplete', 'Does the patient have cardiac or other disease requiring pre-operative preparation?');
      if (!s.urgentNeedsPrep) {
        trail.push('No condition requiring preparation');
        return done('proceedNow', 'Proceed to surgery promptly.',
          ['No special cardiac investigation (e.g. echocardiography, CAG) is required before surgery.']);
      }
      trail.push('Condition requiring preparation present');
    } else {
      trail.push('Elective / time-sensitive surgery');
    }

    // Step 2
    reached.add(2);
    const active = Object.keys(s.active || {}).filter(k => s.active[k]);
    const riskMod = Object.keys(s.riskMod || {}).filter(k => s.riskMod[k]);
    const frailty = frailtyScore(s.frailty);
    const frail = frailty >= 3;
    if (active.length || riskMod.length || frail) {
      const detail = [];
      if (active.length) detail.push('Active cardiac condition present: stabilize before elective surgery.');
      if (riskMod.length) detail.push('Risk-modifying disease present.');
      if (frail) detail.push(`Physical frailty phenotype ${frailty}/5 (frail).`);
      trail.push('Active cardiac condition or risk-modifying disease present');
      return done(active.length ? 'consultCardio' : 'consultMed', 'Consult Internal Medicine or Cardiology.', detail);
    }
    trail.push('No active cardiac condition or risk-modifying disease');

    // Step 3
    reached.add(3);
    const clinical = Object.keys(s.clinical || {}).filter(k => s.clinical[k]);
    if (!clinical.length) {
      trail.push('No clinical risk factor');
      return done('proceed', 'Surgery can proceed.', ['No special cardiac investigation (e.g. echocardiography, CAG) is required before surgery.']);
    }
    trail.push(`${clinical.length} clinical risk factor(s)`);

    // Step 4
    reached.add(4);
    if (!s.surgicalRisk) return done('incomplete', 'Select the surgical risk category (Step 4).');
    if (s.surgicalRisk === 'low') {
      trail.push('Low surgical risk (< 1%)');
      return done('proceed', 'Surgery can proceed.', ['Low surgical risk: no special cardiac investigation is required before surgery.']);
    }
    trail.push(s.surgicalRisk === 'high' ? 'High surgical risk (> 5%)' : 'Intermediate surgical risk (1–5%)');

    if (!s.fc) return done('incomplete', 'Assess functional capacity (Step 4).');
    if (s.fc !== 'lt4') {
      trail.push('Functional capacity ≥ 4 METs');
      return done('proceed', 'Surgery can proceed.', ['Functional capacity ≥ 4 METs: no special cardiac investigation is required before surgery.']);
    }
    trail.push('Functional capacity < 4 METs');

    if (!s.lowFcOption) return done('incomplete', 'Functional capacity < 4 METs: choose one of the two options.');
    if (s.lowFcOption === 'accept') {
      trail.push('Surgery necessary; patient and family informed and accept the risk');
      return done('proceed', 'Surgery can proceed.', ['Document the risk discussion with the patient and family.']);
    }
    trail.push('Troponin and NT-proBNP measured');
    if (!s.biomarker) return done('incomplete', 'Enter the troponin / NT-proBNP result.');
    if (s.biomarker === 'normal') {
      trail.push('Biomarkers normal');
      return done('proceed', 'Surgery can proceed.', ['Normal troponin and NT-proBNP.']);
    }
    trail.push('Biomarkers abnormal');
    return done('consultCardio', 'Consult Cardiology.', ['Abnormal troponin and/or NT-proBNP.']);
  }

  function frailtyScore(f) {
    return Object.values(f || {}).filter(Boolean).length;
  }

  // ---------- Stroke risk scores ----------
  function chads2(items, age) {
    let s = 0;
    if (items.chf) s += 1;
    if (items.ht) s += 1;
    if (age >= 75) s += 1;
    if (items.dm) s += 1;
    if (items.stroke) s += 2;
    return s;
  }

  function cha2ds2vasc(items, age, sex) {
    let s = 0;
    if (items.chf) s += 1;
    if (items.ht) s += 1;
    if (age >= 75) s += 2; else if (age >= 65) s += 1;
    if (items.dm) s += 1;
    if (items.stroke) s += 2;
    if (items.vascular) s += 1;
    if (sex === 'F') s += 1;
    return s;
  }

  function afLevel(chads, vasc) {
    if (chads >= 5 || vasc >= 7) return 'high';
    if (chads >= 3 || vasc >= 4) return 'moderate';
    return 'low';
  }

  // ---------- Table 2: perioperative thrombotic risk ----------
  // checks: { itemId: true }, defs: data.thromboticRisk, af: { present, chads, vasc } | null
  function thromboticRisk(checks, defs, af) {
    let max = -1;
    const reasons = [];
    for (const group of Object.values(defs)) {
      for (const item of group.items) {
        if (checks[item.id]) {
          max = Math.max(max, LEVELS.indexOf(item.level));
          reasons.push(`${group.label}: ${item.label} (${item.level})`);
        }
      }
    }
    if (af && af.present) {
      const lvl = afLevel(af.chads, af.vasc);
      max = Math.max(max, LEVELS.indexOf(lvl));
      reasons.push(`AF: CHADS2 ${af.chads}, CHA2DS2-VASc ${af.vasc} (${lvl})`);
    }
    return { level: max < 0 ? null : LEVELS[max], reasons };
  }

  // ---------- Antiplatelet ----------
  // Stopping N days before surgery means the first missed dose is D-N and the last dose is D-(N+1).
  function stopWindow(stop, surgeryDate) {
    const [min, max] = stop;
    const text = min === max ? `Stop ${min} days before surgery` : `Stop ${min}–${max} days before surgery`;
    const lastDose = max === min ? dayLabel(-(min + 1)) : `${dayLabel(-(max + 1))} to ${dayLabel(-(min + 1))}`;
    let dates = null;
    if (surgeryDate) {
      dates = max === min
        ? `Last dose ${formatDate(addDays(surgeryDate, -(min + 1)))}`
        : `Last dose between ${formatDate(addDays(surgeryDate, -(max + 1)))} and ${formatDate(addDays(surgeryDate, -(min + 1)))}`;
    }
    return { text, lastDose, dates };
  }

  function antiplateletPlan({ drugs, pci, bleeding }, defs, surgeryDate) {
    const selected = defs.filter(d => drugs[d.id]);
    if (!selected.length) return null;
    if (pci === 'lt1y') {
      return {
        action: 'consult',
        summary: 'PCI < 1 year with antiplatelet therapy: consult Cardiology to decide on antiplatelet adjustment. Do not stop without cardiology input.',
        drugs: selected.map(d => ({ name: d.name, rec: 'Await cardiology decision.' }))
      };
    }
    if (pci === 'gt1y' && bleeding && bleeding !== 'high') {
      return {
        action: 'continue',
        summary: 'PCI > 1 year and the procedure is not high bleeding risk: do not stop antiplatelet before surgery.',
        drugs: selected.map(d => ({ name: d.name, rec: 'Continue.' }))
      };
    }
    if (pci === 'gt1y' && !bleeding) {
      return { action: 'incomplete', summary: 'Select the procedural bleeding risk (Table 1) to decide whether to stop.', drugs: [] };
    }
    const summary = pci === 'gt1y'
      ? 'PCI > 1 year and high bleeding risk procedure: stop antiplatelet per schedule.'
      : 'Stop antiplatelet per schedule.';
    return {
      action: 'stop',
      summary,
      drugs: selected.map(d => {
        const w = stopWindow(d.stop, surgeryDate);
        return { name: d.name, rec: `${w.text} (last dose ${w.lastDose}).`, dates: w.dates };
      })
    };
  }

  // ---------- DOAC (Table 3.2) ----------
  // Returns { lastDose, resume, hold: [days], notes[] } with days relative to surgery (D0).
  function doacSchedule({ drug, crcl, bleeding }) {
    if (!drug || !bleeding) return null;
    const notes = [];
    if (bleeding === 'minimal') {
      return {
        lastDose: -1, resume: 1, hold: [0],
        notes: ['Hold only on the day of surgery; restart after surgery once hemostasis is secure.']
      };
    }
    if (crcl == null) return { incomplete: true, notes: ['Enter creatinine clearance to calculate the DOAC schedule.'] };
    const high = bleeding === 'high';
    let lastDose, resume;
    if (drug === 'dabigatran') {
      if (crcl >= 50) { lastDose = high ? -3 : -2; resume = high ? 3 : 1; }
      else {
        lastDose = high ? -5 : -3; resume = high ? 3 : 1;
        notes.push('CrCl < 50 mL/min on dabigatran: consult Hematology to co-manage interruption.');
      }
    } else {
      if (crcl >= 30) {
        lastDose = high ? -3 : -2; resume = high ? 2 : 1;
        if (high) notes.push('High bleeding risk: resumption may be delayed by one more day.');
      } else {
        lastDose = high ? -4 : -3; resume = high ? 3 : 1;
        notes.push('CrCl < 30 mL/min: consult Hematology to co-manage interruption.');
      }
    }
    const hold = [];
    for (let d = lastDose + 1; d < resume; d++) hold.push(d);
    notes.push('Restart only when post-operative hemostasis is secure.');
    return { lastDose, resume, hold, notes };
  }

  // ---------- Warfarin ----------
  function warfarinPlan({ bleeding, thrombotic }) {
    if (!bleeding) return { status: 'incomplete', notes: ['Select the procedural bleeding risk (Table 1).'] };
    if (bleeding === 'minimal') {
      return { status: 'continue', notes: ['Minimal bleeding risk: do not stop warfarin.'] };
    }
    if (!thrombotic) return { status: 'incomplete', notes: ['Assess perioperative thrombotic risk (Table 2).'] };
    if (thrombotic === 'high') {
      return {
        status: 'bridge',
        warfarinLast: -6, warfarinResume: 3,
        heparinDays: [-3, -2, -1], heparinResume: 3,
        notes: [
          'Stop warfarin 5 days before surgery (last dose D-6).',
          'Start therapeutic heparin on D-3 (if INR is still above range, recheck and start once sub-therapeutic).',
          'LMWH last dose ~24 h before surgery: BID regimen gives only the morning dose on D-1; OD regimen gives half the total daily dose on the morning of D-1.',
          'UFH: IV infusion, stop 6 h before surgery (requires admission before the day of surgery).',
          'Restart warfarin with heparin 48–72 h after surgery once hemostasis is secure (or as the surgeon advises).',
          'Overlap warfarin and heparin, monitor INR; stop heparin once INR is therapeutic (usually 3–5 days).'
        ]
      };
    }
    return {
      status: 'stop',
      warfarinLast: -6, warfarinResume: 1,
      notes: [
        `${thrombotic === 'moderate' ? 'Moderate' : 'Low'} thrombotic risk: stop warfarin 5 days before surgery (last dose D-6); no heparin bridging.`,
        'Check INR on the day of surgery.',
        'Restart warfarin 24 h after surgery once hemostasis is secure.'
      ]
    };
  }

  // ---------- Bridging dose (Table 3.1) ----------
  function bridgingDose({ weight, crcl }, bemiparinTable) {
    if (!(weight > 0) || crcl == null) return null;
    const renal = crcl < 30;
    const enoxMg = Math.round(weight);
    const enox = `Enoxaparin ${enoxMg} mg (${(enoxMg / 100).toFixed(2)} mL of 10 mg/0.1 mL) SC ${renal ? 'once daily (use with caution)' : 'q 12 h'}`;
    const band = bemiparinTable.find(b => weight <= b.maxKg);
    let bemi = renal ? band.renal : band.normal;
    if (band.maxKg === Infinity && !renal) bemi = `${Math.round(weight * 115).toLocaleString('en-US')} IU (115 IU/kg) SC OD`;
    return {
      renal,
      enoxaparin: enox,
      bemiparin: `Bemiparin ${bemi}`,
      note: renal
        ? 'CrCl < 30 mL/min: use renally adjusted LMWH with caution, or UFH (admit before the day of surgery).'
        : 'CrCl ≥ 30 mL/min: LMWH preferred (enoxaparin or bemiparin); use UFH if LMWH unavailable.'
    };
  }

  // ---------- Diabetes ----------
  function dmPlan({ hba1c, urgency, drugs }, defs) {
    const selected = defs.filter(d => drugs && drugs[d.id]);
    const out = { notes: [], drugs: [] };
    if (hba1c == null || hba1c === '') {
      out.notes.push('Enter HbA1c.');
      return out;
    }
    if (hba1c > 8) {
      if (urgency === 'elective') {
        out.notes.push('HbA1c > 8%, elective surgery: internist or consultant to optimize treatment to HbA1c ≤ 8% before surgery, then apply the drug guidance below.');
        out.consult = true;
      } else {
        out.notes.push('HbA1c > 8%, non-elective surgery: use the diabetic protocol (standing order pre-op DM).');
      }
    }
    out.drugs = selected.map(d => ({ name: d.name, rec: d.rec, stop: d.stop }));
    out.notes.push('If NPO before and after surgery, use the diabetic protocol (standing order pre-op DM).');
    return out;
  }

  // ---------- Glucocorticoid (adrenal insufficiency) ----------
  function steroidPlan(grade) {
    switch (grade) {
      case 'g1': return ['Take the usual morning steroid dose, including on the day of surgery before going to the OR.'];
      case 'g2': return [
        'Take the usual daily dose on the morning of surgery.',
        'Hydrocortisone 25–50 mg IV at induction.',
        'Hydrocortisone 25 mg IV q 6 h until eating and hemodynamically stable, then return to the usual dose.'
      ];
      case 'g3': return [
        'Take the usual daily dose on the morning of surgery.',
        'Hydrocortisone 50–100 mg IV at induction.',
        'Hydrocortisone 25–50 mg IV q 6 h until eating and hemodynamically stable, then return to the usual dose.'
      ];
      default: return null;
    }
  }

  const api = {
    LEVELS, addDays, formatDate, dayLabel, cockcroftGault, cardiacRisk, frailtyScore,
    chads2, cha2ds2vasc, afLevel, thromboticRisk, stopWindow, antiplateletPlan,
    doacSchedule, warfarinPlan, bridgingDose, dmPlan, steroidPlan
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PREOP = root.PREOP || {}).rules = api;
})(this);

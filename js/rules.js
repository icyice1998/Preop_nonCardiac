// Decision logic. Pure functions over a flat state object `s` (keys defined in data.js).
// No DOM access, so it runs in Node for unit tests.
(function (root) {
  const LEVELS = ['low', 'moderate', 'high'];
  const any = (s, keys) => keys.some(k => !!s[k]);
  const count = (s, keys) => keys.filter(k => !!s[k]).length;
  const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  // ---------- Dates ----------
  function addDays(iso, n) {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  }
  function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  const dayLabel = n => (n === 0 ? 'D0' : n > 0 ? 'D+' + n : 'D' + n);

  // ---------- Derived values ----------
  function cockcroftGault({ age, weight, scr, sex }) {
    if (!(age > 0 && weight > 0 && scr > 0)) return null;
    const v = ((140 - age) * weight) / (72 * scr);
    return Math.round((sex === 'F' ? v * 0.85 : v) * 10) / 10;
  }
  function bmi(weight, height) {
    if (!(weight > 0 && height > 0)) return null;
    return Math.round((weight / Math.pow(height / 100, 2)) * 10) / 10;
  }
  const FRAILTY = ['fr_slowness', 'fr_lowActivity', 'fr_weakness', 'fr_weightLoss', 'fr_exhaustion'];
  const frailtyScore = s => count(s, FRAILTY);

  function derive(s) {
    const manual = num(s.crclManual);
    const calc = cockcroftGault({ age: s.age, weight: s.weight, scr: s.scr, sex: s.sex });
    const d = {
      crclCalc: calc,
      crcl: manual != null ? manual : calc,
      crclManual: manual != null,
      bmi: bmi(s.weight, s.height),
      frailty: frailtyScore(s),
      dm: s.dmType === 't1' || s.dmType === 't2',
      establishedCVD: any(s, ['ihd', 'priorPci', 'cabg', 'hf', 'cvd', 'pad', 'cardiomyopathy', 'rm_asxVHD', 'ac_symVHD', 'ac_recentMI', 'ac_chf']),
      cvRiskFactors: count(s, ['rf_ht', 'rf_dlp', 'rf_dm', 'rf_smoking', 'rf_fhx']),
      symptoms: any(s, ['sx_chestPain', 'sx_dyspnea', 'sx_edema', 'sx_newMurmur', 'sx_syncope']),
      poorFC: s.fc === 'lt4' || s.fc === 'unknown',
      onDialysis: s.dialysis === 'hd' || s.dialysis === 'pd'
    };
    d.rcri = rcri(s);
    return d;
  }

  // ---------- RCRI ----------
  // Lee 1999 (major cardiac complications) and Duceppe 2017 (30-day death, MI or cardiac arrest)
  const RCRI_LEE = ['0.4%', '0.9%', '6.6%', '11%'];
  const RCRI_DUCEPPE = ['3.9%', '6.0%', '10.1%', '15.0%'];
  function rcri(s) {
    const items = [];
    if (s.site_upperAbd || s.site_intraperitoneal || s.site_thoracic || s.site_aortic || s.site_lungResection) items.push('High-risk surgery (intraperitoneal, intrathoracic, suprainguinal vascular)');
    if (s.ihd || s.ac_recentMI) items.push('Ischemic heart disease');
    if (s.hf || s.ac_chf) items.push('Heart failure');
    if (s.cvd || s.rm_recentStroke) items.push('Cerebrovascular disease');
    if (s.dmInsulin) items.push('Insulin-treated diabetes');
    if (s.scr > 2) items.push('Creatinine > 2 mg/dL');
    const score = items.length;
    const i = Math.min(score, 3);
    return { score, items, lee: RCRI_LEE[i], duceppe: RCRI_DUCEPPE[i], elevated: score >= 2 };
  }

  // ---------- DASI ----------
  function dasi(s, items) {
    const answered = items.filter(i => s[i.k]).length;
    const score = Math.round(items.reduce((t, i) => t + (s[i.k] ? i.w : 0), 0) * 100) / 100;
    const mets = Math.round(((0.43 * score + 9.6) / 3.5) * 10) / 10;
    return { score, mets, poor: score <= 34, answered };
  }

  // ---------- Institutional cardiac pathway (page 1) ----------
  // status: incomplete | proceedNow | proceed | consultMed | consultCardio
  function cardiacRisk(s) {
    const reached = new Set([1]);
    const trail = [];
    const done = (status, title, detail = []) => ({ reached, status, title, detail, trail });

    if (!s.urgency) return done('incomplete', 'Select the urgency of surgery.');
    if (s.urgency === 'emergency') {
      trail.push('Emergency surgery');
      return done('proceedNow', 'Proceed to surgery without delay.', ['No cardiac investigation (echo, CAG) should delay surgery; focus on peri-operative management.']);
    }
    if (s.urgency === 'urgent') {
      trail.push('Urgent surgery');
      if (!s.urgentPrep) return done('incomplete', 'Does the patient have disease requiring preparation before surgery?');
      if (s.urgentPrep === 'no') {
        trail.push('No condition requiring preparation');
        return done('proceedNow', 'Proceed to surgery promptly.', ['No special cardiac investigation is required.']);
      }
      trail.push('Condition requiring preparation present');
    } else {
      trail.push(s.urgency === 'timeSensitive' ? 'Time-sensitive surgery' : 'Elective surgery');
    }

    reached.add(2);
    const active = ['ac_recentMI', 'ac_chf', 'ac_symVHD', 'ac_arrhythmia', 'ac_ecgIschemia'].filter(k => s[k]);
    const rm = ['rm_asxVHD', 'rm_severePH', 'rm_chd', 'rm_recentStroke', 'rm_cied'].filter(k => s[k]);
    const fr = frailtyScore(s);
    if (active.length || rm.length || fr >= 3) {
      const detail = [];
      if (active.length) detail.push('Active cardiac condition: stabilize and defer elective surgery.');
      if (rm.length) detail.push('Risk-modifying disease present.');
      if (fr >= 3) detail.push(`Physical frailty phenotype ${fr}/5.`);
      if (s.urgency === 'timeSensitive') detail.push('Time-sensitive: multidisciplinary decision on individualized testing.');
      trail.push('Active condition or risk-modifying disease present');
      return done(active.length ? 'consultCardio' : 'consultMed', 'Consult Internal Medicine or Cardiology.', detail);
    }
    trail.push('No active condition or risk-modifying disease');

    reached.add(3);
    const rf = ['rf_age65', 'rf_ht', 'rf_dlp', 'rf_dm', 'rf_smoking', 'rf_fhx'].filter(k => s[k]);
    if (!rf.length) {
      trail.push('No clinical risk factor');
      return done('proceed', 'Surgery can proceed.', ['No special cardiac investigation is required.']);
    }
    trail.push(`${rf.length} clinical risk factor(s)`);

    reached.add(4);
    if (!s.surgRisk) return done('incomplete', 'Select the surgical risk category.');
    if (s.surgRisk === 'low') {
      trail.push('Low surgical risk');
      return done('proceed', 'Surgery can proceed.', ['Low surgical risk: no special cardiac investigation is required.']);
    }
    trail.push(s.surgRisk === 'high' ? 'High surgical risk' : 'Intermediate surgical risk');
    if (!s.fc) return done('incomplete', 'Assess functional capacity.');
    if (s.fc === 'gt10' || s.fc === '4to10') {
      trail.push('Functional capacity ≥ 4 METs');
      return done('proceed', 'Surgery can proceed.', ['Functional capacity ≥ 4 METs: no special cardiac investigation is required.']);
    }
    trail.push(s.fc === 'unknown' ? 'Functional capacity unknown' : 'Functional capacity < 4 METs');
    if (!s.lowFcOption) return done('incomplete', 'Poor/unknown functional capacity: choose one of two options.');
    if (s.lowFcOption === 'accept') {
      trail.push('Surgery necessary; patient and family accept the risk');
      return done('proceed', 'Surgery can proceed.', ['Document the risk discussion.']);
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

  // ---------- ESC 2022 / AHA 2024 testing recommendations ----------
  function escTesting(s, d) {
    const recs = [];
    const add = (text, cls) => recs.push({ text, cls });
    const age = num(s.age) || 0;
    const group = d.establishedCVD ? 'cvd' : (age >= 65 || d.cvRiskFactors > 0) ? 'risk' : 'low';
    const r = s.surgRisk;
    const groupLabel = { cvd: 'Established CVD', risk: 'Age ≥ 65 or CV risk factors', low: 'Age < 65 without CV risk factors' }[group];

    if (s.urgency === 'emergency' || s.urgency === 'urgent') {
      add('Emergency/urgent surgery: cardiac testing not feasible; proceed with peri-operative monitoring.', 'I');
    } else if (r) {
      if (r === 'low') add('Low-risk surgery: no routine pre-operative ECG or biomarkers.', '');
      else if (group === 'low') {
        if (r === 'high' && age > 45) add('Consider ECG and biomarkers (hs-cTn, NT-proBNP/BNP).', 'IIa');
        else add('No additional cardiac testing required.', '');
      } else {
        add('12-lead ECG and biomarkers (hs-cTn, NT-proBNP/BNP) before surgery.', 'I');
        add('Assess functional capacity (METs / DASI).', 'IIa');
        if (group === 'cvd' && r === 'high') add('Cardiology consultation; multidisciplinary decision.', 'I');
      }
      if (s.urgency === 'timeSensitive') add('Time-sensitive surgery: individualized testing by multidisciplinary decision.', '');
    }

    if (s.fhxCardiomyopathy) add('Family history of genetic cardiomyopathy: ECG and TTE regardless of age and symptoms.', 'I');
    if (s.sx_newMurmur && (s.sx_dyspnea || s.sx_edema || s.sx_chestPain || s.sx_syncope)) add('New murmur with symptoms or signs of CVD: TTE before surgery.', 'I');
    else if (s.sx_newMurmur && (r === 'intermediate' || r === 'high')) add('New murmur without symptoms: TTE before intermediate/high-risk surgery.', 'IIa');
    if (s.sx_chestPain) add('Chest pain suggestive of CAD: work up as in the non-surgical setting (CCTA or functional testing / ICA).', 'I');
    if (s.sx_dyspnea || s.sx_edema) add('Dyspnea or edema: ECG and NT-proBNP; TTE if NT-proBNP elevated.', 'I');
    if (s.rm_asxVHD || s.ac_symVHD) add('Known VHD: TTE before intermediate/high-risk surgery (if none within 1 year or status changed).', 'I');
    if (s.hf && (r === 'intermediate' || r === 'high')) add('HF: TTE and NT-proBNP if not recently assessed; optimize GDMT (except SGLT2i hold).', 'I');

    if (r === 'high' && s.urgency === 'elective' && d.poorFC) {
      if (s.ihd || d.rcri.score >= 2) add('Poor functional capacity + high likelihood of CAD / high clinical risk: stress imaging before high-risk elective surgery.', 'I');
      else if (s.priorPci || s.cabg) add('Asymptomatic with prior PCI/CABG and poor functional capacity: consider stress imaging.', 'IIa');
    }
    if (r === 'intermediate' && d.poorFC && d.cvRiskFactors > 0 && (s.ihd || s.sx_chestPain)) add('Intermediate-risk surgery, risk factors, poor functional capacity and ischemia concern: stress imaging may be considered.', 'IIb');
    if (s.ihd && !s.ac_recentMI && (r === 'low' || r === 'intermediate')) add('Stable CCS with low/intermediate-risk surgery: routine pre-op coronary angiography NOT recommended.', 'III');
    if (r) add('Routine stress imaging before NCS is not recommended outside the indications above.', 'III');
    if ((r === 'intermediate' || r === 'high') && (group !== 'low' || d.symptoms)) {
      add('Post-operative surveillance: hs-cTn at baseline and 24 h, 48 h after surgery; ΔhsTn > ULN = PMI → ECG, echo, find cause.', 'I');
    }
    return { group, groupLabel, recs };
  }

  // AHA 2024 stepwise (calculated risk + risk modifiers)
  function ahaPathway(s, d) {
    const modifiers = [];
    if (s.vhd_AS || s.vhd_AR || s.vhd_MS || s.vhd_MR || s.ac_symVHD) modifiers.push('Severe valvular heart disease');
    if (s.rm_severePH) modifiers.push('Severe pulmonary hypertension');
    if (s.rm_chd) modifiers.push('Congenital heart disease');
    if (s.priorPci || s.cabg) modifiers.push('Prior coronary stent / CABG');
    if (s.rm_recentStroke) modifiers.push('Recent stroke');
    if (s.rm_cied) modifiers.push('CIED present');
    if (d.frailty >= 3) modifiers.push('Frailty');
    const steps = [];
    if (s.urgency === 'emergency') return { modifiers, path: 'emergency', steps: ['Emergency surgery: proceed.'] };
    if (s.ac_recentMI || s.ac_chf || s.ac_arrhythmia) {
      return { modifiers, path: 'acute', steps: ['ACS, unstable arrhythmia or decompensated HF: manage the acute condition; MDT discussion on deferral, non-invasive treatment or palliation.'] };
    }
    const elevated = d.rcri.elevated;
    let path;
    if (modifiers.length) {
      path = 'modifier';
      steps.push('Risk modifier present: team-based consultation on timing and peri-operative testing.');
      steps.push('12-lead ECG is reasonable with established CVD or symptoms (2a).');
      steps.push('Echocardiography for suspected moderate/severe valve disease, new dyspnea, or new/worsening LV dysfunction (1/2a).');
    } else if (elevated) {
      path = 'elevated';
      steps.push('Elevated calculated risk (RCRI ≥ 2, MACE ≥ 1%): consider ECG if no established CVD (2b).');
    } else {
      path = 'low';
      steps.push('Low calculated risk (RCRI 0–1, MACE < 1%) and no risk modifiers: proceed to surgery.');
      return { modifiers, path, steps, elevated };
    }
    if (d.poorFC) {
      steps.push('Poor/unknown functional capacity (DASI ≤ 34 or < 4 METs): if further testing will change management, measure BNP/NT-proBNP (2a) ± troponin (2b).');
      if (s.biomarker === 'normal') steps.push('Biomarkers normal: proceed to surgery.');
      else steps.push('Abnormal biomarkers: MDT discussion; consider echo, stress testing or CCTA (2b); consider post-op troponin surveillance (2b).');
    } else if (s.fc) steps.push('Functional capacity ≥ 4 METs: proceed to surgery.');
    return { modifiers, path, steps, elevated };
  }

  // ---------- Prior PCI timing (AHA 2024) and DAPT (ESC 2022) ----------
  function pciTiming(s) {
    if (!s.priorPci) return null;
    const m = num(s.pciMonths);
    if (!s.pciType || m == null) return { status: 'incomplete', text: 'Enter PCI type and months since PCI.' };
    const ts = s.urgency === 'timeSensitive';
    const days = m * 30;
    if (s.pciType === 'balloon') return days < 14 ? { status: 'delay', text: 'Balloon angioplasty < 14 days: delay non-cardiac surgery to > 14 days (1).' } : { status: 'ok', text: 'Balloon angioplasty > 14 days: timing acceptable.' };
    if (s.pciType === 'bms') return days < 30 ? { status: 'delay', text: 'BMS < 30 days: delay non-cardiac surgery to > 30 days (1).' } : { status: 'ok', text: 'BMS > 30 days: timing acceptable.' };
    if (m <= 1) return { status: 'harm', text: 'DES ≤ 1 month: do not perform elective/time-sensitive surgery (3: Harm).' };
    if (s.pciIndication === 'acs') {
      if (m >= 12) return { status: 'ok', text: 'DES for ACS ≥ 12 months: timing optimal (1).' };
      if (m >= 3 && ts) return { status: 'ok', text: 'DES for ACS ≥ 3 months and time-sensitive surgery: may proceed (2b).' };
      return { status: 'delay', text: 'DES for ACS < 12 months: delay elective surgery to ≥ 12 months (≥ 3 months if time-sensitive).' };
    }
    if (!s.pciIndication) return { status: 'incomplete', text: 'Select PCI indication (ACS or chronic coronary disease).' };
    if (m >= 6) return { status: 'ok', text: 'DES for CCD ≥ 6 months: timing acceptable (2a).' };
    if (m >= 3 && ts) return { status: 'ok', text: 'DES for CCD ≥ 3 months and time-sensitive surgery: may proceed (2b).' };
    return { status: 'delay', text: 'DES for CCD < 6 months: delay elective surgery to ≥ 6 months (≥ 3 months if time-sensitive).' };
  }

  function daptAdvice(s, defs) {
    const ap = defs.filter(a => s['ap_' + a.id]);
    const onAsa = ap.some(a => a.id === 'aspirin');
    const p2y12 = ap.filter(a => a.p2y12);
    if (!onAsa || !p2y12.length) return null;
    if (s.bleedRisk !== 'high') return { text: 'DAPT and non-high bleeding-risk surgery: continue DAPT (ESC).', cls: '' };
    const m = num(s.pciMonths);
    const highThrombotic = (s.priorPci && m != null && m < 1) || (s.pciIndication === 'acs' && m != null && m < 3);
    if (highThrombotic) {
      return s.urgency === 'timeSensitive'
        ? { text: 'High bleeding risk + high thrombotic risk (PCI < 1 mo or ACS < 3 mo), time-sensitive surgery: bridge with GP IIb/IIIa inhibitor or cangrelor (cardiology).', cls: 'IIb' }
        : { text: 'High bleeding risk + high thrombotic risk (PCI < 1 mo or ACS < 3 mo): defer surgery.', cls: 'I' };
    }
    return { text: `Continue aspirin (I); interrupt ${p2y12.map(p => p.name).join(', ')} (ticagrelor 3–5 d, clopidogrel 5 d, prasugrel 7 d).`, cls: 'I' };
  }

  // ---------- Institutional antiplatelet plan ----------
  function stopWindow(stop, surgeryDate) {
    const [min, max] = stop;
    const text = min === max ? `Stop ${min} days before surgery` : `Stop ${min}–${max} days before surgery`;
    const lastDose = min === max ? dayLabel(-(min + 1)) : `${dayLabel(-(max + 1))} to ${dayLabel(-(min + 1))}`;
    let dates = null;
    if (surgeryDate) {
      dates = min === max
        ? `Last dose ${formatDate(addDays(surgeryDate, -(min + 1)))}`
        : `Last dose between ${formatDate(addDays(surgeryDate, -(max + 1)))} and ${formatDate(addDays(surgeryDate, -(min + 1)))}`;
    }
    return { text, lastDose, dates };
  }

  function antiplateletPlan(s, defs) {
    const selected = defs.filter(d => s['ap_' + d.id]);
    if (!selected.length) return null;
    const pciRecent = s.priorPci && num(s.pciMonths) != null && s.pciMonths < 12;
    const pci = s.priorPci ? (num(s.pciMonths) == null ? null : pciRecent ? 'lt1y' : 'gt1y') : 'none';
    if (pci === null) return { action: 'incomplete', summary: 'Prior PCI: enter months since PCI.', drugs: [] };
    if (pci === 'lt1y') {
      return { action: 'consult', summary: 'PCI < 1 year on antiplatelet: consult Cardiology before any interruption.', drugs: selected.map(d => ({ name: d.name, rec: 'Await cardiology decision; do not stop.' })) };
    }
    if (!s.bleedRisk) return { action: 'incomplete', summary: 'Select the procedural bleeding risk.', drugs: [] };
    if (pci === 'gt1y' && s.bleedRisk !== 'high') {
      return { action: 'continue', summary: 'PCI > 1 year and not high bleeding risk: do not stop antiplatelet.', drugs: selected.map(d => ({ name: d.name, rec: 'Continue.' })) };
    }
    if (s.bleedRisk === 'minimal') {
      return { action: 'continue', summary: 'Minimal bleeding-risk procedure: antiplatelet may be continued.', drugs: selected.map(d => ({ name: d.name, rec: 'Continue.' })) };
    }
    return {
      action: 'stop',
      summary: pci === 'gt1y' ? 'PCI > 1 year and high bleeding risk: stop per schedule.' : 'Stop antiplatelet per schedule (secondary prevention: discuss keeping aspirin when bleeding risk allows).',
      drugs: selected.map(d => {
        if (d.id === 'aspirin' && s.site_closedSpace) {
          return { name: d.name, rec: 'Intracranial / spinal / vitreoretinal surgery: stop aspirin ≥ 7 days before (ESC I; last dose D-8). Restart when hemostasis secure.' };
        }
        const w = stopWindow(d.stop, s.surgeryDate);
        return { name: d.name, rec: `${w.text} (last dose ${w.lastDose}). Restart 24 h (minor) to 24–48 h (major) after surgery when hemostasis secure.`, dates: w.dates };
      })
    };
  }

  // ---------- Stroke scores and thrombotic risk ----------
  function chads2(items, age) {
    return (items.chf ? 1 : 0) + (items.ht ? 1 : 0) + (age >= 75 ? 1 : 0) + (items.dm ? 1 : 0) + (items.stroke ? 2 : 0);
  }
  function cha2ds2vasc(items, age, sex) {
    return (items.chf ? 1 : 0) + (items.ht ? 1 : 0) + (age >= 75 ? 2 : age >= 65 ? 1 : 0) + (items.dm ? 1 : 0) +
      (items.stroke ? 2 : 0) + (items.vascular ? 1 : 0) + (sex === 'F' ? 1 : 0);
  }
  function afLevel(chads, vasc) {
    if (chads >= 5 || vasc >= 7) return 'high';
    if (chads >= 3 || vasc >= 4) return 'moderate';
    return 'low';
  }
  function thromboticRisk(s, defs, af) {
    let max = -1;
    const reasons = [];
    for (const group of Object.values(defs)) {
      for (const item of group.items) {
        if (s['tr_' + item.id]) {
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

  // ---------- DOAC / warfarin (institutional Tables 3.1–3.2) ----------
  function doacSchedule({ drug, crcl, bleeding }) {
    if (!drug || !bleeding) return null;
    const notes = [];
    if (bleeding === 'minimal') return { lastDose: -1, resume: 1, hold: [0], notes: ['Hold only on the day of surgery; restart after surgery once hemostasis is secure.'] };
    if (crcl == null) return { incomplete: true, notes: ['Enter creatinine (or CrCl) to calculate the DOAC schedule.'] };
    const high = bleeding === 'high';
    let lastDose, resume;
    if (drug === 'dabigatran') {
      if (crcl >= 50) { lastDose = high ? -3 : -2; resume = high ? 3 : 1; }
      else { lastDose = high ? -5 : -3; resume = high ? 3 : 1; notes.push('CrCl < 50 mL/min on dabigatran: consult Hematology.'); }
    } else if (crcl >= 30) {
      lastDose = high ? -3 : -2; resume = high ? 2 : 1;
      if (high) notes.push('High bleeding risk: resumption may be delayed one more day.');
    } else {
      lastDose = high ? -4 : -3; resume = high ? 3 : 1;
      notes.push('CrCl < 30 mL/min: consult Hematology.');
    }
    const hold = [];
    for (let d = lastDose + 1; d < resume; d++) hold.push(d);
    notes.push(`ESC 2022 last-dose interval: ${escDoacHours(drug, crcl, high)}.`);
    notes.push('No heparin bridging for DOAC (bridging harmful, AHA 3). Restart only when hemostasis is secure.');
    return { lastDose, resume, hold, notes };
  }

  // ESC 2022: hours from last DOAC dose to surgery by renal function
  function escDoacHours(drug, crcl, high) {
    if (crcl < 15) return 'no formal indication for DOAC at CrCl < 15';
    if (drug === 'dabigatran') {
      if (crcl < 30) return 'dabigatran not indicated at CrCl 15–29';
      if (crcl < 50) return high ? '≥ 96 h' : '≥ 48 h';
      if (crcl < 80) return high ? '≥ 72 h' : '≥ 36 h';
      return high ? '≥ 48 h' : '≥ 24 h';
    }
    if (high) return '≥ 48 h';
    return crcl < 30 ? '≥ 36 h' : '≥ 24 h';
  }

  function reversalNotes(s) {
    if (s.urgency !== 'emergency' && s.urgency !== 'urgent') return [];
    if (s.anticoag === 'warfarin') return ['Emergency/urgent on warfarin: check INR; vitamin K IV + 4F-PCC (FFP if PCC unavailable) to INR < 1.5.'];
    if (!s.anticoag || s.anticoag === 'none') return [];
    const agent = s.anticoag === 'dabigatran' ? 'idarucizumab (or 4F-PCC)' : 'andexanet alfa or 4F-PCC';
    return [
      'Emergency/urgent on DOAC: check PT, aPTT, anti-Xa / dTT (or drug level) and time of last dose.',
      'Last intake > 12 h (normal renal function): proceed. Urgent: defer ≥ 12 h if safe or until coagulation normalizes.',
      `Immediate surgery with recent intake and high bleeding risk: reverse with ${agent}; recheck coagulation.`
    ];
  }

  function warfarinPlan({ bleeding, thrombotic }) {
    if (!bleeding) return { status: 'incomplete', notes: ['Select the procedural bleeding risk.'] };
    if (bleeding === 'minimal') return { status: 'continue', notes: ['Minimal bleeding risk: do not stop warfarin.'] };
    if (!thrombotic) return { status: 'incomplete', notes: ['Assess peri-operative thrombotic risk.'] };
    if (thrombotic === 'high') {
      return {
        status: 'bridge', warfarinLast: -6, warfarinResume: 3, heparinDays: [-3, -2, -1], heparinResume: 3,
        notes: [
          'Stop warfarin 5 days before surgery (last dose D-6); check INR on D-1 (target < 1.5).',
          'Start therapeutic heparin on D-3 once INR is below therapeutic range.',
          'LMWH last dose ~24 h pre-op: BID regimen gives only the morning dose on D-1; OD regimen gives half the daily dose on the morning of D-1.',
          'UFH: IV infusion, stop 4–6 h before surgery (admit before surgery).',
          'Restart warfarin with heparin 48–72 h post-op when hemostasis secure; stop heparin once INR therapeutic.'
        ]
      };
    }
    return {
      status: 'stop', warfarinLast: -6, warfarinResume: 1,
      notes: [`${thrombotic === 'moderate' ? 'Moderate' : 'Low'} thrombotic risk: stop warfarin 5 days before surgery (last dose D-6); no bridging.`, 'Check INR on the day of surgery (target < 1.5).', 'Restart warfarin within 24 h after surgery (evening of surgery or next day) when hemostasis secure.']
    };
  }

  function bridgingDose({ weight, crcl }, bemiparinTable) {
    if (!(weight > 0) || crcl == null) return null;
    const renal = crcl < 30;
    const mg = Math.round(weight);
    const band = bemiparinTable.find(b => weight <= b.maxKg);
    let bemi = renal ? band.renal : band.normal;
    if (band.maxKg === Infinity && !renal) bemi = `${Math.round(weight * 115).toLocaleString('en-US')} IU (115 IU/kg) SC OD`;
    return {
      renal,
      enoxaparin: `Enoxaparin ${mg} mg (${(mg / 100).toFixed(2)} mL of 10 mg/0.1 mL) SC ${renal ? 'once daily (use with caution)' : 'q 12 h'}`,
      bemiparin: `Bemiparin ${bemi}`,
      note: renal ? 'CrCl < 30: renally adjusted LMWH with caution, or UFH (admit before surgery).' : 'CrCl ≥ 30: LMWH preferred; UFH if LMWH unavailable.'
    };
  }

  function neuraxialNotes(s) {
    if (s.anesthesia !== 'neuraxial') return [];
    const out = [];
    if (s.anticoag === 'warfarin') out.push('Neuraxial: warfarin contraindicated with catheter in place; ensure INR < 1.5 before puncture/removal.');
    if (s.anticoag && s.anticoag !== 'none' && s.anticoag !== 'warfarin') out.push('Neuraxial: DOAC off ≥ 5 half-lives (≥ 72 h for most); consider drug level if interval < 72 h.');
    if (s.ap_clopidogrel || s.ap_prasugrel) out.push('Neuraxial: stop clopidogrel / prasugrel 7–10 days before.');
    if (s.ap_ticagrelor) out.push('Neuraxial: stop ticagrelor 5–7 days before.');
    if (s.anticoag && s.anticoag !== 'none') out.push('Therapeutic LMWH ≥ 24 h before puncture; IV UFH ≥ 6 h with normal aPTT; re-dose ≥ 4 h after catheter removal.');
    return out;
  }

  // ---------- Pulmonary ----------
  function ppcRisk(s, d) {
    const patient = [];
    const op = [];
    const age = num(s.age);
    if (age != null && age > 60) patient.push(`Age > 60 (${age} y)`);
    if (s.asa && +s.asa >= 2) patient.push(`ASA ${['', 'I', 'II', 'III', 'IV', 'V'][+s.asa]}`);
    if (s.copd) patient.push('COPD');
    if (s.asthma && s.asthmaStatus === 'uncontrolled') patient.push('Uncontrolled asthma');
    if (s.hf || s.ac_chf) patient.push('Heart failure');
    if (s.dependence) patient.push('Functional dependence');
    if (s.smokeStatus === 'current') patient.push('Current smoker / quit ≤ 8 weeks');
    if (s.sensorium) patient.push('Impaired sensorium');
    if (s.osa || s.osaSuspected) patient.push('Obstructive sleep apnea');
    if (s.pulmHT || s.rm_severePH) patient.push('Pulmonary hypertension');
    if (s.unexplainedDyspnea) patient.push('Unexplained dyspnea');
    if (s.abnChestExam) patient.push('Abnormal chest examination');
    if (num(s.albumin) != null && s.albumin < 3.5) patient.push(`Albumin < 3.5 g/dL (${s.albumin})`);
    if (num(s.hb) != null && s.hb < 10) patient.push(`Hb < 10 g/dL (${s.hb})`);
    if (num(s.spo2) != null && s.spo2 <= 95) patient.push(`SpO₂ ≤ 95% (${s.spo2}%)`);
    if (num(s.bun) != null && s.bun > 30) patient.push(`BUN > 30 mg/dL (${s.bun})`);
    if (d.bmi != null && d.bmi >= 30) patient.push(`Obesity (BMI ${d.bmi})`);

    if (s.site_upperAbd) op.push('Upper abdominal surgery');
    if (s.site_thoracic || s.site_lungResection) op.push('Thoracic surgery');
    if (s.site_aortic) op.push('Aortic / major vascular surgery');
    if (s.site_neuro) op.push('Neurosurgery');
    if (s.site_headNeck) op.push('Head and neck surgery');
    if (s.urgency === 'emergency' || s.urgency === 'urgent') op.push('Emergency / urgent surgery');
    if (s.longDuration) op.push('Duration > 3 hours');
    if (s.anesthesia === 'ga') op.push('General anesthesia');

    const total = patient.length + op.length;
    let level, why;
    if (!total) { level = 'low'; why = 'No risk factor: proceed without further pulmonary evaluation'; }
    else if (s.cxrPft === 'abnormal' || total >= 2) { level = 'high'; why = s.cxrPft === 'abnormal' ? 'Abnormal CXR/PFT' : `${total} risk factors (multiple)`; }
    else { level = 'moderate'; why = 'Single risk factor with normal or pending tests'; }

    const consult = [];
    if (s.unexplainedDyspnea || s.chronicCough || s.cxrPft === 'abnormal') consult.push('Unexplained respiratory symptoms or abnormal CXR/PFT');
    if (s.copdStatus === 'uncontrolled' || s.asthmaStatus === 'uncontrolled') consult.push('Poorly controlled asthma/COPD');
    if (s.osaSuspected) consult.push('Suspected severe OSA / hypoventilation (PAP evaluation)');
    if (s.site_lungResection) consult.push('Lung resection candidate (ppoFEV1 / ppoDLCO assessment)');

    const pft = [];
    if (s.site_lungResection) pft.push('Spirometry + DLCO: required for all lung resection candidates.');
    if (s.unexplainedDyspnea) pft.push('Spirometry for unexplained respiratory symptoms.');
    if (s.copdStatus === 'uncontrolled' || s.asthmaStatus === 'uncontrolled') pft.push('Spirometry with reversibility to optimize bronchodilator therapy.');
    if (s.copd && s.copdStatus === 'controlled' && !pft.length) pft.push('Well-controlled COPD/asthma: routine PFT not indicated.');

    const recs = [];
    if (level === 'high') recs.push('Reconsider indication / consider shorter or laparoscopic procedure; prefer neuraxial or regional anesthesia when feasible.');
    if (s.smokeStatus === 'current') recs.push('Smoking cessation now (ideal ≥ 4–8 weeks); nicotine replacement is safe peri-operatively.');
    if (s.copd) {
      if (s.copdStatus === 'uncontrolled') {
        recs.push(s.urgency === 'elective'
          ? 'Uncontrolled COPD, elective: anesthesia evaluation, pre-op pulmonary rehabilitation, evaluate right heart / pulmonary hypertension, optimize bronchodilators (± steroid / antibiotic for exacerbation); delay if needed.'
          : 'Uncontrolled COPD, non-elective: proceed with post-op ICU monitoring, supplemental O₂, careful analgesics/sedatives, NIPPV trial if needed.');
      } else recs.push('Controlled COPD: continue maintenance inhalers including the day of surgery.');
    }
    if (s.asthma) {
      if (s.asthmaStatus === 'uncontrolled') {
        recs.push('Uncontrolled asthma: step up ICS/LABA; postpone elective surgery until controlled; full bronchodilator 2 days pre-op; consider systemic steroid bridge (e.g. methylprednisolone 40 mg/day PO for 3–5 days pre-op).');
      } else recs.push('Controlled asthma: continue controller; give SABA/long-acting bronchodilator before the OR.');
    }
    if (s.uri) recs.push('Active respiratory infection: postpone elective surgery (≈ 6 weeks) and treat.');
    if (s.osa || s.osaSuspected) recs.push('OSA: bring home CPAP; post-op CPAP, minimize opioids/sedatives, monitored bed.');
    if (d.bmi != null && d.bmi >= 30) recs.push('Obesity: prehabilitation 5–7 days (breathing exercise, IMT, incentive spirometry, light aerobic activity).');
    if (s.chronicSteroid) recs.push('Long-term prednisone: evaluate adrenal insufficiency risk / stress-dose steroid.');
    if (level !== 'low') {
      recs.push('Pre-op teaching: lung-expansion maneuvers (deep breathing, incentive spirometry 10×/h while awake), huff cough with wound splinting; IMT ≥ 2 weeks when time allows.');
      recs.push('Intra-op: lung-protective ventilation (6–8 mL/kg IBW, PEEP, recruitment), goal-directed fluids, avoid long-acting NMBA (pancuronium), ensure full reversal.');
      recs.push('Post-op I COUGH: incentive spirometry, coughing/deep breathing, oral care (chlorhexidine BID), understanding, getting out of bed ≥ 3×/day, head-of-bed elevation; adequate analgesia (epidural > PCA).');
    }
    return { patient, op, total, level, why, consult, pft, recs };
  }

  // Predicted post-operative lung function
  function ppoLung({ fev1, dlco, resected, obstructed, perfusion }) {
    const total = 19;
    let factor = null, method = null;
    if (num(perfusion) != null) { factor = 1 - perfusion / 100; method = `perfusion scan (${perfusion}% removed)`; }
    else if (num(resected) != null) {
      const obs = num(obstructed) || 0;
      if (total - obs <= 0) return null;
      factor = 1 - (resected - obs) / (total - obs);
      method = `segment count (${resected} resected, ${obs} obstructed of ${total})`;
    }
    if (factor == null) return null;
    const pf = num(fev1) != null ? Math.round(fev1 * factor * 10) / 10 : null;
    const pd = num(dlco) != null ? Math.round(dlco * factor * 10) / 10 : null;
    const vals = [pf, pd].filter(v => v != null);
    if (!vals.length) return null;
    const min = Math.min(...vals);
    let risk, next;
    if (min >= 60) { risk = 'low'; next = 'ppoFEV1 and ppoDLCO ≥ 60%: low risk; proceed.'; }
    else if (min >= 30) { risk = 'moderate'; next = 'ppo 30–60%: low-technology exercise test (stair climb / shuttle walk); CPET if poor.'; }
    else { risk = 'high'; next = 'ppo < 30%: CPET required (VO₂max < 10 mL/kg/min or < 35% predicted = contraindication to resection; consider SBRT).'; }
    return { factor: Math.round(factor * 1000) / 1000, method, ppoFev1: pf, ppoDlco: pd, risk, next };
  }

  // ---------- Kidney ----------
  function renalPlan(s, d) {
    const recs = [], labs = [];
    const ckdAdv = s.ckdStage === 'g4' || s.ckdStage === 'g5';
    const anyKidney = d.onDialysis || (s.ckdStage && s.ckdStage !== 'none') || s.aki || (d.crcl != null && d.crcl < 60);
    if (!anyKidney && !s.contrastPlanned && !s.gadoliniumPlanned) return { applicable: false, recs, labs };
    if (anyKidney) {
      recs.push('Inform patient and family of increased peri-operative complication and mortality risk.');
      labs.push('CBC, PT/aPTT, BUN/Cr, electrolytes, Ca/P/Mg, albumin');
      recs.push('Avoid nephrotoxins; review renally cleared drug doses (CrCl ' + (d.crcl != null ? d.crcl + ' mL/min' : 'not available') + ').');
      if (s.nephrotoxins || s.drug_nsaid) recs.push('Stop NSAIDs and other nephrotoxins before surgery where possible.');
    }
    if (d.onDialysis) {
      recs.push('BP goal: pre-dialysis < 140/90, post-dialysis < 130/80 mmHg; ACE-I/ARB by indication and BP, diuretics by volume status, continue beta-blocker.');
      if (d.poorFC) recs.push('Dialysis with < 4 METs or unknown functional capacity: cardiology consultation.');
      recs.push('Hb target 10–11.5 g/dL with ESA; transfusion to Hb ≈ 10 g/dL reduces uremic bleeding.');
      recs.push('Protect vascular access: no BP cuff, IV line or venipuncture on the access arm.');
      if (s.dialysis === 'hd') recs.push('Hemodialysis on the day before surgery without heparin; check K post-dialysis.');
      if (s.dialysis === 'pd') {
        recs.push(s.site_openGI
          ? 'PD with surgery opening the GI tract / delayed closure / mesh: pre-emptive switch to temporary HD (coordinate with nephrology).'
          : 'PD: consider intensified exchanges pre-op; drain abdomen before surgery; avoid ileus/constipation.');
      }
      recs.push('Post-op: monitor volume, K, BUN/Cr; continue routine dialysis schedule; analgesia with fentanyl or hydromorphone (avoid pethidine, morphine).');
    }
    if (d.onDialysis || ckdAdv || (s.aki && s.oliguria)) {
      const w = num(s.weight);
      recs.push(`Uremic bleeding prophylaxis (if bleeding risk): desmopressin 0.3 mcg/kg${w ? ` (= ${Math.round(w * 0.3 * 10) / 10} mcg)` : ''} IV in NSS 50 mL over 15–30 min, 30–60 min before procedure; may repeat after 12 h (max 2–3 days).`);
    }
    if (anyKidney) {
      recs.push('AKI prevention (ADQI): consider holding ACE-I/ARB ≥ 24 h pre-op; MAP > 65 mmHg intra-op; avoid restrictive/zero-balance fluids in major surgery; balanced crystalloids over 0.9% saline; goal-directed therapy in high-risk patients.');
      recs.push('Post-op: euvolemia, glucose < 180 mg/dL, restart ACE-I/ARB within 48 h if stable without AKI; monitor Cr and urine output.');
    }
    if (s.contrastPlanned) {
      const egfrLow = (d.crcl != null && d.crcl < 30) || ckdAdv || s.aki;
      recs.push(`Contrast AKI risk factors: ${['age > 60', 'eGFR < 30 / AKI', 'DM', 'HT', 'CVD', 'volume depletion', 'nephrotoxins'].join(', ')}${egfrLow ? ' — HIGH RISK (eGFR < 30 or AKI)' : ''}.`);
      recs.push('Prevention: isotonic saline or bicarbonate from 1 h before to 3–12 h after; low- or iso-osmolar contrast; hold NSAIDs, metformin, diuretics; avoid repeat contrast within 24 h.');
      const w = num(s.weight), cr = num(s.scr);
      if (w && cr) recs.push(`Maximum contrast dose ≈ 5 mL/kg ÷ SCr = ${Math.min(300, Math.round((5 * w) / cr))} mL (cap 300 mL).`);
    }
    if (s.gadoliniumPlanned && (ckdAdv || d.onDialysis || s.aki)) {
      recs.push('Gadolinium with CKD G4–5 / dialysis / AKI (NSF risk): prefer alternative imaging; if needed use a group II agent and perform just before scheduled HD.');
    }
    return { applicable: true, recs, labs };
  }

  // ---------- Diabetes ----------
  function dmPlan(s, d, defs) {
    if (!d.dm) return null;
    const pre = [], drugs = [], intra = [], post = [];
    const a1c = num(s.hba1c), fpg = num(s.fpg);
    pre.push('Peri-operative glucose target 100–180 mg/dL before, during and after surgery.');
    if (s.dmType === 't1' || s.dmInsulin) pre.push('Insulin deficiency / DKA risk: never omit basal insulin.');
    if (s.gastroparesis) pre.push('Autonomic neuropathy / gastroparesis: aspiration precautions; watch urinary retention.');
    let optimize = false;
    if ((a1c != null && a1c > 8) || (fpg != null && fpg > 250)) {
      if (s.urgency === 'elective') { optimize = true; pre.push(`A1C ${a1c ?? '–'}% / FPG ${fpg ?? '–'} mg/dL above target (A1C < 8%, FPG ≤ 250): optimize first ± defer elective surgery.`); }
      else if (s.urgency === 'timeSensitive') pre.push('Above target but time-sensitive: proceed; start appropriate treatment; do not delay solely for A1C.');
      else pre.push('Above target, emergency/urgent: proceed with IV insulin protocol.');
    } else if (a1c == null) pre.push('Check HbA1c (within 3 months) for elective surgery.');

    for (const def of defs) {
      if (!s['dm_' + def.id]) continue;
      if (def.options) {
        const o = def.options.find(x => x.id === s['dmopt_' + def.id]);
        const raw = o ? o.rec : 'Select the GLP-1 RA plan (aspiration risk vs glycemic need).';
        drugs.push({ name: def.name, rec: o ? `${o.label}: ${o.rec}` : raw, raw, stop: o && o.stop });
      } else drugs.push({ name: def.name, rec: def.rec, raw: def.rec, stop: def.stop });
    }
    if (s.dm_sglt2 && s.urgency !== 'elective') {
      const t = 'Missed hold / non-elective: check ketones and anion gap; hydrate; insulin + dextrose plan; euglycemic DKA → IV fluid + insulin + dextrose.';
      drugs.push({ name: 'SGLT2i not held', rec: t, raw: t });
    }

    const ins = insulinPlan(s);
    const majorOrLong = s.surgRisk === 'high' || s.surgRisk === 'intermediate' || s.longDuration;
    const uncontrolled = (a1c != null && a1c >= 8) || optimize;
    const ivReasons = [];
    if (majorOrLong) ivReasons.push('major surgery or > 2–4 h');
    if (s.fluidShift) ivReasons.push('hemodynamic / large fluid shifts');
    if (uncontrolled) ivReasons.push('uncontrolled diabetes');
    if (s.labileT1) ivReasons.push('labile T1D');
    if (s.urgency === 'emergency' || s.urgency === 'urgent') ivReasons.push('emergency/urgent');
    const route = ivReasons.length ? 'iv' : (s.eatingSoon ? 'sc' : 'sc?');
    if (route === 'iv') {
      intra.push(`IV insulin infusion favored (${ivReasons.join(', ')}).`);
      intra.push('RI 100 U in NSS 100 mL (1 U/mL) by pump on a separate line; check K before starting; CBG q 1 h; titrate to 100–180 mg/dL by local protocol.');
      intra.push('Dextrose 5–10 g/h if NPO > 12 h or ≥ 2 meals skipped, or on insulin infusion (D5W/D5NSS 100 mL/h = 5 g/h).');
    } else {
      intra.push(`SC correctional insulin${route === 'sc?' ? ' (confirm food intake soon after surgery)' : ''}: CBG q 2–4 h; if > 140 mg/dL give correction: 141–180 → 2 U, 181–220 → 3 U, 221–260 → 4 U, 261–300 → 6 U (individualize); rapid analog q 2–4 h, RI q 4–6 h.`);
    }
    post.push('Not eating / unstable: continue IV insulin + dextrose; CBG target 100–180.');
    post.push('Eating / stable: SC basal ± prandial + correction; restart non-insulin agents selectively when eating and renal function stable.');
    post.push('IV → SC transition: overlap SC dose before stopping infusion (rapid-acting 30 min, regular 1 h, intermediate/long-acting 2–4 h).');
    post.push('NPO peri-operatively: institutional diabetic protocol (standing order pre-op DM).');
    return { pre, drugs, insulin: ins, intra, post, optimize, route };
  }

  function insulinPlan(s) {
    const low = s.insHypoRisk;
    const evePct = low ? [0.5, 0.75] : [0.75, 0.8];
    const fmt = (dose, [a, b]) => {
      const lo = Math.round(dose * a), hi = Math.round(dose * b);
      return lo === hi ? `${lo} U` : `${lo}–${hi} U`;
    };
    const cbgLow = num(s.amCbg) != null && s.amCbg < 120;
    const out = [];
    if (num(s.insNphPm)) out.push(`NPH evening before: ${fmt(s.insNphPm, evePct)} (usual ${s.insNphPm} U).`);
    if (num(s.insNphAm)) out.push(cbgLow ? `NPH morning of surgery: consider holding (AM CBG ${s.amCbg} < 120).` : `NPH morning of surgery: ${fmt(s.insNphAm, [0.5, 0.5])} (50% of ${s.insNphAm} U).`);
    if (num(s.insLong)) out.push(`Long-acting basal (evening before and/or morning of): ${fmt(s.insLong, evePct)} (usual ${s.insLong} U).`);
    if (num(s.insPremixPm)) out.push(`Premixed evening before: ${fmt(s.insPremixPm, evePct)} (usual ${s.insPremixPm} U).`);
    if (num(s.insPremixAm)) out.push(cbgLow ? `Premixed morning of surgery: consider holding (AM CBG ${s.amCbg} < 120).` : `Premixed morning of surgery: ${fmt(s.insPremixAm, [0.5, 0.5])} (50% of ${s.insPremixAm} U).`);
    if (s.insPrandial) out.push('Prandial insulin: usual dose the evening before if eating; hold on the morning of surgery while NPO.');
    if (out.length && low) out.unshift('High hypoglycemia risk / malnutrition / renal or hepatic impairment: using 50–75% of usual basal dose.');
    return out;
  }

  // ---------- Glucocorticoid ----------
  function steroidPlan(grade) {
    switch (grade) {
      case 'g1': return ['Usual morning steroid dose on the day of surgery; no supplementation.'];
      case 'g2': return ['Usual daily dose on the morning of surgery.', 'Hydrocortisone 25–50 mg IV at induction.', 'Hydrocortisone 25 mg IV q 6 h until eating and hemodynamically stable, then usual dose.'];
      case 'g3': return ['Usual daily dose on the morning of surgery.', 'Hydrocortisone 50–100 mg IV at induction.', 'Hydrocortisone 25–50 mg IV q 6 h until eating and hemodynamically stable, then usual dose.'];
      default: return null;
    }
  }

  // ---------- Cardiac comorbidity specifics ----------
  function cardiacSpecifics(s, d) {
    const out = [];
    const elevated = s.surgRisk === 'intermediate' || s.surgRisk === 'high';
    const planned = s.urgency === 'elective' || s.urgency === 'timeSensitive';
    const lvef = num(s.lvef);
    // Aortic stenosis (AHA 2024 / ESC 2022)
    if (s.vhd_AS || s.vhd_ASasx) {
      out.push('Severe AS: MDT (cardiology, anesthesia, surgery); TTE if not within 1 year (I).');
      const needsAvr = s.vhd_AS || (s.vhd_ASasx && lvef != null && lvef < 50);
      if (needsAvr && planned && elevated) {
        out.push(s.avrCandidate === 'no'
          ? 'Not an AVR candidate: consider BAV, minimally invasive alternative, palliation, or proceed after shared decision with strict monitoring (IIb).'
          : 'Symptomatic severe AS (or LVEF < 50%) before elevated-risk surgery: evaluate for AVR (TAVI/SAVR) first (I).');
      } else if (s.vhd_ASasx && (lvef == null || lvef >= 50)) {
        out.push(s.surgRisk === 'low'
          ? 'Asymptomatic severe AS, LVEF ≥ 50%, low-risk surgery: reasonable to proceed (2a).'
          : 'Asymptomatic severe AS, LVEF ≥ 50%, elevated-risk surgery: AVR first if surgery can be delayed; otherwise team decision.');
      }
    }
    if (s.vhd_MS) {
      out.push('Severe MS: evaluate for mitral intervention (PMC or surgery) before elective surgery (I).');
      out.push('If MS cannot be treated first: invasive hemodynamic monitoring (2a); heart-rate control with beta-blocker, CCB, ivabradine or digoxin (2b).');
    }
    if (s.vhd_AR) out.push('Severe AR (symptomatic or LVESD > 50 mm / LVEF ≤ 50%): valve surgery before elective intermediate/high-risk surgery.');
    if (s.vhd_MR) out.push('Severe primary MR (symptomatic or LV dysfunction): repair/TEER before intermediate/high-risk surgery (IIa); otherwise strict monitoring.');
    if (s.vhd_regurgAsx) out.push('Asymptomatic moderate–severe MR/AR with normal LV function (and PASP < 50): reasonable to proceed with elective surgery (2a).');
    // CIED (AHA 2024)
    if (s.rm_cied) {
      out.push('CIED: interrogate before surgery; bipolar cautery, short bursts < 5 s, > 15 cm from generator; have a magnet available.');
      if (!s.emiAbove) out.push('EMI below the umbilicus: no reprogramming or magnet needed (1).');
      else if (s.ciedType === 'icd') out.push(s.ciedDependent ? 'ICD, pacemaker-dependent, EMI above umbilicus: reprogram to asynchronous mode and disable ICD therapy (1); external defibrillator ready.' : 'ICD, not dependent, EMI above umbilicus: magnet or reprogram to disable tachytherapies (1); external defibrillator ready.');
      else out.push(s.ciedDependent ? 'Pacemaker-dependent, EMI above umbilicus: magnet or reprogram to asynchronous mode (1).' : 'Pacemaker, not dependent: no reprogramming needed; consider disabling rate response (1).');
    }
    if (s.hf) out.push(`HF${lvef != null ? ` (LVEF ${lvef}%)` : ''}: continue GDMT except SGLT2i (hold 3–4 days); decompensated HF → defer elective surgery. 90-day mortality rises as LVEF falls (≈ 8% if < 30%).`);
    if (s.rf_ht) out.push('Hypertension: do not defer surgery for stage 1–2 HT (ESC III); avoid large BP swings, especially hypotension (I); new HT before high-risk elective surgery → screen organ damage (I).');
    if (s.pulmHT || s.rm_severePH) out.push('Pulmonary hypertension: continue PAH therapy (I); severe PAH → hemodynamic monitoring ≥ 24 h post-op (I); right HF → optimize diuretic ± IV prostacyclin with PAH expert (I); inodilators per hemodynamics (IIa).');
    if (s.ieHighRisk && s.site_dental) out.push('IE prophylaxis indicated (high-risk patient + oro-dental procedure): single dose 30–60 min before.');
    return out;
  }

  // Pharmacological risk reduction for drugs the patient is NOT yet taking
  function pharmacoInitiation(s, d) {
    const out = [];
    const ascvd = s.ihd || s.cvd || s.pad || s.priorPci || s.cabg;
    if (!s.drug_statin && (ascvd || (d.dm && (num(s.age) || 0) >= 40))) out.push({ text: 'Statin-naive with indication (ASCVD or diabetes ≥ 40 y): start statin peri-operatively for long-term use.', cls: 'I' });
    if (!s.drug_bb) {
      if (s.surgRisk === 'high' && d.cvRiskFactors + (num(s.age) >= 65 ? 1 : 0) >= 2) out.push({ text: 'Beta-blocker may be started well in advance (optimally > 7 days, titrate) of high-risk surgery with ≥ 2 clinical risk factors.', cls: 'IIb' });
      else if (s.ihd) out.push({ text: 'Known CAD/ischemia: beta-blocker may be started in advance (> 7 days) if a new indication exists.', cls: 'IIb' });
      out.push({ text: 'Never start a beta-blocker on the day of surgery; routine peri-operative initiation is not recommended.', cls: 'III' });
    }
    if (d.dm && num(s.hba1c) == null) out.push({ text: 'Check HbA1c if not done within 3 months before elective surgery.', cls: 'IIa' });
    return out;
  }

  // Short action tag for a medication recommendation
  function actionTag(rec) {
    if (/consult/i.test(rec) && !/continue/i.test(rec.slice(0, 12))) return 'CONSULT';
    if (/^(stop|taper|hold [≥\d])|stop [\d≥]|hold ≥|hold 7 days|interrupt/i.test(rec)) return 'STOP';
    if (/hold on the (morning|day)/i.test(rec)) return 'HOLD D0';
    if (/continue|may continue/i.test(rec)) return 'CONTINUE';
    if (/select/i.test(rec)) return 'CHOOSE';
    return 'REVIEW';
  }

  // ---------- Completeness (mandatory items) ----------
  function missing(s, d, ctx) {
    const m = [];
    if (!s.age) m.push('Patient age');
    if (!s.sex) m.push('Patient sex');
    if (!s.urgency) m.push('Surgical urgency');
    if (!s.surgRisk) m.push('Surgical risk category');
    if (!s.bleedRisk) m.push('Procedural bleeding risk');
    if (!s.anesthesia) m.push('Anesthesia type');
    if (!s.asa) m.push('ASA class');
    if (!s.smokeStatus) m.push('Smoking status');
    if (!s.dmType) m.push('Diabetes status');
    if (!s.ckdStage && !s.dialysis) m.push('Kidney status');
    if (!s.scr) m.push('Serum creatinine');
    if (ctx.cardiacStatus === 'incomplete') m.push('Cardiac pathway (functional capacity / biomarker)');
    if (!s.noMeds && !ctx.anyMed) m.push('Medication review (tick drugs or "no regular medication")');
    if (s.anticoag === 'warfarin' && !ctx.thromboticLevel) m.push('Thrombotic risk (warfarin)');
    if (d.dm && s.hba1c == null) m.push('HbA1c');
    if ((s.adrenalInsufficiency || s.chronicSteroid) && !s.stressGrade) m.push('Surgical stress grade (steroid)');
    return m;
  }

  const api = {
    LEVELS, addDays, formatDate, dayLabel, cockcroftGault, bmi, frailtyScore, derive, rcri, dasi,
    cardiacRisk, escTesting, ahaPathway, pciTiming, daptAdvice, stopWindow, antiplateletPlan,
    chads2, cha2ds2vasc, afLevel, thromboticRisk, doacSchedule, escDoacHours, reversalNotes, warfarinPlan, bridgingDose, neuraxialNotes,
    pharmacoInitiation, actionTag,
    ppcRisk, ppoLung, renalPlan, dmPlan, insulinPlan, steroidPlan, cardiacSpecifics, missing
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.PREOP = root.PREOP || {}).rules = api;
})(this);

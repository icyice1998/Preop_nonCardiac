const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/rules.js');
const D = require('../js/data.js');

test('dates and Cockcroft-Gault', () => {
  assert.equal(R.addDays('2025-01-02', -5), '2024-12-28');
  assert.equal(R.cockcroftGault({ age: 70, weight: 60, scr: 1, sex: 'M' }), 58.3);
  assert.equal(R.cockcroftGault({ age: 70, weight: 60, scr: 1, sex: 'F' }), 49.6);
  assert.equal(R.bmi(58, 155), 24.1);
});

test('RCRI counts the six predictors', () => {
  const r = R.rcri({ site_upperAbd: true, ihd: true, hf: true, cvd: true, dmInsulin: true, scr: 2.3 });
  assert.equal(r.score, 6);
  assert.equal(r.lee, '11%');
  assert.equal(R.rcri({}).score, 0);
  assert.equal(R.rcri({ ihd: true, dmInsulin: true }).elevated, true);
});

test('DASI score and METs', () => {
  const s = { dasi1: true, dasi2: true, dasi3: true, dasi4: true };
  const r = R.dasi(s, D.dasi);
  assert.equal(r.score, 12.75);
  assert.equal(r.poor, true);
  assert.equal(r.mets, 4.3);
});

test('institutional pathway', () => {
  assert.equal(R.cardiacRisk({ urgency: 'emergency' }).status, 'proceedNow');
  assert.equal(R.cardiacRisk({ urgency: 'urgent', urgentPrep: 'no' }).status, 'proceedNow');
  assert.equal(R.cardiacRisk({ urgency: 'elective', ac_recentMI: true }).status, 'consultCardio');
  assert.equal(R.cardiacRisk({ urgency: 'elective', fr_slowness: true, fr_weakness: true, fr_exhaustion: true }).status, 'consultMed');
  assert.equal(R.cardiacRisk({ urgency: 'elective' }).status, 'proceed');
  const base = { urgency: 'timeSensitive', rf_ht: true, surgRisk: 'high' };
  assert.equal(R.cardiacRisk(base).status, 'incomplete');
  assert.equal(R.cardiacRisk({ ...base, fc: '4to10' }).status, 'proceed');
  assert.equal(R.cardiacRisk({ ...base, fc: 'unknown', lowFcOption: 'biomarker', biomarker: 'abnormal' }).status, 'consultCardio');
  assert.equal(R.cardiacRisk({ ...base, surgRisk: 'low' }).status, 'proceed');
});

test('ESC testing groups', () => {
  const d = R.derive({ age: 50 });
  assert.equal(R.escTesting({ age: 50, surgRisk: 'high', urgency: 'elective' }, d).recs[0].cls, 'IIa');
  const s2 = { age: 70, surgRisk: 'intermediate', urgency: 'elective' };
  const r2 = R.escTesting(s2, R.derive(s2));
  assert.equal(r2.group, 'risk');
  assert.ok(r2.recs.some(r => /ECG and biomarkers/.test(r.text) && r.cls === 'I'));
  assert.ok(r2.recs.some(r => /hs-cTn at baseline/.test(r.text)));
  const s3 = { age: 70, ihd: true, surgRisk: 'high', urgency: 'elective', fc: 'lt4' };
  const r3 = R.escTesting(s3, R.derive(s3));
  assert.ok(r3.recs.some(r => /Cardiology consultation/.test(r.text)));
  assert.ok(r3.recs.some(r => /stress imaging/.test(r.text)));
});

test('PCI timing (AHA 2024)', () => {
  assert.equal(R.pciTiming({ priorPci: true, pciType: 'des', pciMonths: 1 }).status, 'harm');
  assert.equal(R.pciTiming({ priorPci: true, pciType: 'des', pciIndication: 'acs', pciMonths: 6 }).status, 'delay');
  assert.equal(R.pciTiming({ priorPci: true, pciType: 'des', pciIndication: 'acs', pciMonths: 6, urgency: 'timeSensitive' }).status, 'ok');
  assert.equal(R.pciTiming({ priorPci: true, pciType: 'des', pciIndication: 'ccs', pciMonths: 7 }).status, 'ok');
  assert.equal(R.pciTiming({ priorPci: true, pciType: 'bms', pciMonths: 0.5 }).status, 'delay');
  assert.equal(R.pciTiming({}), null);
});

test('antiplatelet plan and DAPT', () => {
  const defs = D.antiplatelets;
  assert.equal(R.antiplateletPlan({ ap_aspirin: true, priorPci: true, pciMonths: 6 }, defs).action, 'consult');
  assert.equal(R.antiplateletPlan({ ap_aspirin: true, priorPci: true, pciMonths: 24, bleedRisk: 'lowMod' }, defs).action, 'continue');
  const p = R.antiplateletPlan({ ap_aspirin: true, bleedRisk: 'high', surgeryDate: '2025-01-10' }, defs);
  assert.equal(p.action, 'stop');
  assert.match(p.drugs[0].dates, /05 Jan 2025/);
  const dapt = R.daptAdvice({ ap_aspirin: true, ap_clopidogrel: true, bleedRisk: 'high', priorPci: true, pciMonths: 8 }, defs);
  assert.match(dapt.text, /Continue aspirin/);
  assert.match(R.daptAdvice({ ap_aspirin: true, ap_ticagrelor: true, bleedRisk: 'high', priorPci: true, pciIndication: 'acs', pciMonths: 2 }, defs).text, /defer/);
});

test('thrombotic risk and AF scores', () => {
  assert.equal(R.chads2({ chf: true, ht: true, dm: true, stroke: true }, 80), 6);
  assert.equal(R.cha2ds2vasc({ chf: true, ht: true, dm: true, stroke: true, vascular: true }, 80, 'F'), 9);
  assert.equal(R.thromboticRisk({ tr_vteOld: true, tr_vteCancer: true }, D.thromboticRisk, null).level, 'moderate');
  assert.equal(R.thromboticRisk({ tr_lvThrombus: true }, D.thromboticRisk, null).level, 'high');
  assert.equal(R.thromboticRisk({}, D.thromboticRisk, { present: true, chads: 1, vasc: 7 }).level, 'high');
});

test('DOAC schedules (institutional Table 3.2)', () => {
  const s = (drug, crcl, bleeding) => { const r = R.doacSchedule({ drug, crcl, bleeding }); return [r.lastDose, r.resume]; };
  assert.deepEqual(s('apixaban', 60, 'lowMod'), [-2, 1]);
  assert.deepEqual(s('apixaban', 60, 'high'), [-3, 2]);
  assert.deepEqual(s('edoxaban', 20, 'high'), [-4, 3]);
  assert.deepEqual(s('dabigatran', 60, 'high'), [-3, 3]);
  assert.deepEqual(s('dabigatran', 40, 'high'), [-5, 3]);
  assert.deepEqual(R.doacSchedule({ drug: 'apixaban', crcl: null, bleeding: 'minimal' }).hold, [0]);
});

test('warfarin and bridging', () => {
  assert.equal(R.warfarinPlan({ bleeding: 'minimal' }).status, 'continue');
  assert.equal(R.warfarinPlan({ bleeding: 'high', thrombotic: 'moderate' }).status, 'stop');
  assert.equal(R.warfarinPlan({ bleeding: 'lowMod', thrombotic: 'high' }).status, 'bridge');
  assert.match(R.bridgingDose({ weight: 60, crcl: 50 }, D.bemiparin).enoxaparin, /60 mg .* q 12 h/);
  assert.match(R.bridgingDose({ weight: 110, crcl: 50 }, D.bemiparin).bemiparin, /12,650 IU/);
});

test('pulmonary risk stratification', () => {
  const low = R.ppcRisk({ age: 40, asa: '1', anesthesia: 'local' }, R.derive({}));
  assert.equal(low.level, 'low');
  const mod = R.ppcRisk({ age: 40, asa: '1', anesthesia: 'ga', cxrPft: 'normal' }, R.derive({}));
  assert.equal(mod.level, 'moderate');
  const high = R.ppcRisk({ age: 72, asa: '3', copd: true, copdStatus: 'uncontrolled', site_upperAbd: true, urgency: 'elective' }, R.derive({}));
  assert.equal(high.level, 'high');
  assert.ok(high.consult.some(c => /Poorly controlled/.test(c)));
  assert.ok(high.recs.some(r => /pulmonary rehabilitation/.test(r)));
});

test('ppoFEV1 by segments and perfusion', () => {
  const a = R.ppoLung({ fev1: 60, resected: 3, obstructed: 0 });
  assert.equal(a.ppoFev1, 50.5);
  assert.equal(a.risk, 'moderate');
  const b = R.ppoLung({ fev1: 44, perfusion: 37.67 });
  assert.equal(b.ppoFev1, 27.4);
  assert.equal(b.risk, 'high');
  assert.equal(R.ppoLung({ fev1: 60 }), null);
});

test('kidney plan', () => {
  const s = { dialysis: 'hd', weight: 60, urgency: 'elective', fc: 'lt4' };
  const r = R.renalPlan(s, R.derive(s));
  assert.ok(r.recs.some(x => /without heparin/.test(x)));
  assert.ok(r.recs.some(x => /18 mcg/.test(x)));
  assert.ok(r.recs.some(x => /cardiology consultation/.test(x)));
  const c = { contrastPlanned: true, weight: 60, scr: 1.5, age: 70 };
  assert.ok(R.renalPlan(c, R.derive(c)).recs.some(x => /200 mL/.test(x)));
  assert.equal(R.renalPlan({}, R.derive({})).applicable, false);
});

test('diabetes plan', () => {
  const s = { dmType: 't2', hba1c: 9, urgency: 'elective', dm_sglt2: true, dm_metformin: true, surgRisk: 'intermediate', insNphPm: 20, insNphAm: 30 };
  const p = R.dmPlan(s, R.derive(s), D.dmDrugs);
  assert.equal(p.optimize, true);
  assert.equal(p.route, 'iv');
  assert.ok(p.drugs.some(x => /Hold ≥ 3 days/.test(x.rec)));
  assert.ok(p.insulin.some(x => /15–16 U/.test(x)));
  assert.ok(p.insulin.some(x => /15 U \(50% of 30 U\)/.test(x)));
  const ts = R.dmPlan({ dmType: 't2', hba1c: 9, urgency: 'timeSensitive' }, R.derive({ dmType: 't2' }), D.dmDrugs);
  assert.equal(ts.optimize, false);
  const sc = R.dmPlan({ dmType: 't2', hba1c: 7, urgency: 'elective', surgRisk: 'low', eatingSoon: true }, R.derive({ dmType: 't2' }), D.dmDrugs);
  assert.equal(sc.route, 'sc');
  assert.equal(R.dmPlan({}, R.derive({}), D.dmDrugs), null);
});

test('missing mandatory items', () => {
  const m = R.missing({}, R.derive({}), { cardiacStatus: 'incomplete', anyMed: false });
  assert.ok(m.includes('Surgical urgency'));
  assert.ok(m.includes('Medication review (tick drugs or "no regular medication")'));
});

test('aspirin 7 days for closed-space surgery', () => {
  const p = R.antiplateletPlan({ ap_aspirin: true, bleedRisk: 'high', site_closedSpace: true }, D.antiplatelets);
  assert.match(p.drugs[0].rec, /≥ 7 days/);
});

test('ESC DOAC hours by renal function', () => {
  assert.equal(R.escDoacHours('dabigatran', 60, true), '≥ 72 h');
  assert.equal(R.escDoacHours('dabigatran', 40, false), '≥ 48 h');
  assert.equal(R.escDoacHours('apixaban', 20, false), '≥ 36 h');
  assert.equal(R.escDoacHours('apixaban', 20, true), '≥ 48 h');
});

test('reversal only for emergency/urgent', () => {
  assert.equal(R.reversalNotes({ urgency: 'elective', anticoag: 'apixaban' }).length, 0);
  assert.match(R.reversalNotes({ urgency: 'emergency', anticoag: 'dabigatran' })[2], /idarucizumab/);
});

test('specific conditions: AS, CIED, PAH', () => {
  const sp = s => R.cardiacSpecifics(s, R.derive(s));
  assert.ok(sp({ vhd_AS: true, surgRisk: 'high', urgency: 'elective' }).some(t => /evaluate for AVR/.test(t)));
  assert.ok(sp({ vhd_ASasx: true, lvef: 60, surgRisk: 'low' }).some(t => /reasonable to proceed/.test(t)));
  assert.ok(sp({ rm_cied: true, ciedType: 'icd', ciedDependent: true, emiAbove: true }).some(t => /asynchronous mode and disable ICD/.test(t)));
  assert.ok(sp({ rm_cied: true }).some(t => /below the umbilicus/.test(t)));
  assert.ok(sp({ pulmHT: true }).some(t => /continue PAH therapy/.test(t)));
});

test('drug initiation advice', () => {
  const s = { ihd: true, surgRisk: 'high', age: 70, rf_ht: true };
  const x = R.pharmacoInitiation(s, R.derive(s));
  assert.ok(x.some(i => /Statin-naive/.test(i.text) && i.cls === 'I'));
  assert.ok(x.some(i => /day of surgery/.test(i.text) && i.cls === 'III'));
});

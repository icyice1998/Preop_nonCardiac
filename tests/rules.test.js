const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/rules.js');
const D = require('../js/data.js');

test('addDays crosses month and year boundaries', () => {
  assert.equal(R.addDays('2025-01-02', -5), '2024-12-28');
  assert.equal(R.addDays('2024-02-28', 1), '2024-02-29');
});

test('Cockcroft-Gault with female correction', () => {
  assert.equal(R.cockcroftGault({ age: 70, weight: 60, scr: 1, sex: 'M' }), 58.3);
  assert.equal(R.cockcroftGault({ age: 70, weight: 60, scr: 1, sex: 'F' }), 49.6);
  assert.equal(R.cockcroftGault({ age: 70, weight: 0, scr: 1 }), null);
});

test('cardiac pathway: emergency proceeds immediately', () => {
  assert.equal(R.cardiacRisk({ urgency: 'emergency' }).status, 'proceedNow');
});

test('cardiac pathway: urgent without preparation need proceeds', () => {
  assert.equal(R.cardiacRisk({ urgency: 'urgent', urgentNeedsPrep: false }).status, 'proceedNow');
  assert.equal(R.cardiacRisk({ urgency: 'urgent' }).status, 'incomplete');
});

test('cardiac pathway: active condition or frailty ≥3 -> consult', () => {
  assert.equal(R.cardiacRisk({ urgency: 'elective', active: { recentMI: true } }).status, 'consultCardio');
  assert.equal(R.cardiacRisk({ urgency: 'elective', frailty: { a: true, b: true, c: true } }).status, 'consultMed');
  assert.notEqual(R.cardiacRisk({ urgency: 'elective', frailty: { a: true, b: true } }).status, 'consultMed');
});

test('cardiac pathway: no clinical risk factor -> proceed', () => {
  assert.equal(R.cardiacRisk({ urgency: 'elective' }).status, 'proceed');
});

test('cardiac pathway: step 4 branches', () => {
  const base = { urgency: 'elective', clinical: { ht: true } };
  assert.equal(R.cardiacRisk(base).status, 'incomplete');
  assert.equal(R.cardiacRisk({ ...base, surgicalRisk: 'low' }).status, 'proceed');
  assert.equal(R.cardiacRisk({ ...base, surgicalRisk: 'high', fc: '4to10' }).status, 'proceed');
  assert.equal(R.cardiacRisk({ ...base, surgicalRisk: 'high', fc: 'lt4', lowFcOption: 'accept' }).status, 'proceed');
  assert.equal(R.cardiacRisk({ ...base, surgicalRisk: 'high', fc: 'lt4', lowFcOption: 'biomarker', biomarker: 'normal' }).status, 'proceed');
  assert.equal(R.cardiacRisk({ ...base, surgicalRisk: 'intermediate', fc: 'lt4', lowFcOption: 'biomarker', biomarker: 'abnormal' }).status, 'consultCardio');
});

test('stroke scores', () => {
  assert.equal(R.chads2({ chf: true, ht: true, dm: true, stroke: true }, 80), 6);
  assert.equal(R.cha2ds2vasc({ chf: true, ht: true, dm: true, stroke: true, vascular: true }, 80, 'F'), 9);
  assert.equal(R.cha2ds2vasc({}, 70, 'M'), 1);
  assert.equal(R.afLevel(2, 3), 'low');
  assert.equal(R.afLevel(3, 3), 'moderate');
  assert.equal(R.afLevel(1, 7), 'high');
});

test('thrombotic risk takes the highest level', () => {
  const r = R.thromboticRisk({ vteOld: true, vteCancer: true }, D.thromboticRisk, null);
  assert.equal(r.level, 'moderate');
  assert.equal(R.thromboticRisk({}, D.thromboticRisk, null).level, null);
  assert.equal(R.thromboticRisk({ vteOld: true }, D.thromboticRisk, { present: true, chads: 5, vasc: 6 }).level, 'high');
});

test('antiplatelet: PCI rules', () => {
  const defs = D.antiplatelets;
  assert.equal(R.antiplateletPlan({ drugs: { aspirin: true }, pci: 'lt1y', bleeding: 'high' }, defs).action, 'consult');
  assert.equal(R.antiplateletPlan({ drugs: { aspirin: true }, pci: 'gt1y', bleeding: 'lowMod' }, defs).action, 'continue');
  assert.equal(R.antiplateletPlan({ drugs: { aspirin: true }, pci: 'gt1y', bleeding: 'high' }, defs).action, 'stop');
  const p = R.antiplateletPlan({ drugs: { aspirin: true }, pci: 'none' }, defs, '2025-01-10');
  assert.match(p.drugs[0].rec, /last dose D-5/);
  assert.match(p.drugs[0].dates, /05 Jan 2025/);
});

test('DOAC schedules match Table 3.2', () => {
  const s = (drug, crcl, bleeding) => {
    const r = R.doacSchedule({ drug, crcl, bleeding });
    return [r.lastDose, r.resume];
  };
  assert.deepEqual(s('apixaban', 60, 'lowMod'), [-2, 1]);
  assert.deepEqual(s('apixaban', 60, 'high'), [-3, 2]);
  assert.deepEqual(s('rivaroxaban', 20, 'lowMod'), [-3, 1]);
  assert.deepEqual(s('edoxaban', 20, 'high'), [-4, 3]);
  assert.deepEqual(s('dabigatran', 60, 'lowMod'), [-2, 1]);
  assert.deepEqual(s('dabigatran', 60, 'high'), [-3, 3]);
  assert.deepEqual(s('dabigatran', 40, 'lowMod'), [-3, 1]);
  assert.deepEqual(s('dabigatran', 40, 'high'), [-5, 3]);
  assert.deepEqual(R.doacSchedule({ drug: 'apixaban', crcl: null, bleeding: 'minimal' }).hold, [0]);
});

test('warfarin plan branches', () => {
  assert.equal(R.warfarinPlan({ bleeding: 'minimal' }).status, 'continue');
  assert.equal(R.warfarinPlan({ bleeding: 'high' }).status, 'incomplete');
  assert.equal(R.warfarinPlan({ bleeding: 'high', thrombotic: 'moderate' }).status, 'stop');
  assert.equal(R.warfarinPlan({ bleeding: 'lowMod', thrombotic: 'high' }).status, 'bridge');
});

test('bridging dose by weight and CrCl', () => {
  const b = R.bridgingDose({ weight: 60, crcl: 50 }, D.bemiparin);
  assert.match(b.enoxaparin, /60 mg .* q 12 h/);
  assert.match(b.bemiparin, /7,500 IU/);
  const r = R.bridgingDose({ weight: 110, crcl: 20 }, D.bemiparin);
  assert.match(r.enoxaparin, /once daily/);
  assert.match(r.bemiparin, /25%/);
  assert.match(R.bridgingDose({ weight: 110, crcl: 50 }, D.bemiparin).bemiparin, /12,650 IU/);
});

test('DM plan: HbA1c > 8 elective requires optimization', () => {
  assert.ok(R.dmPlan({ hba1c: 9, urgency: 'elective', drugs: {} }, D.dmDrugs).consult);
  assert.ok(!R.dmPlan({ hba1c: 9, urgency: 'emergency', drugs: {} }, D.dmDrugs).consult);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/rules.js');
const D = require('../js/data.js');
const P = require('../js/report.js');

const CASE = {
  name: 'Test', hn: 'X1', age: 72, sex: 'F', weight: 58, height: 155, scr: 1.3, hb: 10.5, albumin: 3.3, hba1c: 7.6, spo2: 95,
  surgeryDate: '2026-11-10', urgency: 'timeSensitive', surgRisk: 'intermediate', bleedRisk: 'high', anesthesia: 'ga',
  site_intraperitoneal: true, longDuration: true, rf_age65: true, rf_ht: true, rf_dm: true, af: true,
  asa: '3', copd: true, copdStatus: 'controlled', smokeStatus: 'former', ckdStage: 'g3b', dialysis: 'none',
  dmType: 't2', dmInsulin: true, fc: 'lt4', lowFcOption: 'biomarker', biomarker: 'normal',
  anticoag: 'apixaban', drug_acei: true, opt_acei: 'ht', dm_metformin: true, insLong: 20
};

test('buildPlan integrates all systems', () => {
  const plan = P.buildPlan(CASE, D, R);
  assert.equal(plan.cardiac.status, 'proceed');
  assert.equal(plan.d.rcri.score, 2);
  assert.equal(plan.ppc.level, 'high');
  assert.equal(plan.doac.lastDose, -3);
  assert.ok(plan.renal.applicable);
  assert.equal(plan.dm.route, 'iv');
  assert.equal(plan.af.vasc, 4);
  assert.deepEqual(plan.missing, []);
});

test('plain text export has every section and the calendar', () => {
  const plan = P.buildPlan(CASE, D, R);
  const t = P.toPlainText(CASE, plan, D, R);
  for (const h of ['PROBLEM LIST', '1. CARDIOVASCULAR', '2. PULMONARY', '3. KIDNEY', '4. DIABETES AND ENDOCRINE', '5. MEDICATION PLAN', '6. CONSULTATIONS']) {
    assert.ok(t.includes(h), h);
  }
  assert.match(t, /Apixaban/);
  assert.match(t, /HOLD/);
  assert.match(t, /11\/07/);
  assert.match(t, /Long-acting basal .* 15–16 U/);
  assert.ok(!/undefined|NaN|\[object/.test(t));
});

test('empty state still produces text and lists missing items', () => {
  const plan = P.buildPlan({}, D, R);
  const t = P.toPlainText({}, plan, D, R);
  assert.match(t, /INCOMPLETE ITEMS/);
  assert.ok(!/undefined|NaN/.test(t));
});

test('problem list reads the questionnaire', () => {
  const list = P.problemList({ copd: true, copdStatus: 'uncontrolled', dmType: 't2', smokeStatus: 'never' }, D);
  assert.ok(list.includes('COPD'));
  assert.ok(list.some(x => /COPD control: Uncontrolled/.test(x)));
  assert.ok(list.some(x => /Diabetes: Type 2/.test(x)));
  assert.ok(!list.some(x => /Never/.test(x)));
});

const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/rules.js');
const D = require('../js/data.js');
const P = require('../js/report.js');

const CASE = {
  age: 72, sex: 'F', weight: 58, height: 155, scr: 1.3, hb: 10.5, albumin: 3.3, hba1c: 7.6, spo2: 95,
  urgency: 'timeSensitive', surgRisk: 'intermediate', bleedRisk: 'high', anesthesia: 'ga',
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
  const steps = ['STEP 1  TYPE OF SURGERY', 'STEP 2  ACTIVE', 'STEP 3  RISK', 'STEP 4  FUNCTIONAL', 'STEP 5  CARDIAC', 'STEP 6  SPECIFIC', 'STEP 7  MEDICATION', 'STEP 8  PULMONARY', 'STEP 9  KIDNEY', 'STEP 10  POST', 'STEP 11  CONSULT'];
  let last = -1;
  for (const h of steps) { const i = t.indexOf(h); assert.ok(i > last, h); last = i; }
  assert.match(t, /Time-sensitive\n\s+-> Up to 3 months/);
  assert.match(t, /\[STOP\]\s+Apixaban\n\s+last dose D-3; restart D\+2/);
  assert.match(t, /\[HOLD D0\]\s+Metformin/);
  assert.match(t, /\[ADJUST\]\s+Insulin/);
  assert.match(t, /15–16 U/);
  assert.ok(t.split('\n').every(l => l.length <= 64), 'lines fit 64 columns');
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

test('medication table tags each drug', () => {
  const plan = P.buildPlan({ ...CASE, drug_statin: true, drug_nsaid: true }, D, R);
  const tag = n => plan.meds.find(m => m.name === n).tag;
  assert.equal(tag('Statin'), 'CONTINUE');
  assert.equal(tag('NSAID'), 'STOP');
  assert.equal(tag('ACE-I / ARB / ARNI'), 'HOLD D0');
});

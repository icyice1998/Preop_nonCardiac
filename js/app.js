(function () {
  const { data: D, rules: R, report: P } = window.PREOP;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const F = (k, label, t = 'cb', extra = {}) => Object.assign({ k, label, t }, extra);

  const TABS = [
    { id: 'patient', label: 'Patient & Surgery' },
    { id: 'questionnaire', label: 'Questionnaire' },
    { id: 'cardiac', label: 'Cardiac' },
    { id: 'pulmonary', label: 'Pulmonary' },
    { id: 'renal', label: 'Kidney' },
    { id: 'endocrine', label: 'Diabetes & Endocrine' },
    { id: 'meds', label: 'Medications' },
    { id: 'plan', label: 'Plan & Export' }
  ];

  // ---------- Field rendering ----------
  let uid = 0;
  const META = {};
  const condList = f => (f.show ? [f.show] : f.showAny || null);
  const showAttr = f => (condList(f) ? ` data-show="${esc(condList(f).join('|'))}"` : '');

  function renderField(f) {
    if (!META[f.k]) META[f.k] = f;
    const sa = showAttr(f);
    const hint = f.hint ? `<small>${esc(f.hint)}</small>` : '';
    if (f.t === 'cb') {
      return `<label class="choice"${sa}><input type="checkbox" data-key="${f.k}"><span>${f.html || esc(f.label)}${hint}</span></label>`;
    }
    if (f.t === 'radio') {
      const name = `${f.k}__${uid++}`;
      const stacked = f.stacked || f.opts.some(o => o.hint);
      return `<div class="radio-group"${sa}>${f.label ? `<div class="rg-label">${esc(f.label)}</div>` : ''}<div class="choices${stacked ? '' : ' inline'}">${f.opts.map(o =>
        `<label class="choice"><input type="radio" name="${name}" data-key="${f.k}" value="${esc(o.v)}"><span>${esc(o.l)}${o.hint ? `<small>${esc(o.hint)}</small>` : ''}</span></label>`).join('')}</div></div>`;
    }
    if (f.t === 'select') {
      return `<label class="field"${sa}><span>${esc(f.label)}</span><select data-key="${f.k}"><option value="">–</option>${f.opts.map(o => `<option value="${esc(o.v)}">${esc(o.l)}</option>`).join('')}</select></label>`;
    }
    const type = f.t === 'num' ? 'number' : f.t;
    const attrs = f.t === 'num'
      ? ` inputmode="decimal" step="${f.step || 'any'}"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''}`
      : ' autocomplete="off"';
    return `<label class="field"${sa}><span>${esc(f.label)}${f.unit ? ` <em>${esc(f.unit)}</em>` : ''}</span><input type="${type}" data-key="${f.k}"${attrs}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}>${hint}</label>`;
  }
  const list = (fields, cls = 'choices') => `<div class="${cls}">${fields.map(renderField).join('')}</div>`;

  function riskCards(key, defs, order, compact) {
    if (!META[key]) META[key] = { k: key, t: 'radio' };
    const name = `${key}__${uid++}`;
    return order.map(k => `<label class="risk-card ${k}">
      <span class="risk-head"><input type="radio" name="${name}" data-key="${key}" value="${k}"><b>${esc(defs[k].label)}</b></span>
      ${defs[k].note ? `<small>${esc(defs[k].note)}</small>` : ''}
      ${compact ? '' : `<ul>${defs[k].items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`}
    </label>`).join('');
  }

  function drugItem(item, prefix, optPrefix) {
    const opts = item.options
      ? renderField({ k: optPrefix + item.id, t: 'radio', label: '', stacked: true, show: prefix + item.id, opts: item.options.map(o => ({ v: o.id, l: o.label })) })
      : '';
    const stop = item.stop ? ` <small>stop ${item.stop[0]} d before</small>` : '';
    return `<div class="drug" data-drug="${prefix}${item.id}">
      ${renderField(F(prefix + item.id, item.name, 'cb', { html: esc(item.name) + stop }))}
      <div class="drug-sub">${opts}<p class="drug-rec" hidden></p></div>
    </div>`;
  }

  const urgencyField = () => list([
    F('urgency', '', 'radio', { opts: D.urgency }),
    F('urgentPrep', 'Cardiac or other disease requiring preparation before surgery?', 'radio', { show: 'urgency=urgent', opts: [{ v: 'no', l: 'No' }, { v: 'yes', l: 'Yes' }] })
  ]);

  function renderStatic() {
    $('#tabs').innerHTML = TABS.map((t, i) => `<button role="tab" type="button" class="tab" data-tab="${t.id}" aria-selected="false"><span class="tab-no">${i + 1}</span>${esc(t.label)}<span class="dot" data-dot="${t.id}"></span></button>`).join('');

    // Tab 1
    $('#patient-fields').innerHTML = D.patientFields.map(renderField).join('');
    $('#lab-fields').innerHTML = D.labFields.map(renderField).join('');
    $('#urgency-a').innerHTML = urgencyField();
    $('#surgrisk-a').innerHTML = riskCards('surgRisk', D.surgicalRisk, ['high', 'intermediate', 'low']);
    $('#bleedrisk-a').innerHTML = riskCards('bleedRisk', D.bleedingRisk, ['high', 'lowMod', 'minimal']);
    $('#stress-a').innerHTML = list([F('stressGrade', '', 'radio', { opts: D.surgicalStress })]);
    $('#surgery-details').innerHTML = list(D.surgeryDetailFields.slice(0, 1)) + list(D.surgeryDetailFields.slice(1));

    // Tab 2
    $('#questionnaire').innerHTML = D.questionnaire.map(sec => `<fieldset class="q-sec" id="${sec.id}"><legend>${esc(sec.title)}</legend>${list(sec.fields, 'choices' + (sec.inline ? ' inline' : '') + (sec.cols ? ' cols-3' : ''))}</fieldset>`).join('');

    // Tab 3
    $('#urgency-b').innerHTML = urgencyField();
    $('#active-b').innerHTML = list(D.activeCardiac);
    $('#rm-b').innerHTML = list(D.riskModifying);
    $('#frailty-b').innerHTML = list(D.frailty, 'choices inline');
    $('#rf-b').innerHTML = list(D.clinicalRisk, 'choices cols-3');
    $('#surgrisk-b').innerHTML = riskCards('surgRisk', D.surgicalRisk, ['high', 'intermediate', 'low'], true);
    $('#fc-b').innerHTML = list([
      F('fc', '', 'radio', { opts: D.functionalCapacity }),
      F('lowFcOption', 'Poor or unknown functional capacity: choose one option', 'radio', { showAny: ['fc=lt4', 'fc=unknown'], stacked: true, opts: [{ v: 'accept', l: 'Surgery is necessary; patient and family informed and accept the risk' }, { v: 'biomarker', l: 'Measure troponin and NT-proBNP' }] }),
      F('biomarker', 'Troponin / NT-proBNP', 'radio', { show: 'lowFcOption=biomarker', opts: [{ v: 'normal', l: 'Normal' }, { v: 'abnormal', l: 'Abnormal' }] })
    ]);
    $('#dasi-list').innerHTML = list(D.dasi.map(i => F(i.k, i.label, 'cb', { hint: `${i.w}` })));

    // Tab 4
    const pulm = D.questionnaire.find(q => q.id === 'q-pulm').fields;
    $('#pulm-q').innerHTML = list(pulm.concat([F('site_lungResection', 'Lung resection planned'), F('site_upperAbd', 'Upper abdominal surgery'), F('longDuration', 'Duration > 3 hours')]));
    $('#lung-fields').innerHTML = D.lungFields.map(renderField).join('');

    // Tab 5
    $('#renal-q').innerHTML = list(D.questionnaire.find(q => q.id === 'q-renal').fields);
    $('#renal-contrast').innerHTML = list(D.surgeryDetailFields.filter(f => /contrast|gadolinium|openGI/i.test(f.k)));

    // Tab 6
    $('#endo-q').innerHTML = list(D.questionnaire.find(q => q.id === 'q-endo').fields);
    $('#endo-labs').innerHTML = D.labFields.filter(f => f.k === 'hba1c' || f.k === 'fpg').map(renderField).join('');
    $('#dm-drugs').innerHTML = `<div class="drug-list">${D.dmDrugs.map(i => drugItem(i, 'dm_', 'dmopt_')).join('')}</div>`;
    $('#insulin-fields').innerHTML = D.insulinFields.map(renderField).join('');
    $('#stress-b').innerHTML = list([F('stressGrade', '', 'radio', { opts: D.surgicalStress })]);

    // Tab 7
    $('#nomeds').innerHTML = list([F('noMeds', 'No regular medication (medication review completed)')]);
    $('#ap-list').innerHTML = `<div class="drug-list">${D.antiplatelets.map(a => renderField(F('ap_' + a.id, a.name, 'cb', { hint: `stop ${a.stop[0] === a.stop[1] ? a.stop[0] : a.stop.join('–')} days before` }))).join('')}</div>`;
    $('#ac-list').innerHTML = list([F('anticoag', '', 'radio', { opts: [{ v: 'none', l: 'None' }, { v: 'warfarin', l: 'Warfarin' }].concat(D.doacs.map(x => ({ v: x.id, l: x.name }))) })]);
    $('#thromb-list').innerHTML = Object.values(D.thromboticRisk).map(g => `<fieldset><legend>${esc(g.label)}</legend>${list(g.items.map(i => F('tr_' + i.id, i.label, 'cb', { html: `${esc(i.label)} <em class="lvl ${i.level}">${i.level}</em>` })))}</fieldset>`).join('');
    $('#drug-groups').innerHTML = D.drugGroups.map(g => `<details class="card med">
      <summary><h3>${esc(g.title)}</h3><span class="pill" data-count="${g.id}"></span></summary>
      <div class="drug-list">${g.items.map(i => drugItem(i, 'drug_', 'opt_')).join('')}</div>
    </details>`).join('');
  }

  // ---------- State ----------
  function condOk(f, s) {
    const conds = condList(f);
    if (!conds) return true;
    return conds.some(c => { const [k, v] = c.split('='); return v === undefined ? !!s[k] : s[k] === v; });
  }

  function readState() {
    const s = {};
    for (const el of $$('[data-key]')) {
      const k = el.dataset.key;
      if (el.type === 'checkbox') s[k] = !!s[k] || el.checked;
      else if (el.type === 'radio') { if (el.checked) s[k] = el.value; else if (!(k in s)) s[k] = null; }
      else if (el.type === 'number') { const v = parseFloat(el.value); if (s[k] == null) s[k] = Number.isFinite(v) ? v : null; }
      else if (!s[k]) s[k] = el.value.trim();
    }
    // Answers of hidden dependent fields are ignored (e.g. COPD control when COPD is unticked)
    for (let pass = 0; pass < 2; pass++) {
      for (const [k, f] of Object.entries(META)) if (!condOk(f, s)) s[k] = f.t === 'cb' ? false : null;
    }
    return s;
  }

  function sync(el) {
    const k = el.dataset.key;
    for (const o of $$(`[data-key="${k}"]`)) {
      if (o === el) continue;
      if (el.type === 'checkbox') o.checked = el.checked;
      else if (el.type === 'radio') o.checked = el.checked && o.value === el.value;
      else o.value = el.value;
    }
  }

  function setValue(k, v) {
    for (const el of $$(`[data-key="${k}"]`)) {
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.type === 'radio') el.checked = el.value === String(v);
      else el.value = v == null ? '' : v;
    }
  }

  // ---------- HTML helpers ----------
  const ul = (arr, cls = 'notes') => arr.length ? `<ul class="${cls}">${arr.map(n => `<li>${n}</li>`).join('')}</ul>` : '';
  const li = arr => arr.map(esc);
  const cls = c => (c ? `<span class="cor cor-${c.replace('/', '')}">${esc(c)}</span> ` : '');
  const STATUS = {
    incomplete: { c: 'pending', l: 'In progress' }, proceedNow: { c: 'go', l: 'Proceed' }, proceed: { c: 'go', l: 'Proceed' },
    consultMed: { c: 'warn', l: 'Consult' }, consultCardio: { c: 'stop', l: 'Consult' }
  };
  const LEVEL_CLS = { low: 'go', moderate: 'warn', high: 'stop' };

  function calendar(from, to, rows, surgeryDate) {
    const days = [];
    for (let x = from; x <= to; x++) days.push(x);
    const head = days.map(x => `<th class="${x === 0 ? 'd0' : ''}">${R.dayLabel(x)}${surgeryDate ? `<br><small>${esc(R.formatDate(R.addDays(surgeryDate, x)).replace(/ \d{4}$/, ''))}</small>` : ''}</th>`).join('');
    const body = rows.map(r => `<tr><th scope="row">${esc(r.label)}</th>${days.map(x => { const c = r.cell(x); return `<td class="${c.cls}${x === 0 ? ' d0' : ''}">${esc(c.text)}</td>`; }).join('')}</tr>`).join('');
    return `<div class="cal-wrap"><table class="cal"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function anticoagHTML(plan, s) {
    const sd = s.surgeryDate;
    if (plan.doac) {
      const x = plan.doac;
      if (x.incomplete) return ul(li(x.notes));
      const line = `Last dose ${R.dayLabel(x.lastDose)}${sd ? ` (${R.formatDate(R.addDays(sd, x.lastDose))})` : ''}; resume ${R.dayLabel(x.resume)}${sd ? ` (${R.formatDate(R.addDays(sd, x.resume))})` : ''}.`;
      return `<p><b>${esc(x.name)}</b>${plan.d.crcl != null ? ` · CrCl ${plan.d.crcl} mL/min` : ''}</p>${ul(li([line].concat(x.notes)))}${calendar(-5, 3, [{ label: x.name, cell: n => (n <= x.lastDose || n >= x.resume ? { text: 'Dose', cls: 'on' } : { text: 'Hold', cls: 'off' }) }], sd)}`;
    }
    if (plan.warfarin) {
      const w = plan.warfarin;
      let h = `<p><b>Warfarin</b>${plan.thrombotic.level ? ` · thrombotic risk <em class="lvl ${plan.thrombotic.level}">${plan.thrombotic.level}</em>` : ''}</p>${ul(li(plan.thrombotic.reasons), 'notes muted')}${ul(li(w.notes))}`;
      if (w.status === 'stop' || w.status === 'bridge') {
        const rows = [{ label: 'Warfarin', cell: n => (n <= w.warfarinLast || n >= w.warfarinResume ? { text: 'Give', cls: 'on' } : { text: 'Hold', cls: 'off' }) }];
        if (w.status === 'bridge') rows.push({ label: 'Heparin', cell: n => (w.heparinDays.includes(n) ? { text: n === -1 ? 'Last*' : 'Give', cls: 'hep' } : n >= w.heparinResume ? { text: 'Give', cls: 'hep' } : n > -4 ? { text: 'Hold', cls: 'off' } : { text: '–', cls: '' }) });
        h += calendar(-6, 4, rows, sd);
      }
      if (w.status === 'bridge') h += plan.bridgeDose ? ul(li([plan.bridgeDose.enoxaparin, plan.bridgeDose.bemiparin, plan.bridgeDose.note])) : ul(['Enter weight and creatinine to calculate LMWH dose.']);
      return h;
    }
    return '';
  }

  // ---------- Render ----------
  let current = 'patient';

  function render() {
    const s = readState();
    const plan = P.buildPlan(s, D, R);
    const d = plan.d;

    // Visibility of dependent fields
    for (const el of $$('[data-show]')) {
      const conds = el.dataset.show.split('|');
      el.hidden = !conds.some(c => { const [k, v] = c.split('='); return v === undefined ? !!s[k] : s[k] === v; });
    }
    $('#lung-card').hidden = !s.site_lungResection;
    $('#dm-card').hidden = !d.dm;
    $('#steroid-card').hidden = !(s.adrenalInsufficiency || s.chronicSteroid);
    $('#thromb-block').hidden = s.anticoag !== 'warfarin';

    // Derived metrics
    const m = [
      ['CrCl (Cockcroft-Gault)', d.crcl != null ? `${d.crcl} mL/min${d.crclManual ? ' (manual)' : ''}` : '–'],
      ['BMI', d.bmi != null ? `${d.bmi} kg/m²` : '–'],
      ['RCRI', `${d.rcri.score} · MACE ${d.rcri.lee}`],
      ['Frailty', `${d.frailty}/5`]
    ];
    $('#derived').innerHTML = m.map(([k, v]) => `<div class="metric"><span class="metric-label">${k}</span><span class="metric-value">${esc(v)}</span></div>`).join('');

    // Cardiac
    const c = plan.cardiac;
    $$('.step').forEach(el => el.classList.toggle('inactive', !c.reached.has(+el.dataset.step)));
    $('#frailty-score').textContent = `${d.frailty}/5`;
    $('#dasi-out').textContent = plan.dasi.answered ? `${plan.dasi.score} · ${plan.dasi.mets} METs${plan.dasi.poor ? ' · poor' : ''}` : '–';
    const st = STATUS[c.status];
    $('#cardiac-result').innerHTML = `<h3>Institutional pathway</h3>
      <div class="verdict ${st.c}"><span class="tag">${st.l}</span><p>${esc(c.title)}</p></div>
      ${ul(li(c.detail), 'detail')}
      ${c.trail.length ? `<ol class="trail">${c.trail.map(t => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}
      <div class="kv"><span>RCRI</span><b>${d.rcri.score}</b></div>
      <p class="hint">MACE ${d.rcri.lee} (Lee) · 30-day death/MI/arrest ${d.rcri.duceppe} (Duceppe)</p>
      ${ul(li(d.rcri.items), 'notes muted')}`;
    const g = [];
    g.push(`<h4>ESC 2022 · ${esc(plan.esc.groupLabel)}</h4>${ul(plan.esc.recs.map(r => cls(r.cls) + esc(r.text)))}`);
    g.push(`<h4>AHA 2024 stepwise</h4>${plan.aha.modifiers.length ? `<p class="hint">Risk modifiers: ${esc(plan.aha.modifiers.join(', '))}</p>` : ''}${ul(li(plan.aha.steps))}`);
    if (plan.pci) g.push(`<h4>Prior PCI</h4><p class="out-sum ${plan.pci.status}">${esc(plan.pci.text)}</p>`);
    if (plan.dapt) g.push(`<h4>DAPT (ESC)</h4>${ul([cls(plan.dapt.cls) + esc(plan.dapt.text)])}`);
    if (plan.specifics.length) g.push(`<h4>Comorbidity-specific</h4>${ul(li(plan.specifics))}`);
    if (plan.ie) g.push(`<h4>IE prophylaxis (single dose 30–60 min before)</h4>${ul([`No penicillin allergy: ${esc(plan.ie.noAllergy.join(' or '))}`, `Penicillin allergy: ${esc(plan.ie.allergy.join(' or '))}`])}`);
    $('#cardiac-guideline').innerHTML = g.join('');

    // Pulmonary
    const p = plan.ppc;
    $('#pulm-result').innerHTML = `<h3>Post-op pulmonary complication risk</h3>
      <div class="verdict ${LEVEL_CLS[p.level]}"><span class="tag">${p.level}</span><p>${esc(p.why)}.</p></div>
      ${p.patient.length ? `<h4>Patient factors</h4>${ul(li(p.patient), 'notes muted')}` : ''}
      ${p.op.length ? `<h4>Operative factors</h4>${ul(li(p.op), 'notes muted')}` : ''}
      ${p.consult.length ? `<h4>Pulmonology consult</h4>${ul(li(p.consult))}` : ''}
      ${p.pft.length ? `<h4>Spirometry</h4>${ul(li(p.pft))}` : ''}
      ${p.recs.length ? `<h4>Recommendations</h4>${ul(li(p.recs))}` : ''}`;
    $('#lung-out').innerHTML = plan.ppo
      ? `<p><b>ppoFEV1 ${plan.ppo.ppoFev1 ?? '–'}%</b> · <b>ppoDLCO ${plan.ppo.ppoDlco ?? '–'}%</b> <em class="lvl ${plan.ppo.risk}">${plan.ppo.risk}</em></p><p class="hint">Factor ${plan.ppo.factor} by ${esc(plan.ppo.method)}</p><p>${esc(plan.ppo.next)}</p>`
        + (s.vo2max != null ? `<p>VO₂max ${s.vo2max}: ${s.vo2max < 10 ? 'prohibitive risk (< 10)' : s.vo2max > 20 ? 'low risk (> 20)' : 'moderate risk (10–20)'}</p>` : '')
        + (s.paco2 > 45 ? `<p>PaCO₂ ${s.paco2} > 45 mmHg: risk of prolonged ventilation.</p>` : '')
      : (s.site_lungResection ? '<p class="hint">Enter FEV1/DLCO and segments or perfusion fraction.</p>' : '');

    // Kidney
    $('#renal-result').innerHTML = `<h3>Kidney</h3>${plan.renal.applicable
      ? `${plan.renal.labs.length ? `<h4>Pre-op labs</h4>${ul(li(plan.renal.labs))}` : ''}<h4>Recommendations</h4>${ul(li(plan.renal.recs))}`
      : '<p class="hint">No kidney-specific issue (CrCl ≥ 60, no CKD/dialysis/AKI, no contrast).</p>'}`;

    // Endocrine
    let e = '<h3>Diabetes and endocrine</h3>';
    if (plan.dm) {
      e += `<div class="verdict ${plan.dm.optimize ? 'warn' : 'go'}"><span class="tag">${plan.dm.route === 'iv' ? 'IV insulin' : 'SC correction'}</span><p>${plan.dm.optimize ? 'Optimize glycemia before elective surgery' : 'Target 100–180 mg/dL'}</p></div>`;
      e += `<h4>Pre-operative</h4>${ul(li(plan.dm.pre))}`;
      if (plan.dm.insulin.length) e += `<h4>Insulin adjustment</h4>${ul(li(plan.dm.insulin))}`;
      e += `<h4>Intra-operative</h4>${ul(li(plan.dm.intra))}<h4>Post-operative</h4>${ul(li(plan.dm.post))}`;
    } else e += '<p class="hint">No diabetes.</p>';
    if (s.adrenalInsufficiency || s.chronicSteroid) e += `<h4>Glucocorticoid</h4>${ul(li(plan.steroid || ['Select surgical stress grade.']))}${s.chronicSteroid && !s.adrenalInsufficiency ? '<p class="hint">Steroid for another indication: confirm with prescribing physician.</p>' : ''}`;
    $('#endo-result').innerHTML = e;

    // Medications
    $('#bleed-pill').textContent = s.bleedRisk ? D.bleedingRisk[s.bleedRisk].label : 'bleeding risk not set';
    $('#bleed-pill').className = 'pill ' + (s.bleedRisk || '');
    const ap = plan.antiplatelet;
    $('#ap-out').innerHTML = (ap ? `<p class="out-sum ${ap.action}">${esc(ap.summary)}</p>${ul(li(ap.drugs.map(x => `${x.name}: ${x.rec}${x.dates ? ' ' + x.dates + '.' : ''}`)))}` : '')
      + (plan.dapt ? ul([cls(plan.dapt.cls) + 'ESC: ' + esc(plan.dapt.text)]) : '')
      + ul(li(plan.neuraxial.filter(n => /clopidogrel|ticagrelor/.test(n))));
    $('#af-scores').textContent = s.af ? `CHADS₂ ${plan.af.chads} · CHA₂DS₂-VASc ${plan.af.vasc} → ${R.afLevel(plan.af.chads, plan.af.vasc)}` : 'AF not ticked in questionnaire';
    $('#ac-out').innerHTML = anticoagHTML(plan, s) + (plan.oacPciNote ? ul([esc(plan.oacPciNote)]) : '') + ul(li(plan.neuraxial.filter(n => !/clopidogrel|ticagrelor/.test(n))));

    for (const grp of D.drugGroups) {
      let n = 0;
      for (const item of grp.items) {
        const el = $(`.drug[data-drug="drug_${item.id}"]`);
        const pd = plan.drugs.find(x => x.id === item.id);
        if (pd) n++;
        const rec = $('.drug-rec', el);
        rec.hidden = !pd;
        rec.textContent = pd ? pd.rec + (pd.dates ? ` ${pd.dates}.` : '') : '';
      }
      $(`[data-count="${grp.id}"]`).textContent = n ? `${n} selected` : '';
    }
    for (const item of D.dmDrugs) {
      const el = $(`.drug[data-drug="dm_${item.id}"]`);
      const pd = plan.dm && plan.dm.drugs.find(x => x.name === item.name);
      const rec = $('.drug-rec', el);
      rec.hidden = !pd;
      rec.textContent = pd ? pd.rec + (pd.dates ? ` ${pd.dates}.` : '') : '';
    }

    // Plan
    $('#missing').innerHTML = plan.missing.length
      ? `<div class="missing"><b>${plan.missing.length} mandatory item(s) incomplete:</b> ${esc(plan.missing.join(' · '))}</div>`
      : '<div class="missing ok">All mandatory items completed.</div>';
    $('#plaintext').textContent = P.toPlainText(s, plan, D, R);

    // Status bar and tab dots
    const chip = (label, val, c, tab) => `<button type="button" class="chip ${c}" data-goto="${tab}"><span>${label}</span><b>${esc(val)}</b></button>`;
    $('#statusbar').innerHTML = [
      chip('Cardiac', st.l, st.c, 'cardiac'),
      chip('RCRI', String(d.rcri.score), d.rcri.elevated ? 'warn' : 'go', 'cardiac'),
      chip('Pulmonary', p.level, LEVEL_CLS[p.level], 'pulmonary'),
      chip('Kidney', plan.renal.applicable ? 'review' : 'ok', plan.renal.applicable ? 'warn' : 'go', 'renal'),
      chip('DM', plan.dm ? (plan.dm.optimize ? 'optimize' : plan.dm.route === 'iv' ? 'IV insulin' : 'SC') : 'none', plan.dm ? (plan.dm.optimize ? 'stop' : 'warn') : 'go', 'endocrine'),
      chip('Consults', String(plan.consults.length), plan.consults.length ? 'stop' : 'go', 'plan'),
      chip('Missing', String(plan.missing.length), plan.missing.length ? 'pending' : 'go', 'plan')
    ].join('');
    const dots = { cardiac: st.c, pulmonary: LEVEL_CLS[p.level], renal: plan.renal.applicable ? 'warn' : '', endocrine: plan.dm ? (plan.dm.optimize ? 'stop' : 'warn') : '', plan: plan.missing.length ? 'pending' : 'go' };
    $$('[data-dot]').forEach(el => { el.className = 'dot ' + (dots[el.dataset.dot] || ''); });
  }

  // ---------- Navigation ----------
  function switchTab(id) {
    current = id;
    $$('.tab').forEach(t => { const on = t.dataset.tab === id; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
    $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + id));
    const i = TABS.findIndex(t => t.id === id);
    $('#btn-prev').disabled = i === 0;
    $('#btn-next').disabled = i === TABS.length - 1;
    try { localStorage.setItem('preop-tab', id); } catch (e) { /* storage unavailable */ }
  }
  const step = n => { const i = TABS.findIndex(t => t.id === current); const next = TABS[i + n]; if (next) { switchTab(next.id); window.scrollTo({ top: 0, behavior: 'smooth' }); } };

  // ---------- Export ----------
  function copyText() {
    const text = $('#plaintext').textContent;
    const done = ok => { $('#copy-status').textContent = ok ? 'Copied.' : 'Copy failed: select the text and copy manually.'; setTimeout(() => { $('#copy-status').textContent = ''; }, 3000); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(() => done(true), () => done(fallbackCopy(text)));
    else done(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }
  function downloadText() {
    const s = readState();
    const blob = new Blob([$('#plaintext').textContent], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `preop_${(s.hn || 'patient').replace(/[^\w-]/g, '')}_${s.surgeryDate || s.date || 'plan'}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // Teaching example: elderly woman with AF on apixaban, T2DM on insulin, CKD G3b, COPD, for right hemicolectomy
  const EXAMPLE = {
    name: 'Example patient', hn: 'DEMO-001', operation: 'Open right hemicolectomy (colon cancer)', age: 72, sex: 'F', weight: 58, height: 155,
    scr: 1.3, bun: 24, k: 4.2, hb: 10.5, albumin: 3.3, hba1c: 7.6, fpg: 150, spo2: 95,
    urgency: 'timeSensitive', surgRisk: 'intermediate', bleedRisk: 'high', stressGrade: 'g2', anesthesia: 'ga',
    site_intraperitoneal: true, longDuration: true, fluidShift: true,
    rf_age65: true, rf_ht: true, rf_dlp: true, rf_dm: true, af: true, hf: false,
    asa: '3', copd: true, copdStatus: 'controlled', smokeStatus: 'former', packYears: 30, cxrPft: 'normal',
    ckdStage: 'g3b', dialysis: 'none', dmType: 't2', dmInsulin: true,
    fc: 'lt4', lowFcOption: 'biomarker', biomarker: 'normal',
    anticoag: 'apixaban', drug_acei: true, opt_acei: 'ht', drug_ccb: true, drug_statin: true, drug_inhaledBronch: true,
    dm_metformin: true, insLong: 20
  };
  function loadExample() {
    resetAll(false);
    const d = new Date(); d.setDate(d.getDate() + 10);
    Object.entries(Object.assign({ surgeryDate: d.toISOString().slice(0, 10) }, EXAMPLE)).forEach(([k, v]) => setValue(k, v));
    render();
  }
  function resetAll(ask = true) {
    if (ask && !confirm('Clear all entries?')) return;
    $$('[data-key]').forEach(el => { if (el.type === 'checkbox' || el.type === 'radio') el.checked = false; else el.value = ''; });
    setValue('date', new Date().toISOString().slice(0, 10));
    render();
  }

  // ---------- Init ----------
  function init() {
    renderStatic();
    setValue('date', new Date().toISOString().slice(0, 10));
    const form = $('#form');
    const onChange = e => {
      const el = e.target;
      if (!el.dataset || !el.dataset.key) return;
      sync(el);
      if (el.dataset.key === 'age') {
        const age = parseFloat(el.value);
        if (Number.isFinite(age)) setValue('rf_age65', age > 65);
      }
      if (el.dataset.key === 'dmType') setValue('rf_dm', el.value === 't1' || el.value === 't2');
      if (el.dataset.key === 'smokeStatus') setValue('rf_smoking', el.value === 'current');
      render();
    };
    form.addEventListener('input', onChange);
    form.addEventListener('change', onChange);
    $('#tabs').addEventListener('click', e => { const t = e.target.closest('.tab'); if (t) switchTab(t.dataset.tab); });
    $('#statusbar').addEventListener('click', e => { const c = e.target.closest('[data-goto]'); if (c) switchTab(c.dataset.goto); });
    $('#btn-prev').addEventListener('click', () => step(-1));
    $('#btn-next').addEventListener('click', () => step(1));
    $('#btn-export').addEventListener('click', () => { switchTab('plan'); window.scrollTo({ top: 0 }); });
    $('#btn-copy').addEventListener('click', copyText);
    $('#btn-download').addEventListener('click', downloadText);
    $('#btn-print').addEventListener('click', () => { switchTab('plan'); window.print(); });
    $('#btn-reset').addEventListener('click', () => resetAll(true));
    $('#btn-example').addEventListener('click', loadExample);
    let start = 'patient';
    try { start = localStorage.getItem('preop-tab') || start; } catch (e) { /* storage unavailable */ }
    switchTab(TABS.some(t => t.id === start) ? start : 'patient');
    render();
  }

  init();
})();

(function () {
  const { data: D, rules: R } = window.PREOP;
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Builders ----------
  const choice = (type, name, value, label, extra = '') =>
    `<label class="choice"><input type="${type}" name="${name}" value="${esc(value)}"><span>${esc(label)}${extra}</span></label>`;

  function renderStatic() {
    $('#urgency-list').innerHTML = D.urgency.map(u => choice('radio', 'urgency', u.id, u.label)).join('');
    $('#active-list').innerHTML = D.activeCardiac.map(i => choice('checkbox', 'active', i.id, i.label)).join('');
    $('#riskmod-list').innerHTML = D.riskModifying.map(i => choice('checkbox', 'riskMod', i.id, i.label)).join('');
    $('#frailty-list').innerHTML = D.frailty.map(i => choice('checkbox', 'frailty', i.id, i.label)).join('');
    $('#clinical-list').innerHTML = D.clinicalRisk.map(i => choice('checkbox', 'clinical', i.id, i.label)).join('');

    $('#surgrisk-list').innerHTML = ['high', 'intermediate', 'low'].map(k => riskCard('surgicalRisk', k, D.surgicalRisk[k])).join('');
    $('#fc-list').innerHTML = D.functionalCapacity.map(f =>
      choice('radio', 'fc', f.id, f.label, `<small>${esc(f.examples)}</small>`)).join('');

    $('#bleeding-list').innerHTML = ['high', 'lowMod', 'minimal'].map(k => riskCard('bleeding', k, D.bleedingRisk[k])).join('');
    $('#ap-list').innerHTML = D.antiplatelets.map(a =>
      choice('checkbox', 'ap', a.id, a.name, `<small>stop ${a.stop[0] === a.stop[1] ? a.stop[0] : a.stop.join('–')} days before</small>`)).join('');
    $('#pci-list').innerHTML = D.pciStatus.map(p => choice('radio', 'pci', p.id, p.label)).join('');

    $('#ac-list').innerHTML = choice('radio', 'anticoag', 'none', 'None') +
      choice('radio', 'anticoag', 'warfarin', 'Warfarin') +
      D.doacs.map(d => choice('radio', 'anticoag', d.id, d.name)).join('');

    $('#thromb-list').innerHTML = Object.values(D.thromboticRisk).map(g => `
      <fieldset><legend>${esc(g.label)}</legend><div class="choices">
        ${g.items.map(i => choice('checkbox', 'thromb', i.id, i.label, ` <em class="lvl ${i.level}">${i.level}</em>`)).join('')}
      </div></fieldset>`).join('');
    $('#afscore-list').innerHTML = D.afScoreItems.map(i => choice('checkbox', 'afItem', i.id, i.label)).join('');

    $('#drug-groups').innerHTML = D.drugGroups.map(g => `
      <details class="card med">
        <summary><h3>${esc(g.title)}</h3><span class="pill" data-count="${g.id}"></span></summary>
        <div class="drug-list">${g.items.map(drugItem).join('')}</div>
      </details>`).join('');

    $('#dm-list').innerHTML = D.dmDrugs.map(d => choice('checkbox', 'dmDrug', d.id, d.name)).join('');
    $('#stress-list').innerHTML = D.surgicalStress.map(s => choice('radio', 'stressGrade', s.id, s.label, `<small>${esc(s.desc)}</small>`)).join('');
  }

  function riskCard(name, key, def) {
    return `<label class="risk-card ${key}">
      <span class="risk-head"><input type="radio" name="${name}" value="${key}"><b>${esc(def.label)}</b></span>
      ${def.note ? `<small>${esc(def.note)}</small>` : ''}
      <ul>${def.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
    </label>`;
  }

  function drugItem(item) {
    const opts = item.options
      ? `<div class="drug-opts" hidden>${item.options.map(o => choice('radio', 'opt-' + item.id, o.id, o.label)).join('')}</div>`
      : '';
    return `<div class="drug" data-drug="${item.id}">
      ${choice('checkbox', 'drug', item.id, item.name)}
      ${opts}
      <p class="drug-rec" hidden></p>
    </div>`;
  }

  // ---------- State ----------
  const radio = name => ($(`input[name="${name}"]:checked`) || {}).value || null;
  const checks = name => Object.fromEntries($$(`input[name="${name}"]:checked`).map(i => [i.value, true]));
  const num = id => { const v = parseFloat($(id).value); return Number.isFinite(v) ? v : null; };

  function readState() {
    const patient = {
      name: $('#p-name').value.trim(), hn: $('#p-hn').value.trim(), assessor: $('#p-assessor').value.trim(),
      date: $('#p-date').value, surgeryDate: $('#p-surgery-date').value, operation: $('#p-operation').value.trim(),
      age: num('#p-age'), sex: $('#p-sex').value, weight: num('#p-weight'), scr: num('#p-scr')
    };
    const manual = num('#p-crcl-manual');
    patient.crclCalc = R.cockcroftGault(patient);
    patient.crcl = manual != null ? manual : patient.crclCalc;
    patient.crclManual = manual != null;

    const up = radio('urgentPrep');
    return {
      patient,
      cardiac: {
        urgency: radio('urgency'),
        urgentNeedsPrep: up == null ? null : up === 'yes',
        active: checks('active'), riskMod: checks('riskMod'), frailty: checks('frailty'), clinical: checks('clinical'),
        surgicalRisk: radio('surgicalRisk'), fc: radio('fc'), lowFcOption: radio('lowFcOption'), biomarker: radio('biomarker')
      },
      bleeding: radio('bleeding'),
      ap: checks('ap'), pci: radio('pci'),
      anticoag: radio('anticoag'),
      thromb: checks('thromb'), afPresent: $('#af-present').checked, afItems: checks('afItem'),
      drugs: checks('drug'),
      drugOpts: Object.fromEntries(D.drugGroups.flatMap(g => g.items).filter(i => i.options).map(i => [i.id, radio('opt-' + i.id)])),
      dmOn: $('#dm-on').checked, hba1c: num('#dm-hba1c'), dmDrugs: checks('dmDrug'),
      steroidOn: $('#steroid-on').checked, stressGrade: radio('stressGrade')
    };
  }

  // ---------- Plan ----------
  function buildPlan(s) {
    const p = s.patient;
    const plan = { consults: [] };
    plan.cardiac = R.cardiacRisk(s.cardiac);
    if (plan.cardiac.status === 'consultCardio') plan.consults.push('Cardiology (cardiac risk pathway)');
    if (plan.cardiac.status === 'consultMed') plan.consults.push('Internal Medicine or Cardiology (cardiac risk pathway)');

    plan.antiplatelet = R.antiplateletPlan({ drugs: s.ap, pci: s.pci, bleeding: s.bleeding }, D.antiplatelets, p.surgeryDate);
    if (plan.antiplatelet && plan.antiplatelet.action === 'consult') plan.consults.push('Cardiology (antiplatelet after recent PCI)');

    plan.af = { present: s.afPresent, chads: R.chads2(s.afItems, p.age || 0), vasc: R.cha2ds2vasc(s.afItems, p.age || 0, p.sex) };
    plan.thrombotic = R.thromboticRisk(s.thromb, D.thromboticRisk, s.afPresent ? plan.af : null);

    if (s.anticoag === 'warfarin') {
      plan.warfarin = R.warfarinPlan({ bleeding: s.bleeding, thrombotic: plan.thrombotic.level });
      if (plan.warfarin.status === 'bridge') plan.bridgeDose = R.bridgingDose({ weight: p.weight, crcl: p.crcl }, D.bemiparin);
    } else if (s.anticoag && s.anticoag !== 'none') {
      const doac = D.doacs.find(d => d.id === s.anticoag);
      plan.doac = { name: doac.name, ...(R.doacSchedule({ drug: doac.group === 'dabigatran' ? 'dabigatran' : doac.id, crcl: p.crcl, bleeding: s.bleeding }) || { incomplete: true, notes: ['Select the procedural bleeding risk (Table 1).'] }) };
      if (plan.doac.notes.some(n => /Hematology/.test(n))) plan.consults.push('Hematology (DOAC with renal impairment)');
    }

    plan.drugs = [];
    for (const g of D.drugGroups) {
      for (const item of g.items) {
        if (!s.drugs[item.id]) continue;
        let rec, flag = item.flag;
        if (item.options) {
          const o = item.options.find(x => x.id === s.drugOpts[item.id]);
          rec = o ? `${o.label}: ${o.rec}` : 'Select the indication / clinical status.';
          flag = o && o.flag;
        } else rec = item.rec;
        let dates = null;
        if (item.stop) dates = R.stopWindow(item.stop, p.surgeryDate).dates;
        plan.drugs.push({ group: g.title, id: item.id, name: item.name, rec, dates });
        if (flag === 'consult') plan.consults.push(`${item.name}: ${/psychiatry/i.test(rec) ? 'Psychiatry' : 'Internal Medicine'}`);
      }
    }

    if (s.dmOn) {
      plan.dm = R.dmPlan({ hba1c: s.hba1c, urgency: s.cardiac.urgency, drugs: s.dmDrugs }, D.dmDrugs);
      plan.dm.drugs.forEach(d => { if (d.stop) d.dates = R.stopWindow(d.stop, p.surgeryDate).dates; });
      if (plan.dm.consult) plan.consults.push('Internal Medicine (optimize HbA1c ≤ 8% before elective surgery)');
    }
    if (s.steroidOn) plan.steroid = R.steroidPlan(s.stressGrade);
    return plan;
  }

  // ---------- Calendar ----------
  function calendar(from, to, rows, surgeryDate) {
    const days = [];
    for (let d = from; d <= to; d++) days.push(d);
    const head = days.map(d => `<th class="${d === 0 ? 'd0' : ''}">${R.dayLabel(d)}${surgeryDate ? `<br><small>${esc(R.formatDate(R.addDays(surgeryDate, d)).replace(/ \d{4}$/, ''))}</small>` : ''}</th>`).join('');
    const body = rows.map(r => `<tr><th scope="row">${esc(r.label)}</th>${days.map(d => {
      const c = r.cell(d);
      return `<td class="${c.cls}${d === 0 ? ' d0' : ''}">${esc(c.text)}</td>`;
    }).join('')}</tr>`).join('');
    return `<div class="cal-wrap"><table class="cal"><thead><tr><th></th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function doacCalendar(doac, surgeryDate) {
    return calendar(-5, 3, [{
      label: doac.name,
      cell: d => d <= doac.lastDose ? { text: 'Dose', cls: 'on' }
        : d >= doac.resume ? { text: 'Dose', cls: 'on' } : { text: 'Hold', cls: 'off' }
    }], surgeryDate);
  }

  function warfarinCalendar(w, surgeryDate) {
    const rows = [{
      label: 'Warfarin',
      cell: d => d <= w.warfarinLast || d >= w.warfarinResume ? { text: 'Give', cls: 'on' } : { text: 'Hold', cls: 'off' }
    }];
    if (w.status === 'bridge') rows.push({
      label: 'Heparin',
      cell: d => w.heparinDays.includes(d) ? { text: d === -1 ? 'Last*' : 'Give', cls: 'hep' }
        : d >= w.heparinResume ? { text: 'Give', cls: 'hep' } : d > -4 ? { text: 'Hold', cls: 'off' } : { text: '–', cls: '' }
    });
    return calendar(-6, 4, rows, surgeryDate);
  }

  // ---------- Render ----------
  const STATUS = {
    incomplete: { cls: 'pending', label: 'In progress' },
    proceedNow: { cls: 'go', label: 'Proceed' },
    proceed: { cls: 'go', label: 'Proceed' },
    consultMed: { cls: 'warn', label: 'Consult' },
    consultCardio: { cls: 'stop', label: 'Consult' }
  };

  function cardiacHTML(c, full) {
    const st = STATUS[c.status];
    return `<div class="verdict ${st.cls}"><span class="tag">${st.label}</span><p>${esc(c.title)}</p></div>
      ${c.detail.length ? `<ul class="detail">${c.detail.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
      ${c.trail.length ? `<${full ? 'p' : 'ol'} class="trail">${full ? c.trail.map(esc).join(' → ') : c.trail.map(t => `<li>${esc(t)}</li>`).join('')}</${full ? 'p' : 'ol'}>` : ''}`;
  }

  function anticoagHTML(plan, s) {
    const sd = s.patient.surgeryDate;
    if (plan.doac) {
      const d = plan.doac;
      if (d.incomplete) return notes(d.notes);
      const lines = [`Last dose ${R.dayLabel(d.lastDose)}${sd ? ` (${R.formatDate(R.addDays(sd, d.lastDose))})` : ''}; resume ${R.dayLabel(d.resume)}${sd ? ` (${R.formatDate(R.addDays(sd, d.resume))})` : ''}.`];
      return `<p><b>${esc(d.name)}</b>${s.patient.crcl != null ? ` · CrCl ${s.patient.crcl} mL/min` : ''}</p>${notes(lines.concat(d.notes))}${doacCalendar(d, sd)}`;
    }
    if (plan.warfarin) {
      const w = plan.warfarin;
      let html = `<p><b>Warfarin</b>${plan.thrombotic.level ? ` · thrombotic risk <em class="lvl ${plan.thrombotic.level}">${plan.thrombotic.level}</em>` : ''}</p>${notes(w.notes)}`;
      if (w.status === 'stop' || w.status === 'bridge') html += warfarinCalendar(w, sd);
      if (w.status === 'bridge') {
        html += plan.bridgeDose
          ? notes([plan.bridgeDose.enoxaparin, plan.bridgeDose.bemiparin, plan.bridgeDose.note])
          : notes(['Enter body weight and creatinine to calculate the LMWH dose.']);
        html += '<p class="hint">* Last heparin dose on D-1: see note on LMWH timing above.</p>';
      }
      return html;
    }
    return '';
  }

  const notes = arr => `<ul class="notes">${arr.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`;

  function render() {
    const s = readState();
    const p = s.patient;
    const plan = buildPlan(s);

    $('#crcl-out').textContent = p.crcl != null ? `${p.crcl} mL/min${p.crclManual ? ' (manual)' : ''}` : '–';

    // Cardiac tab
    const c = s.cardiac;
    $('#urgent-prep').hidden = c.urgency !== 'urgent';
    $('#lowfc-block').hidden = c.fc !== 'lt4';
    $('#biomarker-block').hidden = c.lowFcOption !== 'biomarker';
    $('#fc-block').hidden = c.surgicalRisk === 'low';
    $('#frailty-score').textContent = `${R.frailtyScore(c.frailty)}/5`;
    $$('.step').forEach(el => el.classList.toggle('inactive', !plan.cardiac.reached.has(+el.dataset.step)));
    $('#cardiac-result').innerHTML = `<h3>Result</h3>${cardiacHTML(plan.cardiac)}`;

    // Bleeding
    const bl = s.bleeding ? D.bleedingRisk[s.bleeding].label : 'not set';
    $('#bleed-pill').textContent = bl;
    $('#bleed-pill').className = 'pill ' + (s.bleeding || '');

    // Antiplatelet
    const ap = plan.antiplatelet;
    $('#ap-out').innerHTML = ap ? `<p class="out-sum ${ap.action}">${esc(ap.summary)}</p>${ap.drugs.length ? notes(ap.drugs.map(d => `${d.name}: ${d.rec}${d.dates ? ' ' + d.dates + '.' : ''}`)) : ''}` : '';

    // Anticoagulant
    $('#thromb-block').hidden = s.anticoag !== 'warfarin';
    $('#chads-out').textContent = s.afPresent ? plan.af.chads : '–';
    $('#vasc-out').textContent = s.afPresent ? plan.af.vasc : '–';
    $('#aflevel-out').textContent = s.afPresent ? R.afLevel(plan.af.chads, plan.af.vasc) : '–';
    $('#ac-out').innerHTML = anticoagHTML(plan, s);

    // Generic drug groups
    for (const g of D.drugGroups) {
      let n = 0;
      for (const item of g.items) {
        const el = $(`.drug[data-drug="${item.id}"]`);
        const on = !!s.drugs[item.id];
        if (on) n++;
        const opts = $('.drug-opts', el);
        if (opts) opts.hidden = !on;
        const rec = $('.drug-rec', el);
        const pd = plan.drugs.find(d => d.id === item.id);
        rec.hidden = !on;
        rec.textContent = pd ? pd.rec + (pd.dates ? ` ${pd.dates}.` : '') : '';
      }
      const pill = $(`[data-count="${g.id}"]`);
      pill.textContent = n ? `${n} selected` : '';
    }

    // DM / steroid
    $('#dm-block').hidden = !s.dmOn;
    $('#dm-out').innerHTML = plan.dm ? notes(plan.dm.notes.concat(plan.dm.drugs.map(d => `${d.name}: ${d.rec}${d.dates ? ' ' + d.dates + '.' : ''}`))) : '';
    $('#steroid-block').hidden = !s.steroidOn;
    $('#steroid-out').innerHTML = plan.steroid ? notes(plan.steroid) : (s.steroidOn ? notes(['Select the surgical stress grade.']) : '');

    $('#summary').innerHTML = summaryHTML(s, plan);
  }

  function summaryHTML(s, plan) {
    const p = s.patient;
    const row = (k, v) => v ? `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>` : '';
    const sections = [];

    sections.push(`<section><h3>Cardiac risk assessment</h3>${cardiacHTML(plan.cardiac, true)}</section>`);

    const med = [];
    if (s.bleeding) med.push(`<p>Procedural bleeding risk: <b>${esc(D.bleedingRisk[s.bleeding].label)}</b></p>`);
    if (plan.antiplatelet) med.push(`<h4>Antiplatelet</h4><p>${esc(plan.antiplatelet.summary)}</p>${plan.antiplatelet.drugs.length ? notes(plan.antiplatelet.drugs.map(d => `${d.name}: ${d.rec}${d.dates ? ' ' + d.dates + '.' : ''}`)) : ''}`);
    const ac = anticoagHTML(plan, s);
    if (ac) med.push(`<h4>Anticoagulant</h4>${ac}`);
    if (plan.drugs.length) {
      const byGroup = {};
      plan.drugs.forEach(d => (byGroup[d.group] = byGroup[d.group] || []).push(d));
      med.push(Object.entries(byGroup).map(([g, ds]) => `<h4>${esc(g.replace(/^[\d.]+\s*/, ''))}</h4>${notes(ds.map(d => `${d.name}: ${d.rec}${d.dates ? ' ' + d.dates + '.' : ''}`))}`).join(''));
    }
    if (plan.dm) med.push(`<h4>Diabetes${s.hba1c != null ? ` (HbA1c ${s.hba1c}%)` : ''}</h4>${notes(plan.dm.notes.concat(plan.dm.drugs.map(d => `${d.name}: ${d.rec}${d.dates ? ' ' + d.dates + '.' : ''}`)))}`);
    if (s.steroidOn) med.push(`<h4>Glucocorticoid (adrenal insufficiency)</h4>${notes(plan.steroid || ['Surgical stress grade not selected.'])}`);
    sections.push(`<section><h3>Perioperative medication plan</h3>${med.length ? med.join('') : '<p class="hint">No medications selected.</p>'}</section>`);

    const consults = [...new Set(plan.consults)];
    if (consults.length) sections.push(`<section class="consults"><h3>Consultations</h3>${notes(consults)}</section>`);

    return `<header class="sum-head"><h2>Pre-operative assessment and plan</h2>
      <dl class="pt-dl">${row('Name', p.name)}${row('HN', p.hn)}${row('Operation', p.operation)}
        ${row('Surgery date', p.surgeryDate && R.formatDate(p.surgeryDate))}${row('Age / sex', [p.age, p.sex].filter(Boolean).join(' / '))}
        ${row('Weight', p.weight && p.weight + ' kg')}${row('CrCl', p.crcl != null && p.crcl + ' mL/min')}
        ${row('Assessor', p.assessor)}${row('Assessment date', p.date && R.formatDate(p.date))}</dl></header>
      ${sections.join('')}
      <section class="refs"><h3>References</h3><ol>${D.references.map(r => `<li>${esc(r)}</li>`).join('')}</ol></section>`;
  }

  // ---------- Events ----------
  function switchTab(name) {
    $$('.tab').forEach(t => { const on = t.dataset.tab === name; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
    $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  }

  function init() {
    renderStatic();
    $('#p-date').value = new Date().toISOString().slice(0, 10);

    $('#form').addEventListener('input', e => {
      // Age feeds Step 3 automatically; the user can still untick it.
      if (e.target.id === 'p-age') {
        const age = parseFloat(e.target.value);
        const box = $('input[name="clinical"][value="age65"]');
        if (Number.isFinite(age)) box.checked = age > 65;
      }
      // Clearing a parent choice clears dependent answers.
      if (e.target.name === 'fc' && e.target.value !== 'lt4') clearRadios(['lowFcOption', 'biomarker']);
      if (e.target.name === 'lowFcOption' && e.target.value !== 'biomarker') clearRadios(['biomarker']);
      if (e.target.name === 'urgency' && e.target.value !== 'urgent') clearRadios(['urgentPrep']);
      render();
    });
    $$('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));
    $('#btn-print').addEventListener('click', () => { switchTab('summary'); render(); window.print(); });
    $('#btn-reset').addEventListener('click', () => {
      if (!confirm('Clear all entries?')) return;
      $$('#form input').forEach(i => { if (i.type === 'checkbox' || i.type === 'radio') i.checked = false; else i.value = ''; });
      $('#p-sex').value = '';
      $('#p-date').value = new Date().toISOString().slice(0, 10);
      render();
    });
    render();
  }

  function clearRadios(names) {
    names.forEach(n => $$(`input[name="${n}"]`).forEach(i => { i.checked = false; }));
  }

  init();
})();

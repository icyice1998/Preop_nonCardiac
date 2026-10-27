// Static content. Sources: institutional pre-op protocol (rev. 26 Dec 2024); 2022 ESC NCS guideline;
// 2024 AHA/ACC perioperative guideline; ADA Standards 2026 (perioperative DM); CHEST 2022 antithrombotic;
// ADQI/KDIGO peri-operative AKI; ACR contrast manual 2024; departmental lectures (Phramongkutklao 2026).
(function (root) {
  const data = {};

  // Field helper: k = state key (unique; the same key may be rendered in several tabs and stays in sync)
  // t: cb | radio | num | text | date | select
  const F = (k, label, t = 'cb', extra = {}) => Object.assign({ k, label, t }, extra);
  const opt = (v, l, hint) => ({ v, l, hint });

  // ---------- Patient & labs ----------
  data.patientFields = [
    F('hn', 'HN (optional)', 'text'), F('operation', 'Planned operation', 'text'),
    F('age', 'Age', 'num', { unit: 'y', min: 0, max: 120 }),
    F('sex', 'Sex', 'select', { opts: [opt('M', 'Male'), opt('F', 'Female')] }),
    F('weight', 'Weight', 'num', { unit: 'kg', step: 0.1 }),
    F('height', 'Height', 'num', { unit: 'cm' })
  ];
  data.labFields = [
    F('scr', 'Creatinine', 'num', { unit: 'mg/dL', step: 0.01 }),
    F('crclManual', 'CrCl override', 'num', { unit: 'mL/min', placeholder: 'optional' }),
    F('bun', 'BUN', 'num', { unit: 'mg/dL' }),
    F('k', 'Potassium', 'num', { unit: 'mmol/L', step: 0.1 }),
    F('hb', 'Hemoglobin', 'num', { unit: 'g/dL', step: 0.1 }),
    F('albumin', 'Albumin', 'num', { unit: 'g/dL', step: 0.1 }),
    F('hba1c', 'HbA1c', 'num', { unit: '%', step: 0.1 }),
    F('fpg', 'Fasting glucose', 'num', { unit: 'mg/dL' }),
    F('spo2', 'SpO₂ room air', 'num', { unit: '%' })
  ];

  // ---------- Surgery ----------
  data.urgency = [
    opt('emergency', 'Emergency', 'Immediate threat to life or limb; < 2 h'),
    opt('urgent', 'Urgent', 'Threat to life or limb; 2–24 h'),
    opt('timeSensitive', 'Time-sensitive', 'Can be delayed up to 3 months (e.g. cancer)'),
    opt('elective', 'Elective', 'Can be delayed for complete evaluation')
  ];

  // What each surgical category means for the work-up (shown in Step 1 explanations)
  data.urgencyMeaning = {
    emergency: 'No time for evaluation: operate now; no test may delay surgery; manage peri-operatively (monitoring, reversal of anticoagulant if needed).',
    urgent: 'Hours available (2–24 h): treat only reversible problems (ACS, arrhythmia, decompensated HF, anticoagulant); no elective testing.',
    timeSensitive: 'Up to 3 months: multidisciplinary, individualized testing; optimize what is possible without losing the surgical window.',
    elective: 'Complete evaluation and optimization; defer surgery for active cardiac conditions, recent PCI, or uncontrolled disease.'
  };
  data.surgRiskMeaning = {
    low: 'Low risk (< 1% 30-day CV death/MI/stroke): no pre-op cardiac testing regardless of patient risk.',
    intermediate: 'Intermediate risk (1–5%): ECG + biomarkers if age ≥ 65, CV risk factors or established CVD; assess functional capacity.',
    high: 'High risk (> 5%): as intermediate, plus cardiology consultation if established CVD; stress imaging if poor functional capacity and CAD likely.'
  };
  data.bleedMeaning = {
    minimal: 'Minimal bleeding: continue warfarin; DOAC hold only on the day of surgery; antiplatelets usually continued.',
    lowMod: 'Low/moderate bleeding: short DOAC interruption (≈ 1 day); warfarin stopped 5 days; DAPT may continue (ESC).',
    high: 'High bleeding: longer DOAC interruption (≈ 2 days), stop warfarin 5 days, interrupt P2Y12 inhibitor; aspirin stop 7 days for intracranial/spinal/vitreoretinal surgery.'
  };
  data.stressMeaning = {
    g1: 'Grade I: no steroid supplementation beyond usual dose.',
    g2: 'Grade II: hydrocortisone 25–50 mg at induction then 25 mg q 6 h.',
    g3: 'Grade III: hydrocortisone 50–100 mg at induction then 25–50 mg q 6 h.'
  };

  data.surgicalRisk = {
    high: {
      label: 'High surgical risk (> 5%)',
      items: [
        'Adrenal resection', 'Aortic and major vascular surgery', 'Carotid symptomatic (CAS)',
        'Duodeno-pancreatic surgery', 'Liver resection, bile duct surgery', 'Esophagectomy',
        'Open lower limb revascularization for acute limb ischemia or amputation',
        'Pneumonectomy (VATS or open)', 'Pulmonary or liver transplant',
        'Repair of perforated bowel', 'Total cystectomy'
      ]
    },
    intermediate: {
      label: 'Intermediate surgical risk (1–5%)',
      items: [
        'Carotid asymptomatic (CEA or CAS)', 'Carotid symptomatic (CEA)', 'Endovascular aortic aneurysm repair',
        'Head or neck surgery', 'Intraperitoneal: splenectomy, hiatal hernia repair, cholecystectomy',
        'Intrathoracic: non-major', 'Neurological or orthopedic: major (hip and spine)',
        'Peripheral arterial angioplasty', 'Renal transplant', 'Urological or gynecological: major'
      ]
    },
    low: {
      label: 'Low surgical risk (< 1%)',
      items: [
        'Breast', 'Dental', 'Endocrine: thyroid', 'Eye', 'Gynecological: minor',
        'Orthopedic: minor (meniscectomy)', 'Reconstructive', 'Superficial surgery',
        'Urological: minor (TURP)', 'VATS minor lung resection'
      ]
    }
  };

  data.bleedingRisk = {
    high: {
      label: 'High bleeding risk',
      note: '30-day major bleeding > 2%',
      items: [
        'Any major operation > 45 min', 'Abdominal aortic aneurysm repair', 'Coronary artery bypass',
        'Endoscopic FNA', 'Foot/hand/shoulder surgery', 'Heart valve replacement', 'Hip / knee replacement',
        'Kidney biopsy', 'Laminectomy, spinal or intracranial surgery', 'Multiple tooth extractions',
        'Neurosurgical/urologic/head-neck/abdominal/breast cancer surgery',
        'Polypectomy, variceal treatment, biliary sphincterotomy, pneumatic dilatation, PEG, ERCP',
        'TURP', 'Vascular and general surgery', 'Neuraxial anesthesia or epidural injection'
      ]
    },
    lowMod: {
      label: 'Low/moderate bleeding risk',
      note: '30-day major bleeding 0–2%',
      items: [
        'Abdominal hernia repair', 'Abdominal hysterectomy', 'Arthroscopy < 45 min', 'Axillary node dissection',
        'Bronchoscopy ± biopsy', 'Carpal tunnel decompression', 'Cataract and non-cataract eye surgery',
        'CVC removal', 'Cholecystectomy', 'Complex dental surgery', 'Cutaneous / lymph node / organ biopsies',
        'D&C', 'GI endoscopy ± biopsy, stent without sphincterotomy, EUS without FNA', 'Hemorrhoidal surgery',
        'Hydrocele repair', 'Non-coronary angiography', 'Pacemaker / ICD insertion, EP study',
        'Paracentesis, thoracentesis', 'Skin cancer excision', 'Tooth extraction (single)'
      ]
    },
    minimal: {
      label: 'Minimal bleeding risk',
      note: '30-day major bleeding ≈ 0%',
      items: ['Minor dermatological procedure', 'Minor dental procedure (cleaning, filling)', 'Cataract (selected)']
    }
  };

  data.surgicalStress = [
    opt('g1', 'Grade I (minor)', 'Blood loss < 500 mL: skin, inguinal hernia, breast biopsy, endoscopy, minor gyne/ENT, local anesthesia'),
    opt('g2', 'Grade II (moderate)', 'Blood loss 500–1,500 mL: cystectomy, nephrectomy, hysterectomy, GI resection, cholecystectomy, joint replacement, thyroidectomy'),
    opt('g3', 'Grade III (major)', 'Blood loss > 1,500 mL, usual post-op ICU: major spine/oropharyngeal/GU reconstruction, intracranial, major vascular, cardiothoracic')
  ];

  data.surgeryDetailFields = [
    F('anesthesia', 'Anesthesia', 'radio', { opts: [opt('ga', 'General'), opt('neuraxial', 'Spinal / epidural'), opt('regional', 'Peripheral nerve block'), opt('local', 'Local ± sedation')] }),
    F('site_upperAbd', 'Upper abdominal surgery'),
    F('site_intraperitoneal', 'Other intraperitoneal surgery'),
    F('site_thoracic', 'Intrathoracic (non-cardiac) surgery'),
    F('site_aortic', 'Aortic / suprainguinal vascular surgery'),
    F('site_lungResection', 'Lung resection (lobectomy / pneumonectomy)'),
    F('site_neuro', 'Neurosurgery'),
    F('site_headNeck', 'Head and neck surgery'),
    F('site_closedSpace', 'Intracranial / spinal neurosurgery or vitreoretinal eye surgery (closed space)'),
    F('site_dental', 'Oro-dental procedure manipulating gingiva / periapical region'),
    F('site_openGI', 'Opens GI tract / delayed abdominal closure / intraperitoneal mesh'),
    F('longDuration', 'Expected duration > 3 hours'),
    F('fluidShift', 'Anticipated hemodynamic change or large fluid/temperature shift'),
    F('eatingSoon', 'Expected to eat soon after surgery'),
    F('contrastPlanned', 'Iodinated contrast planned (CT / angiography)'),
    F('gadoliniumPlanned', 'Gadolinium (MRI) contrast planned')
  ];

  // ---------- Questionnaire ----------
  data.activeCardiac = [
    F('ac_recentMI', 'Recent MI ≤ 14 days / ACS'),
    F('ac_chf', 'Decompensated HF / NYHA class III–IV'),
    F('ac_symVHD', 'Symptomatic VHD or new murmur'),
    F('ac_arrhythmia', 'Unstable arrhythmia: AF with RVR, high-grade AV block, malignant VA'),
    F('ac_ecgIschemia', 'ECG with infarction or ischemic pattern')
  ];
  data.riskModifying = [
    F('rm_asxVHD', 'Asymptomatic VHD (AS, MS, AR, MR)'),
    F('rm_severePH', 'Severe pulmonary hypertension'),
    F('rm_chd', 'Congenital heart disease'),
    F('rm_recentStroke', 'Recent stroke or TIA ≤ 3 months'),
    F('rm_cied', 'Cardiac implantable electronic device')
  ];
  data.frailty = [
    F('fr_slowness', 'Slowness'), F('fr_lowActivity', 'Low activity'), F('fr_weakness', 'Weakness'),
    F('fr_weightLoss', 'Weight loss'), F('fr_exhaustion', 'Exhaustion')
  ];
  data.clinicalRisk = [
    F('rf_age65', 'Age > 65 years'), F('rf_ht', 'Hypertension'), F('rf_dlp', 'Dyslipidemia'),
    F('rf_dm', 'Diabetes mellitus'), F('rf_smoking', 'Smoking'), F('rf_fhx', 'Family history of premature CAD')
  ];

  data.questionnaire = [
    {
      id: 'q-cv', title: 'Cardiovascular history', fields: [
        F('ihd', 'Ischemic heart disease / prior MI / angina'),
        F('priorPci', 'Prior PCI'),
        F('pciType', 'Type of PCI', 'radio', { show: 'priorPci', opts: [opt('balloon', 'Balloon only'), opt('bms', 'BMS'), opt('des', 'DES')] }),
        F('pciIndication', 'Indication', 'radio', { show: 'priorPci', opts: [opt('acs', 'ACS'), opt('ccs', 'Chronic coronary disease')] }),
        F('pciMonths', 'Months since PCI', 'num', { show: 'priorPci', step: 0.5 }),
        F('cabg', 'Prior CABG'),
        F('hf', 'History of heart failure'),
        F('lvef', 'LVEF (if known)', 'num', { unit: '%' }),
        F('cvd', 'Stroke or TIA (any time)'),
        F('pad', 'Peripheral arterial disease'),
        F('af', 'Atrial fibrillation / flutter'),
        F('cardiomyopathy', 'Cardiomyopathy'),
        F('mechValve', 'Mechanical heart valve'),
        F('ieHighRisk', 'IE high risk: prior IE, prosthetic valve/material, VAD, cyanotic or repaired CHD with residual shunt/prosthesis')
      ]
    },
    {
      id: 'q-active', title: 'Active cardiac condition (institutional Step 2)', fields: data.activeCardiac
    },
    {
      id: 'q-rm', title: 'Risk-modifying disease (institutional Step 2)', fields: data.riskModifying.concat([
        F('vhd_AS', 'Severe AS, symptomatic', 'cb', { showAny: ['rm_asxVHD', 'ac_symVHD'] }),
        F('vhd_ASasx', 'Severe AS, asymptomatic', 'cb', { showAny: ['rm_asxVHD', 'ac_symVHD'] }),
        F('avrCandidate', 'Candidate for AVR (TAVI / SAVR)', 'radio', { showAny: ['vhd_AS', 'vhd_ASasx'], opts: [opt('yes', 'Yes'), opt('no', 'No')] }),
        F('vhd_AR', 'Severe AR: symptomatic, or LVESD > 50 mm / LVEF ≤ 50%', 'cb', { showAny: ['rm_asxVHD', 'ac_symVHD'] }),
        F('vhd_MS', 'Moderate–severe rheumatic MS with symptoms or SPAP > 50 mmHg', 'cb', { showAny: ['rm_asxVHD', 'ac_symVHD'] }),
        F('vhd_MR', 'Severe primary MR: symptomatic, or LVESD ≥ 40 mm / LVEF ≤ 60%', 'cb', { showAny: ['rm_asxVHD', 'ac_symVHD'] }),
        F('vhd_regurgAsx', 'Moderate–severe MR/AR, asymptomatic, normal LV function (PASP < 50)', 'cb', { showAny: ['rm_asxVHD', 'ac_symVHD'] }),
        F('ciedType', 'Device', 'radio', { show: 'rm_cied', opts: [opt('pm', 'Pacemaker'), opt('icd', 'ICD / CRT-D'), opt('crtp', 'CRT-P')] }),
        F('ciedDependent', 'Pacemaker-dependent', 'cb', { show: 'rm_cied' }),
        F('emiAbove', 'Electrocautery (EMI) above the umbilicus', 'cb', { show: 'rm_cied' })
      ])
    },
    { id: 'q-frailty', title: 'Physical frailty phenotype (1 point each)', fields: data.frailty, inline: true },
    { id: 'q-rf', title: 'Clinical risk factors (institutional Step 3)', fields: data.clinicalRisk, cols: 3 },
    {
      id: 'q-sx', title: 'Current symptoms and family history', fields: [
        F('sx_chestPain', 'Chest pain suggestive of CAD'),
        F('sx_dyspnea', 'Dyspnea'),
        F('sx_edema', 'Peripheral edema'),
        F('sx_newMurmur', 'Newly detected murmur'),
        F('sx_syncope', 'Syncope / palpitation'),
        F('fhxCardiomyopathy', 'Family history of genetic cardiomyopathy')
      ]
    },
    {
      id: 'q-pulm', title: 'Pulmonary', fields: [
        F('asa', 'ASA physical status', 'radio', { opts: [opt('1', 'I'), opt('2', 'II'), opt('3', 'III'), opt('4', 'IV'), opt('5', 'V')] }),
        F('copd', 'COPD'),
        F('copdStatus', 'COPD control', 'radio', { show: 'copd', opts: [opt('controlled', 'Controlled, no wheeze'), opt('uncontrolled', 'Uncontrolled / wheezing / recent exacerbation')] }),
        F('asthma', 'Asthma'),
        F('asthmaStatus', 'Asthma control', 'radio', { show: 'asthma', opts: [opt('controlled', 'Controlled'), opt('uncontrolled', 'Uncontrolled / active wheeze')] }),
        F('smokeStatus', 'Smoking', 'radio', { opts: [opt('never', 'Never'), opt('former', 'Former (quit > 8 weeks)'), opt('current', 'Current or quit ≤ 8 weeks')] }),
        F('packYears', 'Pack-years', 'num', { showAny: ['smokeStatus=current', 'smokeStatus=former'] }),
        F('osa', 'Obstructive sleep apnea (known)'),
        F('osaSuspected', 'Suspected severe OSA / hypoventilation not on PAP'),
        F('pulmHT', 'Pulmonary hypertension'),
        F('uri', 'Current respiratory tract infection'),
        F('unexplainedDyspnea', 'Unexplained dyspnea or exercise intolerance'),
        F('chronicCough', 'Chronic cough / active wheeze'),
        F('abnChestExam', 'Abnormal chest examination'),
        F('dependence', 'Functional dependence (partial or total)'),
        F('sensorium', 'Impaired sensorium (acute confusion / delirium)'),
        F('cxrPft', 'CXR / spirometry', 'radio', { opts: [opt('notDone', 'Not done'), opt('normal', 'Normal'), opt('abnormal', 'Abnormal')] })
      ]
    },
    {
      id: 'q-renal', title: 'Kidney', fields: [
        F('ckdStage', 'CKD stage', 'radio', { opts: [opt('none', 'None / G1–2'), opt('g3a', 'G3a'), opt('g3b', 'G3b'), opt('g4', 'G4'), opt('g5', 'G5')] }),
        F('dialysis', 'Dialysis', 'radio', { opts: [opt('none', 'None'), opt('hd', 'Hemodialysis'), opt('pd', 'Peritoneal dialysis')] }),
        F('aki', 'Current AKI'),
        F('oliguria', 'Oliguric AKI', 'cb', { show: 'aki' }),
        F('nephrotoxins', 'Concurrent nephrotoxins (NSAIDs, aminoglycosides, etc.)'),
        F('volumeDepleted', 'Volume depletion')
      ]
    },
    {
      id: 'q-endo', title: 'Endocrine', fields: [
        F('dmType', 'Diabetes', 'radio', { opts: [opt('none', 'None'), opt('t1', 'Type 1'), opt('t2', 'Type 2')] }),
        F('dmInsulin', 'Insulin-treated', 'cb', { showAny: ['dmType=t1', 'dmType=t2'] }),
        F('hypoHx', 'History of hypoglycemia', 'cb', { showAny: ['dmType=t1', 'dmType=t2'] }),
        F('gastroparesis', 'Autonomic neuropathy / gastroparesis', 'cb', { showAny: ['dmType=t1', 'dmType=t2'] }),
        F('labileT1', 'Labile type 1 diabetes', 'cb', { show: 'dmType=t1' }),
        F('adrenalInsufficiency', 'Adrenal insufficiency on glucocorticoid replacement'),
        F('chronicSteroid', 'Chronic systemic glucocorticoid for another indication'),
        F('thyroidDisease', 'Thyroid disease on treatment')
      ]
    }
  ];

  // ---------- Lung resection ----------
  data.lungFields = [
    F('fev1Pct', 'Pre-op FEV1 (post-BD)', 'num', { unit: '% pred' }),
    F('dlcoPct', 'DLCO', 'num', { unit: '% pred' }),
    F('resectedSeg', 'Segments to resect', 'num', { hint: 'RUL 3, RML 2, RLL 5, LUL+lingula 5, LLL 4 (of 19)' }),
    F('obstructedSeg', 'Obstructed segments', 'num'),
    F('perfusionPct', 'Or: perfusion of resected region (V/Q scan)', 'num', { unit: '% of total' }),
    F('vo2max', 'VO2max (CPET)', 'num', { unit: 'mL/kg/min', step: 0.1 }),
    F('paco2', 'PaCO2', 'num', { unit: 'mmHg' })
  ];

  // ---------- Functional capacity ----------
  data.functionalCapacity = [
    opt('gt10', '> 10 METs', 'Swimming, singles tennis, football, basketball'),
    opt('4to10', '4–10 METs', 'Climbs ≥ 1 flight of stairs or a hill, heavy housework, short run, dancing'),
    opt('lt4', '< 4 METs', 'Self-care, walking 1–2 blocks on level ground, light housework only'),
    opt('unknown', 'Unknown', 'Cannot be assessed (e.g. orthopedic limitation)')
  ];
  data.dasi = [
    { k: 'dasi1', label: 'Take care of yourself (eating, dressing, bathing, toilet)', w: 2.75 },
    { k: 'dasi2', label: 'Walk indoors, such as around your house', w: 1.75 },
    { k: 'dasi3', label: 'Walk a block or two on level ground', w: 2.75 },
    { k: 'dasi4', label: 'Climb a flight of stairs or walk up a hill', w: 5.5 },
    { k: 'dasi5', label: 'Run a short distance', w: 8 },
    { k: 'dasi6', label: 'Light work around the house (dusting, washing dishes)', w: 2.7 },
    { k: 'dasi7', label: 'Moderate housework (vacuuming, sweeping, carrying groceries)', w: 3.5 },
    { k: 'dasi8', label: 'Heavy housework (scrubbing floors, moving furniture)', w: 8 },
    { k: 'dasi9', label: 'Yard work (raking, weeding, pushing a mower)', w: 4.5 },
    { k: 'dasi10', label: 'Sexual relations', w: 5.25 },
    { k: 'dasi11', label: 'Moderate recreation (golf, bowling, dancing, doubles tennis)', w: 6 },
    { k: 'dasi12', label: 'Strenuous sports (swimming, singles tennis, basketball)', w: 7.5 }
  ];

  // ---------- Antithrombotics ----------
  data.antiplatelets = [
    { id: 'aspirin', name: 'Aspirin', stop: [4, 4], p2y12: false },
    { id: 'clopidogrel', name: 'Clopidogrel', stop: [5, 7], p2y12: true },
    { id: 'prasugrel', name: 'Prasugrel', stop: [7, 10], p2y12: true },
    { id: 'ticagrelor', name: 'Ticagrelor', stop: [3, 5], p2y12: true },
    { id: 'cilostazol', name: 'Cilostazol', stop: [5, 5], p2y12: false },
    { id: 'dipyridamole', name: 'Dipyridamole', stop: [5, 5], p2y12: false }
  ];

  data.thromboticRisk = {
    mhv: {
      label: 'Mechanical heart valve',
      items: [
        { id: 'mhvMitral', level: 'high', label: 'Any mitral valve prosthesis' },
        { id: 'mhvCaged', level: 'high', label: 'Caged-ball or tilting-disc aortic prosthesis' },
        { id: 'mhvStroke', level: 'high', label: 'Stroke or TIA within 6 months' },
        { id: 'mhvBileafletRF', level: 'moderate', label: 'Bileaflet AVR + ≥ 1 of: AF, prior stroke/TIA, HT, DM, CHF, age > 75' },
        { id: 'mhvBileaflet', level: 'low', label: 'Bileaflet AVR without AF or other stroke risk factors' }
      ]
    },
    af: {
      label: 'Atrial fibrillation',
      items: [
        { id: 'afStroke3m', level: 'high', label: 'Stroke or TIA within 3 months' },
        { id: 'afRheumatic', level: 'high', label: 'Rheumatic valvular heart disease' }
      ]
    },
    vte: {
      label: 'Venous thromboembolism',
      items: [
        { id: 'vteRecent', level: 'high', label: 'VTE within 3 months' },
        { id: 'vteSevereThrombophilia', level: 'high', label: 'Severe thrombophilia (protein C/S or AT deficiency, APS, multiple)' },
        { id: 'vte3to12', level: 'moderate', label: 'VTE within past 3–12 months' },
        { id: 'vteNonSevere', level: 'moderate', label: 'Non-severe thrombophilia (heterozygous FVL / prothrombin)' },
        { id: 'vteRecurrent', level: 'moderate', label: 'Recurrent VTE' },
        { id: 'vteCancer', level: 'moderate', label: 'Active cancer (treated ≤ 6 months or palliative)' },
        { id: 'vteOld', level: 'low', label: 'VTE > 12 months, no other risk factor' }
      ]
    },
    other: {
      label: 'Other indications (AHA 2024)',
      items: [
        { id: 'lvThrombus', level: 'high', label: 'LV thrombus within 3 months' },
        { id: 'cancerHighVTE', level: 'high', label: 'Cancer with high VTE risk (pancreas, MPN, brain, gastric, esophageal)' }
      ]
    }
  };

  data.afScoreItems = [
    { id: 'chf', label: 'Congestive heart failure' },
    { id: 'ht', label: 'Hypertension' },
    { id: 'dm', label: 'Diabetes mellitus' },
    { id: 'stroke', label: 'Prior stroke / TIA / thromboembolism' },
    { id: 'vascular', label: 'Vascular disease (MI, PAD, aortic plaque)' }
  ];

  data.doacs = [
    { id: 'apixaban', name: 'Apixaban', group: 'xa' },
    { id: 'rivaroxaban', name: 'Rivaroxaban', group: 'xa' },
    { id: 'edoxaban', name: 'Edoxaban', group: 'xa' },
    { id: 'dabigatran', name: 'Dabigatran', group: 'dabigatran' }
  ];

  data.bemiparin = [
    { maxKg: 50, normal: '5,000 IU SC OD', renal: '3,500 IU SC OD' },
    { maxKg: 70, normal: '7,500 IU SC OD', renal: '5,000 IU SC OD' },
    { maxKg: 100, normal: '10,000 IU SC OD', renal: '7,500 IU SC OD' },
    { maxKg: Infinity, normal: '115 IU/kg SC OD', renal: 'Reduce 25% of normal dose (use with caution)' }
  ];

  // ---------- Medication groups (generic) ----------
  const CONT_AM = 'Continue through the day of surgery, including the morning dose before the OR.';
  const SGLT2 = 'Hold ≥ 3 days before surgery (ertugliflozin ≥ 4 days) to prevent euglycemic DKA; restart when eating and euvolemic.';
  data.drugGroups = [
    {
      id: 'cv', title: 'Cardiovascular', items: [
        { id: 'bb', name: 'Beta-blocker', rec: CONT_AM + ' (ESC I / AHA 1). Do not stop abruptly.' },
        { id: 'ccb', name: 'Calcium channel blocker', rec: CONT_AM },
        {
          id: 'acei', name: 'ACE-I / ARB / ARNI', options: [
            { id: 'ht', label: 'Indication: hypertension', rec: 'Hold on the morning of surgery (ESC IIa); omitting 24 h before elevated-risk surgery may limit hypotension (AHA 2b); restart within 48 h when stable without AKI.' },
            { id: 'chf', label: 'Indication: HFrEF or poorly controlled HT', rec: 'Continue, including the morning dose (HFrEF: AHA 2a).' }
          ]
        },
        {
          id: 'diuretic', name: 'Diuretic', options: [
            { id: 'ht', label: 'Indication: hypertension', rec: 'Hold on the morning of surgery.' },
            { id: 'chfStable', label: 'HF, stable volume status', rec: 'Hold on the morning of surgery; monitor K and volume.' },
            { id: 'chfDifficult', label: 'HF with difficult volume control', rec: 'Continue, including the morning dose; monitor K and volume.' }
          ]
        },
        { id: 'mra', name: 'MRA (spironolactone / eplerenone) for HF', rec: 'Compensated HF: reasonable to continue GDMT peri-operatively (AHA 2a); monitor K and creatinine.' },
        { id: 'sglt2hf', name: 'SGLT2 inhibitor for HF / CKD (non-diabetic)', rec: SGLT2, stop: [3, 3] },
        { id: 'pah', name: 'PAH therapy (sildenafil, bosentan, prostacyclin)', rec: 'Continue chronic PAH therapy peri-operatively (ESC I); severe PAH: hemodynamic monitoring ≥ 24 h post-op.' },
        { id: 'digoxin', name: 'Digoxin', rec: CONT_AM },
        { id: 'hydralazine', name: 'Hydralazine', rec: CONT_AM },
        { id: 'nitrate', name: 'Nitrate', rec: CONT_AM },
        { id: 'statin', name: 'Statin', rec: CONT_AM + ' (ESC I / AHA 1).' },
        { id: 'nonstatin', name: 'Non-statin lipid-lowering agent', rec: 'Stop a few days before surgery.' },
        { id: 'alpha', name: 'Alpha-blocker', rec: CONT_AM }
      ]
    },
    {
      id: 'gout', title: 'Gout and analgesic', items: [
        { id: 'colchicine', name: 'Colchicine', rec: 'Hold on the morning of surgery; restart when oral intake resumes.' },
        { id: 'allopurinol', name: 'Allopurinol', rec: 'Continue until the day of surgery.' },
        { id: 'nsaid', name: 'NSAID', rec: 'Stop at least 3 days before surgery; avoid in CKD / AKI risk.', stop: [3, 3] }
      ]
    },
    {
      id: 'thyroid', title: 'Thyroid', items: [
        {
          id: 'thyroidDrug', name: 'Levothyroxine / PTU / MMI', options: [
            { id: 'normal', label: 'Euthyroid, TFT normal', rec: 'Continue through the day of surgery.' },
            { id: 'tshOnly', label: 'Euthyroid, FT3/FT4 normal, TSH abnormal', rec: 'Continue; consult internal medicine to co-manage.' },
            { id: 'abnormal', label: 'Symptomatic and TFT abnormal', rec: 'Optimize before surgery, weighing urgency (hyperthyroidism pre-op guideline).', flag: 'consult' }
          ]
        }
      ]
    },
    {
      id: 'psych', title: 'Psychotropic', items: [
        {
          id: 'tca', name: 'Tricyclic antidepressant', options: [
            { id: 'noHeart', label: 'No heart disease or arrhythmia', rec: 'Continue; inform the anesthesiologist to monitor for arrhythmia.' },
            { id: 'heart', label: 'AF, MI, CHF, DCM or arrhythmia', rec: 'Taper and stop 7–14 days before surgery.' }
          ]
        },
        {
          id: 'ssri', name: 'SSRI / SNRI', options: [
            { id: 'lowBleed', label: 'Low postoperative bleeding risk', rec: 'Continue.' },
            { id: 'highBleed', label: 'Bleeding would be dangerous', rec: 'Consult psychiatry to taper and stop a few weeks before surgery.', flag: 'consult' }
          ]
        },
        { id: 'maoi', name: 'MAO inhibitor', rec: 'Consult psychiatry before surgery.', flag: 'consult' },
        { id: 'lithium', name: 'Lithium / valproate', rec: 'Continue; for lithium monitor fluid and electrolytes.' },
        { id: 'antipsychotic', name: 'Antipsychotic', rec: 'Consult psychiatry about dose reduction to limit peri-operative arrhythmia.', flag: 'consult' },
        { id: 'bzd', name: 'Benzodiazepine', rec: 'Continue; abrupt cessation risks withdrawal.' },
        { id: 'stimulant', name: 'Psychostimulant', rec: 'Consult psychiatry before surgery.', flag: 'consult' }
      ]
    },
    {
      id: 'pulm', title: 'Pulmonary', items: [
        { id: 'inhaledBronch', name: 'Inhaled LABA / LAMA / SABA', rec: 'Continue, including on the day of surgery; use the long-acting bronchodilator before the OR.' },
        { id: 'ics', name: 'Inhaled corticosteroid', rec: 'Continue, including on the day of surgery.' },
        { id: 'theophylline', name: 'Theophylline', rec: 'Stop 1 day before surgery, starting with the evening dose.' },
        { id: 'montelukast', name: 'Montelukast', rec: CONT_AM }
      ]
    },
    {
      id: 'neuro', title: 'Neurological', items: [
        { id: 'aed', name: 'Antiepileptic drug', rec: 'Continue at usual dose, including the morning dose (oral/NG with sips, or parenteral).' },
        { id: 'antiparkinson', name: 'Antiparkinsonian', rec: 'Continue at usual times, including while waiting for the OR; restart early post-op via oral/NG. Abrupt withdrawal risks NMS-like syndrome.' },
        { id: 'mgAche', name: 'Pyridostigmine (myasthenia gravis)', rec: CONT_AM },
        { id: 'immuno', name: 'Immunosuppressant (azathioprine, MMF, MTX, cyclosporin)', rec: 'Check CBC, Cr, LFT pre-op; may hold on the day of surgery and resume when stable.' }
      ]
    },
    {
      id: 'other', title: 'Other', items: [
        { id: 'bphAlpha', name: 'BPH alpha-blocker', rec: CONT_AM },
        { id: 'ocp', name: 'Estrogen / OCP / SERM', rec: 'Consider stopping 4 weeks before surgery with high VTE risk; otherwise continue with VTE prophylaxis.' },
        { id: 'herbal', name: 'Herbal supplements', rec: 'Stop 7 days before surgery (bleeding / interaction risk).', stop: [7, 7] }
      ]
    }
  ];

  // ---------- Diabetes (ADA 2026, departmental lecture) ----------
  data.dmDrugs = [
    { id: 'metformin', name: 'Metformin', rec: 'Hold on the day of surgery (ADA 2026); AHA 2024 rates continuation reasonable (2a) — follow local protocol. Hold before contrast or with AKI; restart when eating and renal function stable.', hold: 0 },
    { id: 'su', name: 'Sulfonylurea / glinide', rec: 'Hold on the day of surgery (hypoglycemia).', hold: 0 },
    { id: 'tzd', name: 'Thiazolidinedione', rec: 'Hold on the day of surgery (fluid retention).', hold: 0 },
    { id: 'dpp4', name: 'DPP-4 inhibitor', rec: 'Hold on the day of surgery.', hold: 0 },
    { id: 'sglt2', name: 'SGLT2 inhibitor', rec: SGLT2, stop: [3, 3] },
    {
      id: 'glp1', name: 'GLP-1 RA / dual GIP–GLP-1 RA', options: [
        { id: 'continue', label: 'Stable dose, no GI symptoms, used for diabetes', rec: 'May continue; full-stomach precautions per anesthesia.' },
        { id: 'holdDaily', label: 'Hold (daily agent): GI symptoms, dose escalation, high aspiration-risk procedure, or weight-loss only', rec: 'Hold on the day of procedure; liquid diet 24 h before; consider gastric ultrasound.' },
        { id: 'holdWeekly', label: 'Hold (weekly agent): same indications', rec: 'Hold 7 days before procedure; liquid diet 24 h before; consider gastric ultrasound.', stop: [7, 7] }
      ]
    }
  ];

  data.insulinFields = [
    F('insNphAm', 'NPH morning dose', 'num', { unit: 'U' }),
    F('insNphPm', 'NPH evening dose', 'num', { unit: 'U' }),
    F('insLong', 'Long-acting (glargine / detemir / degludec) daily dose', 'num', { unit: 'U' }),
    F('insPremixAm', 'Premixed morning dose', 'num', { unit: 'U' }),
    F('insPremixPm', 'Premixed evening dose', 'num', { unit: 'U' }),
    F('insPrandial', 'Prandial insulin (aspart / lispro / RI)'),
    F('insHypoRisk', 'High hypoglycemia risk, overbasalization, malnutrition, or renal/hepatic impairment'),
    F('amCbg', 'Morning-of-surgery CBG', 'num', { unit: 'mg/dL' })
  ];

  data.ieRegimens = {
    noAllergy: ['Amoxicillin 2 g PO', 'Ampicillin 2 g IV/IM', 'Cefazolin or ceftriaxone 1 g IV/IM'],
    allergy: ['Cephalexin 2 g PO (no anaphylaxis history)', 'Azithromycin or clarithromycin 500 mg PO', 'Doxycycline 100 mg PO', 'Cefazolin or ceftriaxone 1 g IV/IM (no anaphylaxis history)']
  };

  data.references = [
    'Halvorsen S, et al. 2022 ESC Guidelines on cardiovascular assessment and management of patients undergoing non-cardiac surgery. Eur Heart J. 2022;43:3826–3924.',
    'Thompson A, et al. 2024 AHA/ACC/ACS/ASNC/HRS/SCA/SCCT/SCMR/SVM Guideline for Perioperative Cardiovascular Management for Noncardiac Surgery. J Am Coll Cardiol. 2024;84(19):1869–1969.',
    'Douketis JD, et al. Perioperative Management of Antithrombotic Therapy. CHEST Guideline. Chest. 2022;162(5):e207–e243.',
    'American Diabetes Association. 16. Diabetes Care in the Hospital. Standards of Care in Diabetes—2026. Diabetes Care. 2026;49(Suppl 1):S339–S355.',
    'Duggan EW, et al. Perioperative Hyperglycemia Management: An Update. Anesthesiology. 2017;126:547–560.',
    'Delgado V, et al. 2023 ESC Guidelines for the management of endocarditis. Eur Heart J. 2023;44:3948–4042.',
    'Qaseem A, et al. Risk assessment for and strategies to reduce perioperative pulmonary complications for patients undergoing noncardiothoracic surgery: ACP guideline. Ann Intern Med. 2006;144:575–580.',
    'Brunelli A, et al. Physiologic evaluation of the patient with lung cancer being considered for resectional surgery. ACCP guideline. Chest. 2013;143(5 Suppl):e166S–e190S.',
    'Prowle JR, et al. Postoperative acute kidney injury in adult non-cardiac surgery: ADQI consensus. Nat Rev Nephrol. 2021;17:605–618.',
    'Kanda H, et al. Perioperative Management of Patients With End-Stage Renal Disease. J Cardiothorac Vasc Anesth. 2017;31:2251–2267.',
    'ACR Manual on Contrast Media, 2024.',
    'Departmental lecture: Perioperative management in non-cardiac surgery (ACC 2024 & ESC 2022), 2025.',
    'Institutional protocol: Preop evaluation and Perioperative Medication Management (rev. 26 Dec 2024); departmental lectures, Phramongkutklao Hospital 2026.'
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else (root.PREOP = root.PREOP || {}).data = data;
})(this);

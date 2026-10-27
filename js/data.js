// Static content transcribed from the institutional protocol
// "Preop evaluation and Perioperative Medication Management" (rev. 26 Dec 2024),
// based on 2022 ESC and 2024 AHA/ACC non-cardiac surgery guidelines and UpToDate.
(function (root) {
  const data = {};

  // ---------- Page 1: cardiac risk ----------
  data.urgency = [
    { id: 'emergency', label: 'Emergency surgery' },
    { id: 'urgent', label: 'Urgent surgery' },
    { id: 'elective', label: 'Elective / time-sensitive surgery' }
  ];

  data.activeCardiac = [
    { id: 'recentMI', label: 'Recent MI ≤ 14 days' },
    { id: 'chf', label: 'CHF NYHA functional class III or IV' },
    { id: 'symVHD', label: 'Symptomatic VHD or new murmur' },
    { id: 'arrhythmia', label: 'Unstable arrhythmia: AF with RVR, high-grade AV block, malignant ventricular arrhythmia' },
    { id: 'ecgIschemia', label: 'ECG with infarction or ischemic pattern' }
  ];

  data.riskModifying = [
    { id: 'asxVHD', label: 'Asymptomatic VHD (AS, MS, AR, MR only)' },
    { id: 'severePH', label: 'Severe pulmonary hypertension' },
    { id: 'chd', label: 'Congenital heart disease' },
    { id: 'recentStroke', label: 'Recent stroke or TIA within 3 months' },
    { id: 'cied', label: 'Cardiac implantable device' }
  ];

  data.frailty = [
    { id: 'slowness', label: 'Slowness' },
    { id: 'lowActivity', label: 'Low activity' },
    { id: 'weakness', label: 'Weakness' },
    { id: 'weightLoss', label: 'Weight loss' },
    { id: 'exhaustion', label: 'Exhaustion' }
  ];

  data.clinicalRisk = [
    { id: 'age65', label: 'Age > 65 years' },
    { id: 'ht', label: 'Hypertension' },
    { id: 'dlp', label: 'Dyslipidemia' },
    { id: 'dm', label: 'Diabetes mellitus' },
    { id: 'smoking', label: 'Smoking' },
    { id: 'fhx', label: 'Family history of premature CAD' }
  ];

  data.surgicalRisk = {
    high: {
      label: 'High surgical risk (> 5%)',
      items: [
        'Adrenal resection', 'Aortic and major vascular surgery', 'Carotid symptomatic (CAS)',
        'Duodeno-pancreatic surgery', 'Liver resection, bile duct surgery', 'Esophagectomy',
        'Open lower limb revascularization for acute limb ischemia or amputation',
        'Pneumonectomy (VATS or open surgery)', 'Pulmonary or liver transplant',
        'Repair of perforated bowel', 'Total cystectomy'
      ]
    },
    intermediate: {
      label: 'Intermediate surgical risk (1–5%)',
      items: [
        'Carotid asymptomatic (CEA or CAS)', 'Carotid symptomatic (CEA)', 'Endovascular aortic aneurysm repair',
        'Head or neck surgery', 'Intraperitoneal: splenectomy, hiatal hernia repair, cholecystectomy',
        'Intrathoracic: non-major', 'Neurological or orthopedic: major (hip and spine surgery)',
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

  data.functionalCapacity = [
    { id: 'gt10', label: '> 10 METs', examples: 'Golf, swimming, football, basketball, singles tennis' },
    { id: '4to10', label: '4–10 METs', examples: 'Climbs ≥ 1 flight of stairs or a hill, heavy housework, short run, dancing, doubles tennis, bowling' },
    { id: 'lt4', label: '< 4 METs', examples: 'Daily activities only: eating, dressing, toileting, walking 1–2 blocks on level ground at normal pace, light housework' }
  ];

  // ---------- Medication: antiplatelet ----------
  data.antiplatelets = [
    { id: 'aspirin', name: 'Aspirin', stop: [4, 4] },
    { id: 'clopidogrel', name: 'Clopidogrel', stop: [5, 7] },
    { id: 'cilostazol', name: 'Cilostazol', stop: [5, 5] },
    { id: 'dipyridamole', name: 'Dipyridamole', stop: [5, 5] },
    { id: 'prasugrel', name: 'Prasugrel', stop: [7, 10] },
    { id: 'ticagrelor', name: 'Ticagrelor', stop: [3, 5] }
  ];

  data.pciStatus = [
    { id: 'none', label: 'No previous PCI' },
    { id: 'gt1y', label: 'PCI more than 1 year ago' },
    { id: 'lt1y', label: 'PCI less than 1 year ago' }
  ];

  // ---------- Table 1: procedural bleeding risk ----------
  data.bleedingRisk = {
    high: {
      label: 'High bleeding risk',
      note: '2-day major bleed 2–4%; 30-day major bleed > 2%',
      items: [
        'Any major operation of duration > 45 minutes', 'Abdominal aortic aneurysm repair', 'Coronary artery bypass',
        'Endoscopically guided fine-needle aspiration', 'Foot/hand/shoulder surgery', 'Heart valve replacement',
        'Hip replacement', 'Kidney biopsy', 'Knee replacement', 'Laminectomy', 'Multiple tooth extractions',
        'Neurosurgical/urologic/head and neck/abdominal/breast cancer surgery',
        'Polypectomy, variceal treatment, biliary sphincterotomy, pneumatic dilatation',
        'Transurethral prostate resection', 'Vascular and general surgery'
      ]
    },
    lowMod: {
      label: 'Low/moderate bleeding risk',
      note: '2-day major bleed 0–2%; 30-day major bleed < 2%',
      items: [
        'Abdominal hernia repair', 'Abdominal hysterectomy', 'Arthroscopic surgery lasting < 45 minutes',
        'Axillary node dissection', 'Bronchoscopy with or without biopsy', 'Carpal tunnel decompression',
        'Cataract and noncataract eye surgery', 'Central venous catheter removal', 'Cholecystectomy',
        'Complex dental surgery', 'Cutaneous and bladder/prostate/thyroid/breast/lymph node biopsies',
        'Dilatation and curettage',
        'GI endoscopy ± biopsy, enteroscopy, biliary/pancreatic stent without sphincterotomy, endosonography without FNA',
        'Hemorrhoidal surgery', 'Hydrocele repair', 'Noncoronary angiography',
        'Pacemaker/ICD insertion and electrophysiologic testing', 'Paracentesis', 'Skin cancer excision',
        'Thoracentesis', 'Tooth extractions (multiple extractions may be higher risk)'
      ]
    },
    minimal: {
      label: 'Minimal bleeding risk',
      note: '30-day major bleed ≈ 0%',
      items: ['Minor dermatological procedure', 'Minor dental procedure']
    }
  };

  // ---------- Table 2: perioperative thrombotic risk ----------
  data.thromboticRisk = {
    mhv: {
      label: 'Mechanical heart valve',
      items: [
        { id: 'mhvMitral', level: 'high', label: 'Any mitral valve prosthesis' },
        { id: 'mhvCaged', level: 'high', label: 'Any caged-ball or tilting-disc aortic valve prosthesis' },
        { id: 'mhvStroke', level: 'high', label: 'Recent (within 6 months) stroke or TIA' },
        { id: 'mhvBileafletRF', level: 'moderate', label: 'Bileaflet aortic prosthesis + ≥ 1 of: AF, prior stroke/TIA, HT, DM, CHF, age > 75' },
        { id: 'mhvBileaflet', level: 'low', label: 'Bileaflet aortic prosthesis without AF or other stroke risk factors' }
      ]
    },
    af: {
      label: 'Atrial fibrillation',
      items: [
        { id: 'afStroke3m', level: 'high', label: 'Recent (within 3 months) stroke or TIA' },
        { id: 'afRheumatic', level: 'high', label: 'Rheumatic valvular heart disease' }
      ]
    },
    vte: {
      label: 'Venous thromboembolism',
      items: [
        { id: 'vteRecent', level: 'high', label: 'Recent (within 3 months) VTE' },
        { id: 'vteSevereThrombophilia', level: 'high', label: 'Severe thrombophilia (protein C/S or antithrombin deficiency, antiphospholipid antibodies, multiple abnormalities)' },
        { id: 'vte3to12', level: 'moderate', label: 'VTE within the past 3–12 months' },
        { id: 'vteNonSevere', level: 'moderate', label: 'Non-severe thrombophilia (heterozygous factor V Leiden or prothrombin gene mutation)' },
        { id: 'vteRecurrent', level: 'moderate', label: 'Recurrent VTE' },
        { id: 'vteCancer', level: 'moderate', label: 'Active cancer (treated within 6 months or palliative)' },
        { id: 'vteOld', level: 'low', label: 'VTE > 12 months ago and no other risk factors' }
      ]
    }
  };

  // Components for CHADS2 / CHA2DS2-VASc
  data.afScoreItems = [
    { id: 'chf', label: 'Congestive heart failure', chads: 1, vasc: 1 },
    { id: 'ht', label: 'Hypertension', chads: 1, vasc: 1 },
    { id: 'dm', label: 'Diabetes mellitus', chads: 1, vasc: 1 },
    { id: 'stroke', label: 'Prior stroke / TIA / thromboembolism', chads: 2, vasc: 2 },
    { id: 'vascular', label: 'Vascular disease (prior MI, PAD, aortic plaque)', chads: 0, vasc: 1 }
  ];

  data.doacs = [
    { id: 'apixaban', name: 'Apixaban', group: 'xa' },
    { id: 'rivaroxaban', name: 'Rivaroxaban', group: 'xa' },
    { id: 'edoxaban', name: 'Edoxaban', group: 'xa' },
    { id: 'dabigatran', name: 'Dabigatran', group: 'dabigatran' }
  ];

  // Bemiparin dose by body weight (Table 3.1)
  data.bemiparin = [
    { maxKg: 50, normal: '5,000 IU SC OD', renal: '3,500 IU SC OD' },
    { maxKg: 70, normal: '7,500 IU SC OD', renal: '5,000 IU SC OD' },
    { maxKg: 100, normal: '10,000 IU SC OD', renal: '7,500 IU SC OD' },
    { maxKg: Infinity, normal: '115 IU/kg SC OD', renal: 'Reduce 25% of normal dose (use with caution)' }
  ];

  // ---------- Table 4: surgical stress (modified Johns Hopkins) ----------
  data.surgicalStress = [
    { id: 'g1', label: 'Grade I (minor)', desc: 'Blood loss < 500 mL. Minor general surgery (skin, inguinal hernia, breast biopsy), endoscopy, minor gynecologic/ENT procedure, or local anesthesia' },
    { id: 'g2', label: 'Grade II (moderate)', desc: 'Blood loss 500–1,500 mL. Cystectomy, nephrectomy, hysterectomy, GI resection, cholecystectomy, joint replacement, thyroidectomy' },
    { id: 'g3', label: 'Grade III (major)', desc: 'Blood loss > 1,500 mL, usual post-op ICU. Major ortho-spinal, oropharyngeal, GU reconstruction; intracranial, major vascular, cardiothoracic' }
  ];

  // ---------- Medication groups 3–9 (generic) ----------
  // Item with `rec` = single recommendation; with `options` = choose by indication.
  const CONT_AM = 'Continue through the day of surgery, including the morning dose before going to the OR.';
  data.drugGroups = [
    {
      id: 'cv', title: '3. Cardiovascular drugs', items: [
        { id: 'bb', name: 'Beta-blocker', rec: CONT_AM },
        { id: 'ccb', name: 'Calcium channel blocker', rec: CONT_AM },
        {
          id: 'acei', name: 'ACE-I / ARB', options: [
            { id: 'ht', label: 'Indication: hypertension', rec: 'Continue; hold on the morning of surgery and restart as early as possible after surgery.' },
            { id: 'chf', label: 'Indication: CHF or poorly controlled HT', rec: 'Continue without interruption, including the morning dose before going to the OR.' }
          ]
        },
        {
          id: 'diuretic', name: 'Diuretic', options: [
            { id: 'ht', label: 'Indication: hypertension', rec: 'Continue; hold on the morning of surgery.' },
            { id: 'chfStable', label: 'CHF, well controlled with stable volume status', rec: 'Continue; hold on the morning of surgery.' },
            { id: 'chfDifficult', label: 'CHF with difficult volume control', rec: 'Continue without interruption, including the morning dose before going to the OR.' }
          ]
        },
        { id: 'digoxin', name: 'Digoxin', rec: CONT_AM },
        { id: 'hydralazine', name: 'Hydralazine', rec: CONT_AM },
        { id: 'nitrate', name: 'Nitrate', rec: CONT_AM },
        { id: 'statin', name: 'Statin', rec: CONT_AM },
        { id: 'nonstatin', name: 'Non-statin lipid-lowering agent', rec: 'Stop a few days before surgery so that the drug effect has worn off.' },
        { id: 'alpha', name: 'Alpha-blocker', rec: CONT_AM }
      ]
    },
    {
      id: 'gout', title: '4. Gout drugs', items: [
        { id: 'colchicine', name: 'Colchicine', rec: 'Continue; hold on the morning of surgery and restart after surgery once oral intake is possible.' },
        { id: 'allopurinol', name: 'Allopurinol', rec: 'Continue until the day of surgery.' },
        { id: 'nsaid', name: 'NSAID', rec: 'Stop at least 3 days before surgery.', stop: [3, 3] }
      ]
    },
    {
      id: 'bph', title: '5. BPH drugs', items: [
        { id: 'bphAlpha', name: 'Alpha-blocker', rec: CONT_AM }
      ]
    },
    {
      id: 'thyroid', title: '6.2 Thyroid drugs (levothyroxine, PTU, MMI)', items: [
        {
          id: 'thyroidDrug', name: 'Thyroid medication', options: [
            { id: 'normal', label: 'Clinically euthyroid, TFT normal', rec: 'Continue through the day of surgery.' },
            { id: 'tshOnly', label: 'Clinically euthyroid, FT3/FT4 normal, TSH abnormal', rec: 'Continue through the day of surgery and consult internal medicine to co-manage.' },
            { id: 'abnormal', label: 'Symptomatic and TFT abnormal', rec: 'Consult to optimize thyroid status before surgery, weighing the urgency of surgery (see the hyperthyroidism pre-op guideline).', flag: 'consult' }
          ]
        }
      ]
    },
    {
      id: 'psych', title: '7. Psychotropic agents', items: [
        {
          id: 'tca', name: 'Tricyclic antidepressant', options: [
            { id: 'noHeart', label: 'No heart disease or arrhythmia', rec: 'Continue without interruption; inform the anesthesiologist to monitor for arrhythmia.' },
            { id: 'heart', label: 'AF, MI, CHF, DCM or arrhythmia', rec: 'Taper gradually and stop 7–14 days before surgery to reduce perioperative arrhythmia risk.' }
          ]
        },
        {
          id: 'ssri', name: 'SSRI / SNRI', options: [
            { id: 'lowBleed', label: 'Low risk of postoperative bleeding', rec: 'Continue without interruption.' },
            { id: 'highBleed', label: 'Surgeon judges bleeding could be dangerous', rec: 'Consult psychiatry to taper and stop a few weeks before surgery.', flag: 'consult' }
          ]
        },
        { id: 'maoi', name: 'MAO inhibitor', rec: 'Consult psychiatry about adjusting or stopping before surgery.', flag: 'consult' },
        { id: 'lithium', name: 'Lithium / sodium valproate', rec: 'Continue without interruption. For lithium, monitor fluid status and electrolytes before surgery.' },
        { id: 'antipsychotic', name: 'Antipsychotic', rec: 'Consult psychiatry about dose reduction or stopping before surgery to reduce perioperative arrhythmia while keeping psychiatric symptoms controlled.', flag: 'consult' },
        { id: 'bzd', name: 'Benzodiazepine', rec: 'Continue without interruption; resume after surgery once stable. Abrupt cessation in chronic users may cause withdrawal (insomnia, agitation, seizures).' },
        { id: 'stimulant', name: 'Psychostimulant', rec: 'Consult psychiatry about adjusting or stopping before surgery.', flag: 'consult' }
      ]
    },
    {
      id: 'pulm', title: '8. Pulmonary agents', items: [
        { id: 'inhaledBronch', name: 'Inhaled beta-agonist / anticholinergic', rec: 'Continue through the day of surgery, including use on the day of surgery while waiting for the OR.' },
        { id: 'theophylline', name: 'Theophylline', rec: 'Stop 1 day before surgery, starting with the evening dose.' },
        { id: 'ics', name: 'Inhaled corticosteroid', rec: 'Continue through the day of surgery, including use while waiting for the OR. (Oral corticosteroid: see Glucocorticoid section.)' },
        { id: 'montelukast', name: 'Leukotriene inhibitor (montelukast)', rec: 'Continue through the day of surgery, including the morning dose; resume after surgery once oral intake is possible.' }
      ]
    },
    {
      id: 'neuro', title: '9. Drugs in neurological disease', items: [
        { id: 'aed', name: 'Antiepileptic drug', rec: 'Continue all AEDs at the usual dose through the day of surgery, including the morning dose, by oral/NG route with small sips of water, or a parenteral form as judged by the anesthesiologist or surgeon.' },
        { id: 'antiparkinson', name: 'Antiparkinsonian (levodopa, dopamine agonist, anticholinergic)', rec: 'Continue all at the usual dose through the day of surgery, giving doses at the usual times while waiting for the OR; restart early after surgery via oral/NG. Abrupt withdrawal may worsen symptoms and, if severe, cause a neuroleptic malignant-like syndrome.' },
        { id: 'mgAche', name: 'Myasthenia gravis: anticholinesterase (pyridostigmine, neostigmine)', rec: CONT_AM },
        { id: 'immuno', name: 'MS / NMO / MG immunosuppressant (azathioprine, cyclosporin, cyclophosphamide, methotrexate, MMF)', rec: 'Continue; check CBC, Cr, AST, ALT, ALP before surgery. May hold on the day of surgery and resume once post-op condition is stable.' }
      ]
    }
  ];

  // ---------- 6.1 Diabetes ----------
  data.dmDrugs = [
    { id: 'oad', name: 'Oral diabetic agents', rec: 'Continue usual regimen; stop 1 day before surgery.' },
    { id: 'insulin', name: 'Insulin', rec: 'Continue usual regimen; when NPO, switch to the diabetic protocol (standing order pre-op DM).' },
    { id: 'glp1Daily', name: 'GLP-1 RA, once-daily dosing', rec: 'Hold on the day of surgery.' },
    { id: 'glp1Weekly', name: 'GLP-1 RA, once-weekly dosing', rec: 'Hold 1 week before surgery.' },
    { id: 'sglt2', name: 'SGLT2 inhibitor (dapagliflozin, empagliflozin, canagliflozin, ertugliflozin)', rec: 'Stop 3–4 days before surgery.', stop: [3, 4] }
  ];

  data.references = [
    'Halvorsen S, et al. 2022 ESC Guidelines on cardiovascular assessment and management of patients undergoing non-cardiac surgery. Eur Heart J. 2022;43(39):3826–3924.',
    'Thompson A, et al. 2024 AHA/ACC/ACS/ASNC/HRS/SCA/SCCT/SCMR/SVM Guideline for Perioperative Cardiovascular Management for Noncardiac Surgery. Circulation. 2024;150:e351–e442.',
    'Douketis JD, et al. Perioperative Management of Antithrombotic Therapy: An American College of Chest Physicians Clinical Practice Guideline. Chest. 2022;162(5):e207–e243.',
    'Spyropoulos AC, Douketis JD. How I treat anticoagulated patients undergoing an elective procedure or surgery. Blood. 2012;120(15):2954–2962.',
    'UpToDate: Perioperative medication management; Procedural bleeding risk.',
    'Institutional protocol: Preop evaluation and Perioperative Medication Management, Internal Medicine Department (rev. 26 Dec 2024).'
  ];

  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else (root.PREOP = root.PREOP || {}).data = data;
})(this);

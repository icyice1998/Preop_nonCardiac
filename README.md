# Preop Non-Cardiac

Single-page decision support for pre-operative evaluation and peri-operative management in
non-cardiac surgery. Runs offline: open `index.html` (no build step, no data leaves the browser).

## Sections
1. Patient & Surgery: demographics, labs (CrCl, BMI), urgency, surgical / bleeding risk, stress grade, procedure details
2. Questionnaire: cardiovascular, pulmonary, kidney, endocrine history (single source of truth, synced to all tabs)
3. Cardiac: institutional 4-step pathway, RCRI, DASI, ESC 2022 testing, AHA 2024 stepwise, PCI timing, DAPT, VHD/CIED/HF, IE prophylaxis
4. Pulmonary: PPC risk factors and stratification, consult / spirometry indications, ppoFEV1/ppoDLCO, risk-reduction
5. Kidney: CKD/dialysis care, desmopressin, contrast AKI prevention and max dose, ADQI AKI bundle
6. Diabetes & Endocrine: ADA 2026 targets, non-insulin agents, insulin dose calculator, IV vs SC insulin, stress-dose steroid
7. Medications: antiplatelet, warfarin (thrombotic risk, bridging calendar, LMWH dose), DOAC calendar, drug groups
8. Plan & Export: mandatory-item check, plain-text management suggestion (copy / .txt / print)

## Sources
2022 ESC NCS; 2024 AHA/ACC perioperative; ADA Standards 2026; CHEST 2022 antithrombotic; ADQI peri-operative AKI;
ACR contrast manual 2024; ESC 2023 endocarditis; institutional protocol (rev. 26 Dec 2024) and departmental lectures.

## Code
- `js/data.js`: content and field schema
- `js/rules.js`: pure decision functions
- `js/report.js`: plan assembly and plain-text export
- `js/app.js`: UI
- `npm test`: unit tests (Node ≥ 18)

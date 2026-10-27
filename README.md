# Preop Non-Cardiac

Single-page decision-support tool for pre-operative cardiac risk evaluation and perioperative
medication management in non-cardiac surgery. Adapted from an institutional internal-medicine
protocol (rev. 26 Dec 2024) based on the 2022 ESC and 2024 AHA/ACC guidelines.

## Features
- Cardiac risk pathway (Steps 1–4): urgency, active cardiac condition / risk-modifying disease
  (incl. frailty phenotype), clinical risk factors, surgical risk, functional capacity, troponin / NT-proBNP.
- Medication plan: antiplatelet (incl. post-PCI rules), warfarin (thrombotic risk, bridging with
  LMWH dosing), DOAC interruption calendar by CrCl and bleeding risk, CV / gout / BPH / thyroid /
  psychotropic / pulmonary / neurological drugs, diabetes (HbA1c), stress-dose steroids.
- Dates calculated from the surgery date; printable summary.

## Run
Open `index.html` in a browser (no build step).

## Test
```
npm test
```
Decision logic lives in `js/rules.js` (pure functions); content in `js/data.js`; UI in `js/app.js`.

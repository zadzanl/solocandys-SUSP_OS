# Change: Document physics math provenance

## Why
The baseline OpenSpec specs describe shipped behavior, but many solver behaviors are currently specified only qualitatively. Future changes to suspension, damping, roll-stiffness, response, alignment, or balance formulas need a spec-level mathematical reference so formulas are not reverse-engineered from `index.html` each time.

The user also provided local reference material under `forza-suspension-calculator/` from NumberlessMath's Forza Suspension Calculator. The project should preserve which equations are standard suspension math, which came from the reference calculator/forum discussion, and which are SUSP.OS empirical Forza calibrations.

## What Changes
- Add documentation-only OpenSpec deltas with explicit formulas for:
  - corner mass, lateral transfer, tire sizing, mechanical balance, grip bias, and provenance categories
  - spring frequency, spring rate, critical damping, damping ratio, flat ride, shared flat ride, damper scaling, and settle time
  - spring/ARB roll stiffness, roll moment, ARB click conversion, ARB budget, MECH split, and CO-SOLVE math
  - response bar scoring and Tune Check inverse math
  - automatic alignment, brake, and differential contribution heuristics
- Add local reference-file citations for the CSV and forum export.
- Add a small README provenance pointer and missing calibration target note so user-facing docs stay aligned.

## Out of Scope
- Runtime behavior changes in `index.html`.
- New solver formulas, constants, UI controls, or tests.
- Treating forum caveats as authoritative physics beyond the currently implemented behavior.

## Context

The shipped app lives primarily in `index.html`: physics functions are defined at the top of the app source, React renders the UI, and persistence/share behavior is handled in browser APIs. `tests.js` mirrors selected physics functions and regression cases. `README.md` is already extensive user-facing documentation; this sprint converts the product surface into OpenSpec requirements and scenarios.

## Goals / Non-Goals

**Goals:**
- Create a validated OpenSpec baseline for the implemented SUSP.OS product.
- Split requirements by stable product capabilities rather than by source-file sections.
- Preserve domain vocabulary used by the app and README: MECH BALANCE, GRIP BIAS, CO-SOLVE, BEG/INT/PRO, flat ride, ARB share, Tune Check, save slots, and share/import codes.
- Make future feature proposals easier by documenting expected current behavior and boundaries.

**Non-Goals:**
- Do not change `index.html`, `tests.js`, or user-visible app behavior.
- Do not replace the README; OpenSpec becomes the machine-checkable product baseline while README remains human-facing guidance.
- Do not claim physics accuracy beyond the documented calibration assumptions and regression coverage.

## Decisions

- Use one retroactive change named `document-current-baseline`, then archive it into baseline specs after validation.
- Use seven capability specs to keep each file reviewable and future changes scoped.
- Favor scenario-based requirements over implementation details, but include constants/ranges where they define observable behavior.
- Document existing safeguards such as clamps, legacy-code defaults, two-tap destructive actions, and game-mode limits because they affect future compatibility.

## Risks / Trade-offs

- The app is single-file and highly integrated, so capability boundaries are conceptual rather than module boundaries.
- Some physics behavior is calibrated empirically; the specs document current expected behavior, not a proof that the model is complete.
- Broad current-state specs can drift if code changes bypass OpenSpec. Future changes should update the relevant capability spec at proposal/archive time.
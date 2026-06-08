# Design: Physics math provenance documentation

## Goals
- Make implemented math discoverable from OpenSpec, not only from `index.html`.
- Cite local reference material supplied in `forza-suspension-calculator/`.
- Distinguish standard mechanics equations, reference-derived assumptions, implementation contracts, and empirical Forza calibration constants.
- Keep specs precise enough for future changes without freezing incidental implementation details such as temporary input buffers or iteration counts.

## Reference Inputs
- `index.html`: shipped implementation and source of current behavior.
- `tests.js`: regression mirrors for core physics formulas.
- `forza-suspension-calculator/Forza Suspension Calculator (Beta) - Forza Suspension Calculator.csv`: local spreadsheet export containing formula key:
  - `K = (F*2π)² x M`
  - `F = √(K/M) / 2π`
  - `c꜀ = 2√KM`
  - `ζ = c/c꜀`
  - unit conversions and damping-unit caveat.
- `forza-suspension-calculator/Beta - Forza Suspension Calculator - Community Content _ Tuning - Official Forza Community Forums (08_06_2026 06.20.14).html`: local forum export documenting natural-frequency, damping-ratio, ARB-balancing context and uncertainty around Forza damper units.
- `README.md`: existing user-facing explanation of calibration constants and provenance.

## Documentation Model
Each formula should be described as one of:
- **Standard mechanics**: harmonic oscillator, critical damping, damping ratio, lateral transfer approximations.
- **Reference-derived**: NumberlessMath spreadsheet/forum formulas used as foundation.
- **SUSP.OS implementation contract**: exact behavior currently shipped and covered by tests or app behavior.
- **Empirical Forza calibration**: constants tuned to match observed Forza behavior, not universal physics constants.

## Risks and Mitigations
- **Risk: over-specifying implementation detail.** Mitigation: document equations and observable outcomes, not temporary variables, JSX state buffers, or loop counts unless they are part of the user-visible contract.
- **Risk: presenting uncertain Forza damper units as fact.** Mitigation: explicitly document damper conversion as calibrated approximation and preserve the forum caveat that exact Forza internals are not public.
- **Risk: README/OpenSpec drift.** Mitigation: update README with a pointer to OpenSpec math docs and include the missing default mechanical balance target in the calibration table.

## Verification
- `openspec validate document-physics-math-provenance --strict`
- `openspec validate --strict --all`
- `node tests.js`
- Read-only review by subagents focused on math accuracy, references, and spec hygiene.

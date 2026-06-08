## MODIFIED Requirements
### Requirement: ARB stiffness budget modes
The system MUST support AUTO, ROLL °, and SHARE % modes for sizing the total anti-roll-bar contribution and MUST document the roll-moment and roll-stiffness equations used to size that budget.

#### Scenario: Calculate spring roll stiffness
- **WHEN** front and rear spring frequencies and corner masses are available
- **THEN** spring roll stiffness per axle is computed as `(2 * pi * Hz)^2 * cornerMassKg * trackWidth^2 / 2`, and total spring roll stiffness is the sum of front and rear axle values

#### Scenario: Auto-size ARB budget
- **WHEN** ARB mode is AUTO
- **THEN** the system computes roll moment at 1g as `totalMassKg * 9.81 * (cgHeight - rollCenterHeight)`, natural roll as `(rollMoment / springRollStiffnessTotal) * 180 / pi`, and auto ARB share target as `clamp(5, 50, naturalRollDeg * 7) / 100`

#### Scenario: Target body roll angle
- **WHEN** ARB mode is ROLL °
- **THEN** the user-selected roll-angle target determines total required roll stiffness as `rollMoment / targetRollRadians`, and the ARB budget is the remaining roll stiffness after spring roll stiffness

#### Scenario: Target ARB share
- **WHEN** ARB mode is SHARE %
- **THEN** the user-selected share determines ARB contribution as `springRollStiffnessTotal * share / (1 - share)`

### Requirement: ARB balance modes
The system MUST support WEIGHT, MECH, CO-SOLVE, and MAN balance modes for splitting or entering ARB values, with documented algebra for balance-target solvers.

#### Scenario: Split ARBs by weight
- **WHEN** balance mode is WEIGHT
- **THEN** the front/rear ARB split follows weight distribution with any selected ARB bias offset

#### Scenario: Solve ARBs to mechanical balance target
- **WHEN** balance mode is MECH
- **THEN** the system subtracts tire-width correction from the selected mechanical balance target, converts the target rear fraction to a rear/front stiffness ratio with `target / (1 - target)`, and solves the ARB split needed after existing spring roll stiffness is included

#### Scenario: Co-solve rear spring and ARB split
- **WHEN** balance mode is CO-SOLVE
- **THEN** the system interpolates the spring-only rear roll-stiffness fraction toward the tire-corrected target using Spring / ARB Mix, derives the rear spring frequency needed for that spring share, and uses the remaining ARB budget to solve the final ARB split

#### Scenario: Accept manual ARB clicks
- **WHEN** balance mode is MAN
- **THEN** the user can enter front and rear ARB click values directly and observe the predicted mechanical balance

### Requirement: Game limits and clamp warnings
The system MUST enforce game-specific ARB click ceilings and warn when solved values approach or exceed practical limits using documented click/stiffness conversion.

#### Scenario: Horizon ARB limit
- **WHEN** game mode is Horizon
- **THEN** ARB click values are clamped to the Horizon ARB ceiling of 65 clicks

#### Scenario: Motorsport ARB limit
- **WHEN** game mode is Motorsport
- **THEN** ARB click values are clamped to the Motorsport ARB ceiling of 40 clicks

#### Scenario: Convert ARB clicks to roll stiffness
- **WHEN** ARB click values are converted to roll stiffness
- **THEN** axle ARB roll stiffness is `clicks * ARB_RS_SCALE * trackWidth^2`, and solved roll stiffness is converted back to clicks with `rollStiffness / (ARB_RS_SCALE * trackWidth^2)` before user floor/ceiling and game-limit clamps

#### Scenario: Report unreachable roll target
- **WHEN** the requested roll angle or balance target cannot be achieved within limits
- **THEN** the output surfaces a clamp warning rather than silently exceeding game limits

### Requirement: ARB output transparency
The system MUST show front and rear ARB click outputs and expose solved split/readout context for solver-driven modes.

#### Scenario: Show solved ARB split
- **WHEN** balance mode is MECH or CO-SOLVE
- **THEN** the ARB section shows the solved front/rear split percentage

#### Scenario: Show solved rear Hz during CO-SOLVE
- **WHEN** balance mode is CO-SOLVE
- **THEN** the ARB section shows the rear frequency solved by the combined spring/ARB solver

### Requirement: ARB floor and ceiling range controls
The system MUST allow the user to configure an ARB floor and ceiling that further constrains the click output range below the game limit, with the floor defaulting to 1 and the ceiling defaulting to the game-specific ARB limit.

#### Scenario: Constrain output to floor and ceiling
- **WHEN** the user sets an ARB floor and ceiling
- **THEN** solved ARB click values are clamped to the user-defined floor/ceiling range in addition to the game limit

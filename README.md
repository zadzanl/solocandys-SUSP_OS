# SUSP.OS — Forza Suspension Calculator

A single-file suspension tuning calculator for **Forza Horizon** and **Forza Motorsport**. Enter your car's physical stats and a handling target — SUSP.OS outputs exact in-game click values for springs, dampers, anti-roll bars, alignment, brakes, and differential, all grounded in real suspension physics.

> Physics approach based on [NumberlessMath's Forza Suspension Calculator (2020)](https://forums.forza.net/t/beta-forza-suspension-calculator/97135)
>
> For the spec-level formula inventory, provenance notes, and change history, see `openspec/specs/`.

---

## Quick Start

Download `index.html` and open it in any browser. No install, no server, no build step.

> **Offline note:** React and Babel load from a CDN on first use. Once cached, the app works fully offline. For a fully air-gapped setup, open it once with internet access, then it works without a connection.

---

## What It Does

Forza's suspension tuning menus expose raw numbers (spring rate lb/in, damper clicks, ARB clicks) with no guidance on what those numbers mean physically. SUSP.OS bridges that gap:

1. **You describe your car** — weight, weight distribution, wheelbase, CG height, tyre sizes
2. **You choose a handling feel** — how stiff, how much body roll, damping character, diff aggression
3. **SUSP.OS computes the physics** — flat-ride rear frequency, critical damping coefficients, roll stiffness budget, alignment geometry
4. **You enter the output values into Forza** — springs, dampers, ARBs, alignment, diff, brakes

The result is a tune that starts from a principled baseline rather than trial-and-error guessing. Fine-tune from there.

---

## Complexity Tiers

A **BEG / INT / PRO** toggle in the header controls how much of the input surface is visible, so the tool scales from one-slider simplicity to full physics control. A short in-app guide opens the first time you enter each tier (reopen any time with the **?** button).

| Tier | Surface |
|---|---|
| **BEG** (Beginner) | Minimal inputs — weight, a handling-feel slider, and a balance target. Chassis geometry auto-scales with weight, and CO-SOLVE is selected automatically so springs and ARBs are solved together |
| **INT** (Intermediate) | Adds full springs/damping/ARB control with the WEIGHT / MECH / CO-SOLVE / MAN balance modes, without requiring chassis geometry |
| **PRO** | Exposes the complete physics surface — geometry inputs, manual alignment, raw differential lock percentages, brake balance, the Balance Guide panel, and cross-solver readouts |

Geometry auto-scales with weight in BEG/INT; in PRO you control it directly.

---

## Inputs

### CHASSIS
| Field | Description |
|---|---|
| Weight | Total vehicle weight (lb or kg) — from Forza's car stats screen |
| Front Weight Bias | % weight on the front axle |
| Wheelbase | Axle-to-axle distance in mm |
| CG Height | Centre-of-gravity height in mm |
| Track widths | In the Advanced section — affect lateral weight transfer and ARB calculations |
| Tyre sizes | Front/rear tyres in Forza format (e.g. `265/35R18`). The **width** (first number, mm) sets each axle's grip capacity at the limit — wider = more grip on that end, which feeds the **GRIP BIAS** readout. Aspect ratio and rim diameter set rolling radius. Width affects grip balance, not the roll-stiffness fraction |

**Derived info strips** (shown automatically below inputs):
- **F CORNER / R CORNER** — per-wheel corner mass at rest
- **XFER F / XFER R** — lateral weight transfer per g of cornering, per axle (corner mass × CG height ÷ track width)
- **OUT F / OUT R** — outer wheel load at 1g cornering (corner mass + transfer)
- **IN F / IN R** — inner wheel load at 1g cornering (corner mass − transfer)

### FEEL
| Field | Description |
|---|---|
| Ride Stiffness | Spring frequency slider, 0.80–5.50 Hz. Click the Hz readout to type a target frequency directly. Green **ROAD** and **RACE** tick marks show the typical band for this car's corner weight — lighter cars sit higher on the scale |
| Ride Ref | Which axle the stiffness slider anchors to: **FRONT** (default), **SHARED** (both axles move together around the slider as the average), or **REAR**. The opposite axle is then derived by the Rear Hz mode |
| Rear Hz mode | Controls how the derived axle's frequency relates to the anchored one |
| Rebound ζ | Damping ratio for the rebound stroke. 70% = Butterworth (critically tuned). >100% = overdamped |
| Bump | Either a ratio of rebound (BUMP RATIO mode) or independent ζ (INDEPENDENT mode) |
| Damping Bias | Splits front/rear ζ independently. Positive = more front rebound (resists forward weight transfer → understeer tendency). Shows as the **DAMP** row in the handling balance |

**Rear Hz modes:**
| Mode | Behaviour |
|---|---|
| **FLAT RIDE** | Derived axle's Hz comes from the flat-ride formula: anchored Hz, wheelbase, and a Target Speed slider. Lower speed = softer rear. **OFF** disables the correction |
| **MULTIPLIER** | Derived Hz = anchored Hz × a multiplier (0.50–3.00). ×1.20 is a common starting point |
| **MECH** | Solves the rear/front Hz ratio from the Mech Balance Target so the springs themselves carry the balance |
| **INDEPENDENT** | Rear Hz set directly (0.80–5.50 Hz), fully decoupled from front |

> In **CO-SOLVE** ARB balance mode the rear Hz is solved automatically (springs + ARBs together), the mode selector is hidden, and the result appears as **SOLVED REAR Hz** in the ARB section.

**Derived info strips** (shown automatically):
- **FRONT / ×ratio / REAR Hz** — live front and rear frequencies with the rear/front multiplier
- **SPR F / SPR R** — computed spring rates in lb/in or N/mm
- **DEF F / DEF R** — static spring deflection in mm under the car's own weight (`g ÷ (2π·Hz)²`). Cross-check that your spring travel isn't bottoming
- **REB · BUMP · SETTLE** — damping ratios and settle time with a category badge: **STIFF** / **SPORT** / **ROAD** / **SOFT** / **FLOAT**

### BUILD
- **Build Type** — your intended use case (Street / Track / Drift). Determines recommended balance range, diff AUTO behavior, alignment presets, and brake AUTO recommendations
- **Mech Balance Target** — your overall handling-balance goal (0.40–0.90, where 0.5 ≈ neutral, higher = more rear roll stiffness / more rotation). Used by MECH, CO-SOLVE, the MECH rear Hz mode, and (optionally) the diff MATCH CHASSIS feature. Set this first; it drives everything: ARB split, spring stiffness, alignment, and diff bias. FH6 surfaces this value in-game so you can verify it directly; on older titles (FH5, FM, etc.) the solver still targets the same physics — you just won't see it reflected in the tuning menu
- **Balance Guide** panel — shows your chassis natural balance, recommended target range for your build type, and how far your current target deviates from natural

### ANTI-ROLL BARS
- **ARB Mode** — how the total ARB budget is sized: Auto (targets natural roll from springs), Roll ° (manual target), or Share % (manual split of total roll stiffness)
- **ARB Range** — floor/ceiling clamp on clicks. Game limits enforced: Horizon max 65, Motorsport max 40

**Balance Mode** — how the front/rear split is chosen to hit your handling goal:
| Mode | Behaviour |
|---|---|
| **WEIGHT** | Splits ARBs by weight distribution, with an optional **ARB Bias** offset to shift roll stiffness front/rear |
| **MECH** | Solves the ARB split to hit the **Mech Balance Target** exactly. The resulting **ARB SPLIT** front/rear % is shown |
| **CO-SOLVE** | Solves rear spring stiffness **and** ARB split together. **Spring / ARB Mix** (Spring Share) controls how much of the correction comes from springs vs ARBs |
| **MAN** | Direct manual input of front and rear ARB click values. When switching into MAN mode, the current solved ARB values are pre-filled as a starting point. Useful for isolated ARB calibration testing — enter your real in-game values and observe the calculator's predicted mech balance |

### ALIGNMENT
Auto mode computes camber, toe, and caster from build type, layout, CG height, and roll angle. Switch to Manual to override.

### BRAKES
- **Auto** — recommends brake balance from front weight bias and build type
- **Manual** — set brake balance (45–70% front) and brake pressure (50–200%) directly. Both affect the entry-phase contribution in the handling balance

### DRIVETRAIN
- **Layout** — FWD / RWD / AWD
- **Auto** — Corner Exit and Corner Entry sliders shift accel/decel lock without exposing raw percentages. AWD adds a Center split slider and a front exit-push slider
- **Manual** — full control over individual accel/decel lock values per axle
- **Match Chassis** — optional toggle (auto mode only) that biases the diff's exit/entry intent toward the chassis Mech Balance Target, so the differential reinforces the handling balance you set elsewhere. Capped so it can't override explicit slider input

---

## Outputs

### Cards (right panel)
| Card | Contents |
|---|---|
| **Alignment** | Camber F/R, Toe F/R, Caster — enter these in Forza's alignment menu |
| **Anti-Roll Bars** | Front and rear click values. Amber warning at >88% of game limit. Clamp warning if target roll angle is unreachable |
| **Springs** | Front and rear spring rates (lb/in or N/mm). Frequency badge: SOFT / ROAD / FIRM / RACE |
| **Dampers** | Rebound F/R and Bump F/R click values. Amber warning at >88% of game limit |
| **Brakes** | Brake balance (% front) and pressure. FRONT / NEUTRAL / REAR badge |
| **Differential** | Accel and decel lock % (or full AWD breakdown). EXIT/ENTRY balance indicators |

### Handling Balance (pinned)
A persistent bar at the bottom of the output panel showing the combined handling balance across every contribution. The contributor bars are **sorted by magnitude** — the dominant driver appears first and is visually highlighted:

| Segment | What it measures |
|---|---|
| **SPRINGS** | Front/rear spring roll stiffness bias |
| **ARB** | Front/rear anti-roll bar bias |
| **DIFF EXIT / DIFF ENTRY** | Differential on-throttle exit and off-throttle entry tendency (FWD/RWD) |
| **DIFF F / DIFF R** | AWD per-axle net diff contribution, split by center fraction and axle weight (replaces EXIT/ENTRY in AWD) |
| **BRAKES** | Brake balance entry-phase contribution |
| **DAMP** | Damping Bias contribution — front/rear rebound split |

The total reads as OVERSTEER (+) or UNDERSTEER (−). **Tune to zero for a neutral baseline**, then bias deliberately if desired. Below the bars, a one-line tip names the dominant contributor and suggests a concrete adjustment.

The header shows **MECH BALANCE** (0.00–1.00, matching Forza's in-game roll-stiffness metric). When the physical at-limit tendency diverges from neutral, a **GRIP BIAS** note appears — derived from the tyre-load-sensitivity model and reflecting how the chassis behaves at the limit (an understeer- or oversteer-prone chassis), as distinct from the roll-stiffness mech balance.

### Response Bar
A second bar below the Handling Balance showing where the setup sits on a **PLANTED ↔ REACTIVE** axis. This reflects **transient response character** — how quickly and freely the car responds to steering inputs. ARBs and weight bias are intentionally excluded: they govern roll moment distribution (already captured by the Handling Balance bar), not response speed.

| Contributor | Weight | Direction |
|---|---|---|
| Spring Hz | 50% | Higher frequency → more reactive (faster natural response) |
| Damping ζ | 20% | Lower damping → more reactive (less resistance to roll initiation) |
| Front toe | 15% | Less toe-in → more reactive (sharper turn-in) |
| Caster | 10% | Less caster → more reactive (lighter steering, less self-centering) |
| Rear/front Hz ratio | 5% | Higher ratio → more reactive (rear-biased stiffness = more rotation) |

Centre of the bar is balanced. Left (green) = planted and settled. Right (amber) = reactive and quick to respond.

> Note: the Response bar reflects *feel*, not lap time. A planted setup can be fast; a reactive setup can be difficult to manage. Use it alongside Handling Balance to understand the character of your tune.

---

## Tools

### Unit Toggle (IMP / MET)
Header toggle switches weight between **lb / kg** and spring rates between **lb/in / N/mm**. Target speed readout switches between **mph / km/h**. Internal state always stores imperial — codec round-trips are unit-independent.

### Tune Check
Reverse-calculate natural frequency and damping ratios from existing in-game spring and damper values. Useful for verifying a manually-tuned setup or analysing a tune shared by someone else.

### Share / Import
Encodes the full tune (chassis + feel + ARBs + drivetrain + brakes) as a compact Base64 string (~210 chars). Paste into IMPORT on any device running SUSP.OS. Old codes from earlier versions decode safely — new fields default gracefully.

### Save Slots
Six persistent slots arranged in a 2×3 grid, storing feel + drivetrain configuration. Pre-loaded with **STREET**, **TRACK**, **RALLY**, **DRIFT**, **MOTORSPT**, and **X COUNTRY** presets.

**Car-aware scaling:** each slot stores the corner mass at save time. When loading onto a different-weight car, Ride Stiffness is scaled by `√(savedMass / currentMass)` so the tune maintains the same relative feel rather than applying the raw Hz value.

**Slot controls:**
| Button | Action |
|---|---|
| Slot name | Load tune into current session |
| ✎ | Rename the slot (inline edit) |
| ⓘ | Add/edit notes (shown in hover tooltip; blue when notes exist) |
| ↺ | Overwrite slot with current tune — tap once to arm (turns green), tap again within 2s to confirm |
| ✕ | Clear slot — tap once to arm (turns amber), tap again within 2s to confirm |

**FE / FE+DR toggle** (bottom-left of toolbar): switches between loading feel + drivetrain together (default) and loading feel only, leaving your current drivetrain settings untouched.

**Auto-naming:** new saves are named `BUILD Hz` (e.g. `TRACK 2.14`) from the current build type and front frequency.

### Section Resets
Each sidebar section has a RESET button (two-click confirmation) that restores defaults for that section only.

---

## Live Telemetry Integration

SUSP.OS supports real-time telemetry integration with **Forza Horizon** and **Forza Motorsport**. This allows the calculator to automatically identify your car, populate baseline specifications, detect the drivetrain layout, and dynamically estimate the upgraded car's weight from live driving data.

### Architecture

The telemetry connection uses a lightweight, zero-dependency Node.js bridge server:
- **`forza-bridge.js`**: A backend server that listens for binary UDP telemetry packets sent by the game on port `5600`, parses the data using Little-Endian format, and broadcasts the parsed telemetry as serialized JSON via a Server-Sent Events (SSE) stream at `http://localhost:5601/telemetry`.
- **`launch.bat`**: A convenient Windows batch file that starts the `forza-bridge.js` server and automatically opens the `index.html` frontend app in your default web browser in a single double-click.

### In-Game Configuration

To feed telemetry data to the bridge, you must configure the HUD settings inside the game:
1. Open Forza and navigate to **Settings > HUD and Gameplay**.
2. Scroll down to the bottom to find the **Data Out** section.
3. Configure the following settings:
   - **Data Out**: `ON`
   - **Data Out IP Address**: `127.0.0.1` (or your PC's local network IP if playing on Xbox)
   - **Data Out Port**: `5600`

### Setup and Running

To run the telemetry bridge:
1. Open the repository folder.
2. Double-click `launch.bat` (on Windows), or run the bridge manually using:
   ```bash
   node forza-bridge.js
   ```
3. Open `index.html` in your browser.
4. Expand the **LIVE TELEMETRY** panel in the sidebar, verify the URL is set to `http://localhost:5601/telemetry`, and click **CONNECT**. The indicator will turn green once it connects to the bridge.

### Bounded Capture & Review Workflow

Rather than continuously syncing telemetry to the calculator inputs (which could overwrite manual configurations or capture noisy transient values), SUSP.OS uses a **Bounded Capture & Review Workflow**:

1. **Auto-Start**: When connected to the bridge, a capture window starts automatically as soon as a race session begins (`IsRaceOn === true`), provided no snapshot is currently pending or applied.
2. **Manual Controls**: You can click **▶ CAPTURE** or **↻ RECAPTURE** in the telemetry panel to manually trigger a new capture window, or **✕ CANCEL CAPTURE** to cancel an active capture.
3. **Capture Window**: The app records telemetry for a short bounded window of up to 8 seconds of active driving. If it collects a target of 80 valid weight samples early, the capture automatically stops to finalize the snapshot.
4. **Cancellation**: Cancelling an active capture aborts the sampling run and immediately discards all collected samples and peak values without generating a snapshot.
5. **Snapshot Review**: Once the capture completes, the collected parameters are presented in the **REVIEW SNAPSHOT** panel:
   - Candidates include **Car Name**, **Drivetrain Layout**, **Weight**, **Front Weight Bias**, **Max RPM**, **Peak Power**, **Peak Torque**, and **Peak Speed**.
   - Each candidate displays its source classification (e.g., `lookup`, `parsed`, `estimated`) and a confidence rating (`high`, `medium`, `low`).
6. **Selective Apply**: Users can toggle checkboxes next to each candidate. Deselected candidates are greyed out. Clicking **APPLY SELECTED** applies only the checked values to the calculator inputs once, leaving unchecked fields untouched.
7. **Manual Overrides**: If you manually change `Weight`, `Front Weight Bias`, or `Drivetrain Layout` in the sidebar after applying a snapshot, the metadata source for that input automatically updates to `'manual'` to correctly reflect that it has been manually overridden.
8. **Restored State**: On application startup, any previously applied telemetry-derived inputs are mapped to a `'restored'` state to distinguish them from active, live-connected telemetry sources.

### Dynamic Weight Estimation

Because Forza does not output the car's current upgraded weight in the telemetry stream, SUSP.OS estimates it dynamically using Newtonian physics from active driving telemetry:

$$\text{Mass (kg)} = \frac{\text{Power (Watts)}}{\text{Velocity (m/s)} \times \text{Longitudinal Acceleration (m/s}^2\text{)}}$$

To ensure accuracy and filter out noise (such as tyre slip, gear shifts, or elevation changes), the calculation is strictly constrained:
- **Active Accel**: Throttle must be $> 80\%$ (or `throttle > 204`) and brake must be completely off (`brake === 0`).
- **Speed & Accel Thresholds**: Speed must be $> 10\text{ m/s}$ (approx. $22\text{ mph}$) and longitudinal acceleration must be $> 0.5\text{ m/s}^2$ to avoid divisions by zero.
- **Median Filtering**: Calculated mass samples are pushed into a sliding window queue (maximum 80 samples). The live estimated weight shown in the UI is the filtered median of these samples, requiring at least 8 valid samples to produce a confident estimation.

### Status & Diagnostics

SUSP.OS provides detailed status indicators and diagnostics for the telemetry connection and packet flow.

#### Connection Status (Bridge State)
- **Disconnected**: The application is not connected to the `forza-bridge.js` backend server.
- **Connecting**: The frontend is attempting to open a Server-Sent Events (SSE) connection with the bridge.
- **Connected**: A SSE channel is active and listening for telemetry data.

#### Packet Status (UDP Stream State)
- **Idle**: Default state when disconnected, or when connection is established but no packets have arrived.
- **Waiting / Waiting for driving packets**: Connected to the bridge, but no telemetry packets have been received yet. Forza only streams UDP packets when you are actively driving in a race session.
- **Receiving**: UDP telemetry packets are actively flowing from the game through the bridge to the frontend.
- **Stale**: Packets have stopped arriving for more than 4 seconds. This is normal when the game is paused, in menus, or on a loading screen.

#### Capture Status (Telemetry Capture State)
- **Inactive**: No capture is running or pending.
- **Active / Sampling**: Telemetry capture is running. The UI displays the count of weight samples collected.
- **Complete**: The capture window finished successfully, and a review snapshot has been generated.
- **Insufficient**: The capture window closed, but less than 8 valid weight samples were collected. The snapshot cannot confidently estimate weight.
- **Cancelled**: The capture was manually aborted, discarding all collected data.

#### Diagnostics Block
When connected and receiving supported packets, the diagnostics panel displays:
- **Count**: Total number of telemetry packets received in the current session.
- **Rate**: Live packet frequency in Hertz (Hz), calculated dynamically using a rolling window of the last 20 packet timestamps.
- **Length**: Binary size of the UDP packet in bytes (e.g., 232 B, 311 B, 324 B).
- **Format**: Detected game profile (e.g., `Horizon v1`, `Horizon v2`, `Motorsport Sled`, `Motorsport v1`) parsed from packet length.

It also displays real-time values for current engine **RPM**, **Speed** (mph/km/h), **Power** (hp), and **Car Ordinal** from the last received packet.

### Data Out Limitations

Forza's Data Out UDP stream was designed primarily for motion rigs and dashboard displays, which imposes several limitations on tuning calculator integration:

1. **Driving-Only Stream**: Telemetry packets are only emitted during live gameplay. Pausing the game, navigating menus, or browsing the garage stops the stream immediately (causing the packet status to go **Stale**).
2. **Missing Metadata and Setup Values**: The telemetry stream does *not* output static car details or setup parameters. Specifically, the following fields are completely missing:
   - Upgraded vehicle weight
   - Front weight bias %
   - Installed upgrades or tuning modifications
   - In-game tuning menu clicks (springs, dampers, ARBs, alignment, brakes, diff)
3. **How SUSP.OS Resolves Missing Data**:
   - **Drivetrain Layout**: Instantly parsed from the telemetry `DrivetrainType` index (mapping to FWD, RWD, AWD).
   - **Stock Weight & Bias**: Resolved via local database lookup based on the unique `CarOrdinal` transmitted by the game. If the car is stock, this fills the weight and front bias.
   - **Upgraded Weight**: If the car is modified, SUSP.OS dynamically estimates the upgraded weight using Newtonian acceleration physics (described above) during a bounded driving window.
   - **Manual Tuning Input**: Since actual tuning menu clicks (springs, dampers, ARBs, alignment, etc.) are never emitted, they must be manually entered into the calculator or solved using the built-in physics solvers.

### Troubleshooting

If you do not see packet flow, check the following:

> [!NOTE]
> **Windows AppContainer Loopback Exemption (PC Microsoft Store / Game Pass users)**:
> Windows sandboxes UWP apps, which prevents Microsoft Store/Game Pass versions of Forza from sending UDP traffic to localhost (`127.0.0.1`). If you are running the game and bridge on the same PC, you must enable loopback exemption.
> - **Option A**: Use a GUI utility like the **AppContainer Loopback Exemption Utility** and check the box for Forza.
> - **Option B**: Open Command Prompt as an Administrator and execute:
>   ```cmd
>   CheckNetIsolation.exe LoopbackExempt -a -n="Microsoft.624F8B84B80_8wekyb3d8bbwe"
>   ```
>   *(Use `Microsoft.624F8B84B80_8wekyb3d8bbwe` for Forza Horizon 5, `Microsoft.ForzaMotorsport_8wekyb3d8bbwe` for Forza Motorsport, or `Microsoft.SunriseBaseGame_8wekyb3d8bbwe` for Forza Horizon 4).*

- **Stale Packet Status**: If the status says **Stale**, it means the game is currently paused, in menus, on a loading screen, or has disconnected. Try driving in a race session; telemetry should resume immediately.
- **HUD Settings**: Double-check that **Data Out** is set to `ON`, the IP Address is set to `127.0.0.1`, and the Port is set to `5600` in the game's **HUD and Gameplay** settings.
- **Bridge Port Conflict**: If the bridge cannot start, verify that port `5600` (UDP) and port `5601` (TCP) are not occupied by other applications on your PC.

---

## Calibration

Key empirical constants calibrated from real Forza data:

| Constant | Value | Description |
|---|---|---|
| `ARB_RS_SCALE` | 240 | Maps ARB click → roll stiffness (N·m/rad) |
| `DAMPING_CALIBRATION` | 0.00135 | Maps damper click → critical damping coefficient. Empirically validated via SimHub telemetry: Forza uses lbf/ft/s internally, not N/mm/s — the ×1.35 correction factor confirmed by comparing suspension settling behaviour under baseline vs corrected damper values |
| `TIRE_LOAD_SENS` | 0.15 | Grip falloff per unit Fz/Fz_ref — the tyre load sensitivity that lets roll stiffness shift balance |
| `TIRE_MECH_SCALE` | 0.08 | Tyre width rear/front ratio → mech balance offset via `0.08 × ln(twR/twF)`. Forza's displayed mech balance incorporates tyre width asymmetry; this correction ensures the calculator's output matches Forza's reading. Calibrated from Stage 2 testing (same suspension, tyre widths swapped) across MX-5, Ultima, and Scirocco |
| `MECH_BAL_GAIN` | 1.8 | Axle grip-capacity delta → balance offset (calibrated to the 0.5-neutral scale) |
| `MECH_BALANCE_TARGET` | 0.65 | Default handling target used by MECH, CO-SOLVE, MECH rear-Hz mode, and related guidance before user adjustment |
| `WIDTH_GRIP_EXP` | 0.4 | Tyre width → grip capacity, sub-linear exponent |
| `DIFF_BIAS_SCALE` | 0.14 | Diff lock % → handling bias contribution |
| `BRAKE_BIAS_SCALE` | 0.20 | Brake balance deviation → handling bias contribution |

**Mechanical balance accuracy:**

Mechanical balance (the **MECH BALANCE** readout) is the roll-stiffness rear fraction, matching the metric Forza displays. The calculator's prediction includes tire-width correction via `TIRE_MECH_SCALE`. 

For **asymmetric tires** (different widths front/rear), the correction typically brings error down to **±0.02**.

For **symmetric tires** (same width front/rear), a small residual offset remains (**±0.01 to ±0.04**, larger for extreme setups with very soft springs + high ARBs). This is not an ARB_RS_SCALE error — springs contribute 88%+ of total roll stiffness, so scaling adjustments have negligible effect on the mechBalance ratio. The residual reflects Forza's incorporation of minor load-sensitivity and motion-ratio effects not captured in the simplified roll-stiffness-only model. Use the **MAN mode** to directly input your real in-game ARB values and verify the calculator against Forza's actual reading.

The physical at-limit tendency (**GRIP BIAS**) is derived separately from a lateral-load-transfer model: front/rear load transfer set by the roll-stiffness ratio, tyre load sensitivity (`TIRE_LOAD_SENS`), and tyre width as a sub-linear grip multiplier (`WIDTH_GRIP_EXP`). The two are reconciled by bisection so a balance target round-trips to the spring/ARB split that achieves it.

---

## Compatibility

- **Desktop:** Chrome, Firefox, Safari, Edge
- **Mobile:** iOS Safari (iPhone/iPad), Android Chrome
- Works fully **offline** after first load
- No build step, no Node.js, no dependencies

### Responsive layout

The UI adapts at two breakpoints:

- **< 768px (tablet/phone):** the input sidebar becomes a slide-out drawer (☰ toggle, tap-outside to close); unit/game-mode and BEG/INT/PRO controls move out of the header into their own rows.
- **< 480px (phone portrait):** the page renders at native 1.0× zoom (the zoom controls are hidden), the ANTI-ROLL BARS and SPRINGS cards stack vertically, number inputs shrink to fit, and the pinned **Handling Balance** footer collapses to a single summary line (oversteer value + tendency + mech balance) — tap it to expand the full Balance / Mech / Response bars, then **CONTRIBUTIONS** for the contributor breakdown and actionable tip.

The header and pinned footer respect device safe areas (`env(safe-area-inset-*)`), so they clear the notch and home indicator on modern phones. The layout is sized with the dynamic viewport unit (`100dvh`), so the pinned footer stays visible as the mobile browser's address bar collapses and expands rather than being hidden behind it.

---

## How It Works & Architecture

The application is structured as a modular codebase under `src/` that compiles into a single self-contained, offline-capable `index.html` file using a zero-dependency build-time assembler:

- **Source Layout (`src/`)**:
  - `src/physics.js`: Core physics engine, algorithms (`flatRideRearHz`, `computeTune`, `computeAlignment`, `computeDiff`), constants, and solver calculations.
  - `src/codec.js`: Base64 share code encoder, decoder, and input sanitization logic.
  - `src/app.jsx`: React application UI, state, event handlers, and telemetry visualization.
  - `src/components/`: Sub-components of the UI (arranged alphabetically/numerically).
  - `src/styles.css`: Stylesheets and CSS variables.
  - `src/index.template.html`: Raw HTML structure acting as the template into which assets are injected.
  - `src/bootstrap.js`: Client-side startup script that mounts the React application.

- **Build-Time Assembly**:
  - `assemble.js`: A zero-dependency script that compiles and packages the split modular source files under `src/` into the root-level `index.html`. It normalizes all newlines to `\n` to guarantee a deterministic byte-for-byte output across platforms.
  - Compile the application by running:
    ```bash
    node assemble.js
    ```
  - **Automatic Compilation**: The Windows launcher `launch.bat` executes `node assemble.js` automatically every time you start the app, ensuring that you are always running the latest version of the code.

---

## Development & Testing

During development, write modular code under `src/`. Do not edit `index.html` directly, as it will be overwritten during assembly.

A comprehensive test suite is located in the root directory and can be run using Node.js (v16+):

- **Running Tests**:
  - Run the complete test suite:
    ```bash
    node tests.js
    ```
  - This command runs:
    1. **Synchronization Check**: Verifies that the compiled root-level `index.html` is byte-for-byte identical to the in-memory assembly of the files under `src/`. If they are out of sync, it outputs a loud error instructing you to run `node assemble.js`.
    2. **Unit Tests (135 tests)**: Verifies internal physics functions, load transfer calculations, telemetry parser profiles, weight estimators, state machine flows, and share code codecs.
    3. **Regression Suite (115 tests)**: Validates complex solver outputs and codec round-trips against a baseline snapshot of expected results.

- **Regression Runner**:
  - The regression test runner is defined in `tests/regression-runner.js`. It compares calculated outputs against the baseline snapshots stored in `tests/fixtures/regression_suite.json`.
  - It utilizes a tolerance of `1e-5` for raw floating-point calculation values and requires exact matches for strings, booleans, enums, share codes, and rounded UI clicks.

- **Regenerating Snapshot Fixtures**:
  - If you intentionally change physics constants, logic, or equations, you must regenerate the baseline regression snapshots:
    ```bash
    node tests/generate-regression-fixtures.js
    ```
  - This script compiles the physics and codec block, runs the test scenarios, and writes the updated baselines to `tests/fixtures/regression_suite.json`.

---

## Credits

- Physics foundation: [NumberlessMath](https://forums.forza.net/t/beta-forza-suspension-calculator/97135) (2020)
- Local reference exports: `forza-suspension-calculator/Forza Suspension Calculator (Beta) - Forza Suspension Calculator.csv` and `forza-suspension-calculator/Beta - Forza Suspension Calculator - Community Content _ Tuning - Official Forza Community Forums (08_06_2026 06.20.14).html`
- Mechanical balance calibration: Forza early access data (4-point LC 500 dataset)

---

## License

MIT

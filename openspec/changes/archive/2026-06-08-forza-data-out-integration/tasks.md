# Implementation Tasks: Forza Telemetry Integration

This document outlines the sequential phases to implement the Forza Data Out telemetry integration. Each phase represents a verifiable step toward the complete feature.

---

## Phase 1: Bridge Server and Launcher Shortcut (`forza-bridge.js` and `launch.bat`)
- **Objective**: Establish a zero-dependency local backend proxy that listens to Forza UDP data and broadcasts it via Server-Sent Events (SSE), and a single-click Windows batch file launcher.
- **Scope**: Create `forza-bridge.js` and `launch.bat`.
- **Non-Goals**: No changes to `index.html` or existing frontend calculators.
- **Tasks**:
  - [x] Initialize `forza-bridge.js` in the repository root.
  - [x] Create UDP socket listening on port `5600` (default) using `dgram`.
  - [x] Implement an HTTP server on port `5601` with an SSE endpoint at `/telemetry`.
  - [x] Add graceful `EADDRINUSE` port collision error handling to the HTTP server in `forza-bridge.js`.
  - [x] Implement UDP payload parser for FH5 (312 bytes) and FH6 (324 bytes) packet formats.
  - [x] Extract key parameters using Little-Endian reads (e.g., `CarOrdinal`, `EngineMaxRpm`, `CurrentEngineRpm`, `Speed`, `Power`, `Torque`, `DrivetrainType`, `Throttle` (Accel), `Brake`, `AccelerationZ`).
  - [x] Broadcast parsed data to SSE clients as serialized JSON.
  - [x] Create `launch.bat` in the repository root with robust pathing (`pushd`), Node.js availability pre-check, background browser launch, and foreground bridge execution.
- **Verification**: Run `node forza-bridge.js` and query the endpoint using curl: `curl -N http://localhost:5601/telemetry` while sending mock UDP packets. Test double-clicking `launch.bat` to verify it displays a status console, handles Node absence gracefully, launches browser, and terminates Node when closed.

---

## Phase 2: Frontend Telemetry EventSource and UI Connection Panel
- **Objective**: Connect the frontend React application to the SSE stream and show connection diagnostics in the sidebar.
- **Scope**: Modify UI in `index.html` to add the settings block.
- **Non-Goals**: No auto-filling of physics inputs yet.
- **Tasks**:
  - [x] Implement `EventSource` initialization, subscription, and cleanup in a React `useEffect` hook.
  - [x] Add the "Live Telemetry" settings panel inside the sidebar or under general settings in `index.html`.
  - [x] Add input field for the bridge URL (default: `http://localhost:5601/telemetry`) and a Connect/Disconnect toggle button.
  - [x] Track and display connection state (`Disconnected`, `Connecting`, `Connected`) with corresponding indicator colors (Red/Yellow/Green).
  - [x] Render live diagnostics in the UI: current RPM, Speed, and active `CarOrdinal`.
- **Verification**: Run the bridge and load the calculator page. Verify that clicking "Connect" establishes the SSE connection, changes status to "Connected", and prints live RPM/Speed.

---

## Phase 3: Peak Spec Tracking, Lookup Database, and Mass Estimation
- **Objective**: Implement peak power tracking, static model spec lookups, and sliding-window median-filtered weight estimation.
- **Scope**: Modify physics state mapping and add the static lookup database in `index.html`.
- **Non-Goals**: Keep fields editable (UI lock badge logic is implemented in the next phase).
- **Tasks**:
  - [x] Embed the static lookup database (`CAR_DATABASE`) mapping key `CarOrdinal` values to stock `{ name, weight, frontBias, layout }`.
  - [x] Implement maximum tracker for HP and Torque: `HP_peak = Math.max(HP_peak, Power / 745.7)` and `Torque_peak = Math.max(Torque_peak, Torque * 0.73756)`.
  - [x] Implement the dynamic weight estimation calculation: `Weight = Power / (v * ax)` (converted to lbs).
  - [x] Implement filter conditions to execute the mass equation: throttle > 80% (`throttle > 204`), brake = 0 (`brake === 0`), speed > 10 m/s, and acceleration > 0.5 m/s².
  - [x] Implement a sliding window queue (size 80) and a median calculation helper function to filter noise out of the dynamic weight estimate.
- **Verification**: Simulate driving using mock telemetry data. Verify that peak values track correctly and that weight estimation stabilizes to the target mass under simulated acceleration.

---

## Phase 4: UI Lock Badges and Input Synchronization
- **Objective**: Bind inputs to live values when locked and preserve manual overrides when unlocked.
- **Scope**: Modify frontend input components for Weight, Front Bias, and Layout in `index.html`.
- **Non-Goals**: No changes to core math formulas.
- **Tasks**:
  - [x] Add state variables for locking (`weightLocked`, `frontBiasLocked`, `layoutLocked`), defaulting to true.
  - [x] Render lock badges (🔒/🔓) adjacent to input labels for Weight, Front Bias, and Layout.
  - [x] Bind value inputs to live telemetry estimations/lookups when locked, and disable manual keyboard inputs for those fields.
  - [x] Enable normal manual input editing when the lock is toggled to unlocked (🔓), ignoring subsequent telemetry updates for that field.
- **Verification**: Toggling the lock button back and forth should switch between manual entry (unlocked) and telemetry-driven read-only sync (locked).

---

## Phase 5: Testing, Validation, and Documentation
- **Objective**: Ensure regression safety, test parsing logic, and update user-facing documentation.
- **Scope**: Update `tests.js` and `README.md`.
- **Non-Goals**: No new features or code changes.
- **Tasks**:
  - [x] Add unit tests in `tests.js` to verify:
    - Median filter logic (e.g. median of odd/even arrays, arrays with spikes).
    - Mass calculation formula and its speed/throttle/brake constraints.
  - [x] Run the test suite (`node tests.js`) to guarantee no regression on core calculator physics.
  - [x] Update `README.md` to document the new Live Telemetry feature:
    - Bridge installation and run instructions (`node forza-bridge.js`).
    - Drivetrain mapping, AppContainer loopback workarounds for Windows Store users, and port setup.
- **Verification**: Run `node tests.js` and verify all checks pass successfully. Verify OpenSpec validation: `openspec validate --all`.

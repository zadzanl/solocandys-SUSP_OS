## Why

Currently, SUSP.OS requires users to manually copy car specifications—such as total weight, front weight bias, drivetrain layout, peak power, and maximum RPM—directly from the Forza in-game menus into the web calculator. This manual process introduces several issues:
- **Friction in the Tuning Loop**: Switching back and forth between the game (often in full-screen) and the calculator to transcribe numbers is slow and disrupts the player's workflow.
- **Input Error Susceptibility**: Typographical errors in key parameters (e.g., misentering weight or weight distribution) lead to incorrect physical calculations and bad suspension recommendations.
- **Upgrade Dynamism**: Players frequently upgrade car components (weight reduction, engine parts, drivetrain swaps). Every upgrade changes the car's weight, bias, layout, power, and RPM limits, forcing users to repeatedly re-enter values.

Integrating Forza's **Data Out UDP Telemetry API** solves this by establishing a real-time connection that automatically pulls these specifications. By simply enabling telemetry in the game and driving for a brief moment, the app will dynamically auto-populate these parameters. This creates a seamless, hands-free tuning experience.

## What Changes

The telemetry integration introduces the following components and updates:

1. **Lightweight Node.js UDP Bridge (`forza-bridge.js`)**:
   - Because modern web browsers cannot listen directly to raw UDP sockets due to security and platform sandbox limitations, a local backend proxy is required.
   - We will introduce a lightweight, dependency-free Node.js script that listens on a configurable local UDP port (defaulting to Forza's standard `5343` or `9999`) for incoming telemetry packets.
   - The bridge parses the binary packet format (specifically the V2 "Car Dash" structure) and extracts the active `CarOrdinal` (car model ID), engine RPM, drivetrain values, and instant power metrics.
   - The bridge hosts a local HTTP server (e.g., port `5601`) and uses Server-Sent Events (SSE) to stream parsed, human-readable JSON payloads to the front-end client.

2. **Forza Telemetry Connection UI Panel**:
   - A new telemetry status and configuration panel will be added to the SUSP.OS interface.
   - Displays real-time connection states: **Disconnected**, **Connecting**, or **Connected (Receiving Data)**.
   - Shows live telemetry diagnostics such as current engine RPM, speed, and active `CarOrdinal`.
   - Includes controls to select the local bridge port, and toggles for enabling/disabling auto-fill behavior.

3. **Lookup Database & Dynamic Parameter Extraction**:
   - **Baseline Specs via Lookup**: A JSON database mapping standard `CarOrdinal` numbers to car names, static weight, front weight bias, and drivetrain layouts will be integrated. When the UDP stream detects a new `CarOrdinal`, it automatically retrieves the baseline specs of the car.
   - **Dynamic Tuning Corrections**: 
     - **Max RPM**: Extracted from the telemetry payload's `EngineMaxRpm` field or observed peak RPM during driving.
     - **Power**: Derived by tracking the peak `Power` value sent dynamically during live driving.
     - **Drivetrain Layout**: Determined automatically by comparing tire slip ratios (`TireSlipRatio`) and wheel rotational speeds (`WheelRotationSpeed`) on driven vs. non-driven axles under throttle, or via the lookup database.
     - **Upgraded Weight / Weight Bias**: Estimated by combining baseline lookup values with live suspension deflection adjustments or offering a quick-override option in the UI when aftermarket weight upgrades are detected.

4. **UI Value Locking & Status Badges**:
   - Input fields that have been auto-populated via telemetry (Weight, Front Bias, Layout, Power, Max RPM) will display a subtle "Live" or "Synced" badge.
   - Manual override is preserved: users can click a lock/unlock icon to decouple the inputs from telemetry and manually adjust values at any time.

5. **Launcher Shortcut (`launch.bat`)**:
   - A simple batch script to automate launching the tool.
   - Double-clicking the file starts the Node.js bridge in the background (using standard `start /b`) and opens the `index.html` application in the default web browser. Closing the terminal terminates the bridge.

## Capabilities

### New Capabilities
- `forza-data-out`: Enables real-time connection to a local Forza telemetry stream, auto-populating vehicle parameters (weight, bias, drivetrain, power, max RPM) dynamically from live driving or a lookup database.

### Modified Capabilities
- `vehicle-controls`: Update requirements to allow input fields (Weight, Front Bias, Layout) to accept values pushed dynamically from the telemetry client.

## Impact

- **UI & Frontend (`index.html`)**:
  - Adds the "Forza Connection" panel to the sidebar or header (adaptive to mobile layouts).
  - Wires input controls for Weight, Front Bias, Drivetrain Layout, Power, and Max RPM to listen to incoming state updates from the WebSocket listener.
  - Adds visual status badges and connection state icons to the inputs and header.
- **Node.js Environment**:
  - Introduces a local bridge server (`forza-bridge.js`) run via command line (e.g., `node forza-bridge.js`).
  - Introduces a `launch.bat` batch script to automate launching the bridge and opening the front-end in one step.
  - No external compiler or build steps are introduced, keeping development aligned with the simple, single-page architecture of the project.
- **Network / Security**:
  - Utilizes local UDP socket binding on port `5600` (default) and local HTTP/SSE server binding on port `5601`.
  - Documentation will be updated to guide users on enabling local loopback utility (`AppContainer Loopback Utility` for Windows Store/Game Pass versions) and configuring in-game telemetry settings.
- **Dependencies**:
  - No new frontend or backend dependencies. The entire system is built on standard Node.js and browser APIs (zero `npm install`).
- **Backward Compatibility**:
  - The telemetry connection is entirely opt-in. If the bridge is not running, the application continues to run in pure offline/manual input mode with zero functional degradation.

# Design: Forza Data Out UDP Integration

This document describes the architectural design and integration plan for connecting SUSP.OS directly to live telemetry streams from Forza Horizon and Forza Motorsport.

## Context

Currently, users must manually copy vehicle parameters (weight, bias, layout, power, max RPM) from in-game menus into the SUSP.OS calculator. This process is slow, prone to data entry errors, and must be repeated every time a car is upgraded or swapped.

Forza games support a **Data Out** UDP telemetry streaming feature. By implementing a local bridge server and adding native telemetry hooks to the browser-based calculator, we can automatically extract, estimate, and synchronize these vehicle stats in real time.

---

## Goals / Non-Goals

### Goals
- **Zero-Dependency Bridge**: Implement a lightweight backend proxy (`forza-bridge.js`) in pure Node.js with absolutely zero third-party dependencies (no `npm install` required).
- **Server-Sent Events (SSE)**: Stream parsed telemetry using SSE (`EventSource`) instead of WebSockets. This eliminates the need for external libraries like `ws` and keeps the server codebase minimal.
- **Dynamic Spec Extraction**: Automatically detect engine RPM boundaries, peak torque/horsepower, and drivetrain layout from live telemetry signals.
- **Median-Filtered Mass Estimation**: Accurately estimate upgraded vehicle mass using raw power, velocity, and longitudinal acceleration filtered through a sliding window median.
- **Lookup Database**: Match base vehicle models instantly via their unique `CarOrdinal` code to pull baseline weight, front bias, layout, and name.
- **Manual Overrides**: Ensure the user remains in control with visual lock toggles that decouple inputs from live telemetry updates.

### Non-Goals
- Do not add compile/build steps or package managers to the front-end code (preserve the single-file React 18 UMD architecture).
- Do not block or force connection (telemetry must remain fully opt-in, falling back to manual inputs).
- Do not attempt to dynamically compute spring or damper rates in the backend (all physics solving remains in the React engine).

---

## Technical Decisions

### 1. Bridge Server Implementation (`forza-bridge.js`)

Because web browsers cannot open raw UDP sockets due to security sandboxing, a local Node.js proxy bridge is used. 

```
+--------------------+        UDP (Port 5600)        +-------------------+
|  Forza Horizon 5/6 |  -------------------------->  |  forza-bridge.js  |
+--------------------+                               +-------------------+
                                                               |
                                                               | SSE (Port 5601)
                                                               v
                                                     +-------------------+
                                                     |    index.html     |
                                                     |    (Browser)      |
                                                     +-------------------+
```

- **Protocol & Network**:
  - The bridge binds a UDP socket to port `5600` (default) using Node's native `dgram` module.
  - It starts an HTTP server on port `5601` using Node's native `http` module.
  - It exposes a single SSE endpoint at `GET /telemetry`. The response uses headers `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and `Connection: keep-alive` to stream JSON strings prefixed with `data: `.
- **Protocol Decoding**:
  - Forza supports V2 (Car Dash) telemetry formats. We handle both FH5 (312 bytes) and FH6 (324 bytes) by inspecting the incoming UDP buffer length.
  - The binary structure uses Little-Endian representation. The payload offsets are identical between FH5 and FH6; FH6 simply appends 12 bytes of extra lap/distance data to the end.
  - Key fields and byte offsets to extract:
    - `CarOrdinal`: `int32` at offset `212` (Unique ID of the vehicle model)
    - `EngineMaxRpm`: `float32` at offset `8`
    - `CurrentEngineRpm`: `float32` at offset `16`
    - `Speed`: `float32` at offset `256` in FH6 (244 in FH5) (meters per second, m/s)
    - `Power`: `float32` at offset `260` in FH6 (248 in FH5) (Watts, W)
    - `Torque`: `float32` at offset `264` in FH6 (252 in FH5) (Newton-meters, N-m)
    - `DrivetrainType`: `int32` at offset `224` (0 = FWD, 1 = RWD, 2 = AWD)
    - `Throttle` (Accel): `uint8` at offset `315` in FH6 (303 in FH5) (range 0 to 255)
    - `Brake`: `uint8` at offset `316` in FH6 (304 in FH5) (range 0 to 255)
    - `AccelerationZ`: `float32` at offset `28` (local longitudinal acceleration, m/s²)

### 2. Frontend Client Integration (`index.html`)

- **Connection Handler**:
  - Establishes a native connection via `new EventSource("http://localhost:5601/telemetry")`.
  - Manages three primary connection states:
    - **Disconnected**: EventSource is closed or has errored.
    - **Connecting**: Instantiated and awaiting the first event or handshake.
    - **Connected**: Actively receiving `/telemetry` events.
- **Sidebar Integration**:
  - Add a "Live Telemetry" card inside the Settings / Sidebar layout.
  - Includes a text input for the bridge URL (e.g., `http://localhost:5601/telemetry`), a connection toggle button (Connect/Disconnect), and connection status colors (Red/Yellow/Green).
  - Displays live diagnostics: current RPM (gauge or number), speed (MPH/KMH depending on unit settings), and the active `CarOrdinal`.

### 3. Mass and Spec Extraction

#### Static Lookup Database
A static JSON map embedded within the client stores metadata for base cars:
```json
const CAR_DATABASE = {
  "1234": { "name": "2019 Porsche 911 GT3 RS", "weight": 3150, "frontBias": 40, "layout": "RWD" },
  "5678": { "name": "2020 Chevrolet Corvette Stingray", "weight": 3647, "frontBias": 40, "layout": "RWD" }
};
```
When `CarOrdinal` is detected, if it matches an entry in `CAR_DATABASE`, the baseline values are loaded instantly.

#### Peak HP & Torque Tracking
Forza's `Power` and `Torque` variables represent instant outputs. To calculate peak values, the frontend tracks historical maximums while the connection is active:
$$\text{HP}_{\text{peak}} = \max\left(\text{HP}_{\text{peak}}, \frac{\text{Power}_{\text{live}}}{745.7}\right)$$
$$\text{Torque}_{\text{peak}} = \max\left(\text{Torque}_{\text{peak}}, \text{Torque}_{\text{live}} \cdot 0.73756\right)$$

#### Dynamic Weight Estimation
When a vehicle has upgrades (such as weight reduction), its actual weight deviates from the static database. We estimate the operational weight dynamically during acceleration:
$$m = \frac{\text{Power}}{v \cdot a_x}$$
where:
- $m$ is the vehicle mass in kilograms.
- $\text{Power}$ is the telemetry engine power in Watts (offset 260).
- $v$ is the speed in meters per second (offset 256).
- $a_x$ is the longitudinal acceleration (offset 28, `AccelerationZ`).

To prevent divide-by-zero errors, gravity offsets, and drivetrain transition spikes, calculations are only performed when:
1. **Throttle** $> 80\%$ (`throttle > 204`) to ensure full engine load.
2. **Brake** $= 0$ (`brake === 0`) to avoid negative braking forces.
3. **Speed** $> 10 \text{ m/s}$ (approx 22.4 MPH) to avoid low-speed singularities.
4. **Longitudinal Acceleration** $> 0.5 \text{ m/s}^2$ to guarantee stable acceleration.

*Filtering*: A sliding window queue of size 80 is populated with raw calculated mass values. The **median** value of this window is used as the stable weight estimate.

### 4. Chassis Override & Lock Toggles

- **Lock Badges**: Add visual badge indicators (🔒/🔓) adjacent to the **Weight**, **Front Bias**, and **Drivetrain Layout** input labels in the UI.
- **Synchronized State**:
  - When **locked** (default on telemetry connect): The inputs are read-only and automatically updated. Weight updates from either the lookup database or the dynamic estimator. Bias and Layout update from the lookup database.
  - When **unlocked**: The user can manually type or override these values. The app retains user inputs and ignores telemetry updates for that specific field.

### 5. Launcher Shortcut (`launch.bat`)

To provide a seamless, single-click launching flow for Windows users without needing to run separate commands in cmd:
- A batch file `launch.bat` will be placed in the project root.
- Content:
  ```cmd
  @echo off
  setlocal enabledelayedexpansion

  :: Navigate to script directory to support running from shortcuts or other working directories
  pushd "%~dp0"

  echo ===================================================
  echo   SUSP.OS Telemetry Bridge Launcher
  echo ===================================================
  echo.

  :: 1. Pre-check: Verify Node.js is installed and available in PATH
  where node >nul 2>&1
  if %errorlevel% neq 0 (
      echo [WARNING] Node.js is not installed or not found in your system PATH.
      echo.
      echo The Telemetry Bridge requires Node.js to receive and process Forza UDP packets.
      echo Please download and install Node.js from: https://nodejs.org/
      echo.
      echo The SUSP.OS Calculator will be opened, but Live Telemetry features will not be active.
      echo.
      pause
      goto LaunchUI
  )

  :: 2. Inform the user and prepare to launch in foreground
  echo Starting SUSP.OS Telemetry Bridge...
  echo [NOTE] Keep this window open while playing Forza to sync telemetry data.
  echo        To stop the bridge, press Ctrl+C or close this window.
  echo.

  :LaunchUI
  echo Launching SUSP.OS Calculator in default browser...
  start "" "index.html"

  :: 3. Run Node.js bridge in the foreground of this command window
  where node >nul 2>&1
  if %errorlevel% equ 0 (
      node "forza-bridge.js"
  )

  :: Restore directory context
  popd
  ```
  - Using `pushd "%~dp0"` handles space characters in folders and UNC network shares.
  - The script pre-checks for Node.js using `where node`. If Node is missing, it displays a friendly warning, pauses the terminal, and launches `index.html` in default/manual mode.
  - The browser UI is launched asynchronously using `start "" "index.html"`.
  - The Node.js bridge is executed in the *foreground* of the terminal. This provides a visible logging console, ensures that Ctrl+C or closing the terminal window immediately kills the Node process, and prevents orphaned processes from locking up ports `5600`/`5601`.

### 6. Port Collision Handling in `forza-bridge.js`

If another instance of the bridge is already running, the server will throw an `EADDRINUSE` error. The bridge server will handle this error gracefully:
```javascript
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n==================================================================');
    console.error('ERROR: Port 5601 is already in use!');
    console.error('The Telemetry Bridge is likely already running in another window.');
    console.error('Please close existing bridge consoles before running the launcher.');
    console.error('==================================================================\n');
    process.exit(1);
  }
});
```

---

## Risks / Trade-offs

| Risk | Impact | Mitigation |
| :--- | :--- | :--- |
| **Telemetry noise and spikes** | Noise from bumps, gear shifts, and wheel spin causes calculated weight to fluctuate wildly. | Apply strict filtering thresholds (high throttle, no brakes, minimum speed/accel) and compute a sliding window median (size 80) instead of a simple mean. |
| **Upgraded Car Spec Drift** | Base lookup database records the stock configuration, but upgraded cars have different weights. | The static database serves as the initial placeholder. The dynamic mass estimator updates the weight to capture aftermarket upgrades once the car is driven. |
| **Windows AppContainer Loopback** | Forza (on PC Microsoft Store/Game Pass) cannot send UDP traffic to local loopback `127.0.0.1` due to Windows sandboxing. | Document this platform limitation in the UI settings/docs and instruct users to run the AppContainer loopback utility. |

---

## Verification Plan

1. **Unit Tests (`tests.js`)**:
   - Add a test suite for binary telemetry packet parsing (simulating FH5 and FH6 buffers).
   - Add a test suite for the sliding-window median filter calculation.
   - Add mathematical checks for the dynamic weight estimation formula.
2. **Integration Verification**:
   - Verify that toggling the lock badges isolates inputs from live updates.
   - Verify that the EventSource connection handles connection failures gracefully and retries.

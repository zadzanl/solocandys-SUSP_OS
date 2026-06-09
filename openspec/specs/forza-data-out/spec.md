# forza-data-out Specification

## Purpose
Enables real-time integration with Forza Horizon and Forza Motorsport UDP telemetry stream via a local UDP-to-SSE bridge to automate vehicle parameter entry and tuning calculations.
## Requirements
### Requirement: Bridge connection and status
The system MUST connect to the local UDP-to-SSE bridge at `http://localhost:5601/telemetry` to receive telemetry diagnostics, and it MUST distinguish bridge connectivity from UDP packet availability and capture state.

#### Scenario: Connecting to the bridge
- **WHEN** the user initiates the telemetry connection
- **THEN** the system attempts to establish an SSE connection to `http://localhost:5601/telemetry` and displays a bridge status of "Connecting"

#### Scenario: Bridge connected but waiting for driving packets
- **WHEN** the SSE connection to `http://localhost:5601/telemetry` is open but no valid Forza UDP packets have been received recently
- **THEN** the system displays the bridge as connected and displays packet/capture status as waiting or idle instead of implying active telemetry capture

#### Scenario: Receiving valid driving packets
- **WHEN** valid Forza UDP packets are received while the vehicle is driving or racing
- **THEN** the system displays packet diagnostics such as last packet age, packet count or rate, detected format where available, current RPM, speed, and detected `CarOrdinal`

#### Scenario: Telemetry becomes stale
- **WHEN** the bridge remains connected but packets stop arriving after a recent capture or driving session
- **THEN** the system displays telemetry as stale or paused and retains any pending or applied snapshot without changing calculator inputs

#### Scenario: Connection disconnected or lost
- **WHEN** the SSE connection is closed or fails to connect
- **THEN** the system displays a bridge status of "Disconnected" and stops receiving new telemetry diagnostics

### Requirement: Protocol parsing
The system MUST parse supported incoming binary telemetry payloads using Little-Endian encoding for diagnostics and capture candidates, and parsed packet values MUST NOT continuously mutate calculator inputs.

#### Scenario: Parse supported Horizon telemetry packet
- **WHEN** a supported Horizon-format binary payload is received by the bridge
- **THEN** the system parses relevant fields such as `EngineMaxRpm`, `CurrentEngineRpm`, `DrivetrainType`, `Power`, `Torque`, `Speed`, `CarOrdinal`, throttle/brake inputs, and acceleration according to the selected or detected Horizon parser profile

#### Scenario: Parse supported Motorsport telemetry packet
- **WHEN** a supported Motorsport-format binary payload is received by the bridge
- **THEN** the system parses relevant fields according to the selected or detected Motorsport parser profile and does not read dashboard-only fields from a Sled-only packet

#### Scenario: Unsupported packet format
- **WHEN** a packet length or selected parser profile is unsupported or inconsistent
- **THEN** the system reports a packet-format warning and does not use that packet to create calculator input candidates

#### Scenario: Continue diagnostics after capture closes
- **WHEN** packets continue arriving after a bounded capture has completed
- **THEN** the system may update visible diagnostics but MUST NOT change calculator inputs unless the user explicitly starts and applies a new capture

### Requirement: Dynamic mass estimation
The system MUST treat vehicle mass calculation from telemetry as a bounded capture estimate, not as a continuously synchronized or directly streamed weight value.

#### Scenario: Calculate candidate mass during active capture
- **WHEN** a capture is active and the vehicle is under stable acceleration such that speed `v` is above a minimum threshold, longitudinal acceleration `ax` is positive and stable, power output is valid, throttle is high, and braking is inactive
- **THEN** the system may calculate candidate weight using `Power / (v * ax)` with unit conversion and include it in the pending snapshot as an estimated value with confidence metadata

#### Scenario: Skip mass estimation when not accelerating
- **WHEN** the vehicle is coasting, braking, slipping unstably, shifting unstably, or speed/acceleration values are near zero or invalid
- **THEN** the system ignores those samples for mass estimation to prevent mathematical divisions by zero or wild fluctuations

#### Scenario: Reject insufficient mass samples
- **WHEN** the bounded capture window ends with too few valid or stable samples for mass estimation
- **THEN** the system does not update the calculator weight from telemetry and reports the candidate weight as unavailable or insufficient-data

#### Scenario: No continuous weight mutation
- **WHEN** capture is complete or a snapshot has already been applied
- **THEN** future telemetry packets MUST NOT change the calculator weight unless the user explicitly captures and applies a new snapshot

### Requirement: Database lookup
The system MUST lookup the vehicle's baseline specifications in a local database using the telemetry-provided `CarOrdinal` and present matches as snapshot candidates with visible provenance instead of silently pre-filling calculator inputs.

#### Scenario: Find car in lookup database
- **WHEN** a valid captured `CarOrdinal` exists in the local database
- **THEN** the system presents candidate vehicle name, stock baseline weight, front weight bias, and drivetrain layout as lookup-derived values in the pending snapshot

#### Scenario: Car not found in lookup database
- **WHEN** the captured `CarOrdinal` does not match any entry in the local database
- **THEN** the system retains existing calculator inputs and shows the numerical `CarOrdinal` with weight, front bias, and lookup-only values marked unavailable or manual-required

#### Scenario: Apply lookup values explicitly
- **WHEN** the user confirms applying one or more lookup-derived snapshot candidates
- **THEN** the selected calculator fields update once and future packets do not overwrite those fields without another explicit capture and apply action

### Requirement: Bounded first-drive capture
The system MUST capture Forza Data Out for calculator assistance only during a bounded first-drive window after connection or during an explicit user-requested recapture, with the default capture duration constrained to a short window suitable for a first drive sample, such as about 5–10 seconds.

#### Scenario: Start first-drive capture
- **WHEN** the bridge is connected, no pending or applied snapshot exists for the current telemetry session, and the first valid driving packets arrive
- **THEN** the system starts a bounded first-drive capture window

#### Scenario: Complete capture window
- **WHEN** the capture window reaches its configured duration, valid-sample target, user cancellation, or timeout
- **THEN** the system closes the capture and creates a pending snapshot or reports insufficient data

#### Scenario: Explicit recapture
- **WHEN** the user activates a recapture control
- **THEN** the system starts a new bounded capture window and does not replace confirmed calculator inputs until the user applies the new snapshot

### Requirement: Snapshot review and explicit apply
The system MUST present captured values as a pending snapshot for user review before calculator inputs are changed.

#### Scenario: Present pending snapshot
- **WHEN** a capture completes with any parsed, lookup-derived, or estimated candidates
- **THEN** the system displays each candidate with value, source, confidence, and explanation before applying it to calculator inputs

#### Scenario: Apply selected candidates
- **WHEN** the user confirms selected snapshot candidates
- **THEN** the system updates only those selected calculator fields once and records their source metadata

#### Scenario: Keep current inputs
- **WHEN** the user rejects, ignores, or cancels a pending snapshot
- **THEN** existing calculator inputs remain unchanged

### Requirement: Data Out limitations disclosure
The system MUST disclose that Forza Data Out is a driving telemetry stream and not a complete vehicle or tuning configuration API.

#### Scenario: Explain driving-only stream
- **WHEN** the bridge is connected but no packets are arriving
- **THEN** the system explains that Forza Data Out typically streams only while driving or racing and stops in menus or tuning screens

#### Scenario: Explain unavailable direct fields
- **WHEN** displaying capture results for weight, front bias, installed upgrades, or tune settings
- **THEN** the system indicates that those values are not directly provided by Data Out and must come from manual entry, lookup, or clearly labeled estimates


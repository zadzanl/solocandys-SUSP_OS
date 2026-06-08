# forza-data-out Specification

## Purpose
Enables real-time integration with Forza Horizon and Forza Motorsport UDP telemetry stream via a local UDP-to-WebSocket bridge to automate vehicle parameter entry and tuning calculations.

## ADDED Requirements

### Requirement: Bridge connection and status
The system MUST connect to the local UDP-to-WebSocket bridge at `ws://localhost:5601` to receive telemetry, and it MUST display the current connection status to the user.

#### Scenario: Connecting to the bridge
- **WHEN** the user initiates the telemetry connection or the page loads with auto-connect enabled
- **THEN** the system attempts to establish a WebSocket connection to `ws://localhost:5601` and displays a status of "Connecting"

#### Scenario: Successful connection
- **WHEN** the WebSocket connection to `ws://localhost:5601` is successfully established and active telemetry packets are being received
- **THEN** the system displays a status of "Connected" along with live diagnostics (e.g. current RPM, speed, and detected CarOrdinal)

#### Scenario: Connection disconnected or lost
- **WHEN** the WebSocket connection is closed or fails to connect
- **THEN** the system displays a status of "Disconnected" and stops updating live telemetry values

### Requirement: Protocol parsing
The system MUST parse incoming binary telemetry payloads using a Little-Endian encoding, auto-detecting FH5 (312 bytes) versus FH6 (324 bytes) by packet length, and extracting key vehicle parameters.

#### Scenario: Parse FH5 telemetry packet
- **WHEN** a binary payload of 312 bytes is received via the WebSocket connection
- **THEN** the system parses the packet using Little-Endian format and extracts `EngineMaxRpm`, `DrivetrainType` (drivetrain layout), `Power`, `Torque`, and `CarOrdinal` based on FH5 offsets

#### Scenario: Parse FH6 telemetry packet
- **WHEN** a binary payload of 324 bytes is received via the WebSocket connection
- **THEN** the system parses the packet using Little-Endian format and extracts `EngineMaxRpm`, `DrivetrainType` (drivetrain layout), `Power`, `Torque`, and `CarOrdinal` based on FH6 offsets

### Requirement: Dynamic mass estimation
The system MUST dynamically estimate the vehicle's mass using the formula `Weight = Power / (v * ax)` during periods of stable, high-acceleration driving where telemetry inputs are valid.

#### Scenario: Calculate dynamic mass during acceleration
- **WHEN** the vehicle is under acceleration such that speed `v` is above a minimum threshold (e.g., > 10 m/s), longitudinal acceleration `ax` is positive and stable (e.g., > 1 m/s²), and telemetry power output is high (e.g., > 50% max power)
- **THEN** the system calculates estimated weight using `Power / (v * ax)` (adjusting for units) and updates the weight estimate dynamically or prompts the user with the estimated value

#### Scenario: Skip mass estimation when not accelerating
- **WHEN** the vehicle is coasting, braking, or speed/acceleration values are near zero or unstable
- **THEN** the system ignores the mass estimation formula to prevent mathematical divisions by zero or wild fluctuations

### Requirement: Database lookup
The system MUST lookup the vehicle's baseline specifications in a local database using the telemetry-provided `CarOrdinal` and pre-fill the weight and weight bias values if a match is found.

#### Scenario: Find car in lookup database
- **WHEN** a valid `CarOrdinal` is parsed from the telemetry stream and exists in the local database
- **THEN** the system pre-fills the UI inputs for vehicle weight, front weight bias, and drivetrain layout with the database's baseline values for that car model

#### Scenario: Car not found in lookup database
- **WHEN** the parsed `CarOrdinal` does not match any entry in the local database
- **THEN** the system retains the existing user inputs and shows the numerical `CarOrdinal` without pre-filling baseline weight/bias/layout

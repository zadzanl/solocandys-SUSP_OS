## Context

SUSP.OS currently has a Forza Data Out bridge and UI path that can receive UDP telemetry through a local Node.js UDP-to-SSE bridge. The archived integration framed this as live telemetry sync: incoming packets can update vehicle fields such as layout, weight, and front bias through locks and lookup/estimation logic.

The product constraint is sharper than that model allows. Forza Data Out is a one-way driving telemetry stream. It is not a car-build, tuning-screen, or stat-screen API. It only emits while driving/racing, while the player generally uses tuning/stat screens while not driving. It also does not directly include upgraded total weight, front weight bias, installed parts, spring rates, damping clicks, ARB clicks, brake balance, differential settings, or other tuning-screen values.

The enhancement therefore changes the integration from continuous live input mutation to a bounded acquisition workflow. Data Out becomes evidence for a snapshot, not the owner of calculator state.

## Goals / Non-Goals

**Goals:**
- Make the Data Out workflow understandable and trustworthy despite Forza's driving-only stream limitation.
- Parse/capture only during a short first-drive window after connection, or during an explicit user-requested recapture.
- Stop telemetry from continuously mutating calculator inputs after a capture closes or a snapshot is applied.
- Separate bridge connectivity, UDP packet availability, capture state, pending snapshot values, and confirmed calculator inputs.
- Present every candidate value with provenance and confidence.
- Keep manual calculator entry first-class and editable with no bridge running.
- Persist confirmed values and optional provenance metadata without making raw telemetry persistent calculator state.
- Preserve the existing no-build, no-package, single-file app constraints.

**Non-Goals:**
- Do not implement this change as part of this OpenSpec proposal.
- Do not read Forza menus, tuning screens, installed upgrade state, or stat screens directly.
- Do not claim exact upgraded weight, front bias, or tune settings are provided by Data Out.
- Do not keep continuously parsing/applying every packet to calculator inputs after initial capture, except for optional visible diagnostics.
- Do not make the bridge responsible for calculator state or tuning logic.
- Do not introduce a package manager, bundler, third-party WebSocket library, OCR, or game-control channel.
- Do not require Data Out for manual SUSP.OS use.

## Decisions

### Decision 1: Capture snapshot replaces continuous auto-sync

Telemetry is collected into a bounded capture session rather than continuously applied to calculator inputs. A capture starts when the first valid driving packets arrive after connect, or when the user explicitly requests recapture. It ends after a short configured window, preferably defaulting to about 5–10 seconds, enough valid samples, cancellation, timeout, or insufficient-data result.

Rationale: This mirrors the real user flow: drive briefly to emit telemetry, then return to menus/tuning with a cached snapshot. It also prevents live driving noise from changing calculator fields while the user is trying to tune.

Alternatives considered:
- Continue live-sync with better filters: rejected because it still implies Data Out is a live source of calculator truth.
- Parse only one packet: rejected because estimates and diagnostics need a short window to assess quality.

### Decision 2: Bridge remains transport/parser, frontend owns capture/apply

The bridge may parse packet fields and expose diagnostics such as packet length, parser profile, packet count, and last-packet timestamp. The frontend owns capture lifecycle, candidate generation, review, and apply decisions.

Rationale: The calculator state lives in the browser app. Keeping the bridge stateless/simple preserves the zero-dependency architecture and avoids splitting tuning logic across Node and React.

Alternatives considered:
- Put snapshot aggregation in the bridge: rejected because it makes browser UI state and calculator semantics harder to reason about.
- Send raw UDP bytes to the browser: rejected because browsers cannot receive UDP directly and pushing binary parsing into the UI does not improve reliability.

### Decision 3: Status model distinguishes connection from data

The UI should distinguish at least these states:
- bridge disconnected,
- bridge connected but waiting for UDP packets,
- receiving packets,
- telemetry stale/paused,
- capture active,
- capture ready for review,
- capture insufficient/failed,
- snapshot applied.

Rationale: Users often see the bridge connection succeed while Forza sends no packets because Data Out is disabled, the game is in menus, the port/IP is wrong, firewall blocks UDP, or the title does not support localhost in the user's environment. A single green `connected` state hides the actual problem.

### Decision 4: Candidate values carry provenance and confidence

Snapshot output should distinguish candidate sources:
- `parsed`: directly available in Data Out packets, e.g. drivetrain type or `CarOrdinal` when parser confidence is high,
- `lookup`: local database value keyed by `CarOrdinal`, e.g. stock baseline name/weight/bias/layout,
- `estimated`: derived from a filtered drive window, e.g. candidate weight,
- `manual`: user-entered value,
- `restored`: previously confirmed local value,
- `unavailable`: not provided by Data Out.

Confidence should be explicit: high, medium, low, or unknown. User-confirmed values become authoritative even if their original source was an estimate or lookup.

Rationale: Provenance prevents false precision. Weight/front bias from lookup or estimation are useful aids, but not direct telemetry facts.

### Decision 5: Apply is explicit and one-shot

A capture creates a pending snapshot. The user reviews candidates and applies selected values. Applying writes those selected values once into calculator state. Subsequent telemetry packets do not change those fields unless the user starts and applies another recapture.

Rationale: Calculator outputs should be deterministic from visible, confirmed inputs. Explicit apply aligns with the user's mental model of driving briefly, then tuning from a stable captured state.

### Decision 6: Persistence stores confirmed values and optional metadata only

Persistence may store source/confidence/captured-at metadata alongside confirmed fields. It must not restore raw last packets as if they were calculator inputs. Legacy save/share data without metadata remains valid.

Rationale: Persistence reduces repeated setup friction while preserving backward compatibility and avoiding stale live-data confusion.

## Risks / Trade-offs

- Users may expect full automatic import → Mitigate with clear copy that Data Out is driving telemetry and does not include weight/front bias/tune settings directly.
- Capture may feel less automatic than continuous sync → Mitigate by auto-starting the first bounded capture when valid driving packets arrive after connect.
- Estimates may still be noisy → Mitigate with quality thresholds, confidence labels, and no auto-apply for low-confidence results.
- Packet formats differ by title → Mitigate with parser profile metadata, packet-size diagnostics, safe unsupported-format handling, and tests.
- More UI states can overwhelm casual users → Mitigate with simple headline states and expandable diagnostics.
- Persisted metadata may drift from current car/build → Mitigate by labeling restored values and providing clear/recapture actions.
- Bridge changes could grow complexity → Mitigate by keeping the bridge as transport/parser only and placing workflow decisions in the frontend.

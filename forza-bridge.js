const dgram = require('dgram');
const http = require('http');

// Port Configuration
const UDP_PORT = 5600;
const HTTP_PORT = 5601;

// Keep track of active SSE client connections
const clients = new Set();

const PARSER_PROFILES = [
  {
    id: 'horizon-dash-v1',
    label: 'Horizon Dash',
    minLength: 312,
    maxLength: 323,
    dashboardShift: 0,
    confidence: 'medium',
  },
  {
    id: 'horizon-dash-v2',
    label: 'Horizon Dash + FH6 offset',
    minLength: 324,
    maxLength: 1500,
    dashboardShift: 12,
    confidence: 'medium',
  },
  {
    id: 'motorsport-sled',
    label: 'Motorsport Sled-only',
    minLength: 232,
    maxLength: 311,
    dashboardShift: null,
    confidence: 'low',
    unsupported: true,
    warning: 'Sled-only packet: dashboard fields such as speed/power/inputs are unavailable. Switch Forza Data Out to Dash format if supported.',
  },
];

const selectParserProfile = (length) => {
  const profile = PARSER_PROFILES.find(p => length >= p.minLength && length <= p.maxLength);
  if (profile) return profile;
  return {
    id: 'unsupported',
    label: 'Unsupported packet',
    minLength: 0,
    maxLength: 0,
    dashboardShift: null,
    confidence: 'unknown',
    unsupported: true,
    warning: `Unsupported packet length ${length}. Expected Motorsport Sled or Horizon/Motorsport Dash packet sizes.`,
  };
};

const parseTelemetryPacket = (buffer) => {
  const profile = selectParserProfile(buffer.length);
  const base = {
    packetLength: buffer.length,
    parserProfile: profile.id,
    parserLabel: profile.label,
    parserConfidence: profile.confidence,
    parserWarning: profile.warning || null,
    packetSupported: !profile.unsupported,
  };

  if (profile.unsupported) return base;

  try {
    const shift = profile.dashboardShift;
    return {
      ...base,
      IsRaceOn: buffer.readInt32LE(0),
      TimestampMS: buffer.readUInt32LE(4),
      EngineMaxRpm: buffer.readFloatLE(8),
      EngineIdleRpm: buffer.readFloatLE(12),
      CurrentEngineRpm: buffer.readFloatLE(16),
      AccelerationZ: buffer.readFloatLE(28),
      CarOrdinal: buffer.readInt32LE(212),
      DrivetrainType: buffer.readInt32LE(224),
      Speed: buffer.readFloatLE(244 + shift),
      Power: buffer.readFloatLE(248 + shift),
      Torque: buffer.readFloatLE(252 + shift),
      Accel: buffer.readUInt8(303 + shift),
      Brake: buffer.readUInt8(304 + shift),
    };
  } catch (err) {
    return {
      ...base,
      packetSupported: false,
      parserWarning: `Failed to parse ${profile.label} packet: ${err.message}`,
    };
  }
};

const broadcastTelemetry = (telemetry) => {
  const data = JSON.stringify(telemetry);
  for (const client of clients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (err) {
      console.error('Failed to write to SSE client, removing client:', err);
      clients.delete(client);
    }
  }
};

const startBridge = () => {
  // Create UDP Socket
  const udpSocket = dgram.createSocket('udp4');

  udpSocket.on('error', (err) => {
    console.error(`UDP socket error:\n${err.stack}`);
    udpSocket.close();
    process.exit(1);
  });

  udpSocket.on('message', (buffer) => {
    const telemetry = parseTelemetryPacket(buffer);
    if (telemetry.parserWarning) console.warn(`[UDP] ${telemetry.parserWarning}`);
    broadcastTelemetry(telemetry);
  });

  udpSocket.bind(UDP_PORT, () => {
    console.log(`[UDP] Listening for Forza telemetry on port ${UDP_PORT}`);
  });

  // Create HTTP server for SSE Streaming
  const server = http.createServer((req, res) => {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle CORS Preflight request
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // SSE endpoint
    if (req.url === '/telemetry') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      // Send initial comment to establish the connection
      res.write(': ok\n\n');

      clients.add(res);
      console.log(`[HTTP] Client connected. Total clients: ${clients.size}`);

      req.on('close', () => {
        clients.delete(res);
        console.log(`[HTTP] Client disconnected. Total clients: ${clients.size}`);
      });
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[ERROR] Port ${HTTP_PORT} is already in use.`);
      console.error('The telemetry bridge HTTP server cannot start. Please make sure no other instance is running.');
      process.exit(1);
    } else {
      console.error('[HTTP ERROR]', err);
    }
  });

  server.listen(HTTP_PORT, () => {
    console.log(`[HTTP] SSE endpoint available at http://localhost:${HTTP_PORT}/telemetry`);
  });
};

if (require.main === module) {
  startBridge();
}

module.exports = { PARSER_PROFILES, selectParserProfile, parseTelemetryPacket };

// Sensors and lights (FR-07, FR-08).
// The hardware is simulated for the prototype. A real sensor class can replace
// SimulatedSensorGateway later without changing the pages.
'use strict';

class EnvironmentReading {
  constructor({ houseId, temperature, humidity, at }) {
    this.houseId = houseId; this.temperature = temperature; this.humidity = humidity; this.at = at || new Date().toISOString();
  }
  isAbnormal(range) { return !range.contains(this); }
}

// interface
class SensorGateway {
  read(house) { throw new Error('interface method'); }
  history(house) { throw new Error('interface method'); }
}

class SimulatedSensorGateway extends SensorGateway {
  constructor() { super(); this.state = {}; }
  _seed(house) {
    const r = house.envRange();
    const mid = (r.minTemp + r.maxTemp) / 2;
    const s = { t: mid, h: 60, hist: [] };
    for (let i = 0; i < 24; i++) { this._step(s, house); s.hist.push({ t: s.t, h: s.h }); }
    this.state[house.id] = s;
    return s;
  }
  _step(s, house) {
    const r = house.envRange();
    const mid = (r.minTemp + r.maxTemp) / 2;
    // drift back to the comfort band, plus noise; second house runs a little humid
    const humidBias = house.id === 'h2' ? 9 : 0;
    s.t += (mid - s.t) * 0.15 + (Math.random() - 0.5) * 0.8;
    s.h += (60 + humidBias - s.h) * 0.2 + (Math.random() - 0.5) * 3;
    s.t = +s.t.toFixed(1); s.h = Math.round(s.h);
  }
  read(house) {
    const s = this.state[house.id] || this._seed(house);
    this._step(s, house);
    s.hist.push({ t: s.t, h: s.h }); if (s.hist.length > 40) s.hist.shift();
    return new EnvironmentReading({ houseId: house.id, temperature: s.t, humidity: s.h });
  }
  last(house) {
    const s = this.state[house.id] || this._seed(house);
    const p = s.hist[s.hist.length - 1];
    return new EnvironmentReading({ houseId: house.id, temperature: p.t, humidity: p.h });
  }
  history(house) { return (this.state[house.id] || this._seed(house)).hist; }
}

const CommandStatus = Object.freeze({ PENDING: 'PENDING', CONFIRMED: 'CONFIRMED', FAILED: 'FAILED' });

class LightCommand {
  constructor({ houseId, requestedOn }) {
    this.id = uid('cmd'); this.houseId = houseId; this.requestedOn = requestedOn;
    this.status = CommandStatus.PENDING; this.sentAt = new Date().toISOString(); this.confirmedAt = null;
  }
}

class LightingController {
  constructor(failureRate = 0.1) { this.failureRate = failureRate; }
  // Resolves only after the house controller confirms (or fails to confirm) the switch.
  switchLight(house, on) {
    const cmd = new LightCommand({ houseId: house.id, requestedOn: on });
    return new Promise(resolve => {
      setTimeout(() => {
        if (Math.random() < this.failureRate) {
          cmd.status = CommandStatus.FAILED;         // state unknown: do NOT assume it switched
        } else {
          cmd.status = CommandStatus.CONFIRMED; cmd.confirmedAt = new Date().toISOString();
          house.lightOn = on;
        }
        resolve(cmd);
      }, 1300);
    });
  }
}

// Farm, houses and batches. Each batch keeps its own records.
'use strict';

const BatchStatus = Object.freeze({ OPEN: 'OPEN', CLOSED: 'CLOSED' });
const DAY_MS = 86400000;
// yyyy-mm-dd in the phone's local time zone (Tashkent is UTC+5).
function localDate(d = new Date()) {
  d = new Date(d);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayDiff(fromIso, to = new Date()) {
  const a = new Date(fromIso); a.setHours(0, 0, 0, 0);
  const b = new Date(to); b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / DAY_MS);
}

class EnvRange {
  constructor({ minTemp, maxTemp, minHumidity, maxHumidity }) {
    this.minTemp = Number(minTemp); this.maxTemp = Number(maxTemp);
    this.minHumidity = Number(minHumidity); this.maxHumidity = Number(maxHumidity);
  }
  // chicks need about 32 °C, older birds about 21 °C
  static forAge(ageDays) {
    const target = Math.max(21, 32 - ageDays * 0.32);
    return new EnvRange({ minTemp: +(target - 2).toFixed(1), maxTemp: +(target + 2).toFixed(1), minHumidity: 50, maxHumidity: 70 });
  }
  contains(reading) {
    return reading.temperature >= this.minTemp && reading.temperature <= this.maxTemp &&
           reading.humidity >= this.minHumidity && reading.humidity <= this.maxHumidity;
  }
}

class Batch {
  constructor(o) {
    this.id = o.id;
    this.houseId = o.houseId;
    this.code = o.code;
    this.startDate = o.startDate;
    this.status = o.status || BatchStatus.OPEN;
    this.chickDelivery = o.chickDelivery ? new ChickDelivery(o.chickDelivery) : null;
    this.feedDeliveries = (o.feedDeliveries || []).map(x => new FeedDelivery(x));
    this.mortality = (o.mortality || []).map(x => new MortalityRecord(x));
    this.samples = (o.samples || []).map(x => new SampleWeighing(x));
    this.sessions = (o.sessions || []).map(x => new SlaughterSession(x));
    this.sales = (o.sales || []).map(x => Sale.fromJSON(x));
    this.expenses = (o.expenses || []).map(x => new Expense(x));
  }
  ageInDays(today = new Date()) { return dayDiff(this.startDate, today); }
  chicksPlaced() { return this.chickDelivery ? this.chickDelivery.placedBirds() : 0; }
  deaths() { return this.mortality.filter(m => m.counts()).reduce((a, m) => a + m.count, 0); }
  deathsOn(day = localDate()) {
    return this.mortality.filter(m => m.counts() && localDate(m.at) === day).reduce((a, m) => a + m.count, 0);
  }
  mortalityRate() { return this.chicksPlaced() ? this.deaths() / this.chicksPlaced() : 0; }
  birdsSlaughtered() { return this.sessions.reduce((a, s) => a + s.headCount(), 0); }
  liveBirds() { return Math.max(0, this.chicksPlaced() - this.deaths() - this.birdsSlaughtered()); }
  totalFeedKg() { return this.feedDeliveries.reduce((a, f) => a + f.kg, 0); }
  // Feed delivered per bird placed (FR-02).
  feedPerBird() { return this.chicksPlaced() ? this.totalFeedKg() / this.chicksPlaced() : 0; }
  latestSample() { return [...this.samples].sort((a, b) => b.date.localeCompare(a.date))[0] || null; }
  flaggedDuplicates() { return this.mortality.filter(m => m.duplicateStatus === DuplicateStatus.FLAGGED); }

  // record a death. If it looks like a duplicate it is flagged, not counted
  recordDeath(workerId, count = 1, at = new Date().toISOString()) {
    const rec = new MortalityRecord({ id: uid('m'), at, workerId, count });
    const twin = this.mortality.find(m => rec.isPossibleDuplicateOf(m));
    if (twin) { rec.duplicateStatus = DuplicateStatus.FLAGGED; rec.duplicateOf = twin.id; }
    this.mortality.push(rec);
    return rec;
  }
  resolveDuplicate(recordId, isRealDeath) {
    const r = this.mortality.find(m => m.id === recordId);
    if (r) r.duplicateStatus = isRealDeath ? DuplicateStatus.CONFIRMED : DuplicateStatus.DISMISSED;
    return r;
  }
  addFeedDelivery(fd) { this.feedDeliveries.push(fd); return fd; }
  addSample(sample) { this.samples.push(sample); return sample; }
  addSession(session) { this.sessions.push(session); return session; }
  addSale(sale) { this.sales.push(sale); return sale; }
  addExpense(exp) { this.expenses.push(exp); return exp; }
  ledger() { return new BatchLedger(this); }
  close() { this.status = BatchStatus.CLOSED; }
}

class House {
  constructor(o) {
    this.id = o.id;
    this.name = o.name;
    this.capacity = Number(o.capacity);
    this.floorAreaM2 = Number(o.floorAreaM2);
    this.lightOn = !!o.lightOn;
    this.customRange = o.customRange ? new EnvRange(o.customRange) : null;
    this.batches = (o.batches || []).map(b => new Batch(b));
  }
  currentBatch() { return this.batches.find(b => b.status === BatchStatus.OPEN) || null; }
  envRange() {
    if (this.customRange) return this.customRange;
    const b = this.currentBatch();
    return EnvRange.forAge(b ? b.ageInDays() : 0);
  }
  openBatch({ code, startDate, chickDelivery }) {
    if (this.currentBatch()) throw new Error(`${this.name} already has an open batch`);
    if (chickDelivery.quantity > this.capacity) throw new Error(`Order exceeds capacity of ${this.capacity}`);
    const b = new Batch({ id: uid('b'), houseId: this.id, code, startDate, chickDelivery });
    this.batches.push(b);
    return b;
  }
}

class Farm {
  constructor(o) {
    this.name = o.name;
    this.houses = (o.houses || []).map(h => new House(h));
    this.users = (o.users || []).map(u => User.fromJSON(u));
    this.suppliers = (o.suppliers || []).map(s => Supplier.fromJSON(s));
    this.buyers = (o.buyers || []).map(b => Buyer.fromJSON(b));
    this.priceQuotes = (o.priceQuotes || []).map(p => new PriceQuote(p));
  }
  house(id) { return this.houses.find(h => h.id === id); }
  batch(id) { for (const h of this.houses) { const b = h.batches.find(x => x.id === id); if (b) return b; } return null; }
  houseOf(batch) { return this.house(batch.houseId); }
  user(id) { return this.users.find(u => u.id === id); }
  supplier(id) { return this.suppliers.find(s => s.id === id); }
  buyer(id) { return this.buyers.find(b => b.id === id); }
  openBatches() { return this.houses.map(h => h.currentBatch()).filter(Boolean); }
  addHouse({ name, capacity, floorAreaM2 }) {
    const h = new House({ id: uid('h'), name, capacity, floorAreaM2 });
    this.houses.push(h);
    return h;
  }
  addPriceQuote(q) { this.priceQuotes.push(q); return q; }
  priceHistory(buyerType = BuyerType.BAZAAR_AGENT, days = 30) {
    const from = localDate(Date.now() - days * DAY_MS);
    return this.priceQuotes.filter(q => q.buyerType === buyerType && q.date >= from).sort((a, b) => a.date.localeCompare(b.date));
  }
}

function uid(prefix) { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }

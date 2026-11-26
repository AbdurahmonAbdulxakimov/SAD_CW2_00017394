// Buyers, sales and prices. Bazaar sales need two matching weights (FR-05).
'use strict';

const BuyerType = Object.freeze({ BAZAAR_AGENT: 'BAZAAR_AGENT', NURATA_SELLER: 'NURATA_SELLER', SHOP_CUSTOMER: 'SHOP_CUSTOMER', CLIENT: 'CLIENT' });
const SettlementStatus = Object.freeze({ PENDING: 'PENDING', MATCHED: 'MATCHED', MISMATCH: 'MISMATCH', RESOLVED: 'RESOLVED' });

class Buyer {
  constructor({ id, name, phone }) {
    if (new.target === Buyer) throw new TypeError('Buyer is abstract');
    this.id = id; this.name = name; this.phone = phone || '';
  }
  get type() { throw new Error('abstract'); }
  get label() { return { BAZAAR_AGENT: 'Bazaar agent', NURATA_SELLER: 'Nurata seller', SHOP_CUSTOMER: 'Farm shop', CLIENT: 'Client' }[this.type]; }
  toJSON() { return { kind: this.type, id: this.id, name: this.name, phone: this.phone }; }
  static fromJSON(o) {
    switch (o.kind) {
      case BuyerType.BAZAAR_AGENT: return new BazaarAgent(o);
      case BuyerType.NURATA_SELLER: return new NurataSeller(o);
      case BuyerType.SHOP_CUSTOMER: return new ShopCustomer(o);
      default: return new Client(o);
    }
  }
}
class BazaarAgent extends Buyer {
  constructor(o) { super(o); this.market = o.market || 'Navoi bazaar'; }
  get type() { return BuyerType.BAZAAR_AGENT; }
  toJSON() { return { ...super.toJSON(), market: this.market }; }
}
class NurataSeller extends Buyer { get type() { return BuyerType.NURATA_SELLER; } }
class ShopCustomer extends Buyer { get type() { return BuyerType.SHOP_CUSTOMER; } }
class Client extends Buyer { get type() { return BuyerType.CLIENT; } }

class Sale {
  constructor({ id, date, buyerId, pricePerKg, sessionId }) {
    if (new.target === Sale) throw new TypeError('Sale is abstract');
    this.id = id; this.date = date; this.buyerId = buyerId;
    this.pricePerKg = Number(pricePerKg); this.sessionId = sessionId || null;
  }
  // returns the money in UZS, or null if it cannot be worked out yet
  amount() { throw new Error('abstract'); }
  isSettled() { return this.amount() !== null; }
  static fromJSON(o) { return o.kind === 'BAZAAR' ? new BazaarSale(o) : new DirectSale(o); }
}

class DirectSale extends Sale {
  constructor(o) { super(o); this.kg = Number(o.kg); }
  amount() { return Math.round(this.kg * this.pricePerKg); }
  confirmedKg() { return this.kg; }
  toJSON() { return { kind: 'DIRECT', ...this }; }
}

class BazaarSale extends Sale {
  static TOLERANCE_KG = 0.5;
  constructor(o) {
    super(o);
    this.agentKg = o.agentKg == null || o.agentKg === '' ? null : Number(o.agentKg);
    this.tallyKg = o.tallyKg == null || o.tallyKg === '' ? null : Number(o.tallyKg);
    this.resolvedKg = o.resolvedKg == null ? null : Number(o.resolvedKg);
    this.resolutionNote = o.resolutionNote || '';
  }
  status() {
    if (this.resolvedKg != null) return SettlementStatus.RESOLVED;
    if (this.agentKg == null || this.tallyKg == null) return SettlementStatus.PENDING;
    return Math.abs(this.agentKg - this.tallyKg) <= BazaarSale.TOLERANCE_KG ? SettlementStatus.MATCHED : SettlementStatus.MISMATCH;
  }
  difference() { return this.agentKg == null || this.tallyKg == null ? null : +(this.agentKg - this.tallyKg).toFixed(1); }
  confirmedKg() {
    const s = this.status();
    if (s === SettlementStatus.RESOLVED) return this.resolvedKg;
    if (s === SettlementStatus.MATCHED) return this.agentKg;
    return null;
  }
  amount() { const kg = this.confirmedKg(); return kg == null ? null : Math.round(kg * this.pricePerKg); }
  resolve(kg, note) { this.resolvedKg = Number(kg); this.resolutionNote = note; }
  toJSON() { return { kind: 'BAZAAR', ...this }; }
}

class PriceQuote {
  constructor({ date, buyerType, pricePerKg }) { this.date = date; this.buyerType = buyerType; this.pricePerKg = Number(pricePerKg); }
}

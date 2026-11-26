// Suppliers and deliveries (chicks and feed). Feed is linked to a batch (FR-02).
'use strict';

class Supplier {
  constructor({ id, name, city, contractRef }) {
    if (new.target === Supplier) throw new TypeError('Supplier is abstract');
    this.id = id; this.name = name; this.city = city; this.contractRef = contractRef;
  }
  get type() { throw new Error('abstract'); }
  toJSON() { return { kind: this.type, id: this.id, name: this.name, city: this.city, contractRef: this.contractRef }; }
  static fromJSON(o) { return o.kind === 'CHICK' ? new ChickSupplier(o) : new FeedSupplier(o); }
}

class ChickSupplier extends Supplier {
  get type() { return 'CHICK'; }
}

class FeedSupplier extends Supplier {
  constructor(o) { super(o); this.factory = o.factory || o.name; }
  get type() { return 'FEED'; }
  toJSON() { return { ...super.toJSON(), factory: this.factory }; }
}

class Delivery {
  constructor({ id, date, supplierId, cost }) {
    if (new.target === Delivery) throw new TypeError('Delivery is abstract');
    this.id = id; this.date = date; this.supplierId = supplierId; this.cost = Number(cost) || 0;
  }
}

class ChickDelivery extends Delivery {
  constructor(o) {
    super(o);
    this.quantity = Number(o.quantity);
    this.deadOnArrival = Number(o.deadOnArrival) || 0;
  }
  // Birds actually placed in the house; dead-on-arrival is the supplier's loss (CW1 UC-01, 4a).
  placedBirds() { return this.quantity - this.deadOnArrival; }
}

class FeedDelivery extends Delivery {
  constructor(o) {
    super(o);
    this.kg = Number(o.kg);
    this.feedType = o.feedType || 'Grower';
    this.recordedBy = o.recordedBy || null;
  }
  pricePerKg() { return this.kg ? this.cost / this.kg : 0; }
}

// Users of the app. Director can see money, workers cannot (NFR-03).
'use strict';

class User {
  constructor({ id, name, pin }) {
    if (new.target === User) throw new TypeError('User is abstract');
    this.id = id;
    this.name = name;
    this.pin = String(pin);
  }
  verifyPin(pin) { return String(pin) === this.pin; }
  // abstract
  canViewFinance() { throw new Error('canViewFinance() must be overridden'); }
  get role() { throw new Error('role must be overridden'); }
  toJSON() { return { kind: this.role, id: this.id, name: this.name, pin: this.pin }; }

  static fromJSON(o) {
    return o.kind === 'DIRECTOR' ? new Director(o) : new Worker(o);
  }
}

class Director extends User {
  canViewFinance() { return true; }
  get role() { return 'DIRECTOR'; }
}

class Worker extends User {
  constructor(o) {
    super(o);
    this.assignedHouseIds = o.assignedHouseIds || [];
  }
  canViewFinance() { return false; }
  get role() { return 'WORKER'; }
  toJSON() { return { ...super.toJSON(), assignedHouseIds: this.assignedHouseIds }; }
}

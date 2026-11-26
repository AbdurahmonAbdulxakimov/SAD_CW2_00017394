// Slaughter sessions. The head count is saved and changes keep history (FR-04).
'use strict';

class HeadCountCorrection {
  constructor({ at, oldCount, newCount, note, byUserId }) {
    this.at = at; this.oldCount = Number(oldCount); this.newCount = Number(newCount);
    this.note = note; this.byUserId = byUserId;
  }
  difference() { return this.newCount - this.oldCount; }
}

class SlaughterSession {
  constructor({ id, date, reportedHeadCount, ratePerHead, driverFee, corrections }) {
    this.id = id;
    this.date = date;
    this.reportedHeadCount = Number(reportedHeadCount);
    this.ratePerHead = Number(ratePerHead) || 0;
    this.driverFee = Number(driverFee) || 0;
    this.corrections = (corrections || []).map(c => new HeadCountCorrection(c));
  }
  headCount() {
    return this.corrections.length ? this.corrections[this.corrections.length - 1].newCount : this.reportedHeadCount;
  }
  crewPay() { return this.headCount() * this.ratePerHead; }
  correctHeadCount(newCount, note, byUserId) {
    if (!note || !note.trim()) throw new Error('A correction needs a note');
    const c = new HeadCountCorrection({ at: new Date().toISOString(), oldCount: this.headCount(), newCount, note, byUserId });
    this.corrections.push(c);
    return c;
  }
  isCorrected() { return this.corrections.length > 0; }
}

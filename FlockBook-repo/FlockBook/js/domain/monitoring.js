// Death records and sample weighings. Duplicate reports are flagged (FR-01).
'use strict';

const DuplicateStatus = Object.freeze({ NONE: 'NONE', FLAGGED: 'FLAGGED', CONFIRMED: 'CONFIRMED', DISMISSED: 'DISMISSED' });

class MortalityRecord {
  constructor({ id, at, workerId, count, duplicateStatus, duplicateOf }) {
    this.id = id;
    this.at = at;                         // ISO timestamp
    this.workerId = workerId;
    this.count = Number(count) || 1;
    this.duplicateStatus = duplicateStatus || DuplicateStatus.NONE;
    this.duplicateOf = duplicateOf || null;
  }
  // A flagged or dismissed record is not counted as a death.
  counts() {
    return this.duplicateStatus === DuplicateStatus.NONE || this.duplicateStatus === DuplicateStatus.CONFIRMED;
  }
  // same count, different worker, within 10 minutes = probably the same bird
  isPossibleDuplicateOf(other) {
    const minutes = Math.abs(new Date(this.at) - new Date(other.at)) / 60000;
    return other.workerId !== this.workerId && other.count === this.count && minutes <= 10 && other.counts();
  }
}

class SampleWeighing {
  constructor({ id, date, weightsKg }) {
    this.id = id; this.date = date;
    this.weightsKg = (weightsKg || []).map(Number).filter(w => w > 0);
  }
  average() {
    return this.weightsKg.length ? this.weightsKg.reduce((a, b) => a + b, 0) / this.weightsKg.length : 0;
  }
  sampleSize() { return this.weightsKg.length; }
}

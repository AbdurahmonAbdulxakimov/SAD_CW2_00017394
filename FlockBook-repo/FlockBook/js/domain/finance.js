// Expenses and the batch ledger (profit per batch, FR-03).
'use strict';

const ExpenseCategory = Object.freeze({
  CHICKS: 'CHICKS', FEED: 'FEED', MEDICINE: 'MEDICINE', CREW: 'CREW', TRANSPORT: 'TRANSPORT',
  UTILITIES: 'UTILITIES', REPAIRS: 'REPAIRS', OTHER: 'OTHER'
});
const ExpenseCategoryLabel = {
  CHICKS: 'Chicks', FEED: 'Feed', MEDICINE: 'Vitamins & medicine', CREW: 'Slaughter crew', TRANSPORT: 'Transport',
  UTILITIES: 'Utilities', REPAIRS: 'Repairs & equipment', OTHER: 'Other'
};

class Expense {
  constructor({ id, date, category, amount, reason, source }) {
    this.id = id; this.date = date; this.category = category || ExpenseCategory.OTHER;
    this.amount = Math.round(Number(amount) || 0); this.reason = reason || ''; this.source = source || 'MANUAL';
  }
}

// works out the money for one batch
class BatchLedger {
  constructor(batch) { this.batch = batch; }

  costLines() {
    const b = this.batch, lines = [];
    if (b.chickDelivery) lines.push({ category: ExpenseCategory.CHICKS, amount: b.chickDelivery.cost, label: 'Day-old chicks' });
    b.feedDeliveries.forEach(f => lines.push({ category: ExpenseCategory.FEED, amount: f.cost, label: `${f.feedType} feed ${f.kg} kg` }));
    b.sessions.forEach(s => {
      lines.push({ category: ExpenseCategory.CREW, amount: s.crewPay(), label: 'Slaughter crew' });
      if (s.driverFee) lines.push({ category: ExpenseCategory.TRANSPORT, amount: s.driverFee, label: 'Delivery driver' });
    });
    b.expenses.forEach(e => lines.push({ category: e.category, amount: e.amount, label: e.reason }));
    return lines;
  }
  costsByCategory() {
    const out = {};
    this.costLines().forEach(l => { out[l.category] = (out[l.category] || 0) + l.amount; });
    return out;
  }
  totalCosts() { return this.costLines().reduce((a, l) => a + l.amount, 0); }
  totalRevenue() { return this.batch.sales.reduce((a, s) => a + (s.amount() || 0), 0); }
  // money from bazaar sales that are not checked yet
  pendingRevenue() {
    return this.batch.sales.filter(s => !s.isSettled())
      .reduce((a, s) => a + Math.round((s.tallyKg ?? s.agentKg ?? 0) * s.pricePerKg), 0);
  }
  profit() { return this.totalRevenue() - this.totalCosts(); }
  costPerBirdPlaced() { const n = this.batch.chicksPlaced(); return n ? this.totalCosts() / n : 0; }
  kgSold() { return this.batch.sales.reduce((a, s) => a + (s.confirmedKg() || 0), 0); }
}

// Demo data based on the farm from Coursework 1. Dates are relative to today.
'use strict';

function buildSeedData() {
  const iso = n => { const d = new Date(); d.setDate(d.getDate() - n); return localDate(d); };
  const at = (n, hh, mm) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(hh, mm, 0, 0); return d.toISOString(); };
  let seq = 0; const id = p => `${p}_seed${++seq}`;
  const workers = ['u2', 'u3', 'u4'];

  function mortality(days, perDay) {
    const out = [];
    for (let n = days; n >= 1; n--) {
      let left = perDay(days - n);
      let slot = 0;
      while (left > 0) {
        const c = Math.min(left, 1 + ((n * 7 + slot) % 3));
        out.push({ id: id('m'), at: at(n, 7 + slot * 4, (n * 13 + slot * 17) % 60), workerId: workers[(n + slot) % 3], count: c });
        left -= c; slot++;
      }
    }
    return out;
  }

  // repeatable "random" numbers, so the demo data is the same every time
  let r = 11; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;

  // bazaar price n days ago: drops from 27,500 to about 23,000 in ten days (CW1), then goes up again
  function bazaarPrice(n) {
    let p;
    if (n > 30) p = 25900 + 900 * Math.sin(n / 9);
    else if (n >= 20) p = 27500 - (30 - n) * 450;
    else p = 23000 + (20 - n) * 140;
    return Math.round(p / 50) * 50;
  }

  // a finished batch from before, with all its records
  function pastBatch(o) {
    const ago = day => o.startAgo - day;
    const b = {
      id: o.id, houseId: o.houseId, code: o.code, startDate: iso(o.startAgo), status: 'CLOSED',
      chickDelivery: { id: id('cd'), date: iso(o.startAgo), supplierId: 's1', cost: o.ordered * 6800, quantity: o.ordered, deadOnArrival: o.doa },
      feedDeliveries: o.feed.map(([day, kgs, type, sup, price]) => ({ id: id('f'), date: iso(ago(day)), supplierId: sup, kg: kgs, feedType: type, cost: kgs * price })),
      mortality: [], samples: [], sessions: [], sales: [],
      expenses: o.expenses.map(([day, category, amount, reason]) => ({ id: id('e'), date: iso(ago(day)), category, amount, reason, source: 'MANUAL' }))
    };
    // deaths: more in the first week
    let left = o.deaths;
    for (let day = 1; day <= 42 && left > 0; day++) {
      const n = Math.min(left, day <= 7 ? Math.round(o.deaths * 0.065) : Math.max(1, Math.round(o.deaths * 0.012)));
      b.mortality.push({ id: id('m'), at: at(ago(day), 8, 10 + day % 40), workerId: workers[day % 3], count: n });
      left -= n;
    }
    if (left > 0) b.mortality.push({ id: id('m'), at: at(ago(43), 9, 5), workerId: 'u2', count: left });
    // slaughter sessions and the sale of their meat
    o.sessions.forEach(([day, count, withNurata]) => {
      const sid = id('ss'), n = ago(day);
      b.sessions.push({ id: sid, date: iso(n), reportedHeadCount: count, ratePerHead: 1500, driverFee: 350000 });
      const perBird = day < 40 ? 1.62 : 1.82;   // birds are heavier later
      let total = Math.round(count * perBird * (0.98 + rnd() * 0.04) * 10) / 10;
      if (withNurata) {
        b.sales.push({ kind: 'DIRECT', id: id('sa'), date: iso(n), buyerId: 'k2', sessionId: sid, pricePerKg: bazaarPrice(n) + 900, kg: 600 });
        total = Math.round((total - 600) * 10) / 10;
      }
      b.sales.push({ kind: 'BAZAAR', id: id('sa'), date: iso(n), buyerId: 'k1', sessionId: sid, pricePerKg: bazaarPrice(n),
        agentKg: total, tallyKg: Math.round((total + (rnd() - 0.5) * 0.4) * 10) / 10 });
    });
    // small client orders (done by the farm itself, so no crew session)
    o.clientOrders.forEach(([day, kgs]) => b.sales.push({ kind: 'DIRECT', id: id('sa'), date: iso(ago(day)), buyerId: 'k4', pricePerKg: 28000, kg: kgs }));
    // farm shop sales about twice a week near the end
    for (let day = 30; day <= o.lastDay; day += 4) {
      b.sales.push({ kind: 'DIRECT', id: id('sa'), date: iso(ago(day)), buyerId: 'k3', pricePerKg: 28000, kg: 25 + Math.round(rnd() * 20) });
    }
    return b;
  }

  const h1Past = pastBatch({
    id: 'p1', houseId: 'h1', code: 'H1-B06', startAgo: 111, ordered: 10000, doa: 150, deaths: 398, lastDay: 47,
    feed: [[0, 4000, 'Starter', 's2', 7100], [10, 9000, 'Grower', 's2', 6900], [20, 9000, 'Grower', 's3', 6800], [30, 9500, 'Finisher', 's2', 6600], [38, 9300, 'Finisher', 's3', 6500]],
    sessions: [[35, 1160, true], [36, 1150], [37, 1140], [43, 1200, true], [44, 1210], [45, 1190], [46, 1180], [47, 1222]],
    clientOrders: [[39, 164.2]],
    expenses: [[1, 'UTILITIES', 4200000, 'Gas for brooder heating'], [3, 'MEDICINE', 1700000, 'Vitamins'], [7, 'MEDICINE', 2400000, 'Newcastle vaccine'],
      [22, 'REPAIRS', 450000, 'Feeder repair'], [30, 'UTILITIES', 3100000, 'Electricity bill']]
  });
  const h2Past = pastBatch({
    id: 'p2', houseId: 'h2', code: 'H2-B05', startAgo: 84, ordered: 6000, doa: 50, deaths: 214, lastDay: 46,
    feed: [[0, 2500, 'Starter', 's3', 7100], [10, 5500, 'Grower', 's2', 6900], [21, 5500, 'Grower', 's2', 6800], [31, 6000, 'Finisher', 's3', 6600], [40, 4800, 'Finisher', 's2', 6500]],
    sessions: [[36, 1100, true], [37, 1080], [44, 1170], [45, 1180], [46, 1206]],
    clientOrders: [[40, 109.5]],
    expenses: [[1, 'UTILITIES', 2600000, 'Gas for brooder heating'], [3, 'MEDICINE', 1100000, 'Vitamins'], [7, 'MEDICINE', 1500000, 'Newcastle vaccine'],
      [31, 'UTILITIES', 2000000, 'Electricity bill']]
  });

  const h1Mort = mortality(41, age => age < 7 ? 22 : age < 21 ? 6 : 5);
  // today: two workers report the same bird, so the second one is flagged
  const real = { id: id('m'), at: at(0, 8, 12), workerId: 'u2', count: 1 };
  h1Mort.push(real, { id: id('m'), at: at(0, 8, 15), workerId: 'u3', count: 1, duplicateStatus: 'FLAGGED', duplicateOf: real.id });

  const h1 = {
    id: 'b1', houseId: 'h1', code: 'H1-B07', startDate: iso(41), status: 'OPEN',
    chickDelivery: { id: id('cd'), date: iso(41), supplierId: 's1', cost: 68000000, quantity: 10000, deadOnArrival: 150 },
    feedDeliveries: [
      { id: id('f'), date: iso(41), supplierId: 's2', cost: 28800000, kg: 4000, feedType: 'Starter' },
      { id: id('f'), date: iso(31), supplierId: 's2', cost: 62100000, kg: 9000, feedType: 'Grower' },
      { id: id('f'), date: iso(21), supplierId: 's3', cost: 61200000, kg: 9000, feedType: 'Grower' },
      { id: id('f'), date: iso(11), supplierId: 's2', cost: 52800000, kg: 8000, feedType: 'Finisher' },
      { id: id('f'), date: iso(3), supplierId: 's3', cost: 39000000, kg: 6000, feedType: 'Finisher', recordedBy: 'u3' }
    ],
    mortality: h1Mort,
    samples: [
      { id: id('sw'), date: iso(2), weightsKg: [2.21, 2.35, 2.18, 2.42, 2.27, 2.30, 2.25, 2.38, 2.29, 2.33] },
      { id: id('sw'), date: iso(1), weightsKg: [2.31, 2.44, 2.29, 2.47, 2.36, 2.40, 2.35, 2.45, 2.37, 2.36] }
    ],
    sessions: [
      { id: 'ss2', date: iso(6), reportedHeadCount: 1180, ratePerHead: 1500, driverFee: 350000 },
      { id: 'ss3', date: iso(5), reportedHeadCount: 1150, ratePerHead: 1500, driverFee: 350000,
        corrections: [{ at: at(5, 9, 40), oldCount: 1150, newCount: 1138, note: 'Recount at loading: 12 birds were rejects and not slaughtered', byUserId: 'u1' }] },
      { id: 'ss4', date: iso(4), reportedHeadCount: 1170, ratePerHead: 1500, driverFee: 350000 }
    ],
    sales: [
      { kind: 'BAZAAR', id: id('sa'), date: iso(6), buyerId: 'k1', sessionId: 'ss2', pricePerKg: 25500, agentKg: 1946.5, tallyKg: 1946.8 },
      { kind: 'BAZAAR', id: id('sa'), date: iso(5), buyerId: 'k1', sessionId: 'ss3', pricePerKg: 25800, agentKg: 1884.0, tallyKg: 1903.2 },
      { kind: 'DIRECT', id: id('sa'), date: iso(4), buyerId: 'k2', sessionId: 'ss4', pricePerKg: 26800, kg: 600 },
      { kind: 'BAZAAR', id: id('sa'), date: iso(4), buyerId: 'k1', sessionId: 'ss4', pricePerKg: 25900, agentKg: null, tallyKg: 1330.4 },
      { kind: 'DIRECT', id: id('sa'), date: iso(2), buyerId: 'k4', pricePerKg: 28000, kg: 136 },
      { kind: 'DIRECT', id: id('sa'), date: iso(3), buyerId: 'k3', pricePerKg: 28000, kg: 42 },
      { kind: 'DIRECT', id: id('sa'), date: iso(1), buyerId: 'k3', pricePerKg: 28000, kg: 35 },
      { kind: 'DIRECT', id: id('sa'), date: iso(7), buyerId: 'k3', pricePerKg: 28000, kg: 31 },
      { kind: 'DIRECT', id: id('sa'), date: iso(10), buyerId: 'k3', pricePerKg: 28000, kg: 27 }
    ],
    expenses: [
      { id: id('e'), date: iso(40), category: 'UTILITIES', amount: 4500000, reason: 'Gas for brooder heating', source: 'MANUAL' },
      { id: id('e'), date: iso(38), category: 'MEDICINE', amount: 1850000, reason: 'Vitamins for drinkers', source: 'MANUAL' },
      { id: id('e'), date: iso(34), category: 'MEDICINE', amount: 2400000, reason: 'Newcastle vaccine', source: 'MANUAL' },
      { id: id('e'), date: iso(21), category: 'REPAIRS', amount: 180000, reason: 'Light bulbs', source: 'VOICE' },
      { id: id('e'), date: iso(15), category: 'REPAIRS', amount: 350000, reason: 'Drinker repair', source: 'MANUAL' },
      { id: id('e'), date: iso(11), category: 'UTILITIES', amount: 3200000, reason: 'Electricity bill', source: 'MANUAL' },
      { id: id('e'), date: iso(6), category: 'TRANSPORT', amount: 600000, reason: 'Fuel for feed pickup', source: 'MANUAL' }
    ]
  };

  const h2 = {
    id: 'b2', houseId: 'h2', code: 'H2-B06', startDate: iso(12), status: 'OPEN',
    chickDelivery: { id: id('cd'), date: iso(12), supplierId: 's1', cost: 40800000, quantity: 6000, deadOnArrival: 40 },
    feedDeliveries: [
      { id: id('f'), date: iso(12), supplierId: 's3', cost: 18000000, kg: 2500, feedType: 'Starter' },
      { id: id('f'), date: iso(2), supplierId: 's2', cost: 27600000, kg: 4000, feedType: 'Grower', recordedBy: 'u4' }
    ],
    mortality: mortality(12, age => age < 7 ? 12 : 4),
    samples: [{ id: id('sw'), date: iso(2), weightsKg: [0.40, 0.38, 0.43, 0.41, 0.39, 0.42, 0.40, 0.37] }],
    sessions: [], sales: [],
    expenses: [
      { id: id('e'), date: iso(12), category: 'UTILITIES', amount: 2800000, reason: 'Gas for brooder heating', source: 'MANUAL' },
      { id: id('e'), date: iso(9), category: 'MEDICINE', amount: 900000, reason: 'Vitamins', source: 'VOICE' },
      { id: id('e'), date: iso(5), category: 'MEDICINE', amount: 1500000, reason: 'Newcastle vaccine', source: 'MANUAL' }
    ]
  };

  // bazaar price drops from 27,500 to about 23,000 in ten days (from CW1), then goes up again
  const priceQuotes = [];
  for (let n = 120; n >= 0; n--) {
    priceQuotes.push({ date: iso(n), buyerType: 'BAZAAR_AGENT', pricePerKg: bazaarPrice(n) });
    if (n % 3 === 0) priceQuotes.push({ date: iso(n), buyerType: 'NURATA_SELLER', pricePerKg: bazaarPrice(n) + 900 });
  }

  return {
    name: 'Nurota Halol Parranda MCHJ',
    houses: [
      { id: 'h1', name: 'House 1', capacity: 10000, floorAreaM2: 700, lightOn: true, batches: [h1Past, h1] },
      { id: 'h2', name: 'House 2', capacity: 6000, floorAreaM2: 420, lightOn: true, batches: [h2Past, h2] }
    ],
    users: [
      { kind: 'DIRECTOR', id: 'u1', name: 'Director', pin: '1234' },
      { kind: 'WORKER', id: 'u2', name: 'Jasur', pin: '1111', assignedHouseIds: ['h1', 'h2'] },
      { kind: 'WORKER', id: 'u3', name: 'Bekzod', pin: '2222', assignedHouseIds: ['h1', 'h2'] },
      { kind: 'WORKER', id: 'u4', name: 'Dilshod', pin: '3333', assignedHouseIds: ['h1', 'h2'] }
    ],
    suppliers: [
      { kind: 'CHICK', id: 's1', name: 'Tashkent Broiler Hatchery', city: 'Tashkent', contractRef: 'CH-2026/01' },
      { kind: 'FEED', id: 's2', name: 'Toshkent Yem Kombinati', city: 'Tashkent', contractRef: 'FD-2026/01', factory: 'Toshkent Yem Kombinati' },
      { kind: 'FEED', id: 's3', name: 'Zarafshon Feed Mill', city: 'Tashkent', contractRef: 'FD-2026/02', factory: 'Zarafshon Feed Mill' }
    ],
    buyers: [
      { kind: 'BAZAAR_AGENT', id: 'k1', name: 'Rustam (Navoi bazaar agent)', market: 'Navoi bazaar' },
      { kind: 'NURATA_SELLER', id: 'k2', name: 'Sherzod (Nurata seller)' },
      { kind: 'SHOP_CUSTOMER', id: 'k3', name: 'Farm shop' },
      { kind: 'CLIENT', id: 'k4', name: 'Akmal (client order)' }
    ],
    priceQuotes
  };
}

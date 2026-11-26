// App controller: pages and button actions.
// Pages: #/login, worker #/w, director #/home #/slaughter #/sell #/costs #/analytics
// All pages are built from the same small parts (page title, card, tiles, chips, table),
// so they look and work the same way.
'use strict';

function val(id) { const el = document.getElementById(id); return el ? el.value.trim() : ''; }
function kg1(n) { return n == null ? '-' : (+n).toLocaleString('en-US', { maximumFractionDigits: 1 }); }

class App {
  constructor(root) {
    this.root = root;
    this.store = new DataStore();
    this.farm = this.store.load();
    this.auth = new AuthService(this.farm);
    this.sensors = new SimulatedSensorGateway();
    this.lights = new LightingController(0.1);
    this.lightCmds = {};      // last light command for each house
    this.ui = {};             // small page state: chosen house, filters, open rows

    // every button with data-do="x" calls this.do_x()
    root.addEventListener('click', e => {
      const el = e.target.closest('[data-do]');
      if (!el) return;
      e.preventDefault();
      this['do_' + el.dataset.do](el);
    });
    root.addEventListener('input', e => {
      if (e.target.id === 'sl-count' || e.target.id === 'sl-rate') this.updateTotal('sl-count', 'sl-rate', 'sl-total');
      if (e.target.id === 'sell-kg' || e.target.id === 'sell-price') this.updateTotal('sell-kg', 'sell-price', 'sell-total');
    });
    root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'lg-pin') this.do_login(); });
    window.addEventListener('hashchange', () => this.route());
    setInterval(() => this.updateLive(), 3000);
    this.route();
  }

  save() { this.store.save(this.farm); }
  go(hash) { if (location.hash === hash) this.route(); else location.hash = hash; }
  refresh(scrollTo) { this.scrollTarget = scrollTo; this.route(); }

  route() {
    const page = (location.hash || '#/login').split('/')[1];
    const user = this.auth.currentUser();
    if (!user) {
      if (page !== 'login') return this.go('#/login');
      return this.show(this.loginPage());
    }
    if (page === 'login') return this.go(user.canViewFinance() ? '#/home' : '#/w');

    // workers have one page and never see money
    if (!user.canViewFinance()) {
      if (page !== 'w') return this.go('#/w');
      return this.show(this.workerPage(user));
    }
    const pages = { home: () => this.homePage(), slaughter: () => this.slaughterPage(), sell: () => this.sellPage(), costs: () => this.costsPage(), analytics: () => this.analyticsPage() };
    const name = pages[page] ? page : 'home';
    this.show(pages[name](), name);
  }

  show(html, tab) {
    const user = this.auth.currentUser();
    let head = '';
    if (user) {
      head = `<div class="top"><span class="title">FlockBook</span>
        <span class="who">${esc(user.name)} · <a href="#" data-do="logout">Log out</a></span></div>`;
      if (user.canViewFinance()) {
        const t = (name, label, cls = '') => `<a href="#/${name}" class="${cls} ${tab === name ? 'on' : ''}">${label}</a>`;
        head += `<nav class="tabs">${t('home', 'Home')}${t('slaughter', 'Slaughter')}${t('sell', '+ Sale', 'sale')}${t('costs', 'Costs')}${t('analytics', 'Analytics')}</nav>`;
      }
    }
    this.root.innerHTML = head + `<main>${html}</main>`;
    this.updateLive();
    const target = this.scrollTarget && document.getElementById(this.scrollTarget);
    if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
    this.scrollTarget = null;
  }

  // ================================================================ shared parts
  pageHead(title, action = '') { return `<div class="page-head"><h2>${title}</h2>${action}</div>`; }

  card(title, body, { id = '', action = '' } = {}) {
    return `<div class="card" ${id ? `id="${id}"` : ''}>${title ? `<div class="card-head"><h3>${title}</h3>${action}</div>` : ''}${body}</div>`;
  }

  // big buttons to pick one thing (house, buyer, type)
  tiles(items, selected, action) {
    return `<div class="tiles">${items.map(x => `<button class="tile ${x.id === selected ? 'on' : ''}" data-do="${action}" data-id="${x.id}">
      <b>${esc(x.title)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ''}</button>`).join('')}</div>`;
  }

  houseTiles(selected, action, houses = this.farm.houses.filter(h => h.currentBatch())) {
    return this.tiles(houses.map(h => ({ id: h.id, title: h.name, sub: `${h.currentBatch().code} · ${num(h.currentBatch().liveBirds())} birds` })), selected, action);
  }

  // small round filter buttons
  chips(items, selected, action) {
    return `<div class="chips">${items.map(([k, label]) => `<button class="chip ${k === selected ? 'on' : ''}" data-do="${action}" data-f="${k}">${label}</button>`).join('')}</div>`;
  }

  // spreadsheet-like table. cols: [title, 'r' for right-aligned]
  table(cols, rows, { total = null, extraRows = {}, cls = '' } = {}) {
    const head = `<tr>${cols.map(([t, a]) => `<th class="${a || ''}">${t}</th>`).join('')}</tr>`;
    const body = rows.map((r, i) => `<tr>${r.map((c, j) => `<td class="${cols[j][1] || ''}">${c}</td>`).join('')}</tr>${extraRows[i] ? `<tr class="form-row"><td colspan="${cols.length}">${extraRows[i]}</td></tr>` : ''}`).join('');
    const foot = total ? `<tr class="total">${total.map((c, j) => `<td class="${cols[j][1] || ''}">${c}</td>`).join('')}</tr>` : '';
    return `<div class="table-wrap"><table class="grid ${cls}">${head}${body || `<tr><td colspan="${cols.length}" class="hint">Nothing yet</td></tr>`}${foot}</table></div>`;
  }

  showAllButton(key, count, scrollId) {
    if (count <= 15) return '';
    return `<button class="small soft" style="margin-top:8px" data-do="toggleAll" data-key="${key}" data-scroll="${scrollId}">${this.ui[key] ? 'Show less' : `Show all ${count}`}</button>`;
  }
  do_toggleAll(el) { this.ui[el.dataset.key] = !this.ui[el.dataset.key]; this.refresh(el.dataset.scroll); }

  totalBox(label, id, value) { return `<div class="total-box"><span>${label}</span><b id="${id}">${value}</b></div>`; }
  updateTotal(a, b, out) { document.getElementById(out).textContent = money((Number(val(a)) || 0) * (Number(val(b)) || 0)); }

  downloadCsv(name, header, rows) {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [header.map(q).join(',')].concat(rows.map(r => r.map(q).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `flockbook_${name}_${todayIso()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    showMsg(`Downloaded ${rows.length} row${rows.length === 1 ? '' : 's'}`);
  }

  openHouses() { return this.farm.houses.filter(h => h.currentBatch()); }
  pickedHouse(key) {
    const houses = this.openHouses();
    if (!houses.find(h => h.id === this.ui[key])) this.ui[key] = houses[0]?.id;
    return this.farm.house(this.ui[key]);
  }
  houseShort(b) { return this.farm.houseOf(b).name.replace('House ', 'H'); }
  short(n) {
    const a = Math.abs(n), sign = n < 0 ? '-' : '';
    if (a >= 1e6) return sign + (a / 1e6).toFixed(1) + 'M';
    if (a >= 1e3) return sign + Math.round(a / 1e3) + 'k';
    return sign + Math.round(a);
  }
  tag(text, kind = '') { return `<span class="tag ${kind}">${text}</span>`; }

  // temperature and humidity, updated every 3 seconds
  updateLive() {
    this.farm.houses.forEach(h => {
      const r = this.sensors.read(h), range = h.envRange();
      document.querySelectorAll(`[data-temp="${h.id}"]`).forEach(el => {
        el.textContent = r.temperature.toFixed(1) + ' °C';
        el.classList.toggle('red', r.temperature < range.minTemp || r.temperature > range.maxTemp);
      });
      document.querySelectorAll(`[data-hum="${h.id}"]`).forEach(el => {
        el.textContent = r.humidity + '%';
        el.classList.toggle('red', r.humidity < range.minHumidity || r.humidity > range.maxHumidity);
      });
    });
  }
  envBoxes(h) {
    return `<div class="env"><div><small>Temperature</small><b data-temp="${h.id}"></b></div><div><small>Humidity</small><b data-hum="${h.id}"></b></div></div>`;
  }

  // ================================================================ login
  loginPage() {
    return `<div class="login">
      <div class="title">FlockBook</div>
      <p class="hint">Nurota Halol Parranda farm</p>
      <div class="card" style="margin-top:24px">
        <label style="margin-top:0">Who are you?
          <select id="lg-user">${this.farm.users.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select>
        </label>
        <label>PIN <input id="lg-pin" type="password" inputmode="numeric" maxlength="4"></label>
        <button class="wide" data-do="login">Log in</button>
      </div>
      <p class="hint" style="text-align:center">Demo PINs: Director 1234, Jasur 1111, Bekzod 2222, Dilshod 3333</p>
    </div>`;
  }
  do_login() {
    const u = this.auth.login(val('lg-user'), val('lg-pin'));
    if (!u) return showMsg('Wrong PIN', 'warn');
    this.go(u.canViewFinance() ? '#/home' : '#/w');
  }
  do_logout() { this.auth.logout(); this.go('#/login'); }

  // ================================================================ worker
  workerPage(user) {
    const houses = this.openHouses().filter(h => user.assignedHouseIds.includes(h.id));
    if (!houses.find(h => h.id === this.ui.wHouse)) this.ui.wHouse = houses[0]?.id;
    const h = this.farm.house(this.ui.wHouse);
    if (!h) return '<p>No open batch.</p>';
    const b = h.currentBatch();
    const suppliers = this.farm.suppliers.filter(s => s instanceof FeedSupplier);
    const status = m => m.duplicateStatus === 'FLAGGED' ? this.tag('director will check', 'wait')
      : m.duplicateStatus === 'DISMISSED' ? this.tag('same bird', 'bad') : this.tag('counted');
    const deaths = b.mortality.filter(m => m.workerId === user.id && localDate(m.at) === todayIso()).reverse()
      .map(m => [time(m.at), `${m.count} dead`, status(m)]);
    const feed = b.feedDeliveries.filter(f => f.recordedBy === user.id && f.date === todayIso())
      .map(f => ['today', `Feed ${kg(f.kg)}`, this.tag('saved')]);

    return this.pageHead(`Hello, ${esc(user.name)}`)
      + this.card('House', this.houseTiles(h.id, 'wHouse', houses) + `<div style="margin-top:10px">${this.envBoxes(h)}</div>`)
      + this.card('Dead chicks found', `<div class="row"><input id="w-count" type="number" min="1" value="1"><button data-do="recordDeath">Record</button></div>
          <p class="hint">Saved with your name and the time.</p>`)
      + this.card('Feed delivery arrived', `<label style="margin-top:0">Supplier <select id="w-sup">${suppliers.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></label>
          <label>Quantity (kg) <input id="w-kg" type="number"></label>
          <button class="wide" data-do="workerFeed">Save delivery</button>`)
      + this.card('Today', this.table([['Time'], ['Record'], ['Status']], deaths.concat(feed)));
  }
  do_wHouse(el) { this.ui.wHouse = el.dataset.id; this.route(); }
  do_recordDeath() {
    const n = Number(val('w-count'));
    if (!n || n < 1) return showMsg('Enter how many', 'warn');
    const rec = this.farm.house(this.ui.wHouse).currentBatch().recordDeath(this.auth.currentUser().id, n);
    this.save(); this.route();
    if (rec.duplicateStatus === 'FLAGGED') showMsg('Saved. Someone reported the same a few minutes ago, so the director will check it.', 'warn');
    else showMsg('Saved');
  }
  do_workerFeed() {
    const amount = Number(val('w-kg'));
    if (!amount) return showMsg('Enter the quantity', 'warn');
    const b = this.farm.house(this.ui.wHouse).currentBatch();
    b.addFeedDelivery(new FeedDelivery({ id: uid('f'), date: todayIso(), supplierId: val('w-sup'), kg: amount, cost: 0, recordedBy: this.auth.currentUser().id }));
    this.save(); this.route(); showMsg('Feed delivery saved');
  }

  // ================================================================ director: home
  homePage() {
    let alerts = '';
    this.farm.houses.forEach(h => {
      const b = h.currentBatch(); if (!b) return;
      b.flaggedDuplicates().forEach(d => {
        const first = b.mortality.find(m => m.id === d.duplicateOf);
        alerts += `<div class="alert">${esc(h.name)}: ${esc(this.farm.user(first?.workerId)?.name)} and ${esc(this.farm.user(d.workerId)?.name)} both reported a dead chick at about ${time(d.at)}. Same bird?
          <div class="btns"><button class="small soft" data-do="dup" data-house="${h.id}" data-id="${d.id}" data-real="0">Same bird</button>
          <button class="small" data-do="dup" data-house="${h.id}" data-id="${d.id}" data-real="1">Two birds</button></div></div>`;
      });
      b.sales.filter(s => s instanceof BazaarSale && s.status() === 'MISMATCH').forEach(s =>
        alerts += `<div class="alert bad"><a href="#/analytics">Open</a>Bazaar weights do not match (${shortDate(s.date)})</div>`);
      const waiting = b.sales.filter(s => s instanceof BazaarSale && s.status() === 'PENDING').length;
      if (waiting) alerts += `<div class="alert"><a href="#/analytics">Open</a>${esc(h.name)}: ${waiting} bazaar sale${waiting > 1 ? 's' : ''} waiting for the agent's total</div>`;
      if (b.feedDeliveries.some(f => !f.cost)) alerts += `<div class="alert"><a href="#/costs">Open</a>${esc(h.name)}: a feed delivery has no price yet</div>`;
    });

    let html = this.pageHead('Today', `<span class="hint">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>`);
    if (alerts) html += this.card('To check', alerts);
    for (const h of this.openHouses()) {
      const b = h.currentBatch(), range = h.envRange(), cmd = this.lightCmds[h.id];
      const waiting = cmd && cmd.status === 'PENDING';
      let lightNote = '';
      if (waiting) lightNote = '<p class="hint">Waiting for the house to reply...</p>';
      else if (cmd && cmd.status === 'FAILED') lightNote = '<p class="hint red">No reply from the house. Not sure if the lights changed, please try again.</p>';
      else if (cmd && cmd.status === 'CONFIRMED') lightNote = `<p class="hint green">Done at ${time(cmd.confirmedAt)}</p>`;
      const profit = b.ledger().profit();
      html += this.card(esc(h.name), `${this.envBoxes(h)}
        <p class="hint">Good range for this age: ${range.minTemp}-${range.maxTemp} °C, ${range.minHumidity}-${range.maxHumidity}%</p>
        <div class="stats">
          <div><b>${num(b.liveBirds())}</b><small>birds</small></div>
          <div><b>${b.deathsOn()}</b><small>died today</small></div>
          <div><b class="${profit < 0 ? 'red' : 'green'}">${this.short(profit)}</b><small>profit so far</small></div>
        </div>
        <div class="light-row"><span>Lights are <b>${h.lightOn ? 'on' : 'off'}</b></span>
          <button class="small soft" data-do="light" data-house="${h.id}" ${waiting ? 'disabled' : ''}>Turn ${h.lightOn ? 'off' : 'on'}</button></div>
        ${lightNote}`, { action: `<span class="pill">${esc(b.code)} · day ${b.ageInDays()}</span>` });
    }
    html += '<p class="foot"><a href="#" data-do="reset">Reset demo data</a></p>';
    return html;
  }
  async do_light(el) {
    const h = this.farm.house(el.dataset.house);
    const turnOn = !h.lightOn;
    this.lightCmds[h.id] = new LightCommand({ houseId: h.id, requestedOn: turnOn });
    this.route();
    this.lightCmds[h.id] = await this.lights.switchLight(h, turnOn);
    this.save();
    if ((location.hash || '').startsWith('#/home')) this.route();
  }
  do_dup(el) {
    this.farm.house(el.dataset.house).currentBatch().resolveDuplicate(el.dataset.id, el.dataset.real === '1');
    this.save(); this.route();
    showMsg(el.dataset.real === '1' ? 'Counted as two birds' : 'Counted once');
  }
  do_reset() { this.farm = this.store.reset(); this.auth.farm = this.farm; this.lightCmds = {}; this.ui = {}; this.route(); showMsg('Demo data restored'); }

  // ================================================================ director: slaughter
  slaughterRows() {
    return this.farm.houses.flatMap(h => h.batches.flatMap(b => b.sessions.map(s => ({ h, b, s }))))
      .sort((a, c) => c.s.date.localeCompare(a.s.date));
  }
  slaughterPage() {
    const h = this.pickedHouse('slHouse');
    const f = this.ui.slFilter || 'ALL';
    const all = this.slaughterRows();
    const shown = f === 'ALL' ? all : all.filter(r => r.h.id === f);
    const visible = this.ui.slAll ? shown : shown.slice(0, 15);
    const extra = {};
    const rows = visible.map((r, i) => {
      const s = r.s;
      if (this.ui.slEdit === s.id) {
        extra[i] = `<div class="check-box">Crew said ${num(s.reportedHeadCount)}${s.corrections.map(c => `, changed to ${num(c.newCount)} ("${esc(c.note)}")`).join('')}
          <div class="row"><input id="ed-count" type="number" value="${s.headCount()}"><input id="ed-note" placeholder="Reason"><button data-do="saveCorrection" data-batch="${r.b.id}" data-id="${s.id}">Save</button></div></div>`;
      }
      return [shortDate(s.date), esc(this.houseShort(r.b)), num(s.headCount()), num(s.ratePerHead), this.short(s.crewPay()),
        `<button class="tagbtn ${s.isCorrected() ? 'wait' : 'plain'}" data-do="editSession" data-id="${s.id}">${s.isCorrected() ? 'edited' : 'edit'}</button>`];
    });
    const totBirds = shown.reduce((a, r) => a + r.s.headCount(), 0), totPay = shown.reduce((a, r) => a + r.s.crewPay(), 0);

    return this.pageHead('Slaughter')
      + this.card('New session', `${this.houseTiles(h.id, 'slHouse')}
          <div class="row">
            <label>Birds (butcher's count) <input id="sl-count" type="number" value="${this.ui.slCount || ''}"></label>
            <label>Pay per bird <input id="sl-rate" type="number" value="1500"></label>
          </div>
          ${this.totalBox('Crew pay', 'sl-total', money((Number(this.ui.slCount) || 0) * 1500))}
          <button class="wide" data-do="saveSession">Save session</button>`)
      + this.card('Slaughter history', this.chips([['ALL', 'All'], ['h1', 'House 1'], ['h2', 'House 2']], f, 'slFilter')
          + this.table([['Date'], ['House'], ['Birds', 'r'], ['UZS/bird', 'r'], ['Pay', 'r'], ['']], rows,
            { total: [`Total (${shown.length})`, '', num(totBirds), '', this.short(totPay), ''], extraRows: extra })
          + this.showAllButton('slAll', shown.length, 'slaughter')
          + '<p class="hint">A count can only be changed with a reason. The old count is kept.</p>',
        { id: 'slaughter', action: '<button class="small soft" data-do="exportSlaughter">Download for Excel</button>' });
  }
  do_slHouse(el) { this.ui.slCount = val('sl-count'); this.ui.slHouse = el.dataset.id; this.route(); }
  do_slFilter(el) { this.ui.slFilter = el.dataset.f; this.refresh('slaughter'); }
  do_editSession(el) { this.ui.slEdit = this.ui.slEdit === el.dataset.id ? null : el.dataset.id; this.refresh('slaughter'); }
  do_saveSession() {
    const b = this.farm.house(this.ui.slHouse).currentBatch();
    const count = Number(val('sl-count'));
    if (!count) return showMsg('Enter the number of birds', 'warn');
    if (count > b.liveBirds()) return showMsg(`There are only ${num(b.liveBirds())} birds`, 'warn');
    const s = b.addSession(new SlaughterSession({ id: uid('ss'), date: todayIso(), reportedHeadCount: count, ratePerHead: val('sl-rate'), driverFee: 350000 }));
    this.ui.slCount = ''; this.save(); this.route(); showMsg(`Saved. Pay the crew ${money(s.crewPay())}`);
  }
  do_saveCorrection(el) {
    const s = this.farm.batch(el.dataset.batch).sessions.find(x => x.id === el.dataset.id);
    try { s.correctHeadCount(Number(val('ed-count')), val('ed-note'), this.auth.currentUser().id); }
    catch (e) { return showMsg('Please write a reason', 'warn'); }
    this.ui.slEdit = null; this.save(); this.refresh('slaughter'); showMsg('Count changed. The old count is kept.');
  }
  do_exportSlaughter() {
    this.downloadCsv('slaughter', ['Date', 'House', 'Batch', 'Birds (crew said)', 'Birds (final)', 'Pay per bird', 'Crew pay', 'Driver fee', 'Change reason'],
      this.slaughterRows().map(({ h, b, s }) => [s.date, h.name, b.code, s.reportedHeadCount, s.headCount(), s.ratePerHead, s.crewPay(), s.driverFee,
        s.corrections.map(c => c.note).join('; ')]));
  }

  // ================================================================ sales data (used by + Sale and Analytics)
  allBatches() { return this.farm.houses.flatMap(h => h.batches); }
  saleRows(batches) {
    return batches.flatMap(b => b.sales.map(s => ({
      s, b, buyer: this.farm.buyer(s.buyerId), amount: s.amount(),
      kg: s.confirmedKg() != null ? s.confirmedKg() : (s.tallyKg ?? s.agentKg ?? null),
      status: s instanceof BazaarSale ? s.status() : 'PAID'
    }))).sort((a, c) => c.s.date.localeCompare(a.s.date));
  }
  lastPrice(buyerId) {
    const r = this.saleRows(this.allBatches()).find(x => x.s.buyerId === buyerId);
    return r ? r.s.pricePerKg : 26000;
  }

  // ================================================================ director: + sale
  sellPage() {
    if (!this.farm.buyer(this.ui.buyer)) this.ui.buyer = this.farm.buyers[0].id;
    const buyer = this.farm.buyer(this.ui.buyer);
    const h = this.pickedHouse('sellHouse');
    const isBazaar = buyer instanceof BazaarAgent;
    const price = this.ui.sellPrice || this.lastPrice(buyer.id);
    const recent = this.saleRows(this.allBatches()).slice(0, 5)
      .map(r => [shortDate(r.s.date), esc(r.buyer.label), kg1(r.kg), r.amount == null ? '<i>on hold</i>' : num(r.amount)]);
    const buyers = this.farm.buyers.map(b => ({ id: b.id, title: b.label, sub: b instanceof ShopCustomer ? 'walk-in customers' : b.name.replace(/\s*\(.*\)/, '') }));

    return this.pageHead('New sale', '<a class="btn-small soft" href="#/analytics">All sales</a>')
      + this.card('Buyer', this.tiles(buyers, buyer.id, 'buyer'))
      + this.card('From', this.houseTiles(h.id, 'sellHouse'))
      + this.card('Weight and price', `<div class="row">
          <label style="margin-top:0">${isBazaar ? 'Our tally (kg)' : 'Weight (kg)'} <input id="sell-kg" type="number" step="0.1" inputmode="decimal" value="${this.ui.sellKg || ''}"></label>
          <label style="margin-top:0">Price per kg <input id="sell-price" type="number" value="${price}"></label></div>
          ${this.totalBox('Total', 'sell-total', money((Number(this.ui.sellKg) || 0) * price))}
          ${isBazaar ? '<p class="hint">The agent\'s own total is added later, when his photo comes (Analytics, sales history).</p>' : ''}
          <button class="wide" data-do="saveSale">Save sale</button>`)
      + this.card('Last sales', this.table([['Date'], ['Buyer'], ['kg', 'r'], ['Amount', 'r']], recent));
  }
  keepSellInputs() { this.ui.sellKg = val('sell-kg'); }
  do_buyer(el) { this.keepSellInputs(); this.ui.sellPrice = null; this.ui.buyer = el.dataset.id; this.route(); }
  do_sellHouse(el) { this.keepSellInputs(); this.ui.sellPrice = Number(val('sell-price')); this.ui.sellHouse = el.dataset.id; this.route(); }
  do_saveSale() {
    const weight = Number(val('sell-kg')), price = Number(val('sell-price'));
    if (!weight) return showMsg('Enter the weight', 'warn');
    if (!price) return showMsg('Enter the price', 'warn');
    const buyer = this.farm.buyer(this.ui.buyer);
    const b = this.farm.house(this.ui.sellHouse).currentBatch();
    const data = { id: uid('sa'), date: todayIso(), buyerId: buyer.id, pricePerKg: price };
    // for the bazaar agent we save our tally; his total comes later
    b.addSale(buyer instanceof BazaarAgent ? new BazaarSale({ ...data, tallyKg: weight, agentKg: null }) : new DirectSale({ ...data, kg: weight }));
    this.ui.sellKg = ''; this.ui.sellPrice = null;
    this.save(); this.route();
    showMsg(buyer instanceof BazaarAgent ? `Saved ${kg(weight)}. Waiting for the agent's total.` : `Saved: ${kg(weight)}, ${money(weight * price)}`);
  }

  // ================================================================ director: costs
  costsPage() {
    const h = this.pickedHouse('costHouse');
    if (!h) return this.pageHead('Costs') + '<p>No open batches.</p>';
    const b = h.currentBatch();
    const noPrice = b.feedDeliveries.filter(f => !f.cost);
    const all = [...b.expenses].sort((x, y) => y.date.localeCompare(x.date));
    const visible = this.ui.costAll ? all : all.slice(0, 15);
    let html = this.pageHead('Costs') + this.card('House', this.houseTiles(h.id, 'costHouse'));
    if (noPrice.length) {
      html += this.card('Feed without a price', this.table([['Date'], ['Feed'], ['Price (UZS)']],
        noPrice.map(f => [shortDate(f.date), `${kg(f.kg)}<br><small>${esc(this.farm.supplier(f.supplierId)?.name)}</small>`,
          `<div class="row"><input id="fc-${f.id}" type="number" placeholder="Price"><button class="small" data-do="feedCost" data-batch="${b.id}" data-id="${f.id}">Save</button></div>`])));
    }
    html += this.card('Add a cost', `<div class="row"><label style="margin-top:0">Amount (UZS) <input id="ex-amount" type="number"></label>
          <label style="margin-top:0">Type <select id="ex-cat">${['FEED', 'MEDICINE', 'UTILITIES', 'TRANSPORT', 'REPAIRS', 'OTHER'].map(c => `<option value="${c}">${ExpenseCategoryLabel[c]}</option>`).join('')}</select></label></div>
        <label>What for <input id="ex-reason"></label>
        <button class="wide" data-do="saveExpense" data-batch="${b.id}">Save cost</button>`);
    html += this.card(`Cost history (${esc(b.code)})`, this.table([['Date'], ['What for'], ['Amount', 'r']],
        visible.map(e => [shortDate(e.date), `${esc(e.reason || '-')}<br><small class="hint">${ExpenseCategoryLabel[e.category]}</small>`, num(e.amount)]),
        { total: [`Total, ${all.length} costs`, '', num(all.reduce((a, e) => a + e.amount, 0))] })
      + this.showAllButton('costAll', all.length, 'costs') + '<p class="hint">Chicks, feed and crew pay are counted separately. All costs together are in Analytics.</p>',
      { id: 'costs' });
    return html;
  }
  do_costHouse(el) { this.ui.costHouse = el.dataset.id; this.route(); }
  do_saveExpense(el) {
    const amount = Number(val('ex-amount'));
    if (!amount) return showMsg('Enter the amount', 'warn');
    this.farm.batch(el.dataset.batch).addExpense(new Expense({ id: uid('e'), date: todayIso(), category: val('ex-cat'), amount, reason: val('ex-reason') }));
    this.save(); this.route(); showMsg(`Saved ${money(amount)}`);
  }
  do_feedCost(el) {
    const f = this.farm.batch(el.dataset.batch).feedDeliveries.find(x => x.id === el.dataset.id);
    const cost = Number(val('fc-' + f.id));
    if (!cost) return showMsg('Enter the price', 'warn');
    f.cost = cost; this.save(); this.route(); showMsg('Price saved');
  }

  // ================================================================ director: analytics (the report)
  stats(batches) {
    const s = { placed: 0, dead: 0, slaughtered: 0, alive: 0, feedKg: 0, revenue: 0, costs: 0, onHold: 0, kgSold: 0, byType: {} };
    batches.forEach(b => {
      const l = b.ledger();
      s.placed += b.chicksPlaced(); s.dead += b.deaths(); s.slaughtered += b.birdsSlaughtered(); s.alive += b.liveBirds();
      s.feedKg += b.totalFeedKg(); s.revenue += l.totalRevenue(); s.costs += l.totalCosts(); s.onHold += l.pendingRevenue(); s.kgSold += l.kgSold();
      Object.entries(l.costsByCategory()).forEach(([c, v]) => { s.byType[c] = (s.byType[c] || 0) + v; });
    });
    s.profit = s.revenue - s.costs;
    s.avgPrice = s.kgSold ? s.revenue / s.kgSold : 0;
    s.mortality = s.placed ? s.dead / s.placed : 0;
    s.feedPerBird = s.placed ? s.feedKg / s.placed : 0;
    s.profitPerBird = s.slaughtered ? s.profit / s.slaughtered : 0;
    return s;
  }
  // length of a batch: until today, or until the last slaughter if it is finished
  batchDays(b) {
    if (b.status === 'OPEN') return b.ageInDays();
    const last = b.sessions.map(s => s.date).sort().pop();
    return last ? dayDiff(b.startDate, new Date(last)) : b.ageInDays();
  }
  reportBatches() {
    const sel = this.ui.report || 'all';
    return sel === 'all' ? this.allBatches() : this.allBatches().filter(b => b.id === sel);
  }

  analyticsPage() {
    const all = this.allBatches();
    const sel = this.ui.report || 'all';
    const chosen = this.reportBatches();
    const s = this.stats(chosen);
    const running = chosen.some(b => b.status === 'OPEN');
    const pct = v => (v * 100).toFixed(1) + '%';
    let html = this.pageHead('Analytics', '<a class="btn-small" href="#/sell">+ New sale</a>');

    // all batches side by side
    const cmp = all.map(b => {
      const x = this.stats([b]);
      return [`<b>${esc(b.code)}</b>${b.status === 'OPEN' ? ' <small>running</small>' : ''}`,
        `<b class="${x.profit < 0 ? 'red' : 'green'}">${this.short(x.profit)}</b>`, b.status === 'OPEN' ? '-' : num(x.profitPerBird),
        pct(x.mortality), x.feedPerBird.toFixed(2), x.kgSold ? num(x.avgPrice) : '-', this.batchDays(b)];
    });
    html += this.card('All batches', this.table([['Batch'], ['Profit', 'r'], ['Per bird', 'r'], ['Died', 'r'], ['Feed/bird', 'r'], ['UZS/kg', 'r'], ['Days', 'r']], cmp)
      + '<p class="hint">Running batches show profit so far. "Per bird" is profit per slaughtered bird.</p>');

    // which batch to look at
    html += this.card('Details for', this.chips([['all', 'All batches']].concat(all.map(b => [b.id, b.code])), sel, 'report'), { id: 'details' });

    // summary
    const fin = this.stats(chosen.filter(b => b.status !== 'OPEN')), run = this.stats(chosen.filter(b => b.status === 'OPEN'));
    const mixed = chosen.length > 1 && fin.placed && run.placed;
    html += this.card('Summary', `${mixed
        ? `<div class="two-profit"><div><small class="hint">Finished batches</small><div class="big ${fin.profit < 0 ? 'red' : 'green'}">${this.short(fin.profit)}</div></div>
           <div><small class="hint">Running, so far</small><div class="big ${run.profit < 0 ? 'red' : 'green'}">${this.short(run.profit)}</div></div></div>`
        : `<small class="hint">Profit${running ? ' so far' : ''}</small><div class="big ${s.profit < 0 ? 'red' : 'green'}">${money(s.profit)}</div>`}
      <div class="kpis">
        <div><small>Received</small><b>${this.short(s.revenue)}</b></div>
        <div><small>Costs</small><b>${this.short(s.costs)}</b></div>
        <div><small>Waiting</small><b>${this.short(s.onHold)}</b></div>
        <div><small>Meat sold</small><b>${num(s.kgSold)} kg</b></div>
        <div><small>Avg price</small><b>${s.kgSold ? num(s.avgPrice) : '-'}</b></div>
        <div><small>Feed per bird</small><b>${s.feedPerBird.toFixed(2)} kg</b></div>
      </div>
      ${running ? `<p class="hint">${num(s.alive)} birds are still in the houses, so the profit will still change. "Waiting" is bazaar money not checked yet.</p>` : ''}`);

    // birds
    const seg = (v, c) => s.placed ? `<i class="${c}" style="width:${(v / s.placed * 100).toFixed(1)}%"></i>` : '';
    html += this.card('Birds', `<div class="stackbar">${seg(s.slaughtered, 'c-sold')}${seg(s.alive, 'c-alive')}${seg(s.dead, 'c-dead')}</div>
      <div class="legend"><span><i class="c-sold"></i>Slaughtered ${num(s.slaughtered)}</span><span><i class="c-alive"></i>In house ${num(s.alive)}</span>
        <span><i class="c-dead"></i>Died ${num(s.dead)} (${pct(s.mortality)})</span></div>
      <p class="hint">${num(s.placed)} chicks placed</p>`);

    // costs
    const types = Object.entries(s.byType).sort((a, c) => c[1] - a[1]);
    html += this.card('Where the money goes', types.map(([c, v]) => `<div class="bar-row"><span>${ExpenseCategoryLabel[c]}</span>
        <div class="bar"><i style="width:${(v / s.costs * 100).toFixed(1)}%"></i></div><b>${this.short(v)}</b></div>`).join('')
      + `<p class="hint">Total costs ${money(s.costs)}</p>`);

    // sales by buyer
    const rows = this.saleRows(chosen);
    const byBuyer = {};
    rows.forEach(r => {
      const k = r.buyer.type;
      byBuyer[k] = byBuyer[k] || { name: r.buyer.label, kg: 0, amount: 0 };
      if (r.amount != null) { byBuyer[k].kg += r.kg; byBuyer[k].amount += r.amount; }
    });
    html += this.card('Sales by buyer', this.table([['Buyer'], ['kg', 'r'], ['UZS/kg', 'r'], ['Amount', 'r'], ['Share', 'r']],
      Object.values(byBuyer).sort((a, c) => c.amount - a.amount).map(x => [esc(x.name), num(x.kg), x.kg ? num(x.amount / x.kg) : '-', this.short(x.amount),
        (s.revenue ? Math.round(x.amount / s.revenue * 100) : 0) + '%'])));

    html += this.salesHistory(rows);
    return html;
  }
  do_report(el) { this.ui.report = el.dataset.f; this.ui.checkSale = null; this.refresh('details'); }

  salesHistory(rows) {
    const f = this.ui.salesFilter || 'ALL';
    const needs = rows.filter(r => r.status === 'PENDING' || r.status === 'MISMATCH');
    const shown = f === 'ALL' ? rows : f === 'CHECK' ? needs : rows.filter(r => r.buyer.type === f);
    const visible = this.ui.salesAll ? shown : shown.slice(0, 15);
    const done = { PAID: this.tag('paid'), MATCHED: this.tag('checked'), RESOLVED: this.tag('settled') };
    const extra = {};
    const table = visible.map((r, i) => {
      const open = r.status === 'PENDING' || r.status === 'MISMATCH';
      if (this.ui.checkSale === r.s.id) extra[i] = this.checkForm(r.s);
      return [shortDate(r.s.date), esc(r.buyer.label), esc(this.houseShort(r.b)), kg1(r.kg), num(r.s.pricePerKg), r.amount == null ? '<i>on hold</i>' : num(r.amount),
        open ? `<button class="tagbtn ${r.status === 'MISMATCH' ? 'bad' : 'wait'}" data-do="checkSale" data-id="${r.s.id}">${r.status === 'MISMATCH' ? 'no match' : 'waiting'} ›</button>` : done[r.status]];
    });
    const paid = shown.filter(r => r.amount != null);
    const totKg = paid.reduce((a, r) => a + r.kg, 0), totAmt = paid.reduce((a, r) => a + r.amount, 0);
    return this.card('Sales history',
      this.chips([['ALL', 'All'], ['CHECK', `To check (${needs.length})`], ['BAZAAR_AGENT', 'Bazaar'], ['NURATA_SELLER', 'Nurata'], ['SHOP_CUSTOMER', 'Shop'], ['CLIENT', 'Clients']], f, 'salesFilter')
      + this.table([['Date'], ['Buyer'], ['House'], ['kg', 'r'], ['UZS/kg', 'r'], ['Amount', 'r'], ['Status']], table,
        { total: [`Total, ${shown.length} sales`, '', '', num(totKg), totKg ? num(totAmt / totKg) : '-', num(totAmt), ''], extraRows: extra, cls: 'wide-table' })
      + this.showAllButton('salesAll', shown.length, 'sales')
      + '<p class="hint">Sales "on hold" are not in the total until the weights are checked.</p>',
      { id: 'sales', action: '<button class="small soft" data-do="exportSales">Download for Excel</button>' });
  }
  checkForm(s) {
    if (s.status() === 'PENDING') {
      const missing = s.agentKg == null ? "agent's total (from his photo)" : 'our tally';
      return `<div class="check-box">Our tally: <b>${kg(s.tallyKg)}</b>, agent: <b>${kg(s.agentKg)}</b>
        <div class="row"><input id="fill-${s.id}" type="number" step="0.1" placeholder="Enter ${missing}, kg"><button data-do="fillWeight" data-id="${s.id}">Save</button></div></div>`;
    }
    return `<div class="check-box">Agent ${kg(s.agentKg)}, our tally ${kg(s.tallyKg)}: <b class="red">${Math.abs(s.difference())} kg difference</b>
      <div class="row"><input id="agree-${s.id}" type="number" step="0.1" value="${s.tallyKg}"><input id="why-${s.id}" placeholder="Reason"><button data-do="settle" data-id="${s.id}">Settle</button></div></div>`;
  }
  do_salesFilter(el) { this.ui.salesFilter = el.dataset.f; this.refresh('sales'); }
  do_checkSale(el) { this.ui.checkSale = this.ui.checkSale === el.dataset.id ? null : el.dataset.id; this.refresh('sales'); }
  findSale(id) {
    for (const h of this.farm.houses) for (const b of h.batches) { const s = b.sales.find(x => x.id === id); if (s) return s; }
    return null;
  }
  do_fillWeight(el) {
    const s = this.findSale(el.dataset.id), v = Number(val('fill-' + s.id));
    if (!v) return showMsg('Enter the weight', 'warn');
    if (s.agentKg == null) s.agentKg = v; else s.tallyKg = v;
    if (s.status() !== 'MISMATCH') this.ui.checkSale = null;
    this.save(); this.refresh('sales');
    showMsg(s.status() === 'MATCHED' ? `They match. Amount: ${money(s.amount())}` : 'They do not match. Please settle.', s.status() === 'MATCHED' ? 'ok' : 'warn');
  }
  do_settle(el) {
    const s = this.findSale(el.dataset.id);
    const agreed = Number(val('agree-' + s.id)), why = val('why-' + s.id);
    if (!agreed || !why) return showMsg('Enter the agreed kg and a reason', 'warn');
    s.resolve(agreed, why); this.ui.checkSale = null; this.save(); this.refresh('sales');
    showMsg(`Settled. Amount: ${money(s.amount())}`);
  }
  do_exportSales() {
    const f = this.ui.salesFilter || 'ALL';
    let rows = this.saleRows(this.reportBatches());
    if (f === 'CHECK') rows = rows.filter(r => r.status === 'PENDING' || r.status === 'MISMATCH');
    else if (f !== 'ALL') rows = rows.filter(r => r.buyer.type === f);
    this.downloadCsv('sales', ['Date', 'Buyer', 'Name', 'House', 'Batch', 'kg', 'Price per kg (UZS)', 'Amount (UZS)', 'Status'],
      rows.map(r => [r.s.date, r.buyer.label, r.buyer.name, this.farm.houseOf(r.b).name, r.b.code, r.kg ?? '', r.s.pricePerKg, r.amount ?? '', r.status.toLowerCase()]));
  }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new App(document.getElementById('app')); });

// Saving data (localStorage) and login.
'use strict';

class DataStore {
  static KEY = 'flockbook.v3';
  constructor(storage = window.localStorage) { this.storage = storage; }
  load() {
    try {
      const raw = this.storage.getItem(DataStore.KEY);
      if (raw) return new Farm(JSON.parse(raw));
    } catch (e) { console.warn('Could not read saved data, reseeding', e); }
    return this.reset();
  }
  save(farm) {
    try { this.storage.setItem(DataStore.KEY, JSON.stringify(farm)); } catch (e) { console.warn('save failed', e); }
  }
  reset() {
    const farm = new Farm(buildSeedData());
    this.save(farm);
    return farm;
  }
}

class AccessDeniedError extends Error {}

class AuthService {
  static KEY = 'flockbook.session';
  constructor(farm) { this.farm = farm; }
  login(userId, pin) {
    const u = this.farm.user(userId);
    if (!u || !u.verifyPin(pin)) return null;
    try { sessionStorage.setItem(AuthService.KEY, u.id); } catch (e) { /* private mode */ }
    this._current = u;
    return u;
  }
  logout() { this._current = null; try { sessionStorage.removeItem(AuthService.KEY); } catch (e) {} }
  currentUser() {
    if (this._current) return this._current;
    let id = null; try { id = sessionStorage.getItem(AuthService.KEY); } catch (e) {}
    this._current = id ? this.farm.user(id) : null;
    return this._current;
  }
  // Guard used by every screen that shows money.
  requireFinance() {
    const u = this.currentUser();
    if (!u || !u.canViewFinance()) throw new AccessDeniedError('Only the director can see money');
    return u;
  }
}

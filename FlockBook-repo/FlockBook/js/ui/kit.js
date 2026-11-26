// Small helper functions used by the screens
'use strict';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function num(n) { return Math.round(n).toLocaleString('en-US'); }
function money(n) { return n == null ? '-' : num(n) + ' UZS'; }
function kg(n) { return n == null ? '-' : (+n).toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' kg'; }
function shortDate(iso) { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
function time(iso) { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
function todayIso() { return localDate(); }

// message bar at the top of the page
function showMsg(text, type = 'ok') {
  let bar = document.getElementById('msg');
  if (!bar) { bar = document.createElement('div'); bar.id = 'msg'; document.body.appendChild(bar); }
  bar.className = 'msg ' + type;
  bar.textContent = text;
  bar.style.display = 'block';
  clearTimeout(showMsg.timer);
  showMsg.timer = setTimeout(() => { bar.style.display = 'none'; }, 3500);
}

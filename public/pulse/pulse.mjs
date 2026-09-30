import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app-check.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, query, where, orderBy, onSnapshot, Timestamp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';
import { firebaseConfig, recaptchaSiteKey } from './config.mjs';
import * as S from './stats.mjs';

const OWNER_UID = 'qdhJLMDxSdVdILg2CTCcIhZyBDz2';
const HOUR = 3_600_000, DAY = 24 * HOUR, ONLINE = 6 * 60_000;
const $ = id => document.getElementById(id);

// Local dev: localhost can't pass reCAPTCHA, so use a debug token (a verify
// script injects one; otherwise the SDK prints a fresh one to register).
if (location.hostname === 'localhost' && !self.FIREBASE_APPCHECK_DEBUG_TOKEN) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;

// Its own app name keeps this page's sign-in separate from the app's on the same origin.
const app = initializeApp(firebaseConfig, 'pulse');
if (recaptchaSiteKey) initializeAppCheck(app, { provider: new ReCaptchaV3Provider(recaptchaSiteKey), isTokenAutoRefreshEnabled: true });
const auth = getAuth(app);
const db = getFirestore(app);

// ── state ──────────────────────────────────────────────────────────────────
const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const state = { range: '24h', anchor: Date.now(), trip: 'all', zone: viewerZone, hourMode: 'local', rows: [], trips: new Map(), users: new Map(), now: Date.now() };
let unsubRows = null, unsubTrips = null, unsubUsers = null;

function showError(msg) { const e = $('err'); e.textContent = msg; e.hidden = !msg; }

// ── sign-in ────────────────────────────────────────────────────────────────
$('signin').addEventListener('submit', async ev => {
  ev.preventDefault();
  const id = $('user').value.trim(), pass = $('pass').value;
  $('signinBtn').disabled = true; $('gateMsg').textContent = 'Signing in…';
  try {
    let email = id;
    if (!id.includes('@')) {
      const u = await getDoc(doc(db, 'usernames', id.toLowerCase()));
      if (!u.exists()) throw new Error('Invalid username, email, or password.');
      email = u.data().authEmail;
    }
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    $('pass').value = '';
    $('gateMsg').textContent = cred.user.uid === OWNER_UID ? '' : 'That account is not the app owner. Signed out.';
  } catch (err) {
    $('gateMsg').textContent = /invalid|credential|password|user-not-found/i.test(err.message) ? 'Invalid username, email, or password.' : err.message;
  } finally { $('signinBtn').disabled = false; }
});
$('signOut').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, user => {
  const owner = !!user && user.uid === OWNER_UID;
  $('gate').hidden = owner;
  $('dash').hidden = !owner;
  $('who').hidden = !owner;
  if (user && !owner) signOut(auth);
  if (owner) start(); else stop();
});

// ── data ───────────────────────────────────────────────────────────────────
function start() {
  $('whoName').textContent = 'Signed in as the app owner';
  unsubTrips = onSnapshot(collection(db, 'trips'), snap => {
    state.trips = new Map(snap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
    render();
  }, err => showError('Trips: ' + err.message));
  unsubUsers = onSnapshot(collection(db, 'users'), snap => {
    state.users = new Map(snap.docs.map(d => [d.id, d.data()]));
    render();
  }, err => showError('People: ' + err.message));
  subscribeRows();
}
function stop() {
  unsubRows?.(); unsubTrips?.(); unsubUsers?.(); unsubRows = unsubTrips = unsubUsers = null;
  $('dot').classList.remove('on');
}
function queryStart() {
  const a = state.anchor;
  return { today: S.startOfDay(a, state.zone), '24h': a - DAY, '7d': a - 7 * DAY, '30d': a - 30 * DAY }[state.range];
}
function subscribeRows() {
  unsubRows?.();
  $('dot').classList.remove('on');
  const q = query(collection(db, '_activity'), where('at', '>=', Timestamp.fromMillis(queryStart())), orderBy('at'));
  unsubRows = onSnapshot(q, snap => {
    const rows = [];
    for (const d of snap.docs) {
      const e = d.data();
      const at = e.at?.toMillis?.();
      if (at === undefined) continue; // pending local write
      rows.push({ ...e, at });
    }
    state.rows = rows;
    $('dot').classList.add('on');
    showError('');
    render();
  }, err => { showError('Activity: ' + err.message); $('dot').classList.remove('on'); });
}
setInterval(() => { state.now = Date.now(); if (!$('dash').hidden) render(); }, 30_000);

// ── controls ───────────────────────────────────────────────────────────────
$('range').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-range]'); if (!b) return;
  state.range = b.dataset.range; state.anchor = Date.now();
  for (const x of $('range').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
  subscribeRows(); render();
});
$('trip').addEventListener('change', ev => { state.trip = ev.target.value; render(); });
$('zone').addEventListener('change', ev => { state.zone = ev.target.value; if (state.range === 'today') subscribeRows(); render(); });
$('hourMode').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-mode]'); if (!b) return;
  state.hourMode = b.dataset.mode; render();
});

// ── helpers ────────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const userName = uid => state.users.get(uid)?.displayName ?? `…${uid.slice(-5)}`;
const tripName = id => id ? (state.trips.get(id)?.name ?? `Trip …${id.slice(-4)}`) : 'No trip';
const zoneShort = tz => (tz || '').split('/').pop().replace(/_/g, ' ') || tz;
function ago(ms) {
  const s = Math.max(0, Math.round((state.now - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
function dayLabel(day) {
  if (day === S.dayKey(state.now, state.zone)) return 'Today';
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function avatar(uid) {
  const u = state.users.get(uid);
  const glyph = u?.avatarEmoji || (u?.displayName?.[0] ?? '?');
  const color = u?.avatarLetterColor ? `color:${esc(u.avatarLetterColor)};` : '';
  return `<span class="avatar" style="background:${esc(u?.color || '')};${color}">${esc(glyph)}</span>`;
}
function tripPhase(t, today) {
  if (t.archived) return ['past', 'Archived'];
  if (!t.startDate || !t.endDate) return ['', 'Undated'];
  if (today < t.startDate) return ['soon', 'Upcoming'];
  if (today > t.endDate) return ['past', 'Ended'];
  return ['live', 'Happening now'];
}
function bars(el, items, max, { valueLabel = false, tick } = {}) {
  el.innerHTML = items.map((it, i) => `
    <div class="col" title="${esc(it.title)}">
      ${valueLabel ? `<div class="val num">${it.value}</div>` : ''}
      <div class="bar${it.value === 0 ? ' zero' : ''}" style="height:${max ? (it.value / max) * 100 : 0}%"></div>
      <div class="tick">${esc(tick(it, i))}</div>
    </div>`).join('');
}

// ── render ─────────────────────────────────────────────────────────────────
function render() {
  const now = state.now;
  const all = state.rows;
  const rows = state.trip === 'all' ? all : all.filter(r => r.tripId === state.trip);

  // Selects: trips seen in events plus every trip doc; zones seen in events.
  const tripIds = new Set([...state.trips.keys(), ...all.map(r => r.tripId).filter(Boolean)]);
  const tripOpts = [...tripIds].map(id => ({ id, name: tripName(id) })).sort((a, b) => a.name.localeCompare(b.name));
  syncSelect($('trip'), [{ value: 'all', label: 'All trips' }, ...tripOpts.map(t => ({ value: t.id, label: t.name }))], state.trip);
  const zones = new Set([viewerZone, ...all.map(r => r.tz).filter(Boolean)]);
  syncSelect($('zone'), [...zones].sort().map(z => ({ value: z, label: z })), state.zone);
  const modes = [{ mode: 'local', label: "Each person's clock" }, ...[...zones].sort().map(z => ({ mode: z, label: zoneShort(z) }))];
  $('hourMode').innerHTML = modes.map(m => `<button type="button" data-mode="${esc(m.mode)}" aria-pressed="${state.hourMode === m.mode}">${esc(m.label)}</button>`).join('');

  // Totals
  const users = new Set(rows.map(r => r.uid)).size;
  const views = rows.filter(r => r.type === 'page').length;
  const sessions = rows.filter(r => r.type === 'session').length;
  const online = S.onlineNow(rows, now, ONLINE);
  const today = S.dayKey(now, state.zone);
  const liveTrips = [...state.trips.values()].filter(t => tripPhase(t, today)[0] === 'live').length;
  $('tiles').innerHTML = [
    [users, 'people'], [sessions, 'app opens'], [views, 'page views'], [online.length, 'online now'], [liveTrips, 'trips happening now'],
  ].map(([v, l]) => `<div class="tile"><div class="v num">${v}</div><div class="l">${l}</div></div>`).join('');
  const rangeLabel = { today: 'today', '24h': 'the last 24 hours', '7d': 'the last 7 days', '30d': 'the last 30 days' }[state.range];
  $('scope').textContent = `Counts for ${rangeLabel}${state.trip === 'all' ? '' : ', ' + tripName(state.trip) + ' only'}. Days and hour labels in ${state.zone}.`;

  // Trips table: every trip doc, with activity from the (unfiltered) rows.
  const byTrip = new Map(S.tripStats(all).map(t => [t.tripId, t]));
  const onlineByTrip = new Map();
  for (const o of S.onlineNow(all, now, ONLINE)) onlineByTrip.set(o.tripId, (onlineByTrip.get(o.tripId) ?? 0) + 1);
  const trips = [...state.trips.values()].map(t => ({ t, s: byTrip.get(t.id), phase: tripPhase(t, today), on: onlineByTrip.get(t.id) ?? 0 }))
    .sort((a, b) => (b.s?.lastSeen ?? 0) - (a.s?.lastSeen ?? 0) || (a.t.name || '').localeCompare(b.t.name || ''));
  $('tripsSub').textContent = `${state.trips.size} total · activity for ${rangeLabel}`;
  $('trips').innerHTML = trips.length === 0 ? '<tr><td class="muted">No trips yet.</td></tr>' : `
    <tr><th>Trip</th><th></th><th class="n">Members</th><th class="n">Online</th><th class="n">People</th><th class="n">Opens</th><th class="n">Views</th><th class="n">Last activity</th></tr>` +
    trips.map(({ t, s, phase, on }) => `
      <tr>
        <td><strong>${esc(t.name)}</strong><br><span class="muted" style="font-size:0.8rem">${esc(t.destination || '')}${t.startDate ? ' · ' + esc(t.startDate) + ' → ' + esc(t.endDate) : ''}</span></td>
        <td><span class="chip ${phase[0]}">${phase[1]}</span></td>
        <td class="n num">${t.memberCount ?? '–'}</td>
        <td class="n num">${on}</td>
        <td class="n num">${s?.users ?? 0}</td>
        <td class="n num">${s?.sessions ?? 0}</td>
        <td class="n num">${s?.views ?? 0}</td>
        <td class="n">${s ? ago(s.lastSeen) : '<span class="muted">none</span>'}</td>
      </tr>`).join('');

  // Online now
  $('online').innerHTML = online.length === 0 ? '<li class="empty">Nobody in the last 6 minutes.</li>' : online.map(o => `
    <li>${avatar(o.uid)}<span class="main"><span class="name">${esc(userName(o.uid))}</span>
      <span class="sub">${esc(o.page)} · ${esc(tripName(o.tripId))} · ${esc(o.platform)} · ${esc(zoneShort(o.tz))}</span></span>
      <span class="when">${ago(o.lastSeen)}</span></li>`).join('');

  // People per hour (last 24 h)
  const end = Math.ceil(now / HOUR) * HOUR;
  const perHour = S.usersPerHour(rows, end - DAY, end, state.zone);
  $('perHourSub').textContent = `last 24 h, ${state.zone}`;
  bars($('perHour'), perHour.map(b => ({ value: b.users, title: `${b.label}: ${b.users}`, label: b.label })), Math.max(1, ...perHour.map(b => b.users)),
    { tick: (it, i) => i % 4 === 0 ? it.label.slice(0, 2) : '' });

  // People per day
  const showDays = state.range === '7d' || state.range === '30d';
  $('perDayCard').hidden = !showDays;
  if (showDays) {
    const perDay = S.usersPerDay(rows, state.zone);
    bars($('perDay'), perDay.map(d => ({ value: d.users, title: `${d.day}: ${d.users}`, label: dayLabel(d.day) })), Math.max(1, ...perDay.map(d => d.users)),
      { valueLabel: true, tick: it => it.label });
  }

  // Hour of day
  const byHour = S.hourOfDay(rows, state.hourMode);
  bars($('byHour'), byHour.map((n, i) => ({ value: n, title: `${String(i).padStart(2, '0')}:00 — ${n}` })), Math.max(1, ...byHour),
    { tick: (it, i) => i % 6 === 0 ? String(i).padStart(2, '0') : '' });

  // Pages
  const pages = S.pageStats(rows);
  $('pages').innerHTML = pages.length === 0 ? '<tr><td class="muted">No page views yet.</td></tr>' :
    '<tr><th>Page</th><th class="n">Views</th><th class="n">People</th></tr>' +
    pages.map(p => `<tr><td class="page">${esc(p.page)}</td><td class="n num">${p.views}</td><td class="n num">${p.users}</td></tr>`).join('');

  // People
  const people = S.peopleStats(rows, state.zone);
  $('people').innerHTML = people.length === 0 ? '<li class="empty">Nobody yet.</li>' : people.map(p => `
    <li>${avatar(p.uid)}<span class="main"><span class="name">${esc(userName(p.uid))}</span>
      <span class="sub">${esc(tripName(p.tripId))} · ${esc(p.platform)} · ${esc(zoneShort(p.tz))} · ${p.views} views · ${p.sessions} opens · ${p.daysActive} ${p.daysActive === 1 ? 'day' : 'days'}</span></span>
      <span class="when">${ago(p.lastSeen)}</span></li>`).join('');
}

/** Rebuild a select's options only when they change, keeping the current value. */
function syncSelect(sel, opts, value) {
  const key = opts.map(o => o.value + '\u0000' + o.label).join('\u0001');
  if (sel.dataset.key !== key) {
    sel.innerHTML = opts.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
    sel.dataset.key = key;
  }
  sel.value = value;
}

// For browser checks: lets a test script feed rows in and re-render.
window.pulse = { state, render };

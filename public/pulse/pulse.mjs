import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app-check.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, setDoc, query, where, orderBy, onSnapshot, Timestamp, arrayUnion, arrayRemove } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';
import { firebaseConfig, recaptchaSiteKey } from './config.mjs';
import * as S from './stats.mjs';
import { ZONES } from './zones.mjs';

const OWNER_UID = 'qdhJLMDxSdVdILg2CTCcIhZyBDz2';
const HOUR = 3_600_000, DAY = 24 * HOUR, ONLINE = 3 * 60_000; // the app pings every 2 minutes while visible
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
const state = {
  range: '24h', anchor: Date.now(), trip: 'all', zone: viewerZone, hourMode: 'local',
  rows: [], trips: new Map(), users: new Map(), members: new Map(), now: Date.now(),
  testTrips: new Set(),
  showTests: false,       // test trips stay out of the table unless the owner asks to see them
  testUsers: new Set(),   // throwaway accounts (_pulse/prefs.testUsers, set by hand)
  hide: { me: false, testTrips: true, testUsers: true },   // the Hide checkboxes, saved to prefs
  tripSel: null,          // Set of trip ids, or null for all
};
let unsubRows = null, unsubTrips = null, unsubUsers = null, unsubPrefs = null;
const memberSubs = new Map(); // tripId → unsubscribe
/** The owner's dashboard preferences: test trips (kept out of every number) and the display zone. */
const prefsRef = () => doc(db, '_pulse', 'prefs');
const savePrefs = patch => setDoc(prefsRef(), patch, { merge: true }).catch(err => showError('Preferences: ' + err.message));

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
    syncMemberSubs();
    render();
  }, err => showError('Trips: ' + err.message));
  unsubUsers = onSnapshot(collection(db, 'users'), snap => {
    state.users = new Map(snap.docs.map(d => [d.id, d.data()]));
    render();
  }, err => showError('People: ' + err.message));
  unsubPrefs = onSnapshot(prefsRef(), snap => {
    const p = snap.exists() ? snap.data() : {};
    // `hiddenTrips` is the earlier name for the same list.
    state.testTrips = new Set(p.testTrips ?? p.hiddenTrips ?? []);
    state.testUsers = new Set(p.testUsers ?? []);
    state.hide = { me: false, testTrips: true, testUsers: true, ...(p.hide ?? {}) };
    for (const [k, v] of Object.entries(state.hide)) { const el = document.querySelector(`#hide input[name="${k}"]`); if (el) el.checked = !!v; }
    if (p.zone && p.zone !== state.zone) { state.zone = p.zone; if (state.range === 'today') subscribeRows(); }
    render();
  }, err => showError('Preferences: ' + err.message));
  subscribeRows();
}
/** One members listener per trip, following the trip list. */
function syncMemberSubs() {
  for (const [id, unsub] of memberSubs) if (!state.trips.has(id)) { unsub(); memberSubs.delete(id); state.members.delete(id); }
  for (const id of state.trips.keys()) {
    if (memberSubs.has(id)) continue;
    memberSubs.set(id, onSnapshot(collection(db, 'trips', id, 'members'), snap => {
      state.members.set(id, snap.docs.map(d => ({ uid: d.id, ...d.data() })).sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0)));
      render();
    }, err => showError('Members: ' + err.message)));
  }
}
function stop() {
  unsubRows?.(); unsubTrips?.(); unsubUsers?.(); unsubPrefs?.(); unsubRows = unsubTrips = unsubUsers = unsubPrefs = null;
  for (const unsub of memberSubs.values()) unsub();
  memberSubs.clear();
  $('dot').classList.remove('on');
}
function queryStart() {
  const a = state.anchor;
  return { today: S.startOfDay(a, state.zone), '24h': a - DAY, '7d': a - 7 * DAY, '30d': a - 30 * DAY, '60d': a - 60 * DAY, '180d': a - 180 * DAY, '1y': a - 365 * DAY }[state.range];
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
// Events arrive by push the moment they are written; this clock only keeps
// "x s ago" and the online window moving between them.
setInterval(() => { state.now = Date.now(); if (!$('dash').hidden) render(); }, 1000);

// ── controls ───────────────────────────────────────────────────────────────
$('range').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-range]'); if (!b) return;
  state.range = b.dataset.range; state.anchor = Date.now();
  for (const x of $('range').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
  subscribeRows(); render();
});
$('tripList').addEventListener('change', () => {
  const boxes = [...document.querySelectorAll('#tripList input')];
  const on = boxes.filter(b => b.checked).map(b => b.value);
  state.tripSel = on.length === 0 || on.length === boxes.length ? null : new Set(on);
  render();
});
$('hide').addEventListener('change', ev => {
  state.hide = { ...state.hide, [ev.target.name]: ev.target.checked };
  render();
  savePrefs({ hide: state.hide });
});
$('zone').addEventListener('change', ev => {
  state.zone = ev.target.value;
  if (state.range === 'today') subscribeRows();
  render();
  savePrefs({ zone: state.zone });
});
$('trips').addEventListener('click', ev => {
  if (ev.target.closest('button[data-toggle-tests]')) { state.showTests = !state.showTests; render(); return; }
  const b = ev.target.closest('button[data-test], button[data-real]'); if (!b) return;
  const id = b.dataset.test ?? b.dataset.real;
  savePrefs({ testTrips: b.dataset.test !== undefined ? arrayUnion(id) : arrayRemove(id) });
});
$('hourMode').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-mode]'); if (!b) return;
  state.hourMode = b.dataset.mode; render();
});

// ── hover details on the bar charts ────────────────────────────────────────
const tip = { el: $('tip'), chart: null, index: -1, html: new Map() };
function showTip(chart, index) {
  const col = document.querySelector(`#${chart} .col[data-i="${index}"]`);
  const html = tip.html.get(chart)?.[index];
  if (!col || !html) { hideTip(); return; }
  tip.chart = chart; tip.index = index;
  tip.el.innerHTML = html;
  tip.el.hidden = false;
  const r = col.getBoundingClientRect(), t = tip.el.getBoundingClientRect();
  const left = Math.min(Math.max(8, r.left + r.width / 2 - t.width / 2), window.innerWidth - t.width - 8);
  tip.el.style.left = `${left + window.scrollX}px`;
  tip.el.style.top = `${r.top + window.scrollY - t.height - 8}px`;
}
function hideTip() { tip.chart = null; tip.index = -1; tip.el.hidden = true; }
for (const chart of ['perHour', 'byHour', 'perDay', 'visitMinutes', 'visitPages', 'around', 'platform']) {
  const el = $(chart);
  el.addEventListener('pointerover', ev => { const c = ev.target.closest('.col'); if (c) showTip(chart, Number(c.dataset.i)); });
  el.addEventListener('pointerleave', hideTip);
  el.addEventListener('click', ev => { const c = ev.target.closest('.col'); if (c) showTip(chart, Number(c.dataset.i)); });
}
document.addEventListener('pointerdown', ev => { if (!ev.target.closest('.bars, #tip')) hideTip(); });

// ── helpers ────────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const userName = uid => state.users.get(uid)?.displayName ?? memberName(uid) ?? `…${uid.slice(-5)}`;
function memberName(uid) {
  for (const list of state.members.values()) { const m = list.find(x => x.uid === uid); if (m) return m.displayName; }
  return undefined;
}
const tripName = id => id ? (state.trips.get(id)?.name ?? `Trip …${id.slice(-4)}`) : 'No trip';
const zoneShort = tz => (tz || '').split('/').pop().replace(/_/g, ' ') || tz;
/** Zone abbreviation as of now (CDT, CEST); falls back to GMT+2 where a locale has no name for it. */
function zoneAbbr(tz) {
  if (!tz) return '';
  const at = new Date(state.now);
  const abbr = locale => {
    try { return new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: 'short' }).formatToParts(at).find(p => p.type === 'timeZoneName')?.value ?? ''; }
    catch { return ''; }
  };
  const named = ['en-US', 'en-GB', 'en-AU'].map(abbr).find(a => a && !/^(GMT|UTC)/.test(a));
  return named || abbr('en-US') || zoneShort(tz);
}
/** "CST (Chicago, Illinois, USA)": the abbreviation as of now, then where the zone is named after. */
function zoneName(tz) {
  const z = ZONES[tz];
  const place = z ? [z.city, z.region, z.country].filter(Boolean).join(', ') : zoneShort(tz);
  return `${zoneAbbr(tz)} (${place})`;
}
function ago(ms) {
  const s = Math.max(0, Math.round((state.now - ms) / 1000));
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 48) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
function dayLabel(day) {
  if (day === S.dayKey(state.now, state.zone)) return 'Today';
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
function avatar(uid, size = '') {
  const u = state.users.get(uid);
  const glyph = u?.avatarEmoji || (userName(uid)?.[0] ?? '?');
  const color = u?.avatarLetterColor ? `color:${esc(u.avatarLetterColor)};` : '';
  return `<span class="avatar ${size}" title="${esc(userName(uid))}" style="background:${esc(u?.color || '')};${color}">${esc(glyph)}</span>`;
}
const names = uids => uids.length ? uids.map(u => esc(userName(u))).join(', ') : '<span class="muted">nobody</span>';
const pageList = pages => pages.length ? `<br><span class="muted">Pages:</span> ${pages.map(esc).join(', ')}` : '';
/** Table order: happening now, upcoming, ended, archived, undated. */
const PHASE_ORDER = { live: 0, soon: 1, past: 2, archived: 3, '': 4 };
function tripPhase(t, today) {
  if (t.archived) return ['archived', 'Archived'];
  if (!t.startDate || !t.endDate) return ['', 'Undated'];
  if (today < t.startDate) return ['soon', 'Upcoming'];
  if (today > t.endDate) return ['past', 'Ended'];
  return ['live', 'Happening now'];
}
/** Bars: items carry value + tip html; `tick` labels the axis. */
function bars(chart, items, max, { valueLabel = false, tick }) {
  tip.html.set(chart, items.map(it => it.tip));
  $(chart).innerHTML = items.map((it, i) => `
    <div class="col" data-i="${i}" tabindex="0">
      ${valueLabel ? `<div class="val num">${it.value}</div>` : ''}
      <div class="bar${it.value === 0 ? ' zero' : ''}" style="height:${max ? (it.value / max) * 100 : 0}%"></div>
      <div class="tick">${esc(tick(it, i))}</div>
    </div>`).join('');
}
function allZones() {
  try { return Intl.supportedValuesOf('timeZone'); } catch { return []; }
}

// ── render ─────────────────────────────────────────────────────────────────
function render() {
  const now = state.now;
  // Hide: the owner, test trips and throwaway accounts leave every number; events with no trip (sign-in screen) stay.
  const hiddenUids = new Set([...(state.hide.testUsers ? state.testUsers : []), ...(state.hide.me ? [OWNER_UID] : [])]);
  const realRows = state.rows.filter(r => !hiddenUids.has(r.uid));
  const all = state.hide.testTrips ? realRows.filter(r => !r.tripId || !state.testTrips.has(r.tripId)) : realRows;
  const rows = !state.tripSel ? all : all.filter(r => r.tripId && state.tripSel.has(r.tripId));
  const realTrips = [...state.trips.values()].filter(t => !state.testTrips.has(t.id) || !state.hide.testTrips);
  const testTrips = [...state.trips.values()].filter(t => state.testTrips.has(t.id) && state.hide.testTrips);

  // Selects: real trips; zones seen in activity, then every zone the browser knows.
  const tripIds = new Set([...realTrips.map(t => t.id), ...all.map(r => r.tripId).filter(Boolean)]);
  const tripOpts = [...tripIds].map(id => ({ id, name: tripName(id) })).sort((a, b) => a.name.localeCompare(b.name));
  syncTripPicker(tripOpts);
  const zoneHits = new Map();
  for (const r of all) if (r.tz) zoneHits.set(r.tz, (zoneHits.get(r.tz) ?? 0) + 1);
  const seenZones = [...new Set([...[...zoneHits.entries()].sort((a, b) => b[1] - a[1]).map(([z]) => z), viewerZone, state.zone])];
  const opt = z => ({ value: z, label: zoneName(z) });
  const zoneOpts = [
    { group: 'Seen in activity', items: seenZones.map(opt) },
    { group: 'All zones', items: allZones().filter(z => !seenZones.includes(z)).map(opt) },
  ];
  syncSelect($('zone'), zoneOpts, state.zone);
  // A zone button converts everyone's hours to that zone; it never filters to the people there.
  const modes = [{ mode: 'local', label: "Each person's clock" }, ...seenZones.map(z => ({ mode: z, label: zoneAbbr(z) }))];
  $('hourMode').innerHTML = modes.map(m => `<button type="button" data-mode="${esc(m.mode)}" aria-pressed="${state.hourMode === m.mode}">${esc(m.label)}</button>`).join('');

  // Totals
  const users = new Set(rows.map(r => r.uid)).size;
  const views = rows.filter(r => r.type === 'page').length;
  const sessions = rows.filter(r => r.type === 'session').length;
  const online = S.onlineNow(rows, now, ONLINE);
  const today = S.dayKey(now, state.zone);
  const liveTrips = realTrips.filter(t => tripPhase(t, today)[0] === 'live').length;
  $('tiles').innerHTML = [
    [users, 'people'], [sessions, 'app opens'], [views, 'page views'], [online.length, 'online now'], [liveTrips, 'trips happening now'],
  ].map(([v, l]) => `<div class="tile"><div class="v num">${v}</div><div class="l">${l}</div></div>`).join('');
  const rangeLabel = { today: 'today', '24h': 'the last 24 hours', '7d': 'the last 7 days', '30d': 'the last 30 days', '60d': 'the last 60 days', '180d': 'the last 180 days', '1y': 'the last year' }[state.range];
  const selLabel = !state.tripSel ? '' : state.tripSel.size === 1 ? ', ' + tripName([...state.tripSel][0]) + ' only' : `, ${state.tripSel.size} trips only`;
  const hidden = [state.hide.me && 'you', state.hide.testTrips && 'test trips', state.hide.testUsers && 'test accounts'].filter(Boolean);
  $('hideSummary').textContent = hidden.length ? hidden.map(h => h === 'you' ? 'me' : h).join(', ') : 'nothing';
  $('scope').textContent = `Counts for ${rangeLabel}${selLabel}${hidden.length ? ', without ' + hidden.join(', ') : ''}. Days and hour labels in ${state.zone}.`;

  // Trips: real trips by phase (happening now, upcoming, ended), then test trips, dimmed.
  const byTrip = new Map(S.tripStats(realRows).map(t => [t.tripId, t]));
  const onlineByTrip = new Map();
  for (const o of S.onlineNow(realRows, now, ONLINE)) onlineByTrip.set(o.tripId, (onlineByTrip.get(o.tripId) ?? 0) + 1);
  const activeByTrip = new Map();
  for (const r of realRows) if (r.tripId) (activeByTrip.get(r.tripId) ?? activeByTrip.set(r.tripId, new Set()).get(r.tripId)).add(r.uid);
  const tripRow = t => ({ t, s: byTrip.get(t.id), phase: tripPhase(t, today), on: onlineByTrip.get(t.id) ?? 0, members: (state.members.get(t.id) ?? []).filter(m => !hiddenUids.has(m.uid)), active: activeByTrip.get(t.id) ?? new Set() });
  const byPhase = (a, b) => PHASE_ORDER[a.phase[0]] - PHASE_ORDER[b.phase[0]] || (b.s?.lastSeen ?? 0) - (a.s?.lastSeen ?? 0) || (a.t.name || '').localeCompare(b.t.name || '');
  const real = realTrips.map(tripRow).sort(byPhase);
  const tests = testTrips.map(tripRow).sort(byPhase);
  $('tripsSub').textContent = `${real.length} ${real.length === 1 ? 'trip' : 'trips'} · activity for ${rangeLabel}`;
  const tripTr = ({ t, s, phase, on, members, active }, isTest) => {
    const memberCount = members.length || t.memberCount || 0;
    const quiet = members.filter(m => !active.has(m.uid));
    return `
      <tr${isTest ? ' class="dim"' : ''}>
        <td><strong>${esc(t.name)}</strong>${isTest ? ' <span class="chip test">Test</span>' : ''}<br>
          <span class="muted small">${esc(t.destination || '')}${t.startDate ? ' · ' + esc(t.startDate) + ' → ' + esc(t.endDate) : ''}</span>
          <div class="memberline" title="${esc(members.map(m => m.displayName).join(', '))}">${members.map(m => avatar(m.uid, 'xs')).join('')}
            <span class="muted small">${members.length ? members.map(m => esc(m.displayName)).join(', ') : 'members not loaded'}</span></div></td>
        <td><span class="chip ${phase[0]}">${phase[1]}</span></td>
        <td class="n num">${memberCount}</td>
        <td class="n num">${on}</td>
        <td class="n num" title="${esc(quiet.length ? 'Not active: ' + quiet.map(m => m.displayName).join(', ') : 'Everyone has been active')}">${active.size}</td>
        <td class="n num">${s?.sessions ?? 0}</td>
        <td class="n num">${s?.views ?? 0}</td>
        <td class="n">${s ? ago(s.lastSeen) : '<span class="muted">none</span>'}</td>
        <td class="n"><button type="button" class="btn small" data-${isTest ? 'real' : 'test'}="${esc(t.id)}">${isTest ? 'Not a test' : 'Mark as test'}</button></td>
      </tr>`;
  };
  const head = '<tr><th>Trip</th><th></th><th class="n">Members</th><th class="n">Online</th><th class="n">Active</th><th class="n">Opens</th><th class="n">Views</th><th class="n">Last activity</th><th></th></tr>';
  const testNote = tests.length
    ? `<tr><td colspan="9" class="muted small tests-head">${tests.length} test ${tests.length === 1 ? 'trip' : 'trips'} not shown and left out of every number. <button type="button" class="linkish" data-toggle-tests>${state.showTests ? 'Hide' : 'Show'}</button></td></tr>`
    : '';
  $('trips').innerHTML = (real.length === 0 && !(state.showTests && tests.length)) ? '<tr><td class="muted">No trips yet.</td></tr>' + testNote :
    head + real.map(r => tripTr(r, false)).join('') + testNote +
    (state.showTests ? tests.map(r => tripTr(r, true)).join('') : '');

  // Online now
  $('online').innerHTML = online.length === 0 ? '<li class="empty">Nobody in the last 3 minutes.</li>' : online.map(o => `
    <li>${avatar(o.uid)}<span class="main"><span class="name">${esc(userName(o.uid))}</span>
      <span class="sub">${esc(o.page)} · ${esc(tripName(o.tripId))} · ${esc(o.platform)} · ${esc(zoneAbbr(o.tz))}</span></span>
      <span class="when">${ago(o.lastSeen)}</span></li>`).join('');

  // People per hour (last 24 h)
  const end = Math.ceil(now / HOUR) * HOUR;
  const perHour = S.usersPerHour(rows, end - DAY, end, state.zone);
  $('perHourSub').textContent = `last 24 h, ${state.zone}`;
  bars('perHour', perHour.map(b => ({
    value: b.users, label: b.label,
    tip: `<strong>${esc(b.label)}</strong> · ${b.users} ${b.users === 1 ? 'person' : 'people'}<br>${names(b.uids)}${pageList(b.pages)}`,
  })), Math.max(1, ...perHour.map(b => b.users)), { tick: (it, i) => i % 4 === 0 ? it.label.slice(0, 2) : '' });

  // People per day
  const showDays = !['today', '24h'].includes(state.range);
  $('perDayCard').hidden = !showDays;
  if (showDays) {
    const perDay = S.usersPerDay(rows, state.zone);
    const whoByDay = new Map();
    for (const r of rows) { const k = S.dayKey(r.at, state.zone); (whoByDay.get(k) ?? whoByDay.set(k, new Set()).get(k)).add(r.uid); }
    bars('perDay', perDay.map(d => ({
      value: d.users, label: dayLabel(d.day),
      tip: `<strong>${esc(dayLabel(d.day))}</strong> · ${d.users} ${d.users === 1 ? 'person' : 'people'}<br>${names([...whoByDay.get(d.day) ?? []].sort())}`,
    })), Math.max(1, ...perDay.map(d => d.users)), {
      // Past a month the columns are too narrow for a number each, so label every nth day.
      valueLabel: perDay.length <= 31,
      tick: (it, i) => perDay.length <= 31 ? it.label : (i % Math.ceil(perDay.length / 12) === 0 ? it.label : ''),
    });
  }

  // Hour of day
  const byHour = S.hourOfDayDetail(rows, state.hourMode);
  // On each person's clock a bar can mix zones, so the tip names the zones those hours were in.
  const zoneLabel = h => state.hourMode === 'local'
    ? [...new Set(h.zones.map(zoneAbbr))].join(', ')
    : `everyone in ${zoneAbbr(state.hourMode)}`;
  bars('byHour', byHour.map((h, i) => ({
    value: h.count,
    tip: `<strong>${String(i).padStart(2, '0')}:00</strong>${zoneLabel(h) ? ' ' + esc(zoneLabel(h)) : ''} · ${h.count} ${h.count === 1 ? 'person-hour' : 'person-hours'}<br>${names(h.uids)}${pageList(h.pages)}`,
  })), Math.max(1, ...byHour.map(h => h.count)), { tick: (it, i) => i % 6 === 0 ? String(i).padStart(2, '0') : '' });

  // Pages
  const pages = S.pageStats(rows);
  $('pages').innerHTML = pages.length === 0 ? '<tr><td class="muted">No page views yet.</td></tr>' :
    '<tr><th>Page</th><th class="n">Views</th><th class="n">People</th></tr>' +
    pages.map(p => `<tr><td class="page">${esc(p.page)}</td><td class="n num">${p.views}</td><td class="n num">${p.users}</td></tr>`).join('');

  // People
  const people = S.peopleStats(rows, state.zone);
  $('people').innerHTML = people.length === 0 ? '<li class="empty">Nobody yet.</li>' : people.map(p => `
    <li>${avatar(p.uid)}<span class="main"><span class="name">${esc(userName(p.uid))}</span>
      <span class="sub">${esc(tripName(p.tripId))} · ${esc(p.platform)} · ${esc(zoneAbbr(p.tz))} · ${p.views} views · ${p.sessions} opens · ${p.daysActive} ${p.daysActive === 1 ? 'day' : 'days'}</span></span>
      <span class="when">${ago(p.lastSeen)}</span></li>`).join('');

  // Return rate
  const cohorts = S.returnCohorts(rows, state.zone);
  const who = uids => `title="${esc(uids.join(', '))}"`;
  const pct = (n, of) => of ? `<span class="muted small"> ${Math.round(100 * n / of)}%</span>` : '';
  $('cohorts').innerHTML = cohorts.length === 0 ? '<tr><td class="muted">Nobody yet.</td></tr>' :
    '<tr><th>First seen, week of</th><th class="n">People</th><th class="n">Back next day</th><th class="n">Within 7 days</th><th class="n">Within 14 days</th></tr>' +
    cohorts.map(c => `<tr><td>${esc(dayLabel(c.week))}</td><td class="n num" ${who(c.uids)}>${c.uids.length}</td>
      <td class="n num" ${who(c.nextDay)}>${c.nextDay.length}${pct(c.nextDay.length, c.uids.length)}</td>
      <td class="n num" ${who(c.within7)}>${c.within7.length}${pct(c.within7.length, c.uids.length)}</td>
      <td class="n num" ${who(c.within14)}>${c.within14.length}${pct(c.within14.length, c.uids.length)}</td></tr>`).join('');

  // Visits
  const visits = S.sessionStats(rows);
  $('visitsSub').textContent = `${visits.sessions} ${visits.sessions === 1 ? 'visit' : 'visits'}`;
  const hist = (chart, buckets, noun) => bars(chart, buckets.map(b => ({
    value: b.count, label: b.label,
    tip: `<strong>${esc(b.label)}</strong> · ${b.count} ${b.count === 1 ? noun : noun + 's'}<br>${names(b.uids)}`,
  })), Math.max(1, ...buckets.map(b => b.count)), { valueLabel: true, tick: it => it.label });
  hist('visitMinutes', visits.duration, 'visit');
  hist('visitPages', visits.pages, 'visit');

  // Around the trip
  const around = S.aroundTrips(rows, !state.tripSel ? realTrips : realTrips.filter(t => state.tripSel.has(t.id)), state.zone);
  const anyAround = around.some(a => a.before + a.during + a.after > 0);
  $('aroundCard').hidden = !anyAround;
  if (anyAround) stackBars('around', around.map(a => ({
    parts: { before: a.before, during: a.during, after: a.after }, label: a.offset,
    tip: `<strong>Day ${a.offset >= 0 ? '+' : ''}${a.offset}</strong> from the trip's first day · ${a.before + a.during + a.after} ${a.before + a.during + a.after === 1 ? 'person' : 'people'}<br>${names(a.uids)}`,
  })), ['before', 'during', 'after'], Math.max(1, ...around.map(a => a.before + a.during + a.after)),
    { tick: (it, i) => it.label % 7 === 0 ? String(it.label) : '' });

  // Platform per day + versions
  const plat = S.platformPerDay(rows, state.zone);
  stackBars('platform', plat.map(d => ({
    parts: { web: d.web.length, pwa: d.pwa.length, ios: d.ios.length }, label: dayLabel(d.day),
    tip: `<strong>${esc(dayLabel(d.day))}</strong><br>web ${d.web.length} · installed ${d.pwa.length} · iOS ${d.ios.length}<br>${names([...new Set([...d.web, ...d.pwa, ...d.ios])].sort())}`,
  })), ['web', 'pwa', 'ios'], Math.max(1, ...plat.map(d => d.web.length + d.pwa.length + d.ios.length)),
    { tick: (it, i) => plat.length <= 14 ? it.label : (i % Math.ceil(plat.length / 8) === 0 ? it.label : '') });
  const versions = S.versionStats(rows);
  $('versions').innerHTML = versions.length === 0 ? '<tr><td class="muted">Nothing yet.</td></tr>' :
    '<tr><th>Version</th><th class="n">People</th><th class="n">Last seen</th></tr>' +
    versions.map(v => `<tr><td>${esc(v.version)}</td><td class="n num" ${who(v.uids)}>${v.uids.length}</td><td class="n">${ago(v.lastSeen)}</td></tr>`).join('');

  // Keep an open hover detail in place across the one-second re-render.
  if (tip.chart) showTip(tip.chart, tip.index);
}

/** The trip picker: one checkbox per trip; none or all checked means every trip. */
function syncTripPicker(trips) {
  const key = trips.map(t => t.id + '\u0000' + t.name).join('\u0001');
  if ($('tripList').dataset.key !== key) {
    $('tripList').innerHTML = trips.map(t => `<label><input type="checkbox" value="${esc(t.id)}" ${!state.tripSel || state.tripSel.has(t.id) ? 'checked' : ''}> ${esc(t.name)}</label>`).join('')
      || '<span class="muted small">No trips yet</span>';
    $('tripList').dataset.key = key;
  }
  $('tripSummary').textContent = !state.tripSel ? 'All trips' : state.tripSel.size === 1 ? tripName([...state.tripSel][0]) : `${state.tripSel.size} trips`;
}

/** Stacked columns: each item has `parts` keyed by series; the tip shows on hover like the other charts. */
function stackBars(chart, items, series, max, { tick }) {
  tip.html.set(chart, items.map(it => it.tip));
  $(chart).innerHTML = items.map((it, i) => {
    const total = series.reduce((n, k) => n + (it.parts[k] || 0), 0);
    return `
    <div class="col" data-i="${i}" tabindex="0">
      <div class="stack" style="height:${max ? (total / max) * 100 : 0}%">
        ${series.map(k => it.parts[k] ? `<div class="bar ${k}" style="flex:${it.parts[k]}"></div>` : '').join('')}
        ${total === 0 ? '<div class="bar zero"></div>' : ''}
      </div>
      <div class="tick">${esc(tick(it, i))}</div>
    </div>`;
  }).join('');
}

/** Rebuild a select's options only when they change, keeping the current value. Accepts flat items or groups. */
function syncSelect(sel, opts, value) {
  const flat = opts.flatMap(o => o.group ? o.items.map(v => typeof v === 'string' ? { value: v, label: v, group: o.group } : { ...v, group: o.group }) : [o]);
  const key = flat.map(o => o.value + '\u0000' + o.label + '\u0000' + (o.group ?? '')).join('\u0001');
  if (sel.dataset.key !== key) {
    let html = '', group = null;
    for (const o of flat) {
      if (o.group !== group) { if (group !== null) html += '</optgroup>'; group = o.group ?? null; if (group !== null) html += `<optgroup label="${esc(group)}">`; }
      html += `<option value="${esc(o.value)}">${esc(o.label)}</option>`;
    }
    if (group !== null) html += '</optgroup>';
    sel.innerHTML = html;
    sel.dataset.key = key;
  }
  sel.value = value;
}

// For browser checks: lets a test script feed rows in and re-render.
window.pulse = { state, render };

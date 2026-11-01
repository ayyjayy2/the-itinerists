import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import { initializeAppCheck, ReCaptchaV3Provider } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app-check.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, getDoc, getDocs, getDocsFromCache, getDocsFromServer, setDoc, query, where, orderBy, limit, onSnapshot, Timestamp, arrayUnion, arrayRemove } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';
import { firebaseConfig, recaptchaSiteKey } from './config.mjs';
import * as S from './stats.mjs';
import { ZONES } from './zones.mjs';
import { APP_PAGES, SIGNED_OUT_PAGES } from './app-pages.mjs';
import { CODE_BY_LONG_NAME, CODE_BY_ZONE } from './zone-codes.mjs';

const HOUR = 3_600_000, DAY = 24 * HOUR, ONLINE = 3 * 60_000; // the app pings every 2 minutes while visible
const $ = id => document.getElementById(id);

// Local dev: localhost can't pass reCAPTCHA, so use a debug token (a verify
// script injects one; otherwise the SDK prints a fresh one to register).
if (location.hostname === 'localhost' && !self.FIREBASE_APPCHECK_DEBUG_TOKEN) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;

// Its own app name keeps this page's sign-in separate from the app's on the same origin.
const app = initializeApp(firebaseConfig, 'pulse');
if (recaptchaSiteKey) initializeAppCheck(app, { provider: new ReCaptchaV3Provider(recaptchaSiteKey), isTokenAutoRefreshEnabled: true });
const auth = getAuth(app);
// Kept on the device, so the append-only logs are read from the server once (#596).
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

// ── state ──────────────────────────────────────────────────────────────────
const viewerZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const state = {
  range: '24h', trip: 'all', zone: viewerZone, hourMode: 'local',
  rows: [], trips: new Map(), users: new Map(), members: new Map(), deletions: [], waitlist: [], now: Date.now(),
  testTrips: new Set(),
  showTests: false,       // test trips stay out of the table unless the owner asks to see them
  testUsers: new Set(),   // throwaway accounts (_pulse/prefs.testUsers, set by hand)
  writes: [],             // `_writes` rows in range: who wrote what kind of thing on which trip, when
  opens: [],              // `_inviteOpens` rows: a device reached a trip's invite (#609)
  opensSince: null,       // the first invite open: when that log began
  hide: { me: false, testTrips: true, testUsers: true },   // the Hide checkboxes, saved to prefs
  tripSel: null,          // Set of trip ids, or null for all
  firstAt: null,          // the oldest _activity row: when collection began
  updatedAt: null,        // when live data last arrived (any listener), shown as "Updated …"
};
let unsubTrips = null, unsubUsers = null, unsubPrefs = null, unsubDeletions = null, unsubWaitlist = null;
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
    // Email only: the public username index holds no real addresses (#352).
    if (!id.includes('@')) throw new Error('Sign in with your email address.');
    await signInWithEmailAndPassword(auth, id, pass);
    $('pass').value = '';   // "Signing in…" stays until the owner check below settles it
  } catch (err) {
    $('gateMsg').textContent = /invalid|credential|password|user-not-found/i.test(err.message) ? 'Wrong email or password.' : err.message;
  } finally { $('signinBtn').disabled = false; }
});
$('signOut').addEventListener('click', () => signOut(auth));

// The eye on the password field shows and hides what was typed.
const EYE = 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12zM12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z';
const EYE_OFF = 'M3 3l18 18M10.6 10.7a2.8 2.8 0 0 0 3.8 3.8M9.9 5.7A9.7 9.7 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17.9 17.9 0 0 1-3 3.9M6.5 6.7C3.8 8.3 2 12 2 12s3.6 6.5 10 6.5a10 10 0 0 0 3-.5';
$('passEye').addEventListener('click', () => {
  const show = $('pass').type === 'password';
  $('pass').type = show ? 'text' : 'password';
  $('passEye').setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  $('passEye').querySelector('path').setAttribute('d', show ? EYE_OFF : EYE);
});

/** The app owner is the account with the `owner` custom claim (scripts/set-account-flags.js).
 *  Force-refresh the token so a newly granted claim counts straight away. */
async function isOwner(user) {
  return !!user && (await user.getIdTokenResult(true)).claims.owner === true;
}

onAuthStateChanged(auth, async user => {
  const owner = await isOwner(user).catch(() => false);
  if (user !== auth.currentUser) return;   // signed out or switched while the token was fetched
  $('gate').hidden = owner;
  $('dash').hidden = !owner;
  $('who').hidden = !owner;
  if (owner) $('gateMsg').textContent = '';
  if (user && !owner) { $('gateMsg').textContent = 'That account is not the app owner. Signed out.'; signOut(auth); }
  if (owner) start(); else stop();
});
// ── data ───────────────────────────────────────────────────────────────────
function start() {
  $('whoName').textContent = 'Signed in as the app owner';
  unsubTrips = onSnapshot(collection(db, 'trips'), snap => {
    state.trips = new Map(snap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
    dataArrived();
    syncMemberSubs();
    scheduleRender();
  }, err => showError('Trips: ' + err.message));
  // Accounts deleted (#452): one record each, written as the account deletes itself.
  unsubDeletions = onSnapshot(collection(db, '_deletions'), snap => {
    state.deletions = snap.docs.map(d => { const r = d.data(); return { ...r, at: r.at?.toMillis?.() ?? 0 }; });
    scheduleRender();
  }, err => showError('Deletions: ' + err.message));
  // iPhone launch list (#524): counted here, never shown; scripts/waitlist.js exports it.
  unsubWaitlist = onSnapshot(collection(db, '_waitlist'), snap => {
    state.waitlist = snap.docs.map(d => { const r = d.data(); return { email: r.email, at: r.at?.toMillis?.() ?? 0 }; });
    scheduleRender();
  }, err => showError('Launch list: ' + err.message));
  unsubUsers = onSnapshot(collection(db, 'users'), snap => {
    state.users = new Map(snap.docs.map(d => [d.id, d.data()]));
    dataArrived();
    scheduleRender();
  }, err => showError('People: ' + err.message));
  unsubPrefs = onSnapshot(prefsRef(), snap => {
    const p = snap.exists() ? snap.data() : {};
    // `hiddenTrips` is the earlier name for the same list.
    state.testTrips = new Set(p.testTrips ?? p.hiddenTrips ?? []);
    state.testUsers = new Set(p.testUsers ?? []);
    dataArrived();
    state.hide = { me: false, testTrips: true, testUsers: true, ...(p.hide ?? {}) };
    for (const [k, v] of Object.entries(state.hide)) { const el = document.querySelector(`#hide input[name="${k}"]`); if (el) el.checked = !!v; }
    if (p.zone && p.zone !== state.zone) { state.zone = p.zone; if (state.range === 'today') widenLogs(); }
    render();
  }, err => showError('Preferences: ' + err.message));
  openLogs();
  showFirstEvent();
}
/** The oldest row in the event log, once: the exact moment collection began. */
async function showFirstEvent() {
  try {
    const snap = await getDocs(query(collection(db, '_activity'), orderBy('at'), limit(1)));
    state.firstAt = snap.docs[0]?.data().at?.toMillis?.() ?? null;
    renderStamps();
  } catch { /* cosmetic */ }
  try {
    const snap = await getDocs(query(collection(db, '_inviteOpens'), orderBy('at'), limit(1)));
    state.opensSince = snap.docs[0]?.data().at?.toMillis?.() ?? null;
    scheduleRender();
  } catch { /* the invite rate waits for its log */ }
}
/**
 * The North Star needs a little more history than the range shows: a trip's
 * plan items from its creation, and the week before a trip's first day. Read
 * just that older stretch of each log, once (it is kept on the device after).
 */
const extending = new Set();
function ensureHistory(log, need) {
  // Only once the log's own first load is done (its listener is up), so the two never read the same stretch.
  if (extending.has(log) || !log.unsub || !S.backfillRange(log.loadedFrom, need)) return;
  extending.add(log);
  backfill(log, need).catch(err => showError(`${log.label}: ${err.message}`))
    .finally(() => { extending.delete(log); scheduleRender(); });
}
/** New data from any listener: what "Updated …" at the foot of the page reports. */
function dataArrived() { state.updatedAt = Date.now(); }
/** The two lines at the foot of the page, in the dashboard's zone (so they follow the zone picker). */
function renderStamps() {
  const z = state.zone;
  if (state.firstAt) $('firstEvent').textContent = `Collected since ${S.stampText(state.firstAt, z)} (${zoneAbbr(z, state.firstAt)})`;
  $('updatedAt').textContent = state.updatedAt ? `Updated ${S.stampText(state.updatedAt, z, { seconds: true })} (${zoneAbbr(z, state.updatedAt)})` : '';
}
/** One members listener per trip, following the trip list. */
function syncMemberSubs() {
  for (const [id, unsub] of memberSubs) if (!state.trips.has(id)) { unsub(); memberSubs.delete(id); state.members.delete(id); }
  for (const id of state.trips.keys()) {
    if (memberSubs.has(id)) continue;
    memberSubs.set(id, onSnapshot(collection(db, 'trips', id, 'members'), snap => {
      state.members.set(id, snap.docs.map(d => ({ uid: d.id, ...d.data() })).sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0)));
      dataArrived();
      scheduleRender();
    }, err => showError('Members: ' + err.message)));
  }
}
function stop() {
  logSession++;
  for (const log of LOGS) { log.unsub?.(); log.unsub = null; log.loadedFrom = null; }
  unsubTrips?.(); unsubUsers?.(); unsubPrefs?.(); unsubDeletions?.(); unsubWaitlist?.(); unsubTrips = unsubUsers = unsubPrefs = unsubDeletions = unsubWaitlist = null;
  for (const unsub of memberSubs.values()) unsub();
  memberSubs.clear();
  $('dot').classList.remove('on');
}
// The window always ends now: it slides with the clock, so a Pulse left open
// overnight shows today's Today and the real last 24 hours.
function queryStart() {
  const a = state.now;
  return { today: S.startOfDay(a, state.zone), '24h': a - DAY, '7d': a - 7 * DAY, '30d': a - 30 * DAY, '60d': a - 60 * DAY, '180d': a - 180 * DAY, '1y': a - 365 * DAY }[state.range];
}
// ── the usage and write logs (#596) ────────────────────────────────────────
// Both are append-only, so rows already read are kept on the device and the
// server is asked only for newer ones. The window slides in memory (render
// filters with S.inWindow); a wider range reads only the older part it lacks.
const LOGS = [
  { field: 'rows', col: '_activity', label: 'Activity', key: 'pulse.history.activity', unsub: null, loadedFrom: null },
  { field: 'writes', col: '_writes', label: 'Writes', key: 'pulse.history.writes', unsub: null, loadedFrom: null },
  { field: 'opens', col: '_inviteOpens', label: 'Invite opens', key: 'pulse.history.inviteOpens', unsub: null, loadedFrom: null },
];
const logRows = snap => snap.docs.map(d => { const r = d.data(); return { ...r, id: d.id, at: r.at?.toMillis?.() }; }).filter(r => r.at);
const readCoverage = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const saveCoverage = (key, c) => { try { localStorage.setItem(key, JSON.stringify(c)); } catch { /* the cache is a saving, not a need */ } };

let logSession = 0;   // bumped on sign-out, so a load still in flight doesn't start a listener afterwards
function openLogs() {
  const session = ++logSession;
  state.loading = true;
  $('dot').classList.remove('on');
  for (const log of LOGS) openLog(log, session).catch(err => showError(`${log.label}: ${err.message}`));
}
async function openLog(log, session) {
  const need = queryStart(), now = Date.now();
  let coverage = readCoverage(log.key), kept = [];
  if (coverage) {
    try { kept = logRows(await getDocsFromCache(query(collection(db, log.col), where('at', '>=', Timestamp.fromMillis(coverage.from)), orderBy('at')))); } catch { kept = []; }
  }
  if (!S.historyCacheUsable(coverage, now, kept.length)) { coverage = null; kept = []; }
  state[log.field] = kept;
  log.loadedFrom = coverage ? coverage.from : need;
  const fullReadAt = coverage ? coverage.at : now;
  if (kept.length) {
    if (log.field === 'rows') state.loading = false;   // draw from the device at once; the server only adds
    scheduleRender();
  }
  await backfill(log, need);
  if (session !== logSession) return;
  const from = S.liveFrom(kept.length ? kept[kept.length - 1].at : null, log.loadedFrom);
  log.unsub = onSnapshot(query(collection(db, log.col), where('at', '>=', Timestamp.fromMillis(from)), orderBy('at')), { includeMetadataChanges: true }, snap => {
    state[log.field] = S.mergeRows(state[log.field], logRows(snap));
    if (snap.metadata.fromCache) return;
    // The server has answered: everything from loadedFrom up to now is on the device.
    saveCoverage(log.key, { from: log.loadedFrom, at: fullReadAt, n: state[log.field].length });
    if (log.field === 'rows') { state.loading = false; $('dot').classList.add('on'); showError(''); }
    dataArrived();
    scheduleRender();
  }, err => { showError(`${log.label}: ${err.message}`); if (log.field === 'rows') $('dot').classList.remove('on'); });
}
/** A wider range than the device holds: read only the older stretch, once. */
async function backfill(log, need) {
  const gap = S.backfillRange(log.loadedFrom, need);
  if (!gap) return;
  const snap = await getDocsFromServer(query(collection(db, log.col),
    where('at', '>=', Timestamp.fromMillis(gap[0])), where('at', '<', Timestamp.fromMillis(gap[1])), orderBy('at')));
  state[log.field] = S.mergeRows(state[log.field], logRows(snap));
  log.loadedFrom = need;
  const coverage = readCoverage(log.key);
  if (coverage) saveCoverage(log.key, { ...coverage, from: need, n: state[log.field].length });
}
/** After a range or zone change: narrower ranges are already loaded; wider ones fetch the gap. */
function widenLogs() {
  const need = queryStart();
  const wider = LOGS.filter(log => S.backfillRange(log.loadedFrom, need));
  if (!wider.length) { scheduleRender(); return; }
  state.loading = true; scheduleRender();
  Promise.all(wider.map(log => backfill(log, need).catch(err => showError(`${log.label}: ${err.message}`))))
    .then(() => { state.loading = false; dataArrived(); scheduleRender(); });
}
// Events arrive by push the moment they are written; this clock only keeps
// "x s ago" and the online window moving between them.
// Snapshots arrive in bursts (rows, writes, trips, users, members); one render per frame.
let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : f => setTimeout(f, 0))(() => { renderQueued = false; if (!$('dash').hidden) render(); });
}
// Every second only the clock and the "x s ago" labels move; the charts are
// rebuilt when data changes and once a minute (the online window, hour roll).
let lastFull = 0;
setInterval(() => {
  state.now = Date.now();
  if ($('dash').hidden) return;
  for (const el of document.querySelectorAll('[data-ago]')) el.textContent = ago(Number(el.dataset.ago));
  const clock = $('clock'); if (clock) clock.textContent = clockText();
  if (state.now - lastFull > 60_000) { lastFull = state.now; render(); }
}, 1000);

// Back to a tab that slept (laptop lid, another tab): catch up at once, not within the minute.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || $('dash').hidden) return;
  state.now = Date.now();
  render();
});

// ── controls ───────────────────────────────────────────────────────────────
$('range').addEventListener('click', ev => {
  const b = ev.target.closest('button[data-range]'); if (!b) return;
  state.range = b.dataset.range; state.now = Date.now();
  for (const x of $('range').querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
  widenLogs();
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
  if (state.range === 'today') widenLogs();
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
for (const chart of ['perHour', 'byHour', 'perDay', 'visitMinutes', 'visitPages', 'around', 'platform', 'countries', 'signups', 'pageVisits']) {
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
/**
 * The trip a person belongs to, from the members lists, for rows whose events
 * carry no trip (a visit that ended before the app had picked the active trip).
 * The trip happening today wins; otherwise the one that starts next or ended last.
 */
function memberTrip(uid) {
  const today = S.dayKey(state.now, state.zone);
  const mine = [...state.members.entries()].filter(([, list]) => list.some(m => m.uid === uid)).map(([id]) => state.trips.get(id)).filter(Boolean);
  if (!mine.length) return null;
  const live = mine.find(t => t.startDate && t.endDate && t.startDate <= today && today <= t.endDate);
  return (live ?? [...mine].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))[0]).id;
}
/** The trip to show for a person: the one their events name, else the one they are a member of. */
const personTrip = (uid, tripId) => tripId ?? memberTrip(uid);
const zoneShort = tz => (tz || '').split('/').pop().replace(/_/g, ' ') || tz;
/** Zone code as of now (CDT, CEST, ICT): the same three-step lookup as the app, so every zone has a code. */
const abbrCache = new Map();
function zoneAbbr(tz, atMs) {
  if (!tz) return '';
  if (CODE_BY_ZONE[tz]) return CODE_BY_ZONE[tz].includes('/') ? zoneAbbr(CODE_BY_ZONE[tz], atMs) : CODE_BY_ZONE[tz];
  const ms = atMs ?? state.now;
  const key = tz + '|' + Math.floor(ms / 3_600_000);   // a code only changes at a DST edge
  const hit = abbrCache.get(key); if (hit) return hit;
  const code = zoneAbbrUncached(tz, ms);
  if (abbrCache.size > 5000) abbrCache.clear();
  abbrCache.set(key, code);
  return code;
}
function zoneAbbrUncached(tz, ms) {
  const at = new Date(ms);
  const name = (locale, style) => {
    try { return new Intl.DateTimeFormat(locale, { timeZone: tz, timeZoneName: style }).formatToParts(at).find(p => p.type === 'timeZoneName')?.value ?? ''; }
    catch { return ''; }
  };
  const isOffset = a => /^(GMT|UTC)[+\-−]/.test(a);
  for (const locale of ['en-US', 'en-GB', 'en-AU', 'en-IN', 'en-NZ', 'en-ZA', 'en-SG', 'en-HK', 'en-PH', 'en-IE', 'en-CA', 'en-MY']) {
    const a = name(locale, 'short'); if (a && !isOffset(a)) return a;
  }
  const long = name('en-US', 'long');
  if (CODE_BY_LONG_NAME[long]) return CODE_BY_LONG_NAME[long];
  if (long && !isOffset(long)) { const i = long.replace(/[’'&]/g, '').split(/\s+/).filter(w => w !== 'Time').map(w => w[0].toUpperCase()).join(''); if (i.length >= 2) return i; }
  return zoneShort(tz);
}
/** "Berlin, Germany" / "Chicago, Illinois, USA": where a zone is named after. */
const placeCache = new Map();
const zonePlace = tz => { let p = placeCache.get(tz); if (p === undefined) { const z = ZONES[tz]; p = z ? [z.city, z.region, z.country].filter(Boolean).join(', ') : zoneShort(tz); placeCache.set(tz, p); } return p; };
/** The country a zone belongs to, for the Countries card. */
const zoneCountry = tz => ZONES[tz]?.country ?? '';
/** "CEST · Berlin, Germany": the zone the app was used in, said plainly. */
const usedIn = tz => tz ? `${zoneAbbr(tz)} · ${zonePlace(tz)}` : '';
/** "CST (Chicago, Illinois, USA)": the abbreviation as of now, then where the zone is named after. */
function zoneName(tz) {
  const z = ZONES[tz];
  const place = z ? [z.city, z.region, z.country].filter(Boolean).join(', ') : zoneShort(tz);
  return `${zoneAbbr(tz)} (${place})`;
}
function clockText() { return new Date(state.now).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: state.zone }); }
/** "x s ago" that the one-second tick keeps fresh without a rebuild. */
const agoHtml = ms => `<span data-ago="${ms}">${ago(ms)}</span>`;
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
  lastFull = state.now;
  renderStamps();
  $('loading').hidden = !state.loading;
  $('dash').classList.toggle('is-loading', !!state.loading);
  const now = state.now;
  // Hide: the owner, test trips and throwaway accounts leave every number; events with no trip (sign-in screen) stay.
  const hiddenUids = new Set([...(state.hide.testUsers ? state.testUsers : []), ...(state.hide.me && auth.currentUser ? [auth.currentUser.uid] : [])]);
  const start = queryStart();
  const realRows = S.inWindow(state.rows, start).filter(r => !hiddenUids.has(r.uid));
  const all = state.hide.testTrips ? realRows.filter(r => !r.tripId || !state.testTrips.has(r.tripId)) : realRows;
  const rows = !state.tripSel ? all : all.filter(r => r.tripId && state.tripSel.has(r.tripId));
  // The write log under the same Hide and trip rules.
  const writes = S.inWindow(state.writes, start)
    .filter(w => !hiddenUids.has(w.uid) && (!state.hide.testTrips || !w.tripId || !state.testTrips.has(w.tripId)))
    .filter(w => !state.tripSel || (w.tripId && state.tripSel.has(w.tripId)));
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

  // North Star and its drivers (#609): real trips, real members, the whole loaded history.
  const hideUser = uid => hiddenUids.has(uid) && !(state.hide.me && auth.currentUser?.uid === uid);
  const nsTrips = realTrips.filter(t => !t.isTest && (!state.tripSel || state.tripSel.has(t.id)));
  const nsMembers = new Map(nsTrips.map(t => [t.id, (state.members.get(t.id) ?? []).filter(m => !m.isTest && !hideUser(m.uid))]));
  const testTrip = id => state.hide.testTrips && state.testTrips.has(id);
  const nsWrites = state.writes.filter(x => !hideUser(x.uid) && !testTrip(x.tripId));
  const nsRows = state.rows.filter(r => !hideUser(r.uid));
  const ns = S.northStar({ trips: nsTrips, members: nsMembers, writes: nsWrites, opens: state.opens, rows: nsRows, from: start, to: now, zone: state.zone, opensSince: state.opensSince });
  // History the measures need beyond the range: plan items since each started trip was made, the week before it.
  const startedMade = nsTrips.filter(t => ns.live.trips.some(x => x.id === t.id)).map(t => t.createdAt).filter(Boolean);
  if (startedMade.length) ensureHistory(LOGS[1], Math.max(Math.min(...startedMade), now - 2 * 365 * DAY));
  ensureHistory(LOGS[0], start - 7 * DAY);
  const rate = (r, n, of) => r == null ? '<span class="muted">—</span>' : `${Math.round(100 * r)}%<span class="muted small"> ${n} of ${of}</span>`;
  $('nsSub').textContent = `${ns.live.started} ${ns.live.started === 1 ? 'trip' : 'trips'} started in the range, ${ns.live.live} live`;
  $('nsMonths').innerHTML = ns.live.byMonth.length === 0 ? '' :
    '<tr><th>Month</th><th class="n">Trips started</th><th class="n">Live group trips</th></tr>' +
    ns.live.byMonth.map(m => `<tr><td>${esc(new Date(m.month + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }))}</td><td class="n num">${m.started}</td><td class="n num">${m.live}</td></tr>`).join('');
  const notLive = ns.live.trips.filter(x => !x.live);
  $('nsWhy').textContent = notLive.length ? 'Not live: ' + notLive.map(x => `${tripName(x.id)} (${x.members} ${x.members === 1 ? 'member' : 'members'}, ${x.items} plan ${x.items === 1 ? 'item' : 'items'})`).join('; ') + '.' : '';
  $('nsDrivers').innerHTML = '<tr><th>Measure</th><th>How it is counted</th><th class="n">In this range</th></tr>' + [
    ['Invite-to-join', state.opensSince ? 'People who joined with an invite ÷ devices that opened an invite link or typed its code (once per trip)' : 'Starts once someone opens an invite with this version of the app', rate(ns.invite.rate, ns.invite.joined, ns.invite.reached)],
    ['Fast group adoption', `Trips made in the range with 3+ members within 72 hours${ns.fast.pending ? ` (${ns.fast.pending} newer still counting)` : ''}`, rate(ns.fast.rate, ns.fast.adopted, ns.fast.trips)],
    ['Planner reuse', 'Planners whose first trip was made in the range who started another within 12 months, so far', rate(ns.reuse.rate, ns.reuse.again, ns.reuse.planners)],
    ['Joiner to planner, 90 days', 'People who first joined a trip in the range and started their own within 90 days', rate(ns.convert.rate90, ns.convert.in90, ns.convert.joiners)],
    ['Joiner to planner, 12 months', 'The same, within 12 months, so far', rate(ns.convert.rate365, ns.convert.in365, ns.convert.joiners)],
    ['Members active the week before', 'Members of trips that started in the range who opened the app in the 7 days before the first day', rate(ns.weekBefore.rate, ns.weekBefore.active, ns.weekBefore.members)],
    ['Revenue per trip', 'All revenue ÷ trips', '<span class="muted">No payments yet</span>'],
  ].map(([m, how, v]) => `<tr><td><strong>${esc(m)}</strong></td><td class="muted small">${esc(how)}</td><td class="n num">${v}</td></tr>`).join('');

  // Totals
  const users = new Set(rows.map(r => r.uid)).size;
  const views = rows.filter(r => r.type === 'page').length;
  const sessions = rows.filter(r => r.type === 'session').length;
  const online = S.onlineNow(rows, now, ONLINE);
  const today = S.dayKey(now, state.zone);
  const liveTrips = realTrips.filter(t => tripPhase(t, today)[0] === 'live').length;
  $('tiles').innerHTML = [
    [users, 'people'], [sessions, 'app opens'], [views, 'page views'], [online.length, 'online now'], [liveTrips, 'trips happening now'],
    [ns.live.live, `live group ${ns.live.live === 1 ? 'trip' : 'trips'}`],
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
        <td class="n">${s ? agoHtml(s.lastSeen) : '<span class="muted">none</span>'}</td>
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
      <span class="sub">${esc(o.page)} · ${esc(tripName(personTrip(o.uid, o.tripId)))} · ${esc(o.platform)} · ${esc(usedIn(o.tz))}</span></span>
      <span class="when">${agoHtml(o.lastSeen)}</span></li>`).join('');

  // People per hour (last 24 h)
  const end = Math.ceil(now / HOUR) * HOUR;
  const perHour = S.usersPerHour(rows, end - DAY, end, state.zone);
  $('perHourSub').textContent = `last 24 h, ${state.zone}`;
  bars('perHour', perHour.map(b => ({
    value: b.users, label: b.label,
    tip: `<strong>${esc(b.label)}</strong> · ${b.users} ${b.users === 1 ? 'person' : 'people'}<br>${names(b.uids)}${pageList(b.pages)}`,
  })), Math.max(1, ...perHour.map(b => b.users)), { tick: (it, i) => i % 4 === 0 ? it.label.slice(0, 2) : '' });

  // Activity timeline: dates along the bottom, people active that day up the side.
  // Hover: who, the pages, first and last moment, and what was edited by whom.
  const KIND_WORD = { itinerary: 'itinerary', finance: 'expense', rec: 'rec', flight: 'flight', stay: 'stay', transport: 'transport', packing: 'packing', member: 'join', trip: 'trip', pin: 'pin' };
  const clock = ms => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: state.zone });
  const timeline = S.activityTimeline(rows, writes, state.zone);
  $('perDaySub').textContent = timeline.length ? `${timeline.length} ${timeline.length === 1 ? 'day' : 'days'} with activity in ${rangeLabel} · times in ${zoneAbbr(state.zone)}` : `nothing in ${rangeLabel}`;
  personBars('perDay', timeline.map(d => {
    const when = d.firstMs === d.lastMs ? clock(d.firstMs) : `${clock(d.firstMs)} – ${clock(d.lastMs)}`;
    // Segments: one per person, proportional to their share of the day's events + edits, busiest at the bottom.
    const people = Object.entries(d.activity).sort((a, b) => b[1] - a[1]);
    const segments = people.map(([uid, n]) => ({ share: n, color: personColor(uid), name: `${userName(uid)} · ${n}` }));

    // One line per person: colour dot, name, activity count, then their edits ("22 recs, 1 itinerary").
    const personLines = people.map(([uid, n]) => {
      const kinds = d.writes.byPerson[uid];
      const edits = kinds ? Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${c} ${KIND_WORD[k] ?? k}${c === 1 ? '' : 's'}`).join(', ') : '';
      return `<span class="dot" style="background:${esc(personColor(uid))}"></span>${esc(userName(uid))} <span class="muted">${n}</span>${edits ? ` <span class="muted">·</span> ${esc(edits)}` : ''}`;
    }).join('<br>');
    return {
      value: d.uids.length, label: dayLabel(d.day), segments,
      tip: `<strong>${esc(dayLabel(d.day))}</strong> · ${d.uids.length} ${d.uids.length === 1 ? 'person' : 'people'} · ${esc(when)} ${esc(zoneAbbr(state.zone, d.firstMs))}<br>${personLines}`
        + (d.pages.length ? `<br><span class="muted">Pages:</span> ${d.pages.map(esc).join(', ')}` : ''),
    };
  }), Math.max(1, ...timeline.map(d => d.uids.length)), {
    // Past a month the columns are too narrow for a number each, so label every nth day.
    valueLabel: timeline.length <= 31,
    tick: (it, i) => timeline.length <= 14 ? it.label : (i % Math.ceil(timeline.length / 12) === 0 ? it.label : ''),
  });

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

  // Partner offers on Tips & Recs (#474)
  const offers = S.offerStats(rows);
  $('offers').innerHTML = offers.length === 0 ? '<tr><td class="muted">No taps yet.</td></tr>' :
    '<tr><th>Partner</th><th class="n">Taps</th><th class="n">People</th></tr>' +
    offers.map(o => `<tr><td>${esc(o.offer)}</td><td class="n num">${o.taps}</td><td class="n num">${o.users}</td></tr>`).join('');

  // Page visits: every signed-in page, 0 included, so unused pages show.
  // The moment of signing in is recorded while the address still says /login: not a visit.
  const pageViews = S.pageVisits(rows, APP_PAGES, SIGNED_OUT_PAGES);
  const maxVisits = Math.max(1, ...pageViews.map(v => v.views));
  bars('pageVisits', pageViews.map(v => ({
    value: v.views,
    tip: `<strong>${esc(v.label)}</strong> <span class="muted">${esc(v.page)}</span><br>${v.views} ${v.views === 1 ? 'visit' : 'visits'} · ${v.users} ${v.users === 1 ? 'person' : 'people'}`,
  })), maxVisits, { valueLabel: true, tick: (_, i) => pageViews[i].label });
  for (const [i, v] of pageViews.entries()) if (!v.views) $('pageVisits').querySelector(`.col[data-i="${i}"]`)?.classList.add('zero');

  // People
  const people = S.peopleStats(rows, state.zone);
  $('people').innerHTML = people.length === 0 ? '<li class="empty">Nobody yet.</li>' : people.map(p => `
    <li>${avatar(p.uid)}<span class="main"><span class="name">${esc(userName(p.uid))}</span>
      <span class="sub">${esc(tripName(personTrip(p.uid, p.tripId)))} · ${esc(p.platform)} · ${esc(usedIn(p.tz))} · ${p.views} views · ${p.sessions} opens · ${p.daysActive} ${p.daysActive === 1 ? 'day' : 'days'}</span></span>
      <span class="when">${agoHtml(p.lastSeen)}</span></li>`).join('');

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
    versions.map(v => `<tr><td>${esc(v.version)}</td><td class="n num" ${who(v.uids)}>${v.uids.length}</td><td class="n">${agoHtml(v.lastSeen)}</td></tr>`).join('');

  // Sign-ups per day (every account carries its creation date), under the Hide rules
  // Guests (#610) joined from an invite link without signing up: not sign-ups until they make an account.
  const visibleUsers = new Map([...state.users.entries()].filter(([uid, u]) => !hiddenUids.has(uid) && !u.isGuest));
  const signups = S.signupsPerDay(visibleUsers, queryStart(), now + DAY, state.zone);
  $('signupsSub').textContent = signups.length ? `${signups.reduce((n, d) => n + d.uids.length, 0)} in ${rangeLabel}` : `none in ${rangeLabel}`;
  bars('signups', signups.map(d => ({
    value: d.uids.length, label: dayLabel(d.day),
    tip: `<strong>${esc(dayLabel(d.day))}</strong> · ${d.uids.length} ${d.uids.length === 1 ? 'sign-up' : 'sign-ups'}<br>${names(d.uids)}`,
  })), Math.max(1, ...signups.map(d => d.uids.length)), { valueLabel: signups.length <= 31, tick: (it, i) => signups.length <= 14 ? it.label : (i % Math.ceil(signups.length / 8) === 0 ? it.label : '') });

  // Accounts deleted, under the same Hide rules (a record carries its own test flag)
  const gone = S.deletionStats((state.deletions ?? []).filter(r => !hiddenUids.has(r.uid) && !(state.hide.testUsers && r.test)), queryStart(), now + DAY);
  $('deletionsSub').textContent = gone.count ? `${gone.count} in ${rangeLabel}` : `none in ${rangeLabel}`;
  $('deletionsSummary').textContent = !gone.count ? '' : [
    gone.afterTrip && `${gone.afterTrip} after a trip ended${gone.medianDaysAfterTrip === null ? '' : ` (median ${gone.medianDaysAfterTrip} ${gone.medianDaysAfterTrip === 1 ? 'day' : 'days'} later)`}`,
    gone.duringOrBefore && `${gone.duringOrBefore} while a trip was still on or ahead`,
    gone.noTrip && `${gone.noTrip} never on a trip`,
  ].filter(Boolean).join(' · ');
  const afterText = d => d.daysAfterTrip === null ? '<span class="muted">no trip</span>'
    : d.daysAfterTrip < 0 ? `${-d.daysAfterTrip} ${d.daysAfterTrip === -1 ? 'day' : 'days'} before it ended`
    : d.daysAfterTrip === 0 ? 'the day it ended' : `${d.daysAfterTrip} ${d.daysAfterTrip === 1 ? 'day' : 'days'} after`;
  $('deletions').innerHTML = gone.count === 0 ? '<tr><td class="muted">No accounts deleted.</td></tr>' :
    '<tr><th>Deleted</th><th>Person</th><th>Last trip</th><th class="n">Trips</th><th class="n">Account age</th></tr>' +
    gone.list.map(d => `<tr><td>${esc(S.stampText(d.at, state.zone))}</td><td>${esc(userName(d.uid))}</td><td>${afterText(d)}</td><td class="n num">${d.trips}</td><td class="n num">${d.accountAgeDays === null ? '–' : `${d.accountAgeDays} d`}</td></tr>`).join('');

  // iPhone launch list: counts only (anyone can sign up, so there are no test entries to hide)
  const wl = S.waitlistStats(state.waitlist ?? [], queryStart(), now + DAY);
  $('waitlistSub').textContent = `${wl.inRange} new in ${rangeLabel}`;
  $('waitlistTotal').textContent = wl.total;
  $('waitlistLast').textContent = wl.lastAt ? `Latest ${S.stampText(wl.lastAt, state.zone)} (${zoneAbbr(state.zone, wl.lastAt)})` : 'Nobody yet.';

  // Countries the app was used in (from each event's zone, recorded at the moment of use)
  const countries = S.countryStats(rows, zoneCountry);
  bars('countries', countries.map(c => ({
    value: c.uids.length, label: c.country,
    tip: `<strong>${esc(c.country)}</strong> · ${c.uids.length} ${c.uids.length === 1 ? 'person' : 'people'} · ${c.sessions} ${c.sessions === 1 ? 'open' : 'opens'}<br>${names(c.uids)}<br><span class="muted">${esc(c.zones.map(zoneAbbr).join(', '))}</span>`,
  })), Math.max(1, ...countries.map(c => c.uids.length)), { valueLabel: true, tick: it => it.label });
  $('countriesSub').textContent = countries.length ? `${countries.length} ${countries.length === 1 ? 'country' : 'countries'}` : '';

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

/** A person's colour: their avatar colour in the app, else a steady pick from a small palette. */
const PALETTE = ['#8BAF7C', '#B4A6D4', '#F2C48A', '#7E6FA8', '#B97F35', '#6A8F5E', '#B5485D', '#6E7A86'];
function personColor(uid) {
  const c = state.users.get(uid)?.color;
  if (c) return c;
  let h = 0; for (const ch of uid) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
/** Columns split by person: height is the day's people, the segments are each person's share of its activity. */
function personBars(chart, items, max, { tick, valueLabel = false }) {
  tip.html.set(chart, items.map(it => it.tip));
  $(chart).innerHTML = items.map((it, i) => {
    const total = it.segments.reduce((n, s) => n + s.share, 0);
    return `
    <div class="col" data-i="${i}" tabindex="0">
      ${valueLabel ? `<div class="val num">${it.value}</div>` : ''}
      <div class="stack" style="height:${max ? (it.value / max) * 100 : 0}%">
        ${it.segments.map(s => `<div class="bar person" style="flex:${s.share};background:${esc(s.color)}" title="${esc(s.name)}"></div>`).join('')}
        ${total === 0 ? '<div class="bar zero"></div>' : ''}
      </div>
      <div class="tick">${esc(tick(it, i))}</div>
    </div>`;
  }).join('');
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
window.pulse = { state, render, tips: tip.html };

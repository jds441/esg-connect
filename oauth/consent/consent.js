// consent.js - the ESG Suite Claude connector's sign-in and consent page logic. Same origin only (see index.html's CSP).
// supabase-js 2.118.0 is vendored beside it (supabase-2.118.0.js, the npm tarball's dist/umd/supabase.js, sha256 ee3be8de...d3d3).
if (window.top !== window.self) { throw new Error('framed'); }   // never run inside another site's frame (clickjacking)
document.documentElement.style.display = 'block';
const SB_URL = 'https://fnkhosoifmhutlaxpjfu.supabase.co';
const SB_KEY = 'sb_publishable_Hb8sCBzO10O5p15F02-Gsg_xtwFOE-X';
const TENANT = 'esg', AREA = 'test', ROLES = ['staff', 'admin'];
const ITERS = [600000, 10000];   // D131: a login is under one of the two counts; the Dashboard tries both (_siGrantEither)
const $ = (id) => document.getElementById(id);
const authId = new URLSearchParams(location.search).get('authorization_id');
const sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const diagLines = [];
function say(t, bad) { $('msg').textContent = t; $('msg').className = bad ? 'bad' : ''; }
function diag(k, v) { diagLines.push(k + ': ' + v); $('diag').textContent = diagLines.join('\n'); }
function claims(jwt) { try { return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch (_) { return {}; } }
function b64url(buf) { let s = ''; new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function secret(password, staffId, iter) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(staffId + '|auth'), iterations: iter, hash: 'SHA-256' }, km, 256);
  return b64url(bits);
}
async function lookup(email) {
  const r = await fetch(SB_URL + '/functions/v1/esg-signin-lookup', { method: 'POST', headers: { apikey: SB_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, tenant: TENANT, area: AREA }) });
  let body = null; try { body = await r.json(); } catch (_) { body = null; }
  return { status: r.status, body: body };
}
async function endPageSession(why) {
  const { error } = await sb.auth.signOut({ scope: 'local' });
  diag('page session signed out (' + why + ')', error ? 'error ' + error.message : 'ok');
}
let pageSession = false;
if (!authId) {
  say('This page opens from Claude when you connect the ESG Suite (TEST) connector. Start from Claude.', true);
  $('go').disabled = true;
}
$('signin').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $('go').disabled = true; say('Signing in...');
  try {
    const email = $('email').value.trim().toLowerCase(), pw = $('pw').value;
    const who = await lookup(email);
    diag('lookup', who.status + ' ' + ((who.body && (who.body.ok ? 'found' : who.body.error)) || ''));
    if (!(who.body && who.body.ok && who.body.id)) {
      say(who.status === 404 ? 'That email has no login on the ESG TEST area. Only test logins can connect this connector.' : 'The sign-in lookup failed (HTTP ' + who.status + ').', true);
      $('go').disabled = false; return;
    }
    let session = null, used = null;
    for (const it of ITERS) {
      const { data, error } = await sb.auth.signInWithPassword({ email: email, password: await secret(pw, who.body.id, it) });
      if (!error && data && data.session) { session = data.session; used = it; break; }
      if (error && !(error.status === 400 || error.status === 401 || error.status === 422)) { say('Sign-in failed: ' + error.message, true); $('go').disabled = false; return; }
    }
    $('pw').value = '';
    if (!session) { say('Incorrect password.', true); $('go').disabled = false; return; }
    pageSession = true;
    diag('password grant', 'ok, ' + used + ' rounds; page session ' + String(claims(session.access_token).session_id || '').slice(0, 8));
    const me = await sb.rpc('fsx_me');
    const mem = Array.isArray(me.data) ? me.data.find((e) => e && e.t === TENANT && e.a === AREA && ROLES.indexOf(e.r) > -1) : null;
    diag('fsx_me', me.error ? 'error ' + me.error.message : JSON.stringify((me.data || []).map((e) => e.t + '/' + e.a + '/' + e.r)));
    if (!mem) { await endPageSession('refused'); pageSession = false; say('This login has no staff or admin membership on the ESG TEST area, so it cannot connect.', true); $('go').disabled = false; return; }
    const det = await sb.auth.oauth.getAuthorizationDetails(authId);
    if (det.error) { await endPageSession('details error'); pageSession = false; say('Supabase did not accept this request: ' + det.error.message, true); return; }
    const d = det.data || {};
    diag('authorization details', JSON.stringify({ keys: Object.keys(d), scope: d.scope || null }));
    if (!d.authorization_id && d.redirect_url) { await endPageSession('already approved'); location.assign(d.redirect_url); return; }
    const c = d.client || {};
    $('who').textContent = who.body.name || who.body.id;
    $('cname').textContent = c.name || c.client_name || c.id || c.client_id || '(unnamed client)';
    $('cred').textContent = d.redirect_uri || '';
    $('cscope').textContent = d.scope || '(none)';
    $('signin').hidden = true; $('consent').hidden = false; say('');
  } catch (e) { say('Something went wrong: ' + (e && e.message || e), true); $('go').disabled = false; }
});
async function decide(approve) {
  $('approve').disabled = true; $('deny').disabled = true;
  try {
    const r = approve ? await sb.auth.oauth.approveAuthorization(authId, { skipBrowserRedirect: true })
                      : await sb.auth.oauth.denyAuthorization(authId, { skipBrowserRedirect: true });
    if (r.error) { say('Supabase refused: ' + r.error.message, true); await endPageSession('decision error'); return; }
    await endPageSession(approve ? 'approved' : 'denied'); pageSession = false;
    say(approve ? 'Approved. Returning to Claude...' : 'Denied. Returning to Claude...');
    if (r.data && r.data.redirect_url) location.assign(r.data.redirect_url);
  } catch (e) { say('Something went wrong: ' + (e && e.message || e), true); }
}
$('approve').addEventListener('click', () => decide(true));
$('deny').addEventListener('click', () => decide(false));
window.addEventListener('pagehide', () => { if (pageSession) sb.auth.signOut({ scope: 'local' }); });

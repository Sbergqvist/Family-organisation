/**
 * Adgangskode foran hele siden.
 *
 * Kører før alt andet — også før de statiske filer og /api/sync — så intet kan
 * hentes uden en gyldig session. Kontrollen sker på serveren, så koden kan ikke
 * findes ved at kigge i sidens kildekode.
 *
 * Sæt adgangskoden som miljøvariablen APP_PASSWORD i Pages-projektet (se DEPLOY.md).
 * Er den ikke sat, er beskyttelsen slået fra og siden er åben — så man ikke kan
 * låse sig selv ude ved et uheld.
 *
 * Sessionen er en cookie med en udløbsdato og en signatur. Signaturen laves med
 * adgangskoden som nøgle, så cookien hverken kan gættes eller forfalskes — og
 * skifter I adgangskode, bliver alle gamle sessioner ugyldige med det samme.
 */

const COOKIE = 'fp_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dage
const WINDOW_MS = 15 * 60 * 1000;          // tidsrum for forsøgstælleren
const MAX_ATTEMPTS = 10;                   // forsøg pr. IP i tidsrummet

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  if (url.pathname === '/logout') return logout();

  /* Lille selvtjek til opsætningen. Svarer altid — også før man er logget ind —
     og røber intet ud over om tingene er koblet på. */
  if (url.pathname === '/api/status') {
    return json({
      functions: true,
      database: !!env.DB,
      password: !!env.APP_PASSWORD
    }, 200);
  }

  const password = env.APP_PASSWORD;
  if (!password) return next();

  if (url.pathname === '/login' && request.method === 'POST') {
    return handleLogin(context, url, password);
  }

  if (await hasValidSession(request, password)) {
    if (url.pathname === '/login') return redirect('/');
    return next();
  }

  /* Appen kalder /api/sync i baggrunden. Den skal have et rigtigt svar at
     forholde sig til — ikke en loginside forklædt som data. */
  if (url.pathname.startsWith('/api/')) {
    return json({ error: 'Ikke logget ind.' }, 401);
  }

  return loginPage(url, null, 200);
}

/* ---------- Login ---------- */

async function handleLogin(context, url, password) {
  const { request, env } = context;

  const ip = request.headers.get('CF-Connecting-IP') || 'ukendt';
  const throttled = await tooManyAttempts(env.DB, ip);
  if (throttled) {
    return loginPage(url, 'For mange forsøg. Prøv igen om et kvarter.', 429);
  }

  let given = '';
  try {
    const form = await request.formData();
    given = String(form.get('password') || '');
  } catch (e) {
    given = '';
  }

  if (!timingSafeEqual(given, password)) {
    await countFailure(env.DB, ip);
    return loginPage(url, 'Forkert adgangskode.', 401);
  }

  await clearFailures(env.DB, ip);

  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const token = await sign(password, expires);
  const target = safeRedirect(url.searchParams.get('next'));

  return new Response(null, {
    status: 303,
    headers: {
      Location: target,
      'Set-Cookie': `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`,
      'Cache-Control': 'no-store'
    }
  });
}

function logout() {
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/',
      'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
      'Cache-Control': 'no-store'
    }
  });
}

/* Kun stier på siden selv — så ?next= ikke kan sende nogen videre til et fremmed domæne. */
function safeRedirect(value) {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

function redirect(path) {
  return new Response(null, { status: 303, headers: { Location: path, 'Cache-Control': 'no-store' } });
}

/* ---------- Session ---------- */

async function hasValidSession(request, password) {
  const token = readCookie(request.headers.get('Cookie'), COOKIE);
  if (!token) return false;

  const dot = token.indexOf('.');
  if (dot < 0) return false;

  const expires = Number(token.slice(0, dot));
  if (!Number.isFinite(expires) || expires * 1000 < Date.now()) return false;

  const expected = await sign(password, expires);
  return timingSafeEqual(token, expected);
}

function readCookie(header, name) {
  if (!header) return null;
  const parts = header.split(';');
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

async function sign(password, expires) {
  const encoder = new TextEncoder();
  /* Adgangskoden bruges ikke direkte som nøgle, men gennem en hash med et fast
     formål — så en session-cookie aldrig kan bruges til at gætte selve koden. */
  const material = await crypto.subtle.digest(
    'SHA-256',
    encoder.encode('familieplan-session-v1:' + password)
  );
  const key = await crypto.subtle.importKey(
    'raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(String(expires)));
  return expires + '.' + base64url(signature);
}

function base64url(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* Sammenligning der tager lige lang tid uanset hvor de to strenge er forskellige,
   så svartiden ikke røber noget om adgangskoden. */
function timingSafeEqual(a, b) {
  const x = String(a);
  const y = String(b);
  let diff = x.length ^ y.length;
  const length = Math.max(x.length, y.length);
  for (let i = 0; i < length; i++) {
    diff |= x.charCodeAt(i % (x.length || 1)) ^ y.charCodeAt(i % (y.length || 1));
  }
  return diff === 0;
}

/* ---------- Bremse på gætteri ---------- */

async function tooManyAttempts(db, ip) {
  if (!db) return false;
  try {
    const row = await db.prepare('SELECT count, reset_at FROM login_attempts WHERE ip = ?')
      .bind(ip).first();
    if (!row) return false;
    if (row.reset_at < Date.now()) return false;
    return row.count >= MAX_ATTEMPTS;
  } catch (e) {
    return false; // en manglende tabel må ikke spærre for login
  }
}

async function countFailure(db, ip) {
  if (!db) return;
  try {
    const now = Date.now();
    await db.prepare(
      'INSERT INTO login_attempts (ip, count, reset_at) VALUES (?, 1, ?) ' +
      'ON CONFLICT(ip) DO UPDATE SET ' +
      'count = CASE WHEN login_attempts.reset_at < ? THEN 1 ELSE login_attempts.count + 1 END, ' +
      'reset_at = CASE WHEN login_attempts.reset_at < ? THEN ? ELSE login_attempts.reset_at END'
    ).bind(ip, now + WINDOW_MS, now, now, now + WINDOW_MS).run();
  } catch (e) { /* ignoreres */ }
}

async function clearFailures(db, ip) {
  if (!db) return;
  try {
    await db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
  } catch (e) { /* ignoreres */ }
}

/* ---------- Svar ---------- */

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function loginPage(url, error, status) {
  const next = escapeHtml(safeRedirect(url.pathname + url.search));
  const message = error
    ? `<p class="error">${escapeHtml(error)}</p>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Familieplan</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🗓️</text></svg>">
<style>
  :root { color-scheme: light dark; --bg:#f4f5f7; --surface:#fff; --text:#1c1f26; --muted:#6b7280; --border:#dcdfe6; --accent:#3b6ea5; --accent-text:#fff; --danger:#b3453f; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#14171c; --surface:#1c2027; --text:#e7e9ee; --muted:#9aa2b1; --border:#2f3540; --accent:#6ea8e0; --accent-text:#10151b; --danger:#e0857f; }
  }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px;
         background:var(--bg); color:var(--text);
         font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  .card { width:min(380px,100%); background:var(--surface); border:1px solid var(--border);
          border-radius:12px; padding:28px; text-align:center;
          box-shadow:0 1px 2px rgba(16,24,40,.06), 0 8px 24px rgba(16,24,40,.08); }
  .logo { font-size:34px; }
  h1 { font-size:19px; margin:8px 0 4px; }
  p.hint { margin:0 0 20px; color:var(--muted); font-size:13.5px; }
  label { display:block; text-align:left; font-size:12px; font-weight:600; color:var(--muted); margin-bottom:4px; }
  input { width:100%; font:inherit; padding:10px 12px; border-radius:8px;
          border:1px solid var(--border); background:var(--surface); color:var(--text); }
  input:focus { outline:2px solid var(--accent); outline-offset:-1px; }
  button { width:100%; margin-top:14px; font:inherit; font-weight:600; padding:10px 14px;
           border:0; border-radius:8px; background:var(--accent); color:var(--accent-text); cursor:pointer; }
  button:hover { filter:brightness(1.06); }
  .error { margin:0 0 14px; padding:9px 12px; border-radius:8px; font-size:13.5px;
           color:var(--danger); border:1px solid var(--danger); }
</style>
</head>
<body>
  <main class="card">
    <div class="logo" aria-hidden="true">🗓️</div>
    <h1>Familieplan</h1>
    <p class="hint">Skriv jeres fælles adgangskode for at se planen.</p>
    ${message}
    <form method="POST" action="/login?next=${encodeURIComponent(next)}">
      <label for="password">Adgangskode</label>
      <input id="password" name="password" type="password" autocomplete="current-password" autofocus required>
      <button type="submit">Log ind</button>
    </form>
  </main>
</body>
</html>`;

  return new Response(html, {
    status: status || 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

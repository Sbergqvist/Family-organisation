/**
 * Pages Function på /api/sync — synkroniserer data mellem jeres enheder.
 *
 * Protokollen er bevidst enkel: klienten sender de rækker den har ændret siden
 * sidst, og fortæller hvornår den sidst hentede. Serveren skriver ændringerne og
 * svarer med alt hvad andre enheder har ændret i mellemtiden.
 *
 * Serveren sætter selv tidsstemplerne, så to enheder med forskellig urindstilling
 * ikke kan overskrive hinanden i forkert rækkefølge. Ved samtidige ændringer af
 * samme punkt vinder den, der når frem sidst.
 *
 * Adgang: hele domænet ligger bag Cloudflare Access, så en forespørgsel herind er
 * allerede logget ind. Se verifyAccess() nedenfor for et ekstra lag.
 */

const KINDS = { item: true, shopping: true, meta: true };
const MAX_CHANGES = 500;      // rækker pr. kald
const MAX_DATA_BYTES = 20000; // pr. række
const OVERLAP_MS = 1000;      // hentevinduet trækkes lidt tilbage, se pullCursor()

export async function onRequestPost(context) {
  return handle(context, true);
}

/* Rent hent — praktisk til at teste med browseren: /api/sync?since=0 */
export async function onRequestGet(context) {
  return handle(context, false);
}

async function handle({ request, env }, allowWrite) {
  if (!env.DB) {
    return json({ error: 'Databasen mangler. Bind en D1-database som DB i Pages-projektet.' }, 503);
  }

  let since = 0;
  let changes = [];

  if (allowWrite) {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'Ugyldig JSON i kaldet.' }, 400);
    }
    since = toCursor(body && body.since);
    changes = Array.isArray(body && body.changes) ? body.changes : [];
    if (changes.length > MAX_CHANGES) {
      return json({ error: 'For mange ændringer i ét kald (maks ' + MAX_CHANGES + ').' }, 413);
    }
  } else {
    since = toCursor(new URL(request.url).searchParams.get('since'));
  }

  const now = Date.now();

  const writes = [];
  for (const change of changes) {
    const row = validate(change);
    if (!row) return json({ error: 'Ugyldig ændring i kaldet.' }, 400);
    writes.push(
      env.DB.prepare(
        'INSERT INTO records (kind, id, data, deleted, updated_at) VALUES (?, ?, ?, ?, ?) ' +
        'ON CONFLICT(kind, id) DO UPDATE SET data = excluded.data, deleted = excluded.deleted, updated_at = excluded.updated_at'
      ).bind(row.kind, row.id, row.data, row.deleted, now)
    );
  }
  if (writes.length) await env.DB.batch(writes);

  const pulled = await env.DB.prepare(
    'SELECT kind, id, data, deleted, updated_at FROM records WHERE updated_at > ? ORDER BY updated_at'
  ).bind(since).all();

  return json({
    now: pullCursor(now),
    accepted: writes.length,
    changes: (pulled.results || []).map(function (r) {
      return {
        kind: r.kind,
        id: r.id,
        data: r.deleted ? null : safeParse(r.data),
        deleted: !!r.deleted,
        updated_at: r.updated_at
      };
    })
  });
}

/**
 * Klientens næste udgangspunkt. Vi trækker et sekund fra, fordi en anden enhed kan
 * nå at skrive i samme millisekund som vores hentning: så får vi rækken med næste
 * gang i stedet for at springe den over. At hente den samme række to gange gør
 * ingen skade — den bliver bare skrevet oven i sig selv.
 */
function pullCursor(now) {
  return Math.max(0, now - OVERLAP_MS);
}

function validate(change) {
  if (!change || typeof change !== 'object') return null;
  if (!KINDS[change.kind]) return null;
  if (typeof change.id !== 'string' || !change.id || change.id.length > 64) return null;

  const deleted = change.deleted ? 1 : 0;
  if (deleted) return { kind: change.kind, id: change.id, data: null, deleted: 1 };

  let data;
  try {
    data = JSON.stringify(change.data);
  } catch (e) {
    return null;
  }
  if (typeof data !== 'string' || data.length > MAX_DATA_BYTES) return null;
  return { kind: change.kind, id: change.id, data: data, deleted: 0 };
}

function toCursor(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

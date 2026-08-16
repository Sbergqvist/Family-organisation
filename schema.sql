-- Databaseskema til synkronisering (Cloudflare D1).
--
-- Alt gemmes i én tabel: hvert punkt, hver indkøbsvare og indstillingerne er
-- én række med et tidsstempel. Klienterne henter alt der er ændret siden sidst.
--
-- Kør én gang:  npx wrangler d1 execute familieplan --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS records (
  kind       TEXT    NOT NULL,           -- 'item' | 'shopping' | 'meta'
  id         TEXT    NOT NULL,
  data       TEXT,                       -- JSON; NULL når rækken er slettet
  deleted    INTEGER NOT NULL DEFAULT 0, -- gravsten, så sletninger også når frem
  updated_at INTEGER NOT NULL,           -- serverens tidsstempel i millisekunder
  PRIMARY KEY (kind, id)
);

-- Klienterne henter altid "alt nyere end mit sidste tidsstempel".
CREATE INDEX IF NOT EXISTS idx_records_updated ON records (updated_at);

-- Bremse på gætteri af adgangskoden. Bruges kun hvis siden er beskyttet med
-- APP_PASSWORD; mangler tabellen, springes tællingen bare over.
CREATE TABLE IF NOT EXISTS login_attempts (
  ip       TEXT    PRIMARY KEY,
  count    INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL
);

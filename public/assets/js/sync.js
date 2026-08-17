/**
 * Synkronisering mod /api/sync.
 *
 * Princippet er "local first": appen skriver som altid til localStorage og virker
 * uden net. Synkroniseringen er et lag ovenpå, der sender ændringer op og henter
 * andres ned. Går nettet, hober ændringerne sig op og bliver sendt når der er
 * forbindelse igen.
 *
 * Findes API'et ikke (åbnet som fil, eller hosting uden database), slår laget sig
 * selv fra og appen fortsætter som ren lokal app.
 */
(function (global) {
  'use strict';

  var Store = global.Store;

  var ENDPOINT = '/api/sync';
  var CURSOR_KEY = 'familieplan.cursor';
  var PUSH_DELAY = 1200;   // ms efter en ændring før vi sender
  var POLL_INTERVAL = 30000; // ms mellem hentninger af den andens ændringer
  var NO_API = [404, 405, 501, 503]; // svar der betyder "her er intet API"

  var status = 'idle';     // idle | syncing | ok | offline | auth | disabled
  var lastSync = 0;
  var inFlight = false;
  var again = false;       // der kom ændringer mens et kald var undervejs
  var pushTimer = null;
  var listeners = [];

  function cursor() {
    var n = Number(global.localStorage.getItem(CURSOR_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function setCursor(value) {
    try { global.localStorage.setItem(CURSOR_KEY, String(value)); } catch (e) { /* ignoreres */ }
  }

  function setStatus(next) {
    if (status === next) return;
    status = next;
    listeners.forEach(function (fn) { fn(); });
  }

  function state() {
    return {
      status: status,
      lastSync: lastSync,
      pending: Store.hasPending(),
      enabled: status !== 'disabled'
    };
  }

  /** Kort, menneskelig status til visningen. */
  function label() {
    if (status === 'disabled') return 'Kun på denne enhed';
    if (status === 'auth') return 'Log ind igen';
    if (status === 'syncing') return 'Synkroniserer …';
    if (status === 'offline') return Store.hasPending() ? 'Offline — gemt lokalt' : 'Offline';
    if (status === 'ok' || lastSync) {
      var secs = Math.round((Date.now() - lastSync) / 1000);
      if (secs < 60) return 'Synkroniseret';
      var mins = Math.round(secs / 60);
      if (mins < 60) return 'Synkroniseret for ' + mins + ' min. siden';
      return 'Synkroniseret ' + new Date(lastSync).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
    }
    return 'Ikke synkroniseret endnu';
  }

  /**
   * Ét kald: send det der venter, og tag imod hvad der er kommet.
   * Kald der overlapper hinanden undgås — der køres højst ét ad gangen.
   */
  function sync(options) {
    options = options || {};
    if (status === 'disabled' && !options.force) return Promise.resolve(false);
    if (inFlight) { again = true; return Promise.resolve(false); }

    var changes = Store.pendingChanges();
    inFlight = true;
    setStatus('syncing');

    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ since: cursor(), changes: changes }),
      redirect: 'manual'
    }).then(function (res) {
      /* Ligger der ikke et API i den anden ende, slår vi fra i stedet for at blive ved
         med at prøve. 405 kommer fra en almindelig statisk server, 503 fra vores egen
         funktion når databasen ikke er bundet. */
      if (NO_API.indexOf(res.status) >= 0) {
        setStatus('disabled');
        return false;
      }
      /* Cloudflare Access sender en udløbet session videre til login. Kaldet kan
         ikke følge med derhen — så skal siden genindlæses, ikke prøve igen. */
      if (res.type === 'opaqueredirect' || res.status === 401 || res.status === 403) {
        setStatus('auth');
        return false;
      }
      if (!res.ok) throw new Error('Serveren svarede ' + res.status);
      return res.json();
    }).then(function (body) {
      if (!body) return false;

      /* Først kvitteres for det sendte, så en ændring lavet imens ikke tabes. */
      Store.clearPending(changes);
      Store.applyRemote(body.changes || []);
      setCursor(body.now || 0);
      lastSync = Date.now();
      setStatus('ok');
      return true;
    }).catch(function (err) {
      /* Manglende net er hverdag, ikke en fejl — ændringerne ligger stadig lokalt. */
      console.warn('Synkronisering mislykkedes:', err.message);
      setStatus('offline');
      return false;
    }).then(function (result) {
      inFlight = false;
      if (again) {
        again = false;
        schedule(0);
      }
      return result;
    });
  }

  function schedule(delay) {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { sync(); }, delay == null ? PUSH_DELAY : delay);
  }

  function onStatusChange(fn) { listeners.push(fn); }

  function start() {
    if (global.location.protocol === 'file:') {
      setStatus('disabled');
      return;
    }

    /* Lokale ændringer sendes kort efter de sker. */
    Store.subscribe(function () {
      if (status === 'disabled') return;
      if (Store.hasPending()) schedule();
    });

    sync({ force: true });
    setInterval(function () {
      if (status !== 'disabled' && !document.hidden) sync();
    }, POLL_INTERVAL);

    /* Skifter man tilbage til fanen eller får net igen, hentes med det samme. */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) sync();
    });
    global.addEventListener('online', function () { sync(); });
  }

  global.Sync = {
    start: start,
    sync: sync,
    state: state,
    label: label,
    onStatusChange: onStatusChange
  };
})(window);

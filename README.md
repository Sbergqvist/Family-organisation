# Familieplan

En lille hjemmeside til at planlægge ugen og måneden for to personer — med opgaver,
aftaler, to-do-lister og en fælles indkøbsliste.

Siden er ren HTML, CSS og JavaScript uden byggeproces: åbn `index.html`, og den
virker. Lægges den på Cloudflare Pages, kan den desuden synkronisere planen mellem
jeres enheder og lukkes af med login — se [DEPLOY.md](DEPLOY.md).

## Hvad kan den?

| Visning | Indhold |
| --- | --- |
| **Uge** | Syv dagkolonner med ugenummer, hurtig oprettelse i hver dag og optælling af åbne punkter pr. person |
| **Måned** | Kalendergitter på computer, dagsliste på mobil |
| **To-do** | Alt samlet og grupperet: Forfaldne, I dag, I morgen, Resten af ugen, Senere, Uden dato |
| **Indkøb** | Fælles liste med afkrydsning og "ryd afkrydsede" |
| **Indstillinger** | Navne og farver på jer to, eksport/import af data, nulstilling |

Andre detaljer:

- **Opgaver og aftaler** — en aftale har typisk et tidspunkt, en opgave krydses af.
- **Ansvarlig** — hvert punkt hører til person 1, person 2 eller "Fælles", og farven følger med overalt.
- **Gentagelser** — dagligt, ugentligt, hver 2. uge, månedligt eller årligt. Faste ting som
  "tømme skraldespand" oprettes én gang. Afkrydsning gemmes pr. dato, så næste uges
  forekomst starter forfra.
- **Prioritet og noter** på hvert punkt.
- **Træk og slip** et kort til en anden dag for at flytte det (flytter man et gentaget
  punkt, flyttes hele serien).
- **Filter** øverst til højre: vælger man en person, vises både personens egne og de
  fælles punkter.
- Virker i mørkt og lyst tema efter systemets indstilling, og tilpasser sig mobilskærme.

### Tastaturgenveje

| Tast | Handling |
| --- | --- |
| `N` | Nyt punkt |
| `←` / `→` | Forrige/næste uge eller måned |
| `T` | Hop til i dag |
| `Esc` | Luk dialogen |

## Sådan bruger I den

Dobbeltklik på `index.html`, eller kør en lille lokal server:

```bash
npx http-server -p 8000
# åbn http://localhost:8000
```

### Læg den på nettet — kun for jer to

Se **[DEPLOY.md](DEPLOY.md)**: Cloudflare Pages som hosting og Cloudflare Access som
login foran. Begge dele er gratis, og kun de mailadresser I skriver på listen, kan
åbne siden — man logger ind med en engangskode på mail. Derefter kan I gemme siden
på hjemmeskærmen på hver jeres telefon.

Vil I hellere nøjes med én fælles adgangskode end Cloudflare Access, kan siden
lukkes med miljøvariablen `APP_PASSWORD` — se afsnittet om adgangskode i DEPLOY.md.
Koden tjekkes på serveren, før noget udleveres.

GitHub Pages virker også (**Settings → Pages** → *Deploy from a branch*, mappe `/ (root)`),
men den slags sider er altid offentligt tilgængelige for enhver med adressen.

## Hvor gemmes data?

Appen skriver altid til browserens `localStorage` først. Derfor virker den uden
net, og derfor er den hurtig. Oven på det ligger et valgfrit synkroniseringslag.

**Uden synkronisering** (åbnet som fil, eller hosting uden database) er planen ren
lokal: den findes kun på den enhed, og I flytter data med *Indstillinger →
Eksportér/Importér*. Statusfeltet øverst siger “Kun på denne enhed”.

**Med synkronisering** ([DEPLOY.md](DEPLOY.md) trin 3) deler I én fælles plan:

- Ændringer sendes ca. et sekund efter de sker, og der hentes nyt hvert halve
  minut samt hver gang I skifter tilbage til fanen.
- Er I offline, gemmes ændringerne lokalt og sendes når nettet er tilbage.
- Sletninger sendes som gravsten, så et slettet punkt også forsvinder hos den anden.
- Retter I det *samme* punkt samtidig, vinder den ændring der når frem sidst.
  Forskellige punkter kan aldrig ødelægge hinanden.

Eksporten er stadig jeres sikkerhedskopi — tag en nu og da.

## Filer

```
index.html               Side og dialog
_headers                 Sikkerhedsheaders til Cloudflare Pages
assets/styles.css        Tema, layout og responsivt design
assets/js/utils.js       Dato- og DOM-hjælpefunktioner
assets/js/store.js       Datamodel, lagring, gentagelser og ændringssporing
assets/js/render.js      Fælles opmærkning for kort
assets/js/views/         Én fil pr. visning: uge, måned, to-do, indkøb, indstillinger
assets/js/sync.js        Synkronisering mod /api/sync
assets/js/app.js         Navigation, dialog, træk-og-slip, genveje
functions/_middleware.js Adgangskode foran hele siden (valgfri)
functions/api/sync.js    Serverdelen (Cloudflare Pages Function)
schema.sql               Databasetabellen til D1
```

### Kort om synkroniseringen

Hvert punkt, hver indkøbsvare og indstillingerne er én række med et tidsstempel.
Klienten husker hvilke rækker den har ændret, og hvornår den sidst hentede. Ved
hver synkronisering sender den de ændrede rækker og beder om alt, der er nyere end
dens tidsstempel. Serveren sætter selv tidsstemplerne, så to enheder med forskelligt
indstillet ur ikke kan overskrive hinanden i forkert rækkefølge.

Kør hele stakken lokalt med API og database:

```bash
npx wrangler pages dev . --d1=DB=familieplan
```

Konfigurationen ligger med vilje kun i Cloudflare-dashboardet. Lægger man en
`wrangler.toml` i repoet, bliver den sandheden om projektet, og bindingerne fra
dashboardet bliver tilsidesat.

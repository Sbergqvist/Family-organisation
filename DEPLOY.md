# Sådan får I en privat udgave af Familieplan

Målet: siden ligger på nettet, så I begge kan åbne den fra telefon og computer —
men **kun jeres to e-mailadresser kan komme ind**. Alle andre får en loginskærm de
ikke kommer forbi.

Opskriften er Cloudflare Pages (hosting) + Cloudflare Access (login). Begge dele er
gratis: Access' gratisplan dækker op til 50 brugere, og I skal bruge to.

Login sker med en **engangskode på mail** — I skal altså ikke oprette konti eller
huske et kodeord. Man skriver sin mailadresse, får en 6-cifret kode og er inde.

Regn med 20-30 minutter første gang.

---

## Trin 1 — Læg siden på Cloudflare Pages

1. Opret en gratis konto på <https://dash.cloudflare.com> (eller log ind).
2. Vælg **Compute (Workers & Pages)** i menuen til venstre → **Create** → fanen
   **Pages** → **Connect to Git**.

   > **Det skal være et Pages-projekt, ikke et Workers-projekt.** Cloudflare
   > foreslår gerne Workers, når man importerer fra Git, og de to ting bygger
   > koden forskelligt: denne side bruger `functions/`-mappen, som kun Pages
   > forstår. Vælger man Workers, fejler byggeriet med *“Missing entry-point to
   > Worker script”*. Kendetegnet på et Pages-projekt er, at byggeindstillingerne
   > har et felt til **Build output directory**.

3. Godkend Cloudflare i GitHub, og vælg repoet **Family-organisation**.
   Du kan nøjes med at give adgang til netop dette repo.

   > Har I allerede et Workers-projekt med det navn, I vil bruge, så slet det
   > først — ellers er navnet optaget.
4. Udfyld byggeindstillingerne — der er ingen byggeproces, så de fleste felter er tomme:

   | Felt | Værdi |
   | --- | --- |
   | Project name | `familieplan` (bliver en del af adressen) |
   | Production branch | `claude/weekly-planning-website-wykytg` (eller `main`, hvis I fletter derover) |
   | Framework preset | `None` |
   | Build command | *(lad feltet stå tomt)* |
   | Build output directory | `public` |

5. Klik **Save and Deploy**. Efter ca. et minut har I en adresse i stil med
   `https://familieplan.pages.dev`.

Siden virker nu — men er offentlig indtil trin 2 er klaret. Fortsæt med det samme.

> Hver gang du pusher til branchen, bygger Cloudflare siden forfra af sig selv.

---

## Trin 2 — Sæt login foran med Cloudflare Access

**Start inde i Pages-projektet — ikke i Zero Trust.** Det er her de fleste går i stå:
opretter man en Access-applikation i hånden, skal man vælge domænet i en liste, og
`pages.dev` står ikke på den. Listen viser kun domæner, I selv har i Cloudflare, og
`pages.dev` tilhører Cloudflare. Derfor har Pages en knap, der laver applikationen
for jer med det rigtige værtsnavn.

### 2a. Tænd for det fra Pages

Gå til **Workers & Pages → familieplan → Settings**, find afsnittet
**Access policy**, og klik **Enable access policy**. (På nogle konti ligger knappen
under fanen *Manage* i stedet.)

Første gang bliver I bedt om at oprette et Zero Trust-team:

- Vælg planen **Free**. Cloudflare beder om et betalingskort for at oprette teamet,
  men gratisplanen trækker ikke penge. Den dækker 50 brugere; I skal bruge to.
- Vælg et *team name*. Det bliver til `<teamnavn>.cloudflareaccess.com`, som er
  det domæne, jeres loginskærm ligger på.

Cloudflare opretter nu en Access-applikation for jer.

### 2b. Få den til at dække selve siden — ikke kun preview-adresserne

Som standard dækker applikationen `*.familieplan.pages.dev`, altså de tilfældige
preview-adresser, men **ikke** `familieplan.pages.dev`, som er den I bruger.

Gå til **Zero Trust → Access → Applications**, åbn applikationen, og find
**Public hostname**. Der står en stjerne (`*`) i feltet **Subdomain**.

**Slet stjernen**, så feltet indeholder `familieplan` og domænet er `pages.dev`.
Gem. Nu er selve siden låst.

Vil I have begge dele dækket, tilføjer I bagefter endnu et public hostname (eller
en applikation mere) med `*` som subdomain. Alternativt kan preview-udrulninger
slås fra under *Pages → Settings → Builds*.

### 2c. Vælg hvem der må komme ind

I applikationen: fanen **Policies** → rediger den politik, Cloudflare lavede, eller
tilføj en ny:

| Felt | Værdi |
| --- | --- |
| Policy name | `Os to` |
| Action | `Allow` |
| Include → Selector | **`Emails`** |
| Value | jeres to mailadresser — tilføj dem én ad gangen |

Vigtigt: står der `Everyone` under *Include*, kan alle med adressen komme ind.
Det skal udskiftes med `Emails`.

### 2d. Login med kode på mail

Under applikationens **Login methods** skal **One-time PIN** være slået til.
Er listen tom, tilføjes den under **Zero Trust → Integrations → Identity
providers → Add new → One-time PIN** (på ældre konti: *Settings → Authentication*).
Der skal ikke konfigureres noget — den virker som den er.

Sæt samtidig **Session duration** til `1 month`, så I ikke skal logge ind hele tiden.

### 2e. Prøv det af

Åbn adressen i et privat browservindue. Der skal komme en loginskærm: skriv din
mail, tryk **Send me a code**, og indtast de seks cifre fra mailen.

Prøv gerne med en tredje mailadresse — den skal blive afvist.

### Når det driller

**“Jeg kan ikke vælge pages.dev i Domain-listen.”** Det kan man heller ikke.
Brug knappen inde i Pages-projektet (2a) i stedet for at oprette applikationen i hånden.

**“Alle kan stadig komme ind på siden.”** Enten dækker applikationen kun `*`
(preview-adresserne) og ikke selve værtsnavnet — se 2b — eller også står politikken
til `Everyone` i stedet for `Emails`.

**“Der kommer ingen mail med koden.”** Kig i spam. Koden udløber efter 10 minutter.
Filtrerer jeres mail hårdt, så tillad afsenderen `noreply@notify.cloudflare.com`.

**“Skal jeg virkelig give kortoplysninger?”** Ja, til at oprette Zero Trust-teamet.
Free-planen koster ikke noget, og der trækkes ikke penge for to brugere.

**Og API'et?** `/api/sync` ligger på samme værtsnavn som siden, så den samme
applikation dækker den automatisk. Der skal ikke laves en regel til den.

---

## Trin 3 — Slå synkronisering til

Uden dette trin virker siden fint, men hver enhed har sin egen plan. Med det deler
I én fælles plan. Data ligger i en Cloudflare D1-database (SQLite) og hentes af den
lille funktion i `functions/api/sync.js`, som Pages selv finder og kører på
`/api/sync`. Fordi Access sidder foran hele domænet, er API'et beskyttet af samme
login — der skal ikke sættes brugerstyring op.

### Hvad koster det?

Ingenting for to personer. Gratisplanen giver 100.000 kald til funktionen om dagen,
5 millioner læste og 100.000 skrevne rækker om dagen, og 500 MB pr. database.

Til sammenligning bruger I med to enheder, der står åbne hele dagen, omkring
6.000 kald og under 100.000 læste rækker i døgnet — og en plan med tusindvis af
punkter fylder nogle få megabyte. I er altså en faktor 10-50 fra den nærmeste grænse.

Og vigtigst: **gratisplanen kan ikke give en regning.** Rammer man loftet, svarer
databasen med en fejl indtil næste døgn — der bliver ikke trukket penge. Det kræver
et aktivt valg om at opgradere til Workers Paid ($5/md.) at komme til at betale
noget, og det har I ikke brug for.

### 3a. Opret databasen

I dashboardet: **Storage & Databases → D1 SQL Database → Create Database**.
Kald den `familieplan`.

Åbn databasen, vælg fanen **Console**, indsæt hele indholdet af `schema.sql` fra
repoet, og kør det. Det laver den ene tabel, der skal bruges.

> Foretrækker du kommandolinjen:
> ```bash
> npx wrangler d1 create familieplan
> npx wrangler d1 execute familieplan --remote --file=schema.sql
> ```
>
> Bind den derefter i dashboardet som beskrevet nedenfor. Undgå at lægge en
> `wrangler.toml` i repoet: findes den, tilsidesætter den bindingerne fra
> dashboardet.

### 3b. Bind databasen til siden

Gå til Pages-projektet → **Settings → Bindings → Add → D1 database**:

| Felt | Værdi |
| --- | --- |
| Variable name | `DB` — præcis dette navn, det er sådan koden finder databasen |
| D1 database | `familieplan` |

Tilføj bindingen for både **Production** og **Preview**, hvis begge dele er i brug.

### 3c. Udrul igen

Bindinger slår først igennem ved næste udrulning: **Deployments → … → Retry
deployment**, eller push en ny commit.

### 3d. Tjek at det virker

Åbn siden. Øverst til højre skal der stå **“Synkroniseret”** med en grøn prik.
Under *Indstillinger → Synkronisering* kan I trykke **Synkronisér nu** og se status.

Prøv så det rigtige: opret en opgave på din telefon, og se den dukke op på din
kones inden for et halvt minut.

Står der **“Kun på denne enhed”**, er databasen ikke bundet endnu, eller siden er
ikke udrullet igen efter bindingen blev lavet.

---

## Når byggeriet fejler

**“Missing entry-point to Worker script or to assets directory”** med
`npx wrangler deploy` i loggen: projektet kører Workers-kommandoen på et
Pages-projekt. `wrangler deploy` forventer et Worker-script; det her er en
Pages-side med en `functions/`-mappe.

Gå til projektets byggeindstillinger (**Settings → Build**) og ret:

| Felt | Værdi |
| --- | --- |
| Build command | *(tom)* |
| Deploy command | *(tom)* — der er ingen byggeproces at køre |
| Build output directory | `public` |

Kan feltet **Deploy command** ikke stå tomt, så skriv i stedet:

```
npx wrangler pages deploy . --project-name=familieplan
```

Bemærk `pages` i midten. Det er hele forskellen: `wrangler deploy` udruller en
Worker, `wrangler pages deploy` udruller en Pages-side med dens funktioner.

Kør derefter **Deployments → … → Retry deployment**.

> Ser du slet ikke et felt til *Build output directory*, men kun byggekommandoer,
> er projektet oprettet som et Workers-projekt og ikke et Pages-projekt. Så skal
> koden struktureres anderledes — sig til, hvis det er tilfældet.

---

### Selvtjek: `/api/status`

Åbn **`<din-adresse>/api/status`**. Den svarer med tre ja/nej — og røber intet
andet — så I kan se, hvad den kørende udgave faktisk har fået fat i:

```json
{ "functions": true, "database": true, "password": true }
```

| Felt | `false` betyder |
| --- | --- |
| `functions` | Svarer siden slet ikke med JSON, kører `functions/` ikke — se nedenfor |
| `database` | D1-bindingen mangler. Den skal hedde præcis `DB` (databasens eget navn er ligegyldigt) |
| `password` | `APP_PASSWORD` er ikke nået frem: forkert stavet, sat under Preview i stedet for Production, eller ikke udrullet igen bagefter |

### Siden virker, men beder ikke om adgangskode — og synkroniserer ikke

Så kører `functions/`-mappen ikke. Symptomerne følges ad, fordi begge dele er
funktioner: ingen loginskærm, og statusfeltet siger “Kun på denne enhed”.

Tjek **Build output directory** under *Settings → Build*. Den skal stå til
**`public`**. Står den til `/`, uploader Pages hele repoet som statiske filer —
inklusive `functions/`-mappen — og så bliver funktionerne aldrig kørt.

Strukturen er:

```
public/     ← det der udstilles: index.html, assets/, _headers
functions/  ← koden der kører på serveren; skal ligge UDEN FOR public/
```

Ret indstillingen og kør **Retry deployment**. Tjek derefter
`<din-adresse>/api/sync?since=0`: svarer den med JSON, kører funktionerne.

---

## Alternativ til Access: én fælles adgangskode

Er Cloudflare Access for besværligt, kan siden i stedet lukkes med en adgangskode,
I to deler. Det kræver hverken Zero Trust eller betalingskort, og virker på fem
minutter. I kan også bruge begge dele på én gang.

Koden tjekkes **på serveren**, før noget som helst udleveres — også de statiske
filer og `/api/sync`. Der er altså ikke tale om en skærm, man kan klikke forbi
eller finde koden bag i sidens kildekode.

### Sæt adgangskoden

Pages-projektet → **Settings → Variables and Secrets → Add**:

| Felt | Værdi |
| --- | --- |
| Type | **Secret** (så koden ikke kan læses igen bagefter) |
| Variable name | `APP_PASSWORD` |
| Value | jeres fælles adgangskode |

Tilføj den under **Production** (og **Preview**, hvis I bruger preview-adresser),
og udrul igen: **Deployments → … → Retry deployment**.

Vælg en kode, I kan sige til hinanden, men som ikke kan gættes — fire tilfældige ord
er både nemmere at huske og sværere at gætte end `Sommer2026!`.

### Bremsen på gætteri

Efter 10 forkerte forsøg fra samme IP-adresse afvises flere forsøg i et kvarter.
Det kræver en ekstra tabel i databasen — kør denne i D1-konsollen:

```sql
CREATE TABLE IF NOT EXISTS login_attempts (
  ip       TEXT    PRIMARY KEY,
  count    INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL
);
```

Springer I den over, virker logindet stadig — så tælles forsøgene bare ikke.

### Godt at vide

- **Uden `APP_PASSWORD` er siden åben.** Det er med vilje: så kan man ikke låse sig
  selv ude, og appen kan stadig åbnes som en almindelig fil fra din computer.
- **I forbliver logget ind i 30 dage** pr. enhed. Vil I ud før tid, så gå til
  `/logout` — fx `https://familieplan.pages.dev/logout`.
- **Skifter I adgangskode, ryger alle sessioner.** Signaturen på cookien laves med
  koden som nøgle, så gamle sessioner bliver ugyldige med det samme. Det er også
  måden at smide en gammel enhed ud på.
- **Cookien kan ikke forfalskes** og kan ikke læses af JavaScript (HttpOnly, Secure,
  SameSite=Lax).

---

## Trin 4 — Gem den på hjemmeskærmen

- **iPhone/iPad:** åbn adressen i Safari → Del-knappen → *Føj til hjemmeskærm*.
- **Android:** åbn i Chrome → menuen (⋮) → *Føj til startskærm*.

Med en session på en måned skal I kun logge ind ca. én gang om måneden pr. enhed.

---

## Godt at vide

**Sådan opfører synkroniseringen sig.** Appen skriver altid lokalt først, så den
virker uden net — i toget, i sommerhuset. Ændringer sendes et sekund efter de
sker, og der hentes nyt fra den anden enhed hvert halve minut, samt hver gang I
skifter tilbage til fanen. Er I offline, hober ændringerne sig op og bliver sendt,
når nettet er tilbage; statusfeltet øverst siger *“Offline — gemt lokalt”*.

**Ved samtidige rettelser vinder den sidste.** Retter I det samme punkt på hver
jeres telefon inden for samme minut, overlever den ændring der når frem sidst.
Forskellige punkter påvirker aldrig hinanden, så i praksis mærker I det ikke.

**Eksporten er stadig værd at bruge.** Den er jeres sikkerhedskopi, hvis en række
skulle blive slettet ved et uheld — databasen har ikke nogen fortrydelsesknap.

**Eget domæne.** Har I et domæne i forvejen, kan I sætte det på under
*Pages → Custom domains* og bruge det i Access-appen i stedet for `pages.dev`.

**Preview-udgaver.** Cloudflare laver også en adresse pr. commit under
`*.familieplan.pages.dev`. Er de ikke dækket (se trin 2b), kan de slås fra under
**Pages → Settings → Builds → Preview deployments**.

**Repoet er stadig offentligt.** Koden kan alle se — det er kun siden, der er
låst. Vil du også skjule koden, kan du gøre repoet privat under
*Settings → General → Danger Zone*; Cloudflare Pages virker fint med private repos.

**Fortryder I?** Slet Access-appen for at fjerne logindet igen, eller slet
Pages-projektet for at tage siden helt af nettet. Jeres data i browseren
påvirkes ikke af nogen af delene.

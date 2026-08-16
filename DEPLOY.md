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
3. Godkend Cloudflare i GitHub, og vælg repoet **Family-organisation**.
   Du kan nøjes med at give adgang til netop dette repo.
4. Udfyld byggeindstillingerne — der er ingen byggeproces, så de fleste felter er tomme:

   | Felt | Værdi |
   | --- | --- |
   | Project name | `familieplan` (bliver en del af adressen) |
   | Production branch | `claude/weekly-planning-website-wykytg` (eller `main`, hvis I fletter derover) |
   | Framework preset | `None` |
   | Build command | *(lad feltet stå tomt)* |
   | Build output directory | `/` |

5. Klik **Save and Deploy**. Efter ca. et minut har I en adresse i stil med
   `https://familieplan.pages.dev`.

Siden virker nu — men er offentlig indtil trin 2 er klaret. Fortsæt med det samme.

> Hver gang du pusher til branchen, bygger Cloudflare siden forfra af sig selv.

---

## Trin 2 — Sæt login foran med Cloudflare Access

1. Vælg **Zero Trust** i menuen til venstre.
2. Første gang skal der vælges en plan: vælg **Free**. Cloudflare beder om et
   betalingskort for at oprette teamet, men gratisplanen trækker ikke penge.
   Vælg samtidig et *team name* — det bliver til `<teamnavn>.cloudflareaccess.com`,
   og det er dét domæne, loginsiden ligger på.
3. Gå til **Access → Applications → Add an application → Self-hosted**.
4. Udfyld:

   | Felt | Værdi |
   | --- | --- |
   | Application name | `Familieplan` |
   | Session duration | `1 month` — så slipper I for at logge ind hele tiden |
   | Public hostname | Subdomain: `familieplan`, Domain: `pages.dev` |

5. Under **Identity providers** slås **One-time PIN** til (koden på mail).
   I behøver ikke andre login-metoder.
6. Videre til **Policies** → **Add a policy**:

   | Felt | Værdi |
   | --- | --- |
   | Policy name | `Os to` |
   | Action | `Allow` |
   | Include → Selector | `Emails` |
   | Value | jeres to mailadresser, én ad gangen |

7. **Save**.

Vent et minut, og åbn så adressen i et privat browservindue. Kommer der en
loginskærm fra Cloudflare, virker det. Prøv eventuelt med en tredje mailadresse —
den skal blive afvist.

---

## Trin 3 — Slå synkronisering til

Uden dette trin virker siden fint, men hver enhed har sin egen plan. Med det deler
I én fælles plan. Data ligger i en Cloudflare D1-database (SQLite) og hentes af den
lille funktion i `functions/api/sync.js`, som Pages selv finder og kører på
`/api/sync`. Fordi Access sidder foran hele domænet, er API'et beskyttet af samme
login — der skal ikke sættes brugerstyring op.

Gratisplanen dækker rigeligt: 5 GB database og 100.000 kald om dagen, hvor I skal
bruge nogle få hundrede.

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

**Preview-udgaver.** Cloudflare laver også en adresse pr. commit. De ligger på
underdomæner af `familieplan.pages.dev` og er ikke dækket af reglen ovenfor.
Slå dem fra under **Pages → Settings → Builds → Preview deployments → Disable**,
eller lav en tilsvarende Access-regel for `*.familieplan.pages.dev`.

**Repoet er stadig offentligt.** Koden kan alle se — det er kun siden, der er
låst. Vil du også skjule koden, kan du gøre repoet privat under
*Settings → General → Danger Zone*; Cloudflare Pages virker fint med private repos.

**Fortryder I?** Slet Access-appen for at fjerne logindet igen, eller slet
Pages-projektet for at tage siden helt af nettet. Jeres data i browseren
påvirkes ikke af nogen af delene.

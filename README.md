# Familieplan

En lille hjemmeside til at planlægge ugen og måneden for to personer — med opgaver,
aftaler, to-do-lister og en fælles indkøbsliste.

Siden er ren HTML, CSS og JavaScript. Der er ingen server, ingen konto og ingen
byggeproces: åbn `index.html`, og den virker.

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

GitHub Pages virker også (**Settings → Pages** → *Deploy from a branch*, mappe `/ (root)`),
men den slags sider er altid offentligt tilgængelige for enhver med adressen.

## Hvor gemmes data?

Alt gemmes i browserens `localStorage` på den enhed, I bruger. Det betyder:

- Ingen data forlader jeres enhed. Selv hvis siden ligger på en offentlig adresse,
  ser fremmede kun en tom plan — jeres punkter findes kun lokalt hos jer.
- **Planen synkroniserer ikke automatisk mellem to enheder.** Under *Indstillinger* kan I
  eksportere alt til en JSON-fil og importere den på den anden enhed.
- Rydder man browserens websteds-data, forsvinder planen — tag en eksport nu og da.

Vil I have rigtig synkronisering mellem telefoner, kræver det en lille backend
(fx Firebase eller Supabase). Det er det næste naturlige skridt, hvis fil-eksporten
bliver for besværlig i hverdagen.

## Filer

```
index.html            Side og dialog
_headers              Sikkerhedsheaders til Cloudflare Pages
assets/styles.css     Tema, layout og responsivt design
assets/js/utils.js    Dato- og DOM-hjælpefunktioner
assets/js/store.js    Datamodel, lagring og gentagelses-logik
assets/js/render.js   Fælles opmærkning for kort
assets/js/views/      Én fil pr. visning: uge, måned, to-do, indkøb, indstillinger
assets/js/app.js      Navigation, dialog, træk-og-slip, genveje
```

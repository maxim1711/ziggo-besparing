# Overstapadvies

Tablet-first PWA voor onafhankelijk overstapadvies (internet, tv, Vodafone-combinatie). Alles draait lokaal: geen backend, geen account, geen betaalde diensten.

> Onafhankelijk hulpmiddel; geen officiële uiting van Ziggo, Vodafone of Essent. De meegeleverde aanbiedingen zijn **voorbeelden met verzonnen prijzen**.

## Starten

```bash
npm install
npm run dev        # ontwikkelserver (ook bereikbaar op het lokale netwerk)
npm test           # rekentests (Vitest)
npm run build      # typecheck + productie-build in dist/
npm run preview    # productie-build lokaal serveren, inclusief service worker
```

Offline werken en installeren werken alleen vanuit de productie-build (`build` + `preview`, of `dist/` op een statische host).

## Zo werkt een advies (3 stappen)

1. **Huidige situatie** – maandbedrag, aanbieder, wel/geen tv, eventueel de einddatum van het contract.
2. **Nieuw pakket** – tik op een snelheid, tv aan/uit, extra's, acties en eventueel Vodafone. De prijs rechts rekent direct mee.
3. **Toon aan klant** – één rustig scherm met pakket, prijs nu, prijs daarna, contractduur en het verschil over 24 maanden. "Bekijk berekening" toont de volledige opbouw.

24 maanden is overal de standaard. Een contract van 12 maanden, een vaste bundel, een tweede optie of handmatige prijzen staan in stap 2 onder **Geavanceerd**.

## Prijzen en acties instellen

Open **Prijzen & Aanbiedingen**. Tik op een regel om hem te bewerken.

| Tabblad | Wat u instelt |
| --- | --- |
| Internet | naam, download/upload, normale prijs, actieprijs en -duur, contractduur, eenmalige kosten, geldigheid, interne notitie |
| Televisie | meerprijs, zenders/functies, inbegrepen ontvangers, prijs extra ontvanger |
| Extra's | sport, entertainment en overige pakketten |
| Acties | maandkorting met eigen duur (3, 6, 9, 12 … of hele looptijd), korting op eenmalige kosten, cadeau, voorwaarden, uitsluitgroep |
| Vodafone | standaard combinatiekorting (leeg = per klant invullen) |
| Bundels | vaste totaalprijzen; vervangen internet + tv zodat niets dubbel telt |
| Back-up | prijzen exporteren/terugzetten als JSON |

- Een leeg prijsveld betekent "nog invullen": de pakketbouwer blokkeert dan **Toon aan klant** en verzint geen bedrag.
- Alles met het label **Voorbeeld** heeft verzonnen prijzen. Zet "Prijs gecontroleerd" aan zodra de echte prijs erin staat.
- Acties met dezelfde groepsnaam sluiten elkaar uit.

## Op uw tablet gebruiken

De preview in de cloudomgeving is tijdelijk. Voor blijvend gebruik moet de map `dist/` op een **https-adres** staan. Daarvoor is geen eigen computer nodig, wel een eigen account bij een hoster.

**GitHub Pages (workflow is meegeleverd)**

1. Maak op github.com een repository aan en zet deze code erin (zie "Broncode meenemen"). *Vereist uw GitHub-account.*
2. Repository → Settings → Pages → Source: **GitHub Actions**. *Eenmalige toestemming van u.*
3. Elke push naar `main` test, bouwt en publiceert de app automatisch (`.github/workflows/deploy.yml`). Het adres staat daarna onder Settings → Pages.

Let op: een GitHub Pages-site is openbaar bereikbaar voor wie het adres kent. Klantgegevens en uw eigen prijzen staan alleen op uw tablet, niet op de site. Netlify, Vercel of Cloudflare Pages werken ook: build-commando `npm run build`, map `dist`.

**Installeren**

- **Android (Chrome):** open het adres → menu ⋮ → *App installeren*.
- **iPad (Safari):** open het adres → deel-icoon → *Zet op beginscherm*.

Open de app daarna één keer met internet; vanaf dan werkt hij offline.

**Updates en uw gegevens**

- Prijzen, instellingen, adviezen en opvolgingen staan in de opslag van de browser op de tablet en blijven bij een update staan (de opslag is geversioneerd en wordt gemigreerd).
- Ze horen bij het **adres**: verhuist de app naar een ander adres, of wist u de browsergegevens, dan zijn ze weg. Maak daarom vóór een update of verhuizing een back-up: *Prijzen & Aanbiedingen → Back-up* (prijzen) en *Instellingen → Back-up exporteren* (alles).

## Broncode meenemen

- Download het zip-bestand `overstapadvies-broncode.zip` uit deze sessie, of
- zet de map in een eigen Git-repository: `git remote add origin <uw-repo-url>` en `git push -u origin main`.

De cloudomgeving is tijdelijk: wat niet is gedownload of gepusht, verdwijnt.

## Architectuur

| Map | Inhoud |
| --- | --- |
| `src/engine` | Pure rekenmotor (geen React). Bedragen in gehele centen, maand-voor-maand. `catalog.ts` (prijsconfiguratie + pakketbouwer `composeOffer`), `calc.ts` (vergelijking), `insights.ts` (deterministische adviesregels), `ranking.ts` (labels met criterium), `commission.ts`, `customerView.ts` (klantveilig view-model), `energy.ts` (voorbereiding energiemodule). |
| `src/store` | Zustand. `data.ts` → localStorage (aanbiedingen, instellingen, opgeslagen adviezen, opvolgingen, uitkomsten). `draft.ts` → sessionStorage (lopend advies, verdwijnt bij sluiten). |
| `src/pages` | Nieuw advies (stap 1–2), Presentatie (stap 3), Prijzen & Aanbiedingen, Vergelijken, Opvolgingen, Mijn resultaten, Instellingen, Presentatie, Afdrukken. |
| `src/export` | PDF-voorstel (jsPDF, vector) en deeltekst voor WhatsApp. |

### Rekenregels en aannames

- Maand 1 is de overstapdatum (vandaag). Eenmalige kosten (activatie, installatie, apparatuur, beëindigingskosten huidig contract) tellen mee in het eerste jaar.
- Het huidige maandbedrag blijft gelijk, tenzij een aflopende korting of een verwacht toekomstig tarief is ingevuld. Een toekomstig tarief vervangt het basisbedrag inclusief aflopende kortingen (geen dubbeltelling).
- Na de actieperiode geldt het reguliere tarief. Maanden ná de contractduur worden als schatting gemarkeerd.
- Kortingen met dezelfde groepsnaam stapelen niet (alleen de hoogste per maand); kortingen brengen het abonnementsbedrag nooit onder nul.
- Vodafone-combinatievoordeel telt alleen mee als "komt in aanmerking" aan staat en wordt apart getoond (met en zonder).
- Cadeauwaarde wordt nooit verrekend in kosten of besparing.
- Provisie, weekdoel en interne notities bereiken de klantweergave, PDF, afdruk en deeltekst niet: die gebruiken uitsluitend `buildCustomerView()` (getest).

### Privacy

Alleen lokale opslag; geen analytics of externe diensten. Opslaan gebeurt uitsluitend na een tik op *Opslaan*. Opvolgingen zijn te exporteren (CSV/JSON) en te verwijderen; via Instellingen kan alles gewist of als back-up geëxporteerd worden.

### Energiemodule (voorbereid)

`src/engine/energy.ts` rekent jaarkosten uit op basis van één verbruiksprofiel en twee tarieven (kWh enkel/dubbel, gas, vastrecht, netbeheer, energiebelasting, vermindering, teruglevering, eenmalige actie). Er bestaat bewust geen veld voor een maandelijks voorschot. Nog niet aan de UI gekoppeld.

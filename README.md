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
2. **Nieuw pakket** – tik op een snelheid en een tv-pakket en kies de actie. Bellen, extra tv, sport/entertainment en Vodafone staan in uitklapbare secties. De prijs rechts rekent direct mee.
3. **Toon aan klant** – één rustig scherm met pakket, prijs nu, prijs daarna, contractduur en het verschil over 24 maanden. "Bekijk berekening" toont de volledige opbouw.

24 maanden is overal de standaard. Een contract van 12 maanden, een tweede optie of volledig handmatige prijzen staan in stap 2 onder **Geavanceerd**.

## Prijzen zelf bijwerken

Alles staat in **Prijzen & Aanbiedingen**; er is geen programmeerwerk nodig.

| Tabblad | Wat u er doet |
| --- | --- |
| Internet | prijs "alleen internet" per snelheid, aan/uit, eenmalige aansluitkosten. 4 en 8 Gbit staan klaar maar uit, zonder prijs. |
| Internet + TV | de officiële pakketprijzen als matrix (snelheid × tv-pakket) en de omschrijving van de tv-pakketten |
| Alles-in-1 | dezelfde matrix mét vast bellen |
| Extra diensten | ontvangers, wifi-versterkers, sport, film, bundels, streaming; prijs en aan/uit direct in de lijst |
| Vodafone | referentiekorting per snelheid |
| Acties | openbare websiteacties (referentie) |
| Mijn Salesacties | uw eigen, toegestane deuracties met status Concept / Gecontroleerd / Verlopen |
| Cadeaus | cadeaus die u aan een actie koppelt |
| Back-up | exporteren, importeren (met controle), basisprijzen terugzetten |

**Een prijs wijzigen:** tik in het bedrag, typ het nieuwe bedrag. Het geldt dan als vandaag gecontroleerd. Via het potlood past u bron, datum en overige eigenschappen aan.

**Een nieuwe deuractie:** Mijn Salesacties → Actie toevoegen → naam, aantal actiemaanden, en in het raster de actieprijs bij elk pakket waarvoor hij geldt → status **Gecontroleerd**. Alleen gecontroleerde, vandaag geldige acties zijn te kiezen.

### Regels die de app afdwingt

- Een pakketprijs komt altijd uit de matrix; er wordt nooit een losse tv-prijs bij internet opgeteld.
- Een actieprijs geldt alleen voor de pakketten waaraan hij is toegewezen. Bij een ander pakket vraagt de app om een bevestigde prijs voor dat ene advies.
- Diensten die al in het tv-pakket zitten tonen "Inbegrepen" en kosten niets extra; onderdelen van een gekozen bundel ook niet.
- Overlapt een bundel met iets dat al inbegrepen is, dan moet u de geldende prijs invullen; de app verzint geen korting.
- Diensten met alleen een "vanaf"-prijs zijn pas te kiezen als u de exacte prijs invult.
- Vodafone-voordeel telt pas mee na uw bevestiging. Korting op de Vodafone-rekening wordt apart getoond en nooit van de Ziggo-prijs afgetrokken.
- Ontbreekt een (gecontroleerde) prijs, dan toont de app "Prijs of combinatie nog controleren" en geen klantvergelijking.
- Na 30 dagen zonder controle verschijnt een herinnering.

De meegeleverde basisprijzen (controledatum 16 november 2026) staan in `src/engine/pricingSeed.ts`; de rekenregels in `src/engine/pricing.ts`. Een app-update overschrijft uw eigen prijzen niet.

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
| `src/engine` | Pure rekenmotor (geen React). Bedragen in gehele centen, maand-voor-maand. `pricing.ts` (prijsmatrix, acties en pakketbouwer `composeOffer`), `pricingSeed.ts` (basisprijzen), `catalog.ts` (oude opzet, alleen nog voor migratie), `calc.ts` (vergelijking), `insights.ts` (deterministische adviesregels), `ranking.ts` (labels met criterium), `commission.ts`, `customerView.ts` (klantveilig view-model), `energy.ts` (voorbereiding energiemodule). |
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

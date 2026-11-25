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

## Afspraak in Google Agenda

Bij een opvolging vult u datum, tijd, duur, telefoonnummer en adres in. **Opslaan en in agenda zetten** opent Google Agenda met alles al ingevuld (titel, tijd, adres als locatie, en in de omschrijving reden, telefoon, besproken aanbieding, einddatum contract en notities); u tikt daar alleen nog op Opslaan. Er is geen koppeling of account in de app: er gaat pas iets naar Google als u zelf op de knop tikt. In de lijst staat per opvolging ook een knop **Google Agenda**, een **.ics**-bestand voor andere agenda's, en tikbare links voor bellen en navigeren.

## Twee onderdelen

Het startscherm kiest tussen **Ziggo — Internet & TV** en **Essent — Energie**. Elk onderdeel heeft eigen kleuren, eigen prijzen en een eigen rekenmotor; opvolgingen, resultaten en instellingen zijn gedeeld. Het Ziggo-advies staat nu op `#/ziggo`, het energieadvies op `#/energie`.

## Essent: tarieven in seconden bijwerken

Alles gebeurt in de app onder **Essent → Tarieven & Acties**; er is geen code, Claude of nieuwe publicatie voor nodig. De tarieven staan in de opslag van uw tablet.

| Manier | Hoe |
| --- | --- |
| Snel bewerken | Tik in een tarief op de kaart van het aanbod, typ het nieuwe bedrag, **Opslaan**. Dat maakt een nieuwe versie; de vorige blijft bewaard onder "Vorige versies". |
| Nieuwe actie op basis van huidige | Maakt een kopie als concept. Pas alleen aan wat anders is, zet de status op Gecontroleerd en eventueel **Maak standaard**. |
| Tarieven plakken | Plak een bericht (WhatsApp, e-mail, spreadsheet). De app herkent tarieven met vaste regels op het apparaat zelf, toont bij elke waarde de bronregel, en meldt wat ontbreekt of tegenstrijdig is. Na uw bevestiging ontstaat een concept. |
| CSV / JSON | Onder **Import & back-up**: exporteer naar CSV, bewerk in een spreadsheet, importeer. Elke regel wordt gecontroleerd; bestaande aanbiedingen blijven staan. |

- Alleen een aanbod met status **Gecontroleerd** dat vandaag geldig is, kan aan een klant worden getoond. Een verlopen aanbod wordt nooit stilzwijgend gebruikt.
- Per aanbod legt u vast of de tarieven **inclusief btw** en **inclusief energiebelasting** zijn. Staat energiebelasting uit, dan telt de app die één keer op uit de jaartabel.
- **Belastingen & netbeheer** is een tabel per jaar (btw, energiebelasting, vermindering, netbeheer, wel/geen salderen). De bedragen zijn bewust leeg: neem ze over van de officiële bron. Zonder die bedragen vergelijkt de app de kosten bij de leverancier (netbeheer en vermindering zijn bij elke leverancier gelijk).
- Vanaf 2027 staat "geen salderen" ingesteld; aanpasbaar per jaar.
- Een opgeslagen vergelijking bewaart een eigen kopie van de tarieven en verandert niet als u de tarieven later aanpast.
- Er is geen veld voor een maandelijks termijnbedrag: de vergelijking gebruikt altijd jaarverbruik met tarieven, of het totaal van de jaarafrekening.
- Het meegeleverde aanbod is een **voorbeeld met verzonnen tarieven** en staat op Concept.

De rekenregels staan in `src/engine/essent.ts`, de plak- en importregels in `src/engine/essentImport.ts`.

## Zo werkt een advies (3 stappen)

1. **Huidige situatie** – maandbedrag, aanbieder, wel/geen tv, eventueel de einddatum van het contract.
2. **Nieuw pakket** – tik op een snelheid en een tv-pakket en kies de actie. Bellen, extra tv, sport/entertainment en Vodafone staan in uitklapbare secties. De prijs rechts rekent direct mee.
3. **Toon aan klant** – één rustig scherm met pakket, prijs nu, prijs daarna, contractduur en het verschil over 24 maanden. "Bekijk berekening" toont de volledige opbouw.

De klantpresentatie heeft twee schermen: **Uw aanbod** en **Overstappen zonder gedoe**, met Vorige/Volgende (geen automatische doorloop). Het tweede scherm volgt de korte checklist in stap 2. Beide staan standaard op **Ja**; zet ze alleen bij een uitzondering anders:

- *Overstapservice van toepassing?* Ja / Nee / Nog controleren — alleen bij **Ja** toont het scherm de beloften "Wij regelen uw overstap." en "Geen seconde zonder internet.", zonder kanttekening. Anders staat er "Wij helpen u met de stappen voor een soepele overstap" en dat de klant zelf opzegt.
- *Monteursafspraak wordt geregeld?* Ja / Nee / Bespreken — alleen bij **Ja** staat er "Alles professioneel geïnstalleerd."

De voorwaardenteksten en uw eigen geheugensteun voor de Overstapservice past u aan bij **Instellingen → Ziggo: overstappen en installatie**.

Is het nieuwe abonnement duurder, dan toont het aanbodscherm "Gemiddeld € x meer per maand" met direct daaronder het totaal over de periode, en de uitleg dat het een gemiddelde is. De actieprijs en de prijs daarna blijven ernaast staan.

24 maanden is overal de standaard. Een contract van 12 maanden, een tweede optie of volledig handmatige prijzen staan in stap 2 onder **Geavanceerd**.

## Productpresentatie

- **Snelheid**: na het kiezen van een snelheid verschijnt een meter met het exacte aantal Mbit/s en de inbegrepen wifi-versterkers (uit *Internet → Wifi-versterkers inbegrepen*). De meter is bewust niet-lineair en heeft geen getallen op de schaal; het is de abonnementssnelheid, geen meting.
- **Tv-pakketten**: kaarten met zenders en kenmerken uit *Internet + TV → omschrijving*. "Alles van TV Start" wordt automatisch doorgerekend; "Opnemen" verschijnt als "Programma’s opnemen".
- **Uitgebreid vergelijken** (stap 1, optioneel): huidige snelheid, wifi-versterkers, vaste telefonie, opnemen en zenders. Alleen wat is ingevuld wordt vergeleken; "Weet ik niet" telt nooit als nee of 0.
- **Wifi-opstelling**: op het scherm "Overstappen zonder gedoe" opent **Bekijk uw wifi-opstelling** een voorbeeldwoning met modem en versterkers. Alleen ter illustratie, geen dekkingsgarantie.

## Actie voor Internet + Vaste telefonie

In een actie (Mijn Salesacties → bewerken) staan vier categorieën: Alleen internet, Internet + TV, **Internet + Vaste telefonie** en Internet + TV + Vaste telefonie. Per categorie vult u de actieprijs per snelheid in en eventueel een eigen aantal actiemaanden. De app kiest automatisch de prijs die bij het gekozen pakket hoort; bij Internet + Vaste telefonie is het bedrag inclusief bellen (geen toeslag erbovenop). Vul ook de normale prijs in op het tabblad Alles-in-1, kolom "Internet + vaste telefonie": die geldt na de actie.

## Prijzen zelf bijwerken

Alles staat in **Prijzen & Aanbiedingen**; er is geen programmeerwerk nodig.

| Tabblad | Wat u er doet |
| --- | --- |
| Internet | prijs "alleen internet" per snelheid, aan/uit, eenmalige aansluitkosten. 4 en 8 Gbit staan klaar maar uit, zonder prijs. |
| Internet + TV | de officiële pakketprijzen als matrix (snelheid × tv-pakket) en de omschrijving van de tv-pakketten |
| Alles-in-1 | dezelfde matrix mét vast bellen, plus de kolom **Internet + vaste telefonie** (zonder tv): de normale prijs na een actie |
| Extra diensten | ontvangers, wifi-versterkers, sport, film, bundels, streaming; prijs en aan/uit direct in de lijst |
| Vodafone | referentiekorting per snelheid |
| Acties | openbare websiteacties (referentie) |
| Mijn Salesacties | uw eigen, toegestane deuracties met status Concept / Gecontroleerd / Verlopen. Hier staan de drie welkomstacties (12 maanden € 35, bol cadeaukaart € 450, Samsung-tv + soundbar); de klant kiest er precies één. |
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

### GitHub Pages en het basispad

De app staat onder `/ziggo-besparing/`. Dat is vastgelegd in `vite.config.ts` (`base: '/ziggo-besparing/'`) en mag niet worden gewijzigd zolang het adres hetzelfde blijft. Assets, manifest, service worker (scope `/ziggo-besparing/`) en afbeeldingen volgen dit pad; de app gebruikt hash-routes (`#/prijzen`), dus verversen of direct openen geeft geen 404. In code altijd `import.meta.env.BASE_URL` of `assetUrl()` gebruiken, nooit een pad dat met `/` begint.

### Cadeau-afbeeldingen

De meegeleverde afbeeldingen (`public/gifts/*.svg`) zijn **illustraties**, geen productfoto's: model en gebruiksrecht van echte productfoto's zijn niet bevestigd. Ze worden meegebundeld en werken offline. Een eigen foto uploadt u bij Prijzen & Aanbiedingen → Cadeaus; laadt een afbeelding niet, dan verschijnt een nette vervanger.

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

# Vorreni — Shopify storefront op Horizon

Herenmode: jassen, knitwear, broeken, basics. Gebouwd bovenop het Shopify
**Horizon** theme (versie 4.1.5), niet vanaf nul en niet op Dawn.

Alles wat voor Vorreni is toegevoegd draagt de prefix `vrn-`. **Geen enkel
`.liquid`-, `.js`- of `.css`-bestand van Horizon is gewijzigd.** Wat er wél aan
core is aangeraakt staat in [Core-bestanden](#core-bestanden), met de reden en
het script dat het na een Horizon-update herstelt.

---

## Inhoud

- [Aan de slag](#aan-de-slag)
- [Admin-setup](#admin-setup) — **dit moet je zelf doen**
  - [1. Kortingscodes](#1-kortingscodes)
  - [2. Metafields](#2-metafields)
  - [3. Collecties](#3-collecties)
  - [4. Menu's](#4-menus)
  - [5. Pagina's en beleid](#5-paginas-en-beleid)
  - [6. Afbeeldingen](#6-afbeeldingen)
- [Waar zit welke instelling](#waar-zit-welke-instelling)
- [De kortingsladder](#de-kortingsladder)
- [Designsysteem](#designsysteem)
- [Architectuur](#architectuur)
- [Core-bestanden](#core-bestanden)
- [Bestandenlijst](#bestandenlijst)
- [Nog te verifiëren](#nog-te-verifiëren)

---

## Aan de slag

```bash
shopify theme dev --store <jouw-store>.myshopify.com
node bin/vrn-merge.mjs          # controleert of de core-injecties nog staan
./bin/vrn-check.sh              # shopify theme check
python3 bin/vrn-build-templates.py   # genereert templates/*.json opnieuw
```

`bin/vrn-check.sh` gebruikt de Shopify CLI uit `$SHOPIFY_CLI` of uit de
lokale installatie. De verwachte uitkomst is **0 errors en 6 warnings**; die
zes zitten in `sections/header.liquid` en `snippets/divider.liquid` en komen
ongewijzigd uit Horizon zelf.

---

## Admin-setup

De storefront is af, maar hij heeft data nodig. Zonder onderstaande stappen
staan de kortingsladder, de pasvormbalk en de categorietegels leeg.

### 1. Kortingscodes

**Zonder deze codes doet de ladder niets.** De ladder past alleen codes toe die
al bestaan; hij maakt ze niet aan.

Maak in **Kortingen › Korting maken › Kortingscode › Korting op bestelbedrag**
vier codes aan:

| Code | Korting | Minimumvereisten | Gebruikslimiet |
|---|---|---|---|
| `BUNDEL10` | 10 % van totale bestelling | Minimumaantal artikelen: **2** | geen |
| `BUNDEL15` | 15 % van totale bestelling | Minimumaantal artikelen: **3** | geen |
| `BUNDEL20` | 20 % van totale bestelling | Minimumaantal artikelen: **4** | geen |
| `BUNDEL25` | 25 % van totale bestelling | Minimumaantal artikelen: **5** | geen |

Voor alle vier gelijk:

- **Van toepassing op:** Alle producten (of beperk tot de collecties die mee
  mogen doen in de ladder).
- **Klantberechtiging:** Alle klanten.
- **Combinaties:** vink **Verzendkortingen** aan. Laat *Productkortingen* en
  *Bestelkortingen* **uit** — anders kunnen twee BUNDEL-codes stapelen.
- **Actieve datums:** vandaag, geen einddatum.

> **Waarom een minimumaantal?** De oorspronkelijke opdracht zei "geen minimum".
> Zonder minimum is `BUNDEL25` een gewone 25%-code die iedereen met één artikel
> kan intypen. Het minimumaantal artikelen is geen minimumbedrag en verandert
> niets aan hoe de ladder werkt — het sluit alleen misbruik uit. Wil je het
> tóch zonder, laat de minimumvereisten dan leeg; de ladder werkt hetzelfde.

**Als een klant zelf een code invoert.** De ladder laat vreemde codes met rust:
bij elke wijziging leest hij de codes op de cart, haalt alleen de vier
BUNDEL-codes eruit, en stuurt de rest onveranderd mee terug. Een eigen code van
de klant blijft dus staan. Of hij ook écht korting geeft, bepaalt Shopify:
omdat de BUNDEL-codes niet combineerbaar zijn met andere bestel- of
productkortingen, wint bij een botsing de code die voor de klant het gunstigst
is en wordt de andere als niet-toepasbaar gemarkeerd. De cart toont altijd het
bedrag dat Shopify berekent, dus wat de klant ziet klopt met de checkout.

### 2. Metafields

**Instellingen › Aangepaste gegevens › Producten.** Allemaal optioneel: is een
metafield leeg, dan valt het theme terug op de tekst in het block.

| Naam | Namespace en sleutel | Type | Waarvoor |
|---|---|---|---|
| Pasvorm | `custom.size_fit` | Geheel getal, 1 t/m 5 | Positie van de indicator op de pasvormbalk. 1 = valt klein, 3 = valt normaal, 5 = valt groot. |
| Materiaal & onderhoud | `custom.material_care` | Rich text | Accordion op de productpagina. |
| Verzending | `custom.shipping` | Rich text | Accordion. Alleen vullen als dit product afwijkt. |
| Retourneren | `custom.returns` | Rich text | Accordion. Idem. |
| Maattabel | `custom.size_chart` | Rich text | Accordion én de modal achter "Maattabel". |

Zet bij elk metafield **Opslag toegang › Storefronts** aan, anders kan het
theme het niet lezen.

Vul in elk geval `custom.size_fit`. Zonder dat metafield staat elk product op
"Valt normaal" — dat is de terugval in het block, niet per se de waarheid.

### 3. Collecties

De homepage verwacht vier collecties in de categorietegels en een collectie met
uitgelichte producten.

1. Maak de collecties **Jassen**, **Knitwear**, **Broeken** aan, plus gebruik
   **Alle artikelen** (`all`) als vierde tegel.
2. Geef elke collectie een **collectie-afbeelding** — die vult de tegel.
3. In de theme-editor: **Homepage › Categorietegels › Collecties** en kies de
   vier. **Homepage › Uitgelicht › Collectie** en kies er één.

**Filters op de collectiepagina** komen uit Shopify's native
`collection.filters`. Stel ze in via de app **Search & Discovery** (gratis,
van Shopify) onder **Filters**. Zonder die app is er niets te filteren en toont
de balk alleen sorteren.

### 4. Menu's

**Inhoud › Menu's.** Het theme verwacht drie handles:

| Handle | Waar | Voorstel |
|---|---|---|
| `main-menu` | Header | Jassen · Knitwear · Broeken · Alles |
| `footer-shop` | Footer, kolom "Shop" | Jassen · Knitwear · Broeken · Nieuw · Sale |
| `footer-klantenservice` | Footer, kolom "Klantenservice" | Contact · Verzending · Retourneren · Maattabel · Veelgestelde vragen |

Bestaat een handle niet, dan blijft die kolom leeg zonder foutmelding.

### 5. Pagina's en beleid

- Maak een pagina **Over ons** met handle `over-ons` — de knop in het
  editorial-blok op de homepage linkt daarheen.
- Maak een pagina **Contact** met template `page.contact`.
- Vul bij **Instellingen › Beleid** het retour-, privacy-, verzend- en
  servicebeleid. De footer linkt ze automatisch via het `footer-policy-list`
  block; lege beleidsregels verschijnen niet.
- Vervang in de footer de regel `Vorreni B.V. · KvK 00000000 · BTW
  NL000000000B01` door de echte gegevens: **Footer › Betalen › laatste
  tekstblok**.

### 6. Afbeeldingen

De hero en het editorial-blok hebben nog geen beeld.

- **Homepage › Hero › media** — één campagnefoto, staand of vierkant, minimaal
  1600 px breed.
- **Homepage › Editorial › media** — één breed beeld.

Beide gebruiken Horizon's `image_url` met srcset en `loading="lazy"` buiten de
eerste viewport. Geef de bestanden een betekenisvolle naam; die wordt de alt-tekst
als je er geen invult.

### Accountpagina's

Horizon levert geen `templates/customers/*`: het theme draait op Shopify's
**nieuwe klantaccounts**, die Shopify zelf host en rendert. Je stelt het uiterlijk
in onder **Instellingen › Klantaccounts › Branding**, niet in dit theme. Er is hier
dus bewust niets toegevoegd; een eigen accountsjabloon zou niet gebruikt worden.

---

## Waar zit welke instelling

| Wat | Waar |
|---|---|
| Accentkleur | Theme settings › **Vorreni** › Accentkleur |
| Kortingstredes en codes | Theme settings › **Vorreni** › Kortingsladder |
| Ladder aan/uit, balk op collectie, ladder in drawer | Theme settings › **Vorreni** |
| Palet (Paper, Ink, Signal, Stone, Ash) | Theme settings › Kleuren › Kleurenpalet |
| Lettertypes en type-schaal | Theme settings › Typografie |
| Radius (staat overal op 0) | Theme settings › Knoppen, Invoervelden, Productkaarten, Badges |
| Cart als drawer | Theme settings › Winkelwagen › Type = Drawer |
| Quick add op kaarten | Theme settings › Productkaarten › Snel toevoegen |
| Tweede foto bij hover | Theme settings › Productkaarten |
| Sticky add-to-cart op mobiel | Productpagina › sectie **Productinformatie** › Sticky toevoegen aan winkelwagen |
| Pasvorm per product | Product › Metafields › `custom.size_fit` |
| Pasvorm-terugval | Productpagina › block **Vorreni pasvorm** › Standaardpositie |
| Naam van de maatoptie | Collectiepagina › productkaart › block **Vorreni matenstrip** |
| Teksten | `locales/nl.default.json` onder `vrn`, of `docs/vrn-locales.json` |

---

## De kortingsladder

### Tabel

| Artikelen | Korting | Code |
|---|---|---|
| 1 | 0 % | — |
| 2 | 10 % | `BUNDEL10` |
| 3 | 15 % | `BUNDEL15` |
| 4 | 20 % | `BUNDEL20` |
| 5 of meer | 25 % | `BUNDEL25` |

Aanpasbaar in Theme settings › Vorreni. Er zijn vijf tredes; een trede
uitzetten is hetzelfde als hem verwijderen. Een trede geldt altijd vanaf het
ingestelde aantal — de optie **Tonen als "5+"** verandert alleen de tekst.

### Waar hij staat

1. **Collectiepagina** — dunne balk met "Nog 1 artikel voor 15% korting" en een
   voortgangsbalk. Onderin vastgezet op mobiel, boven het grid op desktop.
   Alleen zichtbaar bij een gevulde winkelwagen.
2. **Cart drawer** — de volledige ladder met vierkante bullets, de actieve
   trede gemarkeerd en het bespaarde bedrag.
3. **Productpagina** — één regel onder de add-to-cart: `2 = 10% · 3 = 15% · 4 = 20% · 5+ = 25%`.
4. **Cartpagina** — dezelfde volledige ladder, onder de samenvatting.

### Hoe hij werkt

`assets/vrn-volume-discount.js`:

1. Luistert op `shopify:cart:lines-update` (`StandardEvents.cartLinesUpdate`) —
   het event dat Horizon's product form, quick add en cart items afvuren. Dat
   event komt binnen vóórdat de cart bij is, dus er wordt gewacht op
   `event.promise`.
2. Leest daarna de cart via `/cart.js` en bepaalt de trede uit `item_count`.
3. Is de juiste code al actief, dan gebeurt er niets meer.
4. Zo niet, dan gaat de nieuwe codelijst naar `Theme.routes.cart_update_url`
   (`/cart/update.js`) met de section-id's van de cart, exact zoals Horizon's
   eigen `assets/cart-discount.js` het doet. Daarna hertekent `morphSection`
   uit `@theme/section-renderer` die secties.
5. Er wordt een `CartDiscountUpdateEvent` afgevuurd zodat Horizon's
   `component-cart-items.js` weet dat de korting veranderd is.

Downgraden werkt net zo: minder artikelen betekent een lagere trede, en onder
de eerste trede gaat de code er helemaal af. Calls zijn gedebounced op 250 ms,
en elke fout wordt stil opgevangen — de cart kan hier nooit op blijven hangen.

Bij het laden van een pagina draait er één controle in idle time, voor het
geval de cart in een ander tabblad of een afgebroken checkout veranderd is.

**Geen `/discount/CODE`.** De oorspronkelijke opdracht noemde die route, maar
dat is een 302-redirect die de hele pagina herlaadt. `/cart/update.js` is wat
Horizon zelf gebruikt: same-origin JSON, en het geeft de cart én de gerenderde
secties in één antwoord terug.

**Nooit zelf rekenen.** Het bedrag dat de klant ziet komt altijd uit
`cart.total_discount` en `cart.cart_level_discount_applications` van Shopify,
zowel serverzijdig in Liquid als client-side na een wijziging.

### Geen Shopify Functions

Dit werkt op elk Shopify-plan, zonder app en zonder Plus. Een Functions
discount-extensie zou de codes overbodig maken en stapelen onmogelijk; die is
bewust niet gebouwd. Zeg het als je 'm alsnog wilt.

---

## Designsysteem

### Kleuren

| Naam | Hex | Rol | Contrast op wit |
|---|---|---|---|
| Paper | `#FFFFFF` | pagina | — |
| Ink | `#14100E` | tekst, primaire knop — warme off-black, bewust geen `#000` | 18,9:1 |
| Stone | `#F4F2EF` | vlakken | — |
| Ash | `#6B635B` | labels, meta, doorgestreepte prijs | 5,9:1 (AA) |
| Signal | `#A6402A` | de enige accentkleur | 6,2:1 (AA) |

Signal draagt de vierkante bullets, de actieve kortingstrede, de
voortgangsbalk, de pasvorm-indicator en de focus-ring. Verder is alles
neutraal.

### Typografie

Archivo voor koppen en labels, Inter voor tekst. Schaal: h1 56 / h2 32 / h3 24 /
h4 20 / h5 16 / h6 14 / tekst 16. h6 is de eyebrow: klein, uppercase, ruim
gespatieerd. Horizon maakt alles vanaf 48 px vanzelf fluid, dus h1 loopt van
36 px op mobiel naar 56 px op desktop.

### Regels die vastliggen

- **Radius 0** op de hele site, via elf theme settings.
- **Vierkante bullets** overal: 6 px in de accentkleur, via `.vrn-bullets` en
  `.vrn-rte ul`. Geen ronde dots, geen icoontjes.
- **Geen gradients.** Horizon's overlay-gradient is nergens aan. De hero is een
  split — foto links, tekst rechts — in plaats van tekst over een foto: over een
  onbekende campagnefoto is AA-contrast niet te garanderen, en de oplossing
  daarvoor zou juist die gradient zijn.
- **Geen slagschaduwen.** `card_hover_effect` staat op `none` en
  `popover_drop_shadow` uit.
- **Geen nep-urgentie.** Geen countdown, geen voorraadtellers. Vertrouwen komt
  uit de verzend-, retour- en maatinformatie.
- **Motion alleen als reactie op een handeling.** Drawer, accordion,
  variantwissel en de quick-add-dialoog bewegen. Uit staan:
  `page_transition_enabled`, `transition_to_main_product`,
  `add_to_cart_animation` (fly-to-cart) en de card-lift. Alles respecteert
  `prefers-reduced-motion`.

`assets/vrn-theme.css` is de enige eigen stylesheet en consumeert Horizon's
tokens (`--padding-*`, `--gap-*`, `--font-*`, `--color-*`, `--animation-*`,
`--minimum-touch-target`). Er is geen tweede spacing-systeem; `--vrn-*` bestaat
alleen voor merk-waarden die Horizon niet kent.

---

## Architectuur

### Horizon-onderdelen die hergebruikt worden

Galerij (`_product-media-gallery`, `media-gallery.js`, `zoom-dialog.js`),
variant picker, buy buttons en add-to-cart, sticky add-to-cart, accordions,
cart drawer (`theme-drawer`, `cart-drawer-component`), cart items en stepper,
cart summary inclusief kortingsweergave, kortingscode-invoer
(`cart-discount-component`), quick add, filters en sorteren (`facets.js`,
native `collection.filters`), predictive search, contactformulier, hero,
`product-list`, `collection-list`, `media-with-content`, footer, `email-signup`,
`payment-icons`, `menu`, `footer-policy-list`, `popup-link` voor de maattabel-modal.

### Events

Alle event-namen komen uit `@shopify/events`
(`https://cdn.shopify.com/storefront/standard-events.js`), dat Horizon in de
importmap in `snippets/scripts.liquid` zet. Niets is verzonnen:

| Constante | Event |
|---|---|
| `StandardEvents.cartLinesUpdate` | `shopify:cart:lines-update` |
| `StandardEvents.cartDiscountUpdate` | `shopify:cart:discount-update` |
| `StandardEvents.cartError` | `shopify:cart:error` |
| `DrawerOpenEvent.eventName` | `theme-drawer:open` |
| eigen, tussen de twee Vorreni-scripts | `vrn:ladder:update` |

Horizon's componenten zijn light DOM; shadow DOM gebruikt het alleen in
`overflow-list` en `header-menu`. Er wordt nergens door een shadow root heen
gequeryd.

### Drie dingen die niet konden zoals gevraagd

**De cart drawer accepteert geen blocks.** `sections/cart-drawer-section.liquid`
is één regel — `{% render 'cart-drawer' %}` — zonder schema-blocks, en de
drawer wordt vanuit `layout/theme.liquid` gerenderd. Er is geen slot. Daarom
zet `<vrn-ladder-host>` (sectie in de footer-groep, dus op elke pagina) zijn
paneel zelf in `.cart-drawer__summary` en plaatst het terug nadat Horizon de
sectie opnieuw heeft gerenderd. Dat is light DOM en één gedocumenteerde
class-naam. Breekt die in een Horizon-update, dan valt alleen de ladder in de
drawer weg; de codes blijven gewoon werken.

**`main-collection` accepteert ook geen blocks.** Geen `content_for 'blocks'`,
dus de kortingsbalk is een sectie (`vrn-ladder-bar`) in `templates/collection.json`.

**`_product-card` heeft een gesloten blocklijst zonder `@theme`.** Een eigen
matenstrip kon er niet in. Daarom:
- `blocks/vrn-product-card.liquid` — rendert dezelfde `snippets/product-card.liquid`
  als Horizon, met de matenstrip als extra toegestaan kindblock;
- `sections/vrn-collection-grid.liquid` — Horizon's `main-collection` met
  precies één regel anders: het kaarttype. Filters, paginering, infinite scroll
  en het grid komen onveranderd uit Horizon.

> **Let op bij een Horizon-update:** wijzigingen aan
> `sections/main-collection.liquid` komen niet vanzelf in
> `sections/vrn-collection-grid.liquid` terecht. Vergelijk die twee na elke
> update; het verschil hoort één regel te zijn.

### SEO

Horizon levert al Product JSON-LD (`sections/product-information.liquid`),
Organization (`sections/header.liquid`), Article (`sections/main-blog-post.liquid`)
en volledige Open Graph plus Twitter Cards (`snippets/meta-tags.liquid`).
Alleen **BreadcrumbList** ontbrak; dat zit in `blocks/vrn-breadcrumb.liquid`.
Verder is er niets toegevoegd, om dubbele structured data te voorkomen.

---

## Core-bestanden

Geen enkel `.liquid`-, `.js`- of `.css`-bestand van Horizon is gewijzigd. Wat
wel is aangeraakt zijn JSON-bestanden, en alleen waar Shopify geen alternatief
biedt:

| Bestand | Waarom | Herstel |
|---|---|---|
| `locales/nl.json` → `nl.default.json`, `en.default.json` → `en.json` | Shopify bepaalt de standaardtaal uit de bestandsnaam. Anders is Nederlands niet de hoofdtaal. | handmatig, eenmalig |
| `locales/*.json` (34 bestanden) | Theme-teksten kunnen alleen uit `locales/<iso>.json` komen; een apart Vorreni-bestand wordt genegeerd. De `vrn`-sleutel staat in alle locales omdat theme-check pariteit eist — Nederlands krijgt de Nederlandse teksten, de rest de Engelse. | `node bin/vrn-merge.mjs --write` |
| `config/settings_schema.json` | Theme settings kunnen nergens anders vandaan komen. Eén aangehangen groep **Vorreni**. | `node bin/vrn-merge.mjs --write` |
| `locales/nl.default.schema.json` | Zes Nederlandse sectienamen van Horizon zijn langer dan de 25 tekens die Shopify voor een schema-naam toestaat. Dat viel pas op toen Nederlands de standaardtaal werd. | `node bin/vrn-merge.mjs --write` |
| `config/settings_data.json` | Merchant-data, geen code. Hier staat de branding. | — |
| `sections/header-group.json`, `sections/footer-group.json` | Merchant-content: Nederlandse teksten, footerkolommen, en de ladderdrager. | — |
| `templates/*.json` | Merchant-content: de pagina-opbouw. | `python3 bin/vrn-build-templates.py` |

De bron van waarheid staat in `docs/vrn-locales.json`,
`docs/vrn-settings-group.json` en `docs/vrn-schema-overrides.json`.
`node bin/vrn-merge.mjs` zonder `--write` controleert en geeft exit 1 als er
iets ontbreekt — geschikt voor CI. Twee keer draaien verandert niets, en de
vertalerscommentaren in `locales/en.json` blijven staan omdat het script tekst
splitst in plaats van JSON herschrijft.

---

## Bestandenlijst

### Toegevoegd

```
assets/vrn-theme.css               enige eigen stylesheet
assets/vrn-volume-discount.js      kortingsmotor
assets/vrn-ladder.js               ladderweergave + portal naar de drawer
assets/vrn-size-strip.js           quick add met maatkeuze

blocks/vrn-ladder.liquid           volledige ladder
blocks/vrn-discount-line.liquid    kortingsregel onder add-to-cart
blocks/vrn-size-fit.liquid         pasvormbalk
blocks/vrn-size-strip.liquid       matenstrip op de kaart
blocks/vrn-product-card.liquid     kaart die de matenstrip accepteert
blocks/vrn-usp-list.liquid         USP-lijst
blocks/vrn-usp-item.liquid         losse USP
blocks/vrn-review.liquid           klantreview
blocks/vrn-breadcrumb.liquid       kruimelpad + BreadcrumbList
blocks/vrn-metafield-text.liquid   metafield met terugval

sections/vrn-collection-grid.liquid  collectieraster met eigen kaart
sections/vrn-ladder-bar.liquid       sticky kortingsbalk
sections/vrn-ladder-host.liquid      drager, staat in de footer-groep

snippets/vrn-styles.liquid         laadt stylesheet + merk-tokens
snippets/vrn-ladder-markup.liquid  ladder in drie varianten
snippets/vrn-ladder-tiers.liquid   ladder als JSON voor de JS

docs/vrn-locales.json              bron van waarheid voor teksten
docs/vrn-settings-group.json       bron van waarheid voor theme settings
docs/vrn-schema-overrides.json     ingekorte Nederlandse editor-labels

bin/vrn-merge.mjs                  injecteert de bovenstaande drie
bin/vrn-build-templates.py         genereert templates/*.json
bin/vrn-check.sh                   shopify theme check
```

### Gewijzigd

Alleen JSON, zie [Core-bestanden](#core-bestanden): `config/settings_data.json`,
`config/settings_schema.json`, 34 × `locales/*.json`,
`locales/nl.default.schema.json`, `sections/header-group.json`,
`sections/footer-group.json`, en `templates/` voor 404, cart, collection, index,
page.contact en product.

---

## Nog te verifiëren

Dit theme is statisch gevalideerd met `shopify theme check` (0 errors) en de
JavaScript is syntactisch gecontroleerd, maar er was in deze omgeving **geen
Shopify-store beschikbaar**. De volgende punten zijn dus nog niet tegen een
draaiende storefront gezien en moeten bij de eerste `shopify theme dev` langs:

1. **Lettertypes.** `archivo_n6`, `archivo_n5`, `inter_n4` en `inter_n5` zijn
   gekozen uit Shopify's fontbibliotheek. Staat Archivo er niet in, kies dan
   DM Sans in Theme settings › Typografie; de rest van het ontwerp verandert niet.
2. **Lighthouse mobiel, voor en na.** Niet gemeten — daar is een bereikbare URL
   voor nodig. Meet op de homepage, een collectiepagina en een productpagina.
   Wat er aan de kant van het theme voor gedaan is: geen nieuwe render-blocking
   assets, één extra stylesheet, drie modules met `type="module"` (dus uitgesteld),
   `aspect_ratio: adapt` op de galerij en vaste hoogtes op de ladderbalk tegen
   layout shift, en Horizon's eigen `image_url` met srcset overal.
3. **De ladder end-to-end:** 1 → 2 → 3 → 4 → 5 artikelen en weer terug, en of
   het kortingsbedrag in de cart gelijk is aan dat in de checkout.
4. **De matenstrip** op een product met twee opties (kleur én maat). De strip
   houdt de andere opties vast op de variant die de kaart toont; controleer of
   dat met jouw catalogusopzet het gewenste resultaat geeft.
5. **De portal naar de drawer** na een morph: artikel toevoegen, drawer openen,
   aantal wijzigen, en kijken of de ladder blijft staan.
6. **Toetsenbordnavigatie** door header, filters, productformulier en drawer.
7. **375 / 768 / 1440 px** en de console op errors en 404's.

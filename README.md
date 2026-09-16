# Vorreni — Shopify storefront op Horizon

Dit theme is **Shopify Horizon 4.1.5** met daarbovenop een eigen laag voor Vorreni. Geen enkel
bestand dat Horizon meelevert als code (Liquid, JS, CSS) is aangepast. Alles wat van Vorreni is,
heeft de prefix `vor-`. De configuratielaag (`templates/*.json`, `config/*.json`, `locales/*.json`,
`sections/*-group.json`) is wél ingericht — dat is de plek waar een winkel zijn eigen inrichting
neerzet, en zonder die bestanden bestaat er geen storefront.

- Basis: <https://github.com/Shopify/horizon> (tag/versie 4.1.5, zie `release-notes.md`)
- Hoofdtaal: Nederlands (`locales/nl.default.json`), Engels als tweede taal (`locales/en.json`)

---

## 1. Wat je in de admin moet doen

### 1.1 Kortingscodes voor de staffel (verplicht)

De staffelkorting werkt zonder app en zonder Shopify Plus: het theme zet automatisch de juiste
kortingscode op de winkelwagen. Die codes moeten bestaan, anders gebeurt er niets.

Maak in **Kortingen → Korting maken → Kortingscode → Bedrag korting op producten** vier codes aan:

| Code | Korting | Geldt voor | Minimumvereisten | Gebruikslimiet | Combineren |
|---|---|---|---|---|---|
| `BUNDEL10` | 10% | Alle producten | Geen | Geen limiet, niet "één per klant" | Alleen met **verzendkortingen** |
| `BUNDEL15` | 15% | Alle producten | Geen | Geen limiet, niet "één per klant" | Alleen met **verzendkortingen** |
| `BUNDEL20` | 20% | Alle producten | Geen | Geen limiet, niet "één per klant" | Alleen met **verzendkortingen** |
| `BUNDEL25` | 25% | Alle producten | Geen | Geen limiet, niet "één per klant" | Alleen met **verzendkortingen** |

Belangrijk bij het aanmaken:

- **Geen minimumaantal of minimumbedrag instellen.** Het theme bepaalt zelf welke trede geldt; een
  minimum in de code zou de korting alsnog weigeren en dan klopt wat de klant ziet niet meer.
- **Combineren:** vink *Verzendkortingen* aan, laat *Productkortingen* en *Bestellingskortingen*
  uit. Zo kan de staffel niet stapelen met een actiecode.
- **Actief vanaf** vandaag, geen einddatum.
- Laat de codes precies zo heten als hierboven, of pas de namen aan in
  **Thema-instellingen → Vorreni** (zie 1.6).

### 1.2 Wat er gebeurt als een klant zelf een code invoert

- Een eigen code van de klant (bijvoorbeeld `WELKOM10`) blijft staan. Het theme leest de codes die
  al op de winkelwagen staan, haalt daar alleen zijn eigen `BUNDEL*`-codes uit en zet de juiste
  terug. Andere codes worden nooit verwijderd.
- Omdat de `BUNDEL*`-codes op *niet combineerbaar met productkortingen* staan, kiest Shopify bij
  twee productkortingen zelf de gunstigste. De winkelwagen toont altijd `cart.total_discount`, dus
  wat de klant ziet is wat de checkout rekent — ook als Shopify de andere code laat vallen.
- Voert een klant handmatig `BUNDEL25` in terwijl hij één artikel heeft, dan corrigeert het theme
  dat bij de eerstvolgende wijziging van de winkelwagen terug naar de juiste trede.
- Gaat het toepassen van een code mis (netwerk, code verwijderd, code verlopen), dan gebeurt er
  niets zichtbaars: de winkelwagen blijft gewoon werken, alleen zonder staffelkorting.

### 1.3 Metafields

Maak in **Instellingen → Aangepaste gegevens → Producten** deze definities aan:

| Naam | Namespace en sleutel | Type | Gebruikt door |
|---|---|---|---|
| Pasvorm | `custom.size_fit` | Geheel getal, 1 t/m 5 | Blok *Vorreni pasvormschaal* op de productpagina. 1 = valt klein, 3 = valt normaal, 5 = valt groot. Leeg? Dan gebruikt het blok zijn eigen instelling (standaard 3). |
| Materiaal & onderhoud | `custom.material` | Rich text | Accordeon *Materiaal & onderhoud*. Leeg? Dan verschijnt de standaardtekst uit het template. |
| Maattabel | `custom.size_chart` | Rich text | Accordeon *Maattabel*. Leeg? Dan verwijst de tekst naar de maattabel bij de maatkeuze. |

De maattabel in de modal (naast de maatkeuze) staat als tekst in `templates/product.json` en is te
bewerken in de editor: **Productpagina → Maattabel → Tekst**.

### 1.4 Collecties en menu's

- Collecties: `jassen`, `knitwear`, `broeken` en een `alles`-collectie (of gebruik `/collections/all`).
- Menu **Hoofdmenu** (`main-menu`): Jassen, Knitwear, Broeken, Alles. Dit menu staat in de header
  en in de footerkolom *Shop*.
- Menu **Footer** (`footer`): Contact, Verzending, Retourneren, Maattabel, Over ons. Dit is de
  footerkolom *Klantenservice*.
- Homepage → sectie *Categorieën*: kies daar in de editor de 3–4 collecties voor de tegels.
- Homepage → sectie *Uitgelicht*: kies daar de collectie waaruit de 4 producten komen.

### 1.5 Pagina's en beleid

- Vul **Instellingen → Beleid** (privacy, retour, algemene voorwaarden, verzending). Die worden
  automatisch onderaan de footer gelinkt door het blok *Beleidspagina's*.
- Maak een pagina **Contact** met template `page.contact` — het formulier zit al in dat template.
- De KvK/BTW-regel staat in de footer: **Footer → Juridisch → Tekst**. Vul daar het echte
  KvK-nummer en BTW-nummer in (nu staan er nullen).

### 1.6 Waar welke instelling zit

| Wat | Waar |
|---|---|
| Kleuren (Inkt, Papier, Zand, Grafiet) | Thema-instellingen → Kleuren → Kleurenpalet |
| Accentkleur (Roest) | Thema-instellingen → **Vorreni** → Accentkleur |
| Staffeltreden (aantal, percentage, code) | Thema-instellingen → **Vorreni** → Trede 1 t/m 6. Zet een aantal op 0 om een trede uit te zetten, vul trede 5 of 6 om er een toe te voegen. |
| Codes automatisch toepassen aan/uit | Thema-instellingen → **Vorreni** → Kortingscode automatisch toepassen |
| Lettertypes en type-schaal | Thema-instellingen → Typografie |
| Hoekradius (staat overal op 0) | Thema-instellingen → Knoppen / Invoervelden / Badges / Variantkiezers |
| Winkelwagen als lade + automatisch openen | Thema-instellingen → Winkelwagen |
| Quick add op productkaarten | Thema-instellingen → Productkaarten |
| Sticky knop *In winkelwagen* op mobiel | Productpagina → sectie-instellingen → Vaste knop voor toevoegen aan winkelwagen |

---

## 2. De Vorreni-blokken

Allemaal te vinden in de blokkenkiezer onder de categorie **Vorreni**, versleepbaar en te
dupliceren:

| Blok | Bestand | Waar gebruikt |
|---|---|---|
| Vorreni USP-lijst (+ USP-regel) | `blocks/vor-usp-list.liquid`, `blocks/_vor-usp-item.liquid` | Homepage USP-balk, productpagina |
| Vorreni pasvormschaal | `blocks/vor-size-fit.liquid` | Productpagina, boven de maatkeuze |
| Vorreni staffelkorting | `blocks/vor-volume-ladder.liquid` | Winkelwagenpagina (en, via de runtime, de cart drawer) |
| Vorreni kortingsbalk | `blocks/vor-ladder-bar.liquid` | Collectiepagina, boven het grid / vast onderin op mobiel |
| Vorreni kortingsregel | `blocks/vor-ladder-line.liquid` | Productpagina, onder de knop |
| Vorreni review | `blocks/vor-review.liquid` | Homepage, drie stuks |
| Vorreni merkstijl | `blocks/vor-brand.liquid` | **Eén keer in de footer.** Laadt `vor-theme.css`, de staffelconfiguratie en de runtime. Verwijder dit blok niet: zonder dit blok worden er geen kortingscodes meer toegepast en verdwijnt de staffel uit de cart drawer. |

### 2.1 De matenstrip op de productkaart

Horizon's productkaart accepteert alleen zijn eigen bloktypes — een eigen theme block kan er niet
in. De enige officiële opening is het `custom-liquid`-blok, en daar staat de matenstrip in:

```liquid
{% render 'vor-card-size-add', option_name: 'Maat' %}
```

Te vinden in de editor onder **Collectie → Productkaart → Aangepaste Liquid**. Heet je maatoptie
anders (bijvoorbeeld `Size`), pas dan `option_name` aan. Producten met meer dan één optie, of
zonder die optie, tonen niets extra's en houden de gewone quick-add-knop van Horizon.

> `shopify theme check` meldt `OrphanedSnippet` voor `snippets/vor-card-size-add.liquid`. Dat klopt
> niet: de snippet wordt aangeroepen vanuit een `custom_liquid`-instelling in de JSON-templates, en
> daar kijkt de checker niet in. De waarschuwing is dus verwacht.

---

## 3. SEO

Horizon levert zelf al Organization (header), Product en Article structured data, plus volledige
Open Graph- en Twitter-tags in `snippets/meta-tags.liquid`. Dubbelop doen we dus niet. Wat ontbrak
is **BreadcrumbList**: die zit in `snippets/vor-breadcrumb-jsonld.liquid` en wordt één keer vanuit
het merkstijl-blok gerenderd, op product- en collectiepagina's.

Titel en meta-omschrijving per pagina regel je in de admin (product, collectie, pagina → sectie
*Vermelding in zoekmachines*).

## 4. Tests

```sh
gem install liquid                   # eenmalig
ruby tests/ladder_liquid_test.rb     # staffel-rekenwerk (sortering, treden, resterend aantal)
ruby tests/blocks_render_test.rb     # rendert elk vor-blok en controleert de uitvoer
node tests/volume_discount_test.mjs  # kortingscode-logica van de runtime
```

Zie `tests/README.md` voor wat er gestubd wordt en waarom. De map gaat niet mee bij
`shopify theme push`.

## 5. Ontwikkelen

```sh
shopify theme dev --store aedison.nl   # lokale preview
shopify theme check                    # linten
shopify theme push --unpublished       # als los thema in de admin zetten
```

Horizon bijwerken: haal de nieuwe versie uit de upstream repo en merge die over deze branch heen.
Omdat alleen JSON-configuratie en `vor-`-bestanden van ons zijn, blijven conflicten beperkt tot
`config/settings_schema.json` (onze groep staat achteraan) en `locales/*.json` (onze `vor`-sleutel
staat achteraan).

## 6. Meten

Lighthouse-meting (mobiel) draai je tegen de preview-URL:

```sh
npx lighthouse https://<preview-url> --preset=desktop --form-factor=mobile \
  --screenEmulation.mobile --only-categories=performance,accessibility,seo --view
```

Meet vóór (kale Horizon) en ná (dit thema) op dezelfde URL-structuur: homepage, een collectie en
een productpagina.

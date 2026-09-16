/**
 * Vorreni — volumekorting.
 *
 * Houdt de kortingscode in de cart gelijk aan het aantal artikelen. Geen app,
 * geen Shopify Functions: gewone kortingscodes die de merchant zelf aanmaakt.
 *
 * Integratie met Horizon:
 *   - luistert op `StandardEvents.cartLinesUpdate` (`shopify:cart:lines-update`),
 *     het event dat Horizon's product-form, quick-add en cart-items afvuren;
 *   - past codes toe via `Theme.routes.cart_update_url` met een `discount`-lijst,
 *     precies zoals Horizon's eigen `cart-discount.js` dat doet — niet via
 *     /discount/CODE, want dat is een redirect die de pagina herlaadt;
 *   - hertekent de cart-secties met `morphSection` uit `@theme/section-renderer`;
 *   - kondigt de wijziging aan met `CartDiscountUpdateEvent`, zodat Horizon's
 *     `component-cart-items.js` meekrijgt dat de korting veranderd is.
 *
 * Het bedrag dat de klant ziet komt altijd uit `cart.total_discount` van
 * Shopify. Er wordt nooit zelf een korting uitgerekend.
 */

import { StandardEvents, CartDiscountUpdateEvent } from '@shopify/events';
import { morphSection } from '@theme/section-renderer';
import { fetchConfig, debounce, requestIdleCallback } from '@theme/utilities';

/** @typedef {{ qty: number, percent: number, code: string, plus: boolean }} Tier */

const CONFIG_ID = 'vrn-ladder-config';
const UPDATE_EVENT = 'vrn:ladder:update';
const DEBOUNCE_MS = 250;

/** @type {{ tiers: Tier[], moneyFormat: string, cartUrl: string, labels: Record<string, string> } | null} */
let config = null;

/** Voorkomt dat twee wijzigingen door elkaar heen lopen. */
let inFlight = null;

/**
 * Leest de ladderconfiguratie die `snippets/vrn-ladder-tiers.liquid` als JSON
 * in de pagina zet. Eén keer per pagina; het resultaat wordt gecachet.
 */
export function getConfig() {
  if (config) return config;

  const node = document.getElementById(CONFIG_ID);
  if (!node?.textContent) return null;

  try {
    const parsed = JSON.parse(node.textContent);
    // Oplopend op aantal, zodat de hoogst passende trede vooraan te vinden is.
    parsed.tiers = (parsed.tiers ?? []).filter((t) => t.code).sort((a, b) => a.qty - b.qty);
    config = parsed;
    return config;
  } catch {
    return null;
  }
}

/**
 * De trede die bij dit aantal artikelen hoort: de hoogste drempel die gehaald
 * is. `plus` verandert alleen de tekst ("5+"), niet de vergelijking.
 *
 * @param {Tier[]} tiers - Oplopend gesorteerd.
 * @param {number} count
 * @returns {Tier | null}
 */
export function resolveTier(tiers, count) {
  let match = null;
  for (const tier of tiers) {
    if (count >= tier.qty) match = tier;
  }
  return match;
}

/** De eerstvolgende trede boven dit aantal, voor "nog N artikelen". */
export function nextTier(tiers, count) {
  return tiers.find((tier) => tier.qty > count) ?? null;
}

const upper = (value) => String(value ?? '').toUpperCase();

/** De secties die de cart tonen en dus opnieuw gerenderd moeten worden. */
function cartSectionIds() {
  /** @type {{ id: string, mode: 'hydration' | 'full' }[]} */
  const sections = [];

  if (document.getElementById('shopify-section-cart-drawer-section')) {
    sections.push({ id: 'cart-drawer-section', mode: 'hydration' });
  }

  const pageSection = document.querySelector('.cart-page')?.closest('.shopify-section');
  if (pageSection?.id) {
    sections.push({ id: pageSection.id.replace('shopify-section-', ''), mode: 'full' });
  }

  return sections;
}

/** Haalt de cart op via de AJAX API. */
async function readCart() {
  const response = await fetch(`${Theme.routes.cart_url}.js`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Cart lezen mislukte: ${response.status}`);
  return response.json();
}

/**
 * Zet de kortingscodes op de cart. `discount` vervangt de hele set, dus codes
 * die de klant zelf heeft ingevoerd worden expliciet meegestuurd om ze niet
 * weg te gooien.
 *
 * @param {string[]} codes
 * @param {{ id: string, mode: 'hydration' | 'full' }[]} sections
 */
async function writeDiscounts(codes, sections) {
  const deferred = CartDiscountUpdateEvent.createPromise();

  document.dispatchEvent(
    new CartDiscountUpdateEvent({
      discountCodes: codes.map((code) => ({ code })),
      promise: deferred.promise,
    })
  );

  try {
    const response = await fetch(Theme.routes.cart_update_url, {
      ...fetchConfig('json', {
        body: JSON.stringify({
          discount: codes.join(','),
          sections: sections.map((section) => section.id),
        }),
      }),
    });

    if (!response.ok) throw new Error(`Korting toepassen mislukte: ${response.status}`);

    const data = await response.json();
    deferred.resolve({ cart: CartDiscountUpdateEvent.createCartFromAjaxResponse(data) });

    for (const section of sections) {
      const html = data.sections?.[section.id];
      if (html) morphSection(section.id, html, { mode: section.mode });
    }

    return data;
  } catch (error) {
    deferred.reject(error);
    throw error;
  }
}

/**
 * Brengt de kortingscode in lijn met het aantal artikelen en laat de ladder
 * het resultaat tekenen.
 *
 * Downgradet net zo goed als upgradet: minder artikelen betekent een lagere
 * trede, en onder de eerste trede gaat de code er helemaal af.
 */
async function sync() {
  const settings = getConfig();
  if (!settings || settings.tiers.length === 0) return;

  try {
    let cart = await readCart();

    const ladderCodes = new Set(settings.tiers.map((tier) => upper(tier.code)));
    const applied = (cart.discount_codes ?? []).map((discount) => discount.code);

    const ours = applied.filter((code) => ladderCodes.has(upper(code)));
    const theirs = applied.filter((code) => !ladderCodes.has(upper(code)));

    const target = resolveTier(settings.tiers, cart.item_count);
    const wanted = target ? [target.code] : [];

    const unchanged =
      ours.length === wanted.length && ours.every((code, index) => upper(code) === upper(wanted[index]));

    if (!unchanged) {
      const sections = cartSectionIds();
      cart = await writeDiscounts([...theirs, ...wanted], sections);
    }

    publish(cart);
  } catch (error) {
    // De cart mag hier nooit op vastlopen. Stil falen, ladder laten staan.
    console.debug('[vrn-volume-discount]', error);
  }
}

/** Vertelt de ladder wat de nieuwe staat is. */
function publish(cart) {
  const settings = getConfig();
  if (!settings) return;

  const count = cart.item_count ?? 0;

  document.dispatchEvent(
    new CustomEvent(UPDATE_EVENT, {
      detail: {
        itemCount: count,
        totalDiscount: cart.total_discount ?? 0,
        active: resolveTier(settings.tiers, count),
        next: nextTier(settings.tiers, count),
        config: settings,
      },
    })
  );
}

const scheduleSync = debounce(sync, DEBOUNCE_MS);

/**
 * Horizon vuurt `cartLinesUpdate` af zodra de wijziging begint, niet als hij
 * klaar is. De promise van het event vertelt wanneer de cart echt bij is; pas
 * daarna heeft het zin om de korting opnieuw te bepalen.
 */
document.addEventListener(StandardEvents.cartLinesUpdate, (event) => {
  const done = event.promise ?? Promise.resolve();
  done.then(scheduleSync).catch(() => scheduleSync());
});

// Eén keer bij het laden, voor het geval de cart in een ander tabblad of een
// afgebroken checkout veranderd is en de code niet meer klopt.
if (document.getElementById(CONFIG_ID)) {
  requestIdleCallback(() => scheduleSync());
}

export { UPDATE_EVENT };

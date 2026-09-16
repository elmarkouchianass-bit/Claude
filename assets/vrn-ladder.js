/**
 * Vorreni — kortingsladder, weergave.
 *
 * Twee taken:
 *
 *  1. Elke `[data-vrn-ladder]` in de pagina bijwerken zodra
 *     `vrn-volume-discount.js` een nieuwe cart-staat publiceert. De
 *     serverzijdige markup uit `snippets/vrn-ladder-markup.liquid` is de
 *     startstaat; hier worden alleen tekst, `data-state` en de balkbreedte
 *     bijgesteld. Het bedrag komt uit Shopify's `cart.total_discount`.
 *
 *  2. De ladder in Horizon's cart drawer plaatsen. De drawer wordt vanuit
 *     `layout/theme.liquid` als snippet gerenderd en accepteert geen theme
 *     blocks, dus er is geen slot om in te hangen. `<vrn-ladder-host>` zet
 *     zijn eigen node daarom in `.cart-drawer__summary` en zet hem daar
 *     terug nadat Horizon de sectie opnieuw heeft gerenderd.
 *
 *     Dat is light DOM — Horizon's drawer gebruikt geen shadow root — dus er
 *     wordt niets doorbroken. De afhankelijkheid is één gedocumenteerde
 *     class uit `snippets/cart-drawer.liquid`; breekt die in een update, dan
 *     valt alleen de ladder in de drawer weg en blijft de rest werken.
 */

import { Component } from '@theme/component';
import { DrawerOpenEvent } from '@theme/theme-drawer';
import { formatMoney } from '@theme/money-formatting';
import { debounce } from '@theme/utilities';

/**
 * Het event dat `vrn-volume-discount.js` afvuurt als de cart-staat bekend is.
 * Bewust een letterlijke string en geen import: Horizon's importmap staat in
 * `snippets/scripts.liquid` en dat is een core-bestand, dus daar kan geen
 * `@theme/vrn-*` aan toegevoegd worden. Houd deze waarde gelijk aan
 * UPDATE_EVENT in assets/vrn-volume-discount.js.
 */
const UPDATE_EVENT = 'vrn:ladder:update';

const DRAWER_SELECTOR = '#cart-drawer';
const DRAWER_TARGET = '.cart-drawer__summary';

/**
 * Sommige winkels zetten HTML in hun money_format. De ladder schrijft met
 * textContent, dus die tags moeten eruit voordat de klant ze letterlijk ziet.
 */
const plain = (value) => String(value).replace(/<[^>]*>/g, '').trim();

/** Vervangt [placeholder] in een locale-string. */
const fill = (template, values) =>
  Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`[${key}]`, String(value)), template ?? '');

/**
 * Werkt één ladder-node bij.
 * @param {Element} root
 * @param {{ itemCount: number, totalDiscount: number, active: object|null, next: object|null, config: object }} detail
 */
export function render(root, detail) {
  const { itemCount, totalDiscount, active, next, config } = detail;
  const labels = config.labels ?? {};

  if (root.dataset.vrnLadderVariant === 'progress') {
    const message = root.querySelector('[data-vrn-ladder-message]');
    const bar = root.querySelector('[data-vrn-ladder-bar]');
    const track = root.querySelector('[data-vrn-ladder-progressbar]');

    if (message) {
      if (next) {
        const remaining = next.qty - itemCount;
        const template = remaining === 1 ? labels.progressOne : labels.progressOther;
        message.textContent = fill(template, { count: remaining, percent: next.percent });
      } else if (active) {
        message.textContent = fill(labels.maxReached, { percent: active.percent });
      } else {
        message.textContent = '';
      }
    }

    // Voortgang binnen de huidige trede, zodat de balk niet elke keer
    // vanaf nul begint.
    const floor = active?.qty ?? 0;
    const ceiling = next?.qty ?? floor;
    const span = ceiling - floor;
    const ratio = span > 0 ? Math.min(1, Math.max(0, (itemCount - floor) / span)) : 1;

    if (bar) bar.style.setProperty('--vrn-progress', String(ratio));
    if (track) track.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    return;
  }

  for (const tier of root.querySelectorAll('[data-vrn-tier-qty]')) {
    const qty = Number(tier.getAttribute('data-vrn-tier-qty'));
    const isActive = active != null && active.qty === qty;
    const state = isActive ? 'active' : itemCount >= qty && qty > 0 && active != null ? 'reached' : 'upcoming';

    tier.dataset.state = state;
    const badge = tier.querySelector('[data-vrn-tier-badge]');
    if (badge) badge.textContent = isActive ? (labels.active ?? '') : '';
  }

  const saved = root.querySelector('[data-vrn-ladder-saved]');
  if (saved) {
    const show = totalDiscount > 0;
    saved.toggleAttribute('hidden', !show);
    if (show) {
      const amount = plain(formatMoney(totalDiscount, config.moneyFormat, Shopify.currency?.active ?? 'EUR'));
      saved.textContent = fill(labels.saved, { amount });
    }
  }
}

/** Werkt alles bij wat op de pagina staat, inclusief de geportaleerde node. */
function renderAll(detail) {
  for (const root of document.querySelectorAll('[data-vrn-ladder]')) {
    render(root, detail);
  }

  // De collectiebalk heeft geen betekenis bij een lege cart.
  for (const bar of document.querySelectorAll('[data-vrn-ladder-bar-wrapper]')) {
    bar.toggleAttribute('hidden', detail.itemCount === 0);
  }
}

document.addEventListener(UPDATE_EVENT, (event) => renderAll(event.detail));

/**
 * Houdt de ladder in de cart drawer. Staat zelf buiten beeld; de node die hij
 * beheert verhuist naar de drawer.
 */
class VrnLadderHost extends Component {
  /** @type {MutationObserver | null} */
  #observer = null;

  get #panel() {
    return this.querySelector('[data-vrn-ladder-panel]');
  }

  connectedCallback() {
    super.connectedCallback();

    this.#mount();

    document.addEventListener(DrawerOpenEvent.eventName, this.#mount);
    document.addEventListener(UPDATE_EVENT, this.#mount);

    const drawer = document.querySelector(DRAWER_SELECTOR);
    if (drawer) {
      // Horizon vervangt de inhoud van de drawer via morphSection. Daarna moet
      // de ladder terug. Gedebounced zodat één morph niet tientallen keren
      // langskomt; opnieuw plaatsen is een no-op als hij er al staat, dus de
      // observer kan zichzelf niet aanjagen.
      this.#observer = new MutationObserver(debounce(this.#mount, 50));
      this.#observer.observe(drawer, { childList: true, subtree: true });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener(DrawerOpenEvent.eventName, this.#mount);
    document.removeEventListener(UPDATE_EVENT, this.#mount);
    this.#observer?.disconnect();
    this.#observer = null;
  }

  #mount = () => {
    const panel = this.#panel;
    if (!panel) return;

    const target = document.querySelector(`${DRAWER_SELECTOR} ${DRAWER_TARGET}`);
    if (!target || target.contains(panel)) return;

    target.prepend(panel);
  };
}

if (!customElements.get('vrn-ladder-host')) {
  customElements.define('vrn-ladder-host', VrnLadderHost);
}

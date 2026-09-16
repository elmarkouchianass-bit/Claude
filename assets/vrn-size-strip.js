/**
 * Vorreni — maatkeuze op de productkaart.
 *
 * Eén tik legt de variant in de cart. Het toevoegen zelf gaat precies zoals
 * Horizon's `product-form.js` het doet: een `CartLinesUpdateEvent` met
 * `action: 'add'`, dan POST naar `Theme.routes.cart_add_url` met de section
 * id's van alle `cart-items-component`s, en dan de deferred promise resolven
 * met de verse cart plus die secties.
 *
 * Daardoor doet de rest van het theme uit zichzelf de rest: Horizon's
 * `cart-items-component` hertekent de cart, `cart-drawer.js` schuift de drawer
 * open, `cart-icon.js` en `header-actions.js` werken het aantal bij, en
 * `vrn-volume-discount.js` bepaalt de kortingstrede. Er wordt niets van
 * Horizon overgeschreven en niets uit de DOM van een bestaande component
 * getrokken.
 */

import { Component } from '@theme/component';
import { CartLinesUpdateEvent, CartErrorEvent } from '@shopify/events';

const STATUS_RESET_MS = 2000;

/** De secties die de cart tonen, zodat Shopify ze meteen meerendert. */
function cartSectionIds() {
  return [...document.querySelectorAll('cart-items-component')]
    .map((node) => node.dataset.sectionId)
    .filter(Boolean);
}

/** Haalt de cart opnieuw op, langs Horizon's eigen component als die er is. */
async function refreshCart() {
  const cartItems = document.querySelector('cart-items-component');

  if (cartItems) {
    await customElements.whenDefined('cart-items-component');
    return cartItems.fetchCartData();
  }

  const response = await fetch(`${Theme.routes.cart_url}.js`, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  });
  return response.json();
}

class VrnSizeStrip extends Component {
  #timer = 0;
  #busy = false;

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('click', this.#handleClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('click', this.#handleClick);
    clearTimeout(this.#timer);
  }

  get #status() {
    return this.querySelector('[data-vrn-size-strip-status]');
  }

  /** @param {string} text @param {'busy'|'done'|'error'} state */
  #say(text, state) {
    const status = this.#status;
    if (!status) return;

    status.textContent = text;
    status.dataset.state = state;

    clearTimeout(this.#timer);
    if (state !== 'busy') {
      this.#timer = window.setTimeout(() => {
        status.textContent = '';
        delete status.dataset.state;
      }, STATUS_RESET_MS);
    }
  }

  /** @param {MouseEvent} event */
  #handleClick = (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-variant-id]') : null;
    if (!(button instanceof HTMLButtonElement) || button.disabled || this.#busy) return;

    event.preventDefault();
    this.#add(button);
  };

  /** @param {HTMLButtonElement} button */
  async #add(button) {
    const variantId = button.dataset.variantId;
    if (!variantId) return;

    this.#busy = true;
    for (const option of this.querySelectorAll('[data-variant-id]')) {
      option.setAttribute('aria-pressed', String(option === button));
    }
    this.#say(this.dataset.labelAdding ?? '', 'busy');

    const sections = cartSectionIds();
    const deferred = CartLinesUpdateEvent.createPromise();

    this.dispatchEvent(
      new CartLinesUpdateEvent({
        action: 'add',
        context: 'product',
        lines: [{ merchandiseId: variantId, quantity: 1 }],
        promise: deferred.promise,
      })
    );

    try {
      const response = await fetch(Theme.routes.cart_add_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          items: [{ id: Number(variantId), quantity: 1 }],
          sections: sections.join(','),
        }),
      });

      const result = await response.json();

      // De cart-API geeft bij een afwijzing een `status` mee, ook met HTTP 200.
      if (result.status) {
        const cart = await refreshCart();
        deferred.resolve({
          cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
          detail: { didError: true, source: 'vrn-size-strip', sourceId: this.dataset.productId },
        });

        this.dispatchEvent(
          new CartErrorEvent({
            error: result.message || 'Add to cart failed',
            code: 'INVALID',
            detail: { description: result.description, errors: result.errors },
          })
        );

        this.#say(result.description || this.dataset.labelError || '', 'error');
        return;
      }

      const cart = await refreshCart();
      deferred.resolve({
        cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
        detail: {
          items: cart.items,
          source: 'vrn-size-strip',
          sourceId: this.dataset.productId,
          itemCount: 1,
          sections: result.sections,
          didError: false,
        },
      });

      this.#say(this.dataset.labelAdded ?? '', 'done');
    } catch (error) {
      deferred.reject(error);
      this.dispatchEvent(
        new CartErrorEvent({
          error: error?.message || 'Network error during add to cart',
          code: 'SERVICE_UNAVAILABLE',
        })
      );
      this.#say(this.dataset.labelError ?? '', 'error');
    } finally {
      this.#busy = false;
      for (const option of this.querySelectorAll('[data-variant-id]')) {
        option.setAttribute('aria-pressed', 'false');
      }
    }
  }
}

if (!customElements.get('vrn-size-strip')) {
  customElements.define('vrn-size-strip', VrnSizeStrip);
}

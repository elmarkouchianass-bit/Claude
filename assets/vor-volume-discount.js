import { StandardEvents } from '@shopify/events';
import { morphSection } from '@theme/section-renderer';
import { fetchConfig, debounce } from '@theme/utilities';
import { formatMoney } from '@theme/money-formatting';

/**
 * Vorreni volume discount runtime.
 *
 * Keeps the right bundle discount code on the cart and keeps the ladder UI in sync.
 *
 * Horizon dispatches Shopify's standard cart events, so this listens to
 * `shopify:cart:lines-update` (StandardEvents.cartLinesUpdate) and reads the resulting cart
 * from `event.promise` - the event fires before the mutation settles. Applying a code goes
 * through the same route Horizon's own `cart-discount.js` uses: a POST to
 * `routes.cart_update_url` with `discount` and `sections`, followed by `morphSection`.
 *
 * Failures stay silent on purpose: a discount that cannot be applied must never block the cart.
 */

/**
 * @typedef {object} LadderTier
 * @property {number} qty
 * @property {number} percent
 * @property {string} code
 * @property {string} label
 * @property {string} labelShort
 * @property {boolean} isLast
 * @property {string} maxReached
 * @property {Record<string, string>} progress
 */

const CONFIG_ID = 'vor-ladder-config';
const DEBOUNCE_MS = 250;

/** @returns {any | null} */
function readConfig() {
  const element = document.getElementById(CONFIG_ID);
  if (!element?.textContent) return null;

  try {
    return JSON.parse(element.textContent);
  } catch {
    return null;
  }
}

/**
 * The tier that applies to an item count, and the one after it.
 *
 * @param {LadderTier[]} tiers - The tiers, ascending on quantity.
 * @param {number} itemCount - The number of items in the cart.
 * @returns {{ active: LadderTier | null, next: LadderTier | null }}
 */
export function resolveTierState(tiers, itemCount) {
  let active = null;
  let next = null;

  for (const tier of tiers) {
    if (itemCount >= tier.qty) {
      active = tier;
    } else if (!next) {
      next = tier;
    }
  }

  return { active, next };
}

/**
 * The discount codes the cart should end up with. Codes the shopper entered themselves are kept;
 * only the ladder's own codes are swapped.
 *
 * @param {{ code: string }[]} currentCodes - The codes currently on the cart.
 * @param {string | null} targetCode - The code for the tier that applies now.
 * @param {Set<string>} managedCodes - Every code the ladder owns.
 * @returns {string[] | null} The codes to send, or null when the cart already has the right set.
 */
export function resolveDesiredCodes(currentCodes, targetCode, managedCodes) {
  const current = currentCodes.map(({ code }) => code).filter(Boolean);
  const kept = current.filter((code) => !managedCodes.has(code));
  const desired = targetCode ? [...kept, targetCode] : kept;

  const same = desired.length === current.length && desired.every((code) => current.includes(code));

  return same ? null : desired;
}

const config = readConfig();

if (config?.enabled && Array.isArray(config.tiers) && config.tiers.length > 0) {
  start(config);
}

/** @param {any} config */
function start(config) {
  /** @type {LadderTier[]} */
  const tiers = config.tiers;
  const managedCodes = new Set(tiers.map((tier) => tier.code).filter(Boolean));

  const state = {
    itemCount: Number(config.cart?.itemCount) || 0,
    totalDiscount: Number(config.cart?.totalDiscount) || 0,
  };

  const resolveTiers = (itemCount) => resolveTierState(tiers, itemCount);

  /* -------------------------------------------------- rendering */

  /** @param {Element} root */
  function renderLadder(root) {
    const { active } = resolveTiers(state.itemCount);
    const tierNodes = root.querySelectorAll('[data-vor-tier]');

    tierNodes.forEach((node) => {
      const qty = Number(node.getAttribute('data-vor-tier-qty'));
      const isActive = Boolean(active) && qty === active.qty;

      node.classList.toggle('vor-ladder__tier--active', isActive);
      if (isActive) {
        node.setAttribute('aria-current', 'true');
      } else {
        node.removeAttribute('aria-current');
      }

      const stateNode = node.querySelector('.vor-ladder__tier-state');
      if (isActive && !stateNode) {
        const badge = document.createElement('span');
        badge.className = 'vor-ladder__tier-state';
        badge.textContent = config.strings.active;
        node.append(badge);
      } else if (!isActive && stateNode) {
        stateNode.remove();
      }
    });

    const savedNode = root.querySelector('[data-vor-saved]');
    if (savedNode instanceof HTMLElement) {
      if (state.totalDiscount > 0) {
        const amount = formatMoney(state.totalDiscount, config.moneyFormat, config.currency);
        savedNode.textContent = config.strings.saved.replace('__VOR_AMOUNT__', amount);
        savedNode.hidden = false;
      } else {
        savedNode.textContent = '';
        savedNode.hidden = true;
      }
    }
  }

  /** @param {Element} bar */
  function renderBar(bar) {
    const { active, next } = resolveTiers(state.itemCount);
    const message = bar.querySelector('[data-vor-bar-message]');
    const track = bar.querySelector('[data-vor-bar-track]');

    if (!(bar instanceof HTMLElement)) return;

    bar.hidden = state.itemCount === 0;

    let text = '';
    let progress = 0;

    if (next) {
      const remaining = next.qty - state.itemCount;
      text = next.progress?.[String(remaining)] ?? '';
      progress = Math.round((state.itemCount / next.qty) * 100);
    } else if (active) {
      text = active.maxReached;
      progress = 100;
    }

    if (message) message.textContent = text;

    if (track instanceof HTMLElement) {
      track.setAttribute('aria-valuenow', String(progress));
      const fill = track.querySelector('.vor-ladder-bar__fill');
      if (fill instanceof HTMLElement) fill.style.setProperty('--vor-progress', `${progress}%`);
    }
  }

  function render() {
    document.querySelectorAll('[data-vor-ladder]').forEach(renderLadder);
    document.querySelectorAll('vor-ladder-bar').forEach(renderBar);
  }

  /* -------------------------------------------------- cart drawer mount */

  /**
   * Horizon's cart drawer has no block slot, so the ladder is mounted into it from here. The
   * only anchors used are the public custom element names `cart-drawer-component` and
   * `cart-items-component` - never Horizon's internal classes or refs. Every cart render
   * replaces the drawer markup, so the mount is re-checked on each update.
   */
  function mountDrawerLadder() {
    const drawer = document.querySelector('cart-drawer-component');
    if (!drawer) return;

    const items = drawer.querySelector('cart-items-component');
    if (!items) return;

    const existing = drawer.querySelector('[data-vor-ladder-drawer]');
    if (existing) {
      if (existing.previousElementSibling !== null || existing.parentElement !== items.parentElement) {
        // Keep the ladder directly above the items after a re-render.
        items.parentElement?.insertBefore(existing, items);
      }
      renderLadder(existing);
      return;
    }

    const ladder = buildLadderElement();
    items.parentElement?.insertBefore(ladder, items);
    renderLadder(ladder);
  }

  /** @returns {HTMLElement} */
  function buildLadderElement() {
    const wrapper = document.createElement('div');
    wrapper.className = 'vor-ladder vor-ladder--drawer';
    wrapper.setAttribute('data-vor-ladder', '');
    wrapper.setAttribute('data-vor-ladder-drawer', '');

    const heading = document.createElement('p');
    heading.className = 'vor-ladder__heading';
    heading.textContent = config.strings.heading;
    wrapper.append(heading);

    const list = document.createElement('ul');
    list.className = 'vor-list vor-ladder__tiers';
    list.setAttribute('role', 'list');

    tiers.forEach((tier, index) => {
      const item = document.createElement('li');
      item.className = 'vor-list__item vor-ladder__tier';
      item.setAttribute('data-vor-tier', String(index + 1));
      item.setAttribute('data-vor-tier-qty', String(tier.qty));

      const label = document.createElement('span');
      label.className = 'vor-ladder__tier-label';
      label.textContent = tier.label;
      item.append(label);
      list.append(item);
    });

    wrapper.append(list);

    const saved = document.createElement('p');
    saved.className = 'vor-ladder__saved';
    saved.setAttribute('data-vor-saved', '');
    saved.hidden = true;
    wrapper.append(saved);

    const note = document.createElement('p');
    note.className = 'vor-ladder__note';
    note.textContent = config.strings.note;
    wrapper.append(note);

    return wrapper;
  }

  /* -------------------------------------------------- discount codes */

  /** @type {AbortController | null} */
  let activeRequest = null;

  /**
   * The section ids that show cart totals or the ladder, so one request refreshes them all.
   * @returns {string[]}
   */
  function sectionIdsToRefresh() {
    const ids = new Set();

    document.querySelectorAll('cart-items-component').forEach((element) => {
      if (element instanceof HTMLElement && element.dataset.sectionId) ids.add(element.dataset.sectionId);
    });

    if (document.querySelector('cart-drawer-component')) ids.add(config.drawerSectionId);

    document.querySelectorAll('[data-vor-mount]').forEach((element) => {
      const section = element.closest('.shopify-section');
      if (section?.id) ids.add(section.id.replace(/^shopify-section-/, ''));
    });

    return [...ids];
  }

  /**
   * @param {{ code: string }[]} currentCodes
   * @returns {string[] | null} The codes to send, or null when nothing has to change.
   */
  function resolveCodes(currentCodes) {
    const { active } = resolveTiers(state.itemCount);
    return resolveDesiredCodes(currentCodes, active?.code || null, managedCodes);
  }

  /** @param {string[]} codes */
  async function applyCodes(codes) {
    activeRequest?.abort();
    activeRequest = new AbortController();

    const sections = sectionIdsToRefresh();

    try {
      const response = await fetch(config.cartUpdateUrl, {
        ...fetchConfig('json', {
          body: JSON.stringify({ discount: codes.join(','), sections: sections.join(',') }),
        }),
        signal: activeRequest.signal,
      });

      if (!response.ok) return;

      const data = await response.json();

      state.itemCount = Number(data.item_count) || 0;
      state.totalDiscount = Number(data.total_discount) || 0;

      for (const id of sections) {
        const html = data.sections?.[id];
        if (!html) continue;

        try {
          await morphSection(id, html, { mode: id === config.drawerSectionId ? 'hydration' : 'full' });
        } catch {
          // A section that is no longer on the page is not an error worth surfacing.
        }
      }

      mountDrawerLadder();
      render();
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.warn('[vor-volume-discount] Could not update the cart discount:', error.message);
      }
    } finally {
      activeRequest = null;
    }
  }

  /** Reads the cart totals Shopify calculated, so no amount is ever computed here. */
  async function refreshTotals() {
    try {
      const response = await fetch(config.cartJsUrl, { headers: { Accept: 'application/json' } });
      if (!response.ok) return;

      const cart = await response.json();
      state.itemCount = Number(cart.item_count) || 0;
      state.totalDiscount = Number(cart.total_discount) || 0;
      render();
    } catch {
      // Silent: the ladder keeps showing the last known state.
    }
  }

  /* -------------------------------------------------- events */

  const sync = debounce(async (/** @type {{ code: string }[]} */ currentCodes) => {
    const codes = config.applyCodes ? resolveCodes(currentCodes) : null;

    if (codes) {
      await applyCodes(codes);
    } else {
      await refreshTotals();
      mountDrawerLadder();
    }
  }, DEBOUNCE_MS);

  document.addEventListener(StandardEvents.cartLinesUpdate, (event) => {
    mountDrawerLadder();

    event.promise
      ?.then(({ cart }) => {
        if (!cart) return;

        state.itemCount = Number(cart.totalQuantity) || 0;
        render();
        mountDrawerLadder();

        sync(Array.isArray(cart.discountCodes) ? cart.discountCodes : []);
      })
      .catch(() => {
        // The cart reports its own errors; the ladder just leaves the state as it was.
      });
  });

  document.addEventListener(StandardEvents.cartView, () => {
    mountDrawerLadder();
    render();
  });

  document.addEventListener(StandardEvents.cartDiscountUpdate, () => {
    refreshTotals();
  });

  render();
  mountDrawerLadder();

  const drawerObserver = new MutationObserver(
    debounce(() => {
      mountDrawerLadder();
    }, 50)
  );

  const drawer = document.querySelector('cart-drawer-component');
  if (drawer) drawerObserver.observe(drawer, { childList: true, subtree: true });
}

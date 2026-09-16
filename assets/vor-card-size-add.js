/**
 * Vorreni size strip on a product card.
 *
 * Only touches its own markup: picking a size writes the variant id into the hidden input that
 * Horizon's `product-form-component` reads, and enables the add button. Submitting is Horizon's
 * job from there, which is what opens the cart drawer.
 */
class VorCardSizeAdd extends HTMLElement {
  connectedCallback() {
    this.addEventListener('change', this.#handleChange);
    this.#labels = {
      choose: this.querySelector('button[type="submit"]')?.textContent?.trim() ?? '',
      add: this.dataset.addLabel ?? '',
    };
  }

  disconnectedCallback() {
    this.removeEventListener('change', this.#handleChange);
  }

  /** @type {{ choose: string, add: string }} */
  #labels = { choose: '', add: '' };

  /** @param {Event} event */
  #handleChange = (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'radio') return;

    const variantId = input.dataset.variantId ?? '';
    const hiddenInput = this.querySelector('input[name="id"]');
    const button = this.querySelector('button[type="submit"]');

    if (hiddenInput instanceof HTMLInputElement) {
      hiddenInput.value = variantId;
      hiddenInput.disabled = variantId === '';
    }

    if (button instanceof HTMLButtonElement) {
      button.disabled = variantId === '';
      if (this.#labels.add) button.textContent = this.#labels.add;
    }
  };
}

if (!customElements.get('vor-card-size-add')) {
  customElements.define('vor-card-size-add', VorCardSizeAdd);
}

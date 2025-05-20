if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.form.querySelector('[name=id]').disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText = this.submitButton.querySelector('span');

        if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        this.submitButton.setAttribute('aria-disabled', true);
        const loadingSpinner = this.submitButton.querySelector('.loading-overlay__spinner');
        if (loadingSpinner) loadingSpinner.classList.remove('hidden');

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const formData = new FormData(this.form);
        
        // Simple sections approach
        formData.append('sections', 'cart-drawer,cart-icon-bubble');
        formData.append('sections_url', window.location.pathname);
        config.body = formData;

        fetch(`${routes.cart_add_url}`, config)
          .then(response => {
            if (!response.ok) {
              throw new Error('Network response was not ok');
            }
            return response.json();
          })
          .then(response => {
            if (response.status) {
              this.handleErrorMessage(response.description);
              return;
            }

            // Reset quantity input to 1
            const quantityInput = document.querySelector('.quantity__input');
            if (quantityInput) {
              quantityInput.value = 1;
            }

            // Find and open cart drawer
            const cartDrawer = document.querySelector('cart-drawer');
            if (cartDrawer) {
              if (typeof cartDrawer.renderContents === 'function') {
                cartDrawer.renderContents(response);
              } else {
                // Manual drawer opening
                setTimeout(() => {
                  cartDrawer.open();
                  
                  // Update cart count
                  const cartCountElements = document.querySelectorAll('.cart-count-bubble, .header__cart-count');
                  cartCountElements.forEach(element => {
                    if (element) {
                      element.textContent = response.item_count;
                      element.classList.toggle('hidden', response.item_count === 0);
                    }
                  });
                }, 100);
              }
            }

            // Dispatch event for other components
            document.dispatchEvent(new CustomEvent('cart:updated', {
              bubbles: true,
              detail: { cart: response }
            }));
          })
          .catch(error => {
            console.error('Error adding product to cart:', error);
            this.handleErrorMessage('An error occurred. Please try again.');
          })
          .finally(() => {
            this.submitButton.removeAttribute('aria-disabled');
            if (loadingSpinner) loadingSpinner.classList.add('hidden');
          });
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }
    }
  );
}

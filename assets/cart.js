class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      
      // Find the relevant cart items container - either regular cart or drawer
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      
      // Get the line item index and set quantity to 0
      if (cartItems) {
        // Show a loading indication on the remove button
        this.classList.add('loading');
        const loadingSpinner = this.querySelector('.loading-overlay__spinner');
        if (loadingSpinner) loadingSpinner.classList.remove('hidden');
        
        cartItems.updateQuantity(this.dataset.index, 0, event);
      }
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    // Create debounced change handler
    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, 300);

    this.addEventListener('change', debouncedOnChange.bind(this));
    
    // Listen for direct cart update events
    document.addEventListener('cart:refresh', () => {
      this.onCartRefresh();
    });
  }

  cartUpdateUnsubscriber = undefined;

  // Handle standard change events (like quantity inputs)
  onChange(event) {
    this.updateQuantity(event.target.dataset.index, event.target.value, document.activeElement.getAttribute('name'));
  }
  
  // Handle cart refresh requests
  onCartRefresh() {
    fetch(window.Shopify.routes.root + 'cart.js')
      .then(response => response.json())
      .then(cart => {
        this.renderCartItems(cart);
      })
      .catch(error => console.error('Error refreshing cart:', error));
  }

  // Update the quantity of a line item
  updateQuantity(line, quantity, name) {
    this.enableLoading(line);

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname
    });

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        if (!response.ok) {
          const error = new Error(response.status);
          throw error;
        }
        return response.json();
      })
      .then((state) => {
        // Update the cart state
        this.classList.toggle('is-empty', state.item_count === 0);
        
        // Update cart dot count
        const cartIconBubble = document.getElementById('cart-icon-bubble');
        if (cartIconBubble && state.sections && state.sections['cart-icon-bubble']) {
          cartIconBubble.innerHTML = this.getSectionInnerHTML(state.sections['cart-icon-bubble']);
        }
        
        // Update line items in all relevant sections
        this.getSectionsToRender().forEach((section) => {
          const elementToReplace = document.getElementById(section.id);
          if (elementToReplace && state.sections && state.sections[section.section]) {
            elementToReplace.innerHTML = this.getSectionInnerHTML(
              state.sections[section.section],
              section.selector
            );
          }
        });

        const updatedValue = document.getElementById(`Quantity-${line}`) ? document.getElementById(`Quantity-${line}`).value : 1;
        if (updatedValue !== quantity) {
          this.updateLiveRegions(line, updatedValue);
        }

        const lineItem = document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
        if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
          lineItem.querySelector(`[name="${name}"]`).focus();
        }
        
        // Notify other components of cart update
        document.dispatchEvent(new CustomEvent('cart:updated', {
          bubbles: true,
          detail: { cart: state }
        }));
        
        // If we are in a drawer, reattach listeners
        const cartDrawer = document.querySelector('cart-drawer');
        if (cartDrawer && typeof cartDrawer.setupCartDrawerListeners === 'function') {
          cartDrawer.setupCartDrawerListeners();
        }
      })
      .catch((error) => {
        // Handle errors
        console.error('Error updating cart:', error);
        const errorMessage = document.createElement('div');
        errorMessage.className = 'cart__error';
        errorMessage.textContent = window.cartStrings?.error || 'An error occurred while updating your cart. Please try again.';
        
        const errorContainer = document.querySelector('.cart-items') || this;
        if (errorContainer) {
          errorContainer.prepend(errorMessage);
          setTimeout(() => errorMessage.remove(), 3000);
        }
      })
      .finally(() => {
        this.disableLoading(line);
      });
  }

  renderCartItems(cart) {
    // Implement if needed for specific rendering logic
  }

  // Get section HTML
  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: 'main-cart-items',
        selector: '.js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
      {
        id: 'main-cart-footer',
        section: 'main-cart-footer',
        selector: '.js-contents',
      },
      {
        id: 'CartDrawer',
        section: 'cart-drawer',
        selector: '.drawer__inner',
      }
    ];
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  updateLiveRegions(line, itemCount) {
    const cartStatus = document.getElementById('cart-live-region-text');
    if (cartStatus) {
      cartStatus.setAttribute('aria-hidden', false);

      setTimeout(() => {
        cartStatus.setAttribute('aria-hidden', true);
      }, 1000);
    }
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items');
    if (mainCartItems) {
      mainCartItems.classList.add('cart__items--disabled');
    }

    const cartDrawerItems = document.getElementById('CartDrawer-CartItems');
    if (cartDrawerItems) {
      cartDrawerItems.classList.add('cart__items--disabled');
    }

    // Show loading spinner
    const loadingSpinner = document.getElementById(`CartItem-Spinner-${line}`) || 
                           document.getElementById(`CartDrawer-Spinner-${line}`);
    if (loadingSpinner) {
      loadingSpinner.classList.remove('hidden');
    }

    if (document.activeElement) {
      document.activeElement.blur();
    }
    
    if (this.lineItemStatusElement) {
      this.lineItemStatusElement.setAttribute('aria-hidden', false);
    }
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items');
    if (mainCartItems) {
      mainCartItems.classList.remove('cart__items--disabled');
    }

    const cartDrawerItems = document.getElementById('CartDrawer-CartItems');
    if (cartDrawerItems) {
      cartDrawerItems.classList.remove('cart__items--disabled');
    }

    // Hide loading spinner
    const loadingSpinner = document.getElementById(`CartItem-Spinner-${line}`) || 
                           document.getElementById(`CartDrawer-Spinner-${line}`);
    if (loadingSpinner) {
      loadingSpinner.classList.add('hidden');
    }
  }
}

customElements.define('cart-items', CartItems);

// Utility functions
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function fetchConfig(type = 'json') {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': `application/${type}`
    }
  };
}

if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } })
              .then(() => CartPerformance.measureFromEvent('note-update:user-action', event));
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}

class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
    this.setHeaderCartIconAccessibility();
    
    // Listen for cart updates
    document.addEventListener('cart:updated', (event) => {
      if (event.detail && event.detail.cart) {
        this.refreshCartDrawer(event.detail.cart);
      }
    });
  }

  setHeaderCartIconAccessibility() {
    const cartLink = document.querySelector('#cart-icon-bubble');
    if (!cartLink) return;

    cartLink.setAttribute('role', 'button');
    cartLink.setAttribute('aria-haspopup', 'dialog');
    cartLink.addEventListener('click', (event) => {
      event.preventDefault();
      this.open(cartLink);
    });
    cartLink.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() === 'SPACE') {
        event.preventDefault();
        this.open(cartLink);
      }
    });
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);
    const cartDrawerNote = this.querySelector('[id^="Details-"] summary');
    if (cartDrawerNote && !cartDrawerNote.hasAttribute('role')) this.setSummaryAccessibility(cartDrawerNote);
    
    // Make sure active class is added
    this.classList.add('animate', 'active');

    this.addEventListener(
      'transitionend',
      () => {
        const containerToTrapFocusOn = this.classList.contains('is-empty')
          ? this.querySelector('.drawer__inner-empty')
          : document.getElementById('CartDrawer');
        const focusElement = this.querySelector('.drawer__inner') || this.querySelector('.drawer__close');
        
        // Only trap focus if we have the necessary elements
        if (typeof trapFocus === 'function' && containerToTrapFocusOn && focusElement) {
          trapFocus(containerToTrapFocusOn, focusElement);
        }
      },
      { once: true }
    );

    document.body.classList.add('overflow-hidden');
  }

  close() {
    this.classList.remove('active');
    
    // Only remove trap focus if we have the necessary function
    if (typeof removeTrapFocus === 'function' && this.activeElement) {
      removeTrapFocus(this.activeElement);
    }
    
    document.body.classList.remove('overflow-hidden');
  }

  setSummaryAccessibility(cartDrawerNote) {
    cartDrawerNote.setAttribute('role', 'button');
    cartDrawerNote.setAttribute('aria-expanded', 'false');

    if (cartDrawerNote.nextElementSibling.getAttribute('id')) {
      cartDrawerNote.setAttribute('aria-controls', cartDrawerNote.nextElementSibling.id);
    }

    cartDrawerNote.addEventListener('click', (event) => {
      event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
    });

    cartDrawerNote.parentElement.addEventListener('keyup', onKeyUpEscape);
  }

  refreshCartDrawer(parsedState) {
    fetch(`${routes.cart_url}?section_id=cart-drawer`)
      .then(response => response.text())
      .then(responseText => {
        const html = new DOMParser().parseFromString(responseText, 'text/html');
        const cartDrawerContent = html.querySelector('.drawer__inner');
        
        if (cartDrawerContent && this.querySelector('.drawer__inner')) {
          this.querySelector('.drawer__inner').innerHTML = cartDrawerContent.innerHTML;
        }
        
        // Update cart count
        const cartIconBubble = document.getElementById('cart-icon-bubble');
        const cartIconBubbleHtml = html.getElementById('cart-icon-bubble');
        
        if (cartIconBubble && cartIconBubbleHtml) {
          cartIconBubble.innerHTML = cartIconBubbleHtml.innerHTML;
        }
        
        // Remove is-empty class if needed
        this.classList.toggle('is-empty', parsedState.item_count === 0);
        
        // Reattach event listeners for newly added elements
        this.setupCartDrawerListeners();
      })
      .catch(e => console.error('Error refreshing cart drawer:', e));
  }
  
  // Add this method to reattach event listeners after cart drawer content is updated
  setupCartDrawerListeners() {
    // Reattach quantity change listeners
    const quantityInputs = this.querySelectorAll('.quantity__input');
    if (quantityInputs.length) {
      quantityInputs.forEach(input => {
        input.addEventListener('change', function(e) {
          const cartItems = this.closest('cart-drawer-items');
          if (cartItems) {
            const lineItemKey = this.dataset.index;
            const quantity = parseInt(this.value);
            if (!isNaN(quantity)) {
              cartItems.updateQuantity(lineItemKey, quantity);
            }
          }
        });
      });
    }
    
    // Make sure cartLink is accessible
    this.setHeaderCartIconAccessibility();
  }

  renderContents(parsedState) {
    this.refreshCartDrawer(parsedState);
    this.open();
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  getSectionsToRender() {
    return [
      {
        id: 'CartDrawer',
        section: 'cart-drawer',
        selector: '.drawer__inner',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'CartDrawer-Upskill',
        section: 'cart-drawer-upskill',
        selector: '.cart-drawer-upskill'
      }
    ];
  }

  getSectionDOM(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-drawer', CartDrawer);

class CartDrawerItems extends CartItems {
  constructor() {
    super();
    
    this.lineItemStatusElement = document.getElementById('CartDrawer-LineItemStatus') || document.createElement('div');
    
    this.currentItemCount = Array.from(this.querySelectorAll('[name="updates[]"]'))
      .reduce((total, quantityInput) => total + parseInt(quantityInput.value), 0);
    
    this.debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, 300);
    
    this.addEventListener('change', this.debouncedOnChange.bind(this));
  }

  onChange(event) {
    this.updateQuantity(event.target.dataset.index, event.target.value, document.activeElement.getAttribute('name'));
  }
  
  // Enhanced error handling in updateQuantity method
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
        // Update cart counts & totals
        this.classList.toggle('is-empty', state.item_count === 0);
        const drawerElement = document.querySelector('cart-drawer');
        if (drawerElement) {
          drawerElement.classList.toggle('is-empty', state.item_count === 0);
        }
        
        // Update line items
        this.getSectionsToRender().forEach((section) => {
          const elementToReplace = document.getElementById(section.id);
          if (elementToReplace && state.sections && state.sections[section.section]) {
            elementToReplace.innerHTML = this.getSectionInnerHTML(
              state.sections[section.section],
              section.selector
            );
          }
        });
        
        // Update count bubble
        const cartIconBubble = document.getElementById('cart-icon-bubble');
        if (cartIconBubble && state.sections && state.sections['cart-icon-bubble']) {
          cartIconBubble.innerHTML = this.getSectionInnerHTML(
            state.sections['cart-icon-bubble'],
            '.shopify-section'
          );
        }
        
        // Re-enable quantity inputs
        const updatedLine = document.querySelector(`#CartDrawer-LineItemQuantity-${line}`);
        if (updatedLine && updatedLine.querySelector(`[name="${name}"]`)) {
          updatedLine.querySelector(`[name="${name}"]`).focus();
        }
        
        // Update item count
        this.updateLiveRegions(line, state.item_count);
        
        // Reattach listeners after DOM update
        const drawerInstance = document.querySelector('cart-drawer');
        if (drawerInstance && typeof drawerInstance.setupCartDrawerListeners === 'function') {
          drawerInstance.setupCartDrawerListeners();
        }

        // Dispatch cart updated event
        document.dispatchEvent(new CustomEvent('cart:updated', {
          bubbles: true,
          detail: { cart: state }
        }));
      })
      .catch((error) => {
        console.error('Error updating cart:', error);
        // Show a user-friendly error message
        const errorMessage = document.createElement('div');
        errorMessage.className = 'cart-drawer__error';
        errorMessage.textContent = 'There was an error updating your cart. Please try again.';
        
        const cartErrorContainer = document.querySelector('.cart-drawer__error-container') || this.querySelector('.drawer__inner');
        if (cartErrorContainer) {
          cartErrorContainer.prepend(errorMessage);
          setTimeout(() => errorMessage.remove(), 3000);
        }
      })
      .finally(() => {
        this.disableLoading(line);
      });
  }

  getSectionsToRender() {
    return [
      {
        id: 'CartDrawer',
        section: 'cart-drawer',
        selector: '.drawer__inner',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'CartDrawer-Upskill',
        section: 'cart-drawer-upskill',
        selector: '.cart-drawer-upskill'
      }
    ];
  }
  
  getSectionInnerHTML(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  updateLiveRegions(line, itemCount) {
    if (this.currentItemCount === itemCount) {
      const lineItemError = document.getElementById(`CartDrawer-LineItemError-${line}`);
      const quantityElement = document.getElementById(`CartDrawer-Quantity-${line}`);
      
      if (lineItemError && lineItemError.classList.contains('cart-item__error-text--show')) {
        lineItemError.classList.remove('cart-item__error-text--show');
        lineItemError.querySelector('.cart-item__error-text-wrapper').innerHTML = '';
        quantityElement.classList.remove('input--error');
      }
    }

    this.currentItemCount = itemCount;
    if (this.lineItemStatusElement) {
      this.lineItemStatusElement.setAttribute('aria-hidden', true);

      const cartStatus = document.getElementById('CartDrawer-CartStatus');
      if (cartStatus) {
        cartStatus.setAttribute('aria-hidden', false);
      }
    }
  }

  enableLoading(line) {
    const cartItems = document.getElementById('CartDrawer-CartItems');
    if (cartItems) cartItems.classList.add('cart__items--disabled');

    const loadingSpinner = document.getElementById(`CartDrawer-Spinner-${line}`);
    if (loadingSpinner) loadingSpinner.classList.remove('hidden');

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const cartItems = document.getElementById('CartDrawer-CartItems');
    if (cartItems) cartItems.classList.remove('cart__items--disabled');

    const loadingSpinner = document.getElementById(`CartDrawer-Spinner-${line}`);
    if (loadingSpinner) loadingSpinner.classList.add('hidden');
  }
}

customElements.define('cart-drawer-items', CartDrawerItems);

// Add this utility function if it doesn't exist in your codebase
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

// Add this utility function if it doesn't exist in your codebase
function fetchConfig(type = 'json') {
  return {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Accept': `application/${type}`
    }
  };
}

// Handle escape key events
function onKeyUpEscape(event) {
  if (event.code.toUpperCase() !== 'ESCAPE') return;

  const openDetailsElement = event.target.closest('details[open]');
  if (!openDetailsElement) return;

  const summaryElement = openDetailsElement.querySelector('summary');
  openDetailsElement.removeAttribute('open');
  summaryElement.setAttribute('aria-expanded', false);
  summaryElement.focus();
}

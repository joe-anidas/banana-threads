// Add a function to initialize global cart state
function initializeCartSync() {
  // Listen for storage events for cross-tab synchronization
  window.addEventListener('storage', (event) => {
    if (event.key === 'shopify-cart-update') {
      // Another tab has updated the cart, refresh our state
      fetch('/cart.js')
        .then(response => response.json())
        .then(cart => {
          // Update all cart drawers
          document.querySelectorAll('cart-drawer').forEach(drawer => {
            if (typeof drawer.refreshCartDrawer === 'function') {
              drawer.refreshCartDrawer(cart);
            }
          });
        })
        .catch(err => console.error('Error syncing cart state:', err));
    }
  });
  
  // Listen for cart update events
  document.addEventListener('cart:update', (event) => {
    if (event.detail && event.detail.cartData) {
      // Notify other tabs of the update
      try {
        localStorage.setItem('shopify-cart-update', Date.now().toString());
        window.latestCartData = event.detail.cartData;
      } catch (e) {
        console.warn('Could not store cart update in localStorage:', e);
      }
    }
  });
}

// Initialize cart sync when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeCartSync);
} else {
  initializeCartSync();
}

class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
    this.setHeaderCartIconAccessibility();
    
    // Add event delegation for cart remove buttons
    this.addEventListener('click', (event) => {
      const removeButton = event.target.closest('cart-remove-button');
      if (removeButton) {
        event.preventDefault();
        const cartItems = removeButton.closest('cart-items') || removeButton.closest('cart-drawer-items');
        if (cartItems) {
          // Convert the dataset index to a number to ensure correct format
          const lineIndex = Number(removeButton.dataset.index);
          if (!isNaN(lineIndex)) {
            cartItems.updateQuantity(lineIndex, 0, event);
          } else {
            console.error('Invalid line index for cart removal:', removeButton.dataset.index);
          }
        }
      }
    });
    
    // Listen for cart updates
    document.addEventListener('cart:updated', (event) => {
      if (event.detail && event.detail.cart) {
        this.refreshCartDrawer(event.detail.cart);
      }
    });

    // Listen for custom cart:refreshed events
    document.addEventListener('cart:refreshed', (event) => {
      console.log("Cart was refreshed externally:", event.detail?.source);
      // Force rebuild item removal functionality if needed
      this.rebuildCartFunctionality();
    });
  }

  setHeaderCartIconAccessibility() {
    const cartLink = document.querySelector('#cart-icon-bubble');
    if (!cartLink) return;

    // Remove any existing event listeners before adding new ones
    const newCartLink = cartLink.cloneNode(true);
    if (cartLink.parentNode) {
      cartLink.parentNode.replaceChild(newCartLink, cartLink);
    }

    newCartLink.setAttribute('role', 'button');
    newCartLink.setAttribute('aria-haspopup', 'dialog');
    newCartLink.addEventListener('click', (event) => {
      event.preventDefault();
      this.open(newCartLink);
    });
    newCartLink.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() === 'SPACE') {
        event.preventDefault();
        this.open(newCartLink);
      }
    });
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);
    
    // Fetch latest cart data before opening
    fetch('/cart.js')
      .then(response => response.json())
      .then(cart => {
        // Force refresh cart content
        this.refreshCartDrawer(cart);
        
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
      })
      .catch(error => {
        console.error('Error fetching cart data:', error);
        // Proceed with opening even if fetch fails
        this.classList.add('animate', 'active');
        document.body.classList.add('overflow-hidden');
      });
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
    // Use cached cart data if provided, or fetch fresh data
    const cartPromise = parsedState 
      ? Promise.resolve(parsedState) 
      : fetch('/cart.js').then(res => res.json());
    
    // Get the latest cart drawer HTML
    const cartDrawerPromise = fetch(`${routes.cart_url}?section_id=cart-drawer`)
      .then(response => response.text())
      .then(responseText => new DOMParser().parseFromString(responseText, 'text/html'));
      
    // Process both in parallel for efficiency
    Promise.all([cartPromise, cartDrawerPromise])
      .then(([cartData, html]) => {
        const cartDrawerContent = html.querySelector('.drawer__inner');
        
        // Replace entire drawer inner content
        if (cartDrawerContent && this.querySelector('.drawer__inner')) {
          this.querySelector('.drawer__inner').innerHTML = cartDrawerContent.innerHTML;
          
          // Ensure quantity inputs and remove buttons are properly initialized
          this.querySelectorAll('cart-remove-button').forEach(button => {
            // We'll rely on event delegation now
          });
          
          // Initialize quantity inputs
          this.querySelectorAll('quantity-input').forEach(input => {
            if (!customElements.get('quantity-input')) return;
            const newInput = document.createElement('quantity-input');
            newInput.className = input.className;
            newInput.innerHTML = input.innerHTML;
            if (input.parentNode) {
              input.parentNode.replaceChild(newInput, input);
            }
          });
        }
        
        // Update cart count
        const cartIconBubble = document.getElementById('cart-icon-bubble');
        const cartIconBubbleHtml = html.getElementById('cart-icon-bubble');
        
        if (cartIconBubble && cartIconBubbleHtml) {
          cartIconBubble.innerHTML = cartIconBubbleHtml.innerHTML;
        }
        
        // Also directly update count for immediate feedback
        const cartCountElements = document.querySelectorAll('.cart-count-bubble span, .header__cart-count');
        cartCountElements.forEach(element => {
          if (element) {
            element.textContent = cartData.item_count;
            // Show/hide empty bubble
            const bubble = element.closest('.cart-count-bubble');
            if (bubble) {
              bubble.classList.toggle('hidden', cartData.item_count === 0);
            }
          }
        });
        
        // Remove is-empty class if needed
        this.classList.toggle('is-empty', cartData.item_count === 0);
        
        // Cache cart data
        window.latestCartData = cartData;
      })
      .catch(e => console.error('Error refreshing cart drawer:', e));
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

  // New method to rebuild cart functionality after external refresh
  rebuildCartFunctionality() {
    // Ensure cart-drawer-items is properly initialized
    const cartDrawerItems = this.querySelector('cart-drawer-items');
    if (cartDrawerItems) {
      // Force redraw cart item removal buttons if needed
      cartDrawerItems.querySelectorAll('cart-remove-button').forEach(button => {
        // We're relying on event delegation now, but this ensures data attributes are set
        const lineIndex = button.dataset.index;
        if (!lineIndex) {
          const cartItemRow = button.closest('tr');
          if (cartItemRow && cartItemRow.dataset.index) {
            button.dataset.index = cartItemRow.dataset.index;
          }
        }
      });
    }
  }
}

customElements.define('cart-drawer', CartDrawer);

class CartDrawerItems extends CartItems {
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
  
  // Override updateQuantity to include specific error handling for drawer
  updateQuantity(line, quantity, event, name, variantId) {
    // First convert line to ensure it's a number
    const lineNumber = Number(line);
    if (isNaN(lineNumber)) {
      console.error('Invalid line number in cart drawer:', line);
      this.querySelectorAll('.loading__spinner').forEach(overlay => overlay.classList.add('hidden'));
      
      const lineItemError = document.getElementById(`CartDrawer-LineItemError-${line}`);
      if (lineItemError) {
        lineItemError.querySelector('.cart-item__error-text').textContent = 'Invalid line item. Please try again.';
        lineItemError.classList.add('cart-item__error-text--show');
        setTimeout(() => lineItemError.classList.remove('cart-item__error-text--show'), 5000);
      }
      return;
    }
    
    // Call parent implementation with validated line number
    super.updateQuantity(lineNumber, quantity, event, name, variantId);
    
    // If this is a removal, update cart count immediately
    if (quantity === 0) {
      // Update the cart icon with the right count
      setTimeout(() => {
        fetch('/cart.js')
          .then(response => response.json())
          .then(cart => {
            // Update cart count bubbles
            const cartCountElements = document.querySelectorAll('.cart-count-bubble span, .header__cart-count');
            cartCountElements.forEach(element => {
              if (element) {
                element.textContent = cart.item_count;
                // Show/hide empty bubble
                const bubble = element.closest('.cart-count-bubble');
                if (bubble) {
                  bubble.classList.toggle('hidden', cart.item_count === 0);
                }
              }
            });
            
            // Cache cart data for faster access
            window.latestCartData = cart;
          })
          .catch(e => console.error('Error updating cart count:', e));
      }, 300); // Small delay to ensure the cart operation has completed
    }
  }
}

customElements.define('cart-drawer-items', CartDrawerItems);

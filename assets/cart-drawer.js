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
}

customElements.define('cart-drawer-items', CartDrawerItems);

class CartDrawerUpskill extends HTMLElement {
  constructor() {
    super();
    this.addToCartButtonClickHandler = this.handleAddToCartButtonClick.bind(this);
  }

  connectedCallback() {
    // Add event delegation for add-to-cart buttons
    this.addEventListener('click', this.addToCartButtonClickHandler);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.addToCartButtonClickHandler);
  }

  handleAddToCartButtonClick(event) {
    const addButton = event.target.closest('.cart-drawer-upskill__add-button');
    if (!addButton) return;
    
    event.preventDefault();
    
    const productId = addButton.dataset.productId;
    const variantId = addButton.dataset.variantId;
    
    if (productId && variantId) {
      this.addToCart(variantId);
    }
  }

  async addToCart(variantId, quantity = 1) {
    try {
      // Create formData for the AJAX request
      const formData = new FormData();
      formData.append('id', variantId);
      formData.append('quantity', quantity);
  
      // Configure the fetch request
      const config = {
        method: 'POST',
        headers: {
          'Accept': 'application/javascript',
          'X-Requested-With': 'XMLHttpRequest',
        },
        body: formData
      };
  
      // Send the request
      const response = await fetch(`${routes.cart_add_url}`, config);
      const responseData = await response.json();
  
      if (responseData.status) {
        publish(PUB_SUB_EVENTS.cartError, {
          source: 'cart-drawer-upskill',
          productVariantId: variantId,
          errors: responseData.errors || responseData.description,
          message: responseData.message,
        });
        return;
      }
  
      // Publish cart update event
      publish(PUB_SUB_EVENTS.cartUpdate, {
        source: 'cart-drawer-upskill',
        productVariantId: variantId,
        cartData: responseData,
      });
    } catch (error) {
      console.error('Error adding product to cart:', error);
    }
  }
}

customElements.define('cart-drawer-upskill', CartDrawerUpskill); 
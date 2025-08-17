import api from './api';

const cartService = {
  // Get user's cart
  getCart: async () => {
    return await api.get('/cart');
  },

  // Add item to cart
  addToCart: async (productId, quantity = 1, selectedVariants = []) => {
    return await api.post('/cart/items', {
      product: productId,
      quantity,
      selectedVariants
    });
  },

  // Update cart item quantity
  updateCartItem: async (itemId, quantity) => {
    return await api.put(`/cart/items/${itemId}`, { quantity });
  },

  // Remove item from cart
  removeFromCart: async (itemId) => {
    return await api.delete(`/cart/items/${itemId}`);
  },

  // Clear entire cart
  clearCart: async () => {
    return await api.delete('/cart');
  },

  // Apply coupon code
  applyCoupon: async (couponCode) => {
    return await api.post('/cart/apply-coupon', { couponCode });
  },

  // Remove coupon
  removeCoupon: async () => {
    return await api.delete('/cart/coupon');
  },

  // Get cart items count
  getCartCount: async () => {
    return await api.get('/cart/count');
  },

  // Validate cart (check availability, prices, stock)
  validateCart: async () => {
    return await api.post('/cart/validate');
  },
};

export default cartService;


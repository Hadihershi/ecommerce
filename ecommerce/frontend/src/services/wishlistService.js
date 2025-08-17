import api from './api';

const wishlistService = {
  // Get user's wishlist
  getWishlist: async () => {
    const response = await api.get('/users/me');
    return {
      data: {
        wishlist: response.data.user.wishlist || []
      }
    };
  },

  // Add product to wishlist
  addToWishlist: async (productId) => {
    const response = await api.post(`/users/me/wishlist/${productId}`);
    return response;
  },

  // Remove product from wishlist
  removeFromWishlist: async (productId) => {
    const response = await api.delete(`/users/me/wishlist/${productId}`);
    return response;
  },
};

export default wishlistService;


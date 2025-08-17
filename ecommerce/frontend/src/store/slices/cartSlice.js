import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import cartService from '../../services/cartService';
import toast from 'react-hot-toast';

// Async thunks
export const fetchCart = createAsyncThunk(
  'cart/fetchCart',
  async (_, { rejectWithValue }) => {
    try {
      const response = await cartService.getCart();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch cart');
    }
  }
);

export const addToCart = createAsyncThunk(
  'cart/addToCart',
  async ({ productId, quantity, selectedVariants }, { rejectWithValue }) => {
    try {
      const response = await cartService.addToCart(productId, quantity, selectedVariants);
      toast.success('Item added to cart!');
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to add item to cart';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const updateCartItem = createAsyncThunk(
  'cart/updateCartItem',
  async ({ itemId, quantity }, { rejectWithValue }) => {
    try {
      const response = await cartService.updateCartItem(itemId, quantity);
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to update cart item';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const removeFromCart = createAsyncThunk(
  'cart/removeFromCart',
  async (itemId, { rejectWithValue }) => {
    try {
      const response = await cartService.removeFromCart(itemId);
      toast.success('Item removed from cart');
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to remove item from cart';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const clearCart = createAsyncThunk(
  'cart/clearCart',
  async (_, { rejectWithValue }) => {
    try {
      const response = await cartService.clearCart();
      toast.success('Cart cleared');
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to clear cart';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const applyCoupon = createAsyncThunk(
  'cart/applyCoupon',
  async (couponCode, { rejectWithValue }) => {
    try {
      const response = await cartService.applyCoupon(couponCode);
      toast.success('Coupon applied successfully!');
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to apply coupon';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const removeCoupon = createAsyncThunk(
  'cart/removeCoupon',
  async (_, { rejectWithValue }) => {
    try {
      const response = await cartService.removeCoupon();
      toast.success('Coupon removed');
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to remove coupon';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const validateCart = createAsyncThunk(
  'cart/validateCart',
  async (_, { rejectWithValue }) => {
    try {
      const response = await cartService.validateCart();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to validate cart');
    }
  }
);

const initialState = {
  cart: {
    items: [],
    totalItems: 0,
    subtotal: 0,
    total: 0,
    discount: 0,
    couponCode: null,
  },
  isLoading: false,
  error: null,
  validation: {
    valid: true,
    issues: []
  }
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    clearCartState: (state) => {
      state.cart = initialState.cart;
      state.error = null;
      state.validation = initialState.validation;
    },
    clearError: (state) => {
      state.error = null;
    },
    // Local cart actions for immediate UI updates
    incrementQuantity: (state, action) => {
      const item = state.cart.items.find(item => item._id === action.payload);
      if (item && item.quantity < 99) {
        item.quantity += 1;
        // Recalculate totals
        state.cart.totalItems = state.cart.items.reduce((sum, item) => sum + item.quantity, 0);
        state.cart.subtotal = state.cart.items.reduce((sum, item) => {
          const variantPrice = item.selectedVariants.reduce((vSum, variant) => vSum + variant.priceModifier, 0);
          return sum + ((item.price + variantPrice) * item.quantity);
        }, 0);
        state.cart.total = Math.max(0, state.cart.subtotal - (state.cart.discount || 0));
      }
    },
    decrementQuantity: (state, action) => {
      const item = state.cart.items.find(item => item._id === action.payload);
      if (item && item.quantity > 1) {
        item.quantity -= 1;
        // Recalculate totals
        state.cart.totalItems = state.cart.items.reduce((sum, item) => sum + item.quantity, 0);
        state.cart.subtotal = state.cart.items.reduce((sum, item) => {
          const variantPrice = item.selectedVariants.reduce((vSum, variant) => vSum + variant.priceModifier, 0);
          return sum + ((item.price + variantPrice) * item.quantity);
        }, 0);
        state.cart.total = Math.max(0, state.cart.subtotal - (state.cart.discount || 0));
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Cart
      .addCase(fetchCart.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCart.fulfilled, (state, action) => {
        state.isLoading = false;
        state.cart = action.payload.cart || initialState.cart;
        state.error = null;
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Add to Cart
      .addCase(addToCart.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(addToCart.fulfilled, (state, action) => {
        state.isLoading = false;
        state.cart = action.payload.cart;
        state.error = null;
      })
      .addCase(addToCart.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Update Cart Item
      .addCase(updateCartItem.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateCartItem.fulfilled, (state, action) => {
        state.isLoading = false;
        state.cart = action.payload.cart;
        state.error = null;
      })
      .addCase(updateCartItem.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Remove from Cart
      .addCase(removeFromCart.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeFromCart.fulfilled, (state, action) => {
        state.isLoading = false;
        state.cart = action.payload.cart;
        state.error = null;
      })
      .addCase(removeFromCart.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Clear Cart
      .addCase(clearCart.fulfilled, (state, action) => {
        state.cart = action.payload.cart || initialState.cart;
      })
      
      // Apply Coupon
      .addCase(applyCoupon.fulfilled, (state, action) => {
        state.cart = action.payload.cart;
      })
      
      // Remove Coupon
      .addCase(removeCoupon.fulfilled, (state, action) => {
        state.cart = action.payload.cart;
      })
      
      // Validate Cart
      .addCase(validateCart.fulfilled, (state, action) => {
        state.validation = action.payload;
      });
  },
});

export const { clearCartState, clearError, incrementQuantity, decrementQuantity } = cartSlice.actions;

// Selectors
export const selectCart = (state) => state.cart.cart;
export const selectCartItems = (state) => state.cart.cart.items;
export const selectCartTotal = (state) => state.cart.cart.total;
export const selectCartItemsCount = (state) => state.cart.cart.totalItems;
export const selectCartLoading = (state) => state.cart.isLoading;
export const selectCartError = (state) => state.cart.error;
export const selectCartValidation = (state) => state.cart.validation;

export default cartSlice.reducer;


import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import wishlistService from '../../services/wishlistService';
import toast from 'react-hot-toast';

// Async thunks
export const fetchWishlist = createAsyncThunk(
  'wishlist/fetchWishlist',
  async (_, { rejectWithValue }) => {
    try {
      const response = await wishlistService.getWishlist();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch wishlist');
    }
  }
);

export const addToWishlist = createAsyncThunk(
  'wishlist/addToWishlist',
  async (productId, { rejectWithValue }) => {
    try {
      const response = await wishlistService.addToWishlist(productId);
      toast.success('Added to wishlist!');
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to add to wishlist';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

export const removeFromWishlist = createAsyncThunk(
  'wishlist/removeFromWishlist',
  async (productId, { rejectWithValue }) => {
    try {
      const response = await wishlistService.removeFromWishlist(productId);
      toast.success('Removed from wishlist');
      return response.data;
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to remove from wishlist';
      toast.error(message);
      return rejectWithValue(message);
    }
  }
);

const initialState = {
  items: [],
  isLoading: false,
  error: null,
};

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    clearWishlist: (state) => {
      state.items = [];
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    },
    // Local wishlist actions for immediate UI updates
    toggleWishlistItem: (state, action) => {
      const productId = action.payload;
      const existingIndex = state.items.findIndex(item => item._id === productId);
      
      if (existingIndex > -1) {
        state.items.splice(existingIndex, 1);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Wishlist
      .addCase(fetchWishlist.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchWishlist.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload.wishlist || [];
        state.error = null;
      })
      .addCase(fetchWishlist.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Add to Wishlist
      .addCase(addToWishlist.pending, (state) => {
        state.error = null;
      })
      .addCase(addToWishlist.fulfilled, (state, action) => {
        state.items = action.payload.wishlist || [];
        state.error = null;
      })
      .addCase(addToWishlist.rejected, (state, action) => {
        state.error = action.payload;
      })
      
      // Remove from Wishlist
      .addCase(removeFromWishlist.pending, (state) => {
        state.error = null;
      })
      .addCase(removeFromWishlist.fulfilled, (state, action) => {
        state.items = action.payload.wishlist || [];
        state.error = null;
      })
      .addCase(removeFromWishlist.rejected, (state, action) => {
        state.error = action.payload;
      });
  },
});

export const { clearWishlist, clearError, toggleWishlistItem } = wishlistSlice.actions;

// Selectors
export const selectWishlist = (state) => state.wishlist.items;
export const selectWishlistLoading = (state) => state.wishlist.isLoading;
export const selectWishlistError = (state) => state.wishlist.error;
export const selectIsInWishlist = (productId) => (state) => 
  state.wishlist.items.some(item => item._id === productId);

export default wishlistSlice.reducer;


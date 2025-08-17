import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isSidebarOpen: false,
  isSearchOpen: false,
  theme: 'light',
  mobileMenuOpen: false,
  cartSidebarOpen: false,
  wishlistSidebarOpen: false,
  quickViewProduct: null,
  isQuickViewOpen: false,
  notifications: [],
  searchQuery: '',
  loading: {
    products: false,
    categories: false,
    orders: false,
    global: false,
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.isSidebarOpen = !state.isSidebarOpen;
    },
    closeSidebar: (state) => {
      state.isSidebarOpen = false;
    },
    openSidebar: (state) => {
      state.isSidebarOpen = true;
    },
    
    toggleSearch: (state) => {
      state.isSearchOpen = !state.isSearchOpen;
    },
    closeSearch: (state) => {
      state.isSearchOpen = false;
    },
    openSearch: (state) => {
      state.isSearchOpen = true;
    },
    
    toggleMobileMenu: (state) => {
      state.mobileMenuOpen = !state.mobileMenuOpen;
    },
    closeMobileMenu: (state) => {
      state.mobileMenuOpen = false;
    },
    
    toggleCartSidebar: (state) => {
      state.cartSidebarOpen = !state.cartSidebarOpen;
    },
    closeCartSidebar: (state) => {
      state.cartSidebarOpen = false;
    },
    openCartSidebar: (state) => {
      state.cartSidebarOpen = true;
    },
    
    toggleWishlistSidebar: (state) => {
      state.wishlistSidebarOpen = !state.wishlistSidebarOpen;
    },
    closeWishlistSidebar: (state) => {
      state.wishlistSidebarOpen = false;
    },
    openWishlistSidebar: (state) => {
      state.wishlistSidebarOpen = true;
    },
    
    openQuickView: (state, action) => {
      state.quickViewProduct = action.payload;
      state.isQuickViewOpen = true;
    },
    closeQuickView: (state) => {
      state.quickViewProduct = null;
      state.isQuickViewOpen = false;
    },
    
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
    
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    clearSearchQuery: (state) => {
      state.searchQuery = '';
    },
    
    addNotification: (state, action) => {
      const notification = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        ...action.payload
      };
      state.notifications.unshift(notification);
      // Keep only last 10 notifications
      if (state.notifications.length > 10) {
        state.notifications = state.notifications.slice(0, 10);
      }
    },
    removeNotification: (state, action) => {
      state.notifications = state.notifications.filter(
        notification => notification.id !== action.payload
      );
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    markNotificationAsRead: (state, action) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification) {
        notification.read = true;
      }
    },
    
    setLoading: (state, action) => {
      const { type, value } = action.payload;
      state.loading[type] = value;
    },
    clearAllLoading: (state) => {
      Object.keys(state.loading).forEach(key => {
        state.loading[key] = false;
      });
    },
    
    // Close all modals and sidebars
    closeAllModals: (state) => {
      state.isSidebarOpen = false;
      state.isSearchOpen = false;
      state.mobileMenuOpen = false;
      state.cartSidebarOpen = false;
      state.wishlistSidebarOpen = false;
      state.isQuickViewOpen = false;
      state.quickViewProduct = null;
    },
  },
});

export const {
  toggleSidebar,
  closeSidebar,
  openSidebar,
  toggleSearch,
  closeSearch,
  openSearch,
  toggleMobileMenu,
  closeMobileMenu,
  toggleCartSidebar,
  closeCartSidebar,
  openCartSidebar,
  toggleWishlistSidebar,
  closeWishlistSidebar,
  openWishlistSidebar,
  openQuickView,
  closeQuickView,
  setTheme,
  toggleTheme,
  setSearchQuery,
  clearSearchQuery,
  addNotification,
  removeNotification,
  clearNotifications,
  markNotificationAsRead,
  setLoading,
  clearAllLoading,
  closeAllModals,
} = uiSlice.actions;

// Selectors
export const selectIsSidebarOpen = (state) => state.ui.isSidebarOpen;
export const selectIsSearchOpen = (state) => state.ui.isSearchOpen;
export const selectTheme = (state) => state.ui.theme;
export const selectMobileMenuOpen = (state) => state.ui.mobileMenuOpen;
export const selectCartSidebarOpen = (state) => state.ui.cartSidebarOpen;
export const selectWishlistSidebarOpen = (state) => state.ui.wishlistSidebarOpen;
export const selectQuickViewProduct = (state) => state.ui.quickViewProduct;
export const selectIsQuickViewOpen = (state) => state.ui.isQuickViewOpen;
export const selectNotifications = (state) => state.ui.notifications;
export const selectUnreadNotifications = (state) => 
  state.ui.notifications.filter(n => !n.read);
export const selectSearchQuery = (state) => state.ui.searchQuery;
export const selectLoading = (state) => state.ui.loading;

export default uiSlice.reducer;


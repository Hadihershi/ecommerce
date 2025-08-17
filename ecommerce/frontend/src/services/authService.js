import api from './api';

const authService = {
  // Authentication endpoints
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    
    // Set token in axios headers for future requests
    if (response.data.token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
    }
    
    return response;
  },

  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    
    // Set token in axios headers for future requests
    if (response.data.token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
    }
    
    return response;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      // Always clear the token from headers
      delete api.defaults.headers.common['Authorization'];
    }
  },

  getProfile: async () => {
    return await api.get('/auth/me');
  },

  updateProfile: async (profileData) => {
    const formData = new FormData();
    
    // Handle file upload
    if (profileData.avatar && profileData.avatar instanceof File) {
      formData.append('userAvatar', profileData.avatar);
      delete profileData.avatar;
    }
    
    // Add other profile data
    Object.keys(profileData).forEach(key => {
      if (profileData[key] !== null && profileData[key] !== undefined) {
        if (typeof profileData[key] === 'object') {
          formData.append(key, JSON.stringify(profileData[key]));
        } else {
          formData.append(key, profileData[key]);
        }
      }
    });

    return await api.put('/auth/profile', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  changePassword: async (passwordData) => {
    return await api.put('/auth/change-password', passwordData);
  },

  forgotPassword: async (email) => {
    return await api.post('/auth/forgot-password', { email });
  },

  deleteAccount: async (password) => {
    return await api.delete('/auth/delete-account', { 
      data: { password } 
    });
  },

  // Token management
  setAuthToken: (token) => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  },

  getAuthToken: () => {
    return api.defaults.headers.common['Authorization'];
  },
};

export default authService;


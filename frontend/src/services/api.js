import { getApiBaseUrl } from '../utils/apiConfig';

const API_BASE = getApiBaseUrl();
const TOKEN_STORAGE_KEY = 'csjmu_admin_jwt_token';
const USER_STORAGE_KEY = 'csjmu_admin_user_data';

export const getAdminToken = () => {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || null;
  } catch (e) {
    return null;
  }
};

export const setAdminSession = (token, user) => {
  try {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      if (user) localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent('csjmu_admin_auth_changed', { detail: { token, user } }));
  } catch (e) {
    console.error('Failed to set admin session in localStorage', e);
  }
};

export const clearAdminSession = () => {
  setAdminSession(null, null);
};

export const getAdminUser = () => {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

export const isAdminAuthenticated = () => {
  return !!getAdminToken();
};

const getAuthHeaders = (additionalHeaders = {}) => {
  const token = getAdminToken();
  const headers = { ...additionalHeaders };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const apiService = {
  // Check if admin is currently authenticated
  isAdmin: () => isAdminAuthenticated(),
  getAdminUser: () => getAdminUser(),
  logout: () => clearAdminSession(),

  // Admin Authentication (POST /api/auth/login)
  login: async (username, password) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.success && data.token) {
        setAdminSession(data.token, data.user);
      }
      return data;
    } catch (err) {
      console.error('API login failed:', err);
      return { success: false, message: 'Could not connect to backend server' };
    }
  },

  // Verify token validity with server
  verifyToken: async () => {
    const token = getAdminToken();
    if (!token) return { success: false };
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify`, {
        headers: getAuthHeaders()
      });
      return await res.json();
    } catch (err) {
      return { success: false };
    }
  },

  // File Upload (Protected: Admins only)
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData
    });
    return res.json();
  },

  // Locations CRUD
  // Public: Get all locations (available to students and visitors)
  getLocations: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/locations`);
      return await res.json();
    } catch (err) {
      return { success: false, locations: [] };
    }
  },

  // Protected: Only Admin can save/pin locations
  saveLocation: async (payload) => {
    const res = await fetch(`${API_BASE}/api/locations`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  // Protected: Only Admin can delete locations
  deleteLocation: async (id) => {
    const res = await fetch(`${API_BASE}/api/locations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return res.json();
  },

  // Rooms CRUD (SBM Classrooms)
  getRooms: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/rooms`);
      return await res.json();
    } catch (err) {
      return { success: false, rooms: [] };
    }
  },

  saveRoom: async (payload) => {
    const res = await fetch(`${API_BASE}/api/rooms`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  deleteRoom: async (id) => {
    const res = await fetch(`${API_BASE}/api/rooms/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return res.json();
  },

  // Watercoolers CRUD
  getWatercoolers: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/watercoolers`);
      return await res.json();
    } catch (err) {
      return { success: false, watercoolers: [] };
    }
  },

  saveWatercooler: async (payload) => {
    const res = await fetch(`${API_BASE}/api/watercoolers`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    });
    return res.json();
  },

  deleteWatercooler: async (id) => {
    const res = await fetch(`${API_BASE}/api/watercoolers/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return res.json();
  }
};

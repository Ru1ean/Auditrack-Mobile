// api.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// 🔥 CHANGE THIS ONLY when your IP changes

export const BASE_URL = 'http://192.168.1.6:5000/api';

// 🔑 Unified token getter (works on web + mobile)
const getToken = async (): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem('token');
    } else {
      return await AsyncStorage.getItem('token');
    }
  } catch (err) {
    console.log('TOKEN ERROR:', err);
    return null;
  }
};

// 🔑 Unified token setter
export const setToken = async (token: string) => {
  if (Platform.OS === 'web') {
    localStorage.setItem('token', token);
  } else {
    await AsyncStorage.setItem('token', token);
  }
};

// 🔑 Optional: remove token (for logout)
export const removeToken = async () => {
  if (Platform.OS === 'web') {
    localStorage.removeItem('token');
  } else {
    await AsyncStorage.removeItem('token');
  }
};

// 🌐 Main request handler
const request = async (
  endpoint: string,
  method: string = 'GET',
  data?: any
) => {
  try {
    const token = await getToken();

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    const text = await res.text();
    console.log('API RAW RESPONSE:', text);
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      console.log('API JSON ERROR:', e);
      throw new Error('Invalid JSON response from server.');
    }

    if (!res.ok) {
      throw new Error(json.message || 'Request failed');
    }

    return json;
  } catch (error: any) {
    console.log('API ERROR:', error.message);
    throw error;
  }
};

// 📦 Export API methods
export const api = {
  get: (endpoint: string) => request(endpoint, 'GET'),

  post: (endpoint: string, data: any) =>
    request(endpoint, 'POST', data),

  put: (endpoint: string, data: any) =>
    request(endpoint, 'PUT', data),

  delete: (endpoint: string) =>
    request(endpoint, 'DELETE'),
};
// api.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, UploadType } from 'expo-file-system';
import { Platform } from 'react-native';

// Change this only when your API host changes.

const DEFAULT_API_BASE_URL = 'http://192.168.1.4:5000';

const normalizeBaseUrl = (url: string) => url.trim().replace(/\/+$/, '');

export const API_BASE_URL = normalizeBaseUrl(
  DEFAULT_API_BASE_URL
);

export const BASE_URL = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL
  : `${API_BASE_URL}/api`;

export const apiUrl = (endpoint = '') => {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${BASE_URL}${normalizedEndpoint}`;
};

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

export const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
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

    const res = await fetch(apiUrl(endpoint), {
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

type UploadUserFileInput = {
  fileUri: string;
  fileName: string;
  mimeType?: string;
  requirementId: string;
  userId: string;
};

const parseUploadResponse = (body: string, status: number) => {
  let json;
  try {
    json = JSON.parse(body);
  } catch (e) {
    console.log('API JSON ERROR:', e);
    throw new Error('Invalid JSON response from server.');
  }

  if (status < 200 || status >= 300) {
    throw new Error(json.message || 'Request failed');
  }

  return json;
};

const uploadUserFileRequest = async ({
  fileUri,
  fileName,
  mimeType,
  requirementId,
  userId,
}: UploadUserFileInput) => {
  const token = await getToken();
  const endpoint = '/requirements/user-upload';

  if (Platform.OS === 'web') {
    const formData = new FormData();
    const fileResponse = await fetch(fileUri);
    const blob = await fileResponse.blob();
    formData.append('file', blob, fileName);
    formData.append('userId', userId);
    formData.append('requirementId', requirementId);
    return requestFormData(endpoint, formData, 'POST');
  }

  const file = new File(fileUri);
  const result = await file.upload(apiUrl(endpoint), {
    uploadType: UploadType.MULTIPART,
    fieldName: 'file',
    mimeType: mimeType || 'application/octet-stream',
    parameters: {
      userId,
      requirementId,
    },
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  console.log('API RAW RESPONSE:', result.body);
  return parseUploadResponse(result.body, result.status);
};

const requestFormData = async (
  endpoint: string,
  formData: FormData,
  method: string = 'POST'
) => {
  try {
    const token = await getToken();

    const res = await fetch(apiUrl(endpoint), {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
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
export const connect = {
  get: (endpoint: string) => request(endpoint, 'GET'),
  post: (endpoint: string, data: any) =>
    request(endpoint, 'POST', data),
  put: (endpoint: string, data: any) =>
    request(endpoint, 'PUT', data),
  delete: (endpoint: string) =>
    request(endpoint, 'DELETE'),
};

// ========================
// Users/Auth API
// ========================
export const usersAPI = {
  login: async (credentials: any) => (await request('/user/login', 'POST', credentials)),
  register: async (userData: any) => (await request('/user/register', 'POST', userData)),
  getLoggedInUser: async () => (await request('/user/me', 'GET')),
  getAllUsers: async () => (await request('/user', 'GET')),
  updateUser: async (userId: string, data: any) => (await request(`/user/${userId}`, 'PUT', data)),
  updateApprovalStatus: async (userId: string, approvalStatus: string) =>
    (await request(`/user/${userId}/approval-status`, 'PUT', { approval_status: approvalStatus })),
  updateUserRole: async (userId: string, roleId: number) =>
    (await request(`/user/${userId}/role`, 'PUT', { roleId })),
};

// ========================
// Events API
// ========================
export const eventsAPI = {
  getAllEvents: async () => (await request('/events', 'GET')),
  addEvent: async (eventData: any) => (await request('/events/add', 'POST', eventData)),
  updateEvent: async (eventId: string, eventData: any) =>
    (await request(`/events/update/${eventId}`, 'PUT', eventData)),
  copyEvent: async (data: any) => (await request('/events/copy', 'POST', data)),
  deleteEvents: async (eventIds: string[]) =>
    (await request('/events/delete', 'POST', { eventIds })),
  getDownloadableFolders: async () => (await request('/events/downloadable-folders', 'GET')),
};

// ========================
// Requirements API
// ========================
export const requirementsAPI = {
  getAllRequirements: async (eventId?: string) => {
    const query = eventId ? `?eventId=${encodeURIComponent(String(eventId))}` : '';
    return await request(`/requirements/all${query}`, 'GET');
  },
  getByCriteria: async (criteriaId: string) => (await request(`/requirements/criteria/${criteriaId}`, 'GET')),
  getRequirementsByEvent: async (eventId: string) =>
    (await request(`/requirements/event/${eventId}`, 'GET')),
  addRequirement: async (data: any) => (await request('/requirements/add', 'POST', data)),
  updateRequirement: async (id: string, data: any) =>
    (await request(`/requirements/update/${id}`, 'PUT', data)),
  deleteRequirements: async (ids: string[]) =>
    (await request('/requirements/delete', 'POST', { requirementIds: ids })),
  getMyAssignments: async () => (await request('/requirements/my-assignments', 'GET')),
  markUserAsUploaded: async (requirementId: string, userId: string) =>
    (await request('/requirements/mark-uploaded', 'POST', { requirementId, userId })),
  getAssignedUsers: async (requirementId: string, officeId?: string) => {
    const query = officeId ? `?officeId=${encodeURIComponent(officeId)}` : '';
    try {
      return await request(`/requirements/assigned-users/${requirementId}${query}`, 'GET');
    } catch {
      try {
        return await request(`/requirements/${requirementId}/assigned-users${query}`, 'GET');
      } catch {
        return await request(`/requirements/${requirementId}/assignments${query}`, 'GET');
      }
    }
  },
  getAvailableUsersForAssignment: async (requirementId: string, officeId?: string) => {
    const query = new URLSearchParams({
      requirementId: String(requirementId),
      ...(officeId ? { officeId: String(officeId) } : {}),
    }).toString();
    return await request(`/requirements/available-users?${query}`, 'GET');
  },
  assignUsersToRequirement: async (
    requirementId: string,
    officeId: string,
    userIds: number[],
    assignedBy?: number
  ) => {
    return await request('/requirements/assign-users', 'POST', {
      requirementId,
      officeId,
      userIds,
      assignedBy,
    });
  },
  removeUserAssignment: async (assignmentId: string) => {
    return await request(`/requirements/assignment/${assignmentId}`, 'DELETE');
  },
  updateUserUploadStatus: async (assignmentId: string, hasUploaded: boolean) => {
    return await request(`/requirements/assignment/${assignmentId}/upload-status`, 'PUT', { hasUploaded });
  },
  uploadUserFile: uploadUserFileRequest,
  deleteUserFile: async (requirementId: string, userId: string) => {
    return await request(`/requirements/${requirementId}/file/${userId}`, 'DELETE');
  },
  getUserFile: async (requirementId: string, userId: string) => {
    try {
      return await request(`/requirements/${requirementId}/user-file/${userId}`, 'GET');
    } catch {
      return await request(`/requirements/${requirementId}/file/${userId}`, 'GET');
    }
  },
};

// ========================
// Offices API
// ========================
export const officesAPI = {
  getAll: async () => (await request('/offices', 'GET')),
  createOffice: async (data: any) => (await request('/offices', 'POST', data)),
  updateOffice: async (id: string, data: any) => (await request(`/offices/${id}`, 'PUT', data)),
  deleteOffice: async (id: string) => (await request(`/offices/${id}`, 'DELETE')),
  getOfficeRequirements: async (officeId: string) =>
    (await request(`/offices/${officeId}/requirements`, 'GET')),
  addOfficeRequirements: async (officeId: string, requirementIds: number[]) =>
    (await request(`/offices/${officeId}/requirements`, 'POST', { requirementIds })),
  updateOfficeRequirementStatus: async (
    officeId: string,
    requirementId: string,
    data: { statusId?: number; comments?: string }
  ) => {
    try {
      return await request(`/offices/${officeId}/requirements/${requirementId}/status`, 'PUT', data);
    } catch {
      return await request(`/requirements/${requirementId}/status`, 'PUT', data);
    }
  },
  getRequirementAssignedUsers: async (officeId: string, requirementId: string) => {
    const officeQuery = `?officeId=${encodeURIComponent(officeId)}`;
    try {
      return await request(`/requirements/assigned-users/${requirementId}${officeQuery}`, 'GET');
    } catch {
      try {
        return await request(`/offices/${officeId}/requirements/${requirementId}/assigned-users`, 'GET');
      } catch {
        try {
          return await request(`/requirements/${requirementId}/assigned-users${officeQuery}`, 'GET');
        } catch {
          return await request(`/requirements/${requirementId}/assignments${officeQuery}`, 'GET');
        }
      }
    }
  },
};

// ========================
// Areas API
// ========================
export const areasAPI = {
  getAll: async () => (await request('/areas', 'GET')),
  getByEvent: async (eventId: string) => (await request(`/areas/event/${eventId}`, 'GET')),
  addArea: async (areaData: any) => (await request('/areas/add', 'POST', areaData)),
  updateArea: async (id: string, areaData: any) => {
    try {
      return await request(`/areas/${id}`, 'PUT', areaData);
    } catch {
      return await request(`/areas/update/${id}`, 'PUT', areaData);
    }
  },
  deleteAreas: async (areaIds: string[]) => (await request('/areas/delete', 'POST', { areaIds })),
};

// ========================
// Criteria API
// ========================
export const criteriaAPI = {
  getAll: async () => (await request('/criteria', 'GET')),
  getByArea: async (areaId: string) => (await request(`/criteria/area/${areaId}`, 'GET')),
  getByEvent: async (eventId: string) => (await request(`/criteria/event/${eventId}`, 'GET')),
  updateCriteria: async (id: string, data: any) => {
    try {
      return await request(`/criteria/${id}`, 'PUT', data);
    } catch {
      return await request(`/criteria/update/${id}`, 'PUT', data);
    }
  },
  deleteCriteria: async (ids: string[]) => (await request('/criteria/delete', 'DELETE')),
  addCriteria: async (data: any) => (await request('/criteria/add', 'POST', data)),
};

// ========================
// Office Types API
// ========================
export const officetypesAPI = {
  getAll: async () => (await request('/officestypes', 'GET')),
  getById: async (id: string) => (await request(`/officestypes/${id}`, 'GET')),
  create: async (data: any) => (await request('/officestypes', 'POST', data)),
  update: async (id: string, data: any) => (await request(`/officestypes/${id}`, 'PUT', data)),
  delete: async (id: string) => (await request(`/officestypes/${id}`, 'DELETE')),
};

// ========================
// Office Heads API
// ========================
export const officeHeadsAPI = {
  getAllHeads: async () => (await request('/officeheads/all', 'GET')),
  addHead: async (formData: any) => (await request('/officeheads/add', 'POST', formData)),
  getHeadById: async (id: string) => (await request(`/officeheads/${id}`, 'GET')),
  updateHead: async (id: string, formData: any) => (await request(`/officeheads/${id}`, 'PUT', formData)),
  deleteHeads: async (headIds: string[]) => (await request('/officeheads/delete', 'DELETE', { headIds })),
};

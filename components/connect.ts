// api.ts - Compliance Audit Mobile API Client
// Connected to the shared backend used by Compliance-audit-web

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const DEFAULT_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || '';

const normalizeBaseUrl = (url: string) => url.trim().replace(/\/+$/, '');

export const API_BASE_URL = normalizeBaseUrl(DEFAULT_API_BASE_URL);

export const BASE_URL = API_BASE_URL.endsWith('/api')
  ? API_BASE_URL
  : `${API_BASE_URL}/api`;

export const SUPABASE_PROFILE_STORAGE = normalizeBaseUrl(
  process.env.EXPO_PUBLIC_SUPABASE_PROFILE_STORAGE || ''
);

export const apiUrl = (endpoint = '') => {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${BASE_URL}${normalizedEndpoint}`;
};

// 🔑 Unified token getter
export const getToken = async (): Promise<string | null> => {
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

// 🔑 Remove token
export const removeToken = async () => {
  if (Platform.OS === 'web') {
    localStorage.removeItem('token');
  } else {
    await AsyncStorage.removeItem('token');
  }
};

// 👤 Normalized User Object Helper
export const normalizeUser = (u: any) => {
  if (!u) return null;
  const userid = Number(u.userid ?? u.UserID ?? u.id ?? 0);
  const roleid = Number(u.roleid ?? u.RoleID ?? u.role_id ?? 0);
  const rolename = String(u.rolename ?? u.RoleName ?? u.role_name ?? '').toLowerCase();
  const isAdmin = roleid === 1 || rolename === 'admin' || rolename.includes('admin');
  const isAuditor = !isAdmin && (roleid === 4 || rolename.includes('auditor') || Boolean(u.isExternalAuditor));
  const isPersonnel =
    !isAdmin &&
    !isAuditor &&
    (roleid === 2 ||
      roleid === 3 ||
      rolename.includes('personnel') ||
      rolename.includes('office') ||
      rolename === 'user' ||
      rolename === 'head');
  const firstname = u.firstname ?? u.FirstName ?? '';
  const lastname = u.lastname ?? u.LastName ?? '';
  const middleinitial = u.middleinitial ?? u.MiddleInitial ?? '';
  const email = u.Email ?? u.email ?? '';
  const profilepic = u.profilepic ?? u.ProfilePic ?? u.profile_pic ?? null;
  const assignedArea = u.assignedArea ?? u.assignedarea ?? u.AssignedAreas ?? null;

  return {
    ...u,
    userid,
    id: userid,
    UserID: userid,
    roleid,
    RoleID: roleid,
    rolename: u.rolename || (isAdmin ? 'Admin' : isAuditor ? 'External Auditor' : 'Office Personnel'),
    RoleName: u.rolename || (isAdmin ? 'Admin' : isAuditor ? 'External Auditor' : 'Office Personnel'),
    firstname,
    FirstName: firstname,
    lastname,
    LastName: lastname,
    middleinitial,
    MiddleInitial: middleinitial,
    email,
    Email: email,
    profilepic,
    ProfilePic: profilepic,
    profile_pic: profilepic,
    assignedArea,
    isAdmin,
    isAuditor,
    isPersonnel,
  };
};

export const getStoredUser = async (): Promise<any | null> => {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web') {
      raw = localStorage.getItem('user');
    } else {
      raw = await AsyncStorage.getItem('user');
    }
    if (raw) {
      return normalizeUser(JSON.parse(raw));
    }
  } catch (e) {
    console.warn('Error reading stored user:', e);
  }
  return null;
};

export const storeUser = async (user: any) => {
  const normalized = normalizeUser(user);
  if (!normalized) return;
  const str = JSON.stringify(normalized);
  if (Platform.OS === 'web') {
    localStorage.setItem('user', str);
  } else {
    await AsyncStorage.setItem('user', str);
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
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response: ${text.slice(0, 100)}`);
    }

    if (!res.ok) {
      throw new Error(json.message || `Request failed with status ${res.status}`);
    }

    return json;
  } catch (error: any) {
    console.log(`API ERROR [${method} ${endpoint}]:`, error.message);
    throw error;
  }
};

// Multipart form data request handler
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
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON response: ${text.slice(0, 100)}`);
    }

    if (!res.ok) {
      throw new Error(json.message || `Request failed with status ${res.status}`);
    }

    return json;
  } catch (error: any) {
    console.log(`FORM DATA ERROR [${method} ${endpoint}]:`, error.message);
    throw error;
  }
};

export type UploadUserFileInput = {
  fileUri: string;
  fileName: string;
  mimeType?: string;
  requirementId: string | number;
  userId: string | number;
  officeId?: string | number;
  displayName?: string;
  comment?: string;
};

const uploadUserFileRequest = async ({
  fileUri,
  fileName,
  mimeType,
  requirementId,
  userId,
  officeId,
  displayName,
  comment,
}: UploadUserFileInput) => {
  const endpoint = '/requirements/user-upload';

  // On Native Mobile (iOS/Android), use FileSystem.uploadAsync to reliably stream multipart uploads without WinterCG FormData issues
  if (Platform.OS !== 'web') {
    const token = await getToken();
    const targetUrl = apiUrl(endpoint);

    try {
      const uploadRes = await FileSystem.uploadAsync(targetUrl, fileUri, {
        httpMethod: 'POST',
        uploadType: ((FileSystem as any).FileSystemUploadType?.MULTIPART ?? 1) as any,
        fieldName: 'file',
        parameters: {
          userid: String(userId),
          userId: String(userId),
          requirementid: String(requirementId),
          requirementId: String(requirementId),
          ...(officeId ? { officeid: String(officeId), officeId: String(officeId) } : {}),
          ...(displayName ? { displayname: String(displayName), displayName: String(displayName) } : {}),
          ...(comment ? { comment: String(comment) } : {}),
        },
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: 'application/json',
        },
      });

      let json: any = {};
      try {
        json = JSON.parse(uploadRes.body || '{}');
      } catch {
        throw new Error(`Invalid server response: ${uploadRes.body?.slice(0, 100)}`);
      }

      if (uploadRes.status >= 400) {
        throw new Error(json.message || `Upload failed with status ${uploadRes.status}`);
      }

      return json;
    } catch (nativeErr: any) {
      console.warn('FileSystem.uploadAsync failed, attempting FormData fallback:', nativeErr);
      // Fall through to FormData fallback below
    }
  }

  // Fallback (or Web): standard fetch with FormData
  const formData = new FormData();
  if (Platform.OS === 'web') {
    try {
      const fileResponse = await fetch(fileUri);
      const blob = await fileResponse.blob();
      formData.append('file', blob, fileName);
    } catch {
      (formData as any).append('file', {
        uri: fileUri,
        name: fileName,
        type: mimeType || 'application/octet-stream',
      });
    }
  } else {
    // React Native native file object representation
    (formData as any).append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType || 'application/octet-stream',
    });
  }

  formData.append('userid', String(userId));
  formData.append('userId', String(userId));
  formData.append('requirementid', String(requirementId));
  formData.append('requirementId', String(requirementId));
  if (officeId) {
    formData.append('officeid', String(officeId));
    formData.append('officeId', String(officeId));
  }
  if (displayName) {
    formData.append('displayname', String(displayName));
    formData.append('displayName', String(displayName));
  }
  if (comment) {
    formData.append('comment', String(comment));
  }

  return requestFormData(endpoint, formData, 'POST');
};

// 🖼️ Unified Profile Picture URL Resolver (Matching Web SmartUserAvatar.jsx with Supabase Storage)
export const getProfilePicUrl = (userOrPic?: any): string | null => {
  if (!userOrPic) return null;
  const rawPic =
    typeof userOrPic === 'string'
      ? userOrPic
      : userOrPic?.profilepic ||
        userOrPic?.ProfilePic ||
        userOrPic?.profile_pic ||
        userOrPic?.profileimage ||
        userOrPic?.avatar ||
        userOrPic?.head_profile_pic ||
        userOrPic?.HeadProfilePic ||
        userOrPic?.TempPreview;

  if (!rawPic || rawPic === '/default-avatar.png') return null;
  if (typeof rawPic !== 'string') return null;
  const trimmed = rawPic.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;

  const serverOrigin = API_BASE_URL.replace(/\/api\/?$/, '');

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('file:')
  ) {
    return trimmed
      .replace('http://localhost:5000', serverOrigin)
      .replace('http://127.0.0.1:5000', serverOrigin);
  }

  // Strip local upload prefixes to check if it's a Supabase-stored profile picture
  const cleanName = trimmed
    .replace(/^\/?(api\/)?uploads\/profile-pics\//, '')
    .replace(/^\/?profile-pics\//, '')
    .replace(/^\//, '');
  if (
    SUPABASE_PROFILE_STORAGE &&
    (cleanName.startsWith('profilepic-') || cleanName.startsWith('profilepic'))
  ) {
    return `${SUPABASE_PROFILE_STORAGE}/${cleanName}`;
  }

  if (trimmed.startsWith('/api/uploads/')) {
    return `${serverOrigin}${trimmed.replace(/^\/api/, '')}`;
  }
  if (trimmed.startsWith('api/uploads/')) {
    return `${serverOrigin}/${trimmed.replace(/^api\//, '')}`;
  }
  if (trimmed.startsWith('/uploads/')) {
    return `${serverOrigin}${trimmed}`;
  }
  if (trimmed.startsWith('uploads/')) {
    return `${serverOrigin}/${trimmed}`;
  }
  if (trimmed.startsWith('/profile-pics/')) {
    return `${serverOrigin}/uploads${trimmed}`;
  }
  if (trimmed.startsWith('profile-pics/')) {
    return `${serverOrigin}/uploads/${trimmed}`;
  }
  return `${serverOrigin}/uploads/profile-pics/${trimmed}`;
};

// 📅 Deadline Countdown Helper (Matching Web frontend/src/utils/deadlineHelpers.js)
export interface DeadlineInfo {
  hasDeadline: boolean;
  daysLeft: number | null;
  status: 'completed' | 'overdue' | 'due-today' | 'urgent' | 'upcoming' | 'normal' | 'none';
  label: string;
  shortLabel: string;
  formattedDate: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  dotColor: string;
}

export const getDeadlineInfo = (deadline: any, isCompletedOrPercent: any = false): DeadlineInfo => {
  const isCompleted = Boolean(
    isCompletedOrPercent === true ||
      (typeof isCompletedOrPercent === 'number' && isCompletedOrPercent >= 100) ||
      (isCompletedOrPercent &&
        typeof isCompletedOrPercent === 'object' &&
        (Number(
          isCompletedOrPercent.completionPercent ??
            isCompletedOrPercent.completionpercent ??
            isCompletedOrPercent.compliance ??
            isCompletedOrPercent.compliancepercent ??
            0
        ) >= 100 ||
          isCompletedOrPercent.iscompleted === true ||
          isCompletedOrPercent.isCompleted === true))
  );

  if (!deadline) {
    return {
      hasDeadline: false,
      daysLeft: null,
      status: isCompleted ? 'completed' : 'none',
      label: isCompleted ? 'Completed (No deadline)' : 'No deadline set',
      shortLabel: isCompleted ? 'Completed' : 'No deadline',
      formattedDate: '',
      bgColor: isCompleted ? '#ecfdf5' : '#f1f5f9',
      textColor: isCompleted ? '#047857' : '#475569',
      borderColor: isCompleted ? '#a7f3d0' : '#e2e8f0',
      dotColor: isCompleted ? '#10b981' : '#94a3b8',
    };
  }

  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) {
    return {
      hasDeadline: false,
      daysLeft: null,
      status: isCompleted ? 'completed' : 'none',
      label: isCompleted ? 'Completed (No deadline)' : 'No deadline set',
      shortLabel: isCompleted ? 'Completed' : 'No deadline',
      formattedDate: '',
      bgColor: isCompleted ? '#ecfdf5' : '#f1f5f9',
      textColor: isCompleted ? '#047857' : '#475569',
      borderColor: isCompleted ? '#a7f3d0' : '#e2e8f0',
      dotColor: isCompleted ? '#10b981' : '#94a3b8',
    };
  }

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlineMidnight = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffMs = deadlineMidnight.getTime() - todayMidnight.getTime();
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const formattedDate = parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  if (isCompleted) {
    return {
      hasDeadline: true,
      daysLeft,
      status: 'completed',
      label: `Due ${formattedDate} (Completed)`,
      shortLabel: 'Completed',
      formattedDate,
      bgColor: '#ecfdf5',
      textColor: '#047857',
      borderColor: '#a7f3d0',
      dotColor: '#10b981',
    };
  }

  if (daysLeft < 0) {
    const overdueDays = Math.abs(daysLeft);
    return {
      hasDeadline: true,
      daysLeft,
      status: 'overdue',
      label: `Due ${formattedDate} (${overdueDays}d overdue)`,
      shortLabel: `${overdueDays}d overdue`,
      formattedDate,
      bgColor: '#fff1f2',
      textColor: '#be123c',
      borderColor: '#fecdd3',
      dotColor: '#f43f5e',
    };
  }

  if (daysLeft === 0) {
    return {
      hasDeadline: true,
      daysLeft: 0,
      status: 'due-today',
      label: `Due ${formattedDate} (Due today)`,
      shortLabel: 'Due today',
      formattedDate,
      bgColor: '#fff1f2',
      textColor: '#be123c',
      borderColor: '#fecdd3',
      dotColor: '#f43f5e',
    };
  }

  if (daysLeft <= 3) {
    return {
      hasDeadline: true,
      daysLeft,
      status: 'urgent',
      label: `Due ${formattedDate} (${daysLeft}d left)`,
      shortLabel: `${daysLeft}d left`,
      formattedDate,
      bgColor: '#fffbeb',
      textColor: '#b45309',
      borderColor: '#fde68a',
      dotColor: '#f59e0b',
    };
  }

  if (daysLeft <= 7) {
    return {
      hasDeadline: true,
      daysLeft,
      status: 'upcoming',
      label: `Due ${formattedDate} (${daysLeft}d left)`,
      shortLabel: `${daysLeft}d left`,
      formattedDate,
      bgColor: '#fffbeb',
      textColor: '#b45309',
      borderColor: '#fde68a',
      dotColor: '#f59e0b',
    };
  }

  return {
    hasDeadline: true,
    daysLeft,
    status: 'normal',
    label: `Due ${formattedDate} (${daysLeft}d left)`,
    shortLabel: `${daysLeft}d left`,
    formattedDate,
    bgColor: '#eef2ff',
    textColor: '#4338ca',
    borderColor: '#c7d2fe',
    dotColor: '#6366f1',
  };
};

export const uploadProfilePicRequest = async (
  userId: string | number,
  fileUri: string,
  fileName: string,
  mimeType?: string
) => {
  const endpoint = `/user/${userId}`;

  // On Native Mobile (iOS/Android), use FileSystem.uploadAsync
  if (Platform.OS !== 'web') {
    const token = await getToken();
    const targetUrl = apiUrl(endpoint);

    try {
      const uploadRes = await FileSystem.uploadAsync(targetUrl, fileUri, {
        httpMethod: 'PUT',
        uploadType: ((FileSystem as any).FileSystemUploadType?.MULTIPART ?? 1) as any,
        fieldName: 'profilepic',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          Accept: 'application/json',
        },
      });

      let json: any = {};
      try {
        json = JSON.parse(uploadRes.body || '{}');
      } catch {
        throw new Error(`Invalid server response: ${uploadRes.body?.slice(0, 100)}`);
      }

      if (uploadRes.status >= 400) {
        throw new Error(json.message || `Upload failed with status ${uploadRes.status}`);
      }

      if (json?.user) {
        json.user = normalizeUser(json.user);
        await storeUser(json.user);
      }
      return json;
    } catch (nativeErr: any) {
      console.warn('FileSystem.uploadAsync failed for profilepic, attempting FormData fallback:', nativeErr);
    }
  }

  // Fallback (or Web): standard fetch with FormData
  const formData = new FormData();
  if (Platform.OS === 'web') {
    try {
      const fileResponse = await fetch(fileUri);
      const blob = await fileResponse.blob();
      formData.append('profilepic', blob, fileName);
    } catch {
      (formData as any).append('profilepic', {
        uri: fileUri,
        name: fileName,
        type: mimeType || 'image/jpeg',
      });
    }
  } else {
    (formData as any).append('profilepic', {
      uri: fileUri,
      name: fileName,
      type: mimeType || 'image/jpeg',
    });
  }

  const res = await requestFormData(endpoint, formData, 'PUT');
  if (res?.user) {
    res.user = normalizeUser(res.user);
    await storeUser(res.user);
  }
  return res;
};

// 📦 Export generic API client
export const connect = {
  get: (endpoint: string) => request(endpoint, 'GET'),
  post: (endpoint: string, data?: any) => request(endpoint, 'POST', data),
  put: (endpoint: string, data?: any) => request(endpoint, 'PUT', data),
  patch: (endpoint: string, data?: any) => request(endpoint, 'PATCH', data),
  delete: (endpoint: string, data?: any) => request(endpoint, 'DELETE', data),
};

// ========================
// Users / Auth API
// ========================
export const usersAPI = {
  login: async (credentials: any) => await request('/user/login', 'POST', credentials),
  register: async (userData: any) => await request('/user/register', 'POST', userData),
  loginStatus: async (email: string) =>
    await request(`/user/login-status?email=${encodeURIComponent(email)}`, 'GET'),
  sendRegistrationOtp: async (data: any) => await request('/user/send-registration-otp', 'POST', data),
  verifyRegistrationOtp: async (data: any) => await request('/user/verify-registration-otp', 'POST', data),
  sendChangePasswordOtp: async (data: any = {}) =>
    await request('/user/change-password/send-otp', 'POST', data),
  verifyAndChangePassword: async (data: any) =>
    await request('/user/change-password/verify-and-change', 'POST', data),
  changePassword: async (data: any) => await request('/user/change-password', 'PUT', data),
  getLoggedInUser: async () => {
    const res = await request('/user/me', 'GET');
    if (res?.user) {
      res.user = normalizeUser(res.user);
    }
    return res;
  },
  getAllUsers: async () => await request('/user', 'GET'),
  updateUser: async (userId: string | number, data: any) => {
    return await request(`/user/${userId}`, 'PUT', data);
  },
  uploadProfilePic: uploadProfilePicRequest,
  updateApprovalStatus: async (userid: string | number, approvalstatus: string) => {
    return await request(`/user/${userid}/approval-status`, 'PUT', { approvalstatus });
  },
  updateUserRole: async (userid: string | number, roleid: string | number) => {
    return await request(`/user/${userid}/role`, 'PUT', { roleid });
  },
};

// ========================
// Office Heads API
// ========================
export const officeHeadsAPI = {
  addHead: async (formData: any) => {
    return await requestFormData('/officeheads/add', formData, 'POST');
  },
  addMultipleHeads: async (userIds: any[], position: string) => {
    return await request('/officeheads/add-multiple', 'POST', { userIds, position });
  },
  getAllHeads: async () => {
    try {
      const response = await request('/officeheads/all', 'GET');
      if (response && response.data) {
        return response.data;
      } else if (Array.isArray(response)) {
        return response;
      }
      return [];
    } catch (error) {
      console.log('getAllHeads error:', error);
      return [];
    }
  },
  getHeadById: async (id: string | number) => await request(`/officeheads/${id}`, 'GET'),
  updateHead: async (id: string | number, formData: any) => {
    return await requestFormData(`/officeheads/${id}`, formData, 'PUT');
  },
  deleteHeads: async (headIds: any[]) => {
    return await request('/officeheads/delete', 'DELETE', { headIds });
  },
};

// ========================
// Departments & Office Types API
// ========================
export const departmentsAPI = {
  getAll: async () => await request('/departments', 'GET'),
};

export const eventDepartmentsAPI = {
  getByEvent: async (eventId: string | number) =>
    await request(`/event-departments/event/${eventId}`, 'GET'),
};

export const officetypesAPI = {
  getAll: async () => await request('/officetypes', 'GET'),
};

// ========================
// Events API
// ========================
export const eventsAPI = {
  getAllEvents: async () => await request('/events', 'GET'),
  getAccreditationLevels: async () => await request('/events/accreditation-levels', 'GET'),
  getDownloadableFolders: async () => await request('/events/downloadable-folders', 'GET'),
};

// ========================
// Requirements & Evidence API (Shared with Web)
// ========================
export const requirementsAPI = {
  getAllRequirements: async (eventId?: string | number) => {
    const query = eventId ? `?eventId=${encodeURIComponent(String(eventId))}` : '';
    return await request(`/requirements/all${query}`, 'GET');
  },
  getByCriteria: async (criteriaId: string | number) =>
    await request(`/requirements/criteria/${criteriaId}`, 'GET'),
  getRequirementsByEvent: async (eventId: string | number) =>
    await request(`/requirements/event/${eventId}`, 'GET'),
  getMyAssignments: async () => await request('/requirements/my-assignments', 'GET'),
  getAssignedUsers: async (requirementId: string | number, officeId?: string | number) => {
    const query = officeId ? `?officeid=${encodeURIComponent(String(officeId))}` : '';
    return await request(`/requirements/assigned-users/${requirementId}${query}`, 'GET');
  },
  getUserFile: async (
    requirementId: string | number,
    userId: string | number,
    officeId?: string | number
  ) => {
    const query = officeId ? `?officeid=${encodeURIComponent(String(officeId))}` : '';
    return await request(`/requirements/${requirementId}/user-file/${userId}${query}`, 'GET');
  },
  uploadUserFile: uploadUserFileRequest,
  deleteEvidenceFile: async (
    requirementId: string | number,
    userId: string | number,
    fileId?: string | number
  ) => {
    const query = fileId ? `?fileId=${fileId}` : '';
    return await request(`/requirements/${requirementId}/file/${userId}${query}`, 'DELETE');
  },
  commentOnFile: async (
    requirementId: string | number,
    fileId: string | number,
    comment: string
  ) =>
    await request(`/requirements/${requirementId}/file/${fileId}/comment`, 'PATCH', { comment }),
  renameFile: async (
    requirementId: string | number,
    fileId: string | number,
    displayName: string
  ) =>
    await request(`/requirements/${requirementId}/file/${fileId}/rename`, 'PATCH', {
      displayName,
      displayname: displayName,
    }),
  reviewFile: async (
    requirementId: string | number,
    fileId: string | number,
    status: string,
    reason?: string
  ) =>
    await request(`/requirements/${requirementId}/file/${fileId}/review`, 'PATCH', { status, reason }),
  reorderFiles: async (
    requirementId: string | number,
    userId: string | number,
    orderedIds: number[]
  ) =>
    await request(`/requirements/${requirementId}/user-file/${userId}/reorder`, 'PATCH', { orderedIds }),
  updateUserUploadStatus: async (assignmentId: string | number, hasUploaded: boolean) =>
    await request(`/requirements/assignment/${assignmentId}/upload-status`, 'PUT', { hasUploaded }),
  markUserAsUploaded: async (requirementId: string | number, userId: string | number) =>
    await request('/requirements/mark-uploaded', 'POST', { requirementId, userId }),
  evaluateRequirement: async (
    requirementId: string | number,
    statusId: number,
    comments?: string
  ) =>
    await request(`/requirements/${requirementId}/status`, 'PUT', { statusId, comments }),
};

// ========================
// Personnel Assignments API (Area / Sub-area / Standard scope)
// ========================
export const personnelAssignmentsAPI = {
  getMyAssignments: async () => await request('/personnel-assignments/my-assignments', 'GET'),
  getByEvent: async (eventId: string | number) =>
    await request(`/personnel-assignments/event/${eventId}`, 'GET'),
  getByUser: async (userId: string | number, eventId?: string | number) => {
    const query = eventId ? `?eventid=${eventId}` : '';
    return await request(`/personnel-assignments/user/${userId}${query}`, 'GET');
  },
};

// ========================
// Areas API (External Auditor Assignments)
// ========================
export const areasAPI = {
  getAll: async () => await request('/areas', 'GET'),
  getByEvent: async (eventId: string | number) =>
    await request(`/areas/event/${eventId}`, 'GET'),
  getAuditorAssignments: async (userId: number | string) =>
    await request(`/areas/assignments/${userId}`, 'GET'),
  getAuditorsForOffice: async (officeId: number | string) =>
    await request(`/areas/auditors/office/${officeId}`, 'GET'),
};

// ========================
// Criteria API
// ========================
export const criteriaAPI = {
  getAll: async () => await request('/criteria', 'GET'),
  getByEvent: async (eventId: string | number) =>
    await request(`/criteria/event/${eventId}`, 'GET'),
  getByArea: async (areaId: string | number) =>
    await request(`/criteria/area/${areaId}`, 'GET'),
};

// ========================
// Offices API
// ========================
export const officesAPI = {
  getAll: async () => await request('/offices', 'GET'),
  getById: async (id: string | number) => await request(`/offices/${id}`, 'GET'),
  getOfficeRequirements: async (officeId: string | number) =>
    await request(`/offices/${officeId}/requirements`, 'GET'),
  updateOfficeRequirementStatus: async (
    officeId: string | number,
    requirementId: string | number,
    data: { statusId?: number; comments?: string }
  ) => {
    try {
      return await request(`/offices/${officeId}/requirements/${requirementId}/status`, 'PUT', data);
    } catch {
      return await request(`/requirements/${requirementId}/status`, 'PUT', data);
    }
  },
};

// ========================
// Notifications API
// ========================
export const notificationsAPI = {
  getUserNotifications: async (userId: string | number, filter: string = 'all') =>
    await request(`/notifications/user/${userId}?filter=${filter}`, 'GET'),
  getNotificationCounts: async (userId: string | number) =>
    await request(`/notifications/user/${userId}/counts`, 'GET'),
  markAsRead: async (notificationId: string | number) =>
    await request(`/notifications/${notificationId}/read`, 'PUT'),
  markAllAsRead: async (userId: string | number) =>
    await request(`/notifications/user/${userId}/read-all`, 'PUT'),
  deleteNotification: async (notificationId: string | number) =>
    await request(`/notifications/${notificationId}`, 'DELETE'),
};

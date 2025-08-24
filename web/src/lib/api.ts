import axios from 'axios';
import { ApiResponse, Workspace, Channel, BrandKit } from '@/types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/v1',
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Workspaces API
export const workspaceApi = {
  getAll: () => api.get<ApiResponse<Workspace[]>>('/workspaces'),
  getById: (id: string) => api.get<ApiResponse<Workspace>>(`/workspaces/${id}`),
  create: (data: { name: string; description?: string }) =>
    api.post<ApiResponse<Workspace>>('/workspaces', data),
  update: (id: string, data: { name?: string; description?: string }) =>
    api.put<ApiResponse<Workspace>>(`/workspaces/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/workspaces/${id}`),
};

// Channels API
export const channelApi = {
  getAll: (workspaceId?: string) =>
    api.get<ApiResponse<Channel[]>>('/channels', {
      params: workspaceId ? { workspaceId } : {},
    }),
  getById: (id: string) => api.get<ApiResponse<Channel>>(`/channels/${id}`),
  create: (data: {
    name: string;
    workspaceId: string;
    description?: string;
    brandKitId?: string;
    defaultRecipeId?: string;
  }) => api.post<ApiResponse<Channel>>('/channels', data),
  update: (
    id: string,
    data: {
      name?: string;
      description?: string;
      brandKitId?: string;
      defaultRecipeId?: string;
    }
  ) => api.put<ApiResponse<Channel>>(`/channels/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/channels/${id}`),
};

// BrandKits API
export const brandkitApi = {
  getAll: () => api.get<ApiResponse<BrandKit[]>>('/brandkits'),
  getById: (id: string) => api.get<ApiResponse<BrandKit>>(`/brandkits/${id}`),
  create: (data: Partial<BrandKit>) => api.post<ApiResponse<BrandKit>>('/brandkits', data),
  update: (id: string, data: Partial<BrandKit>) =>
    api.put<ApiResponse<BrandKit>>(`/brandkits/${id}`, data),
  delete: (id: string) => api.delete<ApiResponse<void>>(`/brandkits/${id}`),
};

// Assets API
export const assetApi = {
  ingest: (data: {
    url?: string;
    file?: {
      path: string;
      originalName: string;
      mimeType?: string;
      size?: number;
    };
    title?: string;
    description?: string;
    tags?: string[];
    workspaceId?: string;
  }) => {
    return api.post('/ingest', data);
  },
  
  getAssets: (params: {
    page?: number;
    limit?: number;
    type?: string;
    source?: string;
    search?: string;
  } = {}) => api.get('/assets', { params }),
  
  getAsset: (id: string) => api.get(`/assets/${id}`),
  
  deleteAsset: (id: string) => api.delete(`/assets/${id}`),
  
  batchIngest: (requests: Array<{
    url?: string;
    title?: string;
    description?: string;
    tags?: string[];
  }>) => api.post('/assets/batch', { requests }),
};

export default api;
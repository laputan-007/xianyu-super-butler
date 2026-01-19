import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

// Create axios instance with default config
const axiosInstance = axios.create({
  baseURL: '', // Use relative path (same origin)
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    return response.data;
  },
  (error) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.dispatchEvent(new Event('auth:logout'));
      window.location.href = '/';
    }

    // Return error data or message
    const errorMsg = error.response?.data?.message || error.response?.data?.msg || error.message || 'Network Error';
    return Promise.reject(new Error(errorMsg));
  }
);

// Export HTTP methods
export const get = <T = any>(url: string, params?: any, config?: AxiosRequestConfig): Promise<T> => {
  return axiosInstance.get(url, { ...config, params });
};

export const post = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  return axiosInstance.post(url, data, config);
};

export const put = <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
  return axiosInstance.put(url, data, config);
};

export const del = <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
  return axiosInstance.delete(url, config);
};

export default axiosInstance;

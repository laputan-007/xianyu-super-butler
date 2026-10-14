import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

const request: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // 实例上默认写死了 application/json，发 FormData 时必须去掉，
    // 否则表单会被当成 JSON 发送，后端 Form(...) 解析不到字段而返回 422。
    // 删掉后 axios 会自动补上带 boundary 的 multipart/form-data。
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error),
);

request.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      try {
        window.dispatchEvent(new Event('auth:logout'));
      } catch {
        /* no-op (SSR) */
      }
    }
    // FastAPI 的业务错误在 response.data.detail 里；不提取的话调用方只能拿到
    // "Request failed with status code 502" 这种无信息报错（如 vite 代理后端
    // 下线窗口、mtop 业务失败的真实原因都被吞掉）。
    const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return Promise.reject(new Error(detail));
    }
    return Promise.reject(error);
  },
);

export const get = async <T = unknown>(
  url: string,
  params?: Record<string, any>,
  config?: AxiosRequestConfig,
): Promise<T> => {
  const response = await request.get<T>(url, { params, ...config });
  return response.data;
};

export const post = async <T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> => {
  const response = await request.post<T>(url, data, config);
  return response.data;
};

export const put = async <T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> => {
  const response = await request.put<T>(url, data, config);
  return response.data;
};

export const patch = async <T = unknown>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> => {
  const response = await request.patch<T>(url, data, config);
  return response.data;
};

export const del = async <T = unknown>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> => {
  const response = await request.delete<T>(url, config);
  return response.data;
};

export default request;

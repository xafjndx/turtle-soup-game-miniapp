// utils/request.ts
// 统一请求封装

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  needAuth?: boolean;
}

interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

const BASE_URL = 'https://your-domain.com/api'; // 替换为实际后端地址

/**
 * 封装的请求方法
 */
export function request<T = any>(options: RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');

    // 需要登录但未登录
    if (options.needAuth !== false && !token) {
      wx.navigateTo({ url: '/pages/login/login' });
      reject(new Error('请先登录'));
      return;
    }

    wx.request({
      url: `${BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      success: (res: any) => {
        const data: ApiResponse<T> = res.data;

        if (data.code === 0) {
          resolve(data.data);
        } else if (data.code === 401) {
          // 登录过期
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.navigateTo({ url: '/pages/login/login' });
          reject(new Error('登录已过期'));
        } else {
          reject(new Error(data.message || '请求失败'));
        }
      },
      fail: (err) => {
        console.error('请求失败:', err);
        reject(new Error('网络错误，请稍后重试'));
      },
    });
  });
}

/**
 * GET 请求
 */
export function get<T = any>(url: string, data?: any): Promise<T> {
  return request<T>({ url, method: 'GET', data });
}

/**
 * POST 请求
 */
export function post<T = any>(url: string, data?: any): Promise<T> {
  return request<T>({ url, method: 'POST', data });
}

/**
 * PUT 请求
 */
export function put<T = any>(url: string, data?: any): Promise<T> {
  return request<T>({ url, method: 'PUT', data });
}

/**
 * DELETE 请求
 */
export function del<T = any>(url: string, data?: any): Promise<T> {
  return request<T>({ url, method: 'DELETE', data });
}

export default { request, get, post, put, del };
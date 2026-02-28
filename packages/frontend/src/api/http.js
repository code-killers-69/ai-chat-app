/**
 * 统一请求层 — 拦截器 + 指数退避重试 + Token 无感刷新
 */

const API_BASE = '/api';

// 最大重试次数（仅网络错误触发）
const MAX_RETRIES = 3;
// 基础退避时间 (ms)
const BASE_DELAY = 500;

class HttpClient {
  constructor() {
    this.token = localStorage.getItem('chat_token');
    this.refreshToken = localStorage.getItem('chat_refresh_token');
    this.user = JSON.parse(localStorage.getItem('chat_user') || 'null');

    // 正在刷新 token 的 Promise（防止并发刷新）
    this._refreshPromise = null;
  }

  // ─── Token 管理 ─────────────────────────────────────────

  setTokens({ token, refreshToken, user }) {
    this.token = token;
    if (refreshToken) {
      this.refreshToken = refreshToken;
      localStorage.setItem('chat_refresh_token', refreshToken);
    }
    if (user) {
      this.user = user;
      localStorage.setItem('chat_user', JSON.stringify(user));
    }
    localStorage.setItem('chat_token', token);
  }

  clearTokens() {
    this.token = null;
    this.refreshToken = null;
    this.user = null;
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_refresh_token');
    localStorage.removeItem('chat_user');
  }

  isLoggedIn() {
    return !!this.token;
  }

  getUser() {
    return this.user;
  }

  // ─── 认证方法 ───────────────────────────────────────────

  async register(username, password, nickname) {
    const data = await this.request('/user/register', {
      method: 'POST',
      body: { username, password, nickname },
      auth: false,
    });
    return data;
  }

  async login(username, password) {
    const data = await this.request('/user/login', {
      method: 'POST',
      body: { username, password },
      auth: false,
    });
    this.setTokens(data);
    return data;
  }

  logout() {
    this.clearTokens();
  }

  getHeaders(includeContentType = true) {
    return this._buildHeaders(includeContentType);
  }

  // ─── 请求头构建 ──────────────────────────────────────────

  _buildHeaders(includeContentType = true) {
    const headers = {};
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  // ─── Token 无感刷新 ─────────────────────────────────────

  async _doRefreshToken() {
    if (!this.refreshToken) {
      throw new Error('无 refreshToken，需重新登录');
    }

    const res = await fetch(`${API_BASE}/user/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
    });

    if (!res.ok) {
      this.clearTokens();
      throw new Error('刷新 token 失败，请重新登录');
    }

    const data = await res.json();
    if (!data.success) {
      this.clearTokens();
      throw new Error('刷新 token 失败，请重新登录');
    }

    this.setTokens(data.data);
    return data.data.token;
  }

  /**
   * 刷新 token（并发安全：多个 401 只会触发一次刷新）
   */
  async _refreshAccessToken() {
    if (!this._refreshPromise) {
      this._refreshPromise = this._doRefreshToken().finally(() => {
        this._refreshPromise = null;
      });
    }
    return this._refreshPromise;
  }

  // ─── 指数退避 ───────────────────────────────────────────

  _delay(attempt) {
    const ms = BASE_DELAY * Math.pow(2, attempt) + Math.random() * 200;
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ─── 核心请求方法 ───────────────────────────────────────

  /**
   * 通用 JSON 请求
   * @param {string} url - 相对路径，如 '/user/login'
   * @param {object} options
   * @param {string} [options.method='GET']
   * @param {object} [options.body] - JSON body
   * @param {boolean} [options.auth=true] - 是否带 token
   * @param {boolean} [options.retry=true] - 是否网络错误重试
   * @returns {Promise<any>} - data.data
   */
  async request(url, options = {}) {
    const {
      method = 'GET',
      body,
      auth = true,
      retry = true,
    } = options;

    const fullUrl = `${API_BASE}${url}`;

    const doFetch = (token) => {
      const headers = {};
      headers['Content-Type'] = 'application/json';
      if (auth && token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const init = { method, headers };
      if (body && method !== 'GET') {
        init.body = JSON.stringify(body);
      }
      return fetch(fullUrl, init);
    };

    // 带重试的请求
    let lastError;
    const maxAttempts = retry ? MAX_RETRIES : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        let res = await doFetch(this.token);

        // 401 → 尝试刷新 token 并重放
        if (res.status === 401 && auth && this.refreshToken) {
          try {
            const newToken = await this._refreshAccessToken();
            res = await doFetch(newToken);
          } catch {
            // refresh 也失败了，抛出原始 401
          }
        }

        if (!res.ok) {
          const errorData = await res.json().catch(() => null);
          const msg = errorData?.error || `请求失败 (${res.status})`;
          throw new Error(msg);
        }

        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        return data.data;

      } catch (error) {
        lastError = error;
        // 只对网络错误（非 HTTP 错误）重试
        if (error.name === 'TypeError' && retry && attempt < maxAttempts - 1) {
          await this._delay(attempt);
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  /**
   * FormData 请求（不设置 Content-Type，让浏览器自动设置 boundary）
   */
  async requestFormData(url, formData, options = {}) {
    const { method = 'POST', auth = true } = options;
    const fullUrl = `${API_BASE}${url}`;

    const doFetch = (token) => {
      const headers = {};
      if (auth && token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      return fetch(fullUrl, { method, headers, body: formData });
    };

    let res = await doFetch(this.token);

    if (res.status === 401 && auth && this.refreshToken) {
      try {
        const newToken = await this._refreshAccessToken();
        res = await doFetch(newToken);
      } catch {
        // refresh 失败
      }
    }

    if (!res.ok) {
      throw new Error(`请求失败 (${res.status})`);
    }

    return res;
  }

  /**
   * SSE 流式请求（返回 Response 对象，由调用方处理 stream）
   */
  async requestStream(url, options = {}) {
    const { method = 'POST', body, formData, auth = true } = options;
    const fullUrl = `${API_BASE}${url}`;

    const doFetch = (token) => {
      const headers = {};
      if (auth && token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const init = { method, headers };
      if (formData) {
        init.body = formData;
      } else if (body) {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(body);
      }
      return fetch(fullUrl, init);
    };

    let res = await doFetch(this.token);

    if (res.status === 401 && auth && this.refreshToken) {
      try {
        const newToken = await this._refreshAccessToken();
        res = await doFetch(newToken);
      } catch {
        // refresh 失败
      }
    }

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    return res;
  }
}

export const http = new HttpClient();

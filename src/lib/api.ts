import { getBackendUrl } from '../utils';

export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  ok: boolean;
  status: number;
}

// Programmatically show a beautiful floating toast for 405 Method Not Allowed blocking errors
export function show405Toast(url: string, method: string) {
  if (typeof document === 'undefined') return;
  
  // Check if a 405 toast is already visible to avoid spamming the screen
  if (document.getElementById('api-405-toast')) return;

  const toast = document.createElement('div');
  toast.id = 'api-405-toast';
  
  // Custom slide-up fade animation via tailwind classes
  toast.className = 'fixed bottom-5 right-5 z-[9999] max-w-sm sm:max-w-md bg-slate-900/95 border-2 border-red-500 text-white p-5 rounded-2xl shadow-[0_20px_50px_rgba(239,68,68,0.25)] flex flex-col gap-3 backdrop-blur-md transition-all duration-300 transform translate-y-0 opacity-100 font-sans';
  
  // Create beautiful icon and detailed info layout
  toast.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="w-10 h-10 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-center shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <div class="flex-1">
        <h4 class="text-sm font-extrabold text-red-400 tracking-wider uppercase">Proxy Blocking Request (405)</h4>
        <p class="text-[11px] text-slate-300 leading-relaxed mt-1 font-medium">
          The endpoint <code class="bg-slate-950 px-1 py-0.5 rounded text-red-300 font-mono text-[10px] break-all">${url}</code> blocked your <span class="font-extrabold text-white underline">${method}</span> request with status <span class="font-extrabold text-red-400">405 Method Not Allowed</span>.
        </p>
        <p class="text-[10px] text-slate-400 leading-relaxed mt-2 font-medium">
          This usually happens when your Cloudflare Worker, Proxy, or Pages setup blocks or misroutes POST/OPTIONS requests. Please configure it to forward all HTTP methods.
        </p>
      </div>
      <button id="close-405-toast" class="text-slate-500 hover:text-white transition-colors cursor-pointer p-1 rounded hover:bg-slate-800">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
    <div class="flex gap-2 justify-end border-t border-slate-800/60 pt-3">
      <button id="action-405-toast-config" class="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer">
        Configure Connection
      </button>
    </div>
  `;

  document.body.appendChild(toast);

  // Close handler with animation
  const closeBtn = toast.querySelector('#close-405-toast');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    });
  }

  // Configure action handler (opens backend URL modal in UI)
  const actionBtn = toast.querySelector('#action-405-toast-config');
  if (actionBtn) {
    actionBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('open-backend-config'));
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    });
  }

  // Auto-dismiss after 15 seconds
  setTimeout(() => {
    if (document.body.contains(toast)) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => {
        if (document.body.contains(toast)) toast.remove();
      }, 300);
    }
  }, 15000);
}

export async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    let url = path;
    if (path.startsWith('/api/')) {
      const backend = getBackendUrl();
      if (backend) {
        url = `${backend}${path}`;
      }
    }

    // Automatically construct headers
    const headers = new Headers(options.headers || {});
    
    // Auto-inject Authorization header if token exists and not already provided
    if (!headers.has('Authorization') && typeof window !== 'undefined') {
      const token = localStorage.getItem('streaming_token');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    }

    // Default Content-Type to JSON if not uploading FormData/File and body is present
    if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type');
    const text = await response.text();

    let data: any = null;
    let parseError: Error | null = null;

    if (text && contentType && contentType.toLowerCase().includes('application/json')) {
      try {
        data = JSON.parse(text);
      } catch (err: any) {
        parseError = err;
      }
    } else if (text) {
      try {
        data = JSON.parse(text);
      } catch (err: any) {
        data = { text };
        parseError = err;
      }
    }

    if (!response.ok) {
      let errMsg = `Request failed with status ${response.status}`;
      
      if (response.status === 405) {
        errMsg = `❌ Proxy / Worker Blocking Request (405): The endpoint "${url}" returned "405 Method Not Allowed". This usually happens when the API proxy, Cloudflare Worker, or hosting platform blocks or fails to route your HTTP ${options.method || 'GET'} request. Please ensure all HTTP methods (GET, POST, OPTIONS, etc.) are allowed and correctly routed.`;
        show405Toast(url, options.method || 'GET');
      } else if (data) {
        if (typeof data.error === 'string') {
          errMsg = data.error;
        } else if (data.error && typeof data.error === 'object' && typeof data.error.message === 'string') {
          errMsg = data.error.message;
        } else if (typeof data.message === 'string') {
          errMsg = data.message;
        } else if (data.error) {
          errMsg = JSON.stringify(data.error);
        }
      }
      return { data, error: errMsg, ok: false, status: response.status };
    }

    if (parseError && !data) {
      return { data: null, error: `Invalid server response format`, ok: false, status: response.status };
    }

    return { data, error: null, ok: true, status: response.status };
  } catch (err: any) {
    return { data: null, error: err.message || 'Network request failed', ok: false, status: 0 };
  }
}

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null; ok: boolean; status: number }> {
  const result = await request<T>(url, options);
  return {
    data: result.data,
    error: result.error,
    ok: result.ok,
    status: result.status
  };
}

export const client = {
  request,
  safeFetchJson,

  async get<T = any>(path: string, options?: Omit<RequestInit, 'method'>): Promise<ApiResponse<T>> {
    return request<T>(path, { ...options, method: 'GET' });
  },

  async post<T = any>(path: string, body?: any, options?: Omit<RequestInit, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return request<T>(path, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  },

  async put<T = any>(path: string, body?: any, options?: Omit<RequestInit, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return request<T>(path, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  },

  async delete<T = any>(path: string, options?: Omit<RequestInit, 'method'>): Promise<ApiResponse<T>> {
    return request<T>(path, { ...options, method: 'DELETE' });
  },

  async patch<T = any>(path: string, body?: any, options?: Omit<RequestInit, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }
};

/**
 * Safe fetch helper to completely prevent "Unexpected end of JSON input"
 * or HTML responses crashing the client JSON parser.
 */

export function getBackendUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('CUSTOM_BACKEND_URL');
    if (saved) return saved;

    const hostname = window.location.hostname;
    const isLocal = hostname.includes('localhost') || hostname.includes('127.0.0.1');
    const isCloudRun = hostname.includes('asia-southeast1.run.app');

    if (!isLocal && !isCloudRun) {
      return 'https://ais-pre-gdktx73fktfmi2csoflbea-269893392249.asia-southeast1.run.app';
    }
  }
  return '';
}

export function setBackendUrl(url: string) {
  if (typeof window !== 'undefined') {
    if (url) {
      let normalized = url.trim();
      if (normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
      }
      localStorage.setItem('CUSTOM_BACKEND_URL', normalized);
    } else {
      localStorage.removeItem('CUSTOM_BACKEND_URL');
    }
  }
}

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null; ok: boolean; status: number }> {
  try {
    let finalUrl = url;
    if (url.startsWith('/api/')) {
      const backend = getBackendUrl();
      if (backend) {
        finalUrl = `${backend}${url}`;
      }
    }
    const response = await fetch(finalUrl, options);
    const contentType = response.headers.get('content-type');
    
    // Read body as text first to handle empty responses or non-JSON errors
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
      // Fallback if not JSON but has some text
      try {
        // Just in case it actually was JSON but content-type header was missing/wrong
        data = JSON.parse(text);
      } catch (err: any) {
        data = { error: text };
        parseError = err;
      }
    }

    if (!response.ok) {
      let errMsg = `Request failed with status ${response.status}`;
      if (data) {
        if (typeof data.error === 'string') {
          errMsg = data.error;
        } else if (data.error && typeof data.error === 'object' && typeof data.error.message === 'string') {
          errMsg = data.error.message;
        } else if (typeof data.message === 'string') {
          errMsg = data.message;
        } else if (typeof data.error_description === 'string') {
          errMsg = data.error_description;
        } else if (data.error) {
          errMsg = JSON.stringify(data.error);
        }
      }
      return { data, error: errMsg, ok: false, status: response.status };
    }

    if (parseError) {
      return { data: null, error: `Invalid server response format`, ok: false, status: response.status };
    }

    return { data, error: null, ok: true, status: response.status };
  } catch (err: any) {
    return { data: null, error: err.message || 'Network request failed', ok: false, status: 0 };
  }
}

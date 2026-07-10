/**
 * Safe fetch helper to completely prevent "Unexpected end of JSON input"
 * or HTML responses crashing the client JSON parser.
 */
export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: string | null; ok: boolean; status: number }> {
  try {
    const response = await fetch(url, options);
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
      } catch {
        data = { error: text };
      }
    }

    if (!response.ok) {
      const errMsg = (data && (data.error || data.message)) || `Request failed with status ${response.status}`;
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

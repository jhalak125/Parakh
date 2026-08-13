import { ANALYZE_ENDPOINT, HEALTH_ENDPOINT } from './constants.js';

export async function checkBackendHealth() {
  try {
    const response = await fetch(HEALTH_ENDPOINT, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function analyzeProduct(payload) {
  const response = await fetch(ANALYZE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(errorBody.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

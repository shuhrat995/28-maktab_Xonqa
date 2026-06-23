const LOCAL_API_ORIGIN = 'http://localhost:3001';

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, '');
}

function getDefaultApiOrigin() {
  if (import.meta.env.DEV) return LOCAL_API_ORIGIN;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

const configuredApiOrigin =
  (import.meta.env.VITE_API_ORIGIN as string | undefined) ||
  (import.meta.env.VITE_API_URL as string | undefined) ||
  getDefaultApiOrigin();

export const API_ORIGIN = normalizeOrigin(configuredApiOrigin);

export const API_BASE_URL = `${API_ORIGIN}/api`;

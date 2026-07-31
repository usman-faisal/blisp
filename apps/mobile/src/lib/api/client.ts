import axios from 'axios';
import Constants from 'expo-constants';

/** Backend port. Must match PORT in apps/backend/.env. */
const API_PORT = 8080;

/**
 * Resolves the API base URL.
 *
 * In development the LAN IP changes every time the machine joins a different
 * network, so hardcoding it in .env.local means editing a file on every Wi-Fi
 * switch. The device already knows the dev machine's address — it fetched the
 * JS bundle from it — so derive the backend host from Metro's host instead.
 *
 * EXPO_PUBLIC_API_URL still wins when set, which is required for release
 * builds (no Metro) and useful for pointing at a staging server.
 */
function resolveApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) {
    return explicit;
  }

  // e.g. "192.168.18.217:8081" — populated in dev builds and Expo Go.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoGo?.developer?.hostUri;

  const host = hostUri?.split(':')[0];

  if (!host) {
    throw new Error(
      'Could not determine the API host. Set EXPO_PUBLIC_API_URL in apps/mobile/.env.local.',
    );
  }

  return `http://${host}:${API_PORT}`;
}

const API_URL = resolveApiUrl();

if (__DEV__) {
  console.log('[API] base URL:', `${API_URL}/api/v1`);
}

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error('[API Error]', error.response.status, JSON.stringify(error.response.data));
    } else {
      // No response at all — almost always the dev machine being unreachable
      // (different Wi-Fi, firewall, or the backend not running).
      console.error('[API Error] no response from', error.config?.baseURL, '-', error.message);
    }
    return Promise.reject(error);
  },
);

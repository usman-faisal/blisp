import { useEffect, useRef, ReactNode } from 'react';
import { useAuth } from '@clerk/expo';
import { apiClient } from '@/lib/api/client';

/**
 * Bridges Clerk auth into the Axios request pipeline.
 *
 * - A module-level ref holds the latest `getToken` from Clerk.
 * - A single interceptor (registered once, guarded by `interceptorId`)
 *   reads from that ref on every request.
 * - The component body updates the ref synchronously on each render,
 *   so children always fire requests with a valid token getter.
 */

type TokenGetter = () => Promise<string | null>;

const tokenRef: { current: TokenGetter } = { current: async () => null };
let interceptorId: number | null = null;

function ensureInterceptor() {
    if (interceptorId !== null) return;

    interceptorId = apiClient.interceptors.request.use(
        async (config) => {
            try {
                const token = await tokenRef.current();
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
            } catch (error) {
                console.error('[Auth] Failed to get token:', error);
            }
            return config;
        },
        (error) => Promise.reject(error),
    );
}

export function AxiosProvider({ children }: { children: ReactNode }) {
    const { getToken } = useAuth();

    // Sync the token getter before children render & fire queries
    tokenRef.current = getToken;
    ensureInterceptor();

    // Keep in sync when Clerk refreshes the session
    useEffect(() => {
        tokenRef.current = getToken;
    }, [getToken]);

    return <>{children}</>;
}
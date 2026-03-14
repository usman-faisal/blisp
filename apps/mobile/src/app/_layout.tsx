import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { setAuthToken } from "@/lib/api/client";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!

if (!publishableKey) {
    throw new Error('Add your Clerk Publishable Key to the .env file')
}

const queryClient = new QueryClient();

/**
 * Syncs the Clerk session token into the axios client whenever it changes.
 * Must be a child of <ClerkProvider> so useAuth() is available.
 */
function AuthTokenSync() {
    const { getToken, isSignedIn } = useAuth();

    useEffect(() => {
        if (!isSignedIn) {
            setAuthToken(null);
            return;
        }

        getToken().then((token) => setAuthToken(token));
    }, [isSignedIn, getToken]);

    return null;
}

export default function Layout() {
    return (
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
            <QueryClientProvider client={queryClient}>
                <AuthTokenSync />
                <Stack />
            </QueryClientProvider>
        </ClerkProvider>
    )
}
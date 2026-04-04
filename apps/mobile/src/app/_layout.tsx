import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { AxiosProvider } from "providers/AxiosProvider";
import { SafeAreaProvider } from 'react-native-safe-area-context';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!

if (!publishableKey) {
    throw new Error('Add your Clerk Publishable Key to the .env file')
}

const queryClient = new QueryClient();

export default function Layout() {
    return (
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
            <AxiosProvider>
                <QueryClientProvider client={queryClient}>
                    <SafeAreaProvider>
                        <Stack screenOptions={{ headerShown: false }} />
                    </SafeAreaProvider>
                </QueryClientProvider>
            </AxiosProvider>
        </ClerkProvider>
    )
}
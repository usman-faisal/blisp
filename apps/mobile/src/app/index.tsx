import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

/**
 * Routes "/" by auth state.
 *
 * Without this the root path resolves to whichever group the router finds
 * first, so a signed-in user could land on the auth stack — and sign-in's
 * `router.push('/')` had no route to land on at all.
 */
export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();

  // Clerk restores the cached session asynchronously. Rendering a redirect
  // before it settles would send a signed-in user to sign-up.
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={isSignedIn ? '/(tabs)' : '/(auth)/sign-in'} />;
}

import { Redirect } from 'expo-router';

/**
 * Legacy (home) group — redirects to the new (tabs) group.
 * Kept for backwards compatibility with any deep links pointing to /(home).
 */
export default function HomeRedirect() {
  return <Redirect href="/(tabs)" />;
}

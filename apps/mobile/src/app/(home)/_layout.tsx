import '../../../global.css';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useFonts } from 'expo-font';
import { InstrumentSans_400Regular } from "@expo-google-fonts/instrument-sans"
import { DMSerifDisplay_400Regular } from "@expo-google-fonts/dm-serif-display"

import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@clerk/expo'

export default function Layout() {
  const { isSignedIn, isLoaded } = useAuth()
  console.log('Auth status:', { isSignedIn, isLoaded })

  const [fontsLoaded] = useFonts({
    InstrumentSans: InstrumentSans_400Regular,
    DMSerifDisplay: DMSerifDisplay_400Regular,
  })
  if (!isLoaded) {
    return null
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />
  }



  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <Stack />
    </SafeAreaProvider>
  );
}

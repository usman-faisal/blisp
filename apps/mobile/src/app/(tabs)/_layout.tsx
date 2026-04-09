import '../../../global.css';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFonts } from 'expo-font';
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';

import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

import { useAuth } from '@clerk/expo';

const COLORS = {
  background: '#F7F4EF',
  surface: '#EFEAE2',
  activeIcon: '#C9A84C',
  inactiveIcon: '#B0AAA3',
  border: '#DDD8D0',
} as const;

export default function TabsLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({
    InstrumentSans: InstrumentSans_400Regular,
    DMSerifDisplay: DMSerifDisplay_400Regular,
  });

  if (!isLoaded) {
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!fontsLoaded) {
    return null;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.activeIcon,
        tabBarInactiveTintColor: COLORS.inactiveIcon,
        tabBarLabelStyle: {
          fontFamily: 'InstrumentSans',
          fontSize: 11,
          fontWeight: '500',
        },
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          elevation: 8,
          shadowColor: '#1A1714',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          height: (Platform.OS === 'ios' ? 88 : 64) + insets.bottom,
          paddingBottom: (Platform.OS === 'ios' ? 28 : 8) + insets.bottom,
          paddingTop: 8,
        },
        sceneStyle: {
          backgroundColor: COLORS.background,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Focus',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'flash' : 'flash-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="incubator"
        options={{
          title: 'Incubator',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'egg' : 'egg-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projects',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'rocket' : 'rocket-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
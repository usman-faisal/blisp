import '../../../global.css';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFonts } from 'expo-font';
import { InstrumentSans_400Regular } from '@expo-google-fonts/instrument-sans';
import { DMSerifDisplay_400Regular } from '@expo-google-fonts/dm-serif-display';

import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

import { useAuth } from '@clerk/expo';
import { useNotifications } from '@/hooks/useNotifications';

const COLORS = {
  background: '#F7F4EF',
  surface: '#EFEAE2',
  activeIcon: '#C9A84C',
  inactiveIcon: '#B0AAA3',
  border: '#DDD8D0',
  // brand.ember — the unread badge, deliberately not the flax active tint so it
  // reads as an alert rather than as selection.
  badge: '#E8612A',
} as const;

export default function TabsLayout() {
  const { isSignedIn, isLoaded } = useAuth();

  const insets = useSafeAreaInsets();

  // Lives on the layout so the badge shows from every tab, not only the one that
  // happens to fetch it. The notifications screen keeps its own copy of the list;
  // this is only the count.
  //
  // Polled rather than event-driven: the layout mounts once and survives tab
  // switches, so it never re-runs a focus effect of its own, and the count also
  // needs to move when someone else assigns you a task while you sit on a screen.
  // A single count query every 30s is cheap next to getting either wrong.
  const { unreadCount } = useNotifications({ pollMs: 30_000 });

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
          paddingBottom: (Platform.OS === 'ios' ? 4 : 8) + insets.bottom,
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
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'notifications' : 'notifications-outline'}
              size={size}
              color={color}
            />
          ),
          // The navigator draws and positions the badge itself, so there is no
          // absolutely-positioned child overlapping the tab's touch target —
          // which is what made the header bell unreliable to tap.
          tabBarBadge: unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: COLORS.badge,
            color: '#FFFFFF',
            fontFamily: 'InstrumentSans',
            fontSize: 10,
            fontWeight: '700',
          },
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
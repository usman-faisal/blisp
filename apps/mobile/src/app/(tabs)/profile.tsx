import { Container } from '@/components/ui/Container';
import Text from '@/components/ui/Text';
import { useProfile } from '@/hooks/useProfile';
import { useProjectStats } from '@/hooks/useProjectStats';
import { useAuth } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';

function SettingsRow({
  icon,
  label,
  subtitle,
  onPress,
  danger,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  subtitle?: string;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-x-4 rounded-2xl bg-core-surface-elevated px-4 py-3.5 active:opacity-70"
    >
      <View
        className={`h-10 w-10 items-center justify-center rounded-xl ${danger ? 'bg-semantic-danger/10' : 'bg-core-surface'
          }`}
      >
        <Ionicons
          name={icon}
          size={20}
          color={danger ? '#D94F3D' : '#6B6560'}
        />
      </View>
      <View className="flex-1">
        <Text
          className={`text-sm font-medium ${danger ? 'text-semantic-danger' : 'text-core-text-primary'
            }`}
        >
          {label}
        </Text>
        {subtitle && (
          <Text className="mt-0.5 text-xs text-core-text-disabled">
            {subtitle}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#B0AAA3" />
    </Pressable>
  );
}

function StatBadge({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <View className="flex-1 items-center rounded-2xl bg-core-surface-elevated py-4">
      <Text className="font-heading text-2xl text-core-text-primary">
        {value}
      </Text>
      <Text className="mt-0.5 text-xs text-core-text-secondary">{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { data: profile, isLoading } = useProfile();
  const { data: stats, isLoading: isStatsLoading } = useProjectStats();
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          setIsSigningOut(true);
          try {
            await signOut();
          } catch (error) {
            console.error('[Profile] Sign out failed:', error);
          } finally {
            setIsSigningOut(false);
          }
        },
      },
    ]);
  }, [signOut]);

  return (
    <Container className="bg-core-background px-4">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Header */}
        <View className="mt-4 mb-6">
          <Text className="font-heading text-3xl text-core-text-primary">
            Profile
          </Text>
        </View>

        {/* Profile card */}
        <View className="items-center rounded-3xl bg-core-surface-elevated p-6">
          {isLoading ? (
            <ActivityIndicator size="large" color="#C9A84C" />
          ) : (
            <>
              {/* Avatar */}
              <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-flax/20">
                <Text className="font-heading text-3xl text-brand-flax">
                  {(profile?.name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text className="mt-3 font-heading text-xl text-core-text-primary">
                {profile?.name || 'Explorer'}
              </Text>
              <Text className="mt-0.5 text-sm text-core-text-secondary">
                {profile?.email || 'your@email.com'}
              </Text>
            </>
          )}
        </View>

        {/* Stats */}
        <View className="mt-4 flex-row gap-3">
          <StatBadge value={isStatsLoading ? '-' : (stats?.activeCount ?? 0)} label="Active" />
          <StatBadge value={isStatsLoading ? '-' : (stats?.incubatingCount ?? 0)} label="Incubating" />
          <StatBadge value={isStatsLoading ? '-' : (stats?.completedCount ?? 0)} label="Completed" />
        </View>

        {/* Settings sections */}
        <View className="mt-6">
          <Text className="mb-3 text-xs font-semibold uppercase tracking-widest text-core-text-disabled">
            Preferences
          </Text>
          <View className="gap-2">
            <SettingsRow
              icon="notifications-outline"
              label="Notifications"
              subtitle="Daily plan reminders, project updates"
              onPress={() => { }}
            />
            <SettingsRow
              icon="moon-outline"
              label="Appearance"
              subtitle="Theme, text size"
              onPress={() => { }}
            />
            <SettingsRow
              icon="time-outline"
              label="Planning Schedule"
              subtitle="When your daily plan regenerates"
              onPress={() => { }}
            />
          </View>
        </View>

        <View className="mt-6">
          <Text className="mb-3 text-xs font-semibold uppercase tracking-widest text-core-text-disabled">
            AI Co-pilot
          </Text>
          <View className="gap-2">
            <SettingsRow
              icon="sparkles-outline"
              label="Research Preferences"
              subtitle="Depth, sources, focus areas"
              onPress={() => { }}
            />
            <SettingsRow
              icon="key-outline"
              label="API Keys"
              subtitle="Manage connected services"
              onPress={() => { }}
            />
          </View>
        </View>

        <View className="mt-6">
          <Text className="mb-3 text-xs font-semibold uppercase tracking-widest text-core-text-disabled">
            Account
          </Text>
          <View className="gap-2">
            <SettingsRow
              icon="help-circle-outline"
              label="Help & Support"
              onPress={() => { }}
            />
            <SettingsRow
              icon="document-text-outline"
              label="Privacy Policy"
              onPress={() => { }}
            />
            <Pressable
              onPress={handleSignOut}
              disabled={isSigningOut}
              className="flex-row items-center gap-x-4 rounded-2xl bg-core-surface-elevated px-4 py-3.5 active:opacity-70"
            >
              <View className="h-10 w-10 items-center justify-center rounded-xl bg-semantic-danger/10">
                {isSigningOut ? (
                  <ActivityIndicator size="small" color="#D94F3D" />
                ) : (
                  <Ionicons name="log-out-outline" size={20} color="#D94F3D" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-semantic-danger">
                  Sign Out
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </Container>
  );
}

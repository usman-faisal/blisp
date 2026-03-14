import { Avatar } from '@/components/ui/Avatar';
import { Container } from '@/components/ui/Container';
import { Stack } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TaskCard } from '@/components/ui/TaskCard';
import { FloatingInput } from '@/components/FloatingInput';
import { BlurTargetView } from 'expo-blur';
import { useState, useRef } from 'react';

export default function Home() {
  const [query, setQuery] = useState('');
  const blurTargetRef = useRef<View | null>(null);

  return (
    <Container className="bg-core-background px-4`">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="mt-4 flex-row items-center justify-between">
        <Avatar uri="https://picsum.photos/id/237/200/300" />
        <View className="relative h-16 w-16 items-center justify-center rounded-full bg-core-surface">
          <Ionicons name="notifications-outline" size={26} color="#1A1714" />
        </View>
      </View>

      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
        <ScrollView className="mt-8 bg-core-background">
          <TaskCard
            title="Web application user registration process"
            reviewCount={6}
            timeRange="10.00 AM - 05.30 PM"
            priority="high"
            variant="dark"
          />
          <TaskCard
            title="User flow admin panel"
            reviewCount={8}
            timeRange="10.00 AM - 05.30 PM"
            priority="high"
            variant="sage"
          />
          <TaskCard
            title="Dashboard design for admin panel"
            reviewCount={1}
            timeRange="10.00 AM - 05.30 PM"
            priority="high"
            variant="flax"
          />
          <TaskCard
            title="Dashboard design for admin panel"
            reviewCount={1}
            timeRange="10.00 AM - 05.30 PM"
            priority="high"
            variant="flax"
          />
          <TaskCard
            title="Dashboard design for admin panel"
            reviewCount={1}
            timeRange="10.00 AM - 05.30 PM"
            priority="high"
            variant="flax"
          />
          <TaskCard
            title="Dashboard design for admin panel"
            reviewCount={1}
            timeRange="10.00 AM - 05.30 PM"
            priority="high"
            variant="flax"
          />
        </ScrollView>
      </BlurTargetView>

      <FloatingInput
        value={query}
        onChangeText={setQuery}
        onMicPress={() => {/* handle mic */}}
        placeholder="Type to search..."
        blurTarget={blurTargetRef}
      />
    </Container>
  );
}
import { Container } from '@/components/ui/Container';
import Text from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

/**
 * Manual code entry, for when someone reads a code out or pastes it rather
 * than tapping a blisp:// link.
 */
export default function EnterInviteCodeScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');

  const trimmed = code.trim().toUpperCase();
  const canSubmit = trimmed.length >= 6;

  return (
    <Container>
      <View className="flex-1 px-6">
        <View className="flex-row items-center gap-3 py-4">
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="#2B2724" />
          </Pressable>
          <Text className="font-heading text-2xl text-core-text-primary">Join a project</Text>
        </View>

        <Text className="mb-6 text-sm text-core-text-secondary">
          Enter the code a collaborator shared with you.
        </Text>

        <TextInput
          value={code}
          onChangeText={setCode}
          // Codes are uppercase and unambiguous by design; autocorrect would
          // fight the user on a random string.
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          maxLength={12}
          placeholder="ABCD2345"
          placeholderTextColor="#B0AAA3"
          className="rounded-2xl bg-core-surface px-5 py-4 text-center font-heading text-3xl tracking-widest text-core-text-primary"
        />

        <Pressable
          onPress={() => router.push(`/invite/${trimmed}`)}
          disabled={!canSubmit}
          className={`mt-6 items-center rounded-[28px] p-4 ${
            canSubmit ? 'bg-brand-ember' : 'bg-core-surface'
          }`}>
          <Text
            className={`font-text text-lg font-semibold ${
              canSubmit ? 'text-white' : 'text-core-text-secondary'
            }`}>
            Continue
          </Text>
        </Pressable>
      </View>
    </Container>
  );
}

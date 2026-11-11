import Text from '@/components/ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';

const MAX_REASON = 1000;

/**
 * Asks why, when rejecting a version.
 *
 * The reason is optional — a user is allowed to simply disagree — but it is
 * asked for rather than assumed absent, because it gets fed into the next
 * generation. The suggestions are there so a user who does not know what to
 * write still gives something useful.
 */
export function RejectSheet({
  visible,
  version,
  isRejecting,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  version: number;
  isRejecting: boolean;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
}) {
  const [reason, setReason] = useState('');

  const submit = () => {
    const trimmed = reason.trim();
    onConfirm(trimmed.length > 0 ? trimmed : undefined);
    setReason('');
  };

  const dismiss = () => {
    setReason('');
    onCancel();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/40"
      >
        <View className="rounded-t-3xl bg-core-background px-5 pb-10 pt-5">
          <View className="flex-row items-center justify-between">
            <Text className="font-heading text-xl text-core-text-primary">
              Reject version {version}
            </Text>
            <Pressable onPress={dismiss} hitSlop={12} className="active:opacity-60">
              <Ionicons name="close" size={22} color="#6B6560" />
            </Pressable>
          </View>

          <Text className="mt-2 text-[13px] leading-5 text-core-text-secondary">
            This version stays readable, so you keep a record of what was produced. If you say what
            was wrong, the next version will be told to address it.
          </Text>

          <TextInput
            value={reason}
            onChangeText={(text) => setReason(text.slice(0, MAX_REASON))}
            placeholder="What was wrong with it? (optional)"
            placeholderTextColor="#B0AAA3"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="mt-4 min-h-[96px] rounded-2xl bg-core-surface p-4 font-text text-[13px] leading-5 text-core-text-primary"
          />

          <View className="mt-1 flex-row justify-end">
            <Text className="text-[10px] text-core-text-disabled">
              {reason.length}/{MAX_REASON}
            </Text>
          </View>

          {/* Common complaints, so the field is not a blank wall. Tapping
              appends rather than replaces, since several may apply. */}
          <View className="mt-2 flex-row flex-wrap gap-2">
            {[
              'Citations do not back the claims',
              'Scope is too big',
              'Missed an important feature',
              'Misunderstood the idea',
            ].map((suggestion) => (
              <Pressable
                key={suggestion}
                onPress={() =>
                  setReason((prev) =>
                    (prev.trim().length > 0 ? `${prev.trim()}. ${suggestion}` : suggestion).slice(
                      0,
                      MAX_REASON,
                    ),
                  )
                }
                className="rounded-full bg-core-surface px-3 py-1.5 active:opacity-70"
              >
                <Text className="text-[11px] text-core-text-secondary">{suggestion}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={submit}
            disabled={isRejecting}
            className={`mt-5 flex-row items-center justify-center gap-x-2 rounded-full bg-semantic-danger py-3.5 ${
              isRejecting ? 'opacity-60' : 'active:opacity-80'
            }`}
          >
            {isRejecting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="close-circle-outline" size={16} color="#FFFFFF" />
            )}
            <Text className="text-sm font-semibold text-white">
              {isRejecting ? 'Rejecting…' : 'Reject this version'}
            </Text>
          </Pressable>

          <Pressable onPress={dismiss} className="mt-2 items-center py-3 active:opacity-60">
            <Text className="text-[13px] text-core-text-secondary">Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

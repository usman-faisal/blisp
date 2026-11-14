import Text from '@/components/ui/Text';
import type { LinkedRepositoryPayload, SyncResultPayload } from '@repo/types';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from 'react-native';

/**
 * Linking a repository, and syncing it.
 *
 * Only a public "owner/name" or URL is asked for. No token field: a public
 * repository needs no credential, which is the common case for a student
 * project, and not asking for a secret is the simplest way to avoid
 * mishandling one. The backend refuses a private repository with a clear
 * message rather than linking something that would silently never verify.
 */
export function RepositorySheet({
  visible,
  repositories,
  isSaving,
  error,
  lastSync,
  onClose,
  onLink,
  onSync,
  onUnlink,
}: {
  visible: boolean;
  repositories: LinkedRepositoryPayload[];
  isSaving: boolean;
  error: string | null;
  lastSync: SyncResultPayload | null;
  onClose: () => void;
  onLink: (repository: string) => void;
  onSync: (repositoryId: string) => void;
  onUnlink: (repositoryId: string) => void;
}) {
  const [input, setInput] = useState('');

  const submit = () => {
    const value = input.trim();
    if (!value || isSaving) return;
    onLink(value);
    setInput('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* Without this the keyboard covers the input: the sheet is anchored to
          the bottom, so the field it contains sits exactly where the keyboard
          opens. Matches the behaviour of the app's other bottom sheets —
          'padding' on iOS, and Android's own adjustResize otherwise. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/40"
      >
        <View className="rounded-t-3xl bg-core-background px-5 pb-10 pt-5">
          <View className="flex-row items-center justify-between">
            <Text className="font-heading text-xl text-core-text-primary">Repository</Text>
            <Pressable onPress={onClose} hitSlop={12} className="active:opacity-60">
              <Ionicons name="close" size={22} color="#6B6560" />
            </Pressable>
          </View>

          <Text className="mt-1 text-[12px] leading-[18px] text-core-text-secondary">
            BLISP reads your commits to check off completed tasks. It never pushes, and only needs
            read access.
          </Text>

          {repositories.length === 0 ? (
            <>
              <View className="mt-4 flex-row items-center gap-x-2 rounded-xl bg-core-surface px-3 py-2.5">
                <Ionicons name="logo-github" size={16} color="#6B6560" />
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="owner/repository"
                  placeholderTextColor="#A8A29C"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={submit}
                  returnKeyType="done"
                  className="flex-1 text-[14px] text-core-text-primary"
                />
              </View>

              <Pressable
                onPress={submit}
                disabled={isSaving || input.trim().length === 0}
                className={`mt-3 flex-row items-center justify-center gap-x-2 rounded-full bg-brand-ember py-3.5 ${
                  isSaving || input.trim().length === 0 ? 'opacity-50' : 'active:opacity-80'
                }`}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="link-outline" size={15} color="#FFFFFF" />
                )}
                <Text className="text-sm font-semibold text-white">Link repository</Text>
              </Pressable>
            </>
          ) : (
            repositories.map((repository) => (
              <View key={repository.id} className="mt-4 rounded-2xl bg-core-surface/60 p-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 flex-row items-center gap-x-2">
                    <Ionicons name="logo-github" size={15} color="#1A1714" />
                    <Text className="flex-1 text-[13px] font-semibold text-core-text-primary" numberOfLines={1}>
                      {repository.fullName}
                    </Text>
                  </View>
                  <Pressable onPress={() => onUnlink(repository.id)} hitSlop={10} className="active:opacity-60">
                    <Ionicons name="trash-outline" size={15} color="#D94F3D" />
                  </Pressable>
                </View>

                {/* A failed sync is stated rather than left as an empty list:
                    "nothing found" and "we could not look" are different, and
                    conflating them would misreport the evidence. */}
                {repository.lastSyncError ? (
                  <View className="mt-2 flex-row items-start gap-x-1.5">
                    <Ionicons name="warning-outline" size={11} color="#D94F3D" style={{ marginTop: 2 }} />
                    <Text className="flex-1 text-[11px] leading-[16px] text-semantic-danger">
                      {repository.lastSyncError}
                    </Text>
                  </View>
                ) : (
                  <Text className="mt-1 text-[11px] text-core-text-disabled">
                    {repository.lastSyncedAt
                      ? `Last synced ${new Date(repository.lastSyncedAt).toLocaleString()}`
                      : 'Not synced yet'}
                  </Text>
                )}

                <Pressable
                  onPress={() => onSync(repository.id)}
                  disabled={isSaving}
                  className={`mt-3 flex-row items-center justify-center gap-x-2 rounded-full bg-brand-ember py-3 ${
                    isSaving ? 'opacity-50' : 'active:opacity-80'
                  }`}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="sync-outline" size={14} color="#FFFFFF" />
                  )}
                  <Text className="text-sm font-semibold text-white">Sync commits</Text>
                </Pressable>

                {lastSync && (
                  <Text className="mt-2 text-center text-[11px] text-core-text-secondary">
                    Scanned {lastSync.commitsScanned} commit{lastSync.commitsScanned === 1 ? '' : 's'} ·{' '}
                    {lastSync.evidenceRecorded} linked to {lastSync.tasksUpdated} task
                    {lastSync.tasksUpdated === 1 ? '' : 's'}
                  </Text>
                )}
              </View>
            ))
          )}

          {error && (
            <View className="mt-3 flex-row items-start gap-x-2 rounded-xl bg-semantic-danger/5 p-3">
              <Ionicons name="information-circle-outline" size={14} color="#D94F3D" style={{ marginTop: 1 }} />
              <Text className="flex-1 text-[11px] leading-[16px] text-core-text-secondary">{error}</Text>
            </View>
          )}

          <Text className="mt-4 text-[11px] leading-[16px] text-core-text-disabled">
            Tag a commit with the reference shown on a task — for example{' '}
            <Text className="font-mono text-[11px] text-core-text-secondary">BLISP-4f2a1c08</Text> — then
            sync to link it.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

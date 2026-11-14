import Text from '@/components/ui/Text';
import type { ScopeItemPayload, TaskEffortValue, TaskPriorityValue } from '@repo/types';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';

const PRIORITIES: TaskPriorityValue[] = ['MUST_HAVE', 'SHOULD_HAVE', 'LATER'];
const EFFORTS: TaskEffortValue[] = ['SMALL', 'MEDIUM', 'LARGE'];

const PRIORITY_LABEL: Record<TaskPriorityValue, string> = {
  MUST_HAVE: 'Must',
  SHOULD_HAVE: 'Should',
  LATER: 'Later',
};

const EFFORT_LABEL: Record<TaskEffortValue, string> = {
  SMALL: 'S',
  MEDIUM: 'M',
  LARGE: 'L',
};

interface EditableScopeItem extends ScopeItemPayload {
  /** Local key: titles can collide and ids do not exist until saved. */
  key: string;
  included: boolean;
}

/**
 * Confirm the scope before building a roadmap.
 *
 * Every item is editable and removable, and items from the approved report are
 * labelled as such. That labelling matters: the discovery report is marked
 * beta, so the roadmap must not look like it was built on unreviewed AI output.
 * It is built on scope a human approved and then edited here.
 */
export function PlanScopeSheet({
  visible,
  isLoading,
  isSaving,
  suggested,
  fromReportVersion,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  isLoading: boolean;
  isSaving: boolean;
  suggested: ScopeItemPayload[];
  fromReportVersion: number | null;
  onCancel: () => void;
  onConfirm: (scope: ScopeItemPayload[]) => void;
}) {
  const [items, setItems] = useState<EditableScopeItem[]>([]);
  const [newTitle, setNewTitle] = useState('');
  /** Scrolls the "add your own" field clear of the keyboard when it focuses. */
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible) return;
    setItems(
      suggested.map((item, index) => ({
        ...item,
        key: `s${index}`,
        included: true,
      })),
    );
    setNewTitle('');
  }, [visible, suggested]);

  const included = items.filter((item) => item.included);

  const toggle = (key: string) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, included: !i.included } : i)));
  };

  const cyclePriority = (key: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.key === key
          ? { ...i, priority: PRIORITIES[(PRIORITIES.indexOf(i.priority) + 1) % PRIORITIES.length]! }
          : i,
      ),
    );
  };

  const cycleEffort = (key: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.key === key ? { ...i, effort: EFFORTS[(EFFORTS.indexOf(i.effort) + 1) % EFFORTS.length]! } : i,
      ),
    );
  };

  const addOwn = () => {
    const title = newTitle.trim();
    if (title.length === 0) return;

    setItems((prev) => [
      ...prev,
      {
        key: `own-${Date.now()}`,
        title: title.slice(0, 255),
        priority: 'MUST_HAVE',
        effort: 'MEDIUM',
        fromReport: false,
        included: true,
      },
    ]);
    setNewTitle('');
    // The list just grew by a row, pushing the input down behind the keyboard.
    // Keeping it in view lets several items be added without dismissing the
    // keyboard between each one.
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/40"
      >
        <View className="rounded-t-3xl bg-core-background px-5 pb-10 pt-5" style={{ maxHeight: '88%' }}>
          <View className="flex-row items-center justify-between">
            <Text className="font-heading text-xl text-core-text-primary">What are you building?</Text>
            <Pressable onPress={onCancel} hitSlop={12} className="active:opacity-60">
              <Ionicons name="close" size={22} color="#6B6560" />
            </Pressable>
          </View>

          {/* Provenance, stated plainly. */}
          {fromReportVersion !== null ? (
            <Text className="mt-1.5 text-[11px] leading-4 text-core-text-secondary">
              Suggested from the discovery report you approved (v{fromReportVersion}). Change anything — tap
              the chips to adjust priority and size, untick to leave it out.
            </Text>
          ) : (
            <Text className="mt-1.5 text-[11px] leading-4 text-core-text-secondary">
              No approved report yet, so add what you plan to build. Approving a discovery report will
              prefill this next time.
            </Text>
          )}

          {isLoading ? (
            <View className="items-center py-10">
              <ActivityIndicator color="#E8612A" />
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              className="mt-3"
              showsVerticalScrollIndicator={false}
              // The "add your own" field sits at the end of this list, which is
              // exactly where the keyboard opens. Without these the field is
              // covered the moment it is focused: the sheet resizes, but the
              // scroll position does not follow the focused input.
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={{ paddingBottom: 12 }}
            >
              {items.map((item) => (
                <View
                  key={item.key}
                  className={`mt-2 rounded-xl p-3 ${item.included ? 'bg-core-surface' : 'bg-core-surface/40'}`}
                >
                  <View className="flex-row items-start gap-x-2.5">
                    <Pressable onPress={() => toggle(item.key)} hitSlop={8} className="mt-0.5 active:opacity-60">
                      <Ionicons
                        name={item.included ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={item.included ? '#E8612A' : '#B0AAA3'}
                      />
                    </Pressable>

                    <View className="flex-1">
                      <Text
                        className={`text-[13px] leading-[18px] ${
                          item.included ? 'text-core-text-primary' : 'text-core-text-disabled line-through'
                        }`}
                      >
                        {item.title}
                      </Text>

                      <View className="mt-2 flex-row items-center gap-x-2">
                        <Pressable
                          onPress={() => cyclePriority(item.key)}
                          className="rounded-md bg-core-background px-2 py-1 active:opacity-70"
                        >
                          <Text className="text-[10px] font-semibold text-core-text-secondary">
                            {PRIORITY_LABEL[item.priority]}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => cycleEffort(item.key)}
                          className="rounded-md bg-core-background px-2 py-1 active:opacity-70"
                        >
                          <Text className="text-[10px] font-semibold text-core-text-secondary">
                            Size {EFFORT_LABEL[item.effort]}
                          </Text>
                        </Pressable>
                        {!item.fromReport && (
                          <Text className="text-[9px] uppercase tracking-wide text-core-text-disabled">
                            Yours
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              ))}

              <View className="mt-3 flex-row items-center gap-x-2">
                <TextInput
                  value={newTitle}
                  onChangeText={setNewTitle}
                  onSubmitEditing={addOwn}
                  // Scrolls the field clear of the keyboard on Android, where
                  // automaticallyAdjustKeyboardInsets alone does not.
                  onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120)}
                  placeholder="Add something of your own"
                  placeholderTextColor="#B0AAA3"
                  returnKeyType="done"
                  blurOnSubmit={false}
                  className="flex-1 rounded-xl bg-core-surface px-4 py-3 font-text text-[13px] text-core-text-primary"
                />
                <Pressable
                  onPress={addOwn}
                  className="h-11 w-11 items-center justify-center rounded-xl bg-core-surface active:opacity-70"
                >
                  <Ionicons name="add" size={20} color="#E8612A" />
                </Pressable>
              </View>
            </ScrollView>
          )}

          <Pressable
            onPress={() => onConfirm(included.map(({ key, included: _included, ...rest }) => rest))}
            disabled={isSaving || included.length === 0}
            className={`mt-4 flex-row items-center justify-center gap-x-2 rounded-full bg-brand-ember py-3.5 ${
              isSaving || included.length === 0 ? 'opacity-50' : 'active:opacity-80'
            }`}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Ionicons name="git-branch-outline" size={16} color="#FFFFFF" />
            )}
            <Text className="text-sm font-semibold text-white">
              {isSaving ? 'Building…' : `Build roadmap from ${included.length} item${included.length === 1 ? '' : 's'}`}
            </Text>
          </Pressable>

          {included.length === 0 && !isLoading && (
            <Text className="mt-2 text-center text-[11px] text-core-text-disabled">
              Pick at least one thing to build.
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

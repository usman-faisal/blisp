import Text from '@/components/ui/Text';
import type { RoadmapSettingsPayload, SkillLevelValue } from '@repo/types';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from 'react-native';

const WEEKDAY_LABELS: { iso: number; label: string }[] = [
  { iso: 1, label: 'M' },
  { iso: 2, label: 'T' },
  { iso: 3, label: 'W' },
  { iso: 4, label: 'T' },
  { iso: 5, label: 'F' },
  { iso: 6, label: 'S' },
  { iso: 7, label: 'S' },
];

const SKILL_LABELS: { value: SkillLevelValue; label: string; hint: string }[] = [
  { value: 'BEGINNER', label: 'New to this', hint: 'Estimates are padded generously' },
  { value: 'INTERMEDIATE', label: 'Some experience', hint: 'Balanced estimates' },
  { value: 'ADVANCED', label: 'Very comfortable', hint: 'Tighter estimates' },
];

/** YYYY-MM-DD for the text input, from whatever the API returned. */
function toDateInput(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

/**
 * Planning inputs: deadline, hours per day, working days, skill level.
 *
 * A plain date field rather than a native picker, deliberately: adding a picker
 * dependency for one field is not worth it, and the format is stated. Invalid
 * input is caught before saving rather than sent and rejected.
 */
export function SettingsSheet({
  visible,
  settings,
  isSaving,
  suggestedHours,
  onCancel,
  onSave,
}: {
  visible: boolean;
  settings: RoadmapSettingsPayload | null;
  isSaving: boolean;
  /** Prefilled when arriving from the "put in more hours" option. */
  suggestedHours?: number | null;
  onCancel: () => void;
  onSave: (settings: {
    deadline: string | null;
    hoursPerDay: number | null;
    workingDays: number[];
    skillLevel: SkillLevelValue | null;
  }) => void;
}) {
  const [deadline, setDeadline] = useState('');
  const [hours, setHours] = useState('');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [skill, setSkill] = useState<SkillLevelValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset from props each time the sheet opens, so a cancelled edit does not
  // persist into the next open.
  useEffect(() => {
    if (!visible) return;
    setDeadline(toDateInput(settings?.deadline ?? null));
    setHours(suggestedHours ? String(suggestedHours) : settings?.hoursPerDay ? String(settings.hoursPerDay) : '');
    setDays(settings?.workingDays?.length ? settings.workingDays : [1, 2, 3, 4, 5]);
    setSkill(settings?.skillLevel ?? null);
    setError(null);
  }, [visible, settings, suggestedHours]);

  const toggleDay = (iso: number) => {
    setDays((prev) => (prev.includes(iso) ? prev.filter((d) => d !== iso) : [...prev, iso].sort((a, b) => a - b)));
  };

  const submit = () => {
    const trimmedDeadline = deadline.trim();

    if (trimmedDeadline && !/^\d{4}-\d{2}-\d{2}$/.test(trimmedDeadline)) {
      setError('Use the format YYYY-MM-DD, for example 2026-11-20.');
      return;
    }

    if (trimmedDeadline && Number.isNaN(new Date(trimmedDeadline).getTime())) {
      setError('That is not a real date.');
      return;
    }

    const parsedHours = hours.trim() === '' ? null : Number(hours);
    if (parsedHours !== null && (Number.isNaN(parsedHours) || parsedHours < 0.5 || parsedHours > 16)) {
      setError('Hours per day must be between 0.5 and 16.');
      return;
    }

    if (days.length === 0) {
      setError('Pick at least one working day.');
      return;
    }

    onSave({
      deadline: trimmedDeadline === '' ? null : trimmedDeadline,
      hoursPerDay: parsedHours,
      workingDays: days,
      skillLevel: skill,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/40"
      >
        <View className="rounded-t-3xl bg-core-background px-5 pb-10 pt-5">
          <View className="flex-row items-center justify-between">
            <Text className="font-heading text-xl text-core-text-primary">Your availability</Text>
            <Pressable onPress={onCancel} hitSlop={12} className="active:opacity-60">
              <Ionicons name="close" size={22} color="#6B6560" />
            </Pressable>
          </View>

          <Text className="mt-1.5 text-[11px] leading-4 text-core-text-secondary">
            Used to date the milestones. A fifth of your time is held back for testing and the unexpected.
          </Text>

          <Text className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-core-text-disabled">
            Target date
          </Text>
          <TextInput
            value={deadline}
            onChangeText={setDeadline}
            placeholder="YYYY-MM-DD (leave blank for none)"
            placeholderTextColor="#B0AAA3"
            autoCapitalize="none"
            className="mt-1.5 rounded-xl bg-core-surface px-4 py-3 font-text text-[13px] text-core-text-primary"
          />

          <Text className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-core-text-disabled">
            Hours on a working day
          </Text>
          <TextInput
            value={hours}
            onChangeText={setHours}
            placeholder="e.g. 2"
            placeholderTextColor="#B0AAA3"
            keyboardType="decimal-pad"
            className="mt-1.5 rounded-xl bg-core-surface px-4 py-3 font-text text-[13px] text-core-text-primary"
          />

          <Text className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-core-text-disabled">
            Working days
          </Text>
          <View className="mt-1.5 flex-row gap-x-2">
            {WEEKDAY_LABELS.map((day) => {
              const active = days.includes(day.iso);
              return (
                <Pressable
                  key={day.iso}
                  onPress={() => toggleDay(day.iso)}
                  className={`h-10 flex-1 items-center justify-center rounded-xl ${
                    active ? 'bg-brand-ember' : 'bg-core-surface active:opacity-70'
                  }`}
                >
                  <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-core-text-secondary'}`}>
                    {day.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-core-text-disabled">
            How experienced are you with this stack?
          </Text>
          <View className="mt-1.5 gap-y-2">
            {SKILL_LABELS.map((option) => {
              const active = skill === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setSkill(active ? null : option.value)}
                  className={`flex-row items-center gap-x-2.5 rounded-xl p-3 ${
                    active ? 'bg-brand-ember-mist' : 'bg-core-surface active:opacity-70'
                  }`}
                >
                  <Ionicons
                    name={active ? 'radio-button-on' : 'radio-button-off'}
                    size={16}
                    color={active ? '#E8612A' : '#B0AAA3'}
                  />
                  <View className="flex-1">
                    <Text className="text-[13px] font-medium text-core-text-primary">{option.label}</Text>
                    <Text className="text-[10px] text-core-text-disabled">{option.hint}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {error && (
            <View className="mt-3 flex-row items-start gap-x-2 rounded-xl bg-semantic-danger/5 p-3">
              <Ionicons name="alert-circle-outline" size={14} color="#D94F3D" style={{ marginTop: 1 }} />
              <Text className="flex-1 text-xs leading-[18px] text-core-text-secondary">{error}</Text>
            </View>
          )}

          <Pressable
            onPress={submit}
            disabled={isSaving}
            className={`mt-5 flex-row items-center justify-center gap-x-2 rounded-full bg-brand-ember py-3.5 ${
              isSaving ? 'opacity-60' : 'active:opacity-80'
            }`}
          >
            {isSaving && <ActivityIndicator color="#FFFFFF" size="small" />}
            <Text className="text-sm font-semibold text-white">{isSaving ? 'Saving…' : 'Save'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

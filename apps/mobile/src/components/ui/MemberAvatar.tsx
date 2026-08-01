import { View } from 'react-native';
import Text from './Text';

/**
 * Initials avatar for collaborators.
 *
 * The existing Avatar takes a URI, but members come from Clerk without profile
 * images, so initials are all there is to show.
 */

const PALETTE = [
  '#E8612A', // ember
  '#C9A84C', // flax
  '#6A8F7A', // sage
  '#5B7C99',
  '#A0616A',
  '#7A6A8F',
] as const;

/** Same name always lands on the same colour, so members stay recognisable. */
function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length]!;
}

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();

  return `${words[0]![0]}${words[words.length - 1]![0]}`.toUpperCase();
}

interface MemberAvatarProps {
  name: string;
  /** Pixel diameter. Text scales with it. */
  size?: number;
  /** Ring around the avatar, for overlapping stacks. */
  bordered?: boolean;
}

export function MemberAvatar({ name, size = 32, bordered = false }: MemberAvatarProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colorFor(name),
        ...(bordered ? { borderWidth: 2, borderColor: '#F7F4EF' } : {}),
      }}
      className="items-center justify-center">
      <Text style={{ fontSize: size * 0.38, lineHeight: size * 0.46 }} className="font-semibold text-white">
        {initialsFor(name)}
      </Text>
    </View>
  );
}

interface MemberAvatarStackProps {
  names: string[];
  size?: number;
  /** Beyond this, the rest collapse into a "+N" chip. */
  max?: number;
}

/** Overlapping avatars for a project header. */
export function MemberAvatarStack({ names, size = 28, max = 3 }: MemberAvatarStackProps) {
  const shown = names.slice(0, max);
  const overflow = names.length - shown.length;

  return (
    <View className="flex-row items-center">
      {shown.map((name, index) => (
        <View key={`${name}-${index}`} style={{ marginLeft: index === 0 ? 0 : -size * 0.3 }}>
          <MemberAvatar name={name} size={size} bordered />
        </View>
      ))}

      {overflow > 0 && (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            marginLeft: -size * 0.3,
            borderWidth: 2,
            borderColor: '#F7F4EF',
          }}
          className="items-center justify-center bg-core-surface">
          <Text style={{ fontSize: size * 0.34 }} className="font-semibold text-core-text-secondary">
            +{overflow}
          </Text>
        </View>
      )}
    </View>
  );
}

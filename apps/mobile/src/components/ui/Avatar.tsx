import { Image, StyleSheet, View } from 'react-native';

interface AvatarProps {
  uri: string;
}

export const Avatar = ({ uri }: AvatarProps) => (
        <Image
          source={{ uri }}
          className='w-16 h-16 rounded-full border-2 border-brand-ember-mist'
        />
);


import { View, ViewProps } from 'react-native';

export const Container = (props: ViewProps) => {
  return (
    <View {...props} className={`py-safe flex flex-1 bg-core-background ${props?.className || ''}`}>
      {props.children}
    </View>
  );
};

import { forwardRef } from 'react';
import { Text, TouchableOpacity, TouchableOpacityProps, View } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
}

export const Button = forwardRef<View, ButtonProps>(({ title, ...touchableProps }, ref) => {
  return (
    <TouchableOpacity
      ref={ref}
      {...touchableProps}
      className={`items-center rounded-[28px] bg-brand-ember p-4 shadow-md ${touchableProps.className}`}>
      <Text className="text-center font-text text-lg font-semibold text-white">{title}</Text>
    </TouchableOpacity>
  );
});

Button.displayName = 'Button';

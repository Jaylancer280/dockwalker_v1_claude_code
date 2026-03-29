import { Pressable, Text, ActivityIndicator, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

const VARIANTS = {
  primary: { bg: '#2563eb', bgDisabled: '#93c5fd', text: '#fff' },
  secondary: { bg: 'transparent', bgDisabled: 'transparent', text: '#374151', border: '#d1d5db' },
  destructive: { bg: '#dc2626', bgDisabled: '#d1d5db', text: '#fff' },
  ghost: { bg: 'transparent', bgDisabled: 'transparent', text: '#2563eb' },
} as const;

const SIZES = {
  sm: { paddingVertical: 6, paddingHorizontal: 12, fontSize: 13, borderRadius: 8 },
  md: { paddingVertical: 10, paddingHorizontal: 16, fontSize: 14, borderRadius: 10 },
  lg: { paddingVertical: 14, paddingHorizontal: 20, fontSize: 16, borderRadius: 12 },
} as const;

interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  label: string;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ variant = 'primary', size = 'lg', label, loading, disabled, style, ...rest }: ButtonProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      style={[
        {
          backgroundColor: isDisabled ? v.bgDisabled : v.bg,
          borderRadius: s.borderRadius,
          paddingVertical: s.paddingVertical,
          paddingHorizontal: s.paddingHorizontal,
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          flexDirection: 'row' as const,
          gap: 8,
          ...('border' in v && v.border && !isDisabled ? { borderWidth: 1, borderColor: v.border } : {}),
        },
        style,
      ]}
      {...rest}
    >
      {loading && <ActivityIndicator size="small" color={v.text} />}
      <Text style={{ color: isDisabled && variant === 'secondary' ? '#9ca3af' : v.text, fontSize: s.fontSize, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

import { View, Text, TextInput as RNTextInput, type TextInputProps as RNTextInputProps } from 'react-native';

interface FormInputProps extends RNTextInputProps {
  label?: string;
  required?: boolean;
}

export function FormInput({ label, required, style, ...rest }: FormInputProps) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label && (
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 }}>
          {label}{required ? ' *' : ''}
        </Text>
      )}
      <RNTextInput
        placeholderTextColor="#9ca3af"
        style={[
          {
            borderWidth: 1,
            borderColor: '#d1d5db',
            borderRadius: 8,
            padding: 12,
            fontSize: 14,
            color: '#111',
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

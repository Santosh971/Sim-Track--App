/**
 * Phone/Mobile Number Input Component
 */

import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  KeyboardTypeOptions,
} from 'react-native';
import COLORS from '../../constants/colors';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/spacing';

interface PhoneInputProps {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  maxLength?: number;
  countryCode?: string;
  editable?: boolean;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChangeText,
  label = 'Mobile Number',
  placeholder = 'Enter 10 digit number',
  error,
  maxLength = 10,
  countryCode = '+91',
  editable = true,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleChangeText = (text: string) => {
    // Only allow numbers
    const numericValue = text.replace(/[^0-9]/g, '');
    onChangeText(numericValue);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputFocused,
          error && styles.inputError,
          !editable && styles.inputDisabled,
        ]}
      >
        <View style={styles.countryCode}>
          <Text style={styles.countryCodeText}>{countryCode}</Text>
        </View>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textLight}
          keyboardType="numeric"
          maxLength={maxLength}
          editable={editable}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          selectionColor={COLORS.primary}
        />
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  inputFocused: {
    borderColor: COLORS.primary,
    borderWidth: 2,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  inputDisabled: {
    backgroundColor: COLORS.border,
    opacity: 0.7,
  },
  countryCode: {
    backgroundColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRightWidth: 1,
    borderRightColor: COLORS.inputBorder,
  },
  countryCodeText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  input: {
    flex: 1,
    fontSize: FONT_SIZE.xl,
    fontWeight: '500',
    color: COLORS.text,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
});

export default PhoneInput;
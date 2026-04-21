/**
 * OTP Input Component - 6 digit input
 */

import React, { useRef, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  Keyboard,
} from 'react-native';
import COLORS from '../../constants/colors';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/spacing';

interface OTPInputProps {
  length?: number;
  onOTPComplete: (otp: string) => void;
  autoFocus?: boolean;
}

export const OTPInput: React.FC<OTPInputProps> = ({
  length = 6,
  onOTPComplete,
  autoFocus = true,
}) => {
  const [otp, setOtp] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleChange = (text: string, index: number) => {
    // Only allow numbers
    const numericValue = text.replace(/[^0-9]/g, '');

    if (numericValue.length > 1) {
      // Handle paste
      const newOtp = [...otp];
      const values = numericValue.slice(0, length).split('');
      values.forEach((value, i) => {
        if (index + i < length) {
          newOtp[index + i] = value;
        }
      });
      setOtp(newOtp);

      // Check if complete
      const otpValue = newOtp.join('');
      if (otpValue.length === length) {
        onOTPComplete(otpValue);
        Keyboard.dismiss();
      }
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = numericValue;
    setOtp(newOtp);

    // Auto-focus next input
    if (numericValue && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if complete
    const otpValue = newOtp.join('');
    if (otpValue.length === length) {
      onOTPComplete(otpValue);
      Keyboard.dismiss();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      // Focus previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.container}>
      {Array(length)
        .fill(0)
        .map((_, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputRefs.current[index] = ref)}
            style={[
              styles.input,
              otp[index] && styles.inputFilled,
            ]}
            value={otp[index]}
            onChangeText={(text) => handleChange(text, index)}
            onKeyPress={({ nativeEvent }) =>
              handleKeyPress(nativeEvent.key, index)
            }
            keyboardType="numeric"
            maxLength={1}
            autoFocus={autoFocus && index === 0}
            selectTextOnFocus
            selectionColor={COLORS.primary}
          />
        ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  input: {
    width: 50,
    height: 56,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    fontSize: FONT_SIZE['2xl'],
    fontWeight: '700',
    textAlign: 'center',
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  inputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight + '20',
  },
});

export default OTPInput;
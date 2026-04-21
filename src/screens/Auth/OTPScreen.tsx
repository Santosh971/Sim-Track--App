/**
 * OTP Screen - Simple OTP verification
 */

import React, { useState, useContext, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthContext, RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'OTP'>;

const OTPScreen: React.FC<Props> = ({ route, navigation }) => {
  const { mobileNumber } = route.params;
  const { verifyOTP } = useContext(AuthContext);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(30);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleOTPChange = (text: string, index: number) => {
    const numericValue = text.replace(/[^0-9]/g, '');

    if (numericValue.length > 0) {
      const newOtp = [...otp];
      newOtp[index] = numericValue.slice(-1);
      setOtp(newOtp);

      // Auto focus next input
      if (index < 5 && numericValue.length > 0) {
        inputRefs.current[index + 1]?.focus();
      }

      // Check if complete
      const otpValue = newOtp.join('');
      if (otpValue.length === 6) {
        handleVerify(otpValue);
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && otp[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (otpValue: string) => {
    setError('');
    setIsLoading(true);

    try {
      const result = await verifyOTP(otpValue);
      if (result.success) {
        // Navigate to Permissions screen after OTP verification
        navigation.navigate('Permission');
      } else {
        setError(result.message || 'Invalid OTP. Please try again.');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setCountdown(30);
    setOtp(['', '', '', '', '', '']);
    setError('');
    inputRefs.current[0]?.focus();
    // TODO: Call resend OTP API
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Verify OTP</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to{'\n'}
              <Text style={styles.phoneNumber}>+91 {mobileNumber}</Text>
            </Text>
          </View>

          {/* OTP Input */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={[styles.otpInput, digit && styles.otpInputFilled]}
                value={digit}
                onChangeText={(text) => handleOTPChange(text, index)}
                onKeyPress={({ nativeEvent }) =>
                  handleKeyPress(nativeEvent.key, index)
                }
                keyboardType="numeric"
                maxLength={1}
                autoFocus={index === 0}
                selectTextOnFocus
                selectionColor="#3B82F6"
                editable={!isLoading}
              />
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color="#3B82F6" />
              <Text style={styles.loadingText}>Verifying OTP...</Text>
            </View>
          )}

          {/* Resend */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendText}>Didn't receive the code? </Text>
            {countdown > 0 ? (
              <Text style={styles.countdownText}>
                Resend in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
              </Text>
            ) : (
              <TouchableOpacity onPress={handleResend}>
                <Text style={styles.resendLink}>Resend OTP</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Change Number */}
          <TouchableOpacity
            style={styles.changeNumberContainer}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.changeNumberLink}>Change Mobile Number</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  phoneNumber: {
    fontWeight: '600',
    color: '#1E293B',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  otpInput: {
    width: 50,
    height: 56,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  otpInputFilled: {
    borderColor: '#3B82F6',
    backgroundColor: '#EFF6FF',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  resendText: {
    fontSize: 14,
    color: '#64748B',
  },
  countdownText: {
    fontSize: 14,
    color: '#64748B',
  },
  resendLink: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
  changeNumberContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  changeNumberLink: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
});

export default OTPScreen;
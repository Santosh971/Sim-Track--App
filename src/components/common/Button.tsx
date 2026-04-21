/**
 * Common UI Components
 */

import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import COLORS from '../../constants/colors';
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '../../constants/spacing';

// Button Component
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}) => {
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'secondary':
        return { backgroundColor: COLORS.secondary };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: COLORS.primary,
        };
      case 'danger':
        return { backgroundColor: COLORS.error };
      default:
        return { backgroundColor: COLORS.primary };
    }
  };

  const getSizeStyles = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md };
      case 'lg':
        return { paddingVertical: SPACING.lg, paddingHorizontal: SPACING['2xl'] };
      default:
        return { paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl };
    }
  };

  const getTextColor = (): string => {
    if (variant === 'outline') return COLORS.primary;
    return COLORS.textWhite;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        getVariantStyles(),
        getSizeStyles(),
        disabled && styles.disabled,
        style,
      ]}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.buttonContent}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text
            style={[
              styles.buttonText,
              { color: getTextColor() },
              size === 'lg' && { fontSize: FONT_SIZE.lg },
              size === 'sm' && { fontSize: FONT_SIZE.sm },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// Input Component
interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  maxLength?: number;
  editable?: boolean;
  style?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  error,
  maxLength,
  editable = true,
  style,
}) => {
  return (
    <View style={[styles.inputContainer, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          error && styles.inputError,
          !editable && styles.inputDisabled,
        ]}
      >
        <Text
          style={[
            styles.input,
            !value && styles.placeholder,
          ]}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textLight}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          editable={editable}
        >
          {value}
        </Text>
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

// Card Component
interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({ children, style }) => {
  return <View style={[styles.card, style]}>{children}</View>;
};

// Loader Component
interface LoaderProps {
  size?: 'small' | 'large';
  color?: string;
}

export const Loader: React.FC<LoaderProps> = ({ size = 'large', color = COLORS.primary }) => {
  return <ActivityIndicator size={size} color={color} />;
};

// Badge Component
interface BadgeProps {
  text: string;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default';
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ text, variant = 'default', style }) => {
  const getVariantColor = (): string => {
    switch (variant) {
      case 'success':
        return COLORS.success;
      case 'warning':
        return COLORS.warning;
      case 'error':
        return COLORS.error;
      case 'info':
        return COLORS.info;
      default:
        return COLORS.secondary;
    }
  };

  return (
    <View style={[styles.badge, { backgroundColor: getVariantColor() }, style]}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: SPACING.sm,
  },
  buttonText: {
    fontWeight: '600',
    fontSize: FONT_SIZE.md,
  },
  disabled: {
    opacity: 0.5,
  },
  inputContainer: {
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: FONT_SIZE.md,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  inputWrapper: {
    backgroundColor: COLORS.inputBackground,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  inputDisabled: {
    backgroundColor: COLORS.border,
    opacity: 0.7,
  },
  input: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.text,
    padding: 0,
  },
  placeholder: {
    color: COLORS.textLight,
  },
  errorText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: COLORS.textWhite,
  },
});

export default { Button, Input, Card, Loader, Badge };
// SylOS Mobile UI Components

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '../theme';
import { IconSize } from '../constants/icons';
import { UIIcons } from '../constants/icons';

// Button Component
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
}) => {
  const buttonStyle = [
    styles.button,
    styles[`button_${variant}`],
    styles[`button_${size}`],
    fullWidth && styles.button_fullWidth,
    (disabled || loading) && styles.button_disabled,
  ];

  const textStyle = [
    styles.buttonText,
    styles[`buttonText_${variant}`],
    styles[`buttonText_${size}`],
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor(variant)} size="small" />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={getIconSize(size)}
              color={getTextColor(variant)}
              style={styles.buttonIcon}
            />
          )}
          <Text style={textStyle}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const getTextColor = (variant: string) => {
  switch (variant) {
    case 'primary':
      return Colors.textInverse;
    case 'secondary':
      return Colors.textInverse;
    case 'outline':
      return Colors.primary;
    case 'ghost':
      return Colors.primary;
    default:
      return Colors.textInverse;
  }
};

const getIconSize = (size: string) => {
  switch (size) {
    case 'small':
      return IconSize.sm;
    case 'medium':
      return IconSize.md;
    case 'large':
      return IconSize.lg;
    default:
      return IconSize.md;
  }
};

// Card Component
interface CardProps {
  children: React.ReactNode;
  style?: any;
  padding?: boolean;
  shadow?: boolean;
  onPress?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  padding = true,
  shadow = true,
  onPress,
}) => {
  const CardComponent = onPress ? TouchableOpacity : View;
  
  return (
    <CardComponent
      style={[
        styles.card,
        padding && styles.card_padded,
        shadow && Shadows.md,
        style,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {children}
    </CardComponent>
  );
};

// Input Component
interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  multiline?: boolean;
  numberOfLines?: number;
  error?: string;
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export const Input: React.FC<InputProps> = ({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  multiline = false,
  numberOfLines = 1,
  error,
  label,
  icon,
}) => {
  return (
    <View style={styles.inputContainer}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <View style={styles.inputWrapper}>
        {icon && (
          <Ionicons
            name={icon}
            size={IconSize.md}
            color={Colors.textSecondary}
            style={styles.inputIcon}
          />
        )}
        <TextInput
          style={[
            styles.input,
            icon && styles.input_withIcon,
            error && styles.input_error,
            multiline && styles.input_multiline,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          multiline={multiline}
          numberOfLines={numberOfLines}
        />
      </View>
      {error && <Text style={styles.inputError}>{error}</Text>}
    </View>
  );
};

// Modal Component
interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  fullScreen?: boolean;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  children,
  fullScreen = false,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={[
        styles.modal,
        fullScreen && styles.modal_fullScreen,
      ]}>
        {title && (
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name={UIIcons.close} size={IconSize.md} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.modalContent}>
          {children}
        </View>
      </View>
    </View>
  );
};

// Loading Component
interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({
  message = 'Loading...',
  fullScreen = true,
}) => {
  const containerStyle = fullScreen ? styles.loadingContainer_full : styles.loadingContainer_inline;

  return (
    <View style={containerStyle}>
      <ActivityIndicator size="large" color={Colors.primary} />
      {message && <Text style={styles.loadingText}>{message}</Text>}
    </View>
  );
};

// Status Badge Component
interface StatusBadgeProps {
  status: 'success' | 'warning' | 'error' | 'info';
  text: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, text }) => {
  return (
    <View style={[
      styles.statusBadge,
      styles[`statusBadge_${status}`],
    ]}>
      <Text style={[
        styles.statusBadgeText,
        styles[`statusBadgeText_${status}`],
      ]}>
        {text}
      </Text>
    </View>
  );
};

// Empty State Component
interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  action?: {
    title: string;
    onPress: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => {
  return (
    <View style={styles.emptyState}>
      <Ionicons name={icon} size={IconSize.xxl} color={Colors.textTertiary} />
      <Text style={styles.emptyStateTitle}>{title}</Text>
      {description && (
        <Text style={styles.emptyStateDescription}>{description}</Text>
      )}
      {action && (
        <Button
          title={action.title}
          onPress={action.onPress}
          variant="outline"
          style={styles.emptyStateAction}
        />
      )}
    </View>
  );
};

// Styles
const styles = StyleSheet.create({
  // Button styles
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  button_primary: {
    backgroundColor: Colors.primary,
  },
  button_secondary: {
    backgroundColor: Colors.secondary,
  },
  button_outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  button_ghost: {
    backgroundColor: 'transparent',
  },
  button_small: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  button_medium: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  button_large: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  button_fullWidth: {
    width: '100%',
  },
  button_disabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonText_primary: {
    color: Colors.textInverse,
  },
  buttonText_secondary: {
    color: Colors.textInverse,
  },
  buttonText_outline: {
    color: Colors.primary,
  },
  buttonText_ghost: {
    color: Colors.primary,
  },
  buttonText_small: {
    fontSize: Typography.fontSize.sm,
  },
  buttonText_medium: {
    fontSize: Typography.fontSize.md,
  },
  buttonText_large: {
    fontSize: Typography.fontSize.lg,
  },
  buttonIcon: {
    marginRight: Spacing.sm,
  },

  // Card styles
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
  },
  card_padded: {
    padding: Spacing.md,
  },

  // Input styles
  inputContainer: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
  },
  input: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    fontSize: Typography.fontSize.md,
    color: Colors.text,
  },
  input_withIcon: {
    paddingLeft: 0,
  },
  inputIcon: {
    marginLeft: Spacing.md,
    marginRight: Spacing.sm,
  },
  input_error: {
    borderColor: Colors.error,
  },
  input_multiline: {
    height: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    fontSize: Typography.fontSize.xs,
    color: Colors.error,
    marginTop: Spacing.xs,
  },

  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    ...Shadows.lg,
  },
  modal_fullScreen: {
    width: '100%',
    height: '100%',
    borderRadius: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  modalContent: {
    padding: Spacing.lg,
  },

  // Loading styles
  loadingContainer_full: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingContainer_inline: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
  },

  // Status Badge styles
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  statusBadge_success: {
    backgroundColor: Colors.success + '20',
  },
  statusBadge_warning: {
    backgroundColor: Colors.warning + '20',
  },
  statusBadge_error: {
    backgroundColor: Colors.error + '20',
  },
  statusBadge_info: {
    backgroundColor: Colors.info + '20',
  },
  statusBadgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '500',
  },
  statusBadgeText_success: {
    color: Colors.success,
  },
  statusBadgeText_warning: {
    color: Colors.warning,
  },
  statusBadgeText_error: {
    color: Colors.error,
  },
  statusBadgeText_info: {
    color: Colors.info,
  },

  // Empty State styles
  emptyState: {
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emptyStateTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  emptyStateAction: {
    marginTop: Spacing.md,
  },
});

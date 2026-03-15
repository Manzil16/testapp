import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Colors, Radius, Spacing, Typography } from "@/src/features/shared/theme";

interface InputFieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  error?: string;
  hint?: string;
  /** Icon rendered inside the input on the left */
  leftIcon?: React.ReactNode;
  /** Icon rendered inside the input on the right (e.g. eye toggle) */
  rightIcon?: React.ReactNode;
  /** Callback for right icon press */
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  /** If true, renders as a multi-line textarea */
  multiline?: boolean;
  numberOfLines?: number;
}

export function InputField({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  multiline = false,
  numberOfLines = 3,
  ...textInputProps
}: InputFieldProps) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? Colors.error
    : focused
    ? Colors.borderFocus
    : Colors.border;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {/* Label */}
      <Text style={styles.label}>{label}</Text>

      {/* Input row */}
      <View
        style={[
          styles.inputRow,
          { borderColor },
          focused && styles.inputFocused,
          multiline && styles.multiline,
        ]}
      >
        {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}

        <TextInput
          {...textInputProps}
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeft : undefined,
            rightIcon ? styles.inputWithRight : undefined,
            multiline && styles.multilineInput,
          ]}
          placeholderTextColor={Colors.textMuted}
          onFocus={(e) => {
            setFocused(true);
            textInputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            textInputProps.onBlur?.(e);
          }}
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines : undefined}
          textAlignVertical={multiline ? "top" : "center"}
        />

        {rightIcon ? (
          <TouchableOpacity
            onPress={onRightIconPress}
            style={styles.rightIcon}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {rightIcon}
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Error or hint */}
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderRadius: Radius.input,
    minHeight: 48,
    paddingHorizontal: Spacing.md,
  },
  inputFocused: {
    backgroundColor: Colors.surface,
  },
  multiline: {
    alignItems: "flex-start",
    paddingVertical: Spacing.md,
  },
  leftIcon: {
    marginRight: Spacing.sm,
  },
  rightIcon: {
    marginLeft: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  inputWithLeft: {
    // padding handled by leftIcon margin
  },
  inputWithRight: {
    // padding handled by rightIcon margin
  },
  multilineInput: {
    minHeight: 72,
    paddingTop: 2,
  },
  error: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: 4,
  },
  hint: {
    ...Typography.caption,
    marginTop: 4,
  },
});

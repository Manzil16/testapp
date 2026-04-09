import React, { useState } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Shadows, Spacing, Typography } from "@/src/features/shared/theme";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Show a filter button on the right */
  onFilterPress?: () => void;
  /** Badge count on the filter button */
  filterCount?: number;
  style?: ViewStyle;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search...",
  onFilterPress,
  filterCount,
  style,
  autoFocus,
  onSubmitEditing,
}: SearchBarProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, focused && styles.containerFocused, style]}>
      <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={styles.searchIcon} />

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        style={styles.input}
        autoFocus={autoFocus}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />

      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText("")} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      )}

      {onFilterPress && (
        <TouchableOpacity onPress={onFilterPress} style={styles.filterBtn} activeOpacity={0.7}>
          <Ionicons name="options-outline" size={18} color={Colors.textSecondary} />
          {filterCount && filterCount > 0 ? (
            <View style={styles.badge}>
              <Ionicons name="ellipse" size={0} color="transparent" />
              <View style={styles.badgeInner}>
                <Ionicons name="ellipse" size={0} color="transparent" />
              </View>
            </View>
          ) : null}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  containerFocused: {
    borderColor: Colors.borderFocus,
    ...Shadows.subtle,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    ...Typography.body,
    flex: 1,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
    marginLeft: Spacing.xs,
  },
  filterBtn: {
    marginLeft: Spacing.sm,
    width: 36,
    height: 36,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  badgeInner: {
    display: "none",
  },
});

import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Colors, Radius, Shadows, Spacing } from "@/src/features/shared/theme";

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
  return (
    <View style={[styles.container, style]}>
      {/* Search icon */}
      <View style={styles.searchIconWrapper}>
        <Text style={styles.searchIcon}>⌕</Text>
      </View>

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
      />

      {/* Clear button */}
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText("")} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.clearIcon}>✕</Text>
        </TouchableOpacity>
      )}

      {/* Filter button */}
      {onFilterPress && (
        <TouchableOpacity onPress={onFilterPress} style={styles.filterBtn} activeOpacity={0.7}>
          <Text style={styles.filterIcon}>⊞</Text>
          {filterCount && filterCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{filterCount}</Text>
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
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 48,
    ...Shadows.card,
  },
  searchIconWrapper: {
    marginRight: Spacing.sm,
  },
  searchIcon: {
    fontSize: 18,
    color: Colors.textMuted,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
    marginLeft: Spacing.xs,
  },
  clearIcon: {
    fontSize: 12,
    color: Colors.textMuted,
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
  filterIcon: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    minWidth: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: Colors.textInverse,
  },
});

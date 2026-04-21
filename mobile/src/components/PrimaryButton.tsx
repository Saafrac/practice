import { Pressable, StyleSheet, Text } from "react-native";

import { colors } from "../theme/colors";

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
};

export function PrimaryButton({
  title,
  onPress,
  disabled = false,
  variant = "primary",
}: PrimaryButtonProps) {
  const isGhost = variant === "ghost";

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isGhost && styles.buttonGhost,
        pressed && !disabled && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.label, isGhost && styles.labelGhost]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  buttonGhost: {
    backgroundColor: "#EEF1FF",
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  label: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  labelGhost: {
    color: colors.primary,
  },
});

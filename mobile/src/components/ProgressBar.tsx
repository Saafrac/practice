import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";

type ProgressBarProps = {
  value: number;
  label?: string;
};

export function ProgressBar({ value, label }: ProgressBarProps) {
  const normalized = Math.min(100, Math.max(0, value));

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>{label ?? "Progress"}</Text>
        <Text style={styles.value}>{normalized}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${normalized}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "600",
  },
  value: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#E9EEFF",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
});

import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";

type StatBoxProps = {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
};

export function StatBox({ label, value, tone = "default" }: StatBoxProps) {
  return (
    <View style={[styles.box, tone === "success" && styles.boxSuccess, tone === "warning" && styles.boxWarning]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    minHeight: 84,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F7F9FF",
    justifyContent: "space-between",
  },
  boxSuccess: {
    backgroundColor: "#ECFDF3",
    borderColor: "#B7EACB",
  },
  boxWarning: {
    backgroundColor: "#FFF7EA",
    borderColor: "#FCD9A6",
  },
  label: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  value: {
    color: colors.text,
    fontSize: 21,
    fontWeight: "800",
  },
});

import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";

type LoaderProps = {
  label?: string;
  light?: boolean;
};

export function Loader({ label = "Loading...", light = false }: LoaderProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={light ? "#FFFFFF" : colors.primary} size="small" />
      <Text style={[styles.label, light && styles.labelLight]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  label: {
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: "600",
  },
  labelLight: {
    color: "rgba(255,255,255,0.92)",
  },
});

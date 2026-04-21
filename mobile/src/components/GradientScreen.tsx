import { PropsWithChildren } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

export function GradientScreen({ children }: PropsWithChildren) {
  return (
    <LinearGradient
      colors={["#0B1020", "#1F2A52", "#4458FF"]}
      style={styles.gradient}
    >
      <View style={styles.overlay}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
});

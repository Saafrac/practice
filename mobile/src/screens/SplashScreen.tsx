import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

import { GradientScreen } from "../components/GradientScreen";
import { Loader } from "../components/Loader";

export function SplashScreen() {
  return (
    <GradientScreen>
      <View style={styles.container}>
        <View style={styles.badge}>
          <Ionicons color="#FFFFFF" name="school-outline" size={32} />
        </View>
        <Text style={styles.title}>Adaptive English Test AI</Text>
        <Text style={styles.subtitle}>Smart assessment and clear learning guidance</Text>
        <Loader label="Preparing your workspace..." light />
      </View>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 24,
  },
  badge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    marginBottom: 10,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
    textAlign: "center",
  },
});

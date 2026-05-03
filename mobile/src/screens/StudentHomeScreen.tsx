import { useNavigation } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { AppCard } from "../components/AppCard";
import { EmptyState } from "../components/EmptyState";
import { PrimaryButton } from "../components/PrimaryButton";
import { ProgressBar } from "../components/ProgressBar";
import { RootStackParamList } from "../navigation/types";
import { StatBox } from "../components/StatBox";
import { colors } from "../theme/colors";

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function StudentHomeScreen() {
  const navigation = useNavigation<Navigation>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>Student home</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Run tests, monitor progress, and improve weak topics.</Text>
      </View>

      <View style={styles.statRow}>
        <StatBox label="Current level" value="A2" />
        <StatBox label="Avg score" value="74%" tone="success" />
      </View>

      <AppCard title="Learning progress" subtitle="Weekly consistency and score growth">
        <ProgressBar label="This week completion" value={62} />
        <ProgressBar label="Grammar confidence" value={58} />
      </AppCard>

      <AppCard title="Knowledge control" subtitle="Three required assessment modes are available for demonstration.">
        <View style={styles.controlList}>
          <View style={styles.controlItem}>
            <Text style={styles.controlTitle}>Diagnostic control</Text>
            <Text style={styles.controlText}>Initial placement before practice begins.</Text>
            <PrimaryButton title="Start Diagnostic Test" onPress={() => navigation.navigate("DiagnosticTest")} />
          </View>
          <View style={styles.controlItem}>
            <Text style={styles.controlTitle}>Adaptive control</Text>
            <Text style={styles.controlText}>Current learning check with theta-based question selection.</Text>
            <PrimaryButton title="Start Adaptive Test" onPress={() => navigation.navigate("AdaptiveTest")} variant="ghost" />
          </View>
          <View style={styles.controlItem}>
            <Text style={styles.controlTitle}>Final control</Text>
            <Text style={styles.controlText}>Final assessment of your English level.</Text>
            <PrimaryButton title="Start Final Test" onPress={() => navigation.navigate("FinalTest")} variant="ghost" />
          </View>
        </View>
        <PrimaryButton title="Open history" onPress={() => navigation.navigate("History")} variant="ghost" />
      </AppCard>

      <AppCard title="Recommendations">
        <EmptyState
          title="Personal recommendations will appear here"
          description="After your first adaptive attempt, we will show weak themes and targeted practice."
          icon="bulb-outline"
        />
      </AppCard>

      <View style={styles.footerHint}>
        <Ionicons color={colors.mutedText} name="time-outline" size={16} />
        <Text style={styles.footerText}>Estimated session time: 8-12 minutes</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
    gap: 14,
    paddingBottom: 32,
  },
  hero: {
    gap: 8,
  },
  heroKicker: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
  },
  controlList: {
    gap: 10,
  },
  controlItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "#F9FAFF",
    padding: 12,
    gap: 8,
  },
  controlTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  controlText: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  footerHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  footerText: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "600",
  },
});

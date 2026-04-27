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

      <AppCard title="Quick actions">
        <PrimaryButton title="Start diagnostic test" onPress={() => navigation.navigate("DiagnosticTest")} />
        <PrimaryButton title="Start adaptive test" onPress={() => navigation.navigate("AdaptiveTest")} variant="ghost" />
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

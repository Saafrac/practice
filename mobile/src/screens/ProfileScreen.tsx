import { ScrollView, StyleSheet, Text, View } from "react-native";

import { AppCard } from "../components/AppCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { StatBox } from "../components/StatBox";
import { useAuthStore } from "../store/authStore";
import { colors } from "../theme/colors";

export function ProfileScreen() {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Account</Text>
        <Text style={styles.title}>Profile</Text>
      </View>

      <AppCard title={user?.full_name ?? "User"} subtitle={user?.email ?? "-"}>
        <View style={styles.statRow}>
          <StatBox
            label="Role"
            value={(user?.role ?? "-").toUpperCase()}
            tone="default"
          />
          <StatBox label="Status" value="Active" tone="success" />
        </View>
      </AppCard>

      <AppCard title="Session">
        <Text style={styles.label}>You are authenticated and role access is active.</Text>
        <PrimaryButton title="Log out" onPress={() => void logout()} />
      </AppCard>

      <View style={styles.footerGap}>
        <Text style={styles.footerText}>Security tip: use unique passwords for demo accounts.</Text>
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
  header: {
    gap: 8,
  },
  kicker: {
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
  label: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
  },
  footerGap: {
    marginTop: 2,
  },
  footerText: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "600",
  },
});

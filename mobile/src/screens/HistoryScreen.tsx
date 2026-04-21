import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchStudentHistory } from "../api/studentApi";
import { AppCard } from "../components/AppCard";
import { EmptyState } from "../components/EmptyState";
import { PrimaryButton } from "../components/PrimaryButton";
import { SkeletonBlock } from "../components/SkeletonBlock";
import { StatBox } from "../components/StatBox";
import { RootStackParamList } from "../navigation/types";
import { useAuthStore } from "../store/authStore";
import { StudentHistoryResponse } from "../types/student";
import { colors } from "../theme/colors";

type Navigation = NativeStackNavigationProp<RootStackParamList>;

function trendLabel(trend: "up" | "down" | "stable") {
  if (trend === "up") {
    return "Improving";
  }
  if (trend === "down") {
    return "Needs focus";
  }
  return "Stable";
}

export function HistoryScreen() {
  const navigation = useNavigation<Navigation>();
  const token = useAuthStore((state) => state.token);

  const [payload, setPayload] = useState<StudentHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadHistory() {
      if (!token) {
        if (isMounted) {
          setError("Authentication token is missing. Please sign in again.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const response = await fetchStudentHistory(token);
        if (isMounted) {
          setPayload(response);
        }
      } catch (requestError) {
        if (isMounted) {
          setError(requestError instanceof Error ? requestError.message : "Could not load history.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const chartItems = useMemo(() => payload?.attempts.slice(0, 8).reverse() ?? [], [payload]);

  if (isLoading) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <SkeletonBlock width="35%" height={12} />
          <SkeletonBlock width="62%" height={30} />
          <SkeletonBlock width="85%" height={14} />
        </View>
        <AppCard title="Loading summary" animated={false}>
          <SkeletonBlock height={44} />
          <SkeletonBlock height={44} />
        </AppCard>
        <AppCard title="Loading trend" animated={false}>
          <SkeletonBlock height={14} />
          <SkeletonBlock height={14} width="92%" />
          <SkeletonBlock height={14} width="84%" />
          <SkeletonBlock height={14} width="74%" />
        </AppCard>
        <AppCard title="Loading attempts" animated={false}>
          <SkeletonBlock height={56} />
          <SkeletonBlock height={56} />
          <SkeletonBlock height={56} />
        </AppCard>
      </ScrollView>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <AppCard title="History unavailable" subtitle={error}>
          <PrimaryButton title="Back to dashboard" onPress={() => navigation.navigate("RoleTabs")} />
        </AppCard>
      </View>
    );
  }

  const summary = payload?.summary;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Student history</Text>
        <Text style={styles.title}>Track your progress</Text>
        <Text style={styles.subtitle}>See every finished attempt and how your score changes over time.</Text>
      </View>

      <View style={styles.statRow}>
        <StatBox label="Attempts" value={`${summary?.total_attempts ?? 0}`} />
        <StatBox label="Avg score" value={`${Math.round(summary?.average_score ?? 0)}%`} tone="success" />
      </View>

      <View style={styles.statRow}>
        <StatBox label="Best score" value={`${Math.round(summary?.best_score ?? 0)}%`} />
        <StatBox label="Trend" value={trendLabel(summary?.trend ?? "stable")} tone="default" />
      </View>

      <AppCard title="Score trend" subtitle="Recent attempts">
        {chartItems.length > 0 ? (
          <View style={styles.chartWrap}>
            {chartItems.map((item) => (
              <View key={item.attempt_id} style={styles.chartRow}>
                <Text style={styles.chartLabel}>#{item.attempt_id}</Text>
                <View style={styles.chartTrack}>
                  <View style={[styles.chartFill, { width: `${Math.max(4, Math.round(item.score_percent))}%` }]} />
                </View>
                <Text style={styles.chartValue}>{Math.round(item.score_percent)}%</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            title="No finished attempts yet"
            description="Complete a diagnostic or adaptive test to populate history."
            icon="bar-chart-outline"
          />
        )}
      </AppCard>

      <AppCard title="Attempts list">
        {payload && payload.attempts.length > 0 ? (
          <View style={styles.listWrap}>
            {payload.attempts.map((attempt) => (
              <Pressable
                key={attempt.attempt_id}
                style={styles.attemptCard}
                onPress={() => navigation.navigate("TestResult", { attemptId: attempt.attempt_id })}
              >
                <View style={styles.attemptTop}>
                  <Text style={styles.attemptTitle}>#{attempt.attempt_id} • {attempt.test_type}</Text>
                  <Text style={styles.attemptScore}>{Math.round(attempt.score_percent)}%</Text>
                </View>
                <Text style={styles.attemptMeta}>{new Date(attempt.finished_at).toLocaleString()}</Text>
                <Text style={styles.attemptMeta}>Level: {attempt.level_result} | Theta: {attempt.theta_final.toFixed(2)}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState
            title="No history entries"
            description="Your completed tests will be listed here."
            icon="time-outline"
          />
        )}
      </AppCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: "center",
  },
  scroll: {
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
  subtitle: {
    color: colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
  },
  chartWrap: {
    gap: 8,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chartLabel: {
    width: 40,
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
  },
  chartTrack: {
    flex: 1,
    height: 12,
    backgroundColor: "#E8EDFF",
    borderRadius: 6,
    overflow: "hidden",
  },
  chartFill: {
    height: 12,
    backgroundColor: colors.primary,
    borderRadius: 6,
  },
  chartValue: {
    width: 40,
    textAlign: "right",
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
  },
  listWrap: {
    gap: 10,
  },
  attemptCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#F9FAFF",
    gap: 4,
  },
  attemptTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  attemptTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  attemptScore: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  attemptMeta: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
  },
});

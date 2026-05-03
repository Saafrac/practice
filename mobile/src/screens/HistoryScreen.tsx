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
import { StudentHistoryItem, StudentHistoryResponse } from "../types/student";
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

function getCefrLevel(scorePercent: number) {
  if (scorePercent < 40) {
    return "A1";
  }
  if (scorePercent < 55) {
    return "A2";
  }
  if (scorePercent < 75) {
    return "B1";
  }
  if (scorePercent < 90) {
    return "B2";
  }
  return "C1";
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatTheta(value: number) {
  return value.toFixed(2);
}

function formatScoreDelta(value: number | null) {
  if (value === null) {
    return "-";
  }
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function formatThetaDelta(value: number | null) {
  if (value === null) {
    return "-";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function deltaTone(value: number | null): "default" | "success" | "warning" {
  if (value === null || Math.abs(value) < 0.01) {
    return "default";
  }
  return value > 0 ? "success" : "warning";
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function normalizeTheta(value: number) {
  return clampPercent(((value + 2) / 4) * 100);
}

type TrendChartProps = {
  items: StudentHistoryItem[];
  mode: "score" | "theta";
};

function TrendChart({ items, mode }: TrendChartProps) {
  const isScore = mode === "score";

  return (
    <View style={styles.trendChart}>
      <View style={styles.chartGrid}>
        <View style={styles.gridLine} />
        <View style={styles.gridLine} />
        <View style={styles.gridLine} />
      </View>

      <View style={styles.trendColumns}>
        {items.map((item) => {
          const rawValue = isScore ? item.score_percent : item.theta_final;
          const normalized = isScore ? clampPercent(rawValue) : normalizeTheta(rawValue);
          const pointBottom = Math.max(7, Math.min(89, normalized));

          return (
            <View key={`${mode}-${item.attempt_id}`} style={styles.trendColumn}>
              <View style={styles.pointArea}>
                <View style={[styles.pointStem, { height: `${pointBottom}%` }]} />
                <View
                  style={[
                    styles.trendPoint,
                    { bottom: `${pointBottom}%` },
                    !isScore && styles.thetaPoint,
                  ]}
                />
              </View>
              <Text style={styles.trendValue}>
                {isScore ? formatPercent(rawValue) : formatTheta(rawValue)}
              </Text>
              <Text style={styles.trendAttempt}>#{item.attempt_id}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
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

  const recentTrendItems = useMemo(() => payload?.attempts.slice(0, 8).reverse() ?? [], [payload]);
  const latestAttempts = useMemo(() => payload?.attempts.slice(0, 5) ?? [], [payload]);
  const latestAttempt = payload?.attempts[0] ?? null;
  const previousAttempt = payload?.attempts[1] ?? null;
  const hasTrendData = recentTrendItems.length >= 2;
  const scoreDelta = latestAttempt && previousAttempt ? latestAttempt.score_percent - previousAttempt.score_percent : null;
  const thetaDelta = latestAttempt && previousAttempt ? latestAttempt.theta_final - previousAttempt.theta_final : null;
  const latestCefr = latestAttempt ? getCefrLevel(latestAttempt.score_percent) : "-";

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
          <SkeletonBlock height={124} />
          <SkeletonBlock height={14} width="92%" />
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
        <Text style={styles.subtitle}>See finished attempts, score growth, theta movement, and level changes over time.</Text>
      </View>

      <View style={styles.statRow}>
        <StatBox label="Attempts" value={`${summary?.total_attempts ?? 0}`} />
        <StatBox label="Latest level" value={latestCefr} tone={latestAttempt ? "success" : "default"} />
      </View>

      <View style={styles.statRow}>
        <StatBox label="Avg score" value={formatPercent(summary?.average_score ?? 0)} tone="success" />
        <StatBox label="Best score" value={formatPercent(summary?.best_score ?? 0)} />
      </View>

      <View style={styles.statRow}>
        <StatBox label="Score trend" value={formatScoreDelta(scoreDelta)} tone={deltaTone(scoreDelta)} />
        <StatBox label="Theta trend" value={formatThetaDelta(thetaDelta)} tone={deltaTone(thetaDelta)} />
      </View>

      <AppCard
        title="Progress overview"
        subtitle={
          hasTrendData
            ? `${trendLabel(summary?.trend ?? "stable")} across recent attempts. Latest level: ${latestCefr}${latestAttempt ? ` / ${latestAttempt.level_result}` : ""}.`
            : "Complete at least two attempts to unlock the score and theta trend."
        }
      >
        {hasTrendData ? (
          <View style={styles.progressWrap}>
            <View style={styles.chartHeader}>
              <Text style={styles.sectionLabel}>Score timeline</Text>
              <Text style={styles.sectionMeta}>last {recentTrendItems.length}</Text>
            </View>
            <TrendChart items={recentTrendItems} mode="score" />

            <View style={styles.chartHeader}>
              <Text style={styles.sectionLabel}>Theta trend</Text>
              <Text style={styles.sectionMeta}>-2.00 to +2.00</Text>
            </View>
            <TrendChart items={recentTrendItems} mode="theta" />
          </View>
        ) : (
          <View style={styles.emptyProgress}>
            <EmptyState
              title={latestAttempt ? "One more attempt will reveal your trend" : "No finished attempts yet"}
              description={
                latestAttempt
                  ? "Your first result is saved. Finish one adaptive test to compare score, theta, and level movement."
                  : "Start an adaptive test so the app can build a progress timeline for defense."
              }
              icon="analytics-outline"
            />
            <PrimaryButton title="Start adaptive test" onPress={() => navigation.navigate("AdaptiveTest")} />
          </View>
        )}
      </AppCard>

      {hasTrendData ? (
        <AppCard title="Level timeline" subtitle="CEFR-like bands from recent attempts">
          <View style={styles.levelTimeline}>
            {recentTrendItems.map((item, index) => (
              <View key={`level-${item.attempt_id}`} style={styles.levelStep}>
                {index > 0 ? <View style={styles.levelConnector} /> : null}
                <View style={styles.levelBadge}>
                  <Text style={styles.levelBadgeText}>{getCefrLevel(item.score_percent)}</Text>
                </View>
                <Text style={styles.levelAttempt}>#{item.attempt_id}</Text>
                <Text style={styles.levelScore}>{formatPercent(item.score_percent)}</Text>
              </View>
            ))}
          </View>
        </AppCard>
      ) : null}

      <AppCard title="Last 5 attempts">
        {latestAttempts.length > 0 ? (
          <View style={styles.listWrap}>
            {latestAttempts.map((attempt) => (
              <Pressable
                key={attempt.attempt_id}
                style={styles.attemptCard}
                onPress={() => navigation.navigate("TestResult", { attemptId: attempt.attempt_id })}
              >
                <View style={styles.attemptTop}>
                  <Text style={styles.attemptTitle}>#{attempt.attempt_id} | {attempt.test_type}</Text>
                  <Text style={styles.attemptScore}>{formatPercent(attempt.score_percent)}</Text>
                </View>
                <Text style={styles.attemptMeta}>{new Date(attempt.finished_at).toLocaleString()}</Text>
                <Text style={styles.attemptMeta}>
                  Level: {getCefrLevel(attempt.score_percent)} / {attempt.level_result} | Theta: {formatTheta(attempt.theta_final)}
                </Text>
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
  progressWrap: {
    gap: 14,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  sectionMeta: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  trendChart: {
    height: 154,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "#F9FAFF",
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 8,
    overflow: "hidden",
  },
  chartGrid: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 8,
    paddingTop: 28,
    paddingBottom: 42,
    justifyContent: "space-between",
  },
  gridLine: {
    height: 1,
    backgroundColor: "#E2E8FF",
  },
  trendColumns: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
  },
  trendColumn: {
    flex: 1,
    alignItems: "center",
    minWidth: 34,
  },
  pointArea: {
    flex: 1,
    width: "100%",
    position: "relative",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  pointStem: {
    width: 2,
    minHeight: 8,
    borderRadius: 999,
    backgroundColor: "#C9D3FF",
  },
  trendPoint: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  thetaPoint: {
    backgroundColor: colors.success,
  },
  trendValue: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 6,
  },
  trendAttempt: {
    color: colors.mutedText,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  emptyProgress: {
    gap: 12,
  },
  levelTimeline: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    paddingTop: 4,
  },
  levelStep: {
    flex: 1,
    alignItems: "center",
    position: "relative",
    minWidth: 44,
  },
  levelConnector: {
    position: "absolute",
    top: 17,
    right: "50%",
    width: "100%",
    height: 2,
    backgroundColor: "#CCD6FF",
  },
  levelBadge: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#EEF1FF",
    borderWidth: 1,
    borderColor: "#C7D0FF",
    alignItems: "center",
    justifyContent: "center",
  },
  levelBadgeText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  levelAttempt: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 6,
  },
  levelScore: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
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
    gap: 10,
  },
  attemptTitle: {
    flex: 1,
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
    lineHeight: 17,
  },
});

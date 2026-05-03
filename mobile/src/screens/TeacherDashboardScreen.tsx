import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchTeacherGroupAnalytics, fetchTeacherStudents } from "../api/teacherApi";
import { AppCard } from "../components/AppCard";
import { EmptyState } from "../components/EmptyState";
import { PrimaryButton } from "../components/PrimaryButton";
import { ProgressBar } from "../components/ProgressBar";
import { SkeletonBlock } from "../components/SkeletonBlock";
import { StatBox } from "../components/StatBox";
import { RootStackParamList } from "../navigation/types";
import { useAuthStore } from "../store/authStore";
import { TeacherGroupAnalyticsResponse, TeacherStudentsResponse } from "../types/teacher";
import { colors } from "../theme/colors";

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const LEVEL_BUCKETS = [
  { key: "Beginner", label: "Beginner", aliases: ["beginner", "a1"] },
  { key: "Elementary", label: "Elementary", aliases: ["elementary", "a2"] },
  { key: "Pre-Intermediate", label: "Pre-Intermediate", aliases: ["pre-intermediate", "pre intermediate", "b1"] },
  { key: "Intermediate", label: "Intermediate", aliases: ["intermediate", "b2", "c1"] },
] as const;

type LevelBucketKey = (typeof LEVEL_BUCKETS)[number]["key"];

function normalizeLevel(level: string | null): LevelBucketKey | null {
  if (!level) {
    return null;
  }

  const normalized = level.trim().toLowerCase();
  const bucket = LEVEL_BUCKETS.find((item) => item.aliases.some((alias) => normalized.includes(alias)));
  return bucket?.key ?? null;
}

export function TeacherDashboardScreen() {
  const navigation = useNavigation<Navigation>();
  const token = useAuthStore((state) => state.token);

  const [studentsPayload, setStudentsPayload] = useState<TeacherStudentsResponse | null>(null);
  const [analyticsPayload, setAnalyticsPayload] = useState<TeacherGroupAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    if (!token) {
      setError("Authentication token is missing. Please sign in again.");
      setIsLoading(false);
      return;
    }

    setError(null);
    try {
      const [students, analytics] = await Promise.all([
        fetchTeacherStudents(token),
        fetchTeacherGroupAnalytics(token),
      ]);
      setStudentsPayload(students);
      setAnalyticsPayload(analytics);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load teacher dashboard.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const students = studentsPayload?.students ?? [];
  const analytics = analyticsPayload;
  const mostProblematicTopic = analytics?.weak_topics[0] ?? null;
  const mostProblematicTopicLabel = mostProblematicTopic?.topic ?? "None";
  const distribution = useMemo(() => {
    const counts: Record<LevelBucketKey, number> = {
      Beginner: 0,
      Elementary: 0,
      "Pre-Intermediate": 0,
      Intermediate: 0,
    };
    let unplaced = 0;

    students.forEach((student) => {
      const level = normalizeLevel(student.last_level);
      if (level) {
        counts[level] += 1;
      } else {
        unplaced += 1;
      }
    });

    return {
      counts,
      total: students.length,
      unplaced,
    };
  }, [students]);

  if (isLoading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <SkeletonBlock width="35%" height={12} />
          <SkeletonBlock width="60%" height={30} />
          <SkeletonBlock width="80%" height={14} />
        </View>
        <AppCard title="Loading metrics" animated={false}>
          <SkeletonBlock height={44} />
          <SkeletonBlock height={44} />
        </AppCard>
        <AppCard title="Loading weaknesses" animated={false}>
          <SkeletonBlock height={14} />
          <SkeletonBlock height={14} width="90%" />
          <SkeletonBlock height={14} width="78%" />
        </AppCard>
      </ScrollView>
    );
  }

  if (error) {
    return (
      <View style={styles.containerCenter}>
        <AppCard title="Teacher dashboard unavailable" subtitle={error}>
          <PrimaryButton
            title="Retry"
            onPress={() => {
              setIsLoading(true);
              void loadDashboard();
            }}
          />
        </AppCard>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Teacher panel</Text>
        <Text style={styles.title}>Group overview</Text>
        <Text style={styles.subtitle}>Track student performance and weak topics per group.</Text>
      </View>

      <View style={styles.statRow}>
        <StatBox label="Students" value={`${analytics?.students_count ?? 0}`} />
        <StatBox label="Group avg" value={`${Math.round(analytics?.average_score ?? 0)}%`} tone="success" />
      </View>

      <View style={styles.statRow}>
        <StatBox label="Attempts" value={`${analytics?.total_attempts ?? 0}`} />
        <StatBox
          label="Most problematic"
          value={mostProblematicTopicLabel}
          tone={mostProblematicTopic ? "warning" : "default"}
        />
      </View>

      <AppCard title="Level distribution" subtitle="Based on each student's latest finished attempt" delay={60}>
        {distribution.total > 0 ? (
          <View style={styles.distributionWrap}>
            {LEVEL_BUCKETS.map((bucket) => {
              const count = distribution.counts[bucket.key];
              const percent = distribution.total > 0 ? Math.round((count / distribution.total) * 100) : 0;

              return (
                <View key={bucket.key} style={styles.distributionRow}>
                  <View style={styles.distributionTop}>
                    <Text style={styles.distributionLabel}>{bucket.label}</Text>
                    <Text style={styles.distributionValue}>
                      {count} students | {percent}%
                    </Text>
                  </View>
                  <View style={styles.distributionTrack}>
                    <View style={[styles.distributionFill, { width: `${Math.max(count > 0 ? 5 : 0, percent)}%` }]} />
                  </View>
                </View>
              );
            })}
            {distribution.unplaced > 0 ? (
              <Text style={styles.unplacedText}>{distribution.unplaced} students have no finished attempt yet.</Text>
            ) : null}
          </View>
        ) : (
          <EmptyState
            title="No students to distribute"
            description="Assign students to your group to see level distribution."
            icon="stats-chart-outline"
          />
        )}
      </AppCard>

      <AppCard title="Problem topics" subtitle="Mistake rate across finished group attempts" delay={80}>
        {analytics && analytics.weak_topics.length > 0 ? (
          <View style={styles.problemTopicsWrap}>
            {mostProblematicTopic ? (
              <View style={styles.problemSummary}>
                <View>
                  <Text style={styles.problemSummaryLabel}>Most problematic topic</Text>
                  <Text style={styles.problemSummaryTitle}>{mostProblematicTopic.topic}</Text>
                </View>
                <View style={styles.problemSummaryStats}>
                  <Text style={styles.problemSummaryValue}>{mostProblematicTopic.wrong_answers}</Text>
                  <Text style={styles.problemSummaryMeta}>wrong answers</Text>
                </View>
              </View>
            ) : null}

            {analytics.weak_topics.map((topic) => {
              const mistakePercent = Math.max(0, Math.min(100, 100 - topic.accuracy_percent));
              return (
                <ProgressBar
                  key={topic.topic}
                  label={`${topic.topic} | ${topic.wrong_answers} wrong | ${Math.round(topic.accuracy_percent)}% accuracy`}
                  value={Math.round(mistakePercent)}
                />
              );
            })}
          </View>
        ) : (
          <EmptyState
            title="No problem topics detected"
            description="Group needs finished attempts before aggregated error topics appear."
            icon="checkmark-done-outline"
          />
        )}
      </AppCard>

      <AppCard title="Students" delay={120}>
        {students.length > 0 ? (
          <View style={styles.listWrap}>
            {students.map((student) => (
              <Pressable
                key={student.id}
                style={styles.studentRow}
                onPress={() =>
                  navigation.navigate("TeacherStudentResults", {
                    studentId: student.id,
                    studentName: student.full_name,
                  })
                }
              >
                <View>
                  <Text style={styles.studentName}>{student.full_name}</Text>
                  <Text style={styles.studentMeta}>{student.email}</Text>
                  <Text style={styles.studentMeta}>
                    Attempts: {student.attempts_count} | Last level: {student.last_level ?? "-"}
                  </Text>
                </View>
                <Text style={styles.studentScore}>{Math.round(student.average_score)}%</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <EmptyState
            title="No students found"
            description="Assign students to your group to see analytics here."
            icon="people-outline"
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
  },
  containerCenter: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    padding: 24,
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
  distributionWrap: {
    gap: 12,
  },
  distributionRow: {
    gap: 7,
  },
  distributionTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  distributionLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  distributionValue: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
  },
  distributionTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#E8EDFF",
    overflow: "hidden",
  },
  distributionFill: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  unplacedText: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
  },
  problemTopicsWrap: {
    gap: 14,
  },
  problemSummary: {
    borderWidth: 1,
    borderColor: "#FCD9A6",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#FFF7EA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  problemSummaryLabel: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  problemSummaryTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 3,
  },
  problemSummaryStats: {
    alignItems: "flex-end",
  },
  problemSummaryValue: {
    color: colors.warning,
    fontSize: 22,
    fontWeight: "900",
  },
  problemSummaryMeta: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "700",
  },
  listWrap: {
    gap: 10,
  },
  studentRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#F9FAFF",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  studentName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  studentMeta: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
  },
  studentScore: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: "800",
    alignSelf: "center",
  },
});

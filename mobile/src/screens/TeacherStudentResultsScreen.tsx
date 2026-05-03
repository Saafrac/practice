import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchTeacherStudentReport, fetchTeacherStudentResults } from "../api/teacherApi";
import { AppCard } from "../components/AppCard";
import { EmptyState } from "../components/EmptyState";
import { PrimaryButton } from "../components/PrimaryButton";
import { SkeletonBlock } from "../components/SkeletonBlock";
import { RootStackParamList } from "../navigation/types";
import { useAuthStore } from "../store/authStore";
import { TeacherStudentReportResponse, TeacherStudentResultsResponse } from "../types/teacher";
import { colors } from "../theme/colors";

type ScreenRoute = RouteProp<RootStackParamList, "TeacherStudentResults">;
type Navigation = NativeStackNavigationProp<RootStackParamList>;

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatTheta(value: number) {
  return value.toFixed(2);
}

export function TeacherStudentResultsScreen() {
  const route = useRoute<ScreenRoute>();
  const navigation = useNavigation<Navigation>();
  const token = useAuthStore((state) => state.token);

  const [payload, setPayload] = useState<TeacherStudentResultsResponse | null>(null);
  const [reportPayload, setReportPayload] = useState<TeacherStudentReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadResults = async () => {
    if (!token) {
      setError("Authentication token is missing. Please sign in again.");
      setIsLoading(false);
      return;
    }

    setError(null);
    try {
      const [resultsResponse, reportResponse] = await Promise.all([
        fetchTeacherStudentResults(token, route.params.studentId),
        fetchTeacherStudentReport(token, route.params.studentId),
      ]);
      setPayload(resultsResponse);
      setReportPayload(reportResponse);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load student results.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params.studentId, token]);

  const latestAttempt = reportPayload?.latest_attempt ?? payload?.results[0] ?? null;
  const reportWeakTopics = reportPayload?.weak_topics ?? [];
  const reportRecommendations = reportPayload?.recommendations ?? [];

  if (isLoading) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <SkeletonBlock width="30%" height={12} />
          <SkeletonBlock width="55%" height={30} />
          <SkeletonBlock width="75%" height={14} />
        </View>
        <AppCard title="Loading attempts" animated={false}>
          <SkeletonBlock height={56} />
          <SkeletonBlock height={56} />
          <SkeletonBlock height={56} />
        </AppCard>
      </ScrollView>
    );
  }

  if (error || !payload) {
    return (
      <View style={styles.container}>
        <AppCard title="Student data unavailable" subtitle={error ?? "No data available."}>
          <PrimaryButton title="Retry" onPress={() => {
            setIsLoading(true);
            void loadResults();
          }} />
          <PrimaryButton title="Back" variant="ghost" onPress={() => navigation.goBack()} />
        </AppCard>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Teacher view</Text>
        <Text style={styles.title}>{payload.student_name}</Text>
        <Text style={styles.subtitle}>Finished attempts and progression for this student.</Text>
      </View>

      <AppCard title="Report preview" subtitle="Individual teaching summary based on the latest finished attempt" delay={60}>
        {latestAttempt ? (
          <View style={styles.reportWrap}>
            <View style={styles.reportHeader}>
              <View style={styles.reportIdentity}>
                <Text style={styles.reportLabel}>Student</Text>
                <Text style={styles.reportName}>{payload.student_name}</Text>
                <Text style={styles.reportDate}>
                  Latest attempt: {new Date(latestAttempt.finished_at).toLocaleString()}
                </Text>
              </View>
              <View style={styles.reportBadge}>
                <Text style={styles.reportBadgeLabel}>Level</Text>
                <Text style={styles.reportBadgeValue}>{latestAttempt.level_result}</Text>
              </View>
            </View>

            <View style={styles.reportStats}>
              <View style={styles.reportStat}>
                <Text style={styles.reportStatLabel}>Last score</Text>
                <Text style={styles.reportStatValue}>{formatPercent(latestAttempt.score_percent)}</Text>
              </View>
              <View style={styles.reportStat}>
                <Text style={styles.reportStatLabel}>Theta</Text>
                <Text style={styles.reportStatValue}>{formatTheta(latestAttempt.theta_final)}</Text>
              </View>
              <View style={styles.reportStat}>
                <Text style={styles.reportStatLabel}>Test type</Text>
                <Text style={styles.reportStatValue}>{latestAttempt.test_type}</Text>
              </View>
            </View>

            <View style={styles.reportSection}>
              <Text style={styles.reportSectionTitle}>Weak areas</Text>
              {reportWeakTopics.length > 0 ? (
                reportWeakTopics.map((item) => (
                  <Text key={item.topic} style={styles.reportBullet}>
                    - {item.topic}: {item.wrong_answers} wrong, {Math.round(item.accuracy_percent)}% accuracy
                  </Text>
                ))
              ) : (
                <Text style={styles.reportMuted}>No weak topics detected for the latest attempt.</Text>
              )}
            </View>

            <View style={styles.reportSection}>
              <Text style={styles.reportSectionTitle}>Recommendations</Text>
              {reportRecommendations.length > 0 ? (
                reportRecommendations.map((item) => (
                  <Text key={item} style={styles.reportBullet}>- {item}</Text>
                ))
              ) : (
                <Text style={styles.reportMuted}>No recommendations stored for the latest attempt yet.</Text>
              )}
            </View>
          </View>
        ) : (
          <EmptyState
            title="Report preview unavailable"
            description="The preview appears after the student completes at least one test."
            icon="document-text-outline"
          />
        )}
      </AppCard>

      <AppCard title="Attempts" delay={90}>
        {payload.results.length > 0 ? (
          <View style={styles.listWrap}>
            {payload.results.map((result) => (
              <View key={result.attempt_id} style={styles.attemptCard}>
                <View style={styles.topRow}>
                  <Text style={styles.idText}>#{result.attempt_id} • {result.test_type}</Text>
                  <Text style={styles.scoreText}>{Math.round(result.score_percent)}%</Text>
                </View>
                <Text style={styles.metaText}>{new Date(result.finished_at).toLocaleString()}</Text>
                <Text style={styles.metaText}>Level: {result.level_result} | Theta: {result.theta_final.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            title="No attempts yet"
            description="This student has no finished tests in the system."
            icon="school-outline"
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
  reportWrap: {
    gap: 14,
  },
  reportHeader: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#F9FAFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  reportIdentity: {
    flex: 1,
    gap: 3,
  },
  reportLabel: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  reportName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  reportDate: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  reportBadge: {
    minWidth: 94,
    borderRadius: 14,
    backgroundColor: "#EEF1FF",
    borderWidth: 1,
    borderColor: "#C7D0FF",
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  reportBadgeLabel: {
    color: colors.mutedText,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  reportBadgeValue: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 2,
    textAlign: "center",
  },
  reportStats: {
    flexDirection: "row",
    gap: 8,
  },
  reportStat: {
    flex: 1,
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    padding: 10,
    justifyContent: "space-between",
  },
  reportStatLabel: {
    color: colors.mutedText,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  reportStatValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  reportSection: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    padding: 12,
    gap: 7,
  },
  reportSectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  reportBullet: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  reportMuted: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "600",
    fontStyle: "italic",
    lineHeight: 19,
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
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  idText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  scoreText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  metaText: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
  },
});

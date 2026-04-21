import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
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

  const students = studentsPayload?.students ?? [];
  const analytics = analyticsPayload;

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
        <StatBox label="Active list" value={`${students.length}`} />
      </View>

      <AppCard title="Topic weaknesses" delay={80}>
        {analytics && analytics.weak_topics.length > 0 ? (
          analytics.weak_topics.map((topic) => {
            const weakness = Math.max(0, Math.min(100, 100 - topic.accuracy_percent));
            return (
              <ProgressBar
                key={topic.topic}
                label={`${topic.topic} (${topic.wrong_answers} wrong)`}
                value={Math.round(weakness)}
              />
            );
          })
        ) : (
          <EmptyState
            title="No weak topics detected"
            description="Group has no enough finished attempts for topic profiling yet."
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

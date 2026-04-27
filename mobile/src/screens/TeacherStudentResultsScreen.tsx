import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchTeacherStudentResults } from "../api/teacherApi";
import { AppCard } from "../components/AppCard";
import { EmptyState } from "../components/EmptyState";
import { PrimaryButton } from "../components/PrimaryButton";
import { SkeletonBlock } from "../components/SkeletonBlock";
import { RootStackParamList } from "../navigation/types";
import { useAuthStore } from "../store/authStore";
import { TeacherStudentResultsResponse } from "../types/teacher";
import { colors } from "../theme/colors";

type ScreenRoute = RouteProp<RootStackParamList, "TeacherStudentResults">;
type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function TeacherStudentResultsScreen() {
  const route = useRoute<ScreenRoute>();
  const navigation = useNavigation<Navigation>();
  const token = useAuthStore((state) => state.token);

  const [payload, setPayload] = useState<TeacherStudentResultsResponse | null>(null);
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
      const response = await fetchTeacherStudentResults(token, route.params.studentId);
      setPayload(response);
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

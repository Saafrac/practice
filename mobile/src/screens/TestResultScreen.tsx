import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchAttemptResult } from "../api/testingApi";
import { AppCard } from "../components/AppCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { SkeletonBlock } from "../components/SkeletonBlock";
import { StatBox } from "../components/StatBox";
import { RootStackParamList } from "../navigation/types";
import { useAuthStore } from "../store/authStore";
import { AttemptResultResponse } from "../types/testing";
import { colors } from "../theme/colors";

type ResultRoute = RouteProp<RootStackParamList, "TestResult">;
type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function TestResultScreen() {
  const route = useRoute<ResultRoute>();
  const navigation = useNavigation<Navigation>();
  const token = useAuthStore((state) => state.token);

  const [result, setResult] = useState<AttemptResultResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadResult = async () => {
    if (!token) {
      setError("Authentication token is missing. Please sign in again.");
      setIsLoading(false);
      return;
    }

    setError(null);
    try {
      const payload = await fetchAttemptResult(token, route.params.attemptId);
      setResult(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load result.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadResult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params.attemptId, token]);

  if (isLoading) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <SkeletonBlock width="30%" height={12} />
          <SkeletonBlock width="46%" height={30} />
          <SkeletonBlock width="84%" height={14} />
        </View>
        <AppCard title="Loading result" animated={false}>
          <SkeletonBlock height={44} />
          <SkeletonBlock height={44} />
        </AppCard>
        <AppCard title="Loading analysis" animated={false}>
          <SkeletonBlock height={14} />
          <SkeletonBlock height={14} width="94%" />
          <SkeletonBlock height={14} width="82%" />
        </AppCard>
      </ScrollView>
    );
  }

  if (error || !result) {
    return (
      <View style={styles.container}>
        <AppCard title="Result unavailable" subtitle={error ?? "No data available for this attempt."}>
          <PrimaryButton
            title="Retry"
            onPress={() => {
              setIsLoading(true);
              void loadResult();
            }}
          />
          <PrimaryButton title="Back to home" variant="ghost" onPress={() => navigation.navigate("RoleTabs")} />
        </AppCard>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Test result</Text>
        <Text style={styles.title}>{result.level_result}</Text>
        <Text style={styles.subtitle}>You answered {result.correct_answers} of {result.total_questions} questions correctly.</Text>
      </View>

      <View style={styles.statRow}>
        <StatBox label="Score" value={`${Math.round(result.score_percent)}%`} tone="success" />
        <StatBox label="Theta" value={result.theta_final.toFixed(2)} />
      </View>

      <AppCard title="Summary" delay={60}>
        <Text style={styles.summaryLine}>Started: {new Date(result.started_at).toLocaleString()}</Text>
        <Text style={styles.summaryLine}>Finished: {new Date(result.finished_at).toLocaleString()}</Text>
        <Text style={styles.summaryLine}>Attempt ID: #{result.attempt_id}</Text>
      </AppCard>

      <AppCard title="AI insight" delay={90}>
        <Text style={styles.summaryText}>{result.insight}</Text>
      </AppCard>

      <AppCard title="Weak topics" delay={120}>
        {result.weak_topics.length > 0 ? (
          result.weak_topics.map((topic) => (
            <Text key={topic} style={styles.summaryLine}>• {topic}</Text>
          ))
        ) : (
          <Text style={styles.summaryText}>No critical weak topics detected in this attempt.</Text>
        )}
      </AppCard>

      <AppCard title="Recommendations" delay={150}>
        {result.recommendations.length > 0 ? (
          result.recommendations.map((recommendation) => (
            <Text key={recommendation} style={styles.summaryLine}>• {recommendation}</Text>
          ))
        ) : (
          <Text style={styles.summaryText}>Keep regular mixed practice to maintain your current level.</Text>
        )}
        <PrimaryButton title="Back to dashboard" onPress={() => navigation.navigate("RoleTabs")} />
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
  summaryLine: {
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: "600",
  },
  summaryText: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
  },
});

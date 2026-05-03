import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchAttemptResult } from "../api/testingApi";
import { AppCard } from "../components/AppCard";
import { PrimaryButton } from "../components/PrimaryButton";
import { ProgressBar } from "../components/ProgressBar";
import { SkeletonBlock } from "../components/SkeletonBlock";
import { StatBox } from "../components/StatBox";
import { RootStackParamList } from "../navigation/types";
import { useAuthStore } from "../store/authStore";
import { AttemptResultResponse, ErrorProfileItem, RecommendationCardItem } from "../types/testing";
import { colors } from "../theme/colors";

type ResultRoute = RouteProp<RootStackParamList, "TestResult">;
type Navigation = NativeStackNavigationProp<RootStackParamList>;
type ErrorProfileDisplayItem = ErrorProfileItem & {
  label: string;
};

type LevelBand = {
  cefr: string;
  label: string;
  nextLevel: string;
  tone: "default" | "success" | "warning";
};

function getLevelBand(scorePercent: number): LevelBand {
  if (scorePercent < 40) {
    return {
      cefr: "A1",
      label: "Beginner foundation",
      nextLevel: "A2 Elementary",
      tone: "warning",
    };
  }
  if (scorePercent < 55) {
    return {
      cefr: "A2",
      label: "Elementary control",
      nextLevel: "B1 Pre-Intermediate",
      tone: "warning",
    };
  }
  if (scorePercent < 75) {
    return {
      cefr: "B1",
      label: "Independent basics",
      nextLevel: "B2 Upper-Intermediate",
      tone: "default",
    };
  }
  if (scorePercent < 90) {
    return {
      cefr: "B2",
      label: "Confident communicator",
      nextLevel: "C1 Advanced",
      tone: "success",
    };
  }
  return {
    cefr: "C1",
    label: "Advanced range",
    nextLevel: "C1+ fluency",
    tone: "success",
  };
}

const defaultErrorProfile: ErrorProfileDisplayItem[] = [
  { topic: "grammar", label: "Grammar", total_questions: 0, wrong_answers: 0, accuracy_percent: 0 },
  { topic: "vocabulary", label: "Vocabulary", total_questions: 0, wrong_answers: 0, accuracy_percent: 0 },
  { topic: "reading", label: "Reading", total_questions: 0, wrong_answers: 0, accuracy_percent: 0 },
  { topic: "listening", label: "Listening", total_questions: 0, wrong_answers: 0, accuracy_percent: 0 },
];

function formatTopic(topic: string) {
  return topic
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatTestType(testType: string) {
  if (testType === "final") {
    return "Final";
  }
  if (testType === "adaptive") {
    return "Adaptive";
  }
  return "Diagnostic";
}

function formatDelta(value: number | null, suffix = "") {
  if (value === null) {
    return "No previous attempt";
  }
  const rounded = suffix === "%" ? Math.round(value) : Number(value.toFixed(2));
  return `${value > 0 ? "+" : ""}${rounded}${suffix}`;
}

function buildErrorProfile(errorProfile?: ErrorProfileItem[]): ErrorProfileDisplayItem[] {
  if (!errorProfile || errorProfile.length === 0) {
    return defaultErrorProfile;
  }

  const itemsByTopic = new Map(
    errorProfile.map((item) => [
      item.topic,
      {
        ...item,
        label: formatTopic(item.topic),
      },
    ]),
  );

  const displayItems = defaultErrorProfile.map((item) => itemsByTopic.get(item.topic) ?? item);
  const defaultTopics = new Set(defaultErrorProfile.map((item) => item.topic));
  const extraItems = errorProfile
    .filter((item) => !defaultTopics.has(item.topic))
    .map((item) => ({ ...item, label: formatTopic(item.topic) }));

  return [...displayItems, ...extraItems];
}

function findWeakestArea(errorProfile: ErrorProfileDisplayItem[]) {
  return errorProfile.reduce((weakest, item) => {
    if (item.wrong_answers > weakest.wrong_answers) {
      return item;
    }
    if (item.wrong_answers === weakest.wrong_answers && item.accuracy_percent < weakest.accuracy_percent) {
      return item;
    }
    return weakest;
  }, errorProfile[0]);
}

function buildRecommendationCards(result: AttemptResultResponse): RecommendationCardItem[] {
  if (result.recommendation_cards && result.recommendation_cards.length > 0) {
    return result.recommendation_cards;
  }

  if (result.recommendations.length === 0) {
    return [
      {
        category: "mixed_practice",
        priority: "Low",
        estimated_time: "10 min",
        reason: "No critical weak topic was detected in this attempt.",
        suggested_activity: "Keep regular mixed practice to maintain your current level.",
      },
    ];
  }

  return result.recommendations.map((recommendation, index) => {
    const category = result.weak_topics[index] ?? "mixed_practice";
    return {
      category,
      priority: index === 0 ? "High" : "Medium",
      estimated_time: index === 0 ? "25 min" : "15 min",
      reason: `Rule-based analysis selected ${formatTopic(category)} from the current weak-topic profile.`,
      suggested_activity: recommendation,
    };
  });
}

function getPriorityStyle(priority: string) {
  if (priority.toLowerCase() === "high") {
    return styles.priorityHigh;
  }
  if (priority.toLowerCase() === "medium") {
    return styles.priorityMedium;
  }
  return styles.priorityLow;
}

function buildRecommendationExplanation(result: AttemptResultResponse, recommendation: RecommendationCardItem) {
  const topicLabel = formatTopic(recommendation.category);
  const profileItem = result.error_profile?.find((item) => item.topic === recommendation.category);

  if (profileItem && profileItem.total_questions > 0) {
    return (
      `Because you made ${profileItem.wrong_answers} mistake(s) in ${topicLabel} ` +
      `with ${Math.round(profileItem.accuracy_percent)}% accuracy, the system recommends: ` +
      recommendation.suggested_activity
    );
  }

  if (result.weak_topics.includes(recommendation.category)) {
    return (
      `Because ${topicLabel} appears in your weak topics, the system selected an activity that targets this skill: ` +
      recommendation.suggested_activity
    );
  }

  return (
    "Because no critical topic gap was detected, the system recommends a short maintenance activity: " +
    recommendation.suggested_activity
  );
}

export function TestResultScreen() {
  const route = useRoute<ResultRoute>();
  const navigation = useNavigation<Navigation>();
  const token = useAuthStore((state) => state.token);

  const [result, setResult] = useState<AttemptResultResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRecommendations, setExpandedRecommendations] = useState<Record<string, boolean>>({});

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

  const scorePercent = Math.round(result.score_percent);
  const levelBand = getLevelBand(result.score_percent);
  const resultCefr = result.cefr || levelBand.cefr;
  const testTypeLabel = formatTestType(result.test_type);
  const isFinalResult = result.test_type === "final";
  const errorProfile = buildErrorProfile(result.error_profile);
  const weakestArea = findWeakestArea(errorProfile);
  const recommendationCards = buildRecommendationCards(result);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Test result | {testTypeLabel}</Text>
        <Text style={styles.title}>{resultCefr} | {result.level_result}</Text>
        <Text style={styles.subtitle}>
          {isFinalResult
            ? "Final certification result with score, CEFR, theta, and comparison to previous attempts."
            : "Your attempt has been converted into a clear placement summary for the next practice step."}
        </Text>
      </View>

      {isFinalResult ? (
        <AppCard title="Final certification result" subtitle="Итоговый контроль уровня знаний" delay={20}>
          <View style={styles.finalCefrBox}>
            <Text style={styles.finalCefrLabel}>CEFR level</Text>
            <Text style={styles.finalCefrValue}>{resultCefr}</Text>
            <Text style={styles.finalCefrMeta}>{result.level_result}</Text>
          </View>
        </AppCard>
      ) : null}

      <AppCard title="Score summary" subtitle={`${levelBand.label} | Test Type: ${testTypeLabel}`} delay={30}>
        <View style={[styles.scoreCard, levelBand.tone === "success" && styles.scoreCardSuccess]}>
          <View style={styles.scoreMain}>
            <Text style={styles.scoreLabel}>Final score</Text>
            <Text style={styles.scoreValue}>{scorePercent}%</Text>
          </View>
          <View style={styles.cefrBadge}>
            <Text style={styles.cefrLabel}>CEFR-like</Text>
            <Text style={styles.cefrValue}>{resultCefr}</Text>
          </View>
        </View>
        <View style={styles.nextLevelBox}>
          <Text style={styles.nextLevelLabel}>Next recommended level</Text>
          <Text style={styles.nextLevelValue}>{levelBand.nextLevel}</Text>
        </View>
      </AppCard>

      <View style={styles.statRow}>
        <StatBox label="Theta final" value={result.theta_final.toFixed(2)} />
        <StatBox label="Correct" value={`${result.correct_answers}/${result.total_questions}`} tone="success" />
      </View>

      <AppCard title="Previous attempt comparison" delay={50}>
        <View style={styles.statRow}>
          <StatBox label="Score delta" value={formatDelta(result.score_delta, "%")} tone={result.score_delta && result.score_delta > 0 ? "success" : "default"} />
          <StatBox label="Theta delta" value={formatDelta(result.theta_delta)} tone={result.theta_delta && result.theta_delta > 0 ? "success" : "default"} />
        </View>
        {result.previous_score_percent !== null ? (
          <Text style={styles.summaryLine}>
            Previous result: {Math.round(result.previous_score_percent)}% | theta {result.previous_theta_final?.toFixed(2) ?? "-"}
          </Text>
        ) : (
          <Text style={styles.summaryText}>This is the first saved attempt, so comparison will appear after one more completed test.</Text>
        )}
      </AppCard>

      <AppCard title="Summary" delay={60}>
        <Text style={styles.summaryLine}>Test Type: {testTypeLabel}</Text>
        <Text style={styles.summaryLine}>Mapped level: {resultCefr} - {levelBand.label}</Text>
        <Text style={styles.summaryLine}>Started: {new Date(result.started_at).toLocaleString()}</Text>
        <Text style={styles.summaryLine}>Finished: {new Date(result.finished_at).toLocaleString()}</Text>
        <Text style={styles.summaryLine}>Attempt ID: #{result.attempt_id}</Text>
      </AppCard>

      <AppCard title="AI insight" delay={90}>
        <Text style={styles.summaryText}>{result.insight}</Text>
      </AppCard>

      <AppCard
        title="Typical error profile"
        subtitle={`Weakest area: ${weakestArea.label}`}
        delay={105}
      >
        <View style={styles.profileList}>
          {errorProfile.map((item) => (
            <View key={item.topic} style={styles.profileItem}>
              <ProgressBar label={item.label} value={Math.round(item.accuracy_percent)} />
              <Text style={styles.profileMeta}>
                {item.wrong_answers} wrong of {item.total_questions} questions
              </Text>
            </View>
          ))}
        </View>
      </AppCard>

      <AppCard title="Weak topics" delay={120}>
        {result.weak_topics.length > 0 ? (
          result.weak_topics.map((topic) => (
            <Text key={topic} style={styles.summaryLine}>- {topic}</Text>
          ))
        ) : (
          <Text style={styles.summaryText}>No critical weak topics detected in this attempt.</Text>
        )}
      </AppCard>

      <AppCard
        title="AI Recommendations"
        subtitle="Personalized next steps generated from the error profile."
        delay={150}
      >
        <Text style={styles.defenseLine}>
          Based on the error profile, the system forms personalized recommendations for further learning.
        </Text>
        <View style={styles.recommendationList}>
          {recommendationCards.map((recommendation, index) => {
            const recommendationKey = `${recommendation.category}-${index}`;
            const isExpanded = Boolean(expandedRecommendations[recommendationKey]);

            return (
              <View key={recommendationKey} style={styles.recommendationItem}>
                <View style={styles.recommendationHeader}>
                  <Text style={styles.recommendationCategory}>{formatTopic(recommendation.category)}</Text>
                  <View style={styles.badgeRow}>
                    <View style={styles.sourceBadge}>
                      <Text style={styles.sourceText}>{recommendation.source ?? "Rule-based"}</Text>
                    </View>
                    <View style={[styles.priorityBadge, getPriorityStyle(recommendation.priority)]}>
                      <Text style={styles.priorityText}>{recommendation.priority}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.recommendationReason}>{recommendation.reason}</Text>
                <View style={styles.activityRow}>
                  <View style={styles.activityBlock}>
                    <Text style={styles.activityLabel}>Suggested activity</Text>
                    <Text style={styles.activityText}>{recommendation.suggested_activity}</Text>
                  </View>
                  <View style={styles.timePill}>
                    <Text style={styles.timeLabel}>Time</Text>
                    <Text style={styles.timeValue}>{recommendation.estimated_time}</Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setExpandedRecommendations((current) => ({
                      ...current,
                      [recommendationKey]: !isExpanded,
                    }))
                  }
                  style={styles.whyButton}
                >
                  <Text style={styles.whyButtonText}>
                    {isExpanded ? "Hide explanation" : "Why this recommendation?"}
                  </Text>
                </Pressable>
                {isExpanded ? (
                  <View style={styles.explanationBox}>
                    <Text style={styles.explanationTitle}>Explanation</Text>
                    <Text style={styles.explanationText}>
                      {buildRecommendationExplanation(result, recommendation)}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
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
  finalCefrBox: {
    alignItems: "center",
    backgroundColor: "#0F2F24",
    borderColor: "#2B7A5B",
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 20,
  },
  finalCefrLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  finalCefrValue: {
    color: "#FFFFFF",
    fontSize: 64,
    fontWeight: "900",
  },
  finalCefrMeta: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 16,
    fontWeight: "800",
  },
  scoreCard: {
    alignItems: "center",
    backgroundColor: colors.dark,
    borderRadius: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
    padding: 18,
  },
  scoreMain: {
    flex: 1,
    minWidth: 128,
  },
  scoreCardSuccess: {
    backgroundColor: "#083B2A",
  },
  scoreLabel: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  scoreValue: {
    color: "#FFFFFF",
    fontSize: 54,
    fontWeight: "900",
  },
  cefrBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 86,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cefrLabel: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  cefrValue: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
  },
  nextLevelBox: {
    backgroundColor: "#F7F9FF",
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  nextLevelLabel: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  nextLevelValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  profileList: {
    gap: 12,
  },
  profileItem: {
    backgroundColor: "#F7F9FF",
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    padding: 12,
  },
  profileMeta: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
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
  defenseLine: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  recommendationList: {
    gap: 14,
  },
  recommendationItem: {
    borderColor: colors.border,
    borderLeftColor: colors.primary,
    borderLeftWidth: 4,
    borderTopWidth: 1,
    gap: 10,
    paddingTop: 12,
    paddingLeft: 12,
  },
  recommendationHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
  },
  recommendationCategory: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    minWidth: 140,
  },
  priorityBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  sourceBadge: {
    backgroundColor: "#EEF2FF",
    borderColor: "#DDE5FF",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sourceText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  priorityHigh: {
    backgroundColor: "#FDECEC",
  },
  priorityMedium: {
    backgroundColor: "#FFF4D8",
  },
  priorityLow: {
    backgroundColor: "#EAF8EF",
  },
  priorityText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  recommendationReason: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
  activityRow: {
    alignItems: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  activityBlock: {
    flex: 1,
    gap: 4,
    minWidth: 180,
  },
  activityLabel: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  activityText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  timePill: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#F7F9FF",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 78,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  timeLabel: {
    color: colors.mutedText,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  timeValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  whyButton: {
    alignSelf: "flex-start",
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  whyButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  explanationBox: {
    backgroundColor: "#F7F9FF",
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    padding: 12,
  },
  explanationTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  explanationText: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
});

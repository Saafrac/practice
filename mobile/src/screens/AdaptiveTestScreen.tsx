import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchNextQuestion, startAdaptive, submitAnswer } from "../api/testingApi";
import { AppCard } from "../components/AppCard";
import { EmptyState } from "../components/EmptyState";
import { PrimaryButton } from "../components/PrimaryButton";
import { ProgressBar } from "../components/ProgressBar";
import { StatBox } from "../components/StatBox";
import { RootStackParamList } from "../navigation/types";
import { useAuthStore } from "../store/authStore";
import { NextQuestionResponse, SubmitAnswerResponse, TestQuestion } from "../types/testing";
import { colors } from "../theme/colors";

type Navigation = NativeStackNavigationProp<RootStackParamList>;
type ThetaTimelineItem = Pick<SubmitAnswerResponse, "is_correct" | "theta_before" | "theta_after"> & {
  id: number;
  difficulty: number;
};

function formatTheta(value: number) {
  return value.toFixed(2);
}

export function AdaptiveTestScreen() {
  const navigation = useNavigation<Navigation>();
  const token = useAuthStore((state) => state.token);

  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [maxQuestions, setMaxQuestions] = useState(12);
  const [question, setQuestion] = useState<TestQuestion | null>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState(0);
  const [currentTheta, setCurrentTheta] = useState(0);
  const [thetaTimeline, setThetaTimeline] = useState<ThetaTimelineItem[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progressValue = useMemo(() => {
    if (maxQuestions <= 0) {
      return 0;
    }
    return Math.round((answeredQuestions / maxQuestions) * 100);
  }, [answeredQuestions, maxQuestions]);

  const currentDifficulty = question?.difficulty;
  const visibleTimeline = thetaTimeline.slice(-4).reverse();

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      if (!token) {
        if (isMounted) {
          setError("Authentication token is missing. Please sign in again.");
          setIsBootLoading(false);
        }
        return;
      }

      try {
        const started = await startAdaptive(token);
        if (!isMounted) {
          return;
        }
        setAttemptId(started.attempt_id);
        setMaxQuestions(started.max_questions);

        const next = await fetchNextQuestion(token, started.attempt_id);
        if (!isMounted) {
          return;
        }
        applyNextQuestion(next);
      } catch (requestError) {
        if (!isMounted) {
          return;
        }
        setError(requestError instanceof Error ? requestError.message : "Failed to start adaptive test.");
      } finally {
        if (isMounted) {
          setIsBootLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const applyNextQuestion = (next: NextQuestionResponse) => {
    setAnsweredQuestions(next.answered_questions);
    setMaxQuestions(next.max_questions);
    setCurrentTheta(next.current_theta);
    setSelectedOptionId(null);

    if (next.is_finished || !next.question) {
      navigation.replace("TestResult", { attemptId: next.attempt_id });
      return;
    }

    setQuestion(next.question);
  };

  const onSubmitAnswer = async () => {
    if (!token || !attemptId || !question || !selectedOptionId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await submitAnswer(token, attemptId, {
        question_id: question.id,
        selected_option_id: selectedOptionId,
      });

      setAnsweredQuestions(result.answered_questions);
      setCurrentTheta(result.theta_after);
      setThetaTimeline((items) => [
        ...items,
        {
          id: result.answered_questions,
          is_correct: result.is_correct,
          theta_before: result.theta_before,
          theta_after: result.theta_after,
          difficulty: question.difficulty,
        },
      ]);

      if (result.is_finished) {
        navigation.replace("TestResult", { attemptId });
        return;
      }

      const next = await fetchNextQuestion(token, attemptId);
      applyNextQuestion(next);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not submit answer.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isBootLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Preparing adaptive test...</Text>
      </View>
    );
  }

  if (error && !question) {
    return (
      <View style={styles.container}>
        <AppCard title="Adaptive test unavailable" subtitle={error}>
          <PrimaryButton title="Back to dashboard" onPress={() => navigation.goBack()} />
        </AppCard>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Adaptive test</Text>
        <Text style={styles.title}>Question difficulty follows your theta</Text>
        <Text style={styles.subtitle}>Correct answers on hard items increase theta faster; errors on easy items decrease it more.</Text>
      </View>

      <AppCard title="Progress" subtitle={`${answeredQuestions}/${maxQuestions} completed | theta ${currentTheta.toFixed(2)}`}>
        <ProgressBar label="Completion" value={progressValue} />
      </AppCard>

      <AppCard
        title="Adaptive visualization"
        subtitle="Theta moves after every answer; the next item is selected near the updated estimate."
      >
        <View style={styles.statsRow}>
          <StatBox label="Current theta" value={formatTheta(currentTheta)} />
          <StatBox
            label="Question b"
            value={currentDifficulty === undefined ? "-" : `${currentDifficulty}`}
            tone="warning"
          />
        </View>

        <View style={styles.timeline}>
          <View style={styles.timelineHeader}>
            <Text style={styles.timelineTitle}>Last answers</Text>
            <Text style={styles.timelineMeta}>{thetaTimeline.length}/{maxQuestions}</Text>
          </View>

          {visibleTimeline.length > 0 ? (
            visibleTimeline.map((item) => (
              <View key={item.id} style={styles.timelineItem}>
                <View
                  style={[
                    styles.timelineDot,
                    item.is_correct ? styles.timelineDotCorrect : styles.timelineDotIncorrect,
                  ]}
                />
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineLabel}>
                    Q{item.id} | b {item.difficulty} | {item.is_correct ? "correct" : "incorrect"}
                  </Text>
                  <Text style={styles.timelineTheta}>
                    {formatTheta(item.theta_before)}
                    {" -> "}
                    {formatTheta(item.theta_after)}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.timelineEmpty}>
              <Text style={styles.timelineEmptyText}>Answer the first question to start the theta trace.</Text>
            </View>
          )}
        </View>
      </AppCard>

      {question ? (
        <AppCard title={question.text} subtitle={`Topic: ${question.topic} | Difficulty: ${question.difficulty}`}>
          <View style={styles.optionsWrap}>
            {question.options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              return (
                <Pressable
                  key={option.id}
                  disabled={isSubmitting}
                  onPress={() => setSelectedOptionId(option.id)}
                  style={[styles.option, isSelected && styles.optionSelected, isSubmitting && styles.optionDisabled]}
                >
                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option.text}</Text>
                </Pressable>
              );
            })}
          </View>

          <PrimaryButton
            title={isSubmitting ? "Submitting..." : "Next"}
            onPress={() => void onSubmitAnswer()}
            disabled={isSubmitting || selectedOptionId === null}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </AppCard>
      ) : (
        <AppCard title="Question loading">
          <EmptyState
            title="Loading next adaptive question"
            description="Please wait while the engine chooses the closest difficulty."
            icon="hourglass-outline"
          />
        </AppCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 24,
    gap: 10,
  },
  loadingText: {
    color: colors.mutedText,
    fontSize: 14,
    fontWeight: "600",
  },
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
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  timeline: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F7F9FF",
    padding: 12,
    gap: 10,
  },
  timelineHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  timelineTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  timelineMeta: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "800",
  },
  timelineItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  timelineDot: {
    borderRadius: 999,
    height: 12,
    width: 12,
  },
  timelineDotCorrect: {
    backgroundColor: colors.success,
  },
  timelineDotIncorrect: {
    backgroundColor: colors.danger,
  },
  timelineBody: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6EBFF",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  timelineLabel: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  timelineTheta: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  timelineEmpty: {
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6EBFF",
    padding: 10,
  },
  timelineEmptyText: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  optionsWrap: {
    gap: 10,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFF",
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: "#EEF1FF",
  },
  optionDisabled: {
    opacity: 0.7,
  },
  optionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  optionTextSelected: {
    color: colors.primary,
  },
  error: {
    color: "#E53935",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
});

import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchNextQuestion, startFinal, submitAnswer } from "../api/testingApi";
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
type AnswerFeedback = Pick<SubmitAnswerResponse, "is_correct">;

function formatTopic(topic: string) {
  return topic
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function FinalTestScreen() {
  const navigation = useNavigation<Navigation>();
  const token = useAuthStore((state) => state.token);

  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [maxQuestions, setMaxQuestions] = useState(10);
  const [question, setQuestion] = useState<TestQuestion | null>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState(0);
  const [answerFeedback, setAnswerFeedback] = useState<AnswerFeedback | null>(null);
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

  const remainingQuestions = Math.max(maxQuestions - answeredQuestions, 0);

  useEffect(() => {
    if (!answerFeedback) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setAnswerFeedback(null);
    }, 2400);

    return () => clearTimeout(timeoutId);
  }, [answerFeedback]);

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
        const started = await startFinal(token);
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
        setError(requestError instanceof Error ? requestError.message : "Failed to start final test.");
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
      setAnswerFeedback({ is_correct: result.is_correct });

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
        <Text style={styles.loadingText}>Preparing final assessment...</Text>
      </View>
    );
  }

  if (error && !question) {
    return (
      <View style={styles.container}>
        <AppCard title="Final test unavailable" subtitle={error}>
          <PrimaryButton title="Back to dashboard" onPress={() => navigation.goBack()} />
        </AppCard>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Final control</Text>
        <Text style={styles.title}>Final English assessment</Text>
        <Text style={styles.subtitle}>
          A fixed certification-style test that calculates score, CEFR, theta, and weak topics.
        </Text>
      </View>

      <AppCard
        title="Final assessment mode"
        subtitle="Questions are selected once for this attempt and do not adapt after each answer."
      >
        <View style={styles.purposeRow}>
          <Text style={styles.purposeText}>Goal</Text>
          <Text style={styles.purposeValue}>Final level check and certification result</Text>
        </View>
      </AppCard>

      <AppCard title="Progress" subtitle={`${answeredQuestions}/${maxQuestions} completed`}>
        <ProgressBar label="Completion" value={progressValue} />
        <View style={styles.statsRow}>
          <StatBox label="Mode" value="Final" />
          <StatBox label="Remaining" value={`${remainingQuestions}`} tone="warning" />
        </View>
      </AppCard>

      {answerFeedback ? (
        <View style={[styles.feedback, answerFeedback.is_correct ? styles.feedbackCorrect : styles.feedbackIncorrect]}>
          <Text
            style={[
              styles.feedbackStatus,
              answerFeedback.is_correct ? styles.feedbackStatusCorrect : styles.feedbackStatusIncorrect,
            ]}
          >
            {answerFeedback.is_correct ? "Correct" : "Incorrect"}
          </Text>
          <Text style={styles.feedbackText}>Answer saved for final scoring</Text>
        </View>
      ) : null}

      {question ? (
        <AppCard title={question.text} subtitle="Choose the best answer. Scoring happens at the end of the test.">
          <View style={styles.questionMeta}>
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>Topic</Text>
              <Text style={styles.badgeValue}>{formatTopic(question.topic)}</Text>
            </View>
            <View style={[styles.badge, styles.badgeDifficulty]}>
              <Text style={styles.badgeLabel}>Difficulty b</Text>
              <Text style={styles.badgeValue}>{question.difficulty}</Text>
            </View>
          </View>

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
            title="Loading next final question"
            description="Please wait a second while we sync with the server."
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
  purposeRow: {
    borderRadius: 14,
    backgroundColor: "#F7F9FF",
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  purposeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  purposeValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  feedback: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  feedbackCorrect: {
    backgroundColor: "#ECFDF3",
    borderColor: "#B7EACB",
  },
  feedbackIncorrect: {
    backgroundColor: "#FEF3F2",
    borderColor: "#FECDCA",
  },
  feedbackStatus: {
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  feedbackStatusCorrect: {
    color: colors.success,
  },
  feedbackStatusIncorrect: {
    color: colors.danger,
  },
  feedbackText: {
    color: colors.text,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
  },
  questionMeta: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  badge: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BFD0FF",
    backgroundColor: "#EEF4FF",
    paddingHorizontal: 12,
    paddingVertical: 9,
    minWidth: 118,
  },
  badgeDifficulty: {
    backgroundColor: "#FFF7EA",
    borderColor: "#FCD9A6",
  },
  badgeLabel: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  badgeValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
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

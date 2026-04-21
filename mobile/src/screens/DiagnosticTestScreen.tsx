import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchNextQuestion, startDiagnostic, submitAnswer } from "../api/testingApi";
import { AppCard } from "../components/AppCard";
import { EmptyState } from "../components/EmptyState";
import { PrimaryButton } from "../components/PrimaryButton";
import { ProgressBar } from "../components/ProgressBar";
import { RootStackParamList } from "../navigation/types";
import { useAuthStore } from "../store/authStore";
import { NextQuestionResponse, TestQuestion } from "../types/testing";
import { colors } from "../theme/colors";

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function DiagnosticTestScreen() {
  const navigation = useNavigation<Navigation>();
  const token = useAuthStore((state) => state.token);

  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [maxQuestions, setMaxQuestions] = useState(12);
  const [question, setQuestion] = useState<TestQuestion | null>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState(0);
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
        const started = await startDiagnostic(token);
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
        setError(requestError instanceof Error ? requestError.message : "Failed to start test.");
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
        <Text style={styles.loadingText}>Preparing diagnostic test...</Text>
      </View>
    );
  }

  if (error && !question) {
    return (
      <View style={styles.container}>
        <AppCard title="Diagnostic test unavailable" subtitle={error}>
          <PrimaryButton title="Back to dashboard" onPress={() => navigation.goBack()} />
        </AppCard>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Diagnostic test</Text>
        <Text style={styles.title}>Find your starting level</Text>
        <Text style={styles.subtitle}>Answer one question at a time. Difficulty will be adapted in next stage.</Text>
      </View>

      <AppCard title="Progress" subtitle={`${answeredQuestions}/${maxQuestions} completed`}>
        <ProgressBar label="Completion" value={progressValue} />
      </AppCard>

      {question ? (
        <AppCard title={question.text} subtitle={`Topic: ${question.topic} | Difficulty: ${question.difficulty}`}>
          <View style={styles.optionsWrap}>
            {question.options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setSelectedOptionId(option.id)}
                  style={[styles.option, isSelected && styles.optionSelected]}
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
            title="Loading next question"
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


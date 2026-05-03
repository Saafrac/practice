import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import {
  createAdminQuestion,
  deleteAdminQuestion,
  fetchAdminQuestions,
  fetchAdminUsers,
  updateAdminQuestion,
  updateAdminUserRole,
} from "../api/adminApi";
import { AppCard } from "../components/AppCard";
import { EmptyState } from "../components/EmptyState";
import { PrimaryButton } from "../components/PrimaryButton";
import { SkeletonBlock } from "../components/SkeletonBlock";
import { StatBox } from "../components/StatBox";
import { useAuthStore } from "../store/authStore";
import { AdminQuestionItem, AdminRole, AdminUserItem } from "../types/admin";
import { colors } from "../theme/colors";

const roleCycle: AdminRole[] = ["student", "teacher", "admin"];

const difficultyBands = [
  { value: -2, label: "A1", shortLabel: "A1", description: "b=-2" },
  { value: -1, label: "A2", shortLabel: "A2", description: "b=-1" },
  { value: 0, label: "B1", shortLabel: "B1", description: "b=0" },
  { value: 1, label: "B2", shortLabel: "B2", description: "b=1" },
  { value: 2, label: "C1", shortLabel: "C1", description: "b=2" },
] as const;

type QuestionFormState = {
  text: string;
  topic: string;
  difficulty: string;
  explanation: string;
  optionsText: string;
  correctIndex: string;
};

const defaultForm: QuestionFormState = {
  text: "",
  topic: "grammar",
  difficulty: "0",
  explanation: "",
  optionsText: "",
  correctIndex: "0",
};

function nextRole(role: AdminRole): AdminRole {
  const idx = roleCycle.indexOf(role);
  return roleCycle[(idx + 1) % roleCycle.length];
}

function difficultyLabel(difficulty: number) {
  const band = difficultyBands.find((item) => item.value === difficulty);
  return band ? `${band.label} (${band.description})` : `b=${difficulty}`;
}

function normalizeTopic(topic: string) {
  return topic.trim().toLowerCase();
}

function questionToForm(question: AdminQuestionItem): QuestionFormState {
  const correctIndex = Math.max(0, question.options.findIndex((option) => option.is_correct));
  return {
    text: question.text,
    topic: question.topic,
    difficulty: String(question.difficulty),
    explanation: question.explanation ?? "",
    optionsText: question.options.map((item) => item.text).join("\n"),
    correctIndex: String(correctIndex),
  };
}

export function AdminDashboardScreen() {
  const token = useAuthStore((state) => state.token);

  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [questions, setQuestions] = useState<AdminQuestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [topicFilter, setTopicFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");

  const [editQuestionId, setEditQuestionId] = useState<number | null>(null);
  const [form, setForm] = useState<QuestionFormState>(defaultForm);

  const usersCount = users.length;
  const questionsCount = questions.length;

  const topicChips = useMemo(() => {
    const topics = Array.from(new Set(questions.map((question) => normalizeTopic(question.topic)).filter(Boolean)));
    return topics.sort((a, b) => a.localeCompare(b));
  }, [questions]);

  const difficultyCounts = useMemo(
    () =>
      difficultyBands.map((band) => ({
        ...band,
        count: questions.filter((question) => question.difficulty === band.value).length,
      })),
    [questions],
  );

  const parsedDifficultyFilter = useMemo(() => {
    if (!difficultyFilter.trim()) {
      return undefined;
    }
    const numeric = Number(difficultyFilter);
    if (!Number.isInteger(numeric) || numeric < -2 || numeric > 2) {
      return undefined;
    }
    return numeric;
  }, [difficultyFilter]);

  const loadAdminData = async () => {
    if (!token) {
      setError("Authentication token is missing. Please sign in again.");
      setIsLoading(false);
      return;
    }

    setError(null);
    try {
      const [usersResponse, questionsResponse] = await Promise.all([
        fetchAdminUsers(token),
        fetchAdminQuestions(token),
      ]);
      setUsers(usersResponse.users);
      setQuestions(questionsResponse.questions);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load admin data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadAdminData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const onApplyFilters = async () => {
    await loadAdminData();
  };

  const visibleQuestions = useMemo(() => {
    const normalizedTopicFilter = normalizeTopic(topicFilter);
    return questions.filter((question) => {
      const matchesTopic = normalizedTopicFilter
        ? normalizeTopic(question.topic).includes(normalizedTopicFilter)
        : true;
      const matchesDifficulty =
        typeof parsedDifficultyFilter === "number" ? question.difficulty === parsedDifficultyFilter : true;
      return matchesTopic && matchesDifficulty;
    });
  }, [parsedDifficultyFilter, questions, topicFilter]);

  const onRotateRole = async (user: AdminUserItem) => {
    if (!token) {
      return;
    }
    const role = nextRole(user.role);
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateAdminUserRole(token, user.id, role);
      setUsers((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update role.");
    } finally {
      setIsSaving(false);
    }
  };

  const onEditQuestion = (question: AdminQuestionItem) => {
    setEditQuestionId(question.id);
    setForm(questionToForm(question));
  };

  const onCancelEdit = () => {
    setEditQuestionId(null);
    setForm(defaultForm);
  };

  const onDeleteQuestion = async (questionId: number) => {
    if (!token) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await deleteAdminQuestion(token, questionId);
      setQuestions((prev) => prev.filter((item) => item.id !== questionId));
      if (editQuestionId === questionId) {
        onCancelEdit();
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to delete question.");
    } finally {
      setIsSaving(false);
    }
  };

  const onSaveQuestion = async () => {
    if (!token) {
      return;
    }

    const options = form.optionsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const difficulty = Number(form.difficulty);
    const correctIndex = Number(form.correctIndex);

    if (!form.text.trim() || !form.topic.trim()) {
      setError("Question text and topic are required.");
      return;
    }
    if (!Number.isInteger(difficulty) || difficulty < -2 || difficulty > 2) {
      setError("Difficulty must be an integer between -2 and 2.");
      return;
    }
    if (options.length < 2) {
      setError("Provide at least 2 options (one per line).");
      return;
    }
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      setError("Correct option index is out of range.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const payload = {
        text: form.text.trim(),
        topic: form.topic.trim().toLowerCase(),
        difficulty,
        explanation: form.explanation.trim() ? form.explanation.trim() : null,
        options,
        correct_index: correctIndex,
      };

      if (editQuestionId) {
        const updated = await updateAdminQuestion(token, editQuestionId, payload);
        setQuestions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await createAdminQuestion(token, payload);
        setQuestions((prev) => [created, ...prev]);
      }

      onCancelEdit();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save question.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <SkeletonBlock width="30%" height={12} />
          <SkeletonBlock width="58%" height={30} />
          <SkeletonBlock width="82%" height={14} />
        </View>
        <AppCard title="Loading users" animated={false}>
          <SkeletonBlock height={52} />
          <SkeletonBlock height={52} />
          <SkeletonBlock height={52} />
        </AppCard>
        <AppCard title="Loading questions" animated={false}>
          <SkeletonBlock height={42} />
          <SkeletonBlock height={42} />
          <SkeletonBlock height={42} />
        </AppCard>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.kicker}>Admin panel</Text>
        <Text style={styles.title}>System control center</Text>
        <Text style={styles.subtitle}>Manage users, roles, and question bank state.</Text>
      </View>

      <View style={styles.statRow}>
        <StatBox label="Users" value={`${usersCount}`} />
        <StatBox label="Questions" value={`${questionsCount}`} />
      </View>

      <View style={styles.statRow}>
        <StatBox label="Visible" value={`${visibleQuestions.length}`} />
        <StatBox label="Topics" value={`${topicChips.length}`} tone="success" />
      </View>

      {error ? (
        <AppCard title="Action failed" subtitle={error}>
          <PrimaryButton
            title="Retry load"
            onPress={() => {
              setIsLoading(true);
              void loadAdminData();
            }}
          />
        </AppCard>
      ) : null}

      <AppCard title="User role management" subtitle="Tap rotate to switch role: student -> teacher -> admin" delay={70}>
        {users.length > 0 ? (
          <View style={styles.listWrap}>
            {users.map((user) => (
              <View key={user.id} style={styles.rowCard}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{user.full_name}</Text>
                  <Text style={styles.rowMeta}>{user.email}</Text>
                  <Text style={styles.rowMeta}>Role: {user.role}</Text>
                </View>
                <Pressable
                  style={[styles.actionButton, isSaving && styles.actionButtonDisabled]}
                  onPress={() => void onRotateRole(user)}
                  disabled={isSaving}
                >
                  <Text style={styles.actionButtonText}>Rotate role</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            title="No users found"
            description="Create users through registration or seed scripts."
            icon="people-outline"
          />
        )}
      </AppCard>

      <AppCard title="Difficulty b overview" subtitle="Question count by CEFR-like difficulty band" delay={100}>
        <View style={styles.difficultyGrid}>
          {difficultyCounts.map((band) => (
            <View key={band.value} style={styles.difficultyCountCard}>
              <Text style={styles.difficultyCountLabel}>{band.shortLabel}</Text>
              <Text style={styles.difficultyCountValue}>{band.count}</Text>
              <Text style={styles.difficultyCountMeta}>{band.description}</Text>
            </View>
          ))}
        </View>
      </AppCard>

      <AppCard title="Question filters" subtitle="Use shortcuts for defense, or type a custom topic" delay={110}>
        <View style={styles.filterSection}>
          <Text style={styles.formLabel}>Topic shortcuts</Text>
          <View style={styles.chipWrap}>
            <Pressable
              style={[styles.filterChip, !topicFilter.trim() && styles.filterChipActive]}
              onPress={() => setTopicFilter("")}
            >
              <Text style={[styles.filterChipText, !topicFilter.trim() && styles.filterChipTextActive]}>All</Text>
            </Pressable>
            {topicChips.map((topic) => {
              const isActive = normalizeTopic(topicFilter) === topic;
              return (
                <Pressable
                  key={topic}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setTopicFilter(topic)}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{topic}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Topic filter (e.g. grammar)"
          placeholderTextColor="#8A94B8"
          value={topicFilter}
          onChangeText={setTopicFilter}
        />

        <View style={styles.filterSection}>
          <Text style={styles.formLabel}>Difficulty b filter</Text>
          <View style={styles.chipWrap}>
            <Pressable
              style={[styles.filterChip, !difficultyFilter.trim() && styles.filterChipActive]}
              onPress={() => setDifficultyFilter("")}
            >
              <Text style={[styles.filterChipText, !difficultyFilter.trim() && styles.filterChipTextActive]}>All</Text>
            </Pressable>
            {difficultyBands.map((band) => {
              const isActive = difficultyFilter === String(band.value);
              return (
                <Pressable
                  key={band.value}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => setDifficultyFilter(String(band.value))}
                >
                  <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                    {band.shortLabel} {band.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <PrimaryButton title="Apply filters" onPress={() => void onApplyFilters()} />
      </AppCard>

      <AppCard
        title={editQuestionId ? `Edit question #${editQuestionId}` : "Create question"}
        subtitle="Manage topic, options, correct answer, and difficulty parameter b"
        delay={140}
      >
        <Text style={styles.formLabel}>Question text</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="Question text"
          placeholderTextColor="#8A94B8"
          value={form.text}
          onChangeText={(value) => setForm((prev) => ({ ...prev, text: value }))}
          multiline
        />
        <Text style={styles.formLabel}>Topic</Text>
        <TextInput
          style={styles.input}
          placeholder="Topic (grammar, vocabulary...)"
          placeholderTextColor="#8A94B8"
          value={form.topic}
          onChangeText={(value) => setForm((prev) => ({ ...prev, topic: value }))}
        />
        <Text style={styles.formLabel}>Difficulty b</Text>
        <View style={styles.chipWrap}>
          {difficultyBands.map((band) => {
            const isActive = form.difficulty === String(band.value);
            return (
              <Pressable
                key={band.value}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setForm((prev) => ({ ...prev, difficulty: String(band.value) }))}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {band.label} {band.description}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.formLabel}>Correct option index</Text>
        <TextInput
          style={styles.input}
          placeholder="Correct option index (0-based)"
          placeholderTextColor="#8A94B8"
          value={form.correctIndex}
          onChangeText={(value) => setForm((prev) => ({ ...prev, correctIndex: value }))}
          keyboardType="numeric"
        />
        <Text style={styles.formLabel}>Answer options</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="Options: one option per line"
          placeholderTextColor="#8A94B8"
          value={form.optionsText}
          onChangeText={(value) => setForm((prev) => ({ ...prev, optionsText: value }))}
          multiline
        />
        <Text style={styles.formLabel}>Explanation</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="Explanation (optional)"
          placeholderTextColor="#8A94B8"
          value={form.explanation}
          onChangeText={(value) => setForm((prev) => ({ ...prev, explanation: value }))}
          multiline
        />
        <PrimaryButton
          title={isSaving ? "Saving..." : editQuestionId ? "Update question" : "Create question"}
          onPress={() => void onSaveQuestion()}
          disabled={isSaving}
        />
        {editQuestionId ? (
          <PrimaryButton title="Cancel edit" variant="ghost" onPress={onCancelEdit} disabled={isSaving} />
        ) : null}
      </AppCard>

      <AppCard title="Question bank" subtitle={`${visibleQuestions.length} of ${questions.length} questions shown`} delay={170}>
        {visibleQuestions.length > 0 ? (
          <View style={styles.listWrap}>
            {visibleQuestions.map((question) => (
              <View key={question.id} style={styles.rowCardVertical}>
                <View style={styles.questionHeader}>
                  <Text style={styles.rowTitle}>#{question.id} • {question.topic}</Text>
                  <Text style={styles.difficultyBadge}>{difficultyLabel(question.difficulty)}</Text>
                </View>
                <Text style={styles.questionText}>{question.text}</Text>
                <Text style={styles.rowMeta}>Options: {question.options.length}</Text>
                <View style={styles.inlineActions}>
                  <Pressable style={styles.smallAction} onPress={() => onEditQuestion(question)}>
                    <Text style={styles.smallActionText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.smallAction, styles.smallDelete]}
                    onPress={() => void onDeleteQuestion(question.id)}
                    disabled={isSaving}
                  >
                    <Text style={styles.smallActionText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <EmptyState
            title={questions.length > 0 ? "No questions match filters" : "No questions"}
            description={
              questions.length > 0
                ? "Change the topic or difficulty shortcuts to show more questions."
                : "Create your first question using the form above."
            }
            icon="help-circle-outline"
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
  difficultyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  difficultyCountCard: {
    flexGrow: 1,
    minWidth: 82,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "#F9FAFF",
    padding: 10,
    gap: 3,
  },
  difficultyCountLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  difficultyCountValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  difficultyCountMeta: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "700",
  },
  filterSection: {
    gap: 8,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: "#F9FAFF",
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: "#EEF1FF",
  },
  filterChipText: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "800",
  },
  filterChipTextActive: {
    color: colors.primary,
  },
  formLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  listWrap: {
    gap: 10,
  },
  rowCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "#F9FAFF",
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  rowCardVertical: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "#F9FAFF",
    padding: 12,
    gap: 6,
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  rowMeta: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "600",
  },
  questionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  questionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  difficultyBadge: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "900",
    backgroundColor: "#EEF1FF",
    borderWidth: 1,
    borderColor: "#C7D0FF",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    overflow: "hidden",
  },
  actionButton: {
    alignSelf: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    backgroundColor: "#FFFFFF",
  },
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  inlineActions: {
    flexDirection: "row",
    gap: 8,
  },
  smallAction: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  smallDelete: {
    backgroundColor: colors.danger,
  },
  smallActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});

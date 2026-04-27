import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { useSessions } from "@/contexts/SessionContext";
import { quizQuestions } from "@/data/quran";
import { useColors } from "@/hooks/useColors";

type Phase = "quiz" | "results";

export default function QuizScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const { currentSession, updateSessionScore } = useSessions();

  // Guard: redirect unauthenticated access
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/(auth)/login");
    }
  }, [isAuthenticated]);

  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [phase, setPhase] = useState<Phase>("quiz");

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  const totalQ = quizQuestions.length;
  const q = quizQuestions[currentQ];

  const handleAnswer = (idx: number) => {
    if (selectedAnswers[currentQ] !== undefined) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newAnswers = [...selectedAnswers];
    newAnswers[currentQ] = idx;
    setSelectedAnswers(newAnswers);

    setTimeout(() => {
      if (currentQ < totalQ - 1) {
        setCurrentQ(currentQ + 1);
      } else {
        const score = Math.round(
          (newAnswers.filter((a, i) => a === quizQuestions[i].correctIndex).length / totalQ) * 100
        );
        if (currentSession) {
          updateSessionScore(currentSession.id, score);
        }
        setPhase("results");
      }
    }, 900);
  };

  const correctCount = selectedAnswers.filter((a, i) => a === quizQuestions[i].correctIndex).length;
  const scorePercent = Math.round((correctCount / totalQ) * 100);

  const scoreColor =
    scorePercent >= 80 ? "#16a34a" : scorePercent >= 60 ? colors.accent : colors.destructive;

  const scoreFeedback =
    scorePercent >= 80
      ? "Excellent! MashaAllah!"
      : scorePercent >= 60
      ? "Good effort! Keep practicing."
      : "Keep learning — you'll improve!";

  if (phase === "results") {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.resultsHeader, { backgroundColor: colors.primary, paddingTop: topPad + 20 }]}>
          <Text style={styles.resultsTitle}>Quiz Complete!</Text>
          <Text style={styles.resultsSub}>{scoreFeedback}</Text>
        </View>

        <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.scoreCircle, { borderColor: scoreColor }]}>
            <Text style={[styles.scoreNumber, { color: scoreColor }]}>{scorePercent}%</Text>
            <Text style={[styles.scoreLabel, { color: colors.mutedForeground }]}>
              {correctCount}/{totalQ} correct
            </Text>
          </View>
        </View>

        {/* Review */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.reviewContent, { paddingBottom: botPad }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.reviewTitle, { color: colors.mutedForeground }]}>Review</Text>
          {quizQuestions.map((question, i) => {
            const chosen = selectedAnswers[i];
            const correct = chosen === question.correctIndex;
            return (
              <View
                key={i}
                style={[
                  styles.reviewCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: correct ? "#16a34a" : colors.destructive,
                  },
                ]}
              >
                <View style={styles.reviewCardHeader}>
                  <View
                    style={[
                      styles.reviewIcon,
                      { backgroundColor: correct ? "#dcfce7" : "#fee2e2" },
                    ]}
                  >
                    <Feather
                      name={correct ? "check" : "x"}
                      size={14}
                      color={correct ? "#16a34a" : colors.destructive}
                    />
                  </View>
                  <Text style={[styles.reviewQ, { color: colors.foreground }]}>{question.question}</Text>
                </View>
                <View
                  style={[
                    styles.reviewAnswerBox,
                    { backgroundColor: correct ? "#f0fdf4" : "#fff1f2" },
                  ]}
                >
                  <Text style={[styles.reviewAnswerLbl, { color: colors.mutedForeground }]}>
                    Your answer:
                  </Text>
                  <Text
                    style={[
                      styles.reviewAnswer,
                      { color: correct ? "#16a34a" : colors.destructive },
                    ]}
                  >
                    {question.options[chosen]}
                  </Text>
                  {!correct && (
                    <>
                      <Text style={[styles.reviewAnswerLbl, { color: colors.mutedForeground, marginTop: 4 }]}>
                        Correct answer:
                      </Text>
                      <Text style={[styles.reviewAnswer, { color: "#16a34a" }]}>
                        {question.options[question.correctIndex]}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            );
          })}

          <Pressable
            style={({ pressed }) => [
              styles.doneBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.87 : 1 },
            ]}
            onPress={() => router.replace("/(tabs)")}
          >
            <Feather name="home" size={18} color="#fff" />
            <Text style={styles.doneBtnText}>Back to Home</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Quiz header */}
      <View style={[styles.quizHeader, { backgroundColor: colors.primary, paddingTop: topPad + 16 }]}>
        <View style={styles.quizHeaderRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="x" size={20} color="rgba(255,255,255,0.8)" />
          </Pressable>
          <Text style={styles.quizHeaderTitle}>Knowledge Check</Text>
          <Text style={styles.quizCounter}>
            {currentQ + 1}/{totalQ}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${((currentQ + (selectedAnswers[currentQ] !== undefined ? 1 : 0)) / totalQ) * 100}%`,
                backgroundColor: "rgba(255,255,255,0.85)",
              },
            ]}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.quizContent, { paddingBottom: botPad }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.questionText, { color: colors.foreground }]}>{q.question}</Text>

        <View style={styles.optionsContainer}>
          {q.options.map((option, idx) => {
            const answered = selectedAnswers[currentQ] !== undefined;
            const isSelected = selectedAnswers[currentQ] === idx;
            const isCorrect = idx === q.correctIndex;
            const isWrong = isSelected && !isCorrect;

            let bgColor = colors.card;
            let borderColor = colors.border;
            let textColor = colors.foreground;

            if (answered) {
              if (isCorrect) {
                bgColor = "#f0fdf4";
                borderColor = "#16a34a";
                textColor = "#15803d";
              } else if (isWrong) {
                bgColor = "#fff1f2";
                borderColor = colors.destructive;
                textColor = colors.destructive;
              }
            } else if (isSelected) {
              borderColor = colors.primary;
            }

            return (
              <Pressable
                key={idx}
                style={({ pressed }) => [
                  styles.optionBtn,
                  {
                    backgroundColor: bgColor,
                    borderColor,
                    opacity: pressed && !answered ? 0.85 : 1,
                  },
                ]}
                onPress={() => handleAnswer(idx)}
                disabled={answered}
              >
                <View
                  style={[
                    styles.optionLabel,
                    {
                      backgroundColor: answered && isCorrect
                        ? "#16a34a"
                        : answered && isWrong
                        ? colors.destructive
                        : colors.secondary,
                    },
                  ]}
                >
                  {answered && isCorrect ? (
                    <Feather name="check" size={14} color="#fff" />
                  ) : answered && isWrong ? (
                    <Feather name="x" size={14} color="#fff" />
                  ) : (
                    <Text
                      style={[
                        styles.optionLabelText,
                        { color: colors.foreground },
                      ]}
                    >
                      {String.fromCharCode(65 + idx)}
                    </Text>
                  )}
                </View>
                <Text style={[styles.optionText, { color: textColor }]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  quizHeader: {
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  quizHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  quizHeaderTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
  quizCounter: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
    minWidth: 36,
    textAlign: "right",
  },
  progressTrack: {
    height: 5,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  quizContent: {
    padding: 20,
  },
  questionText: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 30,
    marginBottom: 24,
    marginTop: 8,
  },
  optionsContainer: { gap: 12 },
  optionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 14,
  },
  optionLabel: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabelText: {
    fontSize: 14,
    fontWeight: "700",
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 22,
  },
  // Results
  resultsHeader: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 6,
  },
  resultsSub: {
    fontSize: 15,
    fontWeight: "400",
    color: "rgba(255,255,255,0.8)",
  },
  scoreCard: {
    margin: 16,
    borderWidth: 1,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNumber: {
    fontSize: 30,
    fontWeight: "700",
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: "400",
    marginTop: 2,
  },
  reviewContent: { padding: 16 },
  reviewTitle: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  reviewCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
  },
  reviewCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    paddingBottom: 10,
  },
  reviewIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  reviewQ: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  reviewAnswerBox: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  reviewAnswerLbl: { fontSize: 11, fontWeight: "500", marginBottom: 2 },
  reviewAnswer: { fontSize: 14, fontWeight: "600" },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  doneBtnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
});

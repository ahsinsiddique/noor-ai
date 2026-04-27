import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/contexts/AuthContext";
import { type Session, useSessions } from "@/contexts/SessionContext";
import { useColors } from "@/hooks/useColors";

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function SessionDetailModal({
  session,
  visible,
  onClose,
  colors,
  insets,
}: {
  session: Session | null;
  visible: boolean;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 20);

  if (!session) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalRoot, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { backgroundColor: colors.primary, paddingTop: topPad + 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalSurahAr}>{session.surahName}</Text>
            <Text style={styles.modalSurahEn}>
              Ayah {session.ayahNumber} · {formatDate(session.date)} at {formatTime(session.date)}
            </Text>
          </View>
          <Pressable style={styles.modalCloseBtn} onPress={onClose}>
            <Feather name="x" size={20} color="#fff" />
          </Pressable>
        </View>

        {session.score !== undefined && (
          <View style={[styles.scoreBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.scoreCircle, { backgroundColor: colors.primary }]}>
              <Text style={styles.scoreNum}>{session.score}%</Text>
            </View>
            <View>
              <Text style={[styles.scoreLabel, { color: colors.foreground }]}>Quiz Score</Text>
              <Text style={[styles.scoreSub, { color: colors.mutedForeground }]}>
                {(session.score ?? 0) >= 80 ? "Excellent work!" : (session.score ?? 0) >= 60 ? "Good effort!" : "Keep practicing!"}
              </Text>
            </View>
          </View>
        )}

        {session.summary ? (
          <View style={[styles.summaryBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>LESSON SUMMARY</Text>
            <Text style={[styles.summaryText, { color: colors.foreground }]}>{session.summary}</Text>
          </View>
        ) : null}

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.chatHistory, { paddingBottom: botPad }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.chatHistTitle, { color: colors.mutedForeground }]}>Conversation</Text>
          {(session.messages ?? []).map((msg, i) => (
            <View
              key={i}
              style={[
                styles.histBubbleRow,
                msg.role === "user" ? styles.histBubbleRowUser : styles.histBubbleRowAI,
              ]}
            >
              {msg.role === "assistant" && (
                <View style={[styles.histAvatar, { backgroundColor: colors.primary }]}>
                  <Text style={styles.histAvatarIcon}>☪</Text>
                </View>
              )}
              <View
                style={[
                  styles.histBubble,
                  msg.role === "user"
                    ? [styles.histBubbleUser, { backgroundColor: colors.primary }]
                    : [styles.histBubbleAI, { backgroundColor: colors.card, borderColor: colors.border }],
                ]}
              >
                <Text style={[styles.histBubbleText, { color: msg.role === "user" ? "#fff" : colors.foreground }]}>
                  {msg.content}
                </Text>
              </View>
              {msg.role === "user" && (
                <View style={[styles.histAvatar, { backgroundColor: colors.accent }]}>
                  <Feather name="user" size={12} color="#fff" />
                </View>
              )}
            </View>
          ))}
          {(!session.messages || session.messages.length === 0) && (
            <Text style={[styles.emptyChat, { color: colors.mutedForeground }]}>No messages recorded.</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { sessions, syncFromCloud, loadSessionMessages, isLoadingCloud } = useSessions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? (sessions.find((s) => s.id === selectedId) ?? null) : null;

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 100 : 80);

  // Sync cloud sessions on mount if authenticated
  useEffect(() => {
    if (token) {
      syncFromCloud().catch(() => {});
    }
  }, [token, syncFromCloud]);

  const avgScore =
    sessions.filter((s) => s.score !== undefined).length > 0
      ? Math.round(
          sessions
            .filter((s) => s.score !== undefined)
            .reduce((a, s) => a + (s.score ?? 0), 0) /
            sessions.filter((s) => s.score !== undefined).length
        )
      : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: topPad + 16 }]}>
        <View>
          <Text style={styles.headerTitle}>Session History</Text>
          <Text style={styles.headerSub}>
            {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
            {avgScore !== null ? ` · Avg ${avgScore}%` : ""}
          </Text>
        </View>
        {isLoadingCloud && (
          <ActivityIndicator size="small" color="rgba(255,255,255,0.75)" />
        )}
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="book-open" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No sessions yet</Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Start a lesson and your session history will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: botPad }]}
          showsVerticalScrollIndicator={false}
        >
          {sessions.map((session) => (
            <Pressable
              key={session.id}
              style={({ pressed }) => [
                styles.sessionCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={() => {
                setSelectedId(session.id);
                // Lazy-load messages for cloud sessions that haven't been loaded yet
                if (session.dbId && session.messages.length === 0) {
                  loadSessionMessages(session.id, session.dbId).catch(() => {});
                }
              }}
            >
              <View style={[styles.sessionLeft, { borderRightColor: colors.border }]}>
                {session.score !== undefined ? (
                  <>
                    <Text style={[styles.sessionScore, { color: colors.primary }]}>{session.score}%</Text>
                    <Text style={[styles.sessionScoreLbl, { color: colors.mutedForeground }]}>score</Text>
                  </>
                ) : (
                  <View style={[styles.noScoreBox, { backgroundColor: colors.secondary }]}>
                    <Feather name="minus" size={14} color={colors.mutedForeground} />
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sessionSurah, { color: colors.foreground }]}>{session.surahName}</Text>
                <Text style={[styles.sessionMeta, { color: colors.mutedForeground }]}>
                  Ayah {session.ayahNumber} · {formatDate(session.date)} at {formatTime(session.date)}
                </Text>
                {session.messages && session.messages.length > 0 && (
                  <Text style={[styles.sessionMsgCount, { color: colors.primary }]}>
                    {session.messages.length} messages
                  </Text>
                )}
                {session.summary && (
                  <Text style={[styles.sessionSummary, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {session.summary}
                  </Text>
                )}
              </View>
              {session.dbId && (
                <View style={[styles.cloudBadge, { backgroundColor: colors.secondary }]}>
                  <Feather name="cloud" size={10} color={colors.primary} />
                </View>
              )}
              <Feather name="chevron-right" size={18} color={colors.border} />
            </Pressable>
          ))}
        </ScrollView>
      )}

      <SessionDetailModal
        session={selected}
        visible={!!selectedId}
        onClose={() => setSelectedId(null)}
        colors={colors}
        insets={insets}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 2 },
  headerSub: { fontSize: 13, fontWeight: "400", color: "rgba(255,255,255,0.7)" },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 14,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyDesc: { fontSize: 14, fontWeight: "400", textAlign: "center", lineHeight: 22 },
  listContent: { padding: 16, gap: 10 },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    gap: 0,
    paddingRight: 12,
  },
  sessionLeft: {
    width: 70,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRightWidth: 1,
  },
  sessionScore: { fontSize: 20, fontWeight: "700" },
  sessionScoreLbl: { fontSize: 11, fontWeight: "400" },
  noScoreBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionSurah: { fontSize: 15, fontWeight: "600", marginBottom: 2, paddingHorizontal: 14, paddingTop: 12 },
  sessionMeta: { fontSize: 12, fontWeight: "400", paddingHorizontal: 14, marginBottom: 4 },
  sessionMsgCount: { fontSize: 12, fontWeight: "500", paddingHorizontal: 14, paddingBottom: 12 },
  sessionSummary: { fontSize: 12, paddingHorizontal: 14, paddingBottom: 12, lineHeight: 18 },
  cloudBadge: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 6 },
  // Modal
  modalRoot: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  modalSurahAr: { fontSize: 20, fontWeight: "700", color: "#fff", marginBottom: 2 },
  modalSurahEn: { fontSize: 13, fontWeight: "400", color: "rgba(255,255,255,0.72)" },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryBox: {
    margin: 16,
    marginBottom: 0,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  summaryLabel: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  summaryText: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  scoreBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    margin: 16,
    marginBottom: 0,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  scoreCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNum: { fontSize: 18, fontWeight: "700", color: "#fff" },
  scoreLabel: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  scoreSub: { fontSize: 13, fontWeight: "400" },
  chatHistory: { padding: 16 },
  chatHistTitle: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  histBubbleRow: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-end",
    gap: 8,
  },
  histBubbleRowUser: { justifyContent: "flex-end" },
  histBubbleRowAI: { justifyContent: "flex-start" },
  histAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  histAvatarIcon: { fontSize: 12, color: "#fff" },
  histBubble: {
    maxWidth: "78%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  histBubbleUser: { borderBottomRightRadius: 4 },
  histBubbleAI: { borderWidth: 1, borderBottomLeftRadius: 4 },
  histBubbleText: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
  emptyChat: { textAlign: "center", fontSize: 14, fontWeight: "400", marginTop: 20 },
});

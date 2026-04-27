import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSessions } from "@/contexts/SessionContext";
import { useTeacher } from "@/contexts/TeacherContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { teachers } from "@/data/teachers";
import { useSurahList, type SurahMeta } from "@/services/quranApi";
import { useColors } from "@/hooks/useColors";
import { useFeatureConfig } from "@/contexts/FeatureConfigContext";
import { usePrayerTimes, type Prayer } from "@/hooks/usePrayerTimes";
import { sortByRevelation } from "@/data/revelationOrder";

type ReadingMode = "written" | "revealed";
const READING_MODE_KEY = "@quran_tutor_reading_mode";

// ─── Memoized sub-components ──────────────────────────────────────────────────

const SurahCard = React.memo(function SurahCard({
  surah,
  colors,
  onPress,
}: {
  surah: SurahMeta;
  colors: ReturnType<typeof useColors>;
  onPress: (id: number) => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.surahCard,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
      onPress={() => onPress(surah.number)}
    >
      <View style={[styles.surahNumBadge, { backgroundColor: colors.primary }]}>
        <Text style={styles.surahNum}>{surah.number}</Text>
      </View>
      <View style={styles.surahBody}>
        <View style={styles.surahNameRow}>
          <Text style={[styles.surahName, { color: colors.foreground }]}>{surah.englishName}</Text>
          <Text style={[styles.surahArabic, { color: colors.accent }]}>{surah.name}</Text>
        </View>
        <Text style={[styles.surahMeta, { color: colors.mutedForeground }]}>
          {surah.englishNameTranslation} · {surah.numberOfAyahs} verses
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.border} />
    </Pressable>
  );
});

const PrayerCard = React.memo(function PrayerCard({
  prayer,
  isNext,
  isPast,
  colors,
}: {
  prayer: Prayer;
  isNext: boolean;
  isPast: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        styles.prayerCard,
        {
          backgroundColor: isNext ? colors.primary : colors.card,
          borderColor: isNext ? colors.primary : colors.border,
          opacity: isPast && !isNext ? 0.55 : 1,
        },
      ]}
    >
      <Text style={styles.prayerCardEmoji}>{prayer.emoji}</Text>
      <Text style={[styles.prayerCardName, { color: isNext ? "#fff" : colors.foreground }]}>
        {prayer.name}
      </Text>
      <Text style={[styles.prayerCardArabic, { color: isNext ? "rgba(255,255,255,0.8)" : colors.accent }]}>
        {prayer.arabic}
      </Text>
      <Text style={[styles.prayerCardTime, { color: isNext ? "#fff" : colors.primary }]}>
        {prayer.time}
      </Text>
      {isNext && (
        <View style={styles.nextTag}>
          <Text style={styles.nextTagText}>Next</Text>
        </View>
      )}
      {isPast && !isNext && (
        <Feather name="check" size={12} color={colors.mutedForeground} style={styles.checkIcon} />
      )}
    </View>
  );
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { sessions } = useSessions();
  const { themeMode, toggleTheme } = useTheme();
  const { teacher, setTeacher } = useTeacher();

  const { config: featureConfig } = useFeatureConfig();
  const { prayers, nextPrayer, minutesUntilNext, locationName, loading: prayerLoading, error: prayerError, refetch: refetchPrayers } = usePrayerTimes(featureConfig.showPrayerTimes);
  const { data: apiSurahs, isLoading: surahsLoading } = useSurahList();

  const [readingMode, setReadingMode] = useState<ReadingMode | null>(null);
  const [modeLoaded, setModeLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(READING_MODE_KEY).then((v) => {
      if (v === "written" || v === "revealed") setReadingMode(v);
      setModeLoaded(true);
    });
  }, []);

  const selectMode = useCallback((mode: ReadingMode) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setReadingMode(mode);
    AsyncStorage.setItem(READING_MODE_KEY, mode);
  }, []);

  const displayedSurahs = useMemo(() => {
    if (!apiSurahs) return [];
    return readingMode === "revealed" ? sortByRevelation(apiSurahs) : apiSurahs;
  }, [apiSurahs, readingMode]);

  const lastSession = sessions[0];
  const totalSessions = sessions.length;

  const avgScore = useMemo(() => {
    const scored = sessions.filter((s) => s.score !== undefined);
    return scored.length > 0
      ? Math.round(scored.reduce((a, s) => a + (s.score ?? 0), 0) / scored.length)
      : null;
  }, [sessions]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 100 : 80);

  const now = Date.now();

  const handleSurahPress = useCallback((id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/(tabs)/lesson");
  }, []);

  const handleTeacherPress = useCallback((id: string) => {
    setTeacher(id);
    Haptics.selectionAsync();
  }, [setTeacher]);

  // Everything above the surah list lives in the header
  const ListHeader = useMemo(() => (
    <>
      {/* ─── Header gradient ─── */}
      <LinearGradient
        colors={[colors.primary, colors.background]}
        locations={[0, 1]}
        style={[styles.headerGrad, { paddingTop: topPad + 16 }]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Pressable
              style={styles.backBtn}
              onPress={() => router.replace("/mode-select")}
              accessibilityLabel="Back to mode selection"
            >
              <Feather name="arrow-left" size={18} color="#fff" />
            </Pressable>
            <View>
              <Text style={styles.greeting}>Assalamu Alaikum</Text>
              <Text style={styles.userName}>{user?.name || "Student"}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.iconBtn} onPress={toggleTheme} accessibilityLabel="Toggle theme">
              <Feather
                name={themeMode === "dark" ? "moon" : themeMode === "light" ? "sun" : "sunset"}
                size={16}
                color="#fff"
              />
            </Pressable>
            <Pressable style={styles.levelPill} onPress={() => router.push("/profile")}>
              <Feather name="award" size={13} color="#fff" />
              <Text style={styles.levelPillText}>{user?.level ?? "Beginner"}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.quoteBox}>
          <Text style={styles.quoteArabic}>اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ</Text>
          <Text style={styles.quoteEn}>"Read in the name of your Lord who created"</Text>
          <Text style={styles.quoteRef}>Quran 96:1</Text>
        </View>
      </LinearGradient>

      {/* ─── Stats row ─── */}
      {featureConfig.showAnalytics && totalSessions > 0 && (
        <View style={styles.statsRow}>
          {([
            { icon: "book-open" as const, val: String(totalSessions), lbl: "Sessions" },
            { icon: "bar-chart-2" as const, val: avgScore !== null ? `${avgScore}%` : "--", lbl: "Avg Score" },
            { icon: "layers" as const, val: String(apiSurahs?.length ?? 114), lbl: "Surahs" },
          ] as const).map(({ icon, val, lbl }) => (
            <View key={lbl} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name={icon} size={18} color={colors.primary} />
              <Text style={[styles.statNum, { color: colors.foreground }]}>{val}</Text>
              <Text style={[styles.statLbl, { color: colors.mutedForeground }]}>{lbl}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.body}>
        {/* ─── Prayer Times ─── */}
        {featureConfig.showPrayerTimes && (
          <>
            <View style={styles.prayerHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0, marginTop: 0 }]}>
                Prayer Times
              </Text>
              <View style={styles.prayerHeaderRight}>
                {locationName ? (
                  <View style={styles.locationPill}>
                    <Feather name="map-pin" size={10} color={colors.primary} />
                    <Text style={[styles.locationText, { color: colors.primary }]} numberOfLines={1}>
                      {locationName}
                    </Text>
                  </View>
                ) : null}
                <Pressable onPress={refetchPrayers} hitSlop={8}>
                  <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>

            {nextPrayer && !prayerLoading && (
              <View style={[styles.nextPrayerBanner, { backgroundColor: colors.primary }]}>
                <Text style={styles.nextPrayerEmoji}>{nextPrayer.emoji}</Text>
                <View style={styles.flex1}>
                  <Text style={styles.nextPrayerLabel}>Next Prayer</Text>
                  <Text style={styles.nextPrayerName}>{nextPrayer.name} · {nextPrayer.arabic}</Text>
                </View>
                <View style={styles.nextPrayerRight}>
                  <Text style={styles.nextPrayerTime}>{nextPrayer.time}</Text>
                  <Text style={styles.nextPrayerCountdown}>
                    {minutesUntilNext >= 60
                      ? `in ${Math.floor(minutesUntilNext / 60)}h ${minutesUntilNext % 60}m`
                      : `in ${minutesUntilNext}m`}
                  </Text>
                </View>
              </View>
            )}

            {prayerLoading ? (
              <View style={[styles.prayerLoadingBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.prayerLoadingText, { color: colors.mutedForeground }]}>Fetching prayer times…</Text>
              </View>
            ) : prayerError ? (
              <View style={[styles.prayerErrorBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="alert-circle" size={18} color={colors.mutedForeground} />
                <Text style={[styles.prayerErrorText, { color: colors.mutedForeground }]}>{prayerError}</Text>
                <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={refetchPrayers}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.prayerScroll}
                contentContainerStyle={styles.prayerScrollContent}
              >
                {prayers.map((prayer) => (
                  <PrayerCard
                    key={prayer.name}
                    prayer={prayer}
                    isNext={nextPrayer?.name === prayer.name}
                    isPast={prayer.timestamp < now}
                    colors={colors}
                  />
                ))}
              </ScrollView>
            )}
          </>
        )}

        {/* ─── Teacher selection ─── */}
        {featureConfig.showTeacherSelection && (
          <>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Choose Your Teacher</Text>
          <View style={styles.teacherGrid}>
            {teachers.map((t) => {
              const active = teacher.id === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => handleTeacherPress(t.id)}
                  style={({ pressed }) => [
                    styles.teacherCard,
                    {
                      backgroundColor: active ? t.color : colors.card,
                      borderColor: active ? t.color : colors.border,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <Text style={styles.teacherEmoji}>{t.emoji}</Text>
                  <Text style={[styles.teacherName, { color: active ? "#fff" : colors.foreground }]}>{t.name}</Text>
                  <Text style={[styles.teacherArabic, { color: active ? "rgba(255,255,255,0.8)" : colors.accent }]}>{t.arabicTitle}</Text>
                  <Text style={[styles.teacherDesc, { color: active ? "rgba(255,255,255,0.75)" : colors.mutedForeground }]}>{t.description}</Text>
                  {active && (
                    <View style={styles.activeTag}>
                      <Feather name="check" size={10} color={t.color} />
                      <Text style={[styles.activeTagText, { color: t.color }]}>Active</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
          </>
        )}

        {/* ─── Continue session ─── */}
        {lastSession && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Continue Learning</Text>
            <Pressable
              style={({ pressed }) => [
                styles.continueCard,
                { backgroundColor: colors.card, borderColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push("/(tabs)/lesson");
              }}
            >
              <View style={[styles.continueIconBox, { backgroundColor: colors.secondary }]}>
                <Feather name="play-circle" size={26} color={colors.primary} />
              </View>
              <View style={styles.flex1}>
                <Text style={[styles.continueTitle, { color: colors.foreground }]}>{lastSession.surahName}</Text>
                <Text style={[styles.continueSub, { color: colors.mutedForeground }]}>
                  Ayah {lastSession.ayahNumber} · {new Date(lastSession.date).toLocaleDateString()}
                </Text>
              </View>
              <View style={[styles.resumeTag, { backgroundColor: colors.primary }]}>
                <Text style={styles.resumeTagText}>Resume</Text>
              </View>
            </Pressable>
          </>
        )}

      </View>
    </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [colors, topPad, botPad, user, themeMode, toggleTheme, totalSessions, avgScore, apiSurahs,
      prayers, nextPrayer, minutesUntilNext, locationName, prayerLoading, prayerError,
      refetchPrayers, teacher, handleTeacherPress, lastSession, now]);

  const ListFooter = useMemo(() => (
    <View style={styles.footerPad}>
      <Pressable
        style={({ pressed }) => [
          styles.ctaBtn,
          { backgroundColor: teacher.color, opacity: pressed ? 0.87 : 1 },
        ]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/(tabs)/lesson");
        }}
      >
        <Text style={styles.ctaEmoji}>{teacher.emoji}</Text>
        <Text style={styles.ctaBtnText}>Start with {teacher.name}</Text>
      </Pressable>
    </View>
  ), [teacher, featureConfig]);

  if (!modeLoaded) {
    return (
      <View style={[styles.welcomeContainer, { backgroundColor: colors.background, paddingTop: topPad + 40 }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (readingMode === null) {
    return (
      <View style={[styles.welcomeContainer, { backgroundColor: colors.background, paddingTop: topPad + 40 }]}>
        <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
          Welcome to{"\n"}NoorAi
        </Text>
        <Text style={[styles.welcomeSubtitle, { color: colors.mutedForeground }]}>
          Choose your path to enlightenment
        </Text>

        <View style={styles.welcomeCards}>
          <Pressable
            style={({ pressed }) => [
              styles.welcomeCard,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => selectMode("revealed")}
          >
            <View style={[styles.welcomeIconBox, { backgroundColor: `${colors.primary}18` }]}>
              <Feather name="rotate-ccw" size={24} color={colors.primary} />
            </View>
            <View style={styles.welcomeCardText}>
              <Text style={[styles.welcomeCardTitle, { color: colors.foreground }]}>As Revealed</Text>
              <Text style={[styles.welcomeCardDesc, { color: colors.mutedForeground }]}>Chronological (Shan-e-Nuzul)</Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.welcomeCard,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => selectMode("written")}
          >
            <View style={[styles.welcomeIconBox, { backgroundColor: "#c9963a18" }]}>
              <Feather name="book-open" size={24} color="#c9963a" />
            </View>
            <View style={styles.welcomeCardText}>
              <Text style={[styles.welcomeCardTitle, { color: colors.foreground }]}>As Written</Text>
              <Text style={[styles.welcomeCardDesc, { color: colors.mutedForeground }]}>Traditional Mus'haf Order</Text>
            </View>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: botPad }}
      showsVerticalScrollIndicator={false}
    >
      {ListHeader}

      {/* ─── Available Surahs ─── */}
      <View style={[styles.body, { paddingTop: 4 }]}>
        <View style={styles.surahHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 0 }]}>
            {readingMode === "revealed" ? "Surahs (Revelation Order)" : "Available Surahs"}
          </Text>
          <Pressable
            style={[styles.switchModePill, { backgroundColor: `${colors.primary}14`, borderColor: colors.border }]}
            onPress={() => {
              const next = readingMode === "written" ? "revealed" : "written";
              selectMode(next);
            }}
          >
            <Feather
              name={readingMode === "revealed" ? "book-open" : "rotate-ccw"}
              size={12}
              color={colors.primary}
            />
            <Text style={[styles.switchModeText, { color: colors.primary }]}>
              {readingMode === "revealed" ? "Mus'haf" : "Revealed"}
            </Text>
          </Pressable>
        </View>
        <ScrollView
          style={[styles.surahListBox, { borderColor: colors.border }]}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {surahsLoading ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{ marginVertical: 32 }}
            />
          ) : (
            displayedSurahs.map((s) => (
              <SurahCard key={s.number} surah={s} colors={colors} onPress={handleSurahPress} />
            ))
          )}
        </ScrollView>
      </View>

      {ListFooter}
    </ScrollView>
  );
}

const SURAH_CARD_HEIGHT = 75;

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  flex1: { flex: 1 },
  headerGrad: { paddingHorizontal: 20, paddingBottom: 24 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: { fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.75)", marginBottom: 2, letterSpacing: 0.3 },
  userName: { fontSize: 22, fontWeight: "700", color: "#fff" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.28)",
  },
  levelPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.28)",
  },
  levelPillText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  quoteBox: {
    backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 16,
    padding: 18, alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },
  quoteArabic: { fontSize: 18, fontWeight: "700", color: "#fff", textAlign: "center", marginBottom: 8, lineHeight: 30 },
  quoteEn: { fontSize: 13, fontWeight: "400", color: "rgba(255,255,255,0.82)", textAlign: "center", marginBottom: 6, fontStyle: "italic" },
  quoteRef: { fontSize: 11, fontWeight: "500", color: "rgba(255,255,255,0.55)", letterSpacing: 0.5 },
  statsRow: { flexDirection: "row", marginHorizontal: 18, marginTop: 16, gap: 10 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 4 },
  statNum: { fontSize: 20, fontWeight: "700" },
  statLbl: { fontSize: 11, fontWeight: "400" },
  body: { paddingHorizontal: 18, paddingTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12, marginTop: 4 },
  surahListBox: { height: SURAH_CARD_HEIGHT * 3, borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  // Teacher cards
  teacherGrid: { flexDirection: "row", gap: 10, marginBottom: 22, flexWrap: "wrap" },
  teacherCard: { flex: 1, minWidth: "28%", borderWidth: 1.5, borderRadius: 16, padding: 14, alignItems: "center", gap: 4 },
  teacherEmoji: { fontSize: 26, marginBottom: 4 },
  teacherName: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  teacherArabic: { fontSize: 12, fontWeight: "500", textAlign: "center" },
  teacherDesc: { fontSize: 11, fontWeight: "400", textAlign: "center", lineHeight: 16 },
  activeTag: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  activeTagText: { fontSize: 10, fontWeight: "700" },
  // Continue card
  continueCard: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderRadius: 16, padding: 14, gap: 12, marginBottom: 22 },
  continueIconBox: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  continueTitle: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  continueSub: { fontSize: 13, fontWeight: "400" },
  resumeTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  resumeTagText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  // Surah cards — height must match SURAH_CARD_HEIGHT (75px)
  surahCard: {
    flexDirection: "row", alignItems: "center", borderWidth: 1,
    borderRadius: 14, padding: 14, gap: 12, marginBottom: 9,
    marginHorizontal: 18, height: SURAH_CARD_HEIGHT,
  },
  surahBody: { flex: 1 },
  surahNumBadge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  surahNum: { color: "#fff", fontWeight: "700", fontSize: 14 },
  surahNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  surahName: { fontSize: 15, fontWeight: "600" },
  surahArabic: { fontSize: 16, fontWeight: "500" },
  surahMeta: { fontSize: 12, fontWeight: "400" },
  // Footer
  footerPad: { paddingHorizontal: 18 },
  // CTA
  ctaBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 14, marginTop: 14, marginBottom: 8 },
  ctaEmoji: { fontSize: 18 },
  ctaBtnText: { fontSize: 17, fontWeight: "600", color: "#fff" },
  // Prayer times
  prayerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12, marginTop: 4 },
  prayerHeaderRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  locationPill: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 11, fontWeight: "600", maxWidth: 120 },
  nextPrayerBanner: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 14, marginBottom: 12 },
  nextPrayerEmoji: { fontSize: 28 },
  nextPrayerLabel: { fontSize: 11, fontWeight: "500", color: "rgba(255,255,255,0.75)", marginBottom: 2 },
  nextPrayerName: { fontSize: 15, fontWeight: "700", color: "#fff" },
  nextPrayerRight: { alignItems: "flex-end" },
  nextPrayerTime: { fontSize: 20, fontWeight: "700", color: "#fff" },
  nextPrayerCountdown: { fontSize: 11, fontWeight: "500", color: "rgba(255,255,255,0.75)" },
  prayerScroll: { marginBottom: 22 },
  prayerScrollContent: { gap: 10, paddingVertical: 2, paddingHorizontal: 2 },
  prayerCard: { width: 88, borderWidth: 1.5, borderRadius: 16, padding: 14, alignItems: "center", gap: 4 },
  prayerCardEmoji: { fontSize: 22, marginBottom: 2 },
  prayerCardName: { fontSize: 13, fontWeight: "700" },
  prayerCardArabic: { fontSize: 12, fontWeight: "500" },
  prayerCardTime: { fontSize: 14, fontWeight: "700", marginTop: 4 },
  nextTag: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 },
  nextTagText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  checkIcon: { marginTop: 4 },
  prayerLoadingBox: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 22 },
  prayerLoadingText: { fontSize: 13, fontWeight: "400" },
  prayerErrorBox: { alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 22 },
  prayerErrorText: { fontSize: 13, fontWeight: "400", textAlign: "center" },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 10 },
  retryBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  welcomeContainer: { flex: 1, alignItems: "center", paddingHorizontal: 28 },
  welcomeTitle: { fontSize: 34, fontWeight: "800", textAlign: "center", marginBottom: 10, lineHeight: 42 },
  welcomeSubtitle: { fontSize: 15, fontWeight: "400", textAlign: "center", marginBottom: 40 },
  welcomeCards: { width: "100%", gap: 16 },
  welcomeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 20,
  },
  welcomeIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeCardText: { flex: 1 },
  welcomeCardTitle: { fontSize: 17, fontWeight: "700", marginBottom: 3 },
  welcomeCardDesc: { fontSize: 13, fontWeight: "400" },
  surahHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    marginTop: 4,
  },
  switchModePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  switchModeText: { fontSize: 11, fontWeight: "600" },
});

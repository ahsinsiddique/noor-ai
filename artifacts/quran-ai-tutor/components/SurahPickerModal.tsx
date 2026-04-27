import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type SurahMeta, useSurahList } from "@/services/quranApi";
import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  currentSurah: number;
  onSelect: (surahNumber: number) => void;
  onClose: () => void;
}

export function SurahPickerModal({ visible, currentSurah, onSelect, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const { data: surahs, isLoading, error } = useSurahList();

  const filtered = useMemo(() => {
    if (!surahs) return [];
    const q = search.toLowerCase().trim();
    if (!q) return surahs;
    return surahs.filter(
      (s) =>
        s.englishName.toLowerCase().includes(q) ||
        s.englishNameTranslation.toLowerCase().includes(q) ||
        s.name.includes(q) ||
        String(s.number).includes(q)
    );
  }, [surahs, search]);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.primary, paddingTop: topPad + 12 }]}>
          <View>
            <Text style={styles.title}>Choose Surah</Text>
            <Text style={styles.subtitle}>114 Surahs · All chapters of the Quran</Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Feather name="x" size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Search */}
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder="Search by name or number…"
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x-circle" size={14} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        {/* Content */}
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading surahs…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Feather name="wifi-off" size={36} color={colors.mutedForeground} />
            <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
              Could not load surahs — check your connection
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.number)}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
            renderItem={({ item }) => <SurahRow item={item} active={item.number === currentSurah} onPress={() => { onSelect(item.number); onClose(); }} colors={colors} />}
            showsVerticalScrollIndicator={false}
            initialNumToRender={20}
            maxToRenderPerBatch={30}
          />
        )}
      </View>
    </Modal>
  );
}

function SurahRow({
  item,
  active,
  onPress,
  colors,
}: {
  item: SurahMeta;
  active: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: active ? colors.primary : colors.card,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <View style={[styles.numBadge, { backgroundColor: active ? "rgba(255,255,255,0.22)" : colors.secondary }]}>
        <Text style={[styles.numText, { color: active ? "#fff" : colors.primary }]}>{item.number}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text style={[styles.engName, { color: active ? "#fff" : colors.foreground }]}>{item.englishName}</Text>
          <Text style={[styles.arabicName, { color: active ? "rgba(255,255,255,0.85)" : colors.accent }]}>{item.name}</Text>
        </View>
        <Text style={[styles.meta, { color: active ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>
          {item.englishNameTranslation} · {item.numberOfAyahs} verses · {item.revelationType}
        </Text>
      </View>
      {active && <Feather name="check-circle" size={18} color="#fff" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: { fontSize: 20, fontWeight: "700", color: "#fff" },
  subtitle: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: "400" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  loadingText: { fontSize: 14, fontWeight: "400" },
  errorText: { fontSize: 14, fontWeight: "400", textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  numBadge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  numText: { fontSize: 14, fontWeight: "700" },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  engName: { fontSize: 15, fontWeight: "600" },
  arabicName: { fontSize: 16, fontWeight: "500" },
  meta: { fontSize: 12 },
});

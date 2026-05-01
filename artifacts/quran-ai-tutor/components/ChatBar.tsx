import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { VoiceRecorder } from "@/components/VoiceRecorder";
import { useColors } from "@/hooks/useColors";

interface ChatBarProps {
  value: string;
  onChange: (t: string) => void;
  onSend: () => void;
  onVoice: (t: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ChatBar({
  value,
  onChange,
  onSend,
  onVoice,
  placeholder = "Ask anything...",
  disabled = false,
}: ChatBarProps) {
  const colors = useColors();

  return (
    <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <VoiceRecorder onTranscript={onVoice} disabled={disabled} />
      <TextInput
        style={[styles.input, { color: colors.foreground }]}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSend}
        returnKeyType="send"
        editable={!disabled}
        multiline={false}
      />
      <Pressable
        style={[styles.sendBtn, { backgroundColor: disabled ? colors.muted : colors.primary }]}
        onPress={onSend}
        disabled={disabled}
      >
        <Feather name="arrow-right" size={18} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  input: { flex: 1, fontSize: 15, fontWeight: "400" },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
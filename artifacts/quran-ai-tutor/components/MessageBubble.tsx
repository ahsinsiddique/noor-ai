import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { TypingDots } from "@/components/TypingDots";
import { type ChatMsg, formatTime } from "@/types/chat";

export interface MsgBubbleProps {
  msg: ChatMsg;
  prevTimestamp: number | undefined;
  isLast: boolean;
  isWaiting: boolean;
  isSpeaking: boolean;
  teacherEmoji: string;
  teacherColor: string;
  accentColor: string;
  primaryColor: string;
  cardColor: string;
  borderColor: string;
  foregroundColor: string;
  mutedColor: string;
  onSpeak: (msg: ChatMsg) => void;
}

export const MessageBubble = React.memo(function MessageBubble({
  msg, prevTimestamp, isLast, isWaiting, isSpeaking,
  teacherEmoji, teacherColor, accentColor,
  primaryColor, cardColor, borderColor, foregroundColor, mutedColor,
  onSpeak,
}: MsgBubbleProps) {
  const isUser = msg.role === "user";
  const showTime = !prevTimestamp || msg.timestamp - prevTimestamp > 5 * 60 * 1000;

  return (
    <React.Fragment>
      {showTime && (
        <Text style={[styles.timeStamp, { color: mutedColor }]}>
          {formatTime(msg.timestamp)}
        </Text>
      )}
      <View style={[styles.bubbleRow, isUser ? styles.rowRight : styles.rowLeft]}>
        {!isUser && (
          <View style={[styles.avatar, { backgroundColor: teacherColor }]}>
            <Text style={styles.avatarIcon}>{teacherEmoji}</Text>
          </View>
        )}
        <View style={[styles.bubbleWrap, isUser ? styles.wrapRight : styles.wrapLeft]}>
          <View style={[
            styles.bubble,
            isUser
              ? [styles.bubbleUser, { backgroundColor: primaryColor }]
              : [styles.bubbleAI, { backgroundColor: cardColor, borderColor }],
          ]}>
            {isWaiting && isLast ? (
              <TypingDots color={primaryColor} />
            ) : msg.content ? (
              <Text style={[styles.bubbleText, { color: isUser ? "#fff" : foregroundColor }]}>
                {msg.content}
              </Text>
            ) : (
              <ActivityIndicator size="small" color={primaryColor} style={{ margin: 4 }} />
            )}
          </View>
          <View style={[styles.bubbleFooter, isUser ? styles.footerRight : styles.footerLeft]}>
            {!isUser && msg.content && (
              <Pressable
                onPress={() => onSpeak(msg)}
                style={[styles.ttsBtn, { backgroundColor: isSpeaking ? teacherColor : cardColor }]}
              >
                <Feather name={isSpeaking ? "volume-x" : "volume-2"} size={11} color={isSpeaking ? "#fff" : primaryColor} />
                <Text style={[styles.ttsBtnText, { color: isSpeaking ? "#fff" : primaryColor }]}>
                  {isSpeaking ? "Stop" : "Listen"}
                </Text>
              </Pressable>
            )}
            <Text style={[styles.msgTime, { color: mutedColor }]}>
              {formatTime(msg.timestamp)}{isUser && "  ✓✓"}
            </Text>
          </View>
        </View>
        {isUser && (
          <View style={[styles.avatar, { backgroundColor: accentColor }]}>
            <Feather name="user" size={13} color="#fff" />
          </View>
        )}
      </View>
    </React.Fragment>
  );
}, (prev, next) =>
  prev.msg.content === next.msg.content &&
  prev.isLast === next.isLast &&
  prev.isWaiting === next.isWaiting &&
  prev.isSpeaking === next.isSpeaking &&
  prev.teacherColor === next.teacherColor
);

interface WaitingBubbleProps {
  teacherColor: string;
  teacherEmoji: string;
  primaryColor: string;
  cardColor: string;
  borderColor: string;
}

export function WaitingBubble({ teacherColor, teacherEmoji, primaryColor, cardColor, borderColor }: WaitingBubbleProps) {
  return (
    <View style={[styles.bubbleRow, styles.rowLeft]}>
      <View style={[styles.avatar, { backgroundColor: teacherColor }]}>
        <Text style={styles.avatarIcon}>{teacherEmoji}</Text>
      </View>
      <View style={[styles.bubble, styles.bubbleAI, { backgroundColor: cardColor, borderColor }]}>
        <TypingDots color={primaryColor} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  timeStamp: {
    alignSelf: "center",
    fontSize: 11,
    fontWeight: "400",
    marginVertical: 8,
  },
  bubbleRow: {
    flexDirection: "row",
    marginBottom: 2,
    alignItems: "flex-end",
    gap: 8,
  },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  avatarIcon: { fontSize: 13 },
  bubbleWrap: { maxWidth: "74%" },
  wrapLeft: {},
  wrapRight: {},
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
    minHeight: 36,
    justifyContent: "center",
  },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAI: { borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  bubbleFooter: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, marginBottom: 10 },
  footerLeft: { justifyContent: "flex-start" },
  footerRight: { justifyContent: "flex-end" },
  ttsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  ttsBtnText: { fontSize: 11, fontWeight: "600" },
  msgTime: { fontSize: 11, fontWeight: "400" },
});
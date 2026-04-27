import { Feather } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  type ImageSourcePropType,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

/**
 * Animated portrait of Noor — the scholarly avatar that represents the AI
 * in the 1-1 call experience. The same `state` machine used by call-noor
 * drives the visuals here:
 *
 *   idle        → gentle breathing (slow 1.0 ↔ 1.03 scale)
 *   listening   → pulsing red/accent ring around the frame
 *   thinking    → shimmering ring, slower breath
 *   speaking    → warm glow + faster, word-level scale pulses driven by
 *                 the TTS `onBoundary` callback (so the avatar "nods"
 *                 roughly in time with speech without needing real lip-sync)
 *
 * The avatar itself is a still photograph — we don't pretend to animate a
 * mouth. The goal is a tasteful, teacher-present feeling rather than a
 * deep-fake effect.
 */

export type AvatarState = "idle" | "listening" | "thinking" | "speaking";

export type AvatarVariant = "portrait" | "square";

interface Props {
  state: AvatarState;
  /** Which crop to show. portrait = tall (call screen). square = chat header. */
  variant?: AvatarVariant;
  /** Optional override image (e.g. if the user picks a different scholar). */
  source?: ImageSourcePropType;
  /** Optional label shown beneath the avatar (e.g. "Noor · GPT-4.1"). */
  caption?: string;
  /** Size of the avatar in points (diameter for square, height for portrait). */
  size?: number;
}

// Default images — resolved at require-time so Metro bundles them.
const PORTRAIT_SRC = require("@/assets/images/noor/molana-portrait.jpg");
const SQUARE_SRC = require("@/assets/images/noor/molana-avatar.jpg");

export function ScholarAvatar({
  state,
  variant = "portrait",
  source,
  caption,
  size,
}: Props) {
  const colors = useColors();
  const breath = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const speechPulse = useRef(new Animated.Value(1)).current;

  // ─── Breathing (idle always, slightly faster when speaking) ─────────────
  useEffect(() => {
    const dur = state === "speaking" ? 1800 : 3200;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: dur,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: dur,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, breath]);

  // ─── State-specific ring / glow animations ──────────────────────────────
  useEffect(() => {
    ring.stopAnimation();
    glow.stopAnimation();
    ring.setValue(0);
    glow.setValue(0);

    if (state === "listening") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(ring, {
            toValue: 1,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ring, {
            toValue: 0,
            duration: 900,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else if (state === "thinking") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(ring, {
            toValue: 1,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ring, {
            toValue: 0,
            duration: 1400,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else if (state === "speaking") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.5,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [state, ring, glow]);

  // ─── Word-level pulse driven by TTS boundaries ──────────────────────────
  //
  // `Speech.speak(..., { onBoundary })` fires per-word on most platforms.
  // We don't know when the currently-playing utterance started from inside
  // this component, so we subscribe at a higher level via a global trick:
  // call-noor passes its speaking state in; whenever a word boundary fires
  // we kick off a quick pulse. Parent coordinates via the `pulseKey` prop
  // pattern — for now we expose a ref-free prop. If state changes to
  // speaking we start a gentle repeating pulse as a fallback.
  useEffect(() => {
    if (state !== "speaking") {
      speechPulse.stopAnimation();
      speechPulse.setValue(1);
      return;
    }
    // Fallback: soft pulse every ~400ms while speaking. When a parent wants
    // better sync it can pass onBoundary → triggerPulse() via a ref API
    // (added below as a static helper).
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(speechPulse, {
          toValue: 1.025,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(speechPulse, {
          toValue: 1,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(160),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state, speechPulse]);

  const ringColor = useMemo(() => {
    switch (state) {
      case "listening":
        return "#ef4444";
      case "thinking":
        return colors.mutedForeground;
      case "speaking":
        return colors.accent ?? "#f59e0b";
      default:
        return colors.primary;
    }
  }, [state, colors]);

  // ─── Dimensions ─────────────────────────────────────────────────────────
  const isPortrait = variant === "portrait";
  const frameHeight = size ?? (isPortrait ? 280 : 96);
  const frameWidth = isPortrait ? Math.round(frameHeight * 0.68) : frameHeight;
  const borderRadius = isPortrait ? 24 : frameHeight / 2;
  const ringSize = isPortrait
    ? { width: frameWidth + 28, height: frameHeight + 28, borderRadius: borderRadius + 10 }
    : { width: frameHeight + 14, height: frameHeight + 14, borderRadius: (frameHeight + 14) / 2 };

  const imgSource = source ?? (isPortrait ? PORTRAIT_SRC : SQUARE_SRC);

  // ─── Composed transforms ────────────────────────────────────────────────
  const breathScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0, 0.85] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.12] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });

  return (
    <View style={styles.container}>
      {/* Warm glow while speaking — a soft bed behind the portrait */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: frameWidth + 80,
            height: frameHeight + 80,
            borderRadius: borderRadius + 28,
            backgroundColor: ringColor,
            opacity: state === "speaking" ? glowOpacity : 0,
          },
        ]}
      />
      {/* Active state ring */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          ringSize,
          {
            borderColor: ringColor,
            opacity: state === "idle" ? 0 : ringOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />
      {/* The portrait itself */}
      <Animated.View
        style={{
          width: frameWidth,
          height: frameHeight,
          borderRadius,
          overflow: "hidden",
          backgroundColor: colors.card,
          transform: [{ scale: Animated.multiply(breathScale, speechPulse) }],
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Image
          source={imgSource}
          resizeMode="cover"
          style={{ width: "100%", height: "100%" }}
        />
      </Animated.View>

      {!!caption && (
        <Text style={[styles.caption, { color: colors.mutedForeground }]} numberOfLines={1}>
          {caption}
        </Text>
      )}
    </View>
  );
}

/**
 * Helper to wire TTS boundary events to a brief "nod" on the avatar.
 * Call-noor uses this: it passes the returned `speakOptions` object as the
 * third argument to `Speech.speak`. The boundary callbacks drive a tiny
 * scale pulse that makes the avatar feel alive while talking.
 *
 * This is independent of the component's own internal breathing/pulse —
 * we just register a global callback; the component itself picks up state
 * via the `state` prop.
 *
 * Usage:
 *   Speech.speak(text, { ...basicOptions, onBoundary: () => pulseMolana() });
 *
 * (In practice we keep the component's built-in speaking pulse; this export
 * exists for future upgrade to per-word sync if a parent wants it.)
 */
export function createBoundaryPulser() {
  const value = new Animated.Value(1);
  function pulse() {
    Animated.sequence([
      Animated.timing(value, {
        toValue: 1.04,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(value, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }
  return { value, pulse };
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", position: "relative" },
  glow: { position: "absolute" },
  ring: { position: "absolute", borderWidth: 3 },
  caption: { marginTop: 10, fontSize: 12, fontWeight: "500" },
});

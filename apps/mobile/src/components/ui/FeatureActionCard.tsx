import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";
import {
  motionDurations,
  motionProfiles
} from "@stealth-trails-bank/ui-foundation";
import { AppText } from "./AppText";

type FeatureActionCardProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  description: string;
  onPress: () => void;
  tone?: "dark" | "light" | "accent";
  active?: boolean;
  compact?: boolean;
  testID?: string;
};

export function FeatureActionCard({
  icon,
  label,
  description,
  onPress,
  tone = "light",
  active = false,
  compact = false,
  testID
}: FeatureActionCardProps) {
  const pressScale = useSharedValue(1);
  const ambient = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    if (active) {
      ambient.value = withRepeat(
        withTiming(1, {
          duration: motionDurations.ambientMs,
          easing: Easing.inOut(Easing.quad)
        }),
        -1,
        true
      );
      return;
    }

    ambient.value = withTiming(0, { duration: motionDurations.fastMs });
  }, [active, ambient]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: active ? ambient.value * -2 : 0 },
      { scale: pressScale.value * (active ? 1 + ambient.value * 0.004 : 1) }
    ]
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: active ? 0.14 + ambient.value * 0.08 : 0,
    transform: [{ scale: 0.98 + ambient.value * 0.04 }]
  }));

  const isDark = tone === "dark";
  const isAccent = tone === "accent";
  const containerClasses = isDark
    ? "border-transparent bg-ink"
    : isAccent
      ? "border-transparent bg-sea/20"
      : "border-border bg-white";
  const labelClasses = isDark ? "text-white" : "text-ink";
  const descriptionClasses = isDark ? "text-sand" : "text-slate";
  const iconSurfaceClasses = isDark
    ? "bg-white/14"
    : isAccent
      ? "bg-ink"
      : "bg-ink/6";
  const iconColor = isDark || isAccent ? "#fffdf8" : "#14212b";
  const containerPadding = compact ? "px-4 py-4" : "px-4 py-5";
  const minHeight = compact ? "min-h-[124px]" : "min-h-[152px]";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => {
        pressScale.value = withTiming(motionProfiles.mobile.pressScale, {
          duration: motionDurations.fastMs
        });
      }}
      onPressOut={() => {
        pressScale.value = withTiming(1, {
          duration: motionDurations.fastMs
        });
      }}
      testID={testID}
    >
      <Animated.View style={animatedStyle}>
        <View className="overflow-hidden rounded-[28px]">
          <Animated.View
            className={`absolute inset-0 rounded-[28px] ${isDark ? "bg-sea" : "bg-ink"}`}
            style={glowStyle}
          />
          <View
            className={`${minHeight} rounded-[28px] border ${containerPadding} ${containerClasses} ${
              active ? "shadow-md" : "shadow-sm"
            }`}
          >
            <View className="flex-row items-start justify-between gap-3">
              <View
                className={`h-11 w-11 items-center justify-center rounded-2xl ${iconSurfaceClasses}`}
              >
                <MaterialCommunityIcons color={iconColor} name={icon} size={22} />
              </View>
              <View className="flex-row items-center gap-2">
                {active ? <View className="h-2.5 w-2.5 rounded-full bg-sea" /> : null}
                <MaterialCommunityIcons
                  color={isDark ? "#f4e7c8" : "#72808d"}
                  name="arrow-top-right"
                  size={18}
                />
              </View>
            </View>
            <View className="mt-6 gap-2">
              <AppText className={`text-base ${labelClasses}`} weight="bold">
                {label}
              </AppText>
              <AppText className={`text-sm leading-6 ${descriptionClasses}`}>
                {description}
              </AppText>
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

import { ActivityIndicator, Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from "react-native-reanimated";
import { motionDurations, motionProfiles } from "@stealth-trails-bank/ui-foundation";
import { AppText } from "./AppText";

type AppButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  fullWidth?: boolean;
  loading?: boolean;
  loadingLabel?: string;
};

export function AppButton({
  label,
  onPress,
  disabled = false,
  variant = "primary",
  fullWidth = true,
  loading = false,
  loadingLabel
}: AppButtonProps) {
  const variantClasses =
    variant === "secondary"
      ? "bg-sand border border-border"
      : variant === "ghost"
        ? "bg-transparent border border-transparent"
        : variant === "danger"
          ? "bg-danger"
          : "bg-ink";
  const textClasses =
    variant === "secondary" || variant === "ghost"
      ? "text-ink"
      : "text-white";
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const isDisabled = disabled || loading;
  const renderedLabel = loading ? (loadingLabel ?? label) : label;
  const indicatorColor =
    variant === "secondary" || variant === "ghost" ? "#14212b" : "#fffdf8";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={() => {
        if (isDisabled) {
          return;
        }

        scale.value = withTiming(motionProfiles.mobile.pressScale, {
          duration: motionDurations.fastMs
        });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, {
          duration: motionDurations.fastMs
        });
      }}
      className={`${fullWidth ? "w-full" : ""} rounded-full px-4 py-3 ${variantClasses} ${
        isDisabled ? "opacity-50" : ""
      }`}
    >
      <Animated.View style={animatedStyle}>
        <View className="flex-row items-center justify-center gap-2">
          {loading ? <ActivityIndicator color={indicatorColor} size="small" /> : null}
          <AppText className={`${textClasses} text-sm`} weight="semibold">
            {renderedLabel}
          </AppText>
        </View>
      </Animated.View>
    </Pressable>
  );
}

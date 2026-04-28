import { ActivityIndicator, View } from "react-native";
import { AppText } from "./AppText";

type LoadingPanelProps = {
  title: string;
  description?: string;
  compact?: boolean;
};

export function InlineLoader({
  label,
  tone = "light"
}: {
  label: string;
  tone?: "light" | "dark";
}) {
  const color = tone === "dark" ? "#72e9d4" : "#1b8b7a";
  const textClassName = tone === "dark" ? "text-sand" : "text-slate";

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      className="flex-row items-center gap-2"
    >
      <ActivityIndicator color={color} size="small" />
      <AppText className={`text-sm ${textClassName}`}>{label}</AppText>
    </View>
  );
}

export function LoadingPanel({
  title,
  description,
  compact = false
}: LoadingPanelProps) {
  return (
    <View
      accessibilityLabel={title}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      className={`gap-4 rounded-[28px] border border-border bg-white/88 ${
        compact ? "px-4 py-4" : "px-5 py-5"
      }`}
    >
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-sea/20">
          <ActivityIndicator color="#1b8b7a" size="small" />
        </View>
        <View className="flex-1 gap-1">
          <AppText className="text-base text-ink" weight="semibold">
            {title}
          </AppText>
          {description ? (
            <AppText className="text-sm leading-6 text-slate">{description}</AppText>
          ) : null}
        </View>
      </View>
      {!compact ? (
        <View className="gap-2" accessible={false}>
          <View className="h-2 w-11/12 rounded-full bg-sand" />
          <View className="h-2 w-8/12 rounded-full bg-sand" />
          <View className="h-2 w-10/12 rounded-full bg-sand" />
        </View>
      ) : null}
    </View>
  );
}

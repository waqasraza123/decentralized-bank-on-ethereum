import type { ReactNode } from "react";
import { useEffect } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";
import { motionDurations } from "@stealth-trails-bank/ui-foundation";
import { useT } from "../../i18n/use-t";
import { AnimatedSection } from "./AnimatedSection";
import { AppText } from "./AppText";

type AppScreenProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  trailing?: ReactNode;
};

export function AppScreen({
  title,
  subtitle,
  children,
  trailing
}: AppScreenProps) {
  const t = useT();
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, {
        duration: motionDurations.ambientMs,
        easing: Easing.inOut(Easing.quad)
      }),
      -1,
      true
    );
  }, [drift]);

  const orbOneStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: drift.value * -4 },
      { translateX: drift.value * -3 },
      { scale: 1 + drift.value * 0.012 }
    ]
  }));

  const orbTwoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: drift.value * 3 },
      { translateX: drift.value * 2 },
      { scale: 1 - drift.value * 0.01 }
    ]
  }));

  const orbThreeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: drift.value * -3 },
      { translateX: drift.value * 4 },
      { scale: 1 + drift.value * 0.01 }
    ]
  }));

  return (
    <SafeAreaView className="flex-1 bg-parchment">
      <View className="absolute inset-0 overflow-hidden">
        <Animated.View
          className="absolute -right-14 -top-12 h-56 w-56 rounded-full bg-sea/18"
          style={orbOneStyle}
        />
        <Animated.View
          className="absolute left-[-46px] top-[22%] h-40 w-40 rounded-full bg-white/80"
          style={orbTwoStyle}
        />
        <Animated.View
          className="absolute bottom-10 right-[-34px] h-44 w-44 rounded-full bg-sand/90"
          style={orbThreeStyle}
        />
        <View className="absolute inset-x-4 top-12 h-44 rounded-[36px] border border-white/50 bg-white/35" />
      </View>
      <ScrollView
        contentContainerClassName="gap-6 px-5 pb-32"
        showsVerticalScrollIndicator={false}
      >
        <AnimatedSection className="pt-2" delayOrder={0} variant="up">
          <View className="overflow-hidden rounded-[34px] border border-white/70 bg-white/88 px-5 py-5 shadow-sm">
            <View className="absolute -right-8 top-0 h-28 w-28 rounded-full bg-sea/15" />
            <View className="absolute bottom-0 left-0 h-20 w-24 rounded-tr-[28px] bg-sand/80" />
            <View className="gap-4">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 gap-2">
                  <View className="self-start rounded-full bg-ink px-3 py-1">
                    <AppText className="text-[11px] uppercase tracking-[1.4px] text-white">
                      {t("common.managedRail")}
                    </AppText>
                  </View>
                  <AppText className="text-3xl text-ink" weight="bold">
                    {title}
                  </AppText>
                  {subtitle ? (
                    <AppText className="text-sm leading-6 text-slate">
                      {subtitle}
                    </AppText>
                  ) : null}
                </View>
                {trailing}
              </View>
            </View>
          </View>
        </AnimatedSection>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

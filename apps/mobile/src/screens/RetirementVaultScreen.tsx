import { Alert, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppScreen } from "../components/ui/AppScreen";
import { AppButton } from "../components/ui/AppButton";
import { AppText } from "../components/ui/AppText";
import { AnimatedSection } from "../components/ui/AnimatedSection";
import { FieldInput } from "../components/ui/FieldInput";
import { InlineNotice } from "../components/ui/InlineNotice";
import { LanguageToggle } from "../components/ui/LanguageToggle";
import { OptionChips } from "../components/ui/OptionChips";
import { SectionCard } from "../components/ui/SectionCard";
import {
  useBalancesQuery,
  useCreateRetirementVaultMutation,
  useFundRetirementVaultMutation,
  useRetirementVaultsQuery,
  useSupportedAssetsQuery,
} from "../hooks/use-customer-queries";
import { useLocale } from "../i18n/use-locale";
import {
  buildRequestIdempotencyKey,
  compareDecimalStrings,
  formatDateLabel,
  formatTokenAmount,
  isPositiveDecimalString,
  isPositiveIntegerString,
} from "../lib/finance";
import { useSessionStore } from "../stores/session-store";

type RetirementVaultScreenProps = {
  initialFocus?: "create" | "fund";
};

export function RetirementVaultScreen({
  initialFocus = "fund",
}: RetirementVaultScreenProps) {
  const { locale } = useLocale();
  const navigation = useNavigation<any>();
  const rememberRequestKey = useSessionStore(
    (state) => state.rememberRequestKey,
  );
  const consumeRequestKey = useSessionStore((state) => state.consumeRequestKey);
  const clearRequestKey = useSessionStore((state) => state.clearRequestKey);
  const assetsQuery = useSupportedAssetsQuery();
  const balancesQuery = useBalancesQuery();
  const retirementVaultsQuery = useRetirementVaultsQuery();
  const createRetirementVaultMutation = useCreateRetirementVaultMutation();
  const fundRetirementVaultMutation = useFundRetirementVaultMutation();
  const assets = assetsQuery.data?.assets ?? [];
  const balances = balancesQuery.data?.balances ?? [];
  const vaults = retirementVaultsQuery.data?.vaults ?? [];
  const [focus, setFocus] = useState<"create" | "fund">(initialFocus);
  const [createAsset, setCreateAsset] = useState("");
  const [fundAsset, setFundAsset] = useState("");
  const [unlockYears, setUnlockYears] = useState("10");
  const [strictMode, setStrictMode] = useState("strict");
  const [fundAmount, setFundAmount] = useState("");

  useEffect(() => {
    setFocus(initialFocus);
  }, [initialFocus]);

  const activeCreateAsset = createAsset || assets[0]?.symbol || "";
  const activeFundAsset = fundAsset || vaults[0]?.asset.symbol || "";
  const selectedFundBalance =
    balances.find((balance) => balance.asset.symbol === activeFundAsset) ?? null;
  const lockedVaultBalance = vaults.reduce(
    (sum, vault) => sum + Number.parseFloat(vault.lockedBalance || "0"),
    0,
  );
  const nextVaultUnlock = vaults
    .map((vault) => vault.unlockAt)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];

  function getIdempotencyKey(signature: string): string {
    const existing = consumeRequestKey(signature);

    if (existing) {
      return existing;
    }

    const nextKey = buildRequestIdempotencyKey("vault_fund_req");
    rememberRequestKey(signature, nextKey);
    return nextKey;
  }

  async function handleCreateVault() {
    if (!activeCreateAsset) {
      Alert.alert(
        locale === "ar" ? "قبو التقاعد" : "Retirement Vault",
        locale === "ar"
          ? "اختر أصلاً قبل إنشاء القبو."
          : "Select an asset before creating the vault.",
      );
      return;
    }

    if (!isPositiveIntegerString(unlockYears)) {
      Alert.alert(
        locale === "ar" ? "قبو التقاعد" : "Retirement Vault",
        locale === "ar"
          ? "أدخل عدداً صحيحاً من السنوات."
          : "Enter a whole number of years.",
      );
      return;
    }

    const unlockAt = new Date();
    unlockAt.setUTCFullYear(
      unlockAt.getUTCFullYear() + Number.parseInt(unlockYears, 10),
    );

    try {
      const result = await createRetirementVaultMutation.mutateAsync({
        assetSymbol: activeCreateAsset,
        unlockAt: unlockAt.toISOString(),
        strictMode: strictMode === "strict",
      });
      setFundAsset(result.vault.asset.symbol);
      setFocus("fund");
      Alert.alert(
        locale === "ar" ? "قبو التقاعد" : "Retirement Vault",
        result.created
          ? locale === "ar"
            ? "تم إنشاء القبو. يمكنك تمويله الآن."
            : "The vault was created. You can fund it now."
          : locale === "ar"
            ? "القبو موجود بالفعل لهذا الأصل."
            : "A vault already exists for this asset.",
      );
    } catch (requestError) {
      Alert.alert(
        locale === "ar" ? "قبو التقاعد" : "Retirement Vault",
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  async function handleFundVault() {
    if (!activeFundAsset) {
      Alert.alert(
        locale === "ar" ? "قبو التقاعد" : "Retirement Vault",
        locale === "ar"
          ? "أنشئ قبو تقاعد أولاً."
          : "Create a retirement vault first.",
      );
      return;
    }

    if (!isPositiveDecimalString(fundAmount)) {
      Alert.alert(
        locale === "ar" ? "قبو التقاعد" : "Retirement Vault",
        locale === "ar"
          ? "أدخل مبلغاً موجباً صالحاً."
          : "Enter a valid positive amount.",
      );
      return;
    }

    if (
      selectedFundBalance &&
      compareDecimalStrings(
        fundAmount.trim(),
        selectedFundBalance.availableBalance,
      ) === 1
    ) {
      Alert.alert(
        locale === "ar" ? "قبو التقاعد" : "Retirement Vault",
        locale === "ar"
          ? "المبلغ يتجاوز الرصيد المتاح."
          : "Amount exceeds the available balance.",
      );
      return;
    }

    const signature = JSON.stringify({
      assetSymbol: activeFundAsset,
      amount: fundAmount.trim(),
    });

    try {
      await fundRetirementVaultMutation.mutateAsync({
        idempotencyKey: getIdempotencyKey(signature),
        assetSymbol: activeFundAsset,
        amount: fundAmount.trim(),
      });
      clearRequestKey(signature);
      setFundAmount("");
      Alert.alert(
        locale === "ar" ? "قبو التقاعد" : "Retirement Vault",
        locale === "ar"
          ? "تم نقل الأموال إلى الرصيد المقفل."
          : "Funds were moved into the locked vault balance.",
      );
    } catch (requestError) {
      Alert.alert(
        locale === "ar" ? "قبو التقاعد" : "Retirement Vault",
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  const assetOptions = useMemo(
    () =>
      assets.map((asset) => ({
        label: asset.symbol,
        value: asset.symbol,
      })),
    [assets],
  );
  const vaultOptions = useMemo(
    () =>
      vaults.map((vault) => ({
        label: vault.asset.symbol,
        value: vault.asset.symbol,
      })),
    [vaults],
  );

  return (
    <AppScreen
      title={locale === "ar" ? "قبو التقاعد" : "Retirement Vault"}
      subtitle={
        locale === "ar"
          ? "أنشئ القفل، ثم انقل الأموال من الرصيد السائل إلى الرصيد المقفل."
          : "Create the lock, then move funds from liquid balance into locked balance."
      }
      trailing={<LanguageToggle />}
    >
      <AnimatedSection delayOrder={1} variant="up">
        <View className="overflow-hidden rounded-[36px] bg-ink px-5 py-6">
          <View className="absolute -right-10 -top-6 h-32 w-32 rounded-full bg-white/10" />
          <View className="gap-4">
            <View className="gap-2">
              <AppText
                className="text-sm uppercase tracking-[1.3px] text-sea"
                weight="semibold"
              >
                {locale === "ar" ? "أموال محمية" : "Protected funds"}
              </AppText>
              <AppText className="text-3xl text-white" weight="bold">
                {retirementVaultsQuery.isLoading
                  ? "..."
                  : formatTokenAmount(String(lockedVaultBalance), locale)}
              </AppText>
              <AppText className="text-sm leading-6 text-sand">
                {nextVaultUnlock
                  ? locale === "ar"
                    ? `أقرب إفراج محكوم ${formatDateLabel(nextVaultUnlock, locale)}.`
                    : `Next governed release ${formatDateLabel(nextVaultUnlock, locale)}.`
                  : locale === "ar"
                    ? "لا يوجد إفراج محكوم مجدول بعد."
                    : "No governed release is scheduled yet."}
              </AppText>
            </View>
            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[46%] flex-1 rounded-[24px] bg-white/8 px-4 py-4">
                <AppText className="text-xs uppercase tracking-[1.2px] text-sea">
                  {locale === "ar" ? "عدد الأقبية" : "Vault count"}
                </AppText>
                <AppText className="mt-2 text-3xl text-white" weight="bold">
                  {vaults.length}
                </AppText>
              </View>
              <View className="min-w-[46%] flex-1 rounded-[24px] bg-white/8 px-4 py-4">
                <AppText className="text-xs uppercase tracking-[1.2px] text-sea">
                  {locale === "ar" ? "وضع الحماية" : "Protection mode"}
                </AppText>
                <AppText className="mt-2 text-sm text-white" weight="semibold">
                  {locale === "ar"
                    ? "خارج السحب العادي"
                    : "Outside normal withdrawals"}
                </AppText>
              </View>
            </View>
          </View>
        </View>
      </AnimatedSection>

      <AnimatedSection delayOrder={2}>
        <SectionCard className="gap-4">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-1">
              <AppText className="text-xl text-ink" weight="bold">
                {locale === "ar" ? "المسار" : "Flow"}
              </AppText>
              <AppText className="text-sm leading-6 text-slate">
                {locale === "ar"
                  ? "أنشئ القبو أولاً، ثم موّله من رصيدك المتاح."
                  : "Create the vault first, then fund it from available balance."}
              </AppText>
            </View>
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-ink/6">
              <MaterialCommunityIcons
                color="#14212b"
                name="shield-lock-outline"
                size={22}
              />
            </View>
          </View>
          <OptionChips
            onChange={(value) => setFocus(value as "create" | "fund")}
            options={[
              {
                label: locale === "ar" ? "إنشاء" : "Create",
                value: "create",
              },
              {
                label: locale === "ar" ? "تمويل" : "Fund",
                value: "fund",
              },
            ]}
            value={focus}
          />
        </SectionCard>
      </AnimatedSection>

      <AnimatedSection delayOrder={3}>
        <SectionCard className="gap-4">
          {focus === "create" ? (
            <>
              <AppText className="text-xl text-ink" weight="bold">
                {locale === "ar" ? "إنشاء القبو" : "Create vault"}
              </AppText>
              <OptionChips
                onChange={setCreateAsset}
                options={assetOptions}
                value={activeCreateAsset}
              />
              <FieldInput
                keyboardType="number-pad"
                label={locale === "ar" ? "سنوات القفل" : "Lock years"}
                onChangeText={setUnlockYears}
                value={unlockYears}
              />
              <OptionChips
                onChange={setStrictMode}
                options={[
                  {
                    label: locale === "ar" ? "صارم" : "Strict",
                    value: "strict",
                  },
                  {
                    label: locale === "ar" ? "قياسي" : "Standard",
                    value: "standard",
                  },
                ]}
                value={strictMode}
              />
              <InlineNotice
                message={
                  locale === "ar"
                    ? "الوضع الصارم يجعل لغة الحماية أوضح ويثبّت القفل كنقطة قرار مقصودة."
                    : "Strict mode makes the protection language heavier and frames the lock as a deliberate decision."
                }
                tone="warning"
              />
              <AppButton
                disabled={createRetirementVaultMutation.isPending}
                label={
                  createRetirementVaultMutation.isPending
                    ? locale === "ar"
                      ? "جارٍ إنشاء القبو..."
                      : "Creating vault..."
                    : locale === "ar"
                      ? "إنشاء القبو"
                      : "Create vault"
                }
                onPress={() => {
                  void handleCreateVault();
                }}
              />
            </>
          ) : (
            <>
              <AppText className="text-xl text-ink" weight="bold">
                {locale === "ar" ? "تمويل القبو" : "Fund vault"}
              </AppText>
              <OptionChips
                onChange={setFundAsset}
                options={
                  vaultOptions.length > 0
                    ? vaultOptions
                    : [
                        {
                          label: locale === "ar" ? "لا توجد أقبية" : "No vaults",
                          value: "",
                        },
                      ]
                }
                value={activeFundAsset}
              />
              <FieldInput
                keyboardType="decimal-pad"
                label={locale === "ar" ? "المبلغ" : "Amount"}
                onChangeText={setFundAmount}
                value={fundAmount}
              />
              <InlineNotice
                message={
                  selectedFundBalance
                    ? locale === "ar"
                      ? `الرصيد المتاح: ${formatTokenAmount(selectedFundBalance.availableBalance, locale)} ${selectedFundBalance.asset.symbol}`
                      : `Available balance: ${formatTokenAmount(selectedFundBalance.availableBalance, locale)} ${selectedFundBalance.asset.symbol}`
                    : locale === "ar"
                      ? "أنشئ القبو أولاً."
                      : "Create the vault first."
                }
                tone="neutral"
              />
              <AppButton
                disabled={fundRetirementVaultMutation.isPending || vaults.length === 0}
                label={
                  fundRetirementVaultMutation.isPending
                    ? locale === "ar"
                      ? "جارٍ تمويل القبو..."
                      : "Funding vault..."
                    : locale === "ar"
                      ? "تمويل القبو"
                      : "Fund vault"
                }
                onPress={() => {
                  void handleFundVault();
                }}
              />
            </>
          )}
        </SectionCard>
      </AnimatedSection>

      <AnimatedSection delayOrder={4}>
        <SectionCard className="gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <AppText className="text-xl text-ink" weight="bold">
              {locale === "ar" ? "الأقبية الحالية" : "Current vaults"}
            </AppText>
            <AppButton
              fullWidth={false}
              label={locale === "ar" ? "المحفظة" : "Wallet"}
              onPress={() => navigation.navigate("MainTabs")}
              variant="ghost"
            />
          </View>
          {retirementVaultsQuery.isError ? (
            <InlineNotice
              message={
                retirementVaultsQuery.error instanceof Error
                  ? retirementVaultsQuery.error.message
                  : locale === "ar"
                    ? "تعذر تحميل الأقبية."
                    : "Failed to load vaults."
              }
              tone="critical"
            />
          ) : vaults.length === 0 ? (
            <AppText className="text-sm leading-6 text-slate">
              {locale === "ar"
                ? "لا يوجد أي قبو حتى الآن."
                : "No vaults exist yet."}
            </AppText>
          ) : (
            vaults.map((vault) => (
              <View
                key={vault.id}
                className="gap-2 rounded-2xl border border-border bg-white px-4 py-4"
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 gap-1">
                    <AppText className="text-base text-ink" weight="semibold">
                      {vault.asset.displayName}
                    </AppText>
                    <AppText className="text-lg text-ink" weight="bold">
                      {formatTokenAmount(vault.lockedBalance, locale)} {vault.asset.symbol}
                    </AppText>
                  </View>
                  <View className="rounded-full bg-ink px-3 py-1">
                    <AppText className="text-xs text-white" weight="semibold">
                      {vault.strictMode
                        ? locale === "ar"
                          ? "صارم"
                          : "Strict"
                        : locale === "ar"
                          ? "نشط"
                          : "Active"}
                    </AppText>
                  </View>
                </View>
                <AppText className="text-sm text-slate">
                  {locale === "ar" ? "الإفراج:" : "Release:"}{" "}
                  {formatDateLabel(vault.unlockAt, locale)}
                </AppText>
              </View>
            ))
          )}
        </SectionCard>
      </AnimatedSection>
    </AppScreen>
  );
}

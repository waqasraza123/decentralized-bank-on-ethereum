import * as Clipboard from "expo-clipboard";
import { Alert, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import QRCode from "react-native-qrcode-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type {
  CreateDepositIntentResult,
  CreateWithdrawalIntentResult,
} from "../lib/api/types";
import { useSessionStore } from "../stores/session-store";
import { AppScreen } from "../components/ui/AppScreen";
import { AppButton } from "../components/ui/AppButton";
import { AppText } from "../components/ui/AppText";
import { FeatureActionCard } from "../components/ui/FeatureActionCard";
import { FieldInput } from "../components/ui/FieldInput";
import { InlineNotice } from "../components/ui/InlineNotice";
import { LanguageToggle } from "../components/ui/LanguageToggle";
import { LtrValue } from "../components/ui/LtrValue";
import { OptionChips } from "../components/ui/OptionChips";
import { SectionCard } from "../components/ui/SectionCard";
import { StatusChip } from "../components/ui/StatusChip";
import { TimelineList } from "../components/ui/TimelineList";
import { AnimatedSection } from "../components/ui/AnimatedSection";
import {
  useBalancesQuery,
  useCreateDepositIntentMutation,
  useCreateWithdrawalIntentMutation,
  useStartMfaChallengeMutation,
  useSupportedAssetsQuery,
  useVerifyMfaChallengeMutation,
} from "../hooks/use-customer-queries";
import { useLocale } from "../i18n/use-locale";
import { useT } from "../i18n/use-t";
import {
  buildIntentTimeline,
  buildRequestIdempotencyKey,
  compareDecimalStrings,
  formatDateLabel,
  formatShortAddress,
  formatTokenAmount,
  formatIntentStatusLabel,
  getIntentStatusTone,
  isEthereumAddress,
  isPositiveDecimalString,
} from "../lib/finance";

type WalletPrimaryAction = "deposit" | "withdraw" | "send";

type WalletScreenProps = {
  initialFocus?: WalletPrimaryAction;
};

export function WalletScreen({ initialFocus }: WalletScreenProps = {}) {
  const t = useT();
  const { locale } = useLocale();
  const navigation = useNavigation<any>();
  const user = useSessionStore((state) => state.user);
  const rememberRequestKey = useSessionStore(
    (state) => state.rememberRequestKey,
  );
  const consumeRequestKey = useSessionStore((state) => state.consumeRequestKey);
  const clearRequestKey = useSessionStore((state) => state.clearRequestKey);
  const assetsQuery = useSupportedAssetsQuery();
  const balancesQuery = useBalancesQuery();
  const depositMutation = useCreateDepositIntentMutation();
  const withdrawalMutation = useCreateWithdrawalIntentMutation();
  const startMfaChallengeMutation = useStartMfaChallengeMutation();
  const verifyMfaChallengeMutation = useVerifyMfaChallengeMutation();
  const assets = assetsQuery.data?.assets ?? [];
  const balances = balancesQuery.data?.balances ?? [];
  const [showQr, setShowQr] = useState(false);
  const [depositAsset, setDepositAsset] = useState("");
  const [withdrawAsset, setWithdrawAsset] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [activeAction, setActiveAction] = useState<WalletPrimaryAction>(
    initialFocus ?? "deposit",
  );
  const [latestDeposit, setLatestDeposit] =
    useState<CreateDepositIntentResult | null>(null);
  const [latestWithdrawal, setLatestWithdrawal] =
    useState<CreateWithdrawalIntentResult | null>(null);
  const [withdrawalChallengeId, setWithdrawalChallengeId] = useState<
    string | null
  >(null);
  const [withdrawalChallengeMethod, setWithdrawalChallengeMethod] = useState<
    "totp" | "email_otp"
  >("totp");
  const [withdrawalChallengeCode, setWithdrawalChallengeCode] = useState("");
  const [withdrawalPreviewCode, setWithdrawalPreviewCode] = useState<
    string | null
  >(null);
  const assetOptions = assets.map((asset) => ({
    label: asset.symbol,
    value: asset.symbol,
  }));
  const activeDepositAsset = depositAsset || assets[0]?.symbol || "";
  const activeWithdrawAsset = withdrawAsset || assets[0]?.symbol || "";
  const selectedBalance =
    balances.find((balance) => balance.asset.symbol === activeWithdrawAsset) ??
    null;
  const fundedAssetCount = balances.filter(
    (balance) =>
      Number(balance.availableBalance) > 0 ||
      Number(balance.pendingBalance) > 0,
  ).length;

  useEffect(() => {
    if (initialFocus) {
      setActiveAction(initialFocus);
    }
  }, [initialFocus]);

  const highlightedActionTitle = useMemo(() => {
    switch (activeAction) {
      case "send":
        return t("wallet.send");
      case "withdraw":
        return t("wallet.withdraw");
      default:
        return t("wallet.deposit");
    }
  }, [activeAction, t]);

  const highlightedActionDescription = useMemo(() => {
    switch (activeAction) {
      case "send":
        return t("wallet.sendDescription");
      case "withdraw":
        return t("wallet.withdrawDescription");
      default:
        return t("wallet.depositDescription");
    }
  }, [activeAction, t]);

  const moneyMovementBlocked = user?.mfa?.moneyMovementBlocked ?? true;
  const sessionRequiresVerification =
    user?.sessionSecurity?.currentSessionRequiresVerification ?? false;
  const stepUpFresh =
    Boolean(user?.mfa?.stepUpFreshUntil) &&
    Date.parse(user?.mfa?.stepUpFreshUntil ?? "") > Date.now();

  function getIdempotencyKey(signature: string, prefix: string) {
    const existing = consumeRequestKey(signature);

    if (existing) {
      return existing;
    }

    const nextKey = buildRequestIdempotencyKey(prefix);
    rememberRequestKey(signature, nextKey);
    return nextKey;
  }

  async function handleCopyAddress() {
    if (!user?.ethereumAddress) {
      return;
    }

    await Clipboard.setStringAsync(user.ethereumAddress);
    Alert.alert(t("wallet.title"), t("wallet.depositAddressCopied"));
  }

  async function handleDeposit() {
    if (!activeDepositAsset) {
      Alert.alert(t("wallet.deposit"), t("wallet.selectAsset"));
      return;
    }

    if (!isPositiveDecimalString(depositAmount)) {
      Alert.alert(t("wallet.deposit"), t("wallet.amountInvalid"));
      return;
    }

    const signature = JSON.stringify({
      assetSymbol: activeDepositAsset,
      amount: depositAmount.trim(),
    });

    try {
      const result = await depositMutation.mutateAsync({
        idempotencyKey: getIdempotencyKey(signature, "deposit_req"),
        assetSymbol: activeDepositAsset,
        amount: depositAmount.trim(),
      });
      clearRequestKey(signature);
      setLatestDeposit(result);
      setDepositAmount("");
      Alert.alert(
        t("wallet.deposit"),
        result.intent.status === "review_required"
          ? t("wallet.depositReviewRecorded")
          : t("wallet.depositRecorded"),
      );
    } catch (requestError) {
      Alert.alert(
        t("wallet.deposit"),
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  async function handleWithdrawal() {
    if (moneyMovementBlocked) {
      Alert.alert(t("wallet.withdraw"), t("wallet.mfaSetupRequired"));
      return;
    }

    if (sessionRequiresVerification) {
      Alert.alert(
        t("wallet.withdraw"),
        t("wallet.sessionVerificationRequired"),
      );
      return;
    }

    if (!stepUpFresh) {
      Alert.alert(t("wallet.withdraw"), t("wallet.mfaStepUpRequired"));
      return;
    }

    if (!activeWithdrawAsset) {
      Alert.alert(t("wallet.withdraw"), t("wallet.selectAsset"));
      return;
    }

    if (!isEthereumAddress(withdrawAddress)) {
      Alert.alert(t("wallet.withdraw"), t("wallet.destinationInvalid"));
      return;
    }

    if (
      user?.ethereumAddress &&
      withdrawAddress.trim().toLowerCase() ===
        user.ethereumAddress.toLowerCase()
    ) {
      Alert.alert(t("wallet.withdraw"), t("wallet.selfAddressInvalid"));
      return;
    }

    if (!isPositiveDecimalString(withdrawAmount)) {
      Alert.alert(t("wallet.withdraw"), t("wallet.amountInvalid"));
      return;
    }

    if (
      selectedBalance &&
      compareDecimalStrings(
        withdrawAmount.trim(),
        selectedBalance.availableBalance,
      ) === 1
    ) {
      Alert.alert(t("wallet.withdraw"), t("wallet.insufficientBalance"));
      return;
    }

    const signature = JSON.stringify({
      assetSymbol: activeWithdrawAsset,
      amount: withdrawAmount.trim(),
      destinationAddress: withdrawAddress.trim().toLowerCase(),
    });

    try {
      const result = await withdrawalMutation.mutateAsync({
        idempotencyKey: getIdempotencyKey(signature, "withdraw_req"),
        assetSymbol: activeWithdrawAsset,
        amount: withdrawAmount.trim(),
        destinationAddress: withdrawAddress.trim(),
      });
      clearRequestKey(signature);
      setLatestWithdrawal(result);
      setWithdrawAmount("");
      setWithdrawAddress("");
      Alert.alert(t("wallet.withdraw"), t("wallet.withdrawalRecorded"));
    } catch (requestError) {
      Alert.alert(
        t("wallet.withdraw"),
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  async function startWithdrawalStepUp(method: "totp" | "email_otp") {
    try {
      const result = await startMfaChallengeMutation.mutateAsync({
        method,
        purpose: "withdrawal_step_up",
      });
      setWithdrawalChallengeMethod(method);
      setWithdrawalChallengeId(result.challengeId);
      setWithdrawalChallengeCode("");
      setWithdrawalPreviewCode(result.previewCode);
    } catch (requestError) {
      Alert.alert(
        t("wallet.withdraw"),
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  async function verifyWithdrawalStepUp() {
    if (!withdrawalChallengeId) {
      return;
    }

    try {
      await verifyMfaChallengeMutation.mutateAsync({
        challengeId: withdrawalChallengeId,
        method: withdrawalChallengeMethod,
        purpose: "withdrawal_step_up",
        code: withdrawalChallengeCode.trim(),
      });
      setWithdrawalChallengeId(null);
      setWithdrawalChallengeCode("");
      setWithdrawalPreviewCode(null);
      Alert.alert(t("wallet.withdraw"), t("wallet.mfaStepUpReady"));
    } catch (requestError) {
      Alert.alert(
        t("wallet.withdraw"),
        requestError instanceof Error
          ? requestError.message
          : String(requestError),
      );
    }
  }

  return (
    <AppScreen
      title={t("wallet.title")}
      subtitle={t("wallet.description")}
      trailing={<LanguageToggle />}
    >
      {assetsQuery.isError ? (
        <AnimatedSection delayOrder={1}>
          <InlineNotice
            message={
              assetsQuery.error instanceof Error
                ? assetsQuery.error.message
                : t("common.notAvailable")
            }
            tone="critical"
          />
        </AnimatedSection>
      ) : null}

      <AnimatedSection delayOrder={2} variant="up">
        <View className="overflow-hidden rounded-[36px] bg-ink px-5 py-6">
          <View className="absolute -right-10 -top-6 h-32 w-32 rounded-full bg-white/10" />
          <View className="gap-4">
            <View className="gap-2">
              <AppText
                className="text-sm uppercase tracking-[1.3px] text-sea"
                weight="semibold"
              >
                {t("wallet.primaryActions")}
              </AppText>
              <AppText className="text-3xl text-white" weight="bold">
                {highlightedActionTitle}
              </AppText>
              <AppText className="text-sm leading-6 text-sand">
                {highlightedActionDescription}
              </AppText>
            </View>
            <View className="flex-row flex-wrap gap-3">
              <View className="min-w-[46%] flex-1 rounded-[24px] bg-white/8 px-4 py-4">
                <AppText className="text-xs uppercase tracking-[1.2px] text-sea">
                  {t("wallet.fundedAssets")}
                </AppText>
                <AppText className="mt-2 text-3xl text-white" weight="bold">
                  {fundedAssetCount}
                </AppText>
              </View>
              <View className="min-w-[46%] flex-1 rounded-[24px] bg-white/8 px-4 py-4">
                <AppText className="text-xs uppercase tracking-[1.2px] text-sea">
                  {t("wallet.walletReference")}
                </AppText>
                <AppText className="mt-2 text-sm text-white" weight="semibold">
                  {formatShortAddress(
                    user?.ethereumAddress,
                    t("wallet.noWallet"),
                    8,
                    6,
                  )}
                </AppText>
              </View>
            </View>
          </View>
        </View>
      </AnimatedSection>

      <AnimatedSection delayOrder={3}>
        <View className="gap-3">
          <AppText className="text-xl text-ink" weight="bold">
            {t("wallet.primaryActions")}
          </AppText>
          <View className="flex-row flex-wrap gap-3">
            <View className="min-w-[31%] flex-1">
              <FeatureActionCard
                active={activeAction === "deposit"}
                compact
                description={t("wallet.depositShort")}
                icon="arrow-down-bold-circle-outline"
                label={t("wallet.deposit")}
                onPress={() => setActiveAction("deposit")}
                testID="wallet-action-deposit"
                tone={activeAction === "deposit" ? "dark" : "light"}
              />
            </View>
            <View className="min-w-[31%] flex-1">
              <FeatureActionCard
                active={activeAction === "withdraw"}
                compact
                description={t("wallet.withdrawShort")}
                icon="bank-transfer-out"
                label={t("wallet.withdraw")}
                onPress={() => setActiveAction("withdraw")}
                testID="wallet-action-withdraw"
                tone={activeAction === "withdraw" ? "dark" : "light"}
              />
            </View>
            <View className="min-w-[31%] flex-1">
              <FeatureActionCard
                active={activeAction === "send"}
                compact
                description={t("wallet.sendShort")}
                icon="send-circle-outline"
                label={t("wallet.send")}
                onPress={() => setActiveAction("send")}
                testID="wallet-action-send"
                tone={activeAction === "send" ? "dark" : "accent"}
              />
            </View>
          </View>
        </View>
      </AnimatedSection>

      <AnimatedSection delayOrder={4}>
        <SectionCard className="gap-4">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-1">
              <AppText className="text-xl text-ink" weight="bold">
                {highlightedActionTitle}
              </AppText>
              <AppText className="text-sm leading-6 text-slate">
                {highlightedActionDescription}
              </AppText>
            </View>
            <View className="h-11 w-11 items-center justify-center rounded-2xl bg-ink/6">
              <MaterialCommunityIcons
                color="#14212b"
                name={
                  activeAction === "deposit"
                    ? "arrow-down-bold-circle-outline"
                    : activeAction === "send"
                      ? "send-circle-outline"
                      : "bank-transfer-out"
                }
                size={22}
              />
            </View>
          </View>
          {activeAction === "deposit" ? (
            <>
              <InlineNotice
                message={t("wallet.depositSecurityNote")}
                tone="warning"
              />
              <OptionChips
                onChange={setDepositAsset}
                options={assetOptions}
                value={activeDepositAsset}
              />
              <FieldInput
                keyboardType="decimal-pad"
                label={t("wallet.amount")}
                onChangeText={setDepositAmount}
                value={depositAmount}
              />
              <AppButton
                disabled={depositMutation.isPending}
                label={t("wallet.createDepositRequest")}
                onPress={() => {
                  void handleDeposit();
                }}
              />
              {latestDeposit ? (
                <AnimatedSection delayOrder={1}>
                  <View className="gap-3 rounded-2xl border border-border bg-white px-4 py-4">
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-1 gap-1">
                        <AppText
                          className="text-base text-ink"
                          weight="semibold"
                        >
                          {t("wallet.latestDepositRequest")}
                        </AppText>
                        <AppText className="text-sm text-slate">
                          {t("wallet.reference")}: {latestDeposit.intent.id}
                        </AppText>
                      </View>
                      <StatusChip
                        label={formatIntentStatusLabel(
                          latestDeposit.intent.status,
                          locale,
                        )}
                        tone={getIntentStatusTone(latestDeposit.intent.status)}
                      />
                    </View>
                    <TimelineList
                      events={buildIntentTimeline(latestDeposit.intent)}
                    />
                    {latestDeposit.intent.status === "review_required" ? (
                      <InlineNotice
                        message={t("wallet.depositReviewStatusNote")}
                        tone="warning"
                      />
                    ) : null}
                  </View>
                </AnimatedSection>
              ) : null}
            </>
          ) : (
            <>
                {moneyMovementBlocked ? (
                  <InlineNotice
                    message={t("wallet.mfaSetupRequired")}
                    tone="warning"
                  />
                ) : sessionRequiresVerification ? (
                  <InlineNotice
                    message={t("wallet.sessionVerificationRequired")}
                    tone="warning"
                  />
                ) : !stepUpFresh ? (
                  <View className="gap-3">
                  <InlineNotice
                    message={t("wallet.mfaStepUpRequired")}
                    tone="warning"
                  />
                  <View className="flex-row gap-3">
                    <AppButton
                      fullWidth={false}
                      label={t("wallet.mfaUseAuthenticator")}
                      onPress={() => {
                        void startWithdrawalStepUp("totp");
                      }}
                      variant="secondary"
                    />
                    {user?.mfa?.emailOtpEnrolled ? (
                      <AppButton
                        fullWidth={false}
                        label={t("wallet.mfaUseEmail")}
                        onPress={() => {
                          void startWithdrawalStepUp("email_otp");
                        }}
                        variant="secondary"
                      />
                    ) : null}
                  </View>
                  {withdrawalChallengeId ? (
                    <View className="gap-3 rounded-2xl border border-border bg-white px-4 py-4">
                      {withdrawalPreviewCode ? (
                        <LtrValue
                          value={`${t("wallet.mfaPreviewCode")}: ${withdrawalPreviewCode}`}
                        />
                      ) : null}
                      <FieldInput
                        keyboardType="number-pad"
                        label={t("wallet.mfaCodeLabel")}
                        onChangeText={setWithdrawalChallengeCode}
                        value={withdrawalChallengeCode}
                      />
                      <AppButton
                        disabled={verifyMfaChallengeMutation.isPending}
                        label={t("wallet.mfaVerifyStepUp")}
                        onPress={() => {
                          void verifyWithdrawalStepUp();
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
              <InlineNotice
                message={
                  activeAction === "send"
                    ? t("wallet.sendRoutingNote")
                    : t("wallet.reservationNote")
                }
                tone="warning"
              />
              <OptionChips
                onChange={setWithdrawAsset}
                options={assetOptions}
                value={activeWithdrawAsset}
              />
              <AppText className="text-sm text-slate">
                {selectedBalance
                  ? `${formatTokenAmount(
                      selectedBalance.availableBalance,
                      locale,
                    )} available / ${formatTokenAmount(
                      selectedBalance.pendingBalance,
                      locale,
                    )} pending`
                  : t("common.notAvailable")}
              </AppText>
              <FieldInput
                autoCapitalize="none"
                label={t("wallet.destinationAddress")}
                onChangeText={setWithdrawAddress}
                value={withdrawAddress}
              />
              <FieldInput
                keyboardType="decimal-pad"
                label={t("wallet.amount")}
                onChangeText={setWithdrawAmount}
                value={withdrawAmount}
              />
              <AppButton
                disabled={
                  withdrawalMutation.isPending ||
                  moneyMovementBlocked ||
                  !stepUpFresh
                }
                label={
                  activeAction === "send"
                    ? t("wallet.createSendRequest")
                    : t("wallet.createWithdrawalRequest")
                }
                onPress={() => {
                  void handleWithdrawal();
                }}
              />
              {moneyMovementBlocked ? (
                <AppButton
                  label={t("wallet.openSecuritySetup")}
                  onPress={() => {
                    navigation.navigate("Profile");
                  }}
                  variant="secondary"
                />
              ) : null}
              {latestWithdrawal ? (
                <AnimatedSection delayOrder={1}>
                  <View className="gap-3 rounded-2xl border border-border bg-white px-4 py-4">
                    <View className="flex-row items-center justify-between gap-3">
                      <View className="flex-1 gap-1">
                        <AppText
                          className="text-base text-ink"
                          weight="semibold"
                        >
                          {activeAction === "send"
                            ? t("wallet.latestSendRequest")
                            : t("wallet.latestWithdrawalRequest")}
                        </AppText>
                        <AppText className="text-sm text-slate">
                          {t("wallet.reference")}: {latestWithdrawal.intent.id}
                        </AppText>
                      </View>
                      <StatusChip
                        label={formatIntentStatusLabel(
                          latestWithdrawal.intent.status,
                          locale,
                        )}
                        tone={getIntentStatusTone(
                          latestWithdrawal.intent.status,
                        )}
                      />
                    </View>
                    <TimelineList
                      events={buildIntentTimeline(latestWithdrawal.intent)}
                    />
                  </View>
                </AnimatedSection>
              ) : null}
            </>
          )}
        </SectionCard>
      </AnimatedSection>

      <AnimatedSection delayOrder={5}>
        <View className="gap-1 px-1">
          <AppText className="text-xl text-ink" weight="bold">
            {t("wallet.secondaryTools")}
          </AppText>
          <AppText className="text-sm leading-6 text-slate">
            {t("wallet.secondaryToolsDescription")}
          </AppText>
        </View>
      </AnimatedSection>

      <AnimatedSection delayOrder={6}>
        <SectionCard className="gap-4">
          <AppText className="text-xl text-ink" weight="bold">
            {t("wallet.walletReference")}
          </AppText>
          <AppText className="text-2xl text-ink" weight="bold">
            {formatShortAddress(
              user?.ethereumAddress,
              t("wallet.noWallet"),
              10,
              6,
            )}
          </AppText>
          <View className="flex-row gap-3">
            <AppButton
              label={t("wallet.copy")}
              onPress={() => {
                void handleCopyAddress();
              }}
              fullWidth={false}
              variant="secondary"
            />
            <AppButton
              label={showQr ? t("wallet.hideQr") : t("wallet.showQr")}
              onPress={() => setShowQr((current) => !current)}
              fullWidth={false}
              variant="secondary"
            />
          </View>
          {showQr && user?.ethereumAddress ? (
            <AnimatedSection delayOrder={1}>
              <View className="items-center rounded-3xl bg-white py-6">
                <QRCode value={user.ethereumAddress} size={160} />
              </View>
            </AnimatedSection>
          ) : null}
        </SectionCard>
      </AnimatedSection>

      <AnimatedSection delayOrder={7}>
        <SectionCard className="gap-4">
          <View className="flex-row items-center justify-between">
            <AppText className="text-xl text-ink" weight="bold">
              {t("wallet.balances")}
            </AppText>
          </View>
          {balances.length === 0 ? (
            <AppText className="text-sm text-slate">
              {t("common.noData")}
            </AppText>
          ) : (
            <View className="gap-3">
              {balances.map((balance, index) => (
                <AnimatedSection key={balance.asset.id} delayOrder={index + 1}>
                  <View className="rounded-2xl border border-border bg-white px-4 py-4">
                    <View className="flex-row items-center justify-between">
                      <AppText className="text-base text-ink" weight="semibold">
                        {balance.asset.symbol}
                      </AppText>
                      <AppText className="text-xs text-slate">
                        {formatDateLabel(balance.updatedAt, locale)}
                      </AppText>
                    </View>
                    <AppText className="mt-2 text-sm text-slate">
                      {formatTokenAmount(balance.availableBalance, locale)}{" "}
                      available
                    </AppText>
                    <AppText className="text-sm text-slate">
                      {formatTokenAmount(balance.pendingBalance, locale)}{" "}
                      pending
                    </AppText>
                  </View>
                </AnimatedSection>
              ))}
            </View>
          )}
        </SectionCard>
      </AnimatedSection>
    </AppScreen>
  );
}

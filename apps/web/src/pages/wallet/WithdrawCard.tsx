import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "@/components/ui/use-toast";
import { TimelineList } from "@/components/customer/TimelineList";
import { StatusBadge } from "@/components/customer/StatusBadge";
import { CustomerAssetBalance } from "@/hooks/balances/useMyBalances";
import { SupportedAsset } from "@/hooks/assets/useSupportedAssets";
import {
  CreateWithdrawalIntentResult,
  useCreateWithdrawalIntent,
} from "@/hooks/transaction-intents/useCreateWithdrawalIntent";
import { readApiErrorMessage } from "@/lib/api";
import { useUserStore } from "@/stores/userStore";
import {
  useStartCustomerMfaChallenge,
  useVerifyCustomerMfaChallenge,
} from "@/hooks/auth/useCustomerMfa";
import {
  buildIntentTimeline,
  buildRequestIdempotencyKey,
  compareDecimalStrings,
  formatDateLabel,
  formatIntentStatusLabel,
  formatTokenAmount,
  getIntentConfidenceStatus,
  isEthereumAddress,
  isPositiveDecimalString,
} from "@/lib/customer-finance";
import { useLocale } from "@/i18n/use-locale";
import { getTransactionConfidenceTone } from "@stealth-trails-bank/ui-foundation";

type WithdrawCardProps = {
  walletAddress: string | null;
  assets: SupportedAsset[];
  balances: CustomerAssetBalance[];
  isAssetsLoading: boolean;
  isBalancesLoading: boolean;
  assetsErrorMessage: string | null;
  balancesErrorMessage: string | null;
};

const WithdrawCard = ({
  walletAddress,
  assets,
  balances,
  isAssetsLoading,
  isBalancesLoading,
  assetsErrorMessage,
  balancesErrorMessage,
}: WithdrawCardProps) => {
  const { locale } = useLocale();
  const user = useUserStore((state) => state.user);
  const createWithdrawalIntent = useCreateWithdrawalIntent();
  const startMfaChallenge = useStartCustomerMfaChallenge();
  const verifyMfaChallenge = useVerifyCustomerMfaChallenge();
  const [preferredAssetSymbol, setPreferredAssetSymbol] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [latestRequest, setLatestRequest] =
    useState<CreateWithdrawalIntentResult | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [challengeMethod, setChallengeMethod] = useState<"totp" | "email_otp">(
    "totp",
  );
  const [challengeCode, setChallengeCode] = useState("");
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const lastSubmissionRef = useRef<{
    signature: string;
    idempotencyKey: string;
  } | null>(null);

  const selectedAssetSymbol =
    assets.find((asset) => asset.symbol === preferredAssetSymbol)?.symbol ??
    assets[0]?.symbol ??
    "";

  const selectedBalance = useMemo(
    () =>
      balances.find(
        (balance) => balance.asset.symbol === selectedAssetSymbol,
      ) ?? null,
    [balances, selectedAssetSymbol],
  );
  const moneyMovementBlocked = user?.mfa?.moneyMovementBlocked ?? true;
  const sessionRequiresVerification =
    user?.sessionSecurity?.currentSessionRequiresVerification ?? false;
  const stepUpFresh =
    Boolean(user?.mfa?.stepUpFreshUntil) &&
    Date.parse(user?.mfa?.stepUpFreshUntil ?? "") > Date.now();

  function getIdempotencyKey(signature: string): string {
    if (lastSubmissionRef.current?.signature === signature) {
      return lastSubmissionRef.current.idempotencyKey;
    }

    const idempotencyKey = buildRequestIdempotencyKey("withdraw_req");
    lastSubmissionRef.current = {
      signature,
      idempotencyKey,
    };

    return idempotencyKey;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedAddress = withdrawAddress.trim();
    const normalizedAmount = withdrawAmount.trim();

    if (moneyMovementBlocked) {
      setFormError(
        locale === "ar"
          ? "أكمل إعداد المصادقة متعددة العوامل أولاً من الملف الشخصي."
          : "Finish MFA setup from the profile page before sending or withdrawing.",
      );
      return;
    }

    if (sessionRequiresVerification) {
      setFormError(
        locale === "ar"
          ? "تحقق من الجلسة الحالية من صفحة الملف الشخصي قبل إنشاء طلب السحب."
          : "Verify the current session from the profile page before creating a withdrawal request.",
      );
      return;
    }

    if (!stepUpFresh) {
      setFormError(
        locale === "ar"
          ? "أكمل تحقق MFA جديداً قبل إنشاء طلب السحب."
          : "Complete a fresh MFA verification before creating a withdrawal request.",
      );
      return;
    }

    if (!selectedAssetSymbol) {
      setFormError(
        locale === "ar"
          ? "اختر أصلاً قبل تسجيل الطلب."
          : "Select an asset before creating a withdrawal request.",
      );
      return;
    }

    if (!isEthereumAddress(normalizedAddress)) {
      setFormError(
        locale === "ar"
          ? "عنوان الوجهة يجب أن يكون عنوان EVM صالحاً."
          : "Destination address must be a valid EVM address.",
      );
      return;
    }

    if (
      walletAddress &&
      normalizedAddress.toLowerCase() === walletAddress.toLowerCase()
    ) {
      setFormError(
        locale === "ar"
          ? "يجب أن يكون عنوان الوجهة مختلفاً عن عنوان محفظتك المُدارة."
          : "Destination address must be different from your managed wallet address.",
      );
      return;
    }

    if (!isPositiveDecimalString(normalizedAmount)) {
      setFormError(
        locale === "ar"
          ? "أدخل مبلغاً موجباً بصيغة عشرية صالحة."
          : "Amount must be a valid positive decimal value.",
      );
      return;
    }

    const availableBalance = selectedBalance?.availableBalance ?? "0";

    if (compareDecimalStrings(normalizedAmount, availableBalance) === 1) {
      setFormError(
        locale === "ar"
          ? `المبلغ المطلوب يتجاوز الرصيد المتاح ${formatTokenAmount(
              availableBalance,
              locale,
            )} ${selectedAssetSymbol}.`
          : `Requested amount exceeds the available balance of ${formatTokenAmount(
              availableBalance,
              locale,
            )} ${selectedAssetSymbol}.`,
      );
      return;
    }

    setFormError(null);

    const requestSignature = JSON.stringify({
      assetSymbol: selectedAssetSymbol,
      amount: normalizedAmount,
      destinationAddress: normalizedAddress.toLowerCase(),
    });

    try {
      const result = await createWithdrawalIntent.mutateAsync({
        idempotencyKey: getIdempotencyKey(requestSignature),
        assetSymbol: selectedAssetSymbol,
        amount: normalizedAmount,
        destinationAddress: normalizedAddress,
      });

      setLatestRequest(result);
      setWithdrawAmount("");
      setWithdrawAddress("");
      lastSubmissionRef.current = null;

      toast({
        title:
          locale === "ar"
            ? result.idempotencyReused
              ? "تمت إعادة استخدام طلب السحب"
              : "تم تسجيل طلب السحب"
            : result.idempotencyReused
              ? "Withdrawal request reused"
              : "Withdrawal request recorded",
        description:
          locale === "ar"
            ? "تم نقل الطلب إلى مسار المراجعة المُدار."
            : "The request has moved into the managed review flow.",
      });
    } catch (error) {
      const message = readApiErrorMessage(
        error,
        locale === "ar"
          ? "تعذر إنشاء طلب السحب."
          : "Failed to create withdrawal request.",
      );
      setFormError(message);

      toast({
        title: locale === "ar" ? "فشل طلب السحب" : "Withdrawal request failed",
        description: message,
        variant: "destructive",
      });
    }
  }

  async function handleStartChallenge(method: "totp" | "email_otp") {
    try {
      const result = await startMfaChallenge.mutateAsync({
        method,
        purpose: "withdrawal_step_up",
      });
      setChallengeMethod(method);
      setChallengeId(result.challengeId);
      setChallengeCode("");
      setPreviewCode(result.previewCode);
      setFormError(null);
    } catch (error) {
      setFormError(
        readApiErrorMessage(
          error,
          locale === "ar"
            ? "تعذر بدء تحقق MFA."
            : "Failed to start MFA challenge.",
        ),
      );
    }
  }

  async function handleVerifyChallenge() {
    if (!challengeId) {
      return;
    }

    try {
      await verifyMfaChallenge.mutateAsync({
        challengeId,
        method: challengeMethod,
        purpose: "withdrawal_step_up",
        code: challengeCode,
      });
      setChallengeId(null);
      setChallengeCode("");
      setPreviewCode(null);
      setFormError(null);
    } catch (error) {
      setFormError(
        readApiErrorMessage(
          error,
          locale === "ar" ? "فشل تحقق MFA." : "Failed to verify MFA challenge.",
        ),
      );
    }
  }

  const latestConfidence = latestRequest
    ? getIntentConfidenceStatus(latestRequest.intent.status)
    : null;

  return (
    <Card
      className="stb-surface stb-reveal rounded-[2rem] border-0"
      data-delay="3"
    >
      <CardHeader className="space-y-3">
        <CardTitle className="text-2xl text-slate-950">
          {locale === "ar" ? "السحب" : "Withdraw"}
        </CardTitle>
        <CardDescription className="max-w-2xl text-sm leading-7 text-slate-600">
          {locale === "ar"
            ? "أدخل الأصل والمبلغ والوجهة، ثم راجع الطلب بعناية قبل إرساله إلى مسار التنفيذ المُدار."
            : "Enter the asset, amount, and destination, then review the request carefully before it enters managed execution."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white shadow-[0_28px_72px_rgba(10,18,28,0.22)]">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-amber-300" />
            {locale === "ar" ? "تسلسل السحب" : "Withdrawal sequence"}
          </div>
          <div className="mt-4 grid gap-3 text-sm text-white/72 sm:grid-cols-3">
            <div>
              1. {locale === "ar" ? "تحقق من الوجهة" : "Validate destination"}
            </div>
            <div>2. {locale === "ar" ? "راجع الأثر" : "Review the impact"}</div>
            <div>
              3.{" "}
              {locale === "ar"
                ? "تابع المراجعة والتنفيذ"
                : "Track review and execution"}
            </div>
          </div>
        </div>

        <div className="stb-trust-note p-4 text-amber-900" data-tone="warning">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            {locale === "ar"
              ? "سلوك حجز الرصيد"
              : "Balance reservation behavior"}
          </div>
          <p className="mt-2 text-sm leading-7 text-amber-800">
            {locale === "ar"
              ? "الطلب الناجح ينقل المبلغ المطلوب من الرصيد المتاح إلى المعلّق مباشرة بينما تستمر المراجعة."
              : "A successful request moves the amount from available to pending immediately while review continues."}
          </p>
        </div>

        {moneyMovementBlocked ? (
          <div
            className="stb-trust-note p-4 text-amber-900"
            data-tone="warning"
          >
            {locale === "ar"
              ? "تظل عمليات السحب والإرسال محجوبة حتى تكتمل المصادقة متعددة العوامل من صفحة الملف الشخصي."
              : "Withdraw and send remain blocked until MFA setup is complete from the profile page."}
          </div>
        ) : sessionRequiresVerification ? (
          <div
            className="stb-trust-note p-4 text-amber-900"
            data-tone="warning"
          >
            {locale === "ar"
              ? "تحقق من هذه الجلسة غير المألوفة من صفحة الملف الشخصي قبل المتابعة."
              : "Verify this unfamiliar session from the profile page before withdraw or send is allowed."}
          </div>
        ) : !stepUpFresh ? (
          <div className="space-y-4 rounded-[1.5rem] border border-slate-200/70 bg-white/85 p-5">
            <p className="text-sm font-medium text-slate-950">
              {locale === "ar"
                ? "أكمل تحقق MFA جديداً لهذا السحب"
                : "Complete a fresh MFA verification for this withdrawal"}
            </p>
            <div className="flex flex-wrap gap-3">
              <LoadingButton
                type="button"
                loading={
                  startMfaChallenge.isPending && challengeMethod === "totp"
                }
                onClick={() => {
                  void handleStartChallenge("totp");
                }}
              >
                {locale === "ar" ? "استخدم التطبيق" : "Use authenticator"}
              </LoadingButton>
              {user?.mfa.emailOtpEnrolled ? (
                <LoadingButton
                  type="button"
                  loading={
                    startMfaChallenge.isPending &&
                    challengeMethod === "email_otp"
                  }
                  onClick={() => {
                    void handleStartChallenge("email_otp");
                  }}
                >
                  {locale === "ar" ? "استخدم البريد" : "Use email backup"}
                </LoadingButton>
              ) : null}
            </div>
            {challengeId ? (
              <div className="space-y-3">
                {previewCode ? (
                  <div className="stb-section-frame p-4 text-sm text-muted-foreground">
                    {locale === "ar" ? "رمز المعاينة:" : "Preview code:"}{" "}
                    <span className="font-semibold text-foreground">
                      {previewCode}
                    </span>
                  </div>
                ) : null}
                <Input
                  placeholder="123456"
                  value={challengeCode}
                  onChange={(event) => setChallengeCode(event.target.value)}
                  className="bg-white"
                />
                <LoadingButton
                  type="button"
                  loading={verifyMfaChallenge.isPending}
                  onClick={() => {
                    void handleVerifyChallenge();
                  }}
                >
                  {locale === "ar" ? "تحقق من الرمز" : "Verify challenge"}
                </LoadingButton>
              </div>
            ) : null}
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor="withdraw-asset"
            >
              {locale === "ar" ? "الأصل" : "Asset"}
            </label>
            <select
              id="withdraw-asset"
              className="stb-premium-input"
              value={selectedAssetSymbol}
              disabled={isAssetsLoading || assets.length === 0}
              onChange={(event) => setPreferredAssetSymbol(event.target.value)}
            >
              {assets.length === 0 ? (
                <option value="">
                  {isAssetsLoading
                    ? locale === "ar"
                      ? "جاري التحميل..."
                      : "Loading assets..."
                    : locale === "ar"
                      ? "لا توجد أصول مدعومة"
                      : "No supported assets"}
                </option>
              ) : null}
              {assets.map((asset) => (
                <option key={asset.id} value={asset.symbol}>
                  {asset.displayName} ({asset.symbol})
                </option>
              ))}
            </select>
            <div className="grid gap-2 rounded-[1.3rem] border border-slate-200/70 bg-white/85 px-4 py-3 text-sm text-slate-600 sm:grid-cols-2">
              <div>
                {locale === "ar" ? "متاح:" : "Available:"}{" "}
                <span className="font-semibold text-slate-950">
                  {isBalancesLoading
                    ? locale === "ar"
                      ? "جاري التحميل..."
                      : "Loading..."
                    : `${formatTokenAmount(
                        selectedBalance?.availableBalance ?? "0",
                        locale,
                      )} ${selectedAssetSymbol || ""}`.trim()}
                </span>
              </div>
              <div>
                {locale === "ar" ? "معلّق:" : "Pending:"}{" "}
                <span className="font-semibold text-slate-950">
                  {isBalancesLoading
                    ? locale === "ar"
                      ? "جاري التحميل..."
                      : "Loading..."
                    : `${formatTokenAmount(
                        selectedBalance?.pendingBalance ?? "0",
                        locale,
                      )} ${selectedAssetSymbol || ""}`.trim()}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="withdraw-address"
              >
                {locale === "ar" ? "عنوان الوجهة" : "Destination address"}
              </label>
              <Input
                id="withdraw-address"
                placeholder="0x..."
                value={withdrawAddress}
                onChange={(event) => setWithdrawAddress(event.target.value)}
                className="bg-white"
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="withdraw-amount"
              >
                {locale === "ar" ? "المبلغ" : "Amount"}
              </label>
              <Input
                id="withdraw-amount"
                placeholder="25"
                value={withdrawAmount}
                onChange={(event) => setWithdrawAmount(event.target.value)}
                className="bg-white"
              />
            </div>
          </div>

          <div
            className="stb-trust-note text-sm text-slate-700"
            data-tone="neutral"
          >
            {locale === "ar"
              ? "تأكد من الوجهة والمبلغ لأن الطلب سيدخل مسار مراجعة جاد وقد يظل معلقاً قبل الإرسال إلى الشبكة."
              : "Review the destination and amount carefully. The request enters a serious review path and may remain pending before network broadcast."}
          </div>

          {assetsErrorMessage ? (
            <div
              className="stb-trust-note text-sm text-red-700"
              data-tone="critical"
            >
              {assetsErrorMessage}
            </div>
          ) : null}

          {balancesErrorMessage ? (
            <div
              className="stb-trust-note text-sm text-red-700"
              data-tone="critical"
            >
              {balancesErrorMessage}
            </div>
          ) : null}

          {formError ? (
            <div
              className="stb-trust-note text-sm text-red-700"
              data-tone="critical"
            >
              {formError}
            </div>
          ) : null}

          <LoadingButton
            type="submit"
            className="h-12 w-full rounded-2xl bg-slate-950 text-sm font-semibold text-white hover:bg-slate-900"
            loading={createWithdrawalIntent.isPending}
            disabled={
              moneyMovementBlocked || sessionRequiresVerification || !stepUpFresh
            }
          >
            {locale === "ar" ? "إنشاء طلب السحب" : "Create withdrawal request"}
          </LoadingButton>
        </form>

        {latestRequest ? (
          <div className="stb-section-frame p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {locale === "ar"
                    ? "أحدث طلب سحب"
                    : "Latest withdrawal request"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {formatTokenAmount(
                    latestRequest.intent.requestedAmount,
                    locale,
                  )}{" "}
                  {latestRequest.intent.asset.symbol}
                </p>
              </div>
              {latestConfidence ? (
                <StatusBadge
                  label={formatIntentStatusLabel(
                    latestRequest.intent.status,
                    locale,
                  )}
                  tone={getTransactionConfidenceTone(latestConfidence)}
                />
              ) : null}
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <p>
                {locale === "ar" ? "المرجع:" : "Reference:"}{" "}
                <span className="stb-ref font-semibold text-slate-950">
                  {latestRequest.intent.id}
                </span>
              </p>
              <p>
                {locale === "ar" ? "تم الإنشاء:" : "Created:"}{" "}
                <span className="font-semibold text-slate-950">
                  {formatDateLabel(latestRequest.intent.createdAt, locale)}
                </span>
              </p>
            </div>
            <div className="mt-5">
              <TimelineList
                events={buildIntentTimeline(latestRequest.intent)}
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default WithdrawCard;

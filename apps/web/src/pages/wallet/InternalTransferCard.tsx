import { useMemo, useRef, useState } from "react";
import { ArrowRightLeft, ShieldCheck, UserRoundSearch } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InlineLoader } from "@/components/ui/loading-panel";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "@/components/ui/use-toast";
import { TimelineList } from "@/components/customer/TimelineList";
import { StatusBadge } from "@/components/customer/StatusBadge";
import { CustomerAssetBalance } from "@/hooks/balances/useMyBalances";
import { SupportedAsset } from "@/hooks/assets/useSupportedAssets";
import {
  CreateBalanceTransferResult,
  PreviewBalanceTransferRecipientResult,
  useCreateBalanceTransfer,
  usePreviewBalanceTransferRecipient,
} from "@/hooks/balance-transfers/useBalanceTransfers";
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
  isPositiveDecimalString,
} from "@/lib/customer-finance";
import { useLocale } from "@/i18n/use-locale";
import { getTransactionConfidenceTone } from "@stealth-trails-bank/ui-foundation";

type InternalTransferCardProps = {
  assets: SupportedAsset[];
  balances: CustomerAssetBalance[];
  isAssetsLoading: boolean;
  isBalancesLoading: boolean;
  assetsErrorMessage: string | null;
  balancesErrorMessage: string | null;
};

const InternalTransferCard = ({
  assets,
  balances,
  isAssetsLoading,
  isBalancesLoading,
  assetsErrorMessage,
  balancesErrorMessage,
}: InternalTransferCardProps) => {
  const { locale } = useLocale();
  const user = useUserStore((state) => state.user);
  const previewRecipient = usePreviewBalanceTransferRecipient();
  const createBalanceTransfer = useCreateBalanceTransfer();
  const startMfaChallenge = useStartCustomerMfaChallenge();
  const verifyMfaChallenge = useVerifyCustomerMfaChallenge();
  const [preferredAssetSymbol, setPreferredAssetSymbol] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] =
    useState<PreviewBalanceTransferRecipientResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [latestTransfer, setLatestTransfer] =
    useState<CreateBalanceTransferResult | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [challengeMethod, setChallengeMethod] = useState<"totp" | "email_otp">(
    "totp"
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
      balances.find((balance) => balance.asset.symbol === selectedAssetSymbol) ??
      null,
    [balances, selectedAssetSymbol]
  );
  const moneyMovementBlocked = user?.mfa?.moneyMovementBlocked ?? true;
  const sessionRequiresVerification =
    user?.sessionSecurity?.currentSessionRequiresVerification ?? false;
  const stepUpFresh =
    Boolean(user?.mfa?.stepUpFreshUntil) &&
    Date.parse(user?.mfa?.stepUpFreshUntil ?? "") > Date.now();
  const latestConfidence = latestTransfer
    ? getIntentConfidenceStatus(latestTransfer.intent.status)
    : null;
  const normalizedRecipientEmail = recipientEmail.trim().toLowerCase();
  const normalizedTransferAmount = transferAmount.trim();
  const availableBalance = selectedBalance?.availableBalance ?? "0";
  const validPositiveAmount = isPositiveDecimalString(normalizedTransferAmount);
  const previewMatchesCurrentInput =
    previewResult?.available === true &&
    previewResult.normalizedEmail === normalizedRecipientEmail &&
    validPositiveAmount;
  const amountExceedsAvailable =
    validPositiveAmount &&
    compareDecimalStrings(normalizedTransferAmount, availableBalance) === 1;
  const canUseMax =
    !isBalancesLoading && compareDecimalStrings(availableBalance, "0") === 1;
  const sendDisabled =
    moneyMovementBlocked ||
    sessionRequiresVerification ||
    !stepUpFresh ||
    !normalizedRecipientEmail ||
    !validPositiveAmount ||
    amountExceedsAvailable ||
    !previewMatchesCurrentInput;

  function resetPreview() {
    setPreviewResult(null);
    setPreviewError(null);
  }

  function handleUseMaxAmount() {
    if (!canUseMax) {
      return;
    }

    setTransferAmount(availableBalance);
    resetPreview();
    setFormError(null);
  }

  function getIdempotencyKey(signature: string): string {
    if (lastSubmissionRef.current?.signature === signature) {
      return lastSubmissionRef.current.idempotencyKey;
    }

    const idempotencyKey = buildRequestIdempotencyKey("internal_transfer_req");
    lastSubmissionRef.current = {
      signature,
      idempotencyKey,
    };
    return idempotencyKey;
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
            : "Failed to start MFA challenge."
        )
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
          locale === "ar" ? "فشل تحقق MFA." : "Failed to verify MFA challenge."
        )
      );
    }
  }

  async function handlePreviewRecipient() {
    if (moneyMovementBlocked) {
      setPreviewError(
        locale === "ar"
          ? "أكمل إعداد MFA أولاً من الملف الشخصي."
          : "Finish MFA setup from the profile page before internal transfers."
      );
      return;
    }

    if (sessionRequiresVerification) {
      setPreviewError(
        locale === "ar"
          ? "تحقق من الجلسة الحالية من صفحة الملف الشخصي أولاً."
          : "Verify the current session from the profile page before internal transfers."
      );
      return;
    }

    try {
      const result = await previewRecipient.mutateAsync({
        email: recipientEmail.trim(),
        assetSymbol: selectedAssetSymbol || undefined,
        amount: transferAmount.trim() || undefined,
      });
      setPreviewResult(result);
      setPreviewError(
        result.available
          ? null
          : locale === "ar"
            ? "هذا البريد غير متاح كعميل نشط للتحويل الداخلي."
            : "That email is not available as an active internal recipient."
      );
    } catch (error) {
      setPreviewResult(null);
      setPreviewError(
        readApiErrorMessage(
          error,
          locale === "ar"
            ? "تعذر التحقق من المستلم."
            : "Failed to verify recipient."
        )
      );
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = recipientEmail.trim();
    const normalizedAmount = normalizedTransferAmount;

    if (moneyMovementBlocked) {
      setFormError(
        locale === "ar"
          ? "أكمل إعداد MFA أولاً من الملف الشخصي."
          : "Finish MFA setup from the profile page before internal transfers."
      );
      return;
    }

    if (sessionRequiresVerification) {
      setFormError(
        locale === "ar"
          ? "تحقق من الجلسة الحالية من صفحة الملف الشخصي قبل التحويل."
          : "Verify the current session from the profile page before transferring."
      );
      return;
    }

    if (!stepUpFresh) {
      setFormError(
        locale === "ar"
          ? "أكمل تحقق MFA جديداً قبل التحويل."
          : "Complete a fresh MFA verification before transferring."
      );
      return;
    }

    if (!selectedAssetSymbol) {
      setFormError(
        locale === "ar" ? "اختر أصلاً أولاً." : "Select an asset first."
      );
      return;
    }

    if (!normalizedEmail) {
      setFormError(
        locale === "ar"
          ? "أدخل بريد المستلم."
          : "Enter the recipient email."
      );
      return;
    }

    if (!isPositiveDecimalString(normalizedAmount)) {
      setFormError(
        locale === "ar"
          ? "أدخل مبلغاً موجباً صالحاً."
          : "Enter a valid positive amount."
      );
      return;
    }

    if (compareDecimalStrings(normalizedAmount, availableBalance) === 1) {
      setFormError(
        locale === "ar"
          ? `المبلغ يتجاوز الرصيد المتاح ${formatTokenAmount(
              availableBalance,
              locale
            )} ${selectedAssetSymbol}.`
          : `Amount exceeds the available balance of ${formatTokenAmount(
              availableBalance,
              locale
            )} ${selectedAssetSymbol}.`
      );
      return;
    }

    if (!previewMatchesCurrentInput) {
      setFormError(
        locale === "ar"
          ? "تحقق من المستلم لهذا البريد والمبلغ أولاً."
          : "Verify the recipient for this email and amount before sending."
      );
      return;
    }

    setFormError(null);

    const requestSignature = JSON.stringify({
      assetSymbol: selectedAssetSymbol,
      amount: normalizedAmount,
      recipientEmail: normalizedEmail.toLowerCase(),
    });

    try {
      const result = await createBalanceTransfer.mutateAsync({
        idempotencyKey: getIdempotencyKey(requestSignature),
        assetSymbol: selectedAssetSymbol,
        amount: normalizedAmount,
        recipientEmail: normalizedEmail,
      });

      setLatestTransfer(result);
      setTransferAmount("");
      setRecipientEmail("");
      resetPreview();
      lastSubmissionRef.current = null;

      toast({
        title:
          locale === "ar"
            ? result.thresholdOutcome === "review_required"
              ? "تم إرسال التحويل للمراجعة"
              : "تمت تسوية التحويل داخلياً"
            : result.thresholdOutcome === "review_required"
              ? "Transfer sent to review"
              : "Transfer settled internally",
        description:
          locale === "ar"
            ? result.thresholdOutcome === "review_required"
              ? "تم حجز الرصيد فوراً وسيظهر التحويل بعد قرار الفريق التشغيلي."
              : "تم نقل الرصيد مباشرة داخل البنك دون سحب إلى الشبكة."
            : result.thresholdOutcome === "review_required"
              ? "The amount is reserved now and will settle after operator approval."
              : "The balance moved instantly inside the bank without a blockchain withdrawal.",
      });
    } catch (error) {
      const message = readApiErrorMessage(
        error,
        locale === "ar"
          ? "تعذر إنشاء التحويل الداخلي."
          : "Failed to create internal transfer."
      );
      setFormError(message);
      toast({
        title:
          locale === "ar"
            ? "فشل التحويل الداخلي"
            : "Internal transfer failed",
        description: message,
        variant: "destructive",
      });
    }
  }

  return (
    <Card className="stb-surface stb-reveal rounded-[2rem] border-0" data-delay="4">
      <CardHeader className="space-y-3">
        <CardTitle className="text-2xl text-slate-950">
          {locale === "ar" ? "تحويل داخلي بالبريد" : "Internal transfer by email"}
        </CardTitle>
        <CardDescription className="max-w-2xl text-sm leading-7 text-slate-600">
          {locale === "ar"
            ? "أرسل رصيداً إلى عميل نشط آخر داخل البنك عبر البريد الإلكتروني فقط. هذا المسار داخلي بالكامل وليس سحباً على الشبكة."
            : "Send balance to another active bank customer using email only. This is an internal ledger transfer, not an on-chain withdrawal."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-[1.5rem] bg-slate-950 p-5 text-white shadow-[0_28px_72px_rgba(10,18,28,0.22)]">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ArrowRightLeft className="h-4 w-4 text-emerald-300" />
            {locale === "ar" ? "مسار التحويل الداخلي" : "Internal transfer flow"}
          </div>
          <div className="mt-4 grid gap-3 text-sm text-white/72 sm:grid-cols-3">
            <div>1. {locale === "ar" ? "تحقق من البريد" : "Verify recipient"}</div>
            <div>2. {locale === "ar" ? "راجع الحد الأمني" : "Check threshold"}</div>
            <div>3. {locale === "ar" ? "أرسل داخلياً" : "Settle internally"}</div>
          </div>
        </div>

        <div className="stb-trust-note p-4 text-slate-700" data-tone="neutral">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <UserRoundSearch className="h-4 w-4" />
            {locale === "ar" ? "خصوصية المستلم" : "Recipient privacy"}
          </div>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {locale === "ar"
              ? "يعرض النظام معاينة مقنّعة فقط للمستلم. إذا تجاوز المبلغ حد الأصل فسيتم حجزه فوراً ثم إرساله إلى مراجعة تشغيلية."
              : "The system reveals only a masked recipient preview. If the amount exceeds the asset threshold, funds are reserved immediately and routed to operator review."}
          </p>
        </div>

        {moneyMovementBlocked ? (
          <div className="stb-trust-note p-4 text-amber-900" data-tone="warning">
            {locale === "ar"
              ? "التحويل الداخلي محجوب حتى يكتمل إعداد MFA من صفحة الملف الشخصي."
              : "Internal transfers stay blocked until MFA setup is complete from the profile page."}
          </div>
        ) : sessionRequiresVerification ? (
          <div className="stb-trust-note p-4 text-amber-900" data-tone="warning">
            {locale === "ar"
              ? "تحقق من هذه الجلسة من صفحة الملف الشخصي قبل إرسال رصيد داخلي."
              : "Verify this session from the profile page before sending an internal transfer."}
          </div>
        ) : !stepUpFresh ? (
          <div className="space-y-4 rounded-[1.5rem] border border-slate-200/70 bg-white/85 p-5">
            <p className="text-sm font-medium text-slate-950">
              {locale === "ar"
                ? "أكمل تحقق MFA جديداً لهذا التحويل"
                : "Complete a fresh MFA verification for this transfer"}
            </p>
            <div className="flex flex-wrap gap-3">
              <LoadingButton
                type="button"
                loading={startMfaChallenge.isPending && challengeMethod === "totp"}
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
                    startMfaChallenge.isPending && challengeMethod === "email_otp"
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
            <label className="text-sm font-medium text-slate-700" htmlFor="transfer-asset">
              {locale === "ar" ? "الأصل" : "Asset"}
            </label>
            <select
              id="transfer-asset"
              className="stb-premium-input"
              value={selectedAssetSymbol}
              disabled={isAssetsLoading || assets.length === 0}
              onChange={(event) => {
                setPreferredAssetSymbol(event.target.value);
                resetPreview();
              }}
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
            <div className="rounded-[1.3rem] border border-slate-200/70 bg-white/85 px-4 py-3 text-sm text-slate-600">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  {locale === "ar" ? "متاح للإرسال:" : "Available to send:"}{" "}
                  <span className="font-semibold text-slate-950">
                    {isBalancesLoading
                      ? (
                        <InlineLoader label={locale === "ar" ? "جارٍ التحميل" : "Loading"} />
                      )
                      : `${formatTokenAmount(availableBalance, locale)} ${selectedAssetSymbol || ""}`.trim()}
                  </span>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
                  disabled={!canUseMax}
                  onClick={handleUseMaxAmount}
                >
                  {locale === "ar" ? "استخدم الحد الأقصى" : "Use max"}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="transfer-email">
                {locale === "ar" ? "بريد المستلم" : "Recipient email"}
              </label>
              <Input
                id="transfer-email"
                placeholder="customer@stealthtrailsbank.com"
                value={recipientEmail}
                onChange={(event) => {
                  setRecipientEmail(event.target.value);
                  resetPreview();
                }}
                className="bg-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="transfer-amount">
                {locale === "ar" ? "المبلغ" : "Amount"}
              </label>
              <Input
                id="transfer-amount"
                placeholder="25"
                value={transferAmount}
                onChange={(event) => {
                  setTransferAmount(event.target.value);
                  resetPreview();
                }}
                className="bg-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <LoadingButton
              type="button"
              loading={previewRecipient.isPending}
              onClick={() => {
                void handlePreviewRecipient();
              }}
              disabled={!recipientEmail.trim()}
            >
              {locale === "ar" ? "تحقق من المستلم" : "Verify recipient"}
            </LoadingButton>
          </div>

          <div
            className="rounded-[1.25rem] border border-slate-200/70 bg-slate-50/90 px-4 py-3 text-sm text-slate-600"
            role="status"
          >
            {previewMatchesCurrentInput
              ? previewResult?.thresholdOutcome === "review_required"
                ? locale === "ar"
                  ? "التحويل جاهز. سيُحجز الرصيد فور الإرسال ثم ينتظر المراجعة التشغيلية."
                  : "Transfer ready. The balance will be reserved immediately on submit and wait for operator review."
                : locale === "ar"
                  ? "التحويل جاهز. سيُسوّى الرصيد داخلياً فور الإرسال."
                  : "Transfer ready. The balance will settle internally immediately on submit."
              : !normalizedRecipientEmail || !normalizedTransferAmount
                ? locale === "ar"
                  ? "أدخل بريد المستلم والمبلغ ثم تحقّق من المستلم قبل الإرسال."
                  : "Enter the recipient email and amount, then verify the recipient before sending."
                : amountExceedsAvailable
                  ? locale === "ar"
                    ? "عدّل المبلغ ليبقى ضمن الرصيد المتاح ثم أعد التحقق."
                    : "Reduce the amount to stay within the available balance, then verify again."
                  : locale === "ar"
                    ? "تحتاج إلى التحقق من المستلم لهذا البريد والمبلغ قبل الإرسال."
                    : "You need to verify the recipient for this email and amount before sending."}
          </div>

          {previewResult?.available ? (
            <div className="space-y-3 rounded-[1.5rem] border border-emerald-200 bg-emerald-50/80 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                <ShieldCheck className="h-4 w-4" />
                {locale === "ar"
                  ? "تم التحقق من المستلم"
                  : "Recipient verified"}
              </div>
              <div className="grid gap-2 text-sm text-emerald-900 sm:grid-cols-2">
                <div>
                  {locale === "ar" ? "الاسم المقنّع:" : "Masked name:"}{" "}
                  <span className="font-semibold">
                    {previewResult.maskedDisplay}
                  </span>
                </div>
                <div>
                  {locale === "ar" ? "البريد المقنّع:" : "Masked email:"}{" "}
                  <span className="font-semibold">
                    {previewResult.maskedEmail}
                  </span>
                </div>
              </div>
              {previewResult.thresholdOutcome ? (
                <div
                  className={`stb-trust-note text-sm ${
                    previewResult.thresholdOutcome === "review_required"
                      ? "text-amber-900"
                      : "text-emerald-900"
                  }`}
                  data-tone={
                    previewResult.thresholdOutcome === "review_required"
                      ? "warning"
                      : "positive"
                  }
                >
                  {previewResult.thresholdOutcome === "review_required"
                    ? locale === "ar"
                      ? "هذا المبلغ سيتحول إلى رصيد معلّق فوراً ثم ينتظر مراجعة تشغيلية قبل التسوية."
                      : "This amount will move into pending balance immediately and wait for operator review before settlement."
                    : locale === "ar"
                      ? "هذا المبلغ يقع تحت حد الأصل وسيتسوى فوراً داخل البنك بعد الإرسال."
                      : "This amount is below the asset threshold and will settle immediately inside the bank once submitted."}
                </div>
              ) : null}
            </div>
          ) : null}

          {assetsErrorMessage ? (
            <div className="stb-trust-note text-sm text-red-700" data-tone="critical">
              {assetsErrorMessage}
            </div>
          ) : null}

          {balancesErrorMessage ? (
            <div className="stb-trust-note text-sm text-red-700" data-tone="critical">
              {balancesErrorMessage}
            </div>
          ) : null}

          {previewError ? (
            <div className="stb-trust-note text-sm text-red-700" data-tone="critical">
              {previewError}
            </div>
          ) : null}

          {formError ? (
            <div className="stb-trust-note text-sm text-red-700" data-tone="critical">
              {formError}
            </div>
          ) : null}

          <LoadingButton
            type="submit"
            className="h-12 w-full rounded-2xl bg-slate-950 text-sm font-semibold text-white hover:bg-slate-900"
            loading={createBalanceTransfer.isPending}
            disabled={sendDisabled}
          >
            {locale === "ar" ? "إرسال التحويل الداخلي" : "Send internal transfer"}
          </LoadingButton>
        </form>

        {latestTransfer ? (
          <div className="stb-section-frame p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {locale === "ar" ? "أحدث تحويل داخلي" : "Latest internal transfer"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {formatTokenAmount(
                    latestTransfer.intent.requestedAmount,
                    locale
                  )}{" "}
                  {latestTransfer.intent.asset.symbol}{" "}
                  {locale === "ar" ? "إلى" : "to"}{" "}
                  {latestTransfer.intent.recipientMaskedEmail ??
                    latestTransfer.intent.recipientMaskedDisplay ??
                    (locale === "ar" ? "عميل داخلي" : "Internal customer")}
                </p>
              </div>
              {latestConfidence ? (
                <StatusBadge
                  label={formatIntentStatusLabel(latestTransfer.intent.status, locale)}
                  tone={getTransactionConfidenceTone(latestConfidence)}
                />
              ) : null}
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <p>
                {locale === "ar" ? "المرجع:" : "Reference:"}{" "}
                <span className="stb-ref font-semibold text-slate-950">
                  {latestTransfer.intent.id}
                </span>
              </p>
              <p>
                {locale === "ar" ? "تم الإنشاء:" : "Created:"}{" "}
                <span className="font-semibold text-slate-950">
                  {formatDateLabel(latestTransfer.intent.createdAt, locale)}
                </span>
              </p>
            </div>
            <div className="mt-4">
              <TimelineList
                events={buildIntentTimeline({
                  id: latestTransfer.intent.id,
                  status: latestTransfer.intent.status,
                  createdAt: latestTransfer.intent.createdAt,
                  updatedAt: latestTransfer.intent.updatedAt,
                  latestBlockchainTransaction: null,
                })}
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default InternalTransferCard;

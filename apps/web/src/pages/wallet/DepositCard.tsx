import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "@/components/ui/use-toast";
import { SupportedAsset } from "@/hooks/assets/useSupportedAssets";
import {
  CreateDepositIntentResult,
  useCreateDepositIntent
} from "@/hooks/transaction-intents/useCreateDepositIntent";
import {
  buildRequestIdempotencyKey,
  formatTokenAmount,
  isPositiveDecimalString
} from "@/lib/customer-finance";
import { useLocale } from "@/i18n/use-locale";
import { useT } from "@/i18n/use-t";
import { readApiErrorMessage } from "@/lib/api";
import { ArrowUpRight, Copy, Loader2, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

type DepositCardProps = {
  walletAddress: string | null;
  assets: SupportedAsset[];
  isAssetsLoading: boolean;
  assetsErrorMessage: string | null;
};

const DepositCard = ({
  walletAddress,
  assets,
  isAssetsLoading,
  assetsErrorMessage
}: DepositCardProps) => {
  const t = useT();
  const { locale } = useLocale();
  const createDepositIntent = useCreateDepositIntent();
  const [showQR, setShowQR] = useState(false);
  const [selectedAssetSymbol, setSelectedAssetSymbol] = useState("");
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [latestRequest, setLatestRequest] =
    useState<CreateDepositIntentResult | null>(null);
  const lastSubmissionRef = useRef<{
    signature: string;
    idempotencyKey: string;
  } | null>(null);

  useEffect(() => {
    if (assets.length > 0 && !selectedAssetSymbol) {
      setSelectedAssetSymbol(assets[0].symbol);
    }
  }, [assets, selectedAssetSymbol]);

  async function handleCopyAddress() {
    if (!walletAddress) {
      return;
    }

    await navigator.clipboard.writeText(walletAddress);

    toast({
      title: locale === "ar" ? "تم نسخ عنوان المحفظة" : "Wallet address copied",
      description:
        locale === "ar"
          ? "تم نسخ عنوان الإيداع المُدار إلى الحافظة."
          : "Managed deposit address copied to your clipboard."
    });
  }

  function getIdempotencyKey(signature: string): string {
    if (lastSubmissionRef.current?.signature === signature) {
      return lastSubmissionRef.current.idempotencyKey;
    }

    const idempotencyKey = buildRequestIdempotencyKey("deposit_req");
    lastSubmissionRef.current = {
      signature,
      idempotencyKey
    };

    return idempotencyKey;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedAmount = amount.trim();

    if (!walletAddress) {
      setFormError(
        locale === "ar"
          ? "عنوان المحفظة المُدارة غير متاح لهذا الحساب."
          : "Managed wallet address is not available for this account."
      );
      return;
    }

    if (!selectedAssetSymbol) {
      setFormError(
        locale === "ar"
          ? "اختر أصلاً قبل إنشاء طلب الإيداع."
          : "Select an asset before creating a deposit request."
      );
      return;
    }

    if (!isPositiveDecimalString(normalizedAmount)) {
      setFormError(
        locale === "ar"
          ? "يجب أن يكون المبلغ قيمة عشرية موجبة حتى 18 منزلة عشرية."
          : "Amount must be a positive decimal string with up to 18 decimal places."
      );
      return;
    }

    setFormError(null);

    const requestSignature = JSON.stringify({
      assetSymbol: selectedAssetSymbol,
      amount: normalizedAmount
    });

    try {
      const result = await createDepositIntent.mutateAsync({
        idempotencyKey: getIdempotencyKey(requestSignature),
        assetSymbol: selectedAssetSymbol,
        amount: normalizedAmount
      });

      setLatestRequest(result);
      setAmount("");
      lastSubmissionRef.current = null;

      toast({
        title: result.idempotencyReused
          ? locale === "ar"
            ? "تمت إعادة استخدام طلب الإيداع"
            : "Deposit request reused"
          : locale === "ar"
            ? "تم إنشاء طلب الإيداع"
            : "Deposit request created",
        description: `${formatTokenAmount(
          result.intent.requestedAmount,
          locale
        )} ${result.intent.asset.symbol} is now recorded in your managed transaction flow.`
      });
    } catch (error) {
      const message = readApiErrorMessage(
        error,
        locale === "ar"
          ? "تعذر إنشاء طلب الإيداع."
          : "Failed to create deposit request."
      );
      setFormError(message);

      toast({
        title: locale === "ar" ? "فشل طلب الإيداع" : "Deposit request failed",
        description: message,
        variant: "destructive"
      });
    }
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowUpRight className="h-5 w-5 text-mint-600" />
          {locale === "ar" ? "إيداع مُدار" : "Managed Deposit"}
        </CardTitle>
        <CardDescription>
          {locale === "ar"
            ? "راجع عنوان الإيداع المُدار وسجل طلب الإيداع قبل توقع وصول الأموال."
            : "Review the managed deposit address and record a deposit request before funds are expected."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border p-4">
          <div className="mb-2 text-sm text-muted-foreground">
            {locale === "ar" ? "عنوان الإيداع المُدار" : "Managed Deposit Address"}
          </div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <code className="rounded bg-mint-50 px-2 py-1 text-sm break-all">
              {walletAddress ? walletAddress : "No managed wallet assigned yet."}
            </code>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!walletAddress}
                onClick={handleCopyAddress}
              >
                <Copy className="h-4 w-4" />
                {locale === "ar" ? "نسخ" : "Copy"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!walletAddress}
                onClick={() => setShowQR((current) => !current)}
              >
                <QrCode className="h-4 w-4" />
                {showQR
                  ? locale === "ar"
                    ? "إخفاء الرمز"
                    : "Hide QR"
                  : locale === "ar"
                    ? "إظهار الرمز"
                    : "Show QR"}
              </Button>
            </div>
          </div>

          {showQR && walletAddress ? (
            <div className="mt-4 flex justify-center">
              <QRCodeSVG
                value={walletAddress}
                size={160}
                bgColor="#FFFFFF"
                fgColor="#000000"
                level="H"
              />
            </div>
          ) : null}
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="deposit-asset">
              {locale === "ar" ? "الأصل" : "Asset"}
            </label>
            <select
              id="deposit-asset"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={selectedAssetSymbol}
              disabled={isAssetsLoading || assets.length === 0}
              onChange={(event) => setSelectedAssetSymbol(event.target.value)}
            >
              {assets.length === 0 ? (
                <option value="">
                  {isAssetsLoading ? "Loading assets..." : "No supported assets"}
                </option>
              ) : null}
              {assets.map((asset) => (
                <option key={asset.id} value={asset.symbol}>
                  {asset.displayName} ({asset.symbol})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="deposit-amount">
              {locale === "ar" ? "المبلغ" : "Amount"}
            </label>
            <Input
              id="deposit-amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {locale === "ar"
                ? "يسجل هذا الطلب إيداعاً وارداً متوقعاً لمراجعة مُدارة. ولا يبث معاملة على السلسلة من هذا المتصفح."
                : "This request records an expected inbound deposit for managed review. It does not broadcast a blockchain transaction from this browser."}
            </p>
          </div>

          {assetsErrorMessage ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {assetsErrorMessage}
            </div>
          ) : null}

          {formError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          ) : null}

          <LoadingButton
            type="submit"
            className="w-full"
            loading={createDepositIntent.isPending}
            disabled={!walletAddress || isAssetsLoading || assets.length === 0}
          >
            {locale === "ar" ? "إنشاء طلب إيداع" : "Create Deposit Request"}
          </LoadingButton>
        </form>

        {latestRequest ? (
          <div className="rounded-lg border border-mint-200 bg-mint-50/60 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <p className="font-medium text-foreground">
                {locale === "ar" ? "أحدث طلب إيداع" : "Latest deposit request"}
              </p>
              <span className="rounded-full bg-mint-100 px-2 py-1 text-xs font-medium text-mint-700">
                {latestRequest.intent.status}
              </span>
            </div>
            <p className="mt-2 text-muted-foreground">
              {formatTokenAmount(latestRequest.intent.requestedAmount, locale)}{" "}
              {latestRequest.intent.asset.symbol} for wallet{" "}
              {latestRequest.intent.destinationWalletAddress ?? "N/A"}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              Request ID: {latestRequest.intent.id}
            </p>
          </div>
        ) : null}

        {isAssetsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {locale === "ar" ? "جاري تحميل الأصول المدعومة..." : "Loading supported assets..."}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default DepositCard;

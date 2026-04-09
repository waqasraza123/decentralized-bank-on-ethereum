import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Clock3,
  Landmark,
  Wallet
} from "lucide-react";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { useLocale } from "@/i18n/use-locale";
import { useT } from "@/i18n/use-t";
import { useMyBalances } from "@/hooks/balances/useMyBalances";
import {
  useMyTransactionHistory,
  type TransactionHistoryIntent
} from "@/hooks/transactions/useMyTransactionHistory";
import {
  formatDateLabel,
  formatIntentAmount,
  formatIntentStatusLabel,
  formatShortAddress,
  formatTokenAmount,
  normalizeIntentTypeLabel,
  resolveIntentAddress
} from "@/lib/customer-finance";
import { useUserStore } from "@/stores/userStore";

function hasPendingBalance(value: string): boolean {
  return Number(value) > 0;
}

function mapRecentTransactions(intents: TransactionHistoryIntent[] | undefined) {
  if (!intents) {
    return [];
  }

  return intents.slice(0, 5).map((intent) => ({
    id: intent.id,
    type: normalizeIntentTypeLabel(intent.intentType),
    amount: formatIntentAmount(
      intent.settledAmount ?? intent.requestedAmount,
      intent.asset.symbol,
      intent.intentType
    ),
    date: formatDateLabel(intent.createdAt),
    status: intent.status,
    address: formatShortAddress(resolveIntentAddress(intent))
  }));
}

const Index = () => {
  const t = useT();
  const { locale } = useLocale();
  const user = useUserStore((state) => state.user);
  const balancesQuery = useMyBalances();
  const historyQuery = useMyTransactionHistory(5);

  const balances = balancesQuery.data?.balances ?? [];
  const pendingAssetCount = balances.filter((balance) =>
    hasPendingBalance(balance.pendingBalance)
  ).length;
  const recentTransactions = (historyQuery.data?.intents ?? []).slice(0, 5).map((intent) => ({
    id: intent.id,
    type: normalizeIntentTypeLabel(intent.intentType, locale),
    amount: formatIntentAmount(
      intent.settledAmount ?? intent.requestedAmount,
      intent.asset.symbol,
      intent.intentType,
      locale
    ),
    date: formatDateLabel(intent.createdAt, locale),
    status: intent.status,
    statusLabel: formatIntentStatusLabel(intent.status, locale),
    address: formatShortAddress(resolveIntentAddress(intent), t("shared.notAvailable"))
  }));

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-foreground">{t("dashboard.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {user?.firstName
                ? t("dashboard.descriptionWithName", { name: user.firstName })
                : t("dashboard.description")}
            </p>
          </div>
          <Button asChild className="bg-apple-blue hover:bg-apple-blue/90">
            <Link to="/transactions">
              <Activity className="h-4 w-4" />
              <span>{t("dashboard.viewHistory")}</span>
            </Link>
          </Button>
        </div>

        <Card className="glass-card overflow-hidden">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Wallet className="h-4 w-4 text-mint-700" />
                {t("dashboard.managedWallet")}
              </div>
              <div className="rounded-2xl border border-border/70 bg-white/60 p-4">
                <p className="ltr-content break-all font-mono text-sm text-foreground">
                  <bdi>{user?.ethereumAddress ?? t("layout.noWallet")}</bdi>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("dashboard.walletDescription")}
                </p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-border/70 bg-white/60 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Landmark className="h-4 w-4" />
                  {t("dashboard.assetsTracked")}
                </div>
                <p className="mt-3 text-2xl font-semibold text-foreground">
                  {balancesQuery.isLoading ? "..." : balances.length}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-white/60 p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock3 className="h-4 w-4" />
                  {t("dashboard.pendingAssets")}
                </div>
                <p className="mt-3 text-2xl font-semibold text-foreground">
                  {balancesQuery.isLoading ? "..." : pendingAssetCount}
                </p>
              </div>
              <Button asChild variant="outline" className="h-auto justify-between rounded-2xl px-4 py-4">
                <Link to="/wallet">
                  {t("dashboard.openWalletActions")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </Card>

        {balancesQuery.isError ? (
          <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {balancesQuery.error instanceof Error
              ? balancesQuery.error.message
              : t("dashboard.loadBalancesError")}
          </Card>
        ) : balancesQuery.isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="glass-card p-6">
                <div className="space-y-4">
                  <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                  <div className="h-8 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                </div>
              </Card>
            ))}
          </div>
        ) : balances.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {balances.map((balance) => (
              <BalanceCard
                key={balance.asset.id}
                title={balance.asset.displayName}
                amount={`${formatTokenAmount(balance.availableBalance, locale)} ${balance.asset.symbol}`}
                subAmount={
                  hasPendingBalance(balance.pendingBalance)
                    ? `${formatTokenAmount(balance.pendingBalance, locale)} ${balance.asset.symbol} ${t("dashboard.pendingSuffix")}`
                    : t("dashboard.noPendingBalance")
                }
                icon={hasPendingBalance(balance.pendingBalance) ? Clock3 : Landmark}
                tone={hasPendingBalance(balance.pendingBalance) ? "warning" : "positive"}
                footer={t("dashboard.updatedPrefix", {
                  date: formatDateLabel(balance.updatedAt, locale)
                })}
              />
            ))}
          </div>
        ) : (
          <Card className="glass-card p-6">
            <h2 className="text-lg font-semibold text-foreground">{t("dashboard.noBalancesTitle")}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("dashboard.noBalancesDescription")}
            </p>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <RecentTransactions
            transactions={recentTransactions}
            isLoading={historyQuery.isLoading}
            errorMessage={
              historyQuery.isError
                ? historyQuery.error instanceof Error
                  ? historyQuery.error.message
                  : t("dashboard.historyError")
                : null
            }
            emptyMessage={t("dashboard.emptyHistory")}
          />
        </div>
      </div>
    </Layout>
  );
};

export default Index;

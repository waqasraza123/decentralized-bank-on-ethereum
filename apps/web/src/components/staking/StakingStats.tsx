import { Card } from "@/components/ui/card";
import { ArrowUpRight, Timer, ArrowDownRight } from "lucide-react";
import { CustomerStakingPoolSnapshot } from "@/hooks/staking/useMyStakingSnapshot";
import { useLocale } from "@/i18n/use-locale";
import { useT } from "@/i18n/use-t";
import { formatTokenAmount } from "@/lib/customer-finance";

type StakingStatsProps = {
  pools: CustomerStakingPoolSnapshot[];
};

function sumDecimalStrings(values: string[]): string {
  const total = values.reduce((sum, value) => sum + Number(value), 0);
  return total.toString();
}

export const StakingStats = ({ pools }: StakingStatsProps) => {
  const { locale } = useLocale();
  const t = useT();
  const totalStaked = sumDecimalStrings(pools.map((pool) => pool.totalStakedAmount));
  const totalRewardsPaid = sumDecimalStrings(
    pools.map((pool) => pool.totalRewardsPaid)
  );
  const averageApr =
    pools.length > 0
      ? (
          pools.reduce((sum, pool) => sum + Number(pool.rewardRate), 0) /
          pools.length
        ).toFixed(2)
      : "0.00";
  const activePoolCount = pools.filter((pool) => pool.poolStatus === "active").length;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t("staking.stats.totalStaked")}</p>
            <h3 className="text-2xl font-semibold">
              {formatTokenAmount(totalStaked, locale, 4)} ETH
            </h3>
            <p className="text-sm text-mint-600">{t("staking.stats.totalStakedDetail")}</p>
          </div>
          <div className="rounded-full bg-mint-100 p-2">
            <ArrowUpRight className="h-5 w-5 text-mint-700" />
          </div>
        </div>
      </Card>

      <Card className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t("staking.stats.averageApr")}</p>
            <h3 className="text-2xl font-semibold">{averageApr}%</h3>
            <p className="text-sm text-mint-600">
              {activePoolCount === 1
                ? t("staking.stats.activePools", { count: activePoolCount })
                : t("staking.stats.activePoolsPlural", { count: activePoolCount })}
            </p>
          </div>
          <div className="rounded-full bg-mint-100 p-2">
            <Timer className="h-5 w-5 text-mint-700" />
          </div>
        </div>
      </Card>

      <Card className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{t("staking.stats.rewardsPaid")}</p>
            <h3 className="text-2xl font-semibold">
              {formatTokenAmount(totalRewardsPaid, locale, 4)} ETH
            </h3>
            <p className="text-sm text-mint-600">{t("staking.stats.rewardsPaidDetail")}</p>
          </div>
          <div className="rounded-full bg-mint-100 p-2">
            <ArrowDownRight className="h-5 w-5 text-mint-700" />
          </div>
        </div>
      </Card>
    </div>
  );
};

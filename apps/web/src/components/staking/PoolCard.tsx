import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Timer, AlertCircle, XCircle } from "lucide-react";
import { useLocale } from "@/i18n/use-locale";
import { useT } from "@/i18n/use-t";
import { cn } from "@/lib/utils";
import { formatTokenAmount } from "@/lib/customer-finance";
import {
  CustomerStakingPoolSnapshot
} from "@/hooks/staking/useMyStakingSnapshot";

interface PoolCardProps {
  pool: CustomerStakingPoolSnapshot;
  onSelect: (pool: CustomerStakingPoolSnapshot) => void;
  isSelected: boolean;
}

export const PoolCard = ({ pool, onSelect, isSelected }: PoolCardProps) => {
  const { locale } = useLocale();
  const t = useT();

  const getStatusIcon = (status: CustomerStakingPoolSnapshot["poolStatus"]) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'paused':
        return <Timer className="h-4 w-4 text-yellow-500" />;
      case 'disabled':
      case 'closed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (
    status: CustomerStakingPoolSnapshot["poolStatus"]
  ) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500';
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'disabled':
      case 'closed':
        return 'bg-red-500/10 text-red-500';
      default:
        return 'bg-gray-500/10 text-gray-500';
    }
  };

  return (
    <Card
      className={cn(
        "p-4 transition-all hover:shadow-lg cursor-pointer animate-in",
        isSelected && "border-mint-500"
      )}
      onClick={() => onSelect(pool)}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold">
              {t("staking.poolCard.title", { id: pool.id })}
            </h3>
            <Badge variant="outline" className={cn("ml-2", getStatusColor(pool.poolStatus))}>
              <span className="flex items-center gap-1">
                {getStatusIcon(pool.poolStatus)}
                {pool.poolStatus}
              </span>
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>{t("staking.poolCard.rewardRate", { value: pool.rewardRate })}</p>
            <p>{t("staking.poolCard.totalStaked", { value: formatTokenAmount(pool.totalStakedAmount, locale, 4) })}</p>
            <p>{t("staking.poolCard.rewardsPaid", { value: formatTokenAmount(pool.totalRewardsPaid, locale, 4) })}</p>
            <p>{t("staking.poolCard.yourStake", { value: formatTokenAmount(pool.position.stakedBalance, locale, 4) })}</p>
            <p>{t("staking.poolCard.pendingRewards", { value: formatTokenAmount(pool.position.pendingReward, locale, 4) })}</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="ml-4"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(pool);
          }}
        >
          {t("staking.poolCard.viewPool")}
        </Button>
      </div>
    </Card>
  );
};

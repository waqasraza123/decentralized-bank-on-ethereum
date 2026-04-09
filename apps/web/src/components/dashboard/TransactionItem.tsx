import { getIntentStatusTextTone } from "@/lib/customer-finance";
import { useLocale } from "@/i18n/use-locale";

interface TransactionItemProps {
  id: string;
  type: string;
  amount: string;
  date: string;
  status: string;
  statusLabel?: string;
  address?: string;
}

export const TransactionItem = ({
  type,
  amount,
  date,
  status,
  statusLabel,
  address
}: TransactionItemProps) => {
  const { isRtl } = useLocale();

  return (
    <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-mint-50/50">
      <div className="space-y-1">
        <p className="font-medium">{type}</p>
        <p className="text-sm text-muted-foreground">{date}</p>
        {address ? (
          <p className="ltr-content font-mono text-xs text-muted-foreground">
            <bdi>{address}</bdi>
          </p>
        ) : null}
      </div>
      <div className={isRtl ? "text-left" : "text-right"}>
        <p className="font-medium">{amount}</p>
        <p className={`text-sm ${getIntentStatusTextTone(status)}`}>
          {statusLabel ?? status}
        </p>
      </div>
    </div>
  );
};

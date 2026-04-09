import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useT } from "@/i18n/use-t";
import { useMyBalances } from "@/hooks/balances/useMyBalances";
import { useSupportedAssets } from "@/hooks/assets/useSupportedAssets";
import DepositCard from "./wallet/DepositCard";
import WithdrawCard from "./wallet/WithdrawCard";
import { useUserStore } from "@/stores/userStore";

const Wallet = () => {
  const t = useT();
  const user = useUserStore((state) => state.user);
  const supportedAssetsQuery = useSupportedAssets();
  const balancesQuery = useMyBalances();

  return (
    <Layout>
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">
            {t("wallet.title")}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {t("wallet.description")}{" "}
            <Link className="font-medium text-foreground underline" to="/transactions">
              {t("wallet.historyLink")}
            </Link>
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <DepositCard
            walletAddress={user?.ethereumAddress ?? null}
            assets={supportedAssetsQuery.data?.assets ?? []}
            isAssetsLoading={supportedAssetsQuery.isLoading}
            assetsErrorMessage={
              supportedAssetsQuery.isError
                ? supportedAssetsQuery.error instanceof Error
                  ? supportedAssetsQuery.error.message
                  : t("wallet.supportedAssetsError")
                : null
            }
          />
          <WithdrawCard
            walletAddress={user?.ethereumAddress ?? null}
            assets={supportedAssetsQuery.data?.assets ?? []}
            balances={balancesQuery.data?.balances ?? []}
            isAssetsLoading={supportedAssetsQuery.isLoading}
            isBalancesLoading={balancesQuery.isLoading}
            assetsErrorMessage={
              supportedAssetsQuery.isError
                ? supportedAssetsQuery.error instanceof Error
                  ? supportedAssetsQuery.error.message
                  : t("wallet.supportedAssetsError")
                : null
            }
            balancesErrorMessage={
              balancesQuery.isError
                ? balancesQuery.error instanceof Error
                  ? balancesQuery.error.message
                  : t("wallet.balancesError")
                : null
            }
          />
        </div>

        <Card className="glass-card p-6">
          <h2 className="text-xl font-semibold text-foreground">
            {t("wallet.notesTitle")}
          </h2>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>{t("wallet.noteOne")}</p>
            <p>{t("wallet.noteTwo")}</p>
            <p>{t("wallet.noteThree")}</p>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default Wallet;

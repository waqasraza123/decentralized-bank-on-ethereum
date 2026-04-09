import { Link } from "react-router-dom";
import { ArrowLeft, Shield, ShieldAlert } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useT } from "@/i18n/use-t";

const CreatePool = () => {
  const t = useT();

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-apple-blue">
            {t("createPool.title")}
          </h1>
          <Button asChild variant="outline">
            <Link to="/staking">
              <ArrowLeft className="h-4 w-4" />
              {t("createPool.backToStaking")}
            </Link>
          </Button>
        </div>

        <Alert className="border-apple-blue bg-apple-soft-blue">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>{t("createPool.alertTitle")}</AlertTitle>
          <AlertDescription>
            {t("createPool.alertDescription")}
          </AlertDescription>
        </Alert>

        <Card className="glass-card mx-auto max-w-3xl p-8">
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 text-mint-700" />
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {t("createPool.unavailableTitle")}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("createPool.unavailableDescription")}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-foreground">
                  {t("createPool.governanceBoundary")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("createPool.governanceBoundaryDescription")}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-foreground">
                  {t("createPool.contractExecution")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("createPool.contractExecutionDescription")}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-foreground">
                  {t("createPool.operationalSafety")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("createPool.operationalSafetyDescription")}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              {t("createPool.footnote")}
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default CreatePool;

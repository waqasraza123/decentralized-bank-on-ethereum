import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { useLocale } from "@/i18n/use-locale";

const CreatePool = () => {
  const { locale } = useLocale();

  return (
    <Layout>
      <Card className="stb-surface rounded-[2rem] border-0 p-6">
        <h1 className="stb-page-title text-3xl font-semibold text-slate-950">
          {locale === "ar" ? "حوكمة المجمع" : "Pool governance"}
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          {locale === "ar"
            ? "هذا مسار داخلي فقط. يعتمد إنشاء المجمعات حالياً على عمليات كتابة خاضعة للحوكمة ومتحكم بها من الخلفية."
            : "This is an internal-only workflow. Pool creation currently depends on governed, backend-controlled contract writes."}
        </p>
      </Card>
    </Layout>
  );
};

export default CreatePool;

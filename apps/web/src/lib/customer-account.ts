import { type SupportedLocale } from "@stealth-trails-bank/i18n";
import type {
  AccountLifecycleStatusValue,
  UserProfileProjection
} from "@stealth-trails-bank/types";

const accountStatusLabels: Record<AccountLifecycleStatusValue, string> = {
  registered: "Registered",
  email_verified: "Email Verified",
  review_required: "Review Required",
  active: "Active",
  restricted: "Restricted",
  frozen: "Frozen",
  closed: "Closed"
};

export function formatAccountStatusLabel(
  status: AccountLifecycleStatusValue | null | undefined,
  locale: SupportedLocale = "en"
): string {
  if (!status) {
    return locale === "ar" ? "غير مهيأ" : "Not Provisioned";
  }

  if (locale === "ar") {
    const arabicLabels: Record<AccountLifecycleStatusValue, string> = {
      registered: "مسجل",
      email_verified: "تم التحقق من البريد",
      review_required: "تتطلب مراجعة",
      active: "نشط",
      restricted: "مقيد",
      frozen: "مجمّد",
      closed: "مغلق"
    };

    return arabicLabels[status];
  }

  return accountStatusLabels[status];
}

export function getAccountStatusBadgeTone(
  status: AccountLifecycleStatusValue | null | undefined
): string {
  if (!status) {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  if (status === "active" || status === "email_verified") {
    return "border-mint-200 bg-mint-100 text-mint-700";
  }

  if (status === "registered" || status === "review_required") {
    return "border-orange-200 bg-orange-100 text-orange-700";
  }

  if (status === "restricted" || status === "frozen" || status === "closed") {
    return "border-red-200 bg-red-100 text-red-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-700";
}

export function getAccountStatusSummary(
  status: AccountLifecycleStatusValue | null | undefined,
  locale: SupportedLocale = "en"
): string {
  if (!status) {
    return locale === "ar"
      ? "لم تتم تهيئة بيانات دورة حياة حساب العميل بعد."
      : "Customer account lifecycle data has not been provisioned yet.";
  }

  if (locale === "ar") {
    switch (status) {
      case "active":
        return "هذا الحساب المُدار نشط ويمكنه استخدام مسارات العميل المعلنة حالياً.";
      case "email_verified":
        return "الهوية موجودة، لكن دورة حياة الحساب المُدار لم تصل إلى حالة النشاط الكامل بعد.";
      case "review_required":
        return "نشاط العميل مقيّد بمراجعة داخلية إضافية قبل توسيع الوصول إلى المنتج.";
      case "restricted":
        return "الحساب خاضع لتقييد وقد تُحجب بعض إجراءات المنتج بموجب السياسة.";
      case "frozen":
        return "الحساب مجمّد ويجب اعتبار الإجراءات المالية من جهة العميل غير متاحة.";
      case "closed":
        return "الحساب مغلق ولا ينبغي أن يعرض عناصر تحكم نشطة للمنتج.";
      case "registered":
      default:
        return "تم تسجيل الحساب لكنه ما زال يمر عبر دورة حياة الحساب المُدار.";
    }
  }

  switch (status) {
    case "active":
      return "This managed account is active and can use the currently released customer flows.";
    case "email_verified":
      return "Identity exists, but the managed account lifecycle has not reached full active status yet.";
    case "review_required":
      return "Customer activity is gated behind additional internal review before broader product access is released.";
    case "restricted":
      return "The account is under restriction and some product actions may be withheld by policy.";
    case "frozen":
      return "The account is frozen and customer-side financial actions should be treated as unavailable.";
    case "closed":
      return "The account is closed and should not present active product controls.";
    case "registered":
    default:
      return "The account has been registered but is still moving through the managed-account lifecycle.";
  }
}

export function getAccountLifecycleEntries(
  profile: Pick<
    UserProfileProjection,
    "activatedAt" | "restrictedAt" | "frozenAt" | "closedAt"
  >,
  locale: SupportedLocale = "en"
) {
  return [
    {
      label: locale === "ar" ? "تم التفعيل" : "Activated",
      value: profile.activatedAt
    },
    {
      label: locale === "ar" ? "تم التقييد" : "Restricted",
      value: profile.restrictedAt
    },
    {
      label: locale === "ar" ? "تم التجميد" : "Frozen",
      value: profile.frozenAt
    },
    {
      label: locale === "ar" ? "تم الإغلاق" : "Closed",
      value: profile.closedAt
    }
  ].filter((entry) => Boolean(entry.value));
}

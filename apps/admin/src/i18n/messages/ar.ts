import type { AdminMessages } from "./en";

export const adminMessagesAr: AdminMessages = {
  locale: {
    switcherLabel: "اللغة",
    english: "English",
    arabic: "العربية"
  },
  hero: {
    eyebrow: "بنك ستيلث تريلز",
    title: "وحدة تحكم المشغل",
    description:
      "طوابير المراجعة الداخلية وحوادث الإشراف وقيود الحسابات ومسارات إصدار حزم الحوادث الخاضعة للحوكمة في واجهة واحدة.",
    sessionActive: "جلسة المشغل نشطة",
    credentialsRequired: "المعلومات الاعتمادية مطلوبة",
    baseUrl: "عنوان القاعدة"
  },
  flash: {
    updated: "تم التحديث.",
    blocked: "مرفوض."
  },
  credentials: {
    kicker: "بيانات اعتماد المشغل",
    title: "جلسة محلية",
    description:
      "تستخدم وحدة المشغل الآن رمز وصول Supabase بصيغة Bearer. يُحفَظ عنوان API فقط في التخزين المحلي، بينما يبقى رمز الوصول ضمن الجلسة الحالية وتُحسم هوية المشغل من الخادم.",
    apiBaseUrl: "عنوان API الأساسي",
    operatorAccessToken: "رمز وصول المشغل",
    saveSession: "حفظ الجلسة",
    clearSession: "مسح الجلسة"
  },
  sections: {
    alertDelivery: "تسليم التنبيهات",
    deliveryTargetHealth: "سلامة وجهات التسليم",
    releaseReadinessEvidence: "أدلة جاهزية الإطلاق",
    platformHealth: "سلامة المنصة",
    treasuryVisibility: "رؤية الخزينة",
    ledgerReconciliation: "مطابقة الدفتر",
    platformAuditLog: "سجل تدقيق المنصة",
    routeCriticalAlerts: "توجيه التنبيهات الحرجة"
  },
  misc: {
    notAvailable: "غير متاح",
    unknown: "غير معروف",
    open: "مفتوح",
    unnamedSubject: "عنصر غير مسمى"
  }
};

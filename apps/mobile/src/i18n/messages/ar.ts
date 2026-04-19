import type { MobileMessages } from "./en";

export const mobileMessagesAr: MobileMessages = {
  common: {
    loading: "جاري تحميل مساحة العمل",
    retry: "إعادة المحاولة",
    save: "حفظ",
    cancel: "إلغاء",
    reset: "إعادة ضبط التطبيق",
    enabled: "مفعّل",
    disabled: "معطّل",
    notAvailable: "غير متاح",
    close: "إغلاق",
    signOut: "تسجيل الخروج",
    open: "فتح",
    noData: "لا توجد بيانات بعد.",
    somethingWentWrong: "حدث خطأ غير متوقع",
    crashRecovery:
      "واجه التطبيق خطأً أثناء التشغيل. أعد ضبط واجهة التطبيق ثم حاول مرة أخرى.",
    requiredField: "أكمل جميع الحقول المطلوبة قبل المتابعة."
  },
  locale: {
    label: "اللغة",
    english: "English",
    arabic: "العربية"
  },
  navigation: {
    dashboard: "لوحة التحكم",
    wallet: "المحفظة",
    yield: "العائد",
    transactions: "المعاملات",
    profile: "الملف الشخصي",
    loans: "القروض المُدارة"
  },
  auth: {
    signInTitle: "سجّل الدخول إلى حسابك المُدار",
    signInDescription:
      "راجع الأرصدة، وتابع حركة الأموال، وتصرّف عبر مسارات إيثيريوم الخاضعة للحوكمة.",
    signUpTitle: "أنشئ حساباً مُداراً آمناً",
    signUpDescription:
      "ابدأ ملفك الشخصي للوصول إلى المحفظة المُدارة والمنتجات ومسارات المعاملات الخاضعة للمراجعة.",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    currentPassword: "كلمة المرور الحالية",
    newPassword: "كلمة المرور الجديدة",
    confirmPassword: "تأكيد كلمة المرور الجديدة",
    firstName: "الاسم الأول",
    lastName: "اسم العائلة",
    signIn: "تسجيل الدخول",
    signUp: "إنشاء الحساب",
    switchToSignUp: "إنشاء حساب",
    switchToSignIn: "لديك حساب بالفعل؟",
    demoFill: "استخدم بيانات العرض المشتركة",
    sessionExpired: "انتهت الجلسة. سجّل الدخول مرة أخرى.",
    emailInvalid: "أدخل بريداً إلكترونياً صالحاً.",
    passwordTooShort: "يجب أن تتكون كلمة المرور من 8 أحرف على الأقل."
  },
  dashboard: {
    title: "نظرة عامة على الأموال المُدارة",
    description:
      "عرض واضح للأرصدة والحركة المعلقة والخطوة التالية المهمة.",
    availableAssets: "الأصول المتتبعة",
    pendingAssets: "الأصول المعلقة",
    moneyMovement: "حركة الأموال",
    recentActivity: "النشاط الأخير",
    viewHistory: "عرض السجل",
    latestSnapshotStale:
      "آخر لقطة تشغيلية أقدم من المتوقع. راجع حركة الأموال المعلقة أو أعد التحديث إذا استمر التأخير.",
    latestSnapshotFresh:
      "الأرصدة وحالة المعاملات ضمن نافذة التشغيل المتوقعة.",
    noRecentActivity: "لم يتم تسجيل سجل معاملات لهذا الحساب بعد.",
    managedWallet: "المحفظة المُدارة"
  },
  wallet: {
    title: "الإيداع والسحب",
    description:
      "استخدم المسارات المُدارة لتسجيل الإيداعات وحجز السحوبات ومتابعة كل طلب عبر حالة واضحة.",
    balances: "الأرصدة",
    supportedAssets: "الأصول المدعومة",
    fundedAssets: "الأصول الممولة",
    walletReference: "مرجع المحفظة",
    deposit: "إيداع",
    withdraw: "سحب",
    asset: "الأصل",
    amount: "المبلغ",
    destinationAddress: "عنوان الوجهة",
    copy: "نسخ",
    showQr: "إظهار الرمز",
    hideQr: "إخفاء الرمز",
    createDepositRequest: "إنشاء طلب إيداع",
    createWithdrawalRequest: "إنشاء طلب سحب",
    latestDepositRequest: "أحدث طلب إيداع",
    latestWithdrawalRequest: "أحدث طلب سحب",
    createdAt: "تاريخ الإنشاء",
    reference: "المرجع",
    noWallet: "لا توجد محفظة مُدارة مخصصة بعد.",
    depositAddressCopied: "تم نسخ عنوان الإيداع.",
    selectAsset: "اختر أصلاً قبل المتابعة.",
    amountInvalid: "أدخل مبلغاً موجباً بصيغة عشرية صالحة.",
    destinationInvalid: "عنوان الوجهة يجب أن يكون عنوان EVM صالحاً.",
    selfAddressInvalid: "يجب أن يختلف عنوان الوجهة عن عنوان محفظتك المُدارة.",
    insufficientBalance: "المبلغ المطلوب يتجاوز الرصيد المتاح.",
    depositRecorded: "تم تسجيل طلب الإيداع.",
    depositReviewRecorded: "تم تسجيل طلب الإيداع وتحويله إلى مراجعة تشغيلية.",
    depositSecurityNote:
      "لا يتم اعتماد الإيداعات إلا بعد رصد المحفظة المُدارة وتأكيد السلسلة وإتمام التسوية وفق السياسات. قد تتوقف الإيداعات الكبيرة أو غير المعتادة لمراجعة تشغيلية.",
    depositReviewStatusNote:
      "هذا الإيداع متوقف حالياً للمراجعة التشغيلية قبل متابعة التنفيذ أو التسوية النهائية.",
    withdrawalRecorded: "تم تسجيل طلب السحب.",
    reservationNote:
      "طلبات السحب تنقل المبلغ المطلوب من المتاح إلى المعلق مباشرة أثناء استمرار المراجعة."
  },
  transactions: {
    title: "سجل المعاملات",
    description:
      "راجع حالة الطلب والمراجع وتفاصيل التنفيذ على السلسلة عندما تكون متاحة.",
    searchPlaceholder: "ابحث بالمرجع أو المبلغ أو الأصل أو العنوان",
    allTypes: "كل الأنواع",
    allStatuses: "كل الحالات",
    details: "التفاصيل",
    internalReference: "المرجع الداخلي",
    address: "العنوان",
    chainHash: "هاش السلسلة",
    empty: "لا توجد معاملات تطابق عوامل التصفية الحالية."
  },
  profile: {
    title: "الحساب والأمان",
    status: "حالة دورة الحياة",
    managedWallet: "المحفظة المُدارة",
    productChainAddress: "عنوان سلسلة المنتج",
    passwordManagement: "إدارة كلمة المرور",
    notifications: "تفضيلات البريد الإلكتروني",
    accountIdentity: "هوية الحساب",
    customerId: "معرف العميل",
    supabaseUserId: "معرف Supabase",
    updatePassword: "تحديث كلمة المرور",
    passwordUpdated: "تم تحديث كلمة المرور بنجاح.",
    passwordsMustMatch: "يجب أن تتطابق كلمتا المرور.",
    savePreferences: "حفظ التفضيلات",
    preferencesSaved: "تم حفظ تفضيلات الإشعارات.",
    activatedAt: "تم التفعيل",
    restrictedAt: "تم التقييد",
    deposits: "رسائل الإيداع",
    withdrawals: "رسائل السحب",
    loans: "رسائل القروض",
    productUpdates: "تحديثات المنتج",
    preferencesUnavailable: "تفضيلات الإشعارات غير متاحة لهذا الملف بعد."
  },
  yield: {
    title: "وضع العائد والاستيكينغ",
    description:
      "يبقى التنفيذ خاضعاً للحوكمة. راجع الأهلية ووضع نموذج القراءة وحالة المجمع قبل أي إجراء.",
    pools: "المجمعات",
    payoutWallet: "محفظة الدفع",
    execution: "التنفيذ",
    deposit: "إيداع في الاستيكينغ",
    withdraw: "سحب من الاستيكينغ",
    claimReward: "تحصيل المكافأة",
    emergencyWithdraw: "سحب طارئ",
    pendingReward: "المكافأة المعلقة",
    totalStaked: "إجمالي المبلغ المستثمر",
    rewardsPaid: "المكافآت المدفوعة",
    executionEnabled: "مفعّل",
    executionPolicyGated: "مقيّد بالسياسات",
    poolLabel: "المجمع",
    readModelLimited: "قراءات المراكز الحية محدودة حالياً.",
    noPools: "لا توجد مجمعات استيكينغ متاحة حالياً."
  },
  loans: {
    title: "القروض المُدارة",
    description:
      "راجع الأهلية، واعرض التسعير، وقدّم الطلبات الخاضعة للحوكمة، وراقب الاتفاقيات النشطة.",
    borrowingCapacity: "سعة الاقتراض",
    policyPacks: "حزم السياسات",
    borrowAmount: "مبلغ الاقتراض",
    collateralAmount: "مبلغ الضمان",
    termMonths: "مدة القرض بالأشهر",
    quotePreview: "معاينة التسعير",
    submitApplication: "إرسال الطلب",
    applicationSubmitted: "تم إرسال الطلب.",
    autopay: "الدفع التلقائي",
    supportNote: "ملاحظة الدعم",
    activeAgreements: "الاتفاقيات النشطة",
    outstandingTotal: "إجمالي المستحق",
    nextDue: "الاستحقاق التالي",
    notice: "ملاحظة",
    principal: "الأصل",
    serviceFee: "رسوم الخدمة",
    installmentAmount: "القسط",
    installment: "القسط",
    termInvalid: "يجب أن تكون مدة القرض عدداً صحيحاً أكبر من صفر.",
    acknowledgementRequired: "أقر برسوم الخدمة الثابتة قبل إرسال الطلب.",
    acknowledgement:
      "أقر بأن رسوم الخدمة المعلنة ثابتة وغير قائمة على الفائدة.",
    noEligibility: "الإقراض غير متاح لهذا الحساب حتى الآن."
  },
  status: {
    requested: "تم الطلب",
    reviewRequired: "تتطلب مراجعة",
    approved: "تمت الموافقة",
    queued: "في الانتظار",
    broadcast: "تم البث",
    confirmed: "تم التأكيد",
    settled: "تمت التسوية",
    failed: "فشل",
    cancelled: "أُلغي",
    manuallyResolved: "تمت المعالجة يدوياً"
  }
};

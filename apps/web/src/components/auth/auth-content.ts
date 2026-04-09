export type AuthShellCopy = {
  formEyebrow: string;
  formTitle: string;
  formDescription: string;
  brandEyebrow: string;
  brandTitle: string;
  brandDescription: string;
};

type Translator = (key: string) => string;

export function getAuthCredibilityChips(t: Translator) {
  return [
    t("auth.credibilityChips.settlement"),
    t("auth.credibilityChips.controls"),
    t("auth.credibilityChips.oversight")
  ];
}

export function getSignInCopy(t: Translator): AuthShellCopy {
  return {
    formEyebrow: t("auth.signIn.formEyebrow"),
    formTitle: t("auth.signIn.formTitle"),
    formDescription: t("auth.signIn.formDescription"),
    brandEyebrow: t("auth.signIn.brandEyebrow"),
    brandTitle: t("auth.signIn.brandTitle"),
    brandDescription: t("auth.signIn.brandDescription")
  };
}

export function getSignUpCopy(t: Translator): AuthShellCopy {
  return {
    formEyebrow: t("auth.signUp.formEyebrow"),
    formTitle: t("auth.signUp.formTitle"),
    formDescription: t("auth.signUp.formDescription"),
    brandEyebrow: t("auth.signUp.brandEyebrow"),
    brandTitle: t("auth.signUp.brandTitle"),
    brandDescription: t("auth.signUp.brandDescription")
  };
}

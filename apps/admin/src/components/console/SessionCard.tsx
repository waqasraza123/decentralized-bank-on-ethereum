import { type FormEvent, useState } from "react";
import { useT } from "@/i18n/use-t";
import { useOperatorSession } from "@/state/operator-session";

export function SessionCard() {
  const t = useT();
  const { sessionDraft, setSessionDraft, saveSession, clearSession } =
    useOperatorSession();
  const [flash, setFlash] = useState<string | null>(null);

  function handleSaveSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveSession();
    setFlash(t("flash.updated"));
  }

  return (
    <form className="admin-session-card" onSubmit={handleSaveSession}>
      <div>
        <p className="admin-kicker">{t("credentials.kicker")}</p>
        <h3>{t("credentials.title")}</h3>
        <p className="admin-copy">{t("credentials.description")}</p>
      </div>

      <label>
        <span>{t("credentials.apiBaseUrl")}</span>
        <input
          aria-label={t("credentials.apiBaseUrl")}
          value={sessionDraft.baseUrl}
          onChange={(event) =>
            setSessionDraft((current) => ({
              ...current,
              baseUrl: event.target.value
            }))
          }
        />
      </label>

      <label>
        <span>{t("credentials.operatorAccessToken")}</span>
        <input
          aria-label={t("credentials.operatorAccessToken")}
          type="password"
          value={sessionDraft.accessToken}
          onChange={(event) =>
            setSessionDraft((current) => ({
              ...current,
              accessToken: event.target.value
            }))
          }
        />
      </label>

      {flash ? <p className="admin-flash success">{flash}</p> : null}

      <button className="admin-primary-button" type="submit">
        {t("credentials.saveSession")}
      </button>
      <button
        className="admin-secondary-button"
        type="button"
        onClick={() => {
          clearSession();
          setFlash(t("flash.updated"));
        }}
      >
        {t("credentials.clearSession")}
      </button>
    </form>
  );
}

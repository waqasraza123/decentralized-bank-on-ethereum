import { type FormEvent, useState } from "react";
import { useT } from "@/i18n/use-t";
import { useOperatorSession } from "@/state/operator-session";

const operatorRoleOptions = [
  "operations_admin",
  "risk_manager",
  "senior_operator",
  "compliance_lead"
];

export function SessionCard() {
  const t = useT();
  const { sessionDraft, setSessionDraft, saveSession } = useOperatorSession();
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
        <span>{t("credentials.operatorId")}</span>
        <input
          aria-label={t("credentials.operatorId")}
          value={sessionDraft.operatorId}
          onChange={(event) =>
            setSessionDraft((current) => ({
              ...current,
              operatorId: event.target.value
            }))
          }
        />
      </label>

      <label>
        <span>{t("credentials.operatorRole")}</span>
        <select
          aria-label={t("credentials.operatorRole")}
          value={sessionDraft.operatorRole}
          onChange={(event) =>
            setSessionDraft((current) => ({
              ...current,
              operatorRole: event.target.value
            }))
          }
        >
          {operatorRoleOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>{t("credentials.operatorApiKey")}</span>
        <input
          aria-label={t("credentials.operatorApiKey")}
          type="password"
          value={sessionDraft.apiKey}
          onChange={(event) =>
            setSessionDraft((current) => ({
              ...current,
              apiKey: event.target.value
            }))
          }
        />
      </label>

      {flash ? <p className="admin-flash success">{flash}</p> : null}

      <button className="admin-primary-button" type="submit">
        {t("credentials.saveSession")}
      </button>
    </form>
  );
}

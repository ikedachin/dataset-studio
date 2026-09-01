import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { usePreferences } from "../i18n";
import type { DatasetRecord, DiffChange, SyncRule } from "../types";

export function SyncDialog({
  record,
  rules,
  onClose,
  onApplied,
}: {
  record: DatasetRecord;
  rules: SyncRule[];
  onClose: () => void;
  onApplied: (record: DatasetRecord) => void;
}) {
  const { t } = usePreferences();
  const [changes, setChanges] = useState<DiffChange[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .sync(record.id, rules, false)
      .then((r) => setChanges(r.changes))
      .catch((e) =>
        setError(e instanceof Error ? e.message : t("Sync preview failed")),
      );
  }, [record.id, rules, t]);
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <button className="modal-close icon ghost" onClick={onClose}>
          <X />
        </button>
        <p className="eyebrow">{t("MANUAL SYNC PREVIEW")}</p>
        <h2>{t("Before → After")}</h2>
        {rules.length === 0 ? (
          <p className="empty-small">
            {t("No sync rules are configured. Add rules in Project Settings.")}
          </p>
        ) : (
          <div className="sync-preview">
            {changes.map((c, i) => (
              <div className="diff" key={i}>
                <code>{c.path}</code>
                {c.before !== undefined && (
                  <pre>- {JSON.stringify(c.before)}</pre>
                )}
                {c.after !== undefined && (
                  <pre>+ {JSON.stringify(c.after)}</pre>
                )}
              </div>
            ))}
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <span />
          <button onClick={onClose}>{t("Cancel")}</button>
          <button
            className="primary"
            disabled={!changes.length}
            onClick={async () => {
              const result = await api.sync(record.id, rules, true);
              if (result.record) onApplied(result.record);
              onClose();
            }}
          >
            {t("Apply Sync")}
          </button>
        </div>
      </div>
    </div>
  );
}

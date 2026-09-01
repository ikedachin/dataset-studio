import { Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import { usePreferences } from "../i18n";
import type { Project, SyncRule } from "../types";

export function ProjectTools({
  project,
  onClose,
  onUpdated,
  onDeleted,
  onValidated,
}: {
  project: Project;
  onClose: () => void;
  onUpdated: (p: Project, close?: boolean) => void;
  onDeleted: () => void;
  onValidated?: () => void;
}) {
  const { language, t } = usePreferences();
  const [required, setRequired] = useState(project.required_fields.join(", "));
  const [identifier, setIdentifier] = useState(project.identifier_field ?? "");
  const [rules, setRules] = useState<SyncRule[]>(project.sync_rules ?? []);
  const [result, setResult] = useState("");
  const settings = () => ({
    required_fields: required
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    identifier_field: identifier || null,
    sync_rules: rules,
  });
  const save = async () => {
    const updated = await api.updateProject(project.id, settings());
    onUpdated(updated);
    setResult(t("Settings saved"));
  };
  const validate = async () => {
    const updated = await api.updateProject(project.id, settings());
    onUpdated(updated, false);
    const r = await api.validateProject(project.id);
    onValidated?.();
    setResult(
      `${r.valid ?? 0} ${t("valid")} · ${r.warning ?? 0} ${t("warnings")} · ${r.error ?? 0} ${t("errors")}`,
    );
  };
  return (
    <div className="modal-backdrop">
      <div className="modal tools-modal">
        <button className="modal-close icon ghost" onClick={onClose}>
          <X />
        </button>
        <p className="eyebrow">{t("PROJECT SETTINGS")}</p>
        <h2>{project.name}</h2>
        <label>
          {t("Required JSON paths")}
          <input
            value={required}
            onChange={(e) => setRequired(e.target.value)}
            placeholder="question, answer, messages"
          />
        </label>
        <label>
          {t("Identifier path")}
          <input
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="id"
          />
          <small className="settings-hint">
            {language === "ja"
              ? "指定したJSONパスの存在と重複を検証します。フィールド名自体は変更しません。"
              : "Validates that this JSON path exists and is unique. It does not rename the field."}
          </small>
        </label>
        <div className="settings-section">
          <div className="settings-title">
            <b>{t("Manual sync rules")}</b>
            <button
              className="add-button"
              onClick={() => setRules([...rules, { source: "", target: "" }])}
            >
              <Plus size={13} /> {t("Rule")}
            </button>
          </div>
          <details className="sync-help">
            <summary>
              {language === "ja"
                ? "question・thinking・answerをmessagesへ同期する方法"
                : "Sync question, thinking, and answer to messages"}
            </summary>
            {language === "ja" ? (
              <div className="sync-help-content">
                <p>次の2つのルールを追加してください。</p>
                <div className="sync-help-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Target</th>
                        <th>Template</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <code>question</code>
                        </td>
                        <td>
                          <code>messages[0].content</code>
                        </td>
                        <td>空欄</td>
                      </tr>
                      <tr>
                        <td>空欄</td>
                        <td>
                          <code>messages[1].content</code>
                        </td>
                        <td>
                          <code>
                            {"<think>{{ thinking }}</think>\n{{ answer }}"}
                          </code>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <ol>
                  <li>上記ルールを追加して「設定を保存」を押します。</li>
                  <li>レコードのquestion、thinking、answerを編集します。</li>
                  <li>レコード上部の「同期」を押して差分を確認します。</li>
                  <li>「同期を適用」を押すとmessagesへ反映されます。</li>
                </ol>
                <p className="sync-help-note">
                  この設定はプロジェクト共通ですが、同期の実行はレコードごとの手動操作です。
                  <code>messages[0]</code>がuser、<code>messages[1]</code>
                  がassistantという並びを前提にしています。
                </p>
              </div>
            ) : (
              <div className="sync-help-content">
                <p>Add these two rules.</p>
                <div className="sync-help-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Source</th>
                        <th>Target</th>
                        <th>Template</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <code>question</code>
                        </td>
                        <td>
                          <code>messages[0].content</code>
                        </td>
                        <td>Leave blank</td>
                      </tr>
                      <tr>
                        <td>Leave blank</td>
                        <td>
                          <code>messages[1].content</code>
                        </td>
                        <td>
                          <code>
                            {"<think>{{ thinking }}</think>\n{{ answer }}"}
                          </code>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <ol>
                  <li>Add the rules above and select Save settings.</li>
                  <li>Edit question, thinking, and answer in a record.</li>
                  <li>
                    Select Sync at the top of the record and review the preview.
                  </li>
                  <li>Select Apply Sync to update messages.</li>
                </ol>
                <p className="sync-help-note">
                  Rules are shared by the project, but syncing is run manually
                  for each record. This assumes <code>messages[0]</code> is the
                  user message and <code>messages[1]</code> is the assistant
                  message.
                </p>
              </div>
            )}
          </details>
          {rules.map((rule, i) => (
            <div className="sync-rule" key={i}>
              <input
                value={rule.source ?? ""}
                onChange={(e) =>
                  setRules(
                    rules.map((r, j) =>
                      j === i ? { ...r, source: e.target.value } : r,
                    ),
                  )
                }
                placeholder="source.path"
              />
              <span>→</span>
              <input
                value={rule.target}
                onChange={(e) =>
                  setRules(
                    rules.map((r, j) =>
                      j === i ? { ...r, target: e.target.value } : r,
                    ),
                  )
                }
                placeholder="target.path"
              />
              <textarea
                value={rule.template ?? ""}
                onChange={(e) =>
                  setRules(
                    rules.map((r, j) =>
                      j === i ? { ...r, template: e.target.value } : r,
                    ),
                  )
                }
                placeholder={t("Optional template: {{ field }}")}
              />
              <button
                className="icon ghost danger"
                onClick={() => setRules(rules.filter((_, j) => j !== i))}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        {result && <p className="result-note">{result}</p>}
        <div className="modal-actions">
          <button
            className="danger ghost"
            onClick={async () => {
              if (
                confirm(
                  language === "ja"
                    ? `プロジェクト「${project.name}」と作業セッションを削除しますか？`
                    : `Delete project “${project.name}” and its working session?`,
                )
              ) {
                await api.deleteProject(project.id);
                onDeleted();
              }
            }}
          >
            {t("Delete project")}
          </button>
          <span />
          <button onClick={() => void validate()}>
            {t("Validate dataset")}
          </button>
          <button className="primary" onClick={() => void save()}>
            {t("Save settings")}
          </button>
        </div>
      </div>
    </div>
  );
}

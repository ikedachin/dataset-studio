import { lazy, Suspense, useEffect, useState } from "react";
import type { DatasetRecord, DiffChange, JsonObject } from "../types";

const RawCodeEditor = lazy(() => import("./RawCodeEditor"));

export function SidePanel({
  record,
  diff,
  onApplyRaw,
}: {
  record: DatasetRecord;
  diff: DiffChange[];
  onApplyRaw: (value: JsonObject) => void;
}) {
  const [tab, setTab] = useState<"diff" | "validation" | "raw" | "metadata">(
    "diff",
  );
  const [raw, setRaw] = useState(JSON.stringify(record.current_json, null, 2));
  const [error, setError] = useState("");
  useEffect(() => {
    setRaw(JSON.stringify(record.current_json, null, 2));
    setError("");
  }, [record.id, record.current_json]);
  const parse = (): JsonObject => {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object")
      throw new Error("Top level must be an object");
    return parsed as JsonObject;
  };
  const apply = () => {
    try {
      onApplyRaw(parse());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };
  const format = () => {
    try {
      setRaw(JSON.stringify(parse(), null, 2));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };
  return (
    <aside className="side-panel">
      <div className="tabs">
        <button
          className={tab === "diff" ? "active" : ""}
          onClick={() => setTab("diff")}
        >
          Diff
        </button>
        <button
          className={tab === "validation" ? "active" : ""}
          onClick={() => setTab("validation")}
        >
          Validate
        </button>
        <button
          className={tab === "raw" ? "active" : ""}
          onClick={() => setTab("raw")}
        >
          Raw JSON
        </button>
        <button
          className={tab === "metadata" ? "active" : ""}
          onClick={() => setTab("metadata")}
        >
          Meta
        </button>
      </div>
      <div className="side-content">
        {tab === "diff" && (
          <div data-testid="diff-panel">
            {diff.length === 0 ? (
              <div className="empty-small">No changes</div>
            ) : (
              diff.map((change, i) => (
                <div className={`diff change-${change.kind}`} key={i}>
                  <code>{change.path}</code>
                  <span>{change.kind}</span>
                  {"before" in change && (
                    <pre>- {JSON.stringify(change.before, null, 2)}</pre>
                  )}
                  {"after" in change && (
                    <pre>+ {JSON.stringify(change.after, null, 2)}</pre>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {tab === "validation" && (
          <div data-testid="validation-panel">
            <div className={`validation-summary ${record.validation_status}`}>
              {record.validation_status === "valid"
                ? "✓ Valid"
                : record.validation_status}
            </div>
            {record.validation_issues.map((issue, i) => (
              <div className={`issue ${issue.level}`} key={i}>
                <b>{issue.level}</b>
                <code>{issue.path}</code>
                <p>{issue.message}</p>
              </div>
            ))}
          </div>
        )}
        {tab === "raw" && (
          <div className="raw-editor">
            <Suspense fallback={<div className="empty-small">Loading JSON editor…</div>}>
              <RawCodeEditor value={raw} onChange={setRaw} />
            </Suspense>
            {error && <p className="error-text">{error}</p>}
            <div>
              <button onClick={format}>Format</button>
              <button className="primary" onClick={apply}>
                Apply
              </button>
            </div>
          </div>
        )}
        {tab === "metadata" && (
          <dl className="metadata">
            <dt>Record ID</dt>
            <dd>{record.id}</dd>
            <dt>Position</dt>
            <dd>{record.position + 1}</dd>
            <dt>Version</dt>
            <dd>{record.version}</dd>
            <dt>Status</dt>
            <dd>{record.status}</dd>
          </dl>
        )}
      </div>
    </aside>
  );
}

import {
  Database,
  FileUp,
  FolderOpen,
  Github,
  LoaderCircle,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../api";
import { usePreferences } from "../i18n";

export function ImportView({
  onComplete,
}: {
  onComplete: (projectId: number) => void;
}) {
  const { t } = usePreferences();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "local" | "hf" | null>(null);
  const [path, setPath] = useState("");
  const [repo, setRepo] = useState("");
  const [split, setSplit] = useState("train");
  const [config, setConfig] = useState("");
  const [options, setOptions] = useState<{
    configs: string[];
    splits: Record<string, string[]>;
  } | null>(null);
  const [job, setJob] = useState<{
    id: string;
    processed: number;
    progress: number | null;
    message: string;
  } | null>(null);
  const [error, setError] = useState("");

  const watch = (id: string) => {
    setJob({
      id,
      processed: 0,
      progress: null,
      message: t("Preparing import…"),
    });
    const poll = window.setInterval(async () => {
      try {
        const value = await api.job(id);
        setJob({ id, ...value });
        if (value.status === "completed") {
          window.clearInterval(poll);
          onComplete(value.result!.project_id);
        } else if (value.status === "failed") {
          window.clearInterval(poll);
          setError(value.error?.message || t("Import failed"));
        }
      } catch (e) {
        window.clearInterval(poll);
        setError(e instanceof Error ? e.message : t("Import failed"));
      }
    }, 500);
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      const result = await api.upload(file, split);
      watch(result.job_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Upload failed"));
    }
  };
  const loadOptions = async () => {
    setError("");
    try {
      const value = await api.hfOptions(repo);
      setOptions(value);
      const c = value.configs[0] || "";
      setConfig(c);
      setSplit(value.splits[c]?.[0] || "train");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Could not load repository"));
    }
  };
  const submit = async () => {
    try {
      if (mode === "local") watch((await api.importLocal(path, split)).job_id);
      if (mode === "hf")
        watch(
          (
            await api.importHF({
              repository_id: repo,
              config: config || null,
              split,
            })
          ).job_id,
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Import failed"));
    }
  };

  if (job)
    return (
      <main className="welcome">
        <LoaderCircle className="spin" size={34} />
        <h2>{t("Reading dataset…")}</h2>
        <p>{job.message}</p>
        <strong>
          {job.processed.toLocaleString()} {t("records")}
        </strong>
        {job.progress !== null && (
          <div className="progress">
            <span style={{ width: `${job.progress * 100}%` }} />
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
      </main>
    );

  return (
    <main
      className="welcome"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void upload(e.dataTransfer.files[0]);
      }}
    >
      <div className="welcome-mark">
        <Database size={30} />
      </div>
      <p className="eyebrow">{t("LOCAL DATASET WORKBENCH")}</p>
      <h1>{t("Create Dataset Project")}</h1>
      <p className="lead">
        {t(
          "Open a JSONL dataset without touching the source. Every edit is saved to a private SQLite workspace.",
        )}
      </p>
      <div className="source-cards">
        <button onClick={() => fileRef.current?.click()}>
          <FileUp />
          <b>{t("Upload JSONL")}</b>
          <span>{t("Drop a .jsonl or .ndjson file")}</span>
        </button>
        <button onClick={() => setMode("local")}>
          <FolderOpen />
          <b>{t("Open local path")}</b>
          <span>{t("Read from this computer")}</span>
        </button>
        <button onClick={() => setMode("hf")}>
          <Github />
          <b>Hugging Face</b>
          <span>{t("Stream a dataset repository")}</span>
        </button>
      </div>
      <input
        hidden
        ref={fileRef}
        type="file"
        accept=".jsonl,.ndjson"
        onChange={(e) => void upload(e.target.files?.[0])}
      />
      <p className="drop-hint">
        {t("You can also drop a JSONL file anywhere on this screen.")}
      </p>
      {mode && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <button
              type="button"
              className="modal-close icon ghost"
              onClick={() => setMode(null)}
              aria-label={t("Close")}
            >
              <X />
            </button>
            <h2>
              {mode === "local"
                ? t("Open local JSONL")
                : t("Load Hugging Face dataset")}
            </h2>
            {mode === "local" ? (
              <>
                <label>
                  {t("Absolute file path")}
                  <input
                    required
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    placeholder="/home/user/data/train.jsonl"
                  />
                </label>
                <label>
                  {t("Split name")}
                  <input
                    value={split}
                    onChange={(e) => setSplit(e.target.value)}
                  />
                </label>
              </>
            ) : (
              <>
                <label>
                  {t("Repository ID")}
                  <div className="inline">
                    <input
                      required
                      value={repo}
                      onChange={(e) => setRepo(e.target.value)}
                      placeholder="owner/dataset"
                    />
                    <button type="button" onClick={() => void loadOptions()}>
                      {t("Inspect")}
                    </button>
                  </div>
                </label>
                {options && (
                  <>
                    <label>
                      {t("Configuration")}
                      <select
                        value={config}
                        onChange={(e) => {
                          setConfig(e.target.value);
                          setSplit(
                            options.splits[e.target.value]?.[0] || "train",
                          );
                        }}
                      >
                        {options.configs.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t("Split")}
                      <select
                        value={split}
                        onChange={(e) => setSplit(e.target.value)}
                      >
                        {(options.splits[config] || []).map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </>
            )}
            {error && <p className="error-text">{error}</p>}
            <button
              className="primary"
              type="submit"
              disabled={mode === "hf" && !options}
            >
              {t("Start import")}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

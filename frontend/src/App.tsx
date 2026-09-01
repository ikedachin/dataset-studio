import {
  Download,
  FilePlus2,
  MoreHorizontal,
  Search,
  Settings,
  Trash2,
  Upload,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api } from "./api";
import { DynamicFieldEditor } from "./components/DynamicFieldEditor";
import { ImportView } from "./components/ImportView";
import { RecordList } from "./components/RecordList";
import { SidePanel } from "./components/SidePanel";
import { ProjectTools } from "./components/ProjectTools";
import { SyncDialog } from "./components/SyncDialog";
import { useAutosave } from "./hooks/useAutosave";
import { usePreferences } from "./i18n";
import type { DatasetRecord, Json, JsonObject, Project } from "./types";
import { shortcutAction } from "./utils/keyboard";

export function App() {
  const { t } = usePreferences();
  const client = useQueryClient();
  const [projectId, setProjectId] = useState<number>();
  const [splitId, setSplitId] = useState<number>();
  const [recordId, setRecordId] = useState<number>();
  const [draft, setDraft] = useState<JsonObject>();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const version = useRef(0);
  const [notice, setNotice] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<
    Array<{ path: string; operator: string; value: string }>
  >([]);
  const [sortPath, setSortPath] = useState("");
  const [sortDirection, setSortDirection] = useState("asc");
  const [tools, setTools] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects });
  useEffect(() => {
    if (!projectId && projects.data?.length) setProjectId(projects.data[0].id);
  }, [projects.data, projectId]);
  const project = projects.data?.find((p) => p.id === projectId);
  useEffect(() => {
    if (project && !project.splits.some((s) => s.id === splitId)) {
      setSplitId(project.splits[0]?.id);
      setRecordId(undefined);
      setPage(0);
    }
  }, [project, splitId]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);
  const params = useMemo(() => {
    const p = new URLSearchParams({
      offset: String(page * 500),
      limit: "500",
      search: debouncedSearch,
      status,
      include_deleted: String(status === "deleted"),
    });
    const active = filters
      .filter((f) => f.path)
      .map((f) => ({
        ...f,
        value: ["exists", "missing", "empty", "not_empty"].includes(f.operator)
          ? null
          : f.value,
      }));
    if (active.length) p.set("filters", JSON.stringify(active));
    if (sortPath) {
      p.set("sort_path", sortPath);
      p.set("sort_direction", sortDirection);
    }
    return p;
  }, [page, debouncedSearch, status, filters, sortPath, sortDirection]);
  const list = useQuery({
    queryKey: ["records", splitId, params.toString()],
    queryFn: () => api.records(splitId!, params),
    enabled: !!splitId,
  });
  useEffect(() => {
    if (list.data?.items.length && !recordId)
      setRecordId(list.data.items[0].id);
  }, [list.data, recordId]);
  const record = useQuery({
    queryKey: ["record", recordId],
    queryFn: () => api.record(recordId!),
    enabled: !!recordId,
  });
  useEffect(() => {
    if (record.data) {
      setDraft(structuredClone(record.data.current_json));
      version.current = record.data.version;
    }
  }, [record.data]);
  const save = useCallback(
    async (value: JsonObject) => {
      if (!recordId) return;
      const saved = await api.save(recordId, value, version.current);
      version.current = saved.version;
      setDraft(structuredClone(saved.current_json));
      client.setQueryData(["record", recordId], saved);
      await client.invalidateQueries({ queryKey: ["records", splitId] });
    },
    [recordId, splitId, client],
  );
  const autosave = useAutosave(save);
  const selectRecord = async (id: number) => {
    await autosave.flush();
    setRecordId(id);
  };
  const diff = useQuery({
    queryKey: ["diff", recordId, record.data?.version],
    queryFn: () => api.diff(recordId!),
    enabled: !!recordId && autosave.state === "Saved",
  });
  const change = (next: Json) => {
    setDraft(next as JsonObject);
    autosave.schedule(next as JsonObject);
  };
  const mutateRefresh = useMutation({
    mutationFn: async (action: "add" | "delete" | "restore" | "duplicate") => {
      if (action === "add") return api.add(splitId!);
      if (!recordId) throw new Error(t("Select a record to begin editing."));
      if (action === "delete") return api.remove(recordId);
      if (action === "restore") return api.restore(recordId);
      return api.duplicate(recordId);
    },
    onSuccess: async (saved) => {
      await client.invalidateQueries({ queryKey: ["records", splitId] });
      await client.invalidateQueries({ queryKey: ["projects"] });
      setRecordId(saved.id);
      client.setQueryData(["record", saved.id], saved);
    },
  });
  const watchJob = (id: string) => {
    setNotice(`Importing… job ${id.slice(0, 8)}`);
    const poll = window.setInterval(async () => {
      try {
        const job = await api.job(id);
        setNotice(job.message);
        if (job.status === "completed") {
          window.clearInterval(poll);
          setNotice(`Imported ${job.processed.toLocaleString()} records`);
          await client.invalidateQueries({ queryKey: ["projects"] });
          await client.invalidateQueries({ queryKey: ["records", splitId] });
        } else if (job.status === "failed") {
          window.clearInterval(poll);
          setNotice(job.error?.message ?? t("Import failed"));
        }
      } catch (e) {
        window.clearInterval(poll);
        setNotice(e instanceof Error ? e.message : t("Import failed"));
      }
    }, 600);
  };
  const importFrom = async (mode: string) => {
    if (mode === "local") {
      const path = prompt(t("Absolute path to .jsonl or .ndjson"));
      if (!path) return;
      const split =
        prompt(
          t("Split name"),
          path
            .split("/")
            .pop()
            ?.replace(/\.(jsonl|ndjson)$/i, "") || "train",
        ) || "train";
      watchJob((await api.importLocal(path, split, projectId)).job_id);
    }
    if (mode === "hf") {
      const repository_id = prompt(
        "Hugging Face repository ID (owner/dataset)",
      );
      if (!repository_id) return;
      const options = await api.hfOptions(repository_id);
      const config =
        prompt(
          `Configuration: ${options.configs.join(", ")}`,
          options.configs[0] || "",
        ) ||
        options.configs[0] ||
        null;
      const available = options.splits[config ?? ""] ?? [];
      const split =
        prompt(`Split: ${available.join(", ")}`, available[0] || "train") ||
        "train";
      watchJob(
        (
          await api.importHF({
            repository_id,
            config,
            split,
            project_id: projectId,
          })
        ).job_id,
      );
    }
  };
  const saveToPath = async () => {
    if (!splitId) return;
    const path = prompt(
      t("Save edited JSONL to local path"),
      `${project?.splits.find((s) => s.id === splitId)?.name ?? "dataset"}_edited.jsonl`,
    );
    if (!path) return;
    try {
      const result = await api.exportPath(splitId, path);
      setNotice(
        `Exported ${result.records.toLocaleString()} records to ${result.path}`,
      );
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 409 &&
        confirm(t("That file exists. Replace it atomically?"))
      ) {
        const result = await api.exportPath(splitId, path, true);
        setNotice(
          `Exported ${result.records.toLocaleString()} records to ${result.path}`,
        );
      } else setNotice(e instanceof Error ? e.message : t("Export failed"));
    }
  };
  const navigate = async (direction: number) => {
    if (!list.data || !recordId) return;
    const i = list.data.items.findIndex((x) => x.id === recordId);
    const next = list.data.items[i + direction];
    if (next) await selectRecord(next.id);
  };
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const action = shortcutAction(e);
      if (action) e.preventDefault();
      if (action === "save") void autosave.flush();
      if (action === "save-next") void autosave.flush().then(() => navigate(1));
      if (action === "search") searchRef.current?.focus();
      if (action === "previous") void navigate(-1);
      if (action === "next") void navigate(1);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  });
  if (projects.isLoading)
    return <div className="app-loading">{t("Opening Dataset Studio…")}</div>;
  if (!projects.data?.length)
    return (
      <>
        <Header projects={[]} onProject={() => {}} />
        <ImportView
          onComplete={(id) => {
            void client.invalidateQueries({ queryKey: ["projects"] });
            setProjectId(id);
          }}
        />
      </>
    );
  const currentIndex =
    list.data?.items.findIndex((x) => x.id === recordId) ?? -1;
  const total = list.data?.total ?? 0;
  return (
    <div className="app-shell">
      <Header
        projects={projects.data}
        projectId={projectId}
        onProject={async (id) => {
          await autosave.flush();
          setProjectId(id);
          setRecordId(undefined);
        }}
        onSettings={() => setTools(true)}
      >
        <div className="split-tabs">
          {project?.splits.map((split) => (
            <button
              className={split.id === splitId ? "active" : ""}
              onClick={async () => {
                await autosave.flush();
                setSplitId(split.id);
                setRecordId(undefined);
              }}
              key={split.id}
            >
              {split.name}
              <span>{split.record_count.toLocaleString()}</span>
            </button>
          ))}
        </div>
      </Header>
      <div className="toolbar-wrap">
        <div className="toolbar">
          <div className="search">
            <Search size={15} />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("Search every scalar value…")}
              aria-label={t("Search dataset")}
            />
            <kbd>⌘F</kbd>
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
            aria-label={t("Status filter")}
          >
            <option value="all">{t("All records")}</option>
            <option value="unedited">{t("Unedited")}</option>
            <option value="edited">{t("Edited")}</option>
            <option value="new">{t("New")}</option>
            <option value="deleted">{t("Deleted")}</option>
            <option value="validation_error">{t("Validation error")}</option>
          </select>
          <button
            className={filterOpen ? "active" : ""}
            onClick={() => setFilterOpen(!filterOpen)}
          >
            {t("Filter")} {filters.filter((f) => f.path).length || ""}
          </button>
          <button
            title={t("Add record")}
            onClick={() => mutateRefresh.mutate("add")}
          >
            <FilePlus2 size={15} /> {t("New record")}
          </button>
          <button
            onClick={() => document.getElementById("quick-upload")?.click()}
          >
            <Upload size={15} /> {t("Upload")}
          </button>
          <input
            id="quick-upload"
            hidden
            type="file"
            accept=".jsonl,.ndjson"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                const name =
                  prompt(
                    t("Split name"),
                    f.name.replace(/\.(jsonl|ndjson)$/i, ""),
                  ) || "train";
                watchJob((await api.upload(f, name, projectId)).job_id);
              }
            }}
          />
          <select
            className="import-select"
            defaultValue=""
            aria-label={t("Other import source")}
            onChange={(e) => {
              void importFrom(e.target.value).catch((error: unknown) =>
                setNotice(
                  error instanceof Error ? error.message : t("Import failed"),
                ),
              );
              e.target.value = "";
            }}
          >
            <option value="" disabled>
              {t("Import…")}
            </option>
            <option value="local">{t("Local path")}</option>
            <option value="hf">Hugging Face</option>
          </select>
          <button onClick={() => void saveToPath()}>{t("Save path")}</button>
          <a
            className="button primary"
            href={splitId ? `/api/export/download?split_id=${splitId}` : "#"}
          >
            <Download size={15} /> {t("Download")}
          </a>
          {(project?.splits.length ?? 0) > 1 && (
            <a
              className="button"
              href={`/api/projects/${projectId}/export.zip`}
            >
              ZIP
            </a>
          )}
        </div>
        {filterOpen && (
          <div className="filter-builder">
            {filters.map((f, i) => (
              <div className="filter-row" key={i}>
                <input
                  list="schema-paths"
                  placeholder={t("JSON path")}
                  value={f.path}
                  onChange={(e) =>
                    setFilters(
                      filters.map((x, j) =>
                        j === i ? { ...x, path: e.target.value } : x,
                      ),
                    )
                  }
                />
                <select
                  value={f.operator}
                  onChange={(e) =>
                    setFilters(
                      filters.map((x, j) =>
                        j === i ? { ...x, operator: e.target.value } : x,
                      ),
                    )
                  }
                >
                  <option value="contains">{t("contains")}</option>
                  <option value="not_contains">{t("not contains")}</option>
                  <option value="equals">{t("equals")}</option>
                  <option value="not_equals">{t("not equals")}</option>
                  <option value="exists">{t("exists")}</option>
                  <option value="missing">{t("missing")}</option>
                  <option value="empty">{t("empty")}</option>
                  <option value="not_empty">{t("not empty")}</option>
                  <option value="gt">&gt;</option>
                  <option value="gte">≥</option>
                  <option value="lt">&lt;</option>
                  <option value="lte">≤</option>
                </select>
                {!["exists", "missing", "empty", "not_empty"].includes(
                  f.operator,
                ) && (
                  <input
                    placeholder={t("Value")}
                    value={f.value}
                    onChange={(e) =>
                      setFilters(
                        filters.map((x, j) =>
                          j === i ? { ...x, value: e.target.value } : x,
                        ),
                      )
                    }
                  />
                )}
                <button
                  className="icon ghost danger"
                  onClick={() => setFilters(filters.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
            ))}
            <datalist id="schema-paths">
              {Object.keys(project?.inferred_schema.paths ?? {}).map((path) => (
                <option key={path}>{path}</option>
              ))}
            </datalist>
            <button
              className="add-button"
              onClick={() =>
                setFilters([
                  ...filters,
                  { path: "", operator: "contains", value: "" },
                ])
              }
            >
              {t("+ AND filter")}
            </button>
            <div className="sort-controls">
              <span>{t("Sort")}</span>
              <input
                list="schema-paths"
                value={sortPath}
                onChange={(e) => setSortPath(e.target.value)}
                placeholder={t("JSON path (original order)")}
              />
              <select
                value={sortDirection}
                onChange={(e) => setSortDirection(e.target.value)}
              >
                <option value="asc">{t("Ascending")}</option>
                <option value="desc">{t("Descending")}</option>
              </select>
              <button
                className="ghost"
                onClick={() => {
                  setFilters([]);
                  setSortPath("");
                }}
              >
                {t("Clear")}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="workspace">
        <aside className="records-panel">
          <div className="panel-title">
            <span>{t("RECORDS")}</span>
            <b>{total.toLocaleString()}</b>
          </div>
          <RecordList
            records={list.data?.items ?? []}
            total={total}
            selected={recordId}
            onSelect={(id) => void selectRecord(id)}
          />
          <div className="pager">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              ‹
            </button>
            <span>
              {t("Page")} {page + 1} / {Math.max(1, Math.ceil(total / 500))}
            </span>
            <button
              disabled={(page + 1) * 500 >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              ›
            </button>
          </div>
        </aside>
        <section className="editor-panel">
          {record.data && draft ? (
            <>
              <div className="editor-head">
                <div>
                  <p>
                    {t("RECORD")}{" "}
                    {String(record.data.position + 1).padStart(6, "0")}
                  </p>
                  <h2>
                    {record.data.status === "unedited"
                      ? t("Original record")
                      : t("Working copy")}
                  </h2>
                </div>
                <div className="editor-actions">
                  <span
                    className={`save-state save-${autosave.state.replace("…", "").toLowerCase()}`}
                  >
                    {t(autosave.state)}
                  </span>
                  <button
                    onClick={() =>
                      mutateRefresh.mutate(
                        record.data.is_deleted ? "restore" : "delete",
                      )
                    }
                    className="ghost danger"
                  >
                    <Trash2 size={15} />
                    {record.data.is_deleted ? t("Undo delete") : t("Delete")}
                  </button>
                  <button
                    className="ghost"
                    onClick={() => mutateRefresh.mutate("duplicate")}
                  >
                    {t("Duplicate")}
                  </button>
                  <button className="ghost" onClick={() => setSyncOpen(true)}>
                    {t("Sync")}
                  </button>
                  <button
                    className="ghost"
                    onClick={() => {
                      if (
                        confirm(
                          record.data.is_new
                            ? t("Cancel this new record?")
                            : t("Revert this record to its imported state?"),
                        )
                      )
                        mutateRefresh.mutate(
                          record.data.is_new ? "delete" : "restore",
                        );
                    }}
                  >
                    {t("Revert")}
                  </button>
                </div>
              </div>
              <div className="editor-scroll">
                <DynamicFieldEditor
                  name="record"
                  value={draft}
                  onChange={change}
                  path=""
                  schema={project?.inferred_schema.paths}
                />
              </div>
              <div className="navigation">
                <button
                  onClick={() => void navigate(-1)}
                  disabled={currentIndex <= 0}
                >
                  ← {t("Previous")}
                </button>
                <span>
                  <b>{page * 500 + currentIndex + 1}</b> /{" "}
                  {total.toLocaleString()}
                  {search && ` ${t("filtered")}`}
                </span>
                <button
                  onClick={() => void navigate(1)}
                  disabled={
                    currentIndex < 0 ||
                    currentIndex >= (list.data?.items.length ?? 0) - 1
                  }
                >
                  {t("Next")} →
                </button>
              </div>
            </>
          ) : (
            <div className="empty-editor">
              {t("Select a record to begin editing.")}
            </div>
          )}
        </section>
        {record.data && draft && (
          <SidePanel
            record={{ ...record.data, current_json: draft } as DatasetRecord}
            diff={diff.data?.changes ?? []}
            onApplyRaw={change}
          />
        )}
      </div>
      <footer className="statusbar">
        <span>{project?.name}</span>
        <span>{project?.splits.find((s) => s.id === splitId)?.name}</span>
        <span>
          {total.toLocaleString()} {t("records")}
        </span>
        <span>
          {record.data?.validation_status === "valid"
            ? t("✓ Validation OK")
            : `${t("Validation")}: ${record.data?.validation_status ?? "—"}`}
        </span>
        <span className="push">{notice || t(autosave.state)}</span>
      </footer>
      {tools && project && (
        <ProjectTools
          project={project}
          onClose={() => setTools(false)}
          onUpdated={(p, close = true) => {
            client.setQueryData<Project[]>(["projects"], (old) =>
              old?.map((x) => (x.id === p.id ? p : x)),
            );
            if (close) setTools(false);
          }}
          onDeleted={() => {
            void client.invalidateQueries({ queryKey: ["projects"] });
            setProjectId(undefined);
            setTools(false);
          }}
          onValidated={() => {
            void client.invalidateQueries({ queryKey: ["records", splitId] });
            void client.invalidateQueries({ queryKey: ["record", recordId] });
          }}
        />
      )}
      {syncOpen && record.data && project && (
        <SyncDialog
          record={record.data}
          rules={project.sync_rules}
          onClose={() => setSyncOpen(false)}
          onApplied={(saved) => {
            version.current = saved.version;
            setDraft(saved.current_json);
            client.setQueryData(["record", saved.id], saved);
            void client.invalidateQueries({ queryKey: ["records", splitId] });
          }}
        />
      )}
    </div>
  );
}

function Header({
  projects,
  projectId,
  onProject,
  onSettings,
  children,
}: {
  projects: Project[];
  projectId?: number;
  onProject: (id: number) => void;
  onSettings?: () => void;
  children?: React.ReactNode;
}) {
  const { language, setLanguage, fontSize, setFontSize, t } = usePreferences();
  const sizes = ["small", "medium", "large"] as const;
  const sizeIndex = sizes.indexOf(fontSize);
  return (
    <header>
      <div className="brand">
        <div className="brand-mark">DS</div>
        <div>
          <b>Dataset Studio</b>
          <small>JSONL WORKBENCH</small>
        </div>
      </div>
      {projects.length > 0 && (
        <select
          className="project-select"
          value={projectId}
          onChange={(e) => onProject(Number(e.target.value))}
          aria-label="Project"
        >
          {projects.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}
      {children}
      <div className="header-spacer" />
      <div className="display-controls" aria-label={t("Text size")}>
        <button
          className="icon ghost text-size-button"
          title={t("Smaller text")}
          aria-label={t("Smaller text")}
          disabled={sizeIndex === 0}
          onClick={() => setFontSize(sizes[sizeIndex - 1])}
        >
          A−
        </button>
        <button
          className="icon ghost text-size-button"
          title={t("Larger text")}
          aria-label={t("Larger text")}
          disabled={sizeIndex === sizes.length - 1}
          onClick={() => setFontSize(sizes[sizeIndex + 1])}
        >
          A+
        </button>
      </div>
      <div className="language-switch" aria-label="Language">
        <button
          className={language === "ja" ? "active" : ""}
          onClick={() => setLanguage("ja")}
        >
          日本語
        </button>
        <button
          className={language === "en" ? "active" : ""}
          onClick={() => setLanguage("en")}
        >
          EN
        </button>
      </div>
      <button className="icon ghost" title={t("Settings")} onClick={onSettings}>
        <Settings size={17} />
      </button>
      <button className="icon ghost" title={t("More")}>
        <MoreHorizontal size={18} />
      </button>
    </header>
  );
}

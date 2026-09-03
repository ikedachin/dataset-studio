import type {
  DatasetRecord,
  DiffChange,
  JsonObject,
  Project,
  RecordSummary,
} from "./types";

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: unknown,
  ) {
    super(
      typeof detail === "object" && detail && "message" in detail
        ? String(detail.message)
        : `Request failed (${status})`,
    );
  }
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.detail ?? body);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
export const api = {
  projects: () => request<Project[]>("/projects"),
  project: (id: number) => request<Project>(`/projects/${id}`),
  deleteProject: (id: number) =>
    request<void>(`/projects/${id}`, { method: "DELETE" }),
  updateProject: (id: number, data: object) =>
    request<Project>(`/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  records: (split: number, params: URLSearchParams) =>
    request<{ items: RecordSummary[]; total: number }>(
      `/splits/${split}/records?${params}`,
    ),
  record: (id: number) => request<DatasetRecord>(`/records/${id}`),
  save: (id: number, current_json: JsonObject, version: number) =>
    request<DatasetRecord>(`/records/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_json, version }),
    }),
  add: (split: number, current_json: JsonObject = {}) =>
    request<DatasetRecord>(`/splits/${split}/records`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_json }),
    }),
  remove: (id: number) =>
    request<DatasetRecord>(`/records/${id}`, { method: "DELETE" }),
  restore: (id: number) =>
    request<DatasetRecord>(`/records/${id}/restore`, { method: "POST" }),
  duplicate: (id: number) =>
    request<DatasetRecord>(`/records/${id}/duplicate`, { method: "POST" }),
  diff: (id: number) =>
    request<{ changes: DiffChange[] }>(`/records/${id}/diff`),
  validate: (id: number) =>
    request<{ status: string; issues: unknown[] }>(`/records/${id}/validate`, {
      method: "POST",
    }),
  validateProject: (id: number) =>
    request<Record<string, number>>(`/projects/${id}/validate`, {
      method: "POST",
    }),
  upload: async (file: File, split = "train", projectId?: number) => {
    const form = new FormData();
    form.append("file", file);
    const owner = projectId ? `&project_id=${projectId}` : "";
    return request<{ job_id: string; project_id: number }>(
      `/import/upload?split=${encodeURIComponent(split)}${owner}`,
      { method: "POST", body: form },
    );
  },
  importLocal: (path: string, split = "train", project_id?: number) =>
    request<{ job_id: string; project_id: number }>("/import/local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, split, project_id }),
    }),
  hfOptions: (repository_id: string, revision = "") =>
    request<{ configs: string[]; splits: Record<string, string[]> }>(
      `/import/huggingface/options?repository_id=${encodeURIComponent(repository_id)}&revision=${encodeURIComponent(revision)}`,
    ),
  importHF: (data: object) =>
    request<{ job_id: string; project_id: number }>("/import/huggingface", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  job: (id: string) =>
    request<{
      status: string;
      processed: number;
      progress: number | null;
      message: string;
      result?: { project_id: number };
      error?: { message: string };
    }>(`/jobs/${id}`),
  sync: (id: number, rules: object[], apply: boolean) =>
    request<{
      after: JsonObject;
      changes: DiffChange[];
      record: DatasetRecord | null;
    }>(`/records/${id}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules, apply }),
    }),
};

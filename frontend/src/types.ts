export type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type JsonObject = { [key: string]: Json }
export interface Split { id: number; name: string; position: number; record_count: number }
export interface Project { id: number; name: string; source_type: string; source_metadata: Record<string, unknown>; inferred_schema: { paths?: Record<string, SchemaStat> }; sync_rules: SyncRule[]; required_fields: string[]; identifier_field: string | null; splits: Split[] }
export interface SchemaStat { count: number; null_count: number; types: Record<string, number>; max_length: number; multiline_ratio: number }
export interface RecordSummary { id: number; position: number; status: string; is_new: boolean; is_deleted: boolean; validation_status: string; preview: string }
export interface DatasetRecord extends RecordSummary { split_id: number; original_json: JsonObject | null; current_json: JsonObject; version: number; validation_issues: ValidationIssue[] }
export interface ValidationIssue { level: 'error' | 'warning'; path: string; message: string }
export interface DiffChange { path: string; kind: 'added' | 'removed' | 'modified'; before?: Json; after?: Json }
export interface SyncRule { source?: string; target: string; template?: string }


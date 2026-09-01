import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "en" | "ja";
export type FontSize = "small" | "medium" | "large";

const ja: Record<string, string> = {
  "Opening Dataset Studio…": "Dataset Studioを開いています…",
  "Search every scalar value…": "すべての値を検索…",
  "Search dataset": "データセットを検索",
  "Status filter": "ステータスフィルター",
  "All records": "すべてのレコード",
  Unedited: "未編集",
  Edited: "編集済み",
  New: "新規",
  Deleted: "削除済み",
  "Validation error": "検証エラー",
  Filter: "フィルター",
  "Add record": "レコードを追加",
  "New record": "新規レコード",
  Upload: "アップロード",
  "Other import source": "その他の読み込み元",
  "Import…": "読み込み…",
  "Local path": "ローカルパス",
  "Save path": "パスへ保存",
  Download: "ダウンロード",
  "JSON path": "JSONパス",
  Value: "値",
  contains: "含む",
  "not contains": "含まない",
  equals: "等しい",
  "not equals": "等しくない",
  exists: "存在する",
  missing: "存在しない",
  empty: "空",
  "not empty": "空でない",
  "+ AND filter": "+ ANDフィルター",
  Sort: "並べ替え",
  "JSON path (original order)": "JSONパス（元の順序）",
  Ascending: "昇順",
  Descending: "降順",
  Clear: "クリア",
  RECORDS: "レコード",
  Page: "ページ",
  RECORD: "レコード",
  "Original record": "元のレコード",
  "Working copy": "編集中のコピー",
  Saved: "保存済み",
  "Saving…": "保存中…",
  Unsaved: "未保存",
  Error: "エラー",
  Delete: "削除",
  "Undo delete": "削除を取り消す",
  Duplicate: "複製",
  Sync: "同期",
  Revert: "元に戻す",
  "Cancel this new record?": "この新規レコードを破棄しますか？",
  "Revert this record to its imported state?":
    "このレコードを読み込み時の状態に戻しますか？",
  Previous: "前へ",
  Next: "次へ",
  filtered: "絞り込み済み",
  "Select a record to begin editing.": "編集するレコードを選択してください。",
  records: "件",
  "✓ Validation OK": "✓ 検証OK",
  Validation: "検証",
  Settings: "設定",
  More: "その他",
  "Smaller text": "文字を小さく",
  "Larger text": "文字を大きく",
  "Switch to Japanese": "日本語に切り替え",
  "Switch to English": "英語に切り替え",
  "Text size": "文字サイズ",
  "No changes": "変更はありません",
  Diff: "差分",
  Validate: "検証",
  Meta: "情報",
  "✓ Valid": "✓ 有効",
  "Loading JSON editor…": "JSONエディターを読み込み中…",
  Format: "整形",
  Apply: "適用",
  "Record ID": "レコードID",
  Position: "位置",
  Version: "バージョン",
  Status: "状態",
  "Top level must be an object": "最上位はオブジェクトである必要があります",
  "Invalid JSON": "JSONが不正です",
  "Delete field": "フィールドを削除",
  fields: "フィールド",
  "Add field": "フィールドを追加",
  Add: "追加",
  Cancel: "キャンセル",
  "Move up": "上へ移動",
  "Move down": "下へ移動",
  "Delete item": "項目を削除",
  "Add item": "項目を追加",
  "Move message up": "メッセージを上へ移動",
  "Move message down": "メッセージを下へ移動",
  "Duplicate message": "メッセージを複製",
  "Delete message": "メッセージを削除",
  "Add message": "メッセージを追加",
  "LOCAL DATASET WORKBENCH": "ローカル・データセット・ワークベンチ",
  "Create Dataset Project": "データセットプロジェクトを作成",
  "Open a JSONL dataset without touching the source. Every edit is saved to a private SQLite workspace.":
    "元ファイルを変更せずにJSONLデータセットを開きます。編集内容は専用のSQLiteワークスペースへ保存されます。",
  "Upload JSONL": "JSONLをアップロード",
  "Drop a .jsonl or .ndjson file": ".jsonlまたは.ndjsonファイルを選択",
  "Open local path": "ローカルパスを開く",
  "Read from this computer": "このコンピューターから読み込む",
  "Stream a dataset repository": "データセットリポジトリを読み込む",
  "You can also drop a JSONL file anywhere on this screen.":
    "この画面へJSONLファイルをドロップすることもできます。",
  Close: "閉じる",
  "Open local JSONL": "ローカルJSONLを開く",
  "Load Hugging Face dataset": "Hugging Faceデータセットを読み込む",
  "Absolute file path": "ファイルの絶対パス",
  "Split name": "Split名",
  "Repository ID": "リポジトリID",
  Inspect: "確認",
  Configuration: "設定",
  Split: "Split",
  "Start import": "読み込み開始",
  "Reading dataset…": "データセットを読み込み中…",
  "Preparing import…": "読み込みを準備中…",
  "Import failed": "読み込みに失敗しました",
  "Upload failed": "アップロードに失敗しました",
  "Could not load repository": "リポジトリを読み込めませんでした",
  "PROJECT SETTINGS": "プロジェクト設定",
  "Required JSON paths": "必須JSONパス",
  "Identifier path": "検証に使う識別子パス",
  "Manual sync rules": "手動同期ルール",
  Rule: "ルール",
  "Optional template: {{ field }}": "任意のテンプレート: {{ field }}",
  "Settings saved": "設定を保存しました",
  valid: "有効",
  warnings: "警告",
  errors: "エラー",
  "Delete project": "プロジェクトを削除",
  "Validate dataset": "データセットを検証",
  "Save settings": "設定を保存",
  "MANUAL SYNC PREVIEW": "手動同期プレビュー",
  "Before → After": "変更前 → 変更後",
  "No sync rules are configured. Add rules in Project Settings.":
    "同期ルールがありません。プロジェクト設定で追加してください。",
  "Apply Sync": "同期を適用",
  "Sync preview failed": "同期プレビューに失敗しました",
};

type Preferences = {
  language: Language;
  setLanguage: (language: Language) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  t: (text: string) => string;
};

const fallback: Preferences = {
  language: "en",
  setLanguage: () => {},
  fontSize: "medium",
  setFontSize: () => {},
  t: (text) => text,
};

const PreferencesContext = createContext<Preferences>(fallback);

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem("dataset-studio-language");
    if (saved === "en" || saved === "ja") return saved;
    return navigator.language.toLowerCase().startsWith("ja") ? "ja" : "en";
  });
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    const saved = localStorage.getItem("dataset-studio-font-size");
    return saved === "small" || saved === "large" ? saved : "medium";
  });

  useEffect(() => {
    localStorage.setItem("dataset-studio-language", language);
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    localStorage.setItem("dataset-studio-font-size", fontSize);
    document.documentElement.dataset.fontSize = fontSize;
  }, [fontSize]);

  const value = useMemo<Preferences>(
    () => ({
      language,
      setLanguage,
      fontSize,
      setFontSize,
      t: (text) => (language === "ja" ? (ja[text] ?? text) : text),
    }),
    [fontSize, language],
  );
  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export const usePreferences = () => useContext(PreferencesContext);

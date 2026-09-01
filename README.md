# Dataset Studio

Dataset Studioは、LLM・VLMなどの学習データを対象とした、ローカルファーストかつスキーマ非依存のJSONLデータセットエディターです。

JSONLを専用のSQLite作業セッションへ読み込み、任意のネスト構造をブラウザ上で確認・編集できます。元のJSONLは変更せず、編集結果を新しいJSONLとしてエクスポートします。

## 主な機能

- ブラウザアップロード、ローカルパス、Hugging Face DatasetからのストリーミングImport
- SQLite（WALモード）によるProject・複数Split・編集内容の永続化
- string、number、boolean、null、object、arrayに対応した動的Editor
- `messages: [{ role, content }]` を検出するChat Message Editor
- debounce付きAutosaveと、record単位の楽観的排他制御
- 仮想化Record List、ネストしたscalar値を対象にした全文検索
- Status Filter、複数のJSON Path Filter、JSON Path Sort
- 構造化Diff、Record Revert、Soft Delete、Duplicate、Validation
- ユーザー操作時のみ実行されるManual Sync Rule
- UTF-8を維持したStreaming DownloadとatomicなローカルパスExport
- 複数SplitのZIP Export
- キーボード操作に対応したDark UI

## インストール

Python 3.11以上と[uv](https://docs.astral.sh/uv/)が必要です。

```bash
git clone <repository-url>
cd dataset-studio
uv sync
```

## 起動

```bash
uv run dataset-studio
```

デフォルトでは外部へ公開せず、`127.0.0.1`だけでListenします。起動後、ブラウザで[http://127.0.0.1:8765](http://127.0.0.1:8765)を開きます。

利用可能なオプション:

```bash
uv run dataset-studio --host 127.0.0.1 --port 8765 --no-browser
uv run dataset-studio --data-dir /path/to/private/workspace
```

| オプション | 説明 |
| --- | --- |
| `--host` | Listenするアドレス。デフォルトは`127.0.0.1` |
| `--port` | Listenするポート。デフォルトは`8765` |
| `--no-browser` | 起動時にブラウザを自動で開かない |
| `--data-dir` | SQLite DBなどの保存先を明示的に指定する |

通常、SQLite DBなどの内部データは`platformdirs`を利用してOS標準のApplication Data Directoryへ保存されます。リポジトリ直下には保存されません。

代表的な保存先:

- macOS: `~/Library/Application Support/Dataset Studio/`
- Linux: `~/.local/share/Dataset Studio/`
- Windows: ユーザーのLocal Application Data Directory

## 基本的な使い方

1. 起動画面からJSONLの読み込み方法を選択します。
2. Importが完了したら、対象のProjectとSplitを選択します。
3. 左側のRecord Listからレコードを選択します。
4. 中央の動的Editorまたは右側のRaw JSON Editorで内容を編集します。
5. 編集内容は自動保存されます。
6. Diff・Validationを確認し、Browser DownloadまたはローカルパスへExportします。

元ファイルを直接編集することはありません。

## JSONLの読み込み

### ブラウザからアップロード

`.jsonl`または`.ndjson`ファイルを選択するか、起動画面へドラッグ&ドロップします。

### ローカルパスから読み込み

Dataset Studioを実行しているPC上のJSONLファイルを絶対パスで指定します。

```text
/home/user/datasets/train.jsonl
```

### Hugging Face Datasetから読み込み

起動画面で**Hugging Face**を選び、Repository IDを入力します。利用可能なconfigurationとsplitを取得してから、対象を選択してストリーミングImportします。

```text
ikedachin/JaQuAD_imabari_v1
```

公開Datasetはtokenなしで利用できます。Private Repositoryを読み込む場合は、Dataset Studioを起動するプロセスへ`HF_TOKEN`環境変数を設定してください。TokenはSQLiteへ保存されません。

## キーボードショートカット

| macOS | Windows / Linux | 動作 |
| --- | --- | --- |
| `Cmd + S` | `Ctrl + S` | 現在のRecordをすぐに保存 |
| `Cmd + Enter` | `Ctrl + Enter` | 保存して次のRecordへ移動 |
| `Cmd + F` | `Ctrl + F` | Dataset Studio内の検索欄へ移動 |
| `←` / `→` | `←` / `→` | 編集欄にfocusしていない場合に前後のRecordへ移動 |

## データの安全性

- 元JSONLをデフォルトで上書きしません。
- JSON解析に失敗した行を黙って破棄しません。
- Import Errorには行番号とエラー内容を表示します。
- 未知のJSON fieldや`messages`内の追加fieldを保持します。
- IDを自動変更しません。
- Record削除はSoft Deleteとして扱い、Export前なら取り消せます。
- 日本語などのUnicodeを不要なASCII escapeへ変換しません。
- Import時のRecord順序を維持します。
- Autosaveはrecordの`version`を利用し、古い保存結果による上書きを防ぎます。

## フロントエンド開発

通常の利用にはNode.jsは不要です。Node.jsが必要なのは、フロントエンドを開発または再ビルドする場合だけです。

```bash
cd frontend
npm install
npm run dev
```

Viteの開発サーバーは、`/api`へのアクセスをポート`8765`で動作しているDataset Studioへproxyします。

本番用フロントエンドをビルドし、Pythonパッケージ内へ配置する場合:

```bash
npm run build
```

生成物は`src/dataset_studio/static/`へ配置され、FastAPIから配信されます。

## 開発時の品質チェック

バックエンド:

```bash
uv run pytest
uv run ruff check .
```

フロントエンド:

```bash
cd frontend
npm test
npm run lint
npm run typecheck
npm run build
```

## 大規模データセットの動作確認

性能確認用のsynthetic JSONLを生成できます。

```bash
uv run python scripts/generate_test_dataset.py --records 100000
```

生成したJSONLについて、Import・FTS検索・Exportを通して確認する場合:

```bash
uv run python scripts/smoke_large_dataset.py synthetic-100k.jsonl
```

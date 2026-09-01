# Dataset Studio

English | [日本語](README.md)

Dataset Studio is a local-first, schema-agnostic JSONL dataset editor for training data used with LLMs, VLMs, and other models.

It imports JSONL into a dedicated SQLite workspace, where you can inspect and edit arbitrary nested structures in your browser. The original JSONL file remains unchanged, and your edits are exported as a new JSONL file.

## Key Features

- Streaming imports from browser uploads, local paths, and Hugging Face Datasets
- Persistent projects, multiple splits, and edits using SQLite in WAL mode
- Dynamic editor supporting strings, numbers, booleans, nulls, objects, and arrays
- Chat Message Editor that detects `messages: [{ role, content }]`
- Debounced autosave with optimistic concurrency control at the record level
- Virtualized Record List and full-text search across nested scalar values
- Status Filter, multiple JSON Path Filters, and JSON Path Sort
- Structured Diff, Record Revert, Soft Delete, Duplicate, and Validation
- Manual Sync Rules that run only when explicitly triggered by the user
- Streaming downloads that preserve UTF-8 and atomic exports to local paths
- ZIP export for multiple splits
- Dark UI with keyboard navigation

## Installation

Python 3.11 or later and [uv](https://docs.astral.sh/uv/) are required.

Prebuilt frontend files are included in both the repository and the Python package. Regular users do not need to install Node.js or run `npm install` or `npm run build`.

```bash
git clone <repository-url>
cd dataset-studio
uv sync
```

## Running Dataset Studio

```bash
uv run dataset-studio
```

By default, Dataset Studio is not exposed externally and listens only on `127.0.0.1`. Once it starts, open [http://127.0.0.1:8765](http://127.0.0.1:8765) in your browser.

Available options:

```bash
uv run dataset-studio --host 127.0.0.1 --port 8765 --no-browser
uv run dataset-studio --data-dir /path/to/private/workspace
```

| Option | Description |
| --- | --- |
| `--host` | Address to listen on. Defaults to `127.0.0.1` |
| `--port` | Port to listen on. Defaults to `8765` |
| `--no-browser` | Do not open a browser automatically at startup |
| `--data-dir` | Explicitly specify where the SQLite database and other internal data are stored |

Dataset Studio normally uses `platformdirs` to store its SQLite database and other internal data in the operating system's standard application data directory. This data is not stored in the repository root.

Typical locations:

- macOS: `~/Library/Application Support/Dataset Studio/`
- Linux: `~/.local/share/Dataset Studio/`
- Windows: the user's local application data directory

## Basic Usage

1. Choose how to import JSONL from the start screen.
2. Once the import is complete, select the target Project and Split.
3. Select a record from the Record List on the left.
4. Edit its contents in the dynamic Editor in the center or the Raw JSON Editor on the right.
5. Your changes are saved automatically.
6. Review the Diff and Validation results, then export using Browser Download or a local path.

Dataset Studio never edits the original file directly.

## Importing JSONL

### Uploading from a Browser

Select a `.jsonl` or `.ndjson` file, or drag and drop it onto the start screen.

### Importing from a Local Path

Enter the absolute path to a JSONL file on the computer running Dataset Studio.

```text
/home/user/datasets/train.jsonl
```

### Importing from a Hugging Face Dataset

Select **Hugging Face** on the start screen and enter a Repository ID. Dataset Studio retrieves the available configurations and splits, then lets you select which one to import by streaming.

```text
ikedachin/JaQuAD_imabari_v1
```

Public datasets can be used without a token. To import a private repository, set the `HF_TOKEN` environment variable for the process that launches Dataset Studio. The token is not stored in SQLite.

## Keyboard Shortcuts

| macOS | Windows / Linux | Action |
| --- | --- | --- |
| `Cmd + S` | `Ctrl + S` | Save the current Record immediately |
| `Cmd + Enter` | `Ctrl + Enter` | Save and move to the next Record |
| `Cmd + F` | `Ctrl + F` | Focus the search field in Dataset Studio |
| `←` / `→` | `←` / `→` | Move to the previous or next Record when an editor field is not focused |

## Data Safety

- The original JSONL file is not overwritten by default.
- Lines that fail JSON parsing are never silently discarded.
- Import Errors show the line number and error details.
- Unknown JSON fields and additional fields inside `messages` are preserved.
- IDs are not modified automatically.
- Deleting a Record uses Soft Delete and can be undone before export.
- Unicode text, including Japanese, is not unnecessarily converted to ASCII escape sequences.
- Record order from the import is preserved.
- Autosave uses each record's `version` to prevent stale save results from overwriting newer changes.

## Frontend Development

This section is for developers working on the Dataset Studio frontend itself. The following steps are not required for normal installation or use.

Node.js is required only when developing or rebuilding the frontend.

To start the development server:

```bash
cd frontend
npm install
npm run dev
```

The Vite development server proxies `/api` requests to Dataset Studio running on port `8765`.

After changing the frontend, regenerate the production files:

```bash
cd frontend
npm install
npm run build
```

The output from `npm run build` is written to `src/dataset_studio/static/` and served by FastAPI. These generated files are committed alongside the source code so Dataset Studio remains runnable with Python alone.

In summary, use the following commands for each purpose:

| Purpose | Required commands |
| --- | --- |
| Use Dataset Studio | `uv sync`, `uv run dataset-studio` |
| Develop the React UI | `cd frontend`, `npm install`, `npm run dev` |
| Apply React UI changes to the production files | `cd frontend`, `npm run build` |

## Development Quality Checks

Backend:

```bash
uv run pytest
uv run ruff check .
```

Frontend:

```bash
cd frontend
npm test
npm run lint
npm run typecheck
npm run build
```

## Testing with Large Datasets

You can generate a synthetic JSONL file for performance testing.

```bash
uv run python scripts/generate_test_dataset.py --records 100000
```

To test importing, FTS search, and exporting with the generated JSONL file:

```bash
uv run python scripts/smoke_large_dataset.py synthetic-100k.jsonl
```

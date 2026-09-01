# Manual Sync Rules / 手動同期ルール

[日本語](#日本語) | [English](#english)

## 日本語

### 手動同期ルールとは

手動同期ルールは、同じレコード内の値を別のJSONパスへコピーしたり、複数の値をテンプレートで組み合わせて別のフィールドへ反映したりする機能です。

たとえば、次のような用途に使えます。

- `question`を`messages[0].content`へコピーする
- `thinking`と`answer`をまとめて`messages[1].content`へ書き込む
- 既存フィールドから`messages`形式を組み立てる

ルールはプロジェクト全体で共有されますが、同期はレコードごとに手動で実行します。フィールドを編集しただけでは、自動的に同期されません。

同期によって変更されるのはDataset Studio内の作業コピーです。Import元のJSONLファイルが直接書き換えられることはありません。

### 基本的な設定手順

1. 対象のプロジェクトとレコードを開きます。
2. 画面右上の歯車アイコンから「プロジェクト設定」を開きます。
3. 「手動同期ルール」で「ルール」を押します。
4. `Source`、`Target`、必要に応じて`Template`を入力します。
5. 必要な数だけルールを追加し、「設定を保存」を押します。
6. レコードを編集した場合は、保存状態が「保存済み」になったことを確認します。
7. レコード上部の「同期」を押し、プレビューで変更前と変更後を確認します。
8. 内容に問題がなければ「同期を適用」を押します。

プレビューを開いただけではレコードは変更されません。「同期を適用」を押した時点で、表示中のレコードの作業コピーに反映されます。

### 各入力欄の意味

| 項目 | 必須 | 説明 |
| --- | --- | --- |
| `Source` | 条件付き | コピー元のJSONパスです。`Template`を使わない場合に必要です。 |
| `Target` | 必須 | 書き込み先のJSONパスです。既存の値がある場合は上書きされます。 |
| `Template` | 任意 | 固定文字列や`{{ JSONパス }}`を組み合わせて、書き込む文字列を作ります。入力した場合、`Source`は使われません。 |

ルールには次の2つの書き方があります。

#### 1. 値をそのままコピーする

`Template`を空欄にして、`Source`と`Target`を指定します。

| Source | Target | Template |
| --- | --- | --- |
| `question` | `messages[0].content` | 空欄 |

この方法では、文字列だけでなく、数値、真偽値、配列、オブジェクトなども元のJSON型を保ったままコピーされます。

コピー元のパスがレコード内に存在しない場合、そのルールは何も変更せずにスキップされます。

#### 2. テンプレートから文字列を作る

`Template`に固定文字列とプレースホルダーを入力します。プレースホルダーは`{{ JSONパス }}`の形式で記述します。

| Source | Target | Template |
| --- | --- | --- |
| 空欄 | `messages[1].content` | `<think>{{ thinking }}</think>`の後に改行し、`{{ answer }}` |

実際の`Template`欄には、次のように入力します。

```text
<think>{{ thinking }}</think>
{{ answer }}
```

たとえば、レコードが次の内容だった場合、

```json
{
  "thinking": "根拠を確認します。",
  "answer": "答えは42です。"
}
```

同期後の値は次の文字列になります。

```text
<think>根拠を確認します。</think>
答えは42です。
```

テンプレートを使うルールでは、結果は常に文字列になります。プレースホルダーのパスが存在しない場合や値が`null`の場合、その部分は空文字列になります。

`Template`に値が入力されている場合は`Source`よりも`Template`が優先されるため、通常は`Source`を空欄にします。

### JSONパスの書き方

オブジェクトの階層は`.`、配列の位置は`[0]`のような0始まりのインデックスで指定します。

| 対象 | JSONパス |
| --- | --- |
| ルート直下の`question` | `question` |
| `metadata`内の`source` | `metadata.source` |
| `messages`の最初の要素 | `messages[0]` |
| 最初のmessageの`content` | `messages[0].content` |
| 2番目の候補の最初のラベル | `candidates[1].labels[0]` |

次の記法には対応していません。

- 先頭の`$`（例: `$.question`）
- ワイルドカード（例: `messages[*].content`）
- 負のインデックス（例: `messages[-1]`）
- フィルター式や条件式
- `.`や角括弧を含むキー名をエスケープして指定する記法

`Target`の途中に必要なオブジェクトや配列が存在しない場合は、自動的に作成されます。配列の離れた位置を指定すると、途中の要素は`null`で補われることがあります。

ただし、既存値の型とパスが矛盾する場合は同期に失敗します。たとえば`messages`が文字列なのに`messages[0].content`へ書き込むことはできません。

### よく使う設定例

#### question、thinking、answerを既存のmessagesへ同期する

次の2つのルールを、表の上から順に追加します。

| 順番 | Source | Target | Template |
| --- | --- | --- | --- |
| 1 | `question` | `messages[0].content` | 空欄 |
| 2 | 空欄 | `messages[1].content` | `<think>{{ thinking }}</think>`の後に改行し、`{{ answer }}` |

2番目の`Template`欄:

```text
<think>{{ thinking }}</think>
{{ answer }}
```

この設定は、`messages[0]`がユーザー、`messages[1]`がアシスタントであるデータを想定しています。`content`だけを書き換え、既存の`role`やその他のフィールドは保持します。

同期前:

```json
{
  "question": "日本の首都は？",
  "thinking": "日本の行政と政治の中心を確認します。",
  "answer": "東京です。",
  "messages": [
    { "role": "user", "content": "古い質問" },
    { "role": "assistant", "content": "古い回答" }
  ]
}
```

同期後:

```json
{
  "question": "日本の首都は？",
  "thinking": "日本の行政と政治の中心を確認します。",
  "answer": "東京です。",
  "messages": [
    { "role": "user", "content": "日本の首都は？" },
    {
      "role": "assistant",
      "content": "<think>日本の行政と政治の中心を確認します。</think>\n東京です。"
    }
  ]
}
```

#### messagesがないレコードにroleを含めて作成する

`messages`自体が存在しない場合、`content`のルールだけでは`role`は自動設定されません。次の4つのルールを使うと、`role`を含む基本的なmessages構造を作成できます。

| 順番 | Source | Target | Template |
| --- | --- | --- | --- |
| 1 | 空欄 | `messages[0].role` | `user` |
| 2 | `question` | `messages[0].content` | 空欄 |
| 3 | 空欄 | `messages[1].role` | `assistant` |
| 4 | 空欄 | `messages[1].content` | `<think>{{ thinking }}</think>`の後に改行し、`{{ answer }}` |

固定値の`user`や`assistant`を書き込む場合も、`Template`欄を使います。

### ルールの実行順序

複数のルールは、設定画面に表示されている上から順に実行されます。後のルールは、それより前のルールによる変更後の値を参照できます。

たとえば、最初のルールで`normalized.question`へ値を書き込み、次のルールのテンプレートで`{{ normalized.question }}`を参照できます。

同じ`Target`へ複数回書き込んだ場合は、最後に実行されたルールの値が残ります。

### 注意点とトラブルシューティング

- **編集直後は保存完了を待つ:** 「同期」を押す前に、保存状態が「保存済み」になっていることを確認してください。保存前に同期すると、プレビューが直前の保存内容を参照する可能性があります。
- **プレビューで必ず確認する:** `Target`の既存値は上書きされます。「同期を適用」の前に変更差分を確認してください。
- **変更が表示されない:** `Source`が存在しない、同期後の値が現在値と同じ、またはルールが保存されていない可能性があります。
- **テンプレートの一部が空になる:** 対応するプレースホルダーのパスが存在しないか、値が`null`です。JSONパスのスペルと配列番号を確認してください。
- **同期に失敗する:** `Target`が空欄になっていないか、既存のオブジェクト・配列の型とパスが矛盾していないか確認してください。
- **一括同期ではない:** ルールはプロジェクト共通ですが、「同期を適用」で変更されるのは現在の1レコードだけです。
- **自動同期ではない:** Autosaveは通常の編集内容を保存する機能であり、同期ルールを自動実行する機能ではありません。
- **高度なテンプレート処理はない:** 条件分岐、ループ、フィルター、計算、値の変換はできません。テンプレートは固定文字列とプレースホルダーの単純な置換です。

---

## English

### What Are Manual Sync Rules?

Manual Sync Rules copy a value from one JSON path to another within the same record, or combine multiple values with a template and write the result to another field.

Typical uses include:

- Copying `question` to `messages[0].content`
- Combining `thinking` and `answer` in `messages[1].content`
- Building a `messages` structure from existing fields

Rules are shared across the project, but sync is run manually for each record. Editing a field does not trigger a sync automatically.

Sync changes only the working copy inside Dataset Studio. It never modifies the imported JSONL file directly.

### Basic Setup

1. Open the target project and record.
2. Select the gear icon in the upper-right corner to open Project Settings.
3. Under Manual Sync Rules, select Rule.
4. Enter `Source`, `Target`, and, when needed, `Template`.
5. Add as many rules as needed, then select Save settings.
6. If you edited the record, wait until its save status is Saved.
7. Select Sync at the top of the record and review the before-and-after preview.
8. If the result is correct, select Apply Sync.

Opening the preview does not change the record. The changes are written to the current record's working copy only when you select Apply Sync.

### Fields in a Rule

| Field | Required | Description |
| --- | --- | --- |
| `Source` | Sometimes | The source JSON path. It is required when `Template` is blank. |
| `Target` | Yes | The destination JSON path. Any existing value at this path is overwritten. |
| `Template` | No | Builds a string from literal text and `{{ JSON path }}` placeholders. When present, the template is used instead of `Source`. |

There are two ways to write a rule.

#### 1. Copy a Value Without Changing It

Leave `Template` blank and specify both `Source` and `Target`.

| Source | Target | Template |
| --- | --- | --- |
| `question` | `messages[0].content` | Leave blank |

This method preserves the original JSON type, so it can copy not only strings but also numbers, booleans, arrays, and objects.

If the source path does not exist in the record, the rule is skipped without making a change.

#### 2. Build a String with a Template

Enter literal text and placeholders in `Template`. Write each placeholder as `{{ JSON path }}`.

| Source | Target | Template |
| --- | --- | --- |
| Leave blank | `messages[1].content` | `<think>{{ thinking }}</think>`, a newline, then `{{ answer }}` |

Enter the following text in the actual `Template` field:

```text
<think>{{ thinking }}</think>
{{ answer }}
```

For this record,

```json
{
  "thinking": "Check the reasoning.",
  "answer": "The answer is 42."
}
```

the synced value is:

```text
<think>Check the reasoning.</think>
The answer is 42.
```

A template rule always produces a string. If a placeholder path does not exist or its value is `null`, that placeholder becomes an empty string.

When `Template` contains a value, it takes precedence over `Source`, so `Source` is normally left blank.

### JSON Path Syntax

Use `.` for object nesting and a zero-based index such as `[0]` for an array element.

| Target value | JSON path |
| --- | --- |
| Root-level `question` | `question` |
| `source` inside `metadata` | `metadata.source` |
| First element of `messages` | `messages[0]` |
| `content` of the first message | `messages[0].content` |
| First label of the second candidate | `candidates[1].labels[0]` |

The following syntax is not supported:

- A leading `$`, such as `$.question`
- Wildcards, such as `messages[*].content`
- Negative indexes, such as `messages[-1]`
- Filters or conditional expressions
- Escaping syntax for key names that contain `.` or brackets

If intermediate objects or arrays in a `Target` path do not exist, Dataset Studio creates them. When a target uses a non-adjacent array index, intermediate elements may be filled with `null`.

Sync fails if an existing value has a type that conflicts with the path. For example, Dataset Studio cannot write to `messages[0].content` if `messages` is a string.

### Common Examples

#### Sync question, thinking, and answer to Existing messages

Add these two rules in the order shown:

| Order | Source | Target | Template |
| --- | --- | --- | --- |
| 1 | `question` | `messages[0].content` | Leave blank |
| 2 | Leave blank | `messages[1].content` | `<think>{{ thinking }}</think>`, a newline, then `{{ answer }}` |

Enter this in the second rule's `Template` field:

```text
<think>{{ thinking }}</think>
{{ answer }}
```

This setup assumes that `messages[0]` is the user message and `messages[1]` is the assistant message. It changes only `content` and preserves existing `role` and other fields.

Before sync:

```json
{
  "question": "What is the capital of Japan?",
  "thinking": "Identify Japan's administrative and political center.",
  "answer": "Tokyo.",
  "messages": [
    { "role": "user", "content": "Old question" },
    { "role": "assistant", "content": "Old answer" }
  ]
}
```

After sync:

```json
{
  "question": "What is the capital of Japan?",
  "thinking": "Identify Japan's administrative and political center.",
  "answer": "Tokyo.",
  "messages": [
    { "role": "user", "content": "What is the capital of Japan?" },
    {
      "role": "assistant",
      "content": "<think>Identify Japan's administrative and political center.</think>\nTokyo."
    }
  ]
}
```

#### Create messages, Including role, When It Does Not Exist

If the record has no `messages` field, content rules do not set `role` automatically. The following four rules create a basic messages structure that includes each role.

| Order | Source | Target | Template |
| --- | --- | --- | --- |
| 1 | Leave blank | `messages[0].role` | `user` |
| 2 | `question` | `messages[0].content` | Leave blank |
| 3 | Leave blank | `messages[1].role` | `assistant` |
| 4 | Leave blank | `messages[1].content` | `<think>{{ thinking }}</think>`, a newline, then `{{ answer }}` |

Use the `Template` field to write fixed values such as `user` and `assistant`.

### Rule Execution Order

Rules run from top to bottom in the order displayed in Project Settings. A later rule can read a value written by an earlier rule.

For example, one rule can write to `normalized.question`, and the next rule can refer to `{{ normalized.question }}` in its template.

If multiple rules write to the same `Target`, the value written by the last rule is retained.

### Notes and Troubleshooting

- **Wait for edits to be saved:** Before selecting Sync, confirm that the save status is Saved. Otherwise, the preview may use the previously saved record contents.
- **Always review the preview:** Sync overwrites existing values at each `Target`. Check the changes before selecting Apply Sync.
- **No changes appear:** The `Source` may be missing, the synced value may already match the current value, or the rules may not have been saved.
- **Part of a template is empty:** The corresponding placeholder path is missing or has a `null` value. Check the JSON path spelling and array index.
- **Sync fails:** Check that `Target` is not blank and that its path does not conflict with the types of existing objects and arrays.
- **Sync is not a bulk operation:** Rules are shared by the project, but Apply Sync changes only the current record.
- **Sync is not automatic:** Autosave saves normal edits; it does not run sync rules automatically.
- **Templates are intentionally simple:** They do not support conditions, loops, filters, calculations, or value transformations. A template performs only literal text and placeholder substitution.

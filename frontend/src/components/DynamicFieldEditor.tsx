import {
  ChevronDown,
  ChevronRight,
  Copy,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePreferences } from "../i18n";
import type { Json, SchemaStat } from "../types";

const kindOf = (value: Json) =>
  value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
const emptyFor = (kind: string): Json =>
  ({
    string: "",
    number: 0,
    boolean: false,
    null: null,
    object: {},
    array: [],
  })[kind] as Json;

function AutoGrowingTextarea({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const { fontSize } = usePreferences();
  const resize = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "0px";
    const borderHeight = element.offsetHeight - element.clientHeight;
    element.style.height = `${element.scrollHeight + borderHeight}px`;
  }, []);

  useLayoutEffect(resize, [resize, value]);
  useEffect(() => {
    const frame = requestAnimationFrame(resize);
    return () => cancelAnimationFrame(frame);
  }, [resize, fontSize]);
  useEffect(() => {
    const element = ref.current;
    let previousWidth = element?.clientWidth;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      if (element && element.clientWidth !== previousWidth) {
        previousWidth = element.clientWidth;
        resize();
      }
    });
    if (element) observer?.observe(element);
    window.addEventListener("resize", resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [resize]);

  return (
    <textarea
      ref={ref}
      className="auto-growing-textarea"
      rows={1}
      wrap="soft"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function DynamicFieldEditor({
  name,
  value,
  onChange,
  onDelete,
  path = name,
  schema = {},
}: {
  name: string;
  value: Json;
  onChange: (value: Json) => void;
  onDelete?: () => void;
  path?: string;
  schema?: Record<string, SchemaStat>;
}) {
  const { t } = usePreferences();
  const kind = kindOf(value);
  const isThinking = name.toLowerCase() === "thinking";
  return (
    <div
      className={`field ${path === "" ? "root-field" : ""} ${isThinking ? "thinking-field" : ""}`}
      data-testid={`field-${path}`}
    >
      <div className="field-head">
        <code>{name}</code>
        <span className="type-badge">
          {kind}
          {Array.isArray(value) && value.length ? `‹${kindOf(value[0])}›` : ""}
        </span>
        {onDelete && (
          <button
            className="icon ghost danger"
            onClick={onDelete}
            aria-label={`${t("Delete")} ${name}`}
            title={t("Delete field")}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {kind === "string" && (
        <AutoGrowingTextarea value={value as string} onChange={onChange} />
      )}
      {kind === "number" && (
        <input
          type="number"
          value={value as number}
          onChange={(e) =>
            onChange(e.target.value === "" ? 0 : Number(e.target.value))
          }
        />
      )}
      {kind === "boolean" && (
        <label className="switch">
          <input
            type="checkbox"
            checked={value as boolean}
            onChange={(e) => onChange(e.target.checked)}
          />
          <span>{value ? "true" : "false"}</span>
        </label>
      )}
      {kind === "null" && (
        <select
          value="null"
          onChange={(e) => onChange(emptyFor(e.target.value))}
          aria-label={`Choose type for ${name}`}
        >
          <option value="null">null</option>
          <option value="string">string</option>
          <option value="number">number</option>
          <option value="boolean">boolean</option>
          <option value="object">object</option>
          <option value="array">array</option>
        </select>
      )}
      {kind === "object" && (
        <ObjectEditor
          value={value as Record<string, Json>}
          onChange={onChange}
          path={path}
          schema={schema}
        />
      )}
      {kind === "array" &&
        (isMessages(value) ? (
          <MessageEditor value={value} onChange={onChange} />
        ) : (
          <ArrayEditor
            value={value as Json[]}
            onChange={onChange}
            path={path}
            schema={schema}
          />
        ))}
    </div>
  );
}

export function ObjectEditor({
  value,
  onChange,
  path = "",
  schema = {},
}: {
  value: Record<string, Json>;
  onChange: (value: Json) => void;
  path?: string;
  schema?: Record<string, SchemaStat>;
}) {
  const { t } = usePreferences();
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [key, setKey] = useState("");
  const [kind, setKind] = useState("string");
  const update = (name: string, next: Json) =>
    onChange({ ...value, [name]: next });
  const remove = (name: string) => {
    const next = { ...value };
    delete next[name];
    onChange(next);
  };
  const add = () => {
    if (!key || key in value) return;
    update(key, emptyFor(kind));
    setKey("");
    setAdding(false);
  };
  const entries = Object.entries(value);
  const primaryNames = new Set([
    "question",
    "thinking",
    "answer",
    "prompt",
    "response",
    "instruction",
    "input",
    "output",
  ]);
  let primaryEntries = entries.filter(([name]) =>
    primaryNames.has(name.toLowerCase()),
  );
  let secondaryEntries = entries.filter(
    ([name]) => !primaryNames.has(name.toLowerCase()),
  );
  if (!primaryEntries.length || !secondaryEntries.length) {
    const midpoint = Math.ceil(entries.length / 2);
    primaryEntries = entries.slice(0, midpoint);
    secondaryEntries = entries.slice(midpoint);
  }
  const renderEntry = ([name, item]: [string, Json]) => (
    <DynamicFieldEditor
      key={name}
      name={name}
      value={item}
      onChange={(next) => update(name, next)}
      onDelete={() => remove(name)}
      path={path ? `${path}.${name}` : name}
      schema={schema}
    />
  );
  const addFieldControl = adding ? (
    <div className="add-field">
      <input
        autoFocus
        placeholder="field_name"
        value={key}
        onChange={(e) => setKey(e.target.value)}
      />
      <select value={kind} onChange={(e) => setKind(e.target.value)}>
        <option>string</option>
        <option>number</option>
        <option>boolean</option>
        <option>null</option>
        <option>object</option>
        <option>array</option>
      </select>
      <button onClick={add}>{t("Add")}</button>
      <button className="ghost" onClick={() => setAdding(false)}>
        {t("Cancel")}
      </button>
    </div>
  ) : (
    <button className="add-button" onClick={() => setAdding(true)}>
      <Plus size={14} /> {t("Add field")}
    </button>
  );
  return (
    <div className="nested">
      <button className="fold" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{" "}
        {Object.keys(value).length} {t("fields")}
      </button>
      {open && (
        path === "" ? (
          <div className="object-fields root-fields">
            <div className="field-column field-column-primary">
              {primaryEntries.map(renderEntry)}
            </div>
            <div className="field-column field-column-secondary">
              {secondaryEntries.map(renderEntry)}
              {addFieldControl}
            </div>
          </div>
        ) : (
          <div className="object-fields">
            {entries.map(renderEntry)}
            {addFieldControl}
          </div>
        )
      )}
    </div>
  );
}

export function ArrayEditor({
  value,
  onChange,
  path = "",
  schema = {},
}: {
  value: Json[];
  onChange: (value: Json) => void;
  path?: string;
  schema?: Record<string, SchemaStat>;
}) {
  const { t } = usePreferences();
  const itemKind = value.length ? kindOf(value[0]) : "string";
  const move = (i: number, d: number) => {
    const n = [...value];
    const [x] = n.splice(i, 1);
    n.splice(i + d, 0, x);
    onChange(n);
  };
  return (
    <div className="array-editor" data-testid="array-editor">
      {value.map((item, i) => (
        <div className="array-row" key={i}>
          <GripVertical size={14} className="grip" />
          <div className="array-content">
            <DynamicFieldEditor
              name={`[${i}]`}
              value={item}
              path={`${path}[]`}
              schema={schema}
              onChange={(next) => {
                const n = [...value];
                n[i] = next;
                onChange(n);
              }}
            />
          </div>
          <div className="row-actions">
            <button
              className="icon ghost"
              disabled={i === 0}
              onClick={() => move(i, -1)}
              aria-label={t("Move up")}
            >
              ↑
            </button>
            <button
              className="icon ghost"
              disabled={i === value.length - 1}
              onClick={() => move(i, 1)}
              aria-label={t("Move down")}
            >
              ↓
            </button>
            <button
              className="icon ghost danger"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              aria-label={t("Delete item")}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
      <button
        className="add-button"
        onClick={() => onChange([...value, emptyFor(itemKind)])}
      >
        <Plus size={14} /> {t("Add item")}
      </button>
    </div>
  );
}

const isMessages = (value: Json): value is Array<Record<string, Json>> =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      !Array.isArray(item) &&
      typeof item.role === "string" &&
      typeof item.content === "string",
  );

export function MessageEditor({
  value,
  onChange,
}: {
  value: Array<Record<string, Json>>;
  onChange: (value: Json) => void;
}) {
  const { t } = usePreferences();
  const update = (i: number, key: string, next: Json) => {
    const copy = value.map((x) => ({ ...x }));
    copy[i][key] = next;
    onChange(copy);
  };
  const move = (i: number, d: number) => {
    const n = [...value];
    const [x] = n.splice(i, 1);
    n.splice(i + d, 0, x);
    onChange(n);
  };
  return (
    <div className="messages" data-testid="message-editor">
      {value.map((msg, i) => (
        <article className={`message role-${msg.role}`} key={i}>
          <div className="message-head">
            <select
              value={String(msg.role)}
              onChange={(e) => update(i, "role", e.target.value)}
              aria-label={`Role ${i}`}
            >
              <option>system</option>
              <option>user</option>
              <option>assistant</option>
              <option>tool</option>
              <option>developer</option>
              {!["system", "user", "assistant", "tool", "developer"].includes(
                String(msg.role),
              ) && <option>{String(msg.role)}</option>}
            </select>
            <div>
              <button
                className="icon ghost"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label={t("Move message up")}
              >
                ↑
              </button>
              <button
                className="icon ghost"
                disabled={i === value.length - 1}
                onClick={() => move(i, 1)}
                aria-label={t("Move message down")}
              >
                ↓
              </button>
              <button
                className="icon ghost"
                onClick={() =>
                  onChange([
                    ...value.slice(0, i + 1),
                    structuredClone(msg),
                    ...value.slice(i + 1),
                  ])
                }
                aria-label={t("Duplicate message")}
              >
                <Copy size={13} />
              </button>
              <button
                className="icon ghost danger"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                aria-label={t("Delete message")}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
          <AutoGrowingTextarea
            value={String(msg.content)}
            onChange={(next) => update(i, "content", next)}
          />
          {Object.entries(msg)
            .filter(([k]) => k !== "role" && k !== "content")
            .map(([k, v]) => (
              <DynamicFieldEditor
                key={k}
                name={k}
                value={v}
                onChange={(next) => update(i, k, next)}
              />
            ))}
        </article>
      ))}
      <button
        className="add-button"
        onClick={() => onChange([...value, { role: "user", content: "" }])}
      >
        <Plus size={14} /> {t("Add message")}
      </button>
    </div>
  );
}

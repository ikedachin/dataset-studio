import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import CodeMirror, { EditorView } from "@uiw/react-codemirror";

export default function RawCodeEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <CodeMirror
      className="raw-code-editor"
      value={value}
      height="calc(100vh - 190px)"
      theme={oneDark}
      extensions={[json(), EditorView.lineWrapping]}
      onChange={onChange}
      aria-label="Raw JSON editor"
      basicSetup={{
        foldGutter: true,
        bracketMatching: true,
        autocompletion: true,
        lineNumbers: true,
      }}
    />
  );
}

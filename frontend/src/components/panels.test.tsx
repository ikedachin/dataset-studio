import { fireEvent, render, screen } from "@testing-library/react";
import { SidePanel } from "./SidePanel";
import type { DatasetRecord } from "../types";

vi.mock("./RawCodeEditor", () => ({
  default: (props: { value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="Raw JSON editor"
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
    />
  ),
}));

const record: DatasetRecord = {
  id: 1,
  split_id: 1,
  position: 0,
  preview: "x",
  original_json: { text: "a" },
  current_json: { text: "b" },
  status: "edited",
  is_new: false,
  is_deleted: false,
  version: 2,
  validation_status: "warning",
  validation_issues: [
    { level: "warning", path: "text", message: "Expected mostly number" },
  ],
};
test("Diff display shows structural paths and values", () => {
  render(
    <SidePanel
      record={record}
      diff={[{ path: "$.text", kind: "modified", before: "a", after: "b" }]}
      onApplyRaw={() => {}}
    />,
  );
  expect(screen.getByTestId("diff-panel")).toHaveTextContent("$.text");
  expect(screen.getByTestId("diff-panel")).toHaveTextContent('"a"');
});
test("Validation display shows issues", () => {
  render(<SidePanel record={record} diff={[]} onApplyRaw={() => {}} />);
  fireEvent.click(screen.getByText("Validate"));
  expect(screen.getByTestId("validation-panel")).toHaveTextContent(
    "Expected mostly number",
  );
});
test("Raw JSON rejects arrays and applies objects", async () => {
  const apply = vi.fn();
  render(<SidePanel record={record} diff={[]} onApplyRaw={apply} />);
  fireEvent.click(screen.getByText("Raw JSON"));
  const editor = await screen.findByRole("textbox");
  fireEvent.change(editor, { target: { value: "[]" } });
  fireEvent.click(screen.getByText("Apply"));
  expect(screen.getByText("Top level must be an object")).toBeInTheDocument();
  fireEvent.change(editor, {
    target: { value: '{"ok":true}' },
  });
  fireEvent.click(screen.getByText("Apply"));
  expect(apply).toHaveBeenCalledWith({ ok: true });
});

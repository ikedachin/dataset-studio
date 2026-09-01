import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { api } from "../api";
import { PreferencesProvider } from "../i18n";
import type { Project } from "../types";
import { ProjectTools } from "./ProjectTools";

afterEach(() => vi.restoreAllMocks());

const project: Project = {
  id: 1,
  name: "sample",
  source_type: "local",
  source_metadata: {},
  inferred_schema: {},
  sync_rules: [],
  required_fields: [],
  identifier_field: null,
  splits: [],
};

test("Project settings includes Japanese message sync help", () => {
  localStorage.setItem("dataset-studio-language", "ja");
  render(
    <PreferencesProvider>
      <ProjectTools
        project={project}
        onClose={() => {}}
        onUpdated={() => {}}
        onDeleted={() => {}}
      />
    </PreferencesProvider>,
  );
  expect(
    screen.getByText("question・thinking・answerをmessagesへ同期する方法"),
  ).toBeInTheDocument();
  expect(screen.getByText("messages[0].content")).toBeInTheDocument();
  expect(
    screen.getByText(
      (_, element) =>
        element?.tagName === "CODE" &&
        element.textContent === "<think>{{ thinking }}</think>\n{{ answer }}",
    ),
  ).toBeInTheDocument();
});

test("Validate saves the current identifier path before validation", async () => {
  localStorage.setItem("dataset-studio-language", "ja");
  const update = vi
    .spyOn(api, "updateProject")
    .mockResolvedValue({ ...project, identifier_field: "item_id" });
  const validate = vi
    .spyOn(api, "validateProject")
    .mockResolvedValue({ total: 1, valid: 0, warning: 0, error: 1 });
  const onUpdated = vi.fn();
  render(
    <PreferencesProvider>
      <ProjectTools
        project={project}
        onClose={() => {}}
        onUpdated={onUpdated}
        onDeleted={() => {}}
      />
    </PreferencesProvider>,
  );
  fireEvent.change(screen.getByPlaceholderText("id"), {
    target: { value: "item_id" },
  });
  fireEvent.click(screen.getByText("データセットを検証"));
  await waitFor(() => expect(validate).toHaveBeenCalledWith(project.id));
  expect(update).toHaveBeenCalledWith(
    project.id,
    expect.objectContaining({ identifier_field: "item_id" }),
  );
  expect(update.mock.invocationCallOrder[0]).toBeLessThan(
    validate.mock.invocationCallOrder[0],
  );
  expect(onUpdated).toHaveBeenCalledWith(
    expect.objectContaining({ identifier_field: "item_id" }),
    false,
  );
});

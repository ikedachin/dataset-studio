import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { api } from './api'
import type { DatasetRecord, Project } from './types'

vi.mock('./components/RecordList', () => ({ RecordList: () => null }))
vi.mock('./components/SidePanel', () => ({ SidePanel: () => null }))

const record: DatasetRecord = {
  id: 1, split_id: 1, position: 0, preview: 'abcdef',
  original_json: { text: 'abcdef', other: 'second' },
  current_json: { text: 'abcdef', other: 'second' },
  status: 'unedited', is_new: false, is_deleted: false, version: 1,
  validation_status: 'valid', validation_issues: [],
}
const project: Project = {
  id: 1, name: 'Test', source_type: 'local', source_metadata: {},
  inferred_schema: {}, sync_rules: [], required_fields: [], identifier_field: null,
  splits: [{ id: 1, name: 'train', position: 0, record_count: 1 }],
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

async function setup() {
  vi.useFakeTimers()
  vi.spyOn(api, 'projects').mockResolvedValue([project])
  vi.spyOn(api, 'records').mockResolvedValue({ items: [record], total: 1 })
  vi.spyOn(api, 'record').mockResolvedValue(record)
  vi.spyOn(api, 'diff').mockResolvedValue({ changes: [] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(['projects'], [project])
  client.setQueryData(['record', 1], record)
  const params = 'offset=0&limit=500&search=&status=all&include_deleted=false'
  client.setQueryData(['records', 1, params], { items: [record], total: 1 })
  render(<QueryClientProvider client={client}><App /></QueryClientProvider>)
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  return { client, textarea: screen.getByDisplayValue('abcdef') as HTMLTextAreaElement }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

test('save responses preserve newer text, focus and caret, and save the latest snapshot', async () => {
  const { textarea } = await setup()
  const first = deferred<DatasetRecord>()
  const second = deferred<DatasetRecord>()
  const save = vi.spyOn(api, 'save').mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  textarea.focus()
  fireEvent.change(textarea, { target: { value: 'abXcdef' } })
  await act(async () => { await vi.advanceTimersByTimeAsync(700) })
  expect(save).toHaveBeenCalledWith(1, { text: 'abXcdef', other: 'second' }, 1)
  fireEvent.change(textarea, { target: { value: 'abXYcdef' } })
  textarea.setSelectionRange(4, 4)
  await act(async () => {
    first.resolve({ ...record, version: 2, current_json: { text: 'abXcdef', other: 'second' } })
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(textarea).toHaveValue('abXYcdef')
  expect(textarea).toHaveFocus()
  expect(textarea.selectionStart).toBe(4)
  expect(save).toHaveBeenLastCalledWith(1, { text: 'abXYcdef', other: 'second' }, 2)
  await act(async () => {
    second.resolve({ ...record, version: 3, current_json: { text: 'abXYcdef', other: 'second' } })
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(textarea.selectionStart).toBe(4)
  expect(textarea).toHaveValue('abXYcdef')
})

test('leaving a cell saves immediately without overwriting edits in the next cell', async () => {
  const { textarea } = await setup()
  const first = deferred<DatasetRecord>()
  const save = vi.spyOn(api, 'save').mockReturnValueOnce(first.promise)
    .mockImplementation(async (_id, value) => ({ ...record, version: 3, current_json: value }))
  fireEvent.change(textarea, { target: { value: 'changed' } })
  const other = screen.getByDisplayValue('second') as HTMLTextAreaElement
  fireEvent.blur(textarea, { relatedTarget: other })
  await act(async () => { await Promise.resolve() })
  expect(save).toHaveBeenCalledTimes(1)
  other.focus()
  fireEvent.change(other, { target: { value: 'secXond' } })
  other.setSelectionRange(4, 4)
  await act(async () => {
    first.resolve({ ...record, version: 2, current_json: { text: 'changed', other: 'second' } })
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(other).toHaveValue('secXond')
  expect(other.selectionStart).toBe(4)
  expect(other).toHaveFocus()
  expect(save).toHaveBeenLastCalledWith(1, { text: 'changed', other: 'secXond' }, 2)
})

test('background record refresh cannot replace unsaved edits', async () => {
  const { client, textarea } = await setup()
  fireEvent.change(textarea, { target: { value: 'abXcdef' } })
  textarea.setSelectionRange(3, 3)
  await act(async () => {
    client.setQueryData(['record', 1], { ...record, version: 2, current_json: { text: 'server text', other: 'second' } })
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(textarea).toHaveValue('abXcdef')
  expect(textarea.selectionStart).toBe(3)
})

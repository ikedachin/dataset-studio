import { act, renderHook } from '@testing-library/react'
import { useAutosave } from './useAutosave'

test('overlapping flush and debounce serialize saves and flush waits for all edits', async () => {
  vi.useFakeTimers()
  const resolvers: Array<() => void> = []
  const save = vi.fn(() => new Promise<void>(resolve => resolvers.push(resolve)))
  const { result, unmount } = renderHook(() => useAutosave(save))
  act(() => result.current.schedule({ text: 'first' }))
  await act(async () => { await vi.advanceTimersByTimeAsync(700) })
  act(() => result.current.schedule({ text: 'second' }))
  let flushed = false
  let flush!: Promise<void>
  await act(async () => {
    flush = result.current.flush().then(() => { flushed = true })
    await vi.advanceTimersByTimeAsync(700)
  })
  expect(save).toHaveBeenCalledTimes(1)
  expect(flushed).toBe(false)
  await act(async () => { resolvers[0]() })
  expect(save).toHaveBeenCalledTimes(2)
  expect(flushed).toBe(false)
  expect(save).toHaveBeenLastCalledWith({ text: 'second' })
  await act(async () => { resolvers[1](); await flush })
  expect(flushed).toBe(true)
  expect(result.current.state).toBe('Saved')
  unmount()
  vi.useRealTimers()
})

test('a failed save keeps its snapshot for an explicit retry', async () => {
  const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
  const { result } = renderHook(() => useAutosave(save))
  act(() => result.current.schedule({ text: 'keep me' }))
  await act(async () => { expect(await result.current.flush()).toBe(false) })
  expect(result.current.state).toBe('Error')
  await act(async () => { expect(await result.current.flush()).toBe(true) })
  expect(save).toHaveBeenNthCalledWith(2, { text: 'keep me' })
  expect(result.current.state).toBe('Saved')
})

test('autosave debounces edits and flush saves immediately',async()=>{vi.useFakeTimers();const save=vi.fn().mockResolvedValue(undefined);const {result}=renderHook(()=>useAutosave(save,700));act(()=>result.current.schedule({text:'one'}));act(()=>result.current.schedule({text:'two'}));expect(save).not.toHaveBeenCalled();await act(async()=>{vi.advanceTimersByTime(700);await Promise.resolve()});expect(save).toHaveBeenCalledTimes(1);expect(save).toHaveBeenCalledWith({text:'two'});act(()=>result.current.schedule({text:'three'}));await act(async()=>{await result.current.flush()});expect(save).toHaveBeenLastCalledWith({text:'three'});vi.useRealTimers()})

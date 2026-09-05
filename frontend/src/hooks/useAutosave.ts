import { useCallback, useEffect, useRef, useState } from 'react'
import type { JsonObject } from '../types'

export type SaveState = 'Saved' | 'Saving…' | 'Unsaved' | 'Error'
export function useAutosave(save: (value: JsonObject) => Promise<void>, delay = 700) {
  const [state, setState] = useState<SaveState>('Saved')
  const timer = useRef<number | undefined>(undefined)
  const pending = useRef<JsonObject | null>(null)
  const saving = useRef<Promise<void> | null>(null)

  const run = useCallback((): Promise<void> => {
    // Blur, debounce and explicit saves share one serialized queue.
    if (saving.current) return saving.current
    if (!pending.current) return Promise.resolve()
    const task = Promise.resolve().then(async () => {
      while (pending.current) {
        const value = pending.current
        pending.current = null
        window.clearTimeout(timer.current)
        setState('Saving…')
        try {
          await save(value)
        } catch {
          // Retain the latest edits for the next save attempt.
          pending.current ??= value
          window.clearTimeout(timer.current)
          setState('Error')
          return
        }
      }
      setState('Saved')
    }).finally(() => { saving.current = null })
    saving.current = task
    return task
  }, [save])
  const schedule = useCallback((value: JsonObject) => {
    pending.current = value
    setState('Unsaved')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void run(), delay)
  }, [delay, run])
  const flush = useCallback(async () => {
    window.clearTimeout(timer.current)
    await run()
    return pending.current === null
  }, [run])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  return { state, schedule, flush }
}

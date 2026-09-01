import { useCallback, useEffect, useRef, useState } from 'react'
import type { JsonObject } from '../types'

export type SaveState = 'Saved'|'Saving…'|'Unsaved'|'Error'
export function useAutosave(save:(value:JsonObject)=>Promise<void>, delay=700) {
  const [state,setState]=useState<SaveState>('Saved'); const timer=useRef<number|undefined>(undefined); const pending=useRef<JsonObject|null>(null); const saving=useRef<Promise<void>|null>(null)
  const run=useCallback(async()=>{if(!pending.current)return;const value=pending.current;pending.current=null;window.clearTimeout(timer.current);setState('Saving…');const task=save(value).then(()=>setState(pending.current?'Unsaved':'Saved')).catch(()=>setState('Error'));saving.current=task;await task;saving.current=null;if(pending.current)void run()},[save])
  const schedule=useCallback((value:JsonObject)=>{pending.current=value;setState('Unsaved');window.clearTimeout(timer.current);timer.current=window.setTimeout(()=>void run(),delay)},[delay,run])
  const flush=useCallback(async()=>{window.clearTimeout(timer.current);if(saving.current)await saving.current;if(pending.current)await run()},[run])
  useEffect(()=>()=>window.clearTimeout(timer.current),[])
  return {state,schedule,flush}
}

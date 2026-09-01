import { act, renderHook } from '@testing-library/react'
import { useAutosave } from './useAutosave'

test('autosave debounces edits and flush saves immediately',async()=>{vi.useFakeTimers();const save=vi.fn().mockResolvedValue(undefined);const {result}=renderHook(()=>useAutosave(save,700));act(()=>result.current.schedule({text:'one'}));act(()=>result.current.schedule({text:'two'}));expect(save).not.toHaveBeenCalled();await act(async()=>{vi.advanceTimersByTime(700);await Promise.resolve()});expect(save).toHaveBeenCalledTimes(1);expect(save).toHaveBeenCalledWith({text:'two'});act(()=>result.current.schedule({text:'three'}));await act(async()=>{await result.current.flush()});expect(save).toHaveBeenLastCalledWith({text:'three'});vi.useRealTimers()})


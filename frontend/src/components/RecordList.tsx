import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import type { RecordSummary } from '../types'

const symbol = (record:RecordSummary) => record.is_deleted?'×':record.validation_status==='error'?'⚠':record.is_new?'+':record.status==='edited'?'●':'○'
export function RecordList({records,total,selected,onSelect}:{records:RecordSummary[];total:number;selected?:number;onSelect:(id:number)=>void}) {
  const parent=useRef<HTMLDivElement>(null); const virtualizer=useVirtualizer({count:records.length,getScrollElement:()=>parent.current,estimateSize:()=>52,overscan:8})
  return <div className="record-scroll" ref={parent} data-testid="record-list"><div style={{height:virtualizer.getTotalSize(),position:'relative'}}>{virtualizer.getVirtualItems().map(row=>{const record=records[row.index]; return <button key={record.id} className={`record-item ${selected===record.id?'selected':''}`} style={{position:'absolute',transform:`translateY(${row.start}px)`,height:row.size}} onClick={()=>onSelect(record.id)}><span className={`record-state state-${record.validation_status}`}>{symbol(record)}</span><span className="record-copy"><b>{String(record.position+1).padStart(6,'0')}</b><small>{record.preview}</small></span></button>})}</div>{records.length<total&&<div className="list-note">Showing {records.length} of {total}. Refine search or scroll pages.</div>}</div>
}


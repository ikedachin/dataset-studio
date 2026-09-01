import { ChevronDown, ChevronRight, Copy, GripVertical, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { Json, SchemaStat } from '../types'

const kindOf = (value: Json) => value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
const emptyFor = (kind: string): Json => ({ string: '', number: 0, boolean: false, null: null, object: {}, array: [] }[kind] as Json)

export function DynamicFieldEditor({name, value, onChange, onDelete, path = name, schema = {}}: {name: string; value: Json; onChange: (value: Json) => void; onDelete?: () => void; path?: string; schema?: Record<string, SchemaStat>}) {
  const kind = kindOf(value)
  const stat = schema[path]
  const long = typeof value === 'string' && (value.length > 100 || value.includes('\n') || (stat?.max_length ?? 0) > 180 || (stat?.multiline_ratio ?? 0) > .2)
  return <div className="field" data-testid={`field-${path}`}>
    <div className="field-head"><code>{name}</code><span className="type-badge">{kind}{Array.isArray(value) && value.length ? `‹${kindOf(value[0])}›` : ''}</span>{onDelete && <button className="icon ghost danger" onClick={onDelete} aria-label={`Delete ${name}`} title="Delete field"><Trash2 size={13}/></button>}</div>
    {kind === 'string' && (long ? <textarea value={value as string} onChange={e=>onChange(e.target.value)} /> : <input value={value as string} onChange={e=>onChange(e.target.value)} />)}
    {kind === 'number' && <input type="number" value={value as number} onChange={e=>onChange(e.target.value === '' ? 0 : Number(e.target.value))}/>} 
    {kind === 'boolean' && <label className="switch"><input type="checkbox" checked={value as boolean} onChange={e=>onChange(e.target.checked)}/><span>{value ? 'true' : 'false'}</span></label>}
    {kind === 'null' && <select value="null" onChange={e=>onChange(emptyFor(e.target.value))} aria-label={`Choose type for ${name}`}><option value="null">null</option><option value="string">string</option><option value="number">number</option><option value="boolean">boolean</option><option value="object">object</option><option value="array">array</option></select>}
    {kind === 'object' && <ObjectEditor value={value as Record<string, Json>} onChange={onChange} path={path} schema={schema}/>} 
    {kind === 'array' && (isMessages(value) ? <MessageEditor value={value} onChange={onChange}/> : <ArrayEditor value={value as Json[]} onChange={onChange} path={path} schema={schema}/>)}
  </div>
}

export function ObjectEditor({value, onChange, path = '', schema = {}}: {value: Record<string, Json>; onChange:(value:Json)=>void; path?:string; schema?:Record<string,SchemaStat>}) {
  const [open, setOpen] = useState(true); const [adding, setAdding] = useState(false); const [key, setKey] = useState(''); const [kind, setKind] = useState('string')
  const update = (name:string, next:Json) => onChange({...value, [name]:next})
  const remove = (name:string) => { const next={...value}; delete next[name]; onChange(next) }
  const add = () => { if (!key || key in value) return; update(key, emptyFor(kind)); setKey(''); setAdding(false) }
  return <div className="nested"><button className="fold" onClick={()=>setOpen(!open)}>{open?<ChevronDown size={14}/>:<ChevronRight size={14}/>} {Object.keys(value).length} fields</button>{open && <div className="object-fields">{Object.entries(value).map(([name,item])=><DynamicFieldEditor key={name} name={name} value={item} onChange={next=>update(name,next)} onDelete={()=>remove(name)} path={path?`${path}.${name}`:name} schema={schema}/>)}
  {adding ? <div className="add-field"><input autoFocus placeholder="field_name" value={key} onChange={e=>setKey(e.target.value)}/><select value={kind} onChange={e=>setKind(e.target.value)}><option>string</option><option>number</option><option>boolean</option><option>null</option><option>object</option><option>array</option></select><button onClick={add}>Add</button><button className="ghost" onClick={()=>setAdding(false)}>Cancel</button></div> : <button className="add-button" onClick={()=>setAdding(true)}><Plus size={14}/> Add field</button>}</div>}</div>
}

export function ArrayEditor({value, onChange, path='', schema={}}:{value:Json[];onChange:(value:Json)=>void;path?:string;schema?:Record<string,SchemaStat>}) {
  const itemKind = value.length ? kindOf(value[0]) : 'string'; const move=(i:number,d:number)=>{const n=[...value];const [x]=n.splice(i,1);n.splice(i+d,0,x);onChange(n)}
  return <div className="array-editor" data-testid="array-editor">{value.map((item,i)=><div className="array-row" key={i}><GripVertical size={14} className="grip"/><div className="array-content"><DynamicFieldEditor name={`[${i}]`} value={item} path={`${path}[]`} schema={schema} onChange={next=>{const n=[...value];n[i]=next;onChange(n)}}/></div><div className="row-actions"><button className="icon ghost" disabled={i===0} onClick={()=>move(i,-1)} aria-label="Move up">↑</button><button className="icon ghost" disabled={i===value.length-1} onClick={()=>move(i,1)} aria-label="Move down">↓</button><button className="icon ghost danger" onClick={()=>onChange(value.filter((_,j)=>j!==i))} aria-label="Delete item"><Trash2 size={13}/></button></div></div>)}<button className="add-button" onClick={()=>onChange([...value,emptyFor(itemKind)])}><Plus size={14}/> Add item</button></div>
}

const isMessages = (value: Json): value is Array<Record<string,Json>> => Array.isArray(value) && value.length > 0 && value.every(item=>typeof item==='object' && item!==null && !Array.isArray(item) && typeof item.role==='string' && typeof item.content==='string')

export function MessageEditor({value,onChange}:{value:Array<Record<string,Json>>;onChange:(value:Json)=>void}) {
  const update=(i:number,key:string,next:Json)=>{const copy=value.map(x=>({...x}));copy[i][key]=next;onChange(copy)}; const move=(i:number,d:number)=>{const n=[...value];const [x]=n.splice(i,1);n.splice(i+d,0,x);onChange(n)}
  return <div className="messages" data-testid="message-editor">{value.map((msg,i)=><article className={`message role-${msg.role}`} key={i}><div className="message-head"><select value={String(msg.role)} onChange={e=>update(i,'role',e.target.value)} aria-label={`Role ${i}`}><option>system</option><option>user</option><option>assistant</option><option>tool</option><option>developer</option>{!['system','user','assistant','tool','developer'].includes(String(msg.role))&&<option>{String(msg.role)}</option>}</select><div><button className="icon ghost" disabled={i===0} onClick={()=>move(i,-1)} aria-label="Move message up">↑</button><button className="icon ghost" disabled={i===value.length-1} onClick={()=>move(i,1)} aria-label="Move message down">↓</button><button className="icon ghost" onClick={()=>onChange([...value.slice(0,i+1),structuredClone(msg),...value.slice(i+1)])} aria-label="Duplicate message"><Copy size={13}/></button><button className="icon ghost danger" onClick={()=>onChange(value.filter((_,j)=>j!==i))} aria-label="Delete message"><Trash2 size={13}/></button></div></div><textarea value={String(msg.content)} onChange={e=>update(i,'content',e.target.value)}/>{Object.entries(msg).filter(([k])=>k!=='role'&&k!=='content').map(([k,v])=><DynamicFieldEditor key={k} name={k} value={v} onChange={next=>update(i,k,next)}/>)}</article>)}<button className="add-button" onClick={()=>onChange([...value,{role:'user',content:''}])}><Plus size={14}/> Add message</button></div>
}

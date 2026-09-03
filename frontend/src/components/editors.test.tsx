import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { ArrayEditor, DynamicFieldEditor, MessageEditor } from './DynamicFieldEditor'
import type { Json } from '../types'

function Harness({initial}:{initial:Json}){const [value,setValue]=useState(initial);return <><DynamicFieldEditor name="root" value={value} onChange={setValue}/><output>{JSON.stringify(value)}</output></>}

test('DynamicFieldEditor edits nested fields without losing siblings',()=>{render(<Harness initial={{title:'old',metadata:{score:1,keep:true}}}/>);fireEvent.change(screen.getByDisplayValue('old'),{target:{value:'new'}});expect(screen.getByText(/"title":"new"/)).toHaveTextContent('"keep":true')})

test('DynamicFieldEditor adds a typed field',()=>{render(<Harness initial={{title:'x'}}/>);fireEvent.click(screen.getByText('Add field'));fireEvent.change(screen.getByPlaceholderText('field_name'),{target:{value:'enabled'}});fireEvent.change(screen.getByDisplayValue('string'),{target:{value:'boolean'}});fireEvent.click(screen.getByRole('button',{name:'Add'}));expect(screen.getByText(/"enabled":false/)).toBeInTheDocument()})

test('MessageEditor edits content and preserves unknown metadata',()=>{const Wrapper=()=>{const [value,setValue]=useState<Json>([{role:'assistant',content:'before',metadata:{model:'x'}}]);return <><MessageEditor value={value as Array<Record<string,Json>>} onChange={setValue}/><output>{JSON.stringify(value)}</output></>};render(<Wrapper/>);fireEvent.change(screen.getByDisplayValue('before'),{target:{value:'after'}});expect(screen.getByText(/"content":"after"/)).toHaveTextContent('"metadata":{"model":"x"}')})

test('MessageEditor duplicates and deletes messages',()=>{const change=vi.fn();const {rerender}=render(<MessageEditor value={[{role:'user',content:'a'}]} onChange={change}/>);fireEvent.click(screen.getByLabelText('Duplicate message'));expect(change).toHaveBeenCalledWith([{role:'user',content:'a'},{role:'user',content:'a'}]);rerender(<MessageEditor value={[{role:'user',content:'a'},{role:'assistant',content:'b'}]} onChange={change}/>);fireEvent.click(screen.getAllByLabelText('Delete message')[0]);expect(change).toHaveBeenLastCalledWith([{role:'assistant',content:'b'}])})

test('ArrayEditor supports add, delete, and reorder',()=>{const change=vi.fn();const {rerender}=render(<ArrayEditor value={['a','b']} onChange={change}/>);fireEvent.click(screen.getAllByLabelText('Move down')[0]);expect(change).toHaveBeenCalledWith(['b','a']);fireEvent.click(screen.getByText('Add item'));expect(change).toHaveBeenCalledWith(['a','b','']);rerender(<ArrayEditor value={['a','b']} onChange={change}/>);fireEvent.click(screen.getAllByLabelText('Delete item')[0]);expect(change).toHaveBeenLastCalledWith(['b'])})

test('Top-level records split into two columns and strings use auto-growing textareas',()=>{const {container}=render(<DynamicFieldEditor name="record" path="" value={{id:'1',question:'q',thinking:'full reasoning',answer:'a',metadata:{}}} onChange={()=>{}}/>);expect(container.querySelectorAll('.field-column')).toHaveLength(2);for(const value of ['1','q','full reasoning','a']) expect(screen.getByDisplayValue(value)).toHaveClass('auto-growing-textarea')})

test('String fields grow and shrink while preserving multiline values and focus', () => {
  render(<Harness initial="short" />)
  const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
  Object.defineProperties(textarea, {
    scrollHeight: { configurable: true, get: () => textarea.value.length > 100 ? 240 : 24 },
    offsetHeight: { configurable: true, get: () => 2 },
    clientHeight: { configurable: true, get: () => 0 },
  })
  textarea.focus()
  const longValue = 'long text '.repeat(30) + '\nsecond line'
  fireEvent.change(textarea, { target: { value: longValue } })
  expect(textarea.style.height).toBe('242px')
  expect(textarea).toHaveFocus()
  expect(screen.getByRole('status').textContent).toBe(JSON.stringify(longValue))
  fireEvent.change(textarea, { target: { value: 'short again' } })
  expect(textarea.style.height).toBe('26px')
  expect(textarea).toHaveFocus()
})

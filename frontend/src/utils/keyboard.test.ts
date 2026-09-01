import { shortcutAction } from './keyboard'

const target=(tag:string)=>({tagName:tag}) as HTMLElement
test('keyboard shortcuts work on macOS and Windows',()=>{expect(shortcutAction({key:'s',metaKey:true,ctrlKey:false,target:target('DIV')})).toBe('save');expect(shortcutAction({key:'Enter',metaKey:false,ctrlKey:true,target:target('DIV')})).toBe('save-next');expect(shortcutAction({key:'f',metaKey:true,ctrlKey:false,target:target('DIV')})).toBe('search')})
test('arrow navigation ignores editable elements',()=>{expect(shortcutAction({key:'ArrowRight',metaKey:false,ctrlKey:false,target:target('DIV')})).toBe('next');expect(shortcutAction({key:'ArrowLeft',metaKey:false,ctrlKey:false,target:target('TEXTAREA')})).toBeNull()})

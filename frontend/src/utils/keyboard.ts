export type ShortcutAction = 'save'|'save-next'|'search'|'previous'|'next'|null
export function shortcutAction(event: Pick<KeyboardEvent,'key'|'metaKey'|'ctrlKey'|'target'>):ShortcutAction {
  const modifier=event.metaKey||event.ctrlKey
  if(modifier&&event.key.toLowerCase()==='s')return 'save'
  if(modifier&&event.key==='Enter')return 'save-next'
  if(modifier&&event.key.toLowerCase()==='f')return 'search'
  const tag=(event.target as HTMLElement|null)?.tagName
  if(!modifier&&!['INPUT','TEXTAREA','SELECT'].includes(tag??'')){
    if(event.key==='ArrowLeft')return 'previous'
    if(event.key==='ArrowRight')return 'next'
  }
  return null
}


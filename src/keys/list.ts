import {
  liftListItem,
  sinkListItem,
  splitListItem,
  wrapInList,
} from 'prosemirror-schema-list'
import { schema } from '../schema'
import { EditorAction } from '../types'

const listKeymap: { [key: string]: EditorAction } = {
  'Shift-Ctrl-8': wrapInList(schema.nodes.bullet_list),
  'Shift-Ctrl-9': wrapInList(schema.nodes.ordered_list),
  Enter: splitListItem(schema.nodes.list_item),
  'Mod-[': liftListItem(schema.nodes.list_item),
  'Mod-]': sinkListItem(schema.nodes.list_item),
  'Shift-Tab': liftListItem(schema.nodes.list_item), // outdent, same as Mod-[
  Tab: sinkListItem(schema.nodes.list_item), // indent, same as Mod-]
}

export default listKeymap

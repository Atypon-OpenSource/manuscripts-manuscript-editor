/*!
 * © 2019 Atypon Systems LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  ManuscriptEditorView,
  ManuscriptSlice,
  schema,
} from '@manuscripts/transform'
import { Fragment, Slice } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import { findParentNode } from 'prosemirror-utils'

import { createTableFromSlice } from './table'

const removeFirstParagraphIfEmpty = (slice: ManuscriptSlice) => {
  const firstChild = slice.content.firstChild

  if (
    firstChild &&
    firstChild.type === firstChild.type.schema.nodes.paragraph &&
    firstChild.textContent === ''
  ) {
    // @ts-ignore
    slice.content = slice.content.cut(firstChild.nodeSize)
  }
}

// remove `id` from pasted content
const removeIDs = (slice: ManuscriptSlice) => {
  slice.content.descendants((node) => {
    if (node.attrs.id) {
      // @ts-ignore
      node.attrs.id = null
    }
  })
}

const wrapInSection = (slice: ManuscriptSlice) => {
  if (slice.content.firstChild?.type === schema.nodes.section_title) {
    // @ts-ignore
    slice.content = Fragment.from(
      schema.nodes.section.create({}, slice.content)
    )
  }
}

export const transformPasted = (slice: ManuscriptSlice): ManuscriptSlice => {
  wrapInSection(slice)

  removeFirstParagraphIfEmpty(slice)

  removeIDs(slice)

  return slice
}

export const handlePaste = (
  view: ManuscriptEditorView,
  event: ClipboardEvent,
  slice: Slice
) => {
  if (event.type !== 'paste') {
    return false
  }

  const {
    state: { tr, selection },
    dispatch,
  } = view

  tr.setMeta('uiEvent', 'paste')
  tr.setMeta('paste', true)

  const parent = findParentNode((node) => node.type === schema.nodes.section)(
    tr.selection
  )

  if (
    slice.content.firstChild &&
    (slice.content.firstChild.type == schema.nodes.table_row ||
      slice.content.firstChild.type == schema.nodes.table_cell)
  ) {
    const newTable = createTableFromSlice(slice, view.state.schema)
    if (newTable) {
      const tr = view.state.tr.insert(
        view.state.selection.$anchor.pos,
        newTable
      )
      view.dispatch(tr)
      return true
    }
  }

  if (slice.content.firstChild?.type === schema.nodes.section && parent) {
    const $pos = tr.doc.resolve(parent.start)
    const insertPos = $pos.after($pos.depth)
    tr.insert(insertPos, slice.content)
    dispatch(
      tr.setSelection(TextSelection.create(tr.doc, insertPos)).scrollIntoView()
    )
    return true
  }

  if (
    selection instanceof TextSelection &&
    selection.$anchor.parentOffset === 0 &&
    selection.$head.parentOffset === 0 &&
    selection.$from.node().type === schema.nodes.paragraph
  ) {
    const { $from, $to } = selection
    const side =
      (!$from.parentOffset && $to.index() < $to.parent.childCount ? $from : $to)
        .pos - 1
    tr.insert(side, slice.content)
    dispatch(
      tr.setSelection(TextSelection.create(tr.doc, side + 1)).scrollIntoView()
    )
    return true
  }

  return false
}

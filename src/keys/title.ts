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
  isInGraphicalAbstractSection,
  ManuscriptEditorState,
  ManuscriptEditorView,
  schema,
} from '@manuscripts/transform'
import { chainCommands } from 'prosemirror-commands'
import { Fragment, ResolvedPos, Slice } from 'prosemirror-model'
import { Selection, TextSelection } from 'prosemirror-state'

import {
  Dispatch,
  isAtEndOfTextBlock,
  isAtStartOfTextBlock,
  isTextSelection,
} from '../commands'
import { EditorAction } from '../types'

const insertParagraph = (
  dispatch: Dispatch,
  state: ManuscriptEditorState,
  $anchor: ResolvedPos
) => {
  const {
    tr,
    schema: { nodes },
  } = state

  const offset = $anchor.nodeAfter ? $anchor.nodeAfter.nodeSize : 0
  const pos = $anchor.pos + offset + 1
  const nextNode = tr.doc.resolve(pos).nodeAfter

  if (
    !nextNode ||
    nextNode.type !== nextNode.type.schema.nodes.paragraph ||
    nextNode.nodeSize > 2
  ) {
    tr.insert(pos, nodes.paragraph.create())
  }

  tr.setSelection(TextSelection.create(tr.doc, pos + 1)).scrollIntoView()

  dispatch(tr)
}

const enterNextBlock = (
  dispatch: Dispatch,
  state: ManuscriptEditorState,
  $anchor: ResolvedPos,
  create?: boolean
) => {
  const {
    schema: { nodes },
    tr,
  } = state

  const pos = $anchor.after($anchor.depth - 1)

  let selection = Selection.findFrom(tr.doc.resolve(pos), 1, true)

  if (!selection && create) {
    tr.insert(pos, nodes.paragraph.create())
    selection = Selection.findFrom(tr.doc.resolve(pos), 1, true)
  }

  if (!selection) {
    return false
  }

  tr.setSelection(selection).scrollIntoView()

  dispatch(tr)

  return true
}

const enterPreviousBlock = (
  dispatch: Dispatch,
  state: ManuscriptEditorState,
  $anchor: ResolvedPos
) => {
  const { tr } = state

  const offset = $anchor.nodeBefore ? $anchor.nodeBefore.nodeSize : 0
  const $pos = tr.doc.resolve($anchor.pos - offset - 1)
  const previous = Selection.findFrom($pos, -1, true)

  if (!previous) {
    return false
  }

  tr.setSelection(TextSelection.create(tr.doc, previous.from)).scrollIntoView()

  dispatch(tr)

  return true
}

const exitBlock =
  (direction: number): EditorAction =>
  (state, dispatch) => {
    const {
      selection: { $anchor },
    } = state

    if (dispatch) {
      return direction === 1
        ? enterNextBlock(dispatch, state, $anchor)
        : enterPreviousBlock(dispatch, state, $anchor)
    }
    return true
  }

const leaveSectionTitle: EditorAction = (state, dispatch, view) => {
  const { selection } = state

  if (!isTextSelection(selection)) {
    return false
  }

  const { $cursor } = selection

  if (!$cursor) {
    return false
  }

  if ($cursor.parent.type !== $cursor.parent.type.schema.nodes.section_title) {
    return false
  }

  if (isInGraphicalAbstractSection($cursor)) {
    return false
  }

  if (!isAtEndOfTextBlock(state, $cursor, view)) {
    return false
  }

  if (dispatch) {
    insertParagraph(dispatch, state, $cursor)
  }

  return true
}

const leaveFigcaption: EditorAction = (state) => {
  const {
    selection: { $anchor },
  } = state

  return $anchor.parent.type === $anchor.parent.type.schema.nodes.caption_title
}

// ignore backspace at the start of section titles
const protectSectionTitle: EditorAction = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch,
  view?: ManuscriptEditorView
) => {
  const { selection } = state

  if (!isTextSelection(selection)) {
    return false
  }

  const { $cursor } = selection

  if (!$cursor) {
    return false
  }

  return (
    $cursor.parent.type === $cursor.parent.type.schema.nodes.section_title &&
    isAtStartOfTextBlock(state, $cursor, view)
  )
}

export const protectReferencesTitle = (state: ManuscriptEditorState) => {
  const { selection } = state

  if (!isTextSelection(selection)) {
    return false
  }
  const { $from } = selection
  const parentNode = $from.node($from.depth - 1)
  return (
    $from.parent.type === schema.nodes.section_title &&
    parentNode.type === schema.nodes.bibliography_section
  )
}

const protectCaption: EditorAction = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch
) => {
  const {
    selection: { $anchor },
  } = state

  if (
    dispatch &&
    ($anchor.parent.type === $anchor.parent.type.schema.nodes.caption_title ||
      $anchor.parent.type === $anchor.parent.type.schema.nodes.caption) &&
    $anchor.parent.content.size === 1
  ) {
    const slice = new Slice(
      Fragment.from([state.schema.nodes.caption_title.create()]),
      1,
      1
    )
    const tr = state.tr.replace($anchor.pos - 1, $anchor.pos, slice)
    dispatch(tr)

    return true
  }

  return false
}

const keepCaption = (state: ManuscriptEditorState) => {
  const {
    selection: { $anchor },
  } = state
  return (
    $anchor.parent.type === $anchor.parent.type.schema.nodes.caption_title &&
    $anchor.parent.content.size === 0
  )
}

const titleKeymap: { [key: string]: EditorAction } = {
  Backspace: chainCommands(
    protectSectionTitle,
    protectReferencesTitle,
    protectCaption
  ),
  Enter: chainCommands(leaveSectionTitle, leaveFigcaption),
  Tab: exitBlock(1),
  Delete: chainCommands(keepCaption, protectReferencesTitle),
  'Shift-Tab': exitBlock(-1),
}

export default titleKeymap

/*!
 * © 2024 Atypon Systems LLC
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
import { schema } from '@manuscripts/transform'
import { Fragment, Node, Slice } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import { findParentNodeOfType } from 'prosemirror-utils'
import { EditorView } from 'prosemirror-view'

export const transformCopied = (slice: Slice, view: EditorView): Slice => {
  const { state } = view

  if (
    (!view.props.handleKeyDown || !state.selection.empty) &&
    slice.content.firstChild?.type === schema.nodes.table
  ) {
    let tableStart: number | null = null
    let tableNode: Node | null = null

    // Find the table_element node that contains the copied content
    const tableElement = findParentNodeOfType(schema.nodes.table_element)(
      state.selection
    )
    if (tableElement) {
      tableStart = tableElement.pos
      tableNode = tableElement.node
      // Dispatch a transaction to update the selection to include the whole table_element
      if (tableNode && tableStart) {
        view.dispatch(
          state.tr.setSelection(
            TextSelection.create(
              state.doc,
              tableStart,
              tableStart + tableNode.nodeSize
            )
          )
        )
      }
    }
    if (tableNode) {
      return new Slice(Fragment.from(tableNode), 0, 0)
    }
  }

  return slice
}

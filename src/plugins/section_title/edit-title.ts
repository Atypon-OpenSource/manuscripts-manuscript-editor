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

import { trackChangesPluginKey } from '@manuscripts/track-changes-plugin'
import {
  isGraphicalAbstractSectionNode,
  isKeywordsNode,
  isSectionTitleNode,
} from '@manuscripts/transform'
import { EditorState, Transaction } from 'prosemirror-state'
/**
 * This plugin ensures that specific section titles (e.g., graphical abstracts and keywords) cannot be edited directly.
 * It prevents modifications to these titles while allowing other actions, such as section deletion via the context menu.
 */

export const preventTitleEdit = (tr: Transaction, oldState: EditorState) => {
  // Skip checks for track changes or context menu
  if (
    tr.getMeta('fromContextMenu') ||
    tr.getMeta('origin') === trackChangesPluginKey ||
    tr.getMeta('track-changes-skip-tracking')
  ) {
    return true
  }

  let allowed = true

  // Iterate over all nodes
  tr.doc.descendants((node, newPos) => {
    if (isSectionTitleNode(node)) {
      const parent = tr.doc.resolve(newPos).parent
      if (isGraphicalAbstractSectionNode(parent) || isKeywordsNode(parent)) {
        // Map the new position back to the old documnts' position
        const oldPos = tr.mapping.invert().map(newPos)
        const oldNode = oldState.doc.nodeAt(oldPos)

        // Check if the title content changed
        if (oldNode && !oldNode.eq(node)) {
          allowed = false
        }
      }
    }
  })

  return allowed
}

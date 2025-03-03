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
import { Node as ProseMirrorNode } from 'prosemirror-model'
import { EditorState, Plugin, PluginKey, Transaction } from 'prosemirror-state'
import { findChildrenByType } from 'prosemirror-utils'
import { Decoration, DecorationSet } from 'prosemirror-view'

import { checkForCompletion } from './autocompletion'
import { preventTitleEdit } from './edit-title'

type NumberingArray = number[]
export type PluginState = Map<string, string>

export const sectionTitleKey = new PluginKey<PluginState>('sectionNumbering')

const calculateSectionLevels = (
  node: ProseMirrorNode,
  startPos: number,
  sectionNumberMap: Map<string, string>,
  numbering: NumberingArray = [0]
) => {
  node.forEach((childNode, offset) => {
    if (
      childNode.type === schema.nodes.section ||
      childNode.type === schema.nodes.box_element
    ) {
      numbering[numbering.length - 1] += 1
      const sectionNumber = numbering.join('.')
      const sectionStartPos = startPos + offset + 1

      childNode.forEach((innerChildNode) => {
        if (innerChildNode.type === schema.nodes.section_title) {
          sectionNumberMap.set(childNode.attrs.id, sectionNumber)
        }
      })

      // Process child nodes to handle subsections
      calculateSectionLevels(childNode, sectionStartPos, sectionNumberMap, [
        ...numbering,
        0,
      ])
    }
  })
}

const getPluginState = (doc: ProseMirrorNode): PluginState => {
  const bodyNodes = findChildrenByType(doc, schema.nodes.body)
  const bodyNode = bodyNodes[0]
  const sectionNumberMap = new Map<string, string>()
  calculateSectionLevels(bodyNode.node, bodyNode.pos, sectionNumberMap)

  return sectionNumberMap
}

export default () => {
  return new Plugin<PluginState>({
    key: sectionTitleKey,
    props: {
      decorations(state) {
        const text = checkForCompletion(state)
        if (text) {
          const decoration = Decoration.widget(state.selection.from, () => {
            const node = document.createElement('span')
            node.classList.add('completion-bearer')
            node.dataset.suggest = text.suggestion
            return node
          })
          return DecorationSet.create(state.doc, [decoration])
        }

        return DecorationSet.empty
      },
    },
    state: {
      init: (_, state: EditorState) => {
        return getPluginState(state.doc)
      },
      apply: (
        tr: Transaction,
        oldSectionNumberMap: PluginState,
        oldState: EditorState,
        newState: EditorState
      ) => {
        if (tr.docChanged) {
          return getPluginState(newState.doc)
        }
        return oldSectionNumberMap
      },
    },
     filterTransaction: (tr, oldState) => {
      return preventTitleEdit(tr, oldState)
    },
  })
}

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

import { Manuscript, Model } from '@manuscripts/json-schema'
import {
  buildTargets,
  isInGraphicalAbstractSection,
  Target,
} from '@manuscripts/transform'
import { Fragment } from 'prosemirror-model'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export const objectsKey = new PluginKey<Map<string, Target>>('objects')

interface Props {
  getModelMap: () => Map<string, Model>
  getManuscript: () => Manuscript
}

/**
 * This plugin sets the labels for cross-references, and adds the label as a decoration to cross-referenceable elements.
 */
export default (props: Props) => {
  const getModel = <T>(id: string): T => {
    return props.getModelMap().get(id) as T
  }

  return new Plugin<Map<string, Target>>({
    key: objectsKey,

    state: {
      init: (config, state) => {
        return buildTargets(
          Fragment.from(state.doc.content),
          props.getManuscript()
        )
      },
      apply: (tr) => {
        // TODO: use decorations to track figure deletion?
        // TODO: map decorations?
        // TODO: use setMeta to update labels

        return buildTargets(
          Fragment.from(tr.doc.content),
          props.getManuscript()
        )
      },
    },
    props: {
      decorations: (state) => {
        const decorations: Decoration[] = []

        const targets = objectsKey.getState(state)

        if (targets) {
          state.doc.descendants((node, pos) => {
            const { id } = node.attrs

            if (id) {
              const target = targets.get(id)
              const resolvedPos = state.doc.resolve(pos)
              const isInGraphicalAbstract =
                isInGraphicalAbstractSection(resolvedPos)

              if (target && !isInGraphicalAbstract) {
                const labelNode = document.createElement('span')
                labelNode.className = 'figure-label'
                labelNode.textContent = target.label + ':'

                node.forEach((child, offset) => {
                  if (child.type.name === 'figcaption') {
                    decorations.push(
                      Decoration.widget(pos + 1 + offset + 1, labelNode, {
                        side: -1,
                        key: `figure-label-${id}-${target.label}`,
                      })
                    )
                  }
                })
              }
            }
          })
        }

        return DecorationSet.create(state.doc, decorations)
      },
    },
    appendTransaction: (transactions, oldState, newState) => {
      const targets = objectsKey.getState(newState)

      if (!targets) {
        return
      }

      let updated = 0

      const tr = newState.tr

      newState.doc.descendants((node, pos) => {
        if (node.type === newState.schema.nodes.cross_reference) {
          const auxiliaryObjectReference = getModel<AuxiliaryObjectReference>(
            node.attrs.rid
          )

          // TODO: handle missing objects?
          // https://gitlab.com/mpapp-private/manuscripts-frontend/issues/395
          if (
            auxiliaryObjectReference &&
            auxiliaryObjectReference.referencedObject
          ) {
            const target = targets.get(
              auxiliaryObjectReference.referencedObject
            )

            if (target && target.label && target.label !== node.attrs.label) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                label: target.label,
              })

              updated++
            }
          }
        }
      })

      if (updated) {
        skipTracking(tr)
        tr.setMeta('origin', objectsKey)
        return tr.setSelection(newState.selection.map(tr.doc, tr.mapping))
      }
    },
  })
}

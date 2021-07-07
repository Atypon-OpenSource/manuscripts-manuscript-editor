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
  ManuscriptNode,
  ManuscriptSchema,
} from '@manuscripts/manuscript-transform'
import { NodeView } from 'prosemirror-view'
import React, { useCallback, useEffect, useState } from 'react'
import ReactDOM from 'react-dom'

import { Dispatch } from '../commands'

export interface ReactViewComponentProps<NodeT extends ManuscriptNode> {
  nodeAttrs: NodeT['attrs']
  setNodeAttrs: (nextAttrs: Partial<NodeT['attrs']>) => void
  contentDOM?: HTMLElement | null
  viewProps: {
    view: ManuscriptEditorView
    getPos: () => number
    node: ManuscriptNode
  }
  dispatch: Dispatch
}

export default (dispatch: Dispatch) => <NodeT extends ManuscriptNode>(
  Component: React.FC<ReactViewComponentProps<NodeT>>,
  contentDOMElementType?: keyof HTMLElementTagNameMap | null,
  nodeViewProps?: NodeView
) => (
  initialNode: ManuscriptNode,
  view: ManuscriptEditorView,
  getPos: () => number
): NodeView<ManuscriptSchema> => {
  const root = document.createElement('div')
  const reactChild = root.appendChild(document.createElement('div'))

  let contentDOM: HTMLElement | null
  if (contentDOMElementType) {
    contentDOM = document.createElement(contentDOMElementType)
    root.appendChild(contentDOM)
  } else {
    contentDOM = null
  }

  // a very simple event emitter that tracks the current value of ManuscriptNode
  // and injects it into Component
  let subscriber: ((node: ManuscriptNode) => void) | null
  const setNode = (next: ManuscriptNode) => {
    subscriber && subscriber(next)
  }
  const subscribe = (func: (node: ManuscriptNode) => void) => {
    subscriber = func
  }
  const unsubscribe = () => {
    subscriber = null
  }

  const Wrapped: React.FC = () => {
    const [node, setNode] = useState<ManuscriptNode>(initialNode)
    useEffect(() => {
      subscribe((node) => {
        setNode(node)
      })
      return () => {
        unsubscribe()
      }
    }, [])

    const setNodeAttrs = useCallback(
      (nextAttrs: Partial<NodeT['attrs']>) => {
        const { selection, tr } = view.state

        tr.setNodeMarkup(getPos(), undefined, {
          ...node.attrs,
          ...nextAttrs,
        }).setSelection(selection.map(tr.doc, tr.mapping))

        dispatch(tr)
      },
      [node.attrs]
    )

    if (!node.attrs) {
      return null
    }

    return (
      <Component
        nodeAttrs={node.attrs}
        setNodeAttrs={setNodeAttrs}
        viewProps={{ node, view, getPos }}
        dispatch={dispatch}
        contentDOM={contentDOM}
      />
    )
  }

  ReactDOM.render(<Wrapped />, reactChild)

  return {
    dom: root,
    contentDOM,
    destroy: () => ReactDOM.unmountComponentAtNode(reactChild),
    update: (next: ManuscriptNode) => {
      setNode(next)
      return true
    },
    ...nodeViewProps,
  }
}

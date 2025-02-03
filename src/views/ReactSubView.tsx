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

import { ManuscriptEditorView, ManuscriptNode } from '@manuscripts/transform'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'styled-components'

import { Dispatch } from '../commands'
import { EditorProps } from '../configs/ManuscriptsEditor'
import { Trackable } from '../types'

export interface ReactViewComponentProps<NodeT extends ManuscriptNode> {
  nodeAttrs: NodeT['attrs']
  setNodeAttrs: (nextAttrs: Partial<NodeT['attrs']>) => void
  contentDOM?: HTMLElement | null
  viewProps: {
    view: ManuscriptEditorView
    getPos: () => number
    node: ManuscriptNode | Trackable<ManuscriptNode>
  }
  dispatch: Dispatch
}
/*
  This is to render components that affect the Prosemirror Document indirectly. Such as dropdown buttons, inputs, advanced UX elements etc.
  MAKE SURE dispatch IS PASSED TO YOUR VIEW
*/

function createSubView<T extends Trackable<ManuscriptNode>>(
  props: EditorProps,
  Component: React.FC<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  componentProps: object,
  node: T,
  getPos: () => number,
  view: ManuscriptEditorView,
  classNames: string[] = []
): HTMLDivElement {
  const container = document.createElement('div')
  container.classList.add('tools-panel')
  if (classNames.length) {
    container.classList.add(...classNames)
    container.setAttribute('data-cy', classNames[0])
  }
  container.setAttribute('contenteditable', 'false')

  const Wrapped: React.FC = () => {
    const setNodeAttrs = (nextAttrs: Partial<ManuscriptNode['attrs']>) => {
      const { selection, tr } = view.state

      tr.setNodeMarkup(getPos(), undefined, {
        ...node.attrs,
        ...nextAttrs,
      }).setSelection(selection.map(tr.doc, tr.mapping))

      view.dispatch(tr)
    }

    return (
      <ThemeProvider theme={props.theme}>
        <Component
          nodeAttrs={node.attrs}
          setNodeAttrs={setNodeAttrs}
          viewProps={{ node, view, getPos }}
          {...props}
          {...componentProps}
        />
      </ThemeProvider>
    )
  }
  const root = createRoot(container)

  root.render(<Wrapped />)

  return container
}

export default createSubView

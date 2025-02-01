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

import { DotsIcon } from '@manuscripts/style-guide'
import { ManuscriptNode, schema } from '@manuscripts/transform'
import { DOMSerializer } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'
import { CellSelection } from 'prosemirror-tables'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { ContextMenu } from '../components/views/TableCellContextMenu'
import BlockView from './block_view'
import { createNodeView } from './creators'
import ReactSubView from './ReactSubView'

export class TableCellView extends BlockView<ManuscriptNode> {
  public contentDOM: HTMLElement

  public ignoreMutation(mutation: MutationRecord) {
    return mutation.type === 'attributes' && mutation.attributeName === 'class'
  }

  public initialise = () => {
    this.dom = this.toDom()
    this.contentDOM = document.createElement('span')
    this.dom.appendChild(this.contentDOM)

    const can = this.props.getCapabilities()

    if (can.editArticle) {
      this.createContextMenu()
    }
  }

  public updateContents() {
    // will remove old attribute of node view as it could change rowspan,colspan from update to table
    super.updateContents()
    this.dom.getAttributeNames().map((attr) => {
      if (attr !== 'class') {
        this.dom.removeAttribute(attr)
      }
    })
    Array.from(this.toDom().attributes).map(
      (attr) =>
        attr.nodeValue && this.dom.setAttribute(attr.nodeName, attr.nodeValue)
    )
  }

  private createContextMenu() {
    const contextMenuButton = document.createElement('button')
    contextMenuButton.className = 'table-context-menu-button'
    contextMenuButton.innerHTML = renderToStaticMarkup(createElement(DotsIcon))

    contextMenuButton.addEventListener('click', () => {
      if (this.props.popper.isActive()) {
        this.props.popper.destroy()
        this.view.dom
          .querySelector('.open-context-menu')
          ?.classList.remove('open-context-menu')
      } else {
        // if the clicked button are not selected will move selection to that node view
        if (
          !(
            this.view.state.selection instanceof CellSelection &&
            !!this.view.state.selection.ranges.find(
              (range) => range.$from.pos === this.getPos() + 1
            )
          )
        ) {
          this.view.dispatch(
            this.view.state.tr.setSelection(
              TextSelection.create(this.view.state.doc, this.getPos())
            )
          )
          this.view.focus()
        }

        const contextMenu = ReactSubView(
          { ...this.props, dispatch: this.view.dispatch },
          ContextMenu,
          {
            view: this.view,
            close: () => {
              this.props.popper.destroy()
              contextMenuButton.classList.toggle('open-context-menu')
            },
            onCancelColumnDialog: () =>
              this.addOutClickListener(contextMenuButton),
          },
          this.view.state.selection.$from.node(),
          this.getPos,
          this.view,
          ['table-cell-context-menu']
        )
        contextMenuButton.classList.toggle('open-context-menu')

        this.props.popper.show(contextMenuButton, contextMenu, 'right', false)
        this.addOutClickListener(contextMenuButton)
      }
    })

    this.dom.appendChild(contextMenuButton)
  }

  private toDom(): HTMLElement {
    if (!this.node.type.spec.toDOM) {
      return this.node.type === schema.nodes.table_cell
        ? document.createElement('td')
        : document.createElement('th')
    }

    const outputSpec = this.node.type.spec.toDOM(this.node)
    return DOMSerializer.renderSpec(document, outputSpec).dom as HTMLElement
  }

  private addOutClickListener(contextMenuButton: HTMLButtonElement) {
    const listener: EventListener = (event) => {
      const target = event.target as HTMLElement
      if (
        !target.classList.contains('open-context-menu') &&
        !(target.parentNode as HTMLElement)?.classList.contains('table-ctx')
      ) {
        this.props.popper.destroy()
        contextMenuButton.classList.toggle('open-context-menu')
      }
      window.removeEventListener('mousedown', listener)
      window.removeEventListener('keydown', listener)
    }

    window.addEventListener('mousedown', listener)
    window.addEventListener('keydown', listener)
  }
}

export default createNodeView(TableCellView)

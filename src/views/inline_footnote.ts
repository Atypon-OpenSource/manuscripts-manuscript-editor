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

import { ContextMenu, ContextMenuProps } from '@manuscripts/style-guide'
import {
  FootnoteNode,
  InlineFootnoteNode,
  ManuscriptNodeView,
} from '@manuscripts/transform'
import { NodeSelection, TextSelection } from 'prosemirror-state'

import {
  FootnotesSelector,
  FootnotesSelectorProps,
} from '../components/views/FootnotesSelector'
import {
  createFootnote,
  findFootnotesContainerNode,
  getFootnotesElementState,
} from '../lib/footnotes'
import { isDeleted, isPendingInsert } from '../lib/track-changes-utils'
import { Trackable } from '../types'
import { BaseNodeView } from './base_node_view'
import { createNodeView } from './creators'
import ReactSubView from './ReactSubView'

export class InlineFootnoteView
  extends BaseNodeView<Trackable<InlineFootnoteNode>>
  implements ManuscriptNodeView
{
  protected popperContainer: HTMLDivElement

  showContextMenu = () => {
    this.props.popper.destroy()
    const can = this.props.getCapabilities()
    const showEditIcon = can?.editArticle

    const componentProps: ContextMenuProps = {
      actions: [
        ...(showEditIcon
          ? [
              {
                label: 'Edit',
                action: () => {
                  this.props.popper.destroy()
                  this.showFootnotesSelector()
                },
                icon: 'Edit',
              },
            ]
          : []),
        {
          label: 'Go to footnote',
          action: () => {
            this.props.popper.destroy()
            this.scrollToReferencedFootnote()
          },
          icon: 'Scroll',
        },
      ],
    }
    this.props.popper.show(
      this.dom,
      ReactSubView(
        this.props,
        ContextMenu,
        componentProps,
        this.node,
        this.getPos,
        this.view,
        ['context-menu']
      ),
      'right-start',
      false
    )
  }

  handleClick = () => {
    if (isDeleted(this.node)) {
      return
    }
    this.showContextMenu()
  }

  scrollToReferencedFootnote = () => {
    const state = this.view.state
    const fn = getFootnotesElementState(state, this.node.attrs.id)

    if (!fn) {
      return
    }

    let nodePos: number | undefined = undefined

    for (const [node, pos] of fn.footnotes) {
      if (node.attrs.id === this.node.attrs.rids[0]) {
        nodePos = pos
      }
    }

    if (nodePos && this.props.dispatch) {
      const selection = NodeSelection.create(this.view.state.doc, nodePos + 1)

      this.props.dispatch(
        this.view.state.tr.setSelection(selection).scrollIntoView()
      )
    }
  }

  showFootnotesSelector = () => {
    if (!this.props.getCapabilities().editArticle) {
      return
    }

    const state = this.view.state
    const pos = this.getPos()
    const container = findFootnotesContainerNode(state.doc, pos)
    const fn = getFootnotesElementState(state, container.node.attrs.id)
    if (!fn) {
      return []
    }

    const rids = this.node.attrs.rids

    const footnotes = fn.footnotes
      .map((n) => n[0])
      .filter(
        (n) => fn.unusedFootnoteIDs.has(n.attrs.id) || rids.includes(n.attrs.id)
      )

    const props: FootnotesSelectorProps = {
      footnotes,
      inlineFootnote: this.node,
      labels: fn.labels,
      onCancel: this.handleCancel,
      onAdd: this.handleAdd,
      onInsert: this.handleInsert,
    }

    this.popperContainer = ReactSubView(
      this.props,
      FootnotesSelector,
      props,
      this.node,
      this.getPos,
      this.view,
      ['footnote-editor']
    )
    this.props.popper.show(this.dom, this.popperContainer, 'auto', false)
  }

  public updateContents() {
    super.updateContents()
    const state = this.view.state
    const fn = getFootnotesElementState(state, this.node.attrs.id)
    if (!fn) {
      return
    }

    this.dom.innerText = fn.labels.get(this.node.attrs.id) || ''
  }

  public initialise = () => {
    this.dom = this.createDOM()
    this.dom.classList.add('footnote-marker')
    this.dom.addEventListener('click', this.handleClick)
    this.updateContents()
  }

  selectNode = () => {
    this.dom.classList.add('footnote-marker-selected')
    if (!this.node.attrs.rids.length) {
      this.showFootnotesSelector()
    }
  }

  public deselectNode() {
    this.dom.classList.remove('footnote-marker-selected')
  }

  public ignoreMutation = () => true

  public createDOM = () => {
    return document.createElement('span')
  }

  public destroy = () => {
    this.props.popper.destroy()
    this.popperContainer?.remove()
  }

  handleCancel = () => {
    const tr = this.view.state.tr
    const rids = this.node.attrs.rids
    if (!rids.length) {
      const pos = this.getPos()
      tr.delete(pos, pos + this.node.nodeSize)
      this.view.dispatch(tr)
    }
    this.destroy()
  }

  handleAdd = () => {
    const state = this.view.state
    const pos = this.getPos()
    const container = findFootnotesContainerNode(state.doc, pos)
    const fn = getFootnotesElementState(state, container.node.attrs.id)
    if (!fn) {
      return
    }
    const tr = this.view.state.tr
    const footnote = createFootnote()
    const rids = this.node.attrs.rids
    tr.setNodeAttribute(pos, 'rids', [...rids, footnote.attrs.id])
    const fnPos = fn.element[1] + fn.element[0].nodeSize - 1
    tr.insert(fnPos, footnote)
    const selection = TextSelection.create(tr.doc, fnPos + 2)
    tr.setSelection(selection).scrollIntoView()
    this.view.dispatch(tr)
    this.view.focus()
    this.destroy()
  }

  handleInsert = (footnotes: FootnoteNode[]) => {
    const pos = this.getPos()
    const tr = this.view.state.tr

    if (footnotes.length) {
      const rids = footnotes.map((note) => note.attrs.id)
      if (rids.length) {
        tr.setNodeAttribute(pos, 'rids', rids)
      } else if (isPendingInsert(this.node)) {
        tr.delete(pos, pos + this.node.nodeSize)
      }
    } else {
      tr.delete(pos, pos + this.node.nodeSize)
    }
    this.view.dispatch(tr)

    this.destroy()
  }
}

export default createNodeView(InlineFootnoteView)

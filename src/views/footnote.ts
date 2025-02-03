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

import { FootnoteNode, ManuscriptNode, schema } from '@manuscripts/transform'
import { isEqual } from 'lodash'
import { NodeSelection, Transaction } from 'prosemirror-state'
import { findParentNodeOfTypeClosestToPos } from 'prosemirror-utils'

import {
  DeleteFootnoteDialog,
  DeleteFootnoteDialogProps,
} from '../components/views/DeleteFootnoteDialog'
import { alertIcon, deleteIcon, scrollIcon } from '../icons'
import { getFootnotesElementState } from '../lib/footnotes'
import { isDeleted } from '../lib/track-changes-utils'
import { Trackable } from '../types'
import { BaseNodeView } from './base_node_view'
import { createNodeView } from './creators'
import ReactSubView from './ReactSubView'

export class FootnoteView extends BaseNodeView<Trackable<FootnoteNode>> {
  dialog: HTMLElement

  public initialise = () => {
    this.dom = document.createElement('div')
    this.dom.classList.add('footnote')
    this.contentDOM = document.createElement('div')
    this.contentDOM.classList.add('footnote-text')
    this.updateContents()
  }

  public updateContents() {
    super.updateContents()
    const id = this.node.attrs.id
    const fn = getFootnotesElementState(this.view.state, id)

    if (!fn) {
      return
    }

    const marker = document.createElement('span')
    if (!isDeleted(this.node) && fn.unusedFootnoteIDs.has(id)) {
      marker.classList.add('uncited-footnote')
      marker.innerHTML = alertIcon
    } else {
      marker.classList.add('footnote-marker')
      marker.innerText = fn.labels.get(id) || ''
    }

    let scrollBtn: HTMLElement | null = null
    scrollBtn = this.createButton(
      'scroll-icon',
      scrollIcon,
      this.handleMarkerClick
    )
    const deleteBtn = this.createButton(
      'delete-icon',
      deleteIcon,
      this.handleDeleteClick
    )

    this.dom.innerHTML = ''
    scrollBtn && this.dom.appendChild(scrollBtn)
    this.dom.appendChild(marker)
    this.contentDOM && this.dom.appendChild(this.contentDOM)
    this.dom.appendChild(deleteBtn)
  }

  // Helper function to create buttons
  private createButton = (
    className: string,
    icon: string,
    eventHandler: (e: Event) => void
  ): HTMLElement => {
    const btn = document.createElement('span')
    btn.classList.add(className)
    btn.innerHTML = icon
    btn.addEventListener('mousedown', eventHandler)
    return btn
  }

  handleMarkerClick = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()

    const id = this.node.attrs.id
    const fn = getFootnotesElementState(this.view.state, id)

    if (!fn) {
      return
    }

    for (const [node, pos] of fn.inlineFootnotes) {
      if (node.attrs.rids.includes(id)) {
        const tr = this.view.state.tr
        const selection = NodeSelection.create(this.view.state.doc, pos)
        tr.setSelection(selection)
        tr.scrollIntoView()
        this.view.dispatch(tr)
      }
    }
  }

  handleDeleteClick = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    const componentProps: DeleteFootnoteDialogProps = {
      header: 'Delete footnote',
      message:
        'This action will entirely remove the footnote from the list because it will no longer be used.',
      handleDelete: this.handleDelete,
    }

    this.dialog = ReactSubView(
      this.props,
      DeleteFootnoteDialog,
      componentProps,
      this.node,
      this.getPos,
      this.view
    )

    this.props.popper.show(this.dom, this.dialog, 'auto', false)
  }

  handleDelete = () => {
    const tr = this.view.state.tr
    this.deleteInlineFootnotes(tr)
    this.deleteFootnote(tr)
    this.view.dispatch(tr)
  }

  deleteInlineFootnotes = (tr: Transaction) => {
    const id = this.node.attrs.id
    const fns = getFootnotesElementState(this.view.state, this.node.attrs.id)
    fns?.inlineFootnotes.forEach(([node, pos]) => {
      pos = tr.mapping.map(pos)
      const rids = node.attrs.rids.filter((rid) => rid !== id)
      if (isEqual(rids, node.attrs.rids)) {
        return
      }
      if (!rids.length) {
        tr.delete(pos, pos + node.nodeSize)
      } else {
        tr.setNodeAttribute(pos, 'rids', rids)
      }
    })
  }

  deleteFootnote = (tr: Transaction) => {
    const pos = tr.mapping.map(this.getPos())
    const $pos = tr.doc.resolve(pos)
    const element = findParentNodeOfTypeClosestToPos(
      $pos,
      schema.nodes.footnotes_element
    )
    tr.delete(pos, pos + this.node.nodeSize)

    if (element && getEffectiveChildCount(element.node) <= 1) {
      tr.delete(
        tr.mapping.map(element.pos),
        tr.mapping.map(element.pos + element.node.nodeSize)
      )
    }
  }
}

const getEffectiveChildCount = (node: ManuscriptNode) => {
  let count = 0
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (!isDeleted(child)) {
      count++
    }
  }
  return count
}

export default createNodeView(FootnoteView)

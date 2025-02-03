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
  BibliographyElementNode,
  BibliographyItemNode,
  schema,
} from '@manuscripts/transform'
import { NodeSelection } from 'prosemirror-state'

import {
  ReferencesEditor,
  ReferencesEditorProps,
} from '../components/references/ReferencesEditor'
import { CommentKey, createCommentMarker, handleComment } from '../lib/comments'
import { findNodeByID } from '../lib/doc'
import { sanitize } from '../lib/dompurify'
import { BibliographyItemAttrs } from '../lib/references'
import {
  addTrackChangesAttributes,
  addTrackChangesClassNames,
} from '../lib/track-changes-utils'
import { deleteNode, findChildByID, updateNodeAttrs } from '../lib/view'
import { getBibliographyPluginState } from '../plugins/bibliography'
import { commentsKey, setCommentSelection } from '../plugins/comments'
import { selectedSuggestionKey } from '../plugins/selected-suggestion'
import { Trackable } from '../types'
import BlockView from './block_view'
import { createNodeView } from './creators'
import ReactSubView from './ReactSubView'

export class BibliographyElementBlockView extends BlockView<
  Trackable<BibliographyElementNode>
> {
  private container: HTMLElement
  private editor: HTMLDivElement
  private contextMenu: HTMLDivElement
  private version: string

  public showPopper(id: string) {
    const bib = getBibliographyPluginState(this.view.state)
    if (!bib) {
      return
    }

    const componentProps: ReferencesEditorProps = {
      items: Array.from(bib.bibliographyItems.values()),
      citationCounts: bib.citationCounts,
      item: bib.bibliographyItems.get(id),
      onSave: this.handleSave,
      onDelete: this.handleDelete,
    }

    this.editor = ReactSubView(
      this.props,
      ReferencesEditor,
      componentProps,
      this.node,
      this.getPos,
      this.view,
      ['references-editor']
    )

    this.props.popper.show(this.dom, this.editor, 'right')
  }

  public stopEvent = () => true

  public ignoreMutation = () => true

  private handleEdit(citationID: string) {
    this.showPopper(citationID)
  }

  private showContextMenu(element: HTMLElement) {
    this.props.popper.destroy()
    const can = this.props.getCapabilities()
    const item = findNodeByID(this.view.state.doc, element.id)?.node

    const componentProps: ContextMenuProps = {
      actions: [],
    }
    if (can.editCitationsAndRefs) {
      componentProps.actions.push({
        label: 'Edit',
        action: () => this.handleEdit(element.id),
        icon: 'Edit',
      })
    }
    componentProps.actions.push({
      label: 'Comment',
      action: () => handleComment(item, this.view),
      icon: 'AddComment',
    })

    this.contextMenu = ReactSubView(
      this.props,
      ContextMenu,
      componentProps,
      this.node,
      this.getPos,
      this.view,
      ['context-menu']
    )
    this.props.popper.show(element, this.contextMenu, 'right-start')
  }

  private handleClick = (event: Event) => {
    const element = event.target as HTMLElement
    // Handle click on comment marker
    const marker = element.closest('.comment-marker') as HTMLElement
    if (marker) {
      const key = marker.dataset.key as CommentKey
      const tr = this.view.state.tr
      setCommentSelection(tr, key, undefined, false)
      this.view.dispatch(tr)
      return
    }

    if (this.props.getCapabilities().seeReferencesButtons) {
      const item = element.closest('.bib-item')
      if (item) {
        this.showContextMenu(item as HTMLElement)
        const node = findChildByID(this.view, item.id)
        if (!node) {
          return
        }
        const view = this.view
        const tr = view.state.tr
        tr.setSelection(NodeSelection.create(view.state.doc, node.pos))
        view.dispatch(tr)
      }
    }
  }

  public updateContents() {
    this.props.popper.destroy() // destroy the old context menu
    const bib = getBibliographyPluginState(this.view.state)
    if (!bib) {
      return
    }

    if (bib.version === this.version) {
      this.updateSelections()
      return
    }
    this.version = bib.version

    const nodes: Map<string, BibliographyItemNode> = new Map()

    this.node.descendants((node) => {
      const id = node.attrs.id
      nodes.set(id, node as BibliographyItemNode)
    })

    const wrapper = document.createElement('div')
    wrapper.classList.add('contents')
    wrapper.addEventListener('click', this.handleClick)

    const [meta, bibliography] = bib.provider.makeBibliography()

    for (let i = 0; i < bibliography.length; i++) {
      const id = meta.entry_ids[i][0]
      const fragment = bibliography[i]
      const element = sanitize(
        `<div id="${id}" class="bib-item"><div class="csl-bib-body">${fragment}</div></div>`
      ).firstElementChild as HTMLElement

      const node = nodes.get(id) as BibliographyItemNode
      const comment = createCommentMarker('div', id)
      element.prepend(comment)

      addTrackChangesAttributes(node.attrs, element)
      addTrackChangesClassNames(node.attrs, element)

      wrapper.append(element)
    }

    const oldContent = this.container.querySelector('.contents')
    if (oldContent) {
      this.container.replaceChild(wrapper, oldContent)
    } else {
      this.container.appendChild(wrapper)
    }
    this.updateSelections()
  }

  public createElement = () => {
    this.container = document.createElement('div')
    this.container.classList.add('block')
    this.container.contentEditable = 'false'
    this.dom.setAttribute('contenteditable', 'false')
    this.dom.appendChild(this.container)
  }

  private handleSave = (attrs: BibliographyItemAttrs) => {
    updateNodeAttrs(this.view, schema.nodes.bibliography_item, attrs)
  }

  private handleDelete = (item: BibliographyItemAttrs) => {
    deleteNode(this.view, item.id)
  }

  private updateSelections = () => {
    const state = this.view.state
    const com = commentsKey.getState(state)
    const suggestion = selectedSuggestionKey.getState(state)?.suggestion

    const items = this.container.querySelectorAll('.bib-item')
    items.forEach((e) => {
      const item = e as HTMLElement
      if (suggestion?.id && item.dataset.trackId === suggestion?.id) {
        item.classList.add('selected-suggestion')
      } else {
        item.classList.remove('selected-suggestion')
      }

      const marker = item.querySelector('.comment-marker') as HTMLElement
      const key = marker.dataset.key as CommentKey
      const comments = com?.commentsByKey.get(key)
      if (!comments) {
        marker.setAttribute('data-count', '0')
      } else if (comments.length !== 1) {
        marker.setAttribute('data-count', String(comments.length))
      } else {
        marker.removeAttribute('data-count')
      }
      if (key === com?.selection?.key) {
        marker.classList.add('selected-comment')
      } else {
        marker.classList.remove('selected-comment')
      }
    })
  }
}

export default createNodeView(BibliographyElementBlockView)

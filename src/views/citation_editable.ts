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
import { ManuscriptNode, schema } from '@manuscripts/transform'
import { TextSelection } from 'prosemirror-state'
import { findChildrenByType } from 'prosemirror-utils'

import {
  CitationEditor,
  CitationEditorProps,
} from '../components/references/CitationEditor'
import {
  CitationViewer,
  CitationViewerProps,
} from '../components/references/CitationViewer'
import { handleComment } from '../lib/comments'
import { Crossref } from '../lib/crossref'
import { BibliographyItemAttrs } from '../lib/references'
import { isDeleted } from '../lib/track-changes-utils'
import { deleteNode, findChildByID, updateNodeAttrs } from '../lib/view'
import { getBibliographyPluginState } from '../plugins/bibliography'
import { CitationView } from './citation'
import { createEditableNodeView } from './creators'
import ReactSubView from './ReactSubView'

const createBibliographySection = (node: ManuscriptNode) =>
  schema.nodes.bibliography_section.createAndFill({}, [
    schema.nodes.section_title.create({}, schema.text('References')),
    schema.nodes.bibliography_element.create({}, node ? [node] : []),
  ]) as ManuscriptNode

export class CitationEditableView extends CitationView {
  private editor: HTMLElement
  private contextMenu: HTMLElement
  private can = this.props.getCapabilities()

  createDOM() {
    super.createDOM()
    this.dom.addEventListener('mouseup', this.handleClick)
  }

  // we added this to stop select events in case th e user clicks on the comment,
  // so it won't interfere with the context menu
  public stopEvent = (event: Event) => {
    const element = event.target as Element
    return !!(
      element.classList.contains('point-comment') ||
      element.classList.contains('comment-icon') ||
      element.parentElement?.classList.contains('comment-icon')
    )
  }

  public handleClick = (event: MouseEvent) => {
    if (!this.can.seeReferencesButtons) {
      this.showPopper()
    } else if (!isDeleted(this.node) && event.button === 0) {
      const attrs = this.node.attrs
      if (attrs.rids.length) {
        this.showContextMenu()
      }
    }
  }
  public selectNode = () => {
    this.dom.classList.add('ProseMirror-selectednode')
    if (this.can.seeReferencesButtons && !isDeleted(this.node)) {
      const attrs = this.node.attrs
      if (!attrs.rids.length) {
        this.showPopper()
      }
    }
  }

  public destroy = () => {
    this.editor?.remove()
    this.props.popper.destroy()
  }

  public showContextMenu = () => {
    this.props.popper.destroy()

    const can = this.props.getCapabilities()
    const actions = [
      {
        label: 'Comment',
        action: () => handleComment(this.node, this.view),
        icon: 'AddComment',
      },
    ]

    if (can.editArticle) {
      actions.unshift({
        label: 'Edit',
        action: () => this.handleEdit(),
        icon: 'Edit',
      })
    }
    const componentProps: ContextMenuProps = {
      actions,
    }
    this.contextMenu = ReactSubView(
      this.props,
      ContextMenu,
      componentProps,
      this.node,
      this.getPos,
      this.view,
      ['context-menu']
    )
    this.props.popper.show(this.dom, this.contextMenu, 'right-start', false)
  }

  public showPopper = () => {
    this.props.popper.destroy()
    const bib = getBibliographyPluginState(this.view.state)
    if (!bib) {
      return
    }
    const can = this.props.getCapabilities()

    const attrs = this.node.attrs
    const rids = attrs.rids

    const items = Array.from(bib.bibliographyItems.values())

    if (can.editArticle) {
      const query = this.node.attrs.selectedText
      const componentProps: CitationEditorProps = {
        query,
        rids,
        items,
        citationCounts: bib.citationCounts,
        sources: [Crossref],
        onCite: this.handleCite,
        onUncite: this.handleUncite,
        onSave: this.handleSave,
        onDelete: this.handleDelete,
        onCancel: this.handleCancel,
        canEdit: can.editCitationsAndRefs,
      }

      this.editor = ReactSubView(
        this.props,
        CitationEditor,
        componentProps,
        this.node,
        this.getPos,
        this.view,
        ['citation-editor']
      )
    } else {
      const componentProps: CitationViewerProps = {
        rids,
        items,
      }
      this.editor = ReactSubView(
        this.props,
        CitationViewer,
        componentProps,
        this.node,
        this.getPos,
        this.view,
        ['citation-editor']
      )
    }
    this.props.popper.show(this.dom, this.editor, 'auto')
  }

  private handleEdit = () => {
    this.showPopper()
  }

  private handleCancel = () => {
    // move the cursor after this node
    const selection = TextSelection.create(
      this.view.state.tr.doc,
      this.getPos() + 1
    )
    this.view.dispatch(this.view.state.tr.setSelection(selection))

    this.props.popper.destroy()
  }

  private handleSave = (attrs: BibliographyItemAttrs) => {
    if (!findChildByID(this.view, attrs.id)) {
      this.insertBibliographyNode(attrs)
    } else {
      updateNodeAttrs(this.view, schema.nodes.bibliography_item, attrs)
    }
  }

  private handleUncite = (id: string) => {
    const attrs = this.node.attrs
    const rids = attrs.rids.filter((i) => i !== id)
    const pos = this.getPos()
    const tr = this.view.state.tr

    if (rids.length > 0) {
      tr.setNodeMarkup(pos, undefined, {
        ...attrs,
        rids,
      })
    } else {
      tr.delete(pos, pos + 1)
    }

    this.view.dispatch(tr)
    this.props.popper.destroy()
  }

  private handleCite = (items: BibliographyItemAttrs[]) => {
    const bib = getBibliographyPluginState(this.view.state)
    if (!bib) {
      return
    }

    const attrs = this.node.attrs
    const rids = [...attrs.rids]

    items = items.filter((i) => !rids.includes(i.id))

    for (const item of items) {
      const existingItem = bib.bibliographyItems.get(item.id)

      if (existingItem) {
        item.id = existingItem.id
      } else {
        this.insertBibliographyNode(item)
      }

      rids.push(item.id)
    }

    const tr = this.view.state.tr
    const pos = this.getPos()
    tr.setNodeMarkup(pos, undefined, {
      ...attrs,
      rids,
    })

    this.view.dispatch(tr)
    this.handleCancel()
  }

  private handleDelete = (item: BibliographyItemAttrs) => {
    return deleteNode(this.view, item.id)
  }

  private insertBibliographyNode(attrs: BibliographyItemAttrs) {
    const { doc, tr } = this.view.state

    const biblioSection = findChildrenByType(
      doc,
      schema.nodes.bibliography_element,
      true
    )

    const backmatter = findChildrenByType(doc, schema.nodes.backmatter, true)
    const backmatterEnd = backmatter[0]
      ? backmatter[0].node.nodeSize + backmatter[0].pos
      : 0

    const node = schema.nodes.bibliography_item.create(attrs)

    if (biblioSection.length) {
      this.view.dispatch(tr.insert(biblioSection[0].pos + 1, node))
    } else {
      this.view.dispatch(
        tr.insert(
          backmatterEnd ? backmatterEnd - 1 : tr.doc.content.size,
          createBibliographySection(node)
        )
      )
    }

    return false
  }
}

export default createEditableNodeView(CitationEditableView)

/*!
 * © 2023 Atypon Systems LLC
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
import { AffiliationNode, schema } from '@manuscripts/transform'
import { NodeSelection } from 'prosemirror-state'

import {
  AffiliationsModal,
  AffiliationsModalProps,
} from '../components/affiliations/AffiliationsModal'
import {
  AffiliationAttrs,
  affiliationName,
  ContributorAttrs,
} from '../lib/authors'
import { handleComment } from '../lib/comments'
import {
  addTrackChangesAttributes,
  isDeleted,
} from '../lib/track-changes-utils'
import {
  deleteNode,
  findChildByID,
  findChildrenAttrsByType,
  updateNodeAttrs,
} from '../lib/view'
import { affiliationsKey, PluginState } from '../plugins/affiliations'
import { selectedSuggestionKey } from '../plugins/selected-suggestion'
import { Trackable } from '../types'
import BlockView from './block_view'
import { createNodeView } from './creators'
import ReactSubView from './ReactSubView'

//todo update AffiliationNode to AffiliationsNode
export class AffiliationsView extends BlockView<Trackable<AffiliationNode>> {
  contextMenu: HTMLElement
  version: string
  container: HTMLElement
  popper?: HTMLElement

  public ignoreMutation = () => true
  public stopEvent = () => true

  public createElement() {
    this.container = document.createElement('div')
    this.container.classList.add('affiliations', 'block')
    this.container.contentEditable = 'false'
    this.container.addEventListener('click', this.handleClick)
    this.dom.setAttribute('contenteditable', 'false')
    this.dom.appendChild(this.container)
  }

  public updateContents() {
    super.updateContents()
    const affs = affiliationsKey.getState(this.view.state)
    if (!affs) {
      return
    }
    if (this.version === affs.version) {
      this.updateSelection()
      return
    }
    this.version = affs.version
    this.container.innerHTML = ''
    this.buildAffiliations(affs)
    this.updateSelection()
  }

  private buildAffiliations(affs: PluginState) {
    const elements = []
    for (const affiliation of affs.affiliations) {
      const index = affs.indexedAffiliationIds.get(affiliation.id)
      elements.push({
        index,
        element: this.buildAffiliation(affiliation, index),
      })
    }

    elements
      .sort(this.sortAffiliations)
      .forEach((e) => this.container.appendChild(e.element))
  }

  private buildAffiliation(attrs: AffiliationAttrs, index?: number) {
    const element = document.createElement('div')
    element.classList.add('affiliation')
    element.id = attrs.id
    addTrackChangesAttributes(attrs, element)

    if (index) {
      const label = document.createElement('span')
      label.classList.add('affiliation-label')
      label.innerHTML = String(index)
      element.appendChild(label)
    }

    const name = document.createElement('span')
    name.classList.add('affiliation-name')
    name.innerHTML = affiliationName(attrs)
    element.appendChild(name)
    return element
  }

  private sortAffiliations(aff1: { index?: number }, aff2: { index?: number }) {
    const index1 = aff1.index || 10000
    const index2 = aff2.index || 10000
    return index1 - index2
  }

  private handleClick = (event: Event) => {
    const element = event.target as HTMLElement
    const item = element.closest('.affiliation')
    if (item) {
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

  private updateSelection() {
    const state = this.view.state
    const selection = selectedSuggestionKey.getState(state)?.suggestion
    this.container
      .querySelectorAll('.selected-suggestion')
      .forEach((e) => e.classList.remove('selected-suggestion'))
    if (selection) {
      const item = this.container.querySelector(
        `[data-track-id="${selection.id}"]`
      )
      item?.classList.add('selected-suggestion')
    }
  }

  insertAffiliationNode = (attrs: AffiliationAttrs) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const pos = this.getPos()
    const tr = this.view.state.tr
    const node = schema.nodes.affiliation.create(attrs)
    this.view.dispatch(tr.insert(pos + 1, node))
  }

  handleSaveAffiliation = (affiliation: AffiliationAttrs) => {
    const update = updateNodeAttrs(
      this.view,
      schema.nodes.affiliation,
      affiliation
    )

    if (!update) {
      this.insertAffiliationNode(affiliation)
    }
  }

  handleDeleteAffiliation = (affiliation: AffiliationAttrs) => {
    deleteNode(this.view, affiliation.id)
  }

  handleEdit = (addNew?: boolean) => {
    this.props.popper.destroy()
    const contributors: ContributorAttrs[] = findChildrenAttrsByType(
      this.view,
      schema.nodes.contributor
    )

    const affiliations: AffiliationAttrs[] = findChildrenAttrsByType(
      this.view,
      schema.nodes.affiliation
    )

    const componentProps: AffiliationsModalProps = {
      authors: contributors,
      affiliations,
      onSaveAffiliation: this.handleSaveAffiliation,
      onDeleteAffiliation: this.handleDeleteAffiliation,
      onUpdateAuthors: this.handleUpdateAuthors,
      addNewAffiliation: addNew,
    }

    this.popper?.remove()

    this.popper = ReactSubView(
      this.props,
      AffiliationsModal,
      componentProps,
      this.node,
      this.getPos,
      this.view
    )
    this.container.appendChild(this.popper)
  }

  public showContextMenu = (): HTMLElement | undefined => {
    const can = this.props.getCapabilities()
    const componentProps: ContextMenuProps = {
      actions: [],
    }

    if (can.editArticle) {
      componentProps.actions.push({
        label: 'Comment',
        action: () => handleComment(this.node, this.view),
        icon: 'AddComment',
      })
      componentProps.actions.push({
        label: 'New Affiliation',
        action: () => this.handleEdit(true),
        icon: 'AddOutline',
      })
      componentProps.actions.push({
        label: 'Edit',
        action: () => this.handleEdit(),
        icon: 'Edit',
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
      return this.contextMenu
    }

    return undefined
  }

  public actionGutterButtons = (): HTMLElement[] => {
    const contextMenu = this.showContextMenu()
    return contextMenu ? [contextMenu] : []
  }

  public selectNode = () => {
    // Query the selected marker
    const selectedMarker = document.querySelector(
      '.comment-marker.selected-comment'
    )

    this.dom.classList.add('ProseMirror-selectednode')

    // Open the modal if the node is not deleted and the comment marker is not selected
    if (!isDeleted(this.node) && !selectedMarker) {
      this.handleEdit(true)
    }
  }

  handleUpdateAuthors = (authors: ContributorAttrs[]) => {
    authors.forEach((author) => {
      updateNodeAttrs(this.view, schema.nodes.contributor, author)
    })
  }
}

export default createNodeView(AffiliationsView)

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
import { ContributorsNode, schema } from '@manuscripts/transform'
import { NodeSelection } from 'prosemirror-state'

import {
  AuthorsModal,
  AuthorsModalProps,
} from '../components/authors/AuthorsModal'
import {
  AffiliationAttrs,
  authorComparator,
  authorLabel,
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
  findChildByType,
  findChildrenAttrsByType,
  updateNodeAttrs,
} from '../lib/view'
import { affiliationsKey, PluginState } from '../plugins/affiliations'
import { selectedSuggestionKey } from '../plugins/selected-suggestion'
import { Trackable } from '../types'
import BlockView from './block_view'
import { createNodeView } from './creators'
import ReactSubView from './ReactSubView'
export class ContributorsView extends BlockView<Trackable<ContributorsNode>> {
  contextMenu: HTMLElement
  container: HTMLElement
  inner: HTMLElement
  popper?: HTMLElement
  version: string

  public ignoreMutation = () => true
  public stopEvent = () => true

  public updateContents() {
    super.updateContents()
    const affs = affiliationsKey.getState(this.view.state)
    if (!affs) {
      return
    }
    if (affs.version === this.version) {
      this.updateSelection()
      return
    }
    this.version = affs.version
    this.container.innerHTML = ''

    this.buildAuthors(affs)
    this.createLegend()
    this.updateSelection()
  }

  public selectNode = () => {
    // Query the selected marker
    const selectedMarker = document.querySelector(
      '.comment-marker.selected-comment'
    )

    this.dom.classList.add('ProseMirror-selectednode')

    // Open the modal if the node is not deleted and the comment marker is not selected
    if (!isDeleted(this.node) && !selectedMarker) {
      this.handleEdit('', true)
    }
  }

  buildAuthors = (affs: PluginState) => {
    const wrapper = document.createElement('div')
    wrapper.classList.add('contributors-list')

    const can = this.props.getCapabilities()
    if (can.editMetadata) {
      wrapper.addEventListener('click', this.handleClick)
    }

    const authors = affs.contributors

    authors.sort(authorComparator).forEach((author, i) => {
      if (author.role !== 'author') {
        return
      }
      const jointAuthors = this.isJointFirstAuthor(authors, i)
      wrapper.appendChild(this.buildAuthor(author, jointAuthors))
      if (i !== authors.length - 1) {
        const separator = document.createElement('span')
        separator.classList.add('separator')
        separator.innerHTML = ','
        wrapper.appendChild(separator)
      }
    })

    this.container.appendChild(wrapper)
  }

  buildAuthor = (attrs: ContributorAttrs, isJointFirstAuthor: boolean) => {
    const state = this.view.state
    const affs = affiliationsKey.getState(state)?.indexedAffiliationIds

    const container = document.createElement('span')
    container.classList.add('contributor')
    container.setAttribute('id', attrs.id)
    container.setAttribute('contenteditable', 'false')

    addTrackChangesAttributes(attrs, container)

    const name = authorLabel(attrs)
    container.innerHTML =
      attrs.isCorresponding && attrs.email
        ? `<span class="name">${name} (${attrs.email})</span>`
        : `<span class="name">${name}</span>`

    const noteText: string[] = []
    if (affs) {
      attrs.affiliations.map((a) => {
        const index = affs.get(a)
        if (index) {
          noteText.push(index.toString())
        }
      })
    }

    if (isJointFirstAuthor) {
      container.appendChild(this.createNote('†', 'Joint contributor'))
    }

    if (noteText) {
      container.appendChild(this.createNote(noteText.join(',')))
    }

    if (attrs.isCorresponding) {
      container.appendChild(this.createNote('*', 'Corresponding author'))
    }

    return container
  }

  private createNote(text = '', title = '') {
    const note = document.createElement('span')
    note.innerHTML = text
    if (title) {
      note.setAttribute('title', title)
    }
    note.classList.add('contributor-note')
    return note
  }

  private isJointFirstAuthor = (authors: ContributorAttrs[], index: number) => {
    const author = index === 0 ? authors[index] : authors[index - 1]
    return Boolean(author.isJointContributor)
  }

  public createElement = () => {
    this.inner = document.createElement('div')
    this.inner.classList.add('authors-container', 'block')
    this.dom.appendChild(this.inner)

    this.container = document.createElement('div')
    this.container.classList.add('contributors')
    this.inner.appendChild(this.container)
  }

  public createDOM = () => {
    this.dom = document.createElement('div')
    this.dom.classList.add('block-container', `block-${this.node.type.name}`)
  }

  public authorContextMenu = (): HTMLElement | undefined => {
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
        label: 'New Author',
        action: () => this.handleEdit('', true),
        icon: 'AddOutline',
      })
      componentProps.actions.push({
        label: 'Edit',
        action: () => this.handleEdit(''),
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
    const contextMenu = this.authorContextMenu()
    return contextMenu ? [contextMenu] : []
  }

  createLegend = () => {
    const state = affiliationsKey.getState(this.view.state)
    if (state?.contributors) {
      const isThereJointContributor = state.contributors.find(
        (attrs) => attrs.isJointContributor
      )
      if (isThereJointContributor) {
        const element = document.createElement('p')
        element.classList.add('contributors-legend')
        element.innerHTML =
          '<span class="symbol">†</span>These authors contributed equally to this work.'
        this.container.appendChild(element)
      }
    }
  }
  private handleClick = (event: Event) => {
    this.props.popper.destroy()
    const element = event.target as HTMLElement
    const author = element.closest('.contributor')
    if (!author) {
      return
    }
    const { node, pos } = findChildByID(this.view, author.id) || {}
    if (!node || !pos) {
      return
    }
    if (!isDeleted(node)) {
      this.showContextMenu(author)
    }
    const view = this.view
    const tr = view.state.tr
    tr.setSelection(NodeSelection.create(view.state.doc, pos))
    view.dispatch(tr)
  }

  private updateSelection = () => {
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

  public showContextMenu = (element: Element) => {
    this.props.popper.destroy() // destroy the old context menu

    const componentProps: ContextMenuProps = {
      actions: [
        {
          label: 'Edit',
          action: () => this.handleEdit(element.id),
          icon: 'Edit',
        },
      ],
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
    this.props.popper.show(element, this.contextMenu, 'right-start')
  }

  handleEdit = (id: string, addNew?: boolean) => {
    this.props.popper.destroy()

    const contributors: ContributorAttrs[] = findChildrenAttrsByType(
      this.view,
      schema.nodes.contributor
    )

    const affiliations: AffiliationAttrs[] = findChildrenAttrsByType(
      this.view,
      schema.nodes.affiliation
    )

    const author = id ? contributors.filter((a) => a.id === id)[0] : undefined
    const componentProps: AuthorsModalProps = {
      author,
      authors: contributors,
      affiliations,
      onSaveAuthor: this.handleSaveAuthor,
      onDeleteAuthor: this.handleDeleteAuthor,
      addNewAuthor: addNew,
    }

    this.popper?.remove()

    this.popper = ReactSubView(
      this.props,
      AuthorsModal,
      componentProps,
      this.node,
      this.getPos,
      this.view
    )

    this.container.appendChild(this.popper)
  }
  handleSaveAuthor = (author: ContributorAttrs) => {
    const update = updateNodeAttrs(this.view, schema.nodes.contributor, author)
    if (!update) {
      this.insertAuthorNode(author)
    }
  }

  handleDeleteAuthor = (author: ContributorAttrs) => {
    deleteNode(this.view, author.id)
  }

  insertAuthorNode = (attrs: ContributorAttrs) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const parent = findChildByType(this.view, schema.nodes.contributors)!
    const tr = this.view.state.tr
    const node = schema.nodes.contributor.create(attrs)
    this.view.dispatch(tr.insert(parent.pos + 1, node))
  }

  insertAffiliationNode = (attrs: AffiliationAttrs) => {
    const { view } = this
    const { dispatch } = view
    const affiliationsNodeType = schema.nodes.affiliations
    const contributorsNodeType = schema.nodes.contributors
    const affiliationNodeType = schema.nodes.affiliation

    let affiliations = findChildByType(view, affiliationsNodeType)

    if (!affiliations) {
      const contributors = findChildByType(view, contributorsNodeType)

      if (contributors) {
        const { tr } = this.view.state
        const affiliationsNode = affiliationsNodeType.create()
        const insertPos = contributors.pos + contributors.node.nodeSize
        dispatch(tr.insert(insertPos, affiliationsNode))
        affiliations = findChildByType(view, affiliationsNodeType)
      }
    }

    if (affiliations) {
      const { tr } = this.view.state
      const affiliationNode = affiliationNodeType.create(attrs)
      dispatch(tr.insert(affiliations.pos + 1, affiliationNode))
    }
  }
}

export default createNodeView(ContributorsView)

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
import { AwardNode, schema } from '@manuscripts/transform'

import { AwardModal, AwardModalProps } from '../components/awards/AwardModal'
import {
  DeleteAwardDialog,
  DeleteAwardDialogProps,
} from '../components/awards/DeleteAwardDiaolog'
import { isDeleted } from '../lib/track-changes-utils'
import { updateNodeAttrs } from '../lib/view'
import { Trackable, TrackableAttributes } from '../types'
import BlockView from './block_view'
import { createNodeView } from './creators'
import ReactSubView from './ReactSubView'

export type AwardAttrs = TrackableAttributes<AwardNode>
export class AwardView extends BlockView<Trackable<AwardNode>> {
  protected popperContainer: HTMLDivElement
  private dialog: HTMLElement
  newAward = false

  public updateContents() {
    super.updateContents()
    if (!this.contentDOM) {
      return
    }
    const { recipient, code, source } = this.node.attrs
    if (!source) {
      return
    }

    this.contentDOM.innerHTML = ''
    const notAvailable = 'N/A'
    const fragment = document.createDocumentFragment()

    fragment.appendChild(this.createAwardFragment('award-source', '', source))

    fragment.appendChild(
      this.createAwardFragment(
        'award-code',
        'Grant Number(s): ',
        code ? code.split(';').join(', ') : notAvailable
      )
    )

    fragment.appendChild(
      this.createAwardFragment(
        'award-recipient',
        'Recipient: ',
        recipient ? recipient : notAvailable
      )
    )
    if (this.props.getCapabilities().editArticle) {
      this.dom.addEventListener('mouseup', this.handleClick)
    }

    this.contentDOM.appendChild(fragment)
    this.updateClasses()
  }

  public selectNode() {
    super.selectNode()
    // check if award is empty and open the modal for it...
    if (!this.node.attrs.source) {
      this.newAward = true
      this.showAwardModal(this.node)
    }
  }

  private createAwardFragment = (
    className: string,
    title: string,
    content: string
  ): HTMLDivElement => {
    const awardFragment = document.createElement('div')
    awardFragment.classList.add(className)
    if (title) {
      const titleElement = document.createElement('span')
      titleElement.classList.add('title')
      titleElement.textContent = title
      awardFragment.appendChild(titleElement)
    }
    if (content) {
      const contentElement = document.createElement('span')
      contentElement.classList.add('content')
      contentElement.textContent = content
      awardFragment.appendChild(contentElement)
    }
    return awardFragment
  }

  handleClick = () => {
    if (isDeleted(this.node) || !this.props.getCapabilities().editArticle) {
      return
    }
    this.showContextMenu()
  }

  showContextMenu = () => {
    this.props.popper.destroy()
    if (!this.contentDOM) {
      return
    }
    const componentProps: ContextMenuProps = {
      actions: [
        {
          label: 'Edit Funder Info',
          action: () => {
            this.props.popper.destroy()
            this.showAwardModal(this.node)
          },
          icon: 'Edit',
        },
        {
          label: 'Delete Funder Info',
          action: () => {
            this.props.popper.destroy()
            this.showDeleteAwardDialog()
          },
          icon: 'Delete',
        },
      ],
    }
    this.props.popper.show(
      this.contentDOM,
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

  showAwardModal = (award: AwardNode) => {
    this.dialog?.remove()
    this.popperContainer?.remove()

    const componentProps: AwardModalProps = {
      initialData: award?.attrs || ({} as AwardAttrs),
      onSaveAward: this.handleSaveAward,
      onCancelAward: this.handleCancelAward,
    }
    this.popperContainer = ReactSubView(
      this.props,
      AwardModal,
      componentProps,
      this.node,
      this.getPos,
      this.view,
      ['award-editor']
    )
    this.props.popper.show(this.dom, this.popperContainer, 'auto', false)
  }

  showDeleteAwardDialog = () => {
    this.dialog?.remove()
    const componentProps: DeleteAwardDialogProps = {
      handleDelete: this.handleDeleteAward,
    }

    this.popperContainer = ReactSubView(
      this.props,
      DeleteAwardDialog,
      componentProps,
      this.node,
      this.getPos,
      this.view,
      ['award-editor']
    )
    this.props.popper.show(this.dom, this.popperContainer, 'auto', false)
  }

  handleSaveAward = (award: AwardAttrs) => {
    updateNodeAttrs(this.view, schema.nodes.award, award)
  }

  handleCancelAward = () => {
    if (this.newAward) {
      this.handleDeleteAward()
    }
  }

  handleDeleteAward = () => {
    const award = this.node
    const pos = this.getPos()
    if (award) {
      const tr = this.view.state.tr
      const from = pos
      const to = pos + award.nodeSize
      this.view.dispatch(tr.delete(from, to))
    }
  }
}

export default createNodeView(AwardView)

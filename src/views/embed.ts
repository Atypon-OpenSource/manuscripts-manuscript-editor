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
import { EmbedNode } from '@manuscripts/transform'

import { addNodeComment } from '../commands'
import {
  NoPreviewMessageWithLink,
  openEmbedDialog,
} from '../components/toolbar/InsertEmbedDialog'
import { openDeleteEmbedDialog } from '../components/views/DeleteEmbedDialog'
import { getOEmbedHTML, getOEmbedUrl } from '../lib/oembed'
import { Trackable } from '../types'
import BlockView from './block_view'
import { createNodeView } from './creators'
import ReactSubView from './ReactSubView'

export class EmbedMediaView extends BlockView<Trackable<EmbedNode>> {
  private container: HTMLElement
  private href: string
  public ignoreMutation = () => true
  public stopEvent = () => true

  public createElement = () => {
    this.container = document.createElement('div')
    this.container.classList.add('block')
    this.container.setAttribute('id', this.node.attrs.id)
    this.dom.appendChild(this.container)

    this.contentDOM = document.createElement('div')
    this.container.appendChild(this.contentDOM)
    this.buildContextMenu(this.container)
  }

  public async updateContents() {
    super.updateContents()
    if (this.href !== this.node.attrs.href) {
      this.href = this.node.attrs.href
      await this.updateOEmbedPreview()
    }
  }

  private async updateOEmbedPreview() {
    const preview = document.createElement('div')
    preview.classList.add('embed-media-preview')
    preview.setAttribute('contenteditable', 'false')

    const oldPreview = this.container.querySelector('.embed-media-preview')
    if (oldPreview) {
      this.container.replaceChild(preview, oldPreview)
    } else {
      this.container.prepend(preview)
    }

    const oEmbedUrl = await getOEmbedUrl(this.href, 643, 363)
    if (oEmbedUrl) {
      const oembedHTML = await getOEmbedHTML(oEmbedUrl, this.href)
      if (oembedHTML) {
        preview.innerHTML = oembedHTML
        return
      }
    }
    this.showUnavailableMessage(preview)
  }

  private buildContextMenu = (preview: HTMLElement) => {
    const can = this.props.getCapabilities()

    if (!can.editArticle) {
      return
    }

    const componentProps: ContextMenuProps = {
      actions: [
        {
          label: 'Comment',
          action: () =>
            addNodeComment(this.node, this.view.state, this.view.dispatch),
          icon: 'AddComment',
        },
        {
          label: 'Delete',
          action: () =>
            openDeleteEmbedDialog(this.view, this.node, this.getPos()),
          icon: 'Delete',
        },
        {
          label: 'Edit',
          action: () => openEmbedDialog(this.view, 'Update', this.getPos()),
          icon: 'Edit',
        },
      ],
    }

    preview.appendChild(
      ReactSubView(
        this.props,
        ContextMenu,
        componentProps,
        this.node,
        this.getPos,
        this.view,
        ['embed-context-menu']
      )
    )
  }

  private showUnavailableMessage(preview: HTMLElement) {
    preview.appendChild(
      ReactSubView(
        this.props,
        NoPreviewMessageWithLink,
        { href: this.node.attrs.href },
        this.node,
        this.getPos,
        this.view
      )
    )
  }
}

export default createNodeView(EmbedMediaView)

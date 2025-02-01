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

import { schema } from '@manuscripts/transform'
import { TextSelection } from 'prosemirror-state'

import {
  LinkForm,
  LinkFormProps,
  LinkValue,
} from '../components/views/LinkForm'
import { isDeleted } from '../lib/track-changes-utils'
import { allowedHref } from '../lib/url'
import { createEditableNodeView } from './creators'
import { LinkView } from './link'
import ReactSubView from './ReactSubView'

export class LinkEditableView extends LinkView {
  protected popperContainer: HTMLDivElement

  public ignoreMutation = () => true

  public initialise = () => {
    this.createDOM()
    this.updateContents()
  }

  public updateContents() {
    super.updateContents()
    this.contentDOM = this.dom

    const attrs = this.node.attrs
    const href = attrs.href
    const title = attrs.title

    this.dom.setAttribute('href', allowedHref(href) ? href : '')
    this.dom.setAttribute('target', '_blank')
    this.dom.setAttribute('title', title || '')
  }

  protected createDOM = () => {
    this.dom = document.createElement('a')
    this.dom.classList.add('link')
    this.dom.addEventListener('click', this.handleClick)
  }

  public selectNode = () => {
    if (!isDeleted(this.node)) {
      this.showForm()
    }
  }

  public destroy = () => {
    this.closeForm()
  }

  public deselectNode = () => {
    const attrs = this.node.attrs
    if (!this.node.content.size || !attrs.href) {
      this.removeLink()
    }
    this.closeForm()
  }

  private showForm = () => {
    if (!this.props.getCapabilities().editArticle) {
      return
    }

    const attrs = this.node.attrs

    const value: LinkValue = {
      href: attrs.href,
      title: attrs.title,
      text: this.node.textContent,
    }

    const componentProps: LinkFormProps = {
      value,
      onCancel: this.handleCancel,
      onRemove: this.handleRemove,
      onSave: this.handleSave,
    }

    this.popperContainer = ReactSubView(
      this.props,
      LinkForm,
      componentProps,
      this.node,
      this.getPos,
      this.view,
      ['link-editor']
    )

    this.props.popper.show(this.dom, this.popperContainer, 'bottom')
  }

  private handleClick = (e: Event) => {
    if (this.props.getCapabilities().editArticle) {
      e.preventDefault()
    }
  }

  private handleCancel = () => {
    const attrs = this.node.attrs
    if (!this.node.content.size || !attrs.href) {
      this.removeLink()
    }
    this.closeForm()
  }

  private handleRemove = () => {
    this.removeLink()
    this.closeForm()
  }

  private handleSave = (value: LinkValue) => {
    const tr = this.view.state.tr

    const attrs = this.node.attrs
    const pos = this.getPos()

    if (value.href !== attrs.href || value.title !== attrs.title) {
      tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        href: value.href,
        title: value.title,
      })
    }
    if (value.text !== this.node.textContent) {
      tr.delete(pos + 1, pos + this.node.nodeSize - 1)
      tr.insert(pos + 1, schema.text(value.text))
    }

    tr.setSelection(TextSelection.create(tr.doc, pos))
    this.view.focus()
    this.view.dispatch(tr)
    this.closeForm()
  }

  private removeLink = () => {
    const tr = this.view.state.tr
    const pos = this.getPos()
    tr.delete(pos, pos + this.node.nodeSize)
    const text = this.node.textContent
    if (text) {
      tr.insert(pos, schema.text(text))
    }
    tr.setSelection(TextSelection.create(tr.doc, pos))
    this.view.dispatch(tr)
  }

  private closeForm = () => {
    this.props.popper.destroy()
    this.popperContainer?.remove()
  }
}

export default createEditableNodeView(LinkEditableView)

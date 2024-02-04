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

import { KeywordNode, ManuscriptNodeView } from '@manuscripts/transform'
import { TextSelection } from 'prosemirror-state'

import {
  DeleteKeywordDialog,
  DeleteKeywordDialogProps,
} from '../components/keywords/DeleteKeywordDialog'
import { getChangeClasses } from '../lib/track-changes-utils'
import { BaseNodeView } from './base_node_view'
import { createNodeView } from './creators'
import { EditableBlockProps } from './editable_block'
import ReactSubView from './ReactSubView'

export class KeywordView
  extends BaseNodeView<EditableBlockProps>
  implements ManuscriptNodeView
{
  private dialog: HTMLElement

  public initialise = () => {
    this.createDOM()
    this.updateContents()
  }

  public createDOM = () => {
    this.dom = document.createElement('span')
    this.contentDOM = document.createElement('span')
  }

  public updateContents = () => {
    const keyword = document.createElement('span')
    const classes = ['keyword', ...getChangeClasses(this.node)]
    keyword.classList.add(...classes)
    keyword.appendChild(this.contentDOM as HTMLElement)

    this.dom.innerHTML = ''

    const can = this.props.getCapabilities()

    if (can.editArticle) {
      this.renderConfirmationDialog(keyword)
    }

    this.dom.appendChild(keyword)
  }

  private renderConfirmationDialog = (keywordDom: HTMLElement) => {
    this.dialog?.remove()

    const keyword = this.node as KeywordNode
    const pos = this.getPos()

    const handleDelete = () => {
      const tr = this.view.state.tr
      tr.setSelection(
        TextSelection.near(this.view.state.doc.resolve(0))
      ).delete(pos, pos + keyword.nodeSize + 1)
      this.view.dispatch(tr)
    }

    const componentProps: DeleteKeywordDialogProps = {
      keyword: keyword.textContent,
      handleDelete: handleDelete,
    }

    this.dialog = ReactSubView(
      this.props,
      DeleteKeywordDialog,
      componentProps,
      this.node,
      this.getPos,
      this.view,
      'keywords-delete'
    )

    if (this.dialog) {
      keywordDom.appendChild(this.dialog)
    }
  }
}

export default createNodeView(KeywordView)

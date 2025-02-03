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
import { Trackable } from '../types'
import { BaseNodeView } from './base_node_view'
import { createNodeView } from './creators'
import ReactSubView from './ReactSubView'

//todo fix
const deleteIcon =
  '<svg width="8px" height="8px" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">\n' +
  '    <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">\n' +
  '        <g fill="#6E6E6E">\n' +
  '            <rect id="Rectangle-23-Copy" transform="translate(13.000000, 13.000000) rotate(-45.000000) translate(-13.000000, -13.000000) " x="-3" y="11" width="32" height="4" rx="2"></rect>\n' +
  '            <rect id="Rectangle-23-Copy-2" transform="translate(13.000000, 13.000000) scale(1, -1) rotate(-45.000000) translate(-13.000000, -13.000000) " x="-3" y="11" width="32" height="4" rx="2"></rect>\n' +
  '        </g>\n' +
  '    </g>\n' +
  '</svg>'

export class KeywordView
  extends BaseNodeView<Trackable<KeywordNode>>
  implements ManuscriptNodeView
{
  private dialog: HTMLElement

  public initialise = () => {
    this.createDOM()
    this.updateContents()
  }

  public createDOM = () => {
    this.dom = document.createElement('span')
    this.dom.classList.add('keyword')
    this.contentDOM = document.createElement('span')
  }

  public updateContents() {
    super.updateContents()
    this.dom.innerHTML = ''
    this.dom.appendChild(this.contentDOM as HTMLElement)

    const can = this.props.getCapabilities()

    if (can.editArticle) {
      const svg = new DOMParser()
        .parseFromString(deleteIcon, 'image/svg+xml')
        .querySelector('svg') as SVGElement
      svg.classList.add('delete-keyword')
      svg.addEventListener('click', this.showConfirmationDialog)
      this.dom.appendChild(svg)
    }
  }

  private showConfirmationDialog = () => {
    this.dialog?.remove()

    const keyword = this.node
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
      ['keywords-delete']
    )

    if (this.dialog) {
      this.dom.appendChild(this.dialog)
    }
  }
}

export default createNodeView(KeywordView)

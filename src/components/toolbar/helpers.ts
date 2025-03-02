/*!
 * © 2025 Atypon Systems LLC
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
import {
  generateNodeID,
  ManuscriptEditorState,
  ManuscriptEditorView,
  ManuscriptTransaction,
  SectionTitleNode,
} from '@manuscripts/transform'
import { Fragment } from 'prosemirror-model'
import { TextSelection } from 'prosemirror-state'

export type Dispatch = (tr: ManuscriptTransaction) => void

export const handleParagraphIndentOrMove =
  (isIndent: boolean) =>
  (
    state: ManuscriptEditorState,
    dispatch?: Dispatch,
    view?: ManuscriptEditorView
  ) => {
    const { $from } = state.selection
    const { schema, tr, doc } = state

    const paragraph = $from.node($from.depth)
    const beforeParagraph = $from.before($from.depth)
    const afterParagraph = $from.after($from.depth)
    const $afterParagraph = doc.resolve(afterParagraph)
    const afterParagraphOffset = $afterParagraph.parentOffset

    const sectionDepth = $from.depth - 1
    const parentSection = $from.node(sectionDepth)
    const sectionStart = $from.start(sectionDepth)
    const endIndex = $from.indexAfter(sectionDepth)
    const sectionEnd = $from.end(sectionDepth)

    // Determine section title based on indentation or move action
    const textContent = paragraph.textContent

    const sectionTitle: SectionTitleNode = isIndent
      ? schema.nodes.section_title.create()
      : schema.nodes.section_title.create(
          {},
          textContent ? schema.text(textContent) : undefined
        )

    // Build section content
    let sectionContent = Fragment.from(sectionTitle).append(
      parentSection.content.cut(beforeParagraph - sectionStart)
    )

    if (endIndex < parentSection.childCount) {
      sectionContent = sectionContent.append(
        parentSection.content.cut(afterParagraphOffset)
      )
    }

    // Create new section
    const newSection = schema.nodes.section.create(
      { id: generateNodeID(schema.nodes.section) },
      sectionContent
    )

    // Replace original paragraph and moved nodes with the new section
    tr.delete(beforeParagraph, sectionEnd)
    tr.insert(beforeParagraph, newSection)

    // Set selection inside the title of the new section
    tr.setSelection(TextSelection.create(tr.doc, sectionEnd + 1))

    if (dispatch) {
      dispatch(tr.scrollIntoView())
      view?.focus()
    }
  }

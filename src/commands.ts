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

import { buildContribution } from '@manuscripts/json-schema'
import { skipTracking } from '@manuscripts/track-changes-plugin'
import {
  AwardNode,
  BoxElementNode,
  FigureElementNode,
  FigureNode,
  FootnotesElementNode,
  generateNodeID,
  GraphicalAbstractSectionNode,
  isElementNodeType,
  isListNode,
  isSectionNodeType,
  isTableElementNode,
  KeywordsNode,
  ListNode,
  ManuscriptEditorState,
  ManuscriptEditorView,
  ManuscriptMarkType,
  ManuscriptNode,
  ManuscriptNodeSelection,
  ManuscriptNodeType,
  ManuscriptResolvedPos,
  ManuscriptTextSelection,
  ManuscriptTransaction,
  schema,
  SectionCategory,
  SectionNode,
  SupplementNode,
} from '@manuscripts/transform'
import {
  Attrs,
  Fragment,
  NodeRange,
  NodeType,
  ResolvedPos,
  Slice,
} from 'prosemirror-model'
import { wrapInList } from 'prosemirror-schema-list'
import {
  EditorState,
  NodeSelection,
  Selection,
  TextSelection,
  Transaction,
} from 'prosemirror-state'
import {
  addColumnAfter,
  addColumnBefore,
  addRow,
  selectedRect,
} from 'prosemirror-tables'
import {
  findWrapping,
  liftTarget,
  ReplaceAroundStep,
  ReplaceStep,
} from 'prosemirror-transform'
import {
  findChildrenByType,
  findParentNodeOfType,
  findParentNodeOfTypeClosestToPos,
  flatten,
  hasParentNodeOfType,
  NodeWithPos,
} from 'prosemirror-utils'
import { EditorView } from 'prosemirror-view'

import { CommentAttrs, getCommentKey, getCommentRange } from './lib/comments'
import {
  findBackmatter,
  findBibliographySection,
  findBody,
  insertAwardsNode,
  insertFootnotesSection,
  insertSupplementsNode,
} from './lib/doc'
import { FileAttachment } from './lib/files'
import {
  createFootnote,
  findFootnotesContainerNode,
  getFootnotesElementState,
} from './lib/footnotes'
import {
  findWordBoundaries,
  isNodeOfType,
  nearestAncestor,
} from './lib/helpers'
import { isDeleted, isPendingInsert } from './lib/track-changes-utils'
import {
  findParentNodeWithId,
  getChildOfType,
  getMatchingChild,
} from './lib/utils'
import { setCommentSelection } from './plugins/comments'
import { getEditorProps } from './plugins/editor-props'
import { checkForCompletion } from './plugins/section_title/autocompletion'
import { EditorAction } from './types'

export type Dispatch = (tr: ManuscriptTransaction) => void

// enter at the start of paragraph will add node above
export const addToStart = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch
): boolean => {
  const { selection } = state

  if (
    !dispatch ||
    !(selection instanceof TextSelection) ||
    (selection.$from.node().type !== schema.nodes.paragraph &&
      selection.$from.node().type !== schema.nodes.text_block)
  ) {
    return false
  }

  const {
    $anchor: { parentOffset: startOffset },
    $head: { parentOffset: endOffset },
    $from,
    $to,
  } = selection
  const parentSize = $from.node().content.size

  if (
    (startOffset === 0 && endOffset === 0) ||
    startOffset === parentSize ||
    endOffset === parentSize
  ) {
    const side =
      (!$from.parentOffset && $to.index() < $to.parent.childCount ? $from : $to)
        .pos - (startOffset === 0 ? 1 : 0)

    const tr = state.tr
    const from = $from.node().type.createAndFill()
    if (from) {
      tr.insert(side, from)
      dispatch(tr.scrollIntoView())
      return true
    }
  }
  return false
}

export const markActive =
  (type: ManuscriptMarkType) =>
  (state: ManuscriptEditorState): boolean => {
    const { from, $from, to, empty } = state.selection

    return empty
      ? Boolean(type.isInSet(state.storedMarks || $from.marks()))
      : state.doc.rangeHasMark(from, to, type)
  }

export const isNodeSelection = (
  selection: Selection
): selection is ManuscriptNodeSelection => selection instanceof NodeSelection

export const blockActive =
  (type: ManuscriptNodeType) => (state: ManuscriptEditorState) => {
    const { selection } = state

    if (isNodeSelection(selection)) {
      return selection.node.type === type
    }

    const { to, $from } = selection as ManuscriptTextSelection

    if (to > $from.end()) {
      return false
    }

    for (let d = $from.depth; d >= 0; d--) {
      const ancestor = $from.node(d)

      // only look at the closest parent with an id
      if (ancestor.attrs.id) {
        return ancestor.type === type
      }
    }

    return false
  }

export const canInsert =
  (type: ManuscriptNodeType) => (state: ManuscriptEditorState) => {
    const { $from, $to } = state.selection

    // disable block comment insertion just for title node, LEAN-2746
    if (
      ($from.node().type === schema.nodes.title ||
        $from.node().type === schema.nodes.section_title) &&
      $from.pos === $to.pos
    ) {
      return false
    }

    if (
      isElementNodeType(type) &&
      type !== schema.nodes.paragraph &&
      findParentNodeOfType(schema.nodes.backmatter)(state.selection)
    ) {
      return false
    }

    const initDepth =
      findParentNodeOfType(schema.nodes.box_element)(state.selection)?.depth ||
      0

    for (let d = $from.depth; d >= initDepth; d--) {
      const index = $from.index(d)

      if ($from.node(d).canReplaceWith(index, index, type)) {
        return true
      }
    }

    return false
  }

const findBlockInsertPosition = (state: ManuscriptEditorState) => {
  const { $from } = state.selection

  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d)

    if (isElementNodeType(node.type)) {
      return $from.after(d)
    }
  }

  return null
}

export const createSelection = (
  nodeType: ManuscriptNodeType,
  position: number,
  doc: ManuscriptNode
) => {
  const { nodes } = nodeType.schema

  switch (nodeType) {
    case nodes.figure_element:
      // select the figure caption
      return TextSelection.near(doc.resolve(position + 5), 1)

    case nodes.listing_element:
      // select the listing
      return NodeSelection.create(doc, position + 1)

    default:
      return nodeType.isAtom
        ? NodeSelection.create(doc, position)
        : TextSelection.near(doc.resolve(position + 1))
  }
}

export const createBlock = (
  nodeType: ManuscriptNodeType,
  position: number,
  state: ManuscriptEditorState,
  dispatch?: Dispatch,
  attrs?: Attrs
) => {
  let node
  switch (nodeType) {
    case state.schema.nodes.table_element:
      node = createAndFillTableElement(state)
      break
    case state.schema.nodes.figure_element:
      node = createAndFillFigureElement(state)
      break
    case state.schema.nodes.image_element:
      node = createImageElement(state)
      break
    case state.schema.nodes.listing_element:
      node = state.schema.nodes.listing_element.create({}, [
        state.schema.nodes.listing.create(),
        createAndFillFigcaptionElement(state),
      ])
      break
    case state.schema.nodes.equation_element:
      node = state.schema.nodes.equation_element.create({}, [
        state.schema.nodes.equation.create(),
      ])
      break
    case state.schema.nodes.embed:
      node = state.schema.nodes.embed.create(attrs, [
        createAndFillFigcaptionElement(state),
      ])
      break
    default:
      node = nodeType.createAndFill(attrs)
  }

  const tr = state.tr.insert(position, node as ManuscriptNode)
  if (dispatch) {
    const selection = createSelection(nodeType, position, tr.doc)
    dispatch(tr.setSelection(selection).scrollIntoView())
  }
}

export const insertEmbed = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch,
  attrs?: Attrs
) => {
  const position = findBlockInsertPosition(state)
  if (position === null) {
    return false
  }

  createBlock(schema.nodes.embed, position, state, dispatch, attrs)

  return true
}

export const insertInlineTableFootnote = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch
) => {
  const $pos = state.selection.$to
  const table = findParentNodeOfTypeClosestToPos($pos, schema.nodes.table)
  if (!table) {
    return false
  }
  if (!dispatch) {
    return true
  }
  return insertInlineFootnote(state, dispatch)
}

export const insertGeneralTableFootnote = (
  element: [ManuscriptNode, number],
  state: ManuscriptEditorState,
  dispatch?: Dispatch
) => {
  const existing = findChildrenByType(
    element[0],
    schema.nodes.general_table_footnote
  )
  if (existing.length) {
    return false
  }
  if (!dispatch) {
    return true
  }

  const tr = state.tr
  const footer = insertTableElementFooter(tr, element)

  const pos = footer.pos + 1
  const node = schema.nodes.general_table_footnote.create({}, [
    schema.nodes.paragraph.create(),
  ])
  tr.insert(pos, node)
  const selection = TextSelection.create(tr.doc, pos + 1)
  tr.setSelection(selection).scrollIntoView()
  dispatch(tr)
}

export const insertFigure = (
  file: FileAttachment,
  state: ManuscriptEditorState,
  dispatch?: Dispatch
) => {
  const position = findBlockInsertPosition(state)
  if (position === null || !dispatch) {
    return false
  }
  const figure = state.schema.nodes.figure.createAndFill({
    label: file.name,
    src: file.id,
  }) as FigureNode

  const element = state.schema.nodes.figure_element.createAndFill({}, [
    figure,
    state.schema.nodes.figcaption.create({}, [
      state.schema.nodes.caption_title.create(),
      state.schema.nodes.caption.create(),
    ]),
  ]) as FigureElementNode
  const tr = state.tr.insert(position, element)
  dispatch(tr)
  return true
}

export const insertTable = (
  config: TableConfig,
  state: ManuscriptEditorState,
  dispatch?: Dispatch
) => {
  const pos = findBlockInsertPosition(state)
  if (!pos) {
    return false
  }
  const node = createAndFillTableElement(state, config)
  const tr = state.tr.insert(pos, node)
  tr.setSelection(NodeSelection.create(tr.doc, pos)).scrollIntoView()
  dispatch && dispatch(tr)
  return true
}

export const insertSupplement = (
  file: FileAttachment,
  state: ManuscriptEditorState,
  dispatch?: Dispatch
) => {
  const supplement = schema.nodes.supplement.createAndFill({
    id: generateNodeID(schema.nodes.supplement),
    href: file.id,
  }) as SupplementNode

  const tr = state.tr
  const supplements = insertSupplementsNode(tr)
  const pos = supplements.pos + supplements.node.nodeSize - 1
  tr.insert(pos, supplement)
  if (dispatch) {
    dispatch(skipTracking(tr))
  }
  return true
}

export const insertBlock =
  (nodeType: ManuscriptNodeType) =>
  (state: ManuscriptEditorState, dispatch?: Dispatch) => {
    const position = findBlockInsertPosition(state)
    if (position === null) {
      return false
    }

    createBlock(nodeType, position, state, dispatch, undefined)

    return true
  }

export const deleteBlock =
  (typeToDelete: string) =>
  (state: ManuscriptEditorState, dispatch?: Dispatch) => {
    const { selection, tr } = state
    const { $head } = selection
    const depth = nearestAncestor(isNodeOfType(typeToDelete))($head)

    if (!depth) {
      return false
    }

    if (dispatch) {
      const start = $head.start(depth)
      const end = $head.end(depth)
      tr.delete(start - 1, end + 1)
      dispatch(tr)
    }

    return true
  }

export const insertBreak: EditorAction = (state, dispatch) => {
  const br = state.schema.nodes.hard_break.create()

  const tr = state.tr.replaceSelectionWith(br)

  if (dispatch) {
    dispatch(tr.scrollIntoView())
  }

  return true
}

const selectedText = (): string => (window.getSelection() || '').toString()

export const findPosBeforeFirstSubsection = (
  $pos: ManuscriptResolvedPos
): number | null => {
  let posBeforeFirstSubsection: number | null = null

  for (let d = $pos.depth; d >= 0; d--) {
    const parentNode = $pos.node(d)
    if (isSectionNodeType(parentNode.type)) {
      const parentStartPos = $pos.start(d) // Get the start position of the parent section
      parentNode.descendants((node, pos) => {
        if (
          node.type === schema.nodes.section &&
          posBeforeFirstSubsection === null
        ) {
          // Found the first subsection, set the position before it
          posBeforeFirstSubsection = parentStartPos + pos
        }
        return posBeforeFirstSubsection === null
      })
      break // Stop iterating after finding the parent section
    }
  }

  return posBeforeFirstSubsection
}

const findPosAfterParentSection = (
  $pos: ManuscriptResolvedPos
): number | null => {
  for (let d = $pos.depth; d >= 0; d--) {
    const node = $pos.node(d)

    if (isSectionNodeType(node.type)) {
      return $pos.after(d)
    }
  }

  return null
}

const findParentSectionStartPosition = (
  $pos: ManuscriptResolvedPos
): number | null => {
  for (let d = $pos.depth; d >= 0; d--) {
    const node = $pos.node(d)

    if (isSectionNodeType(node.type)) {
      return $pos.start(d)
    }
  }

  return null
}

export const insertSectionLabel = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch,
  currentTr?: Transaction
) => {
  const pos = findParentSectionStartPosition(state.selection.$from)
  if (pos === null) {
    return false
  }
  const node = state.schema.nodes.section_label.create(
    {},
    state.schema.text('Label')
  )
  const tr = (currentTr || state.tr).insert(pos, node)
  if (dispatch) {
    // place cursor inside section title
    // const selection = TextSelection.create(tr.doc, pos + 2)
    dispatch(tr)
  }

  return true
}

const isLink = (text: string): boolean => /^\s*(https?:\S+)/.test(text)

export const insertLink = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch
) => {
  const tr = state.tr
  const selection = state.selection

  if (!selection.empty) {
    const text = selectedText()
    const attrs = {
      href: isLink(text) ? text.trim() : '',
    }
    const range = new NodeRange(
      selection.$from,
      selection.$to,
      selection.$from.depth
    )
    const wrapping = findWrapping(range, schema.nodes.link, attrs)

    if (wrapping) {
      tr.wrap(range, wrapping)
    }
  } else {
    tr.insert(state.selection.anchor, schema.nodes.link.create())
  }

  if (dispatch) {
    const selection = NodeSelection.create(tr.doc, state.tr.selection.from)
    dispatch(tr.setSelection(selection).scrollIntoView())
  }

  return true
}

export const insertInlineCitation = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch
) => {
  const node = schema.nodes.citation.create({
    id: generateNodeID(schema.nodes.citation),
    rids: [],
    selectedText: selectedText(),
  })

  const pos = state.selection.to

  const { tr } = state

  tr.insert(pos, node)

  if (dispatch) {
    const selection = NodeSelection.create(tr.doc, pos)
    dispatch(tr.setSelection(selection).scrollIntoView())
  }

  return true
}

export const insertCrossReference = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch
) => {
  const node = state.schema.nodes.cross_reference.create({
    rids: [],
  })

  const pos = state.selection.to

  const tr = state.tr.insert(pos, node)

  if (dispatch) {
    const selection = NodeSelection.create(tr.doc, pos)
    dispatch(tr.setSelection(selection).scrollIntoView())
  }

  return true
}

export const insertInlineEquation = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch
) => {
  const sourcePos = state.selection.from - 1

  const tr = state.tr.replaceSelectionWith(
    state.schema.nodes.inline_equation.create({
      format: 'tex',
      contents: selectedText().replace(/^\$/, '').replace(/\$$/, ''),
    })
  )

  if (dispatch) {
    const selection = NodeSelection.create(
      tr.doc,
      tr.mapping.map(sourcePos) + 1
    )
    dispatch(tr.setSelection(selection).scrollIntoView())
  }

  return true
}

export const insertTableElementFooter = (
  tr: Transaction,
  table: [ManuscriptNode, number]
) => {
  const footer = findChildrenByType(
    table[0],
    schema.nodes.table_element_footer
  )[0]
  if (footer) {
    const pos = tr.mapping.map(table[1] + footer.pos + 1)
    if (isDeleted(footer.node)) {
      reinstateNode(tr, footer.node, pos)
    }
    return {
      node: footer.node,
      pos,
    }
  }
  const pos = tr.mapping.map(table[1] + table[0].nodeSize - 2)
  const node = schema.nodes.table_element_footer.create()
  tr.insert(pos, node)
  return {
    node,
    pos,
  }
}

export const insertFootnotesElement = (
  tr: Transaction,
  container: [ManuscriptNode, number]
) => {
  let pos
  if (isTableElementNode(container[0])) {
    //table footnote
    const footer = insertTableElementFooter(tr, container)
    pos = footer.pos + footer.node.nodeSize - 1
  } else {
    //regular footnote
    const section = insertFootnotesSection(tr)
    pos = section.pos + section.node.nodeSize - 1
  }
  const node = schema.nodes.footnotes_element.create()
  tr.insert(pos, node)
  return [node, pos] as [FootnotesElementNode, number]
}

export const insertInlineFootnote = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch
) => {
  const pos = state.selection.to
  const tr = state.tr
  const container = findFootnotesContainerNode(state.doc, pos)
  const fn = getFootnotesElementState(state, container.node.attrs.id)
  const hasFootnotes =
    fn && fn.footnotes.filter((fn) => !isDeleted(fn[0])).length > 0

  const footnote = !hasFootnotes && createFootnote()
  const node = schema.nodes.inline_footnote.create({
    rids: footnote ? [footnote.attrs.id] : [],
  })

  tr.insert(pos, node)

  if (footnote) {
    let element: [FootnotesElementNode, number]
    if (fn) {
      element = [fn.element[0], tr.mapping.map(fn.element[1])]
    } else {
      element = insertFootnotesElement(tr, [container.node, container.pos])
    }

    if (isDeleted(element[0])) {
      reinstateNode(tr, element[0], element[1])
    }

    const fnPos = element[1] + element[0].nodeSize - 1
    tr.insert(fnPos, footnote)
    const selection = TextSelection.create(tr.doc, fnPos + 2)
    tr.setSelection(selection).scrollIntoView()
  } else {
    const selection = NodeSelection.create(tr.doc, pos)
    tr.setSelection(selection).scrollIntoView()
  }

  if (dispatch) {
    dispatch(tr)
  }
  return true
}

const reinstateNode = (tr: Transaction, node: ManuscriptNode, pos: number) => {
  const attrs = {
    ...node.attrs,
    dataTracked: null,
  }
  tr.setNodeMarkup(pos, null, attrs)
}

export const insertBoxElement = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch
) => {
  const selection = state.selection

  // Check if the selection is inside the body
  const isBody = hasParentNodeOfType(schema.nodes.body)(selection)
  const isBoxText = hasParentNodeOfType(schema.nodes.box_element)(selection)

  // If selection is not in the body, disable the option
  if (!isBody || isBoxText) {
    return false
  }

  const position = findBlockInsertPosition(state)

  const paragraph = schema.nodes.paragraph.create({})

  // Create a section node with a section title and a paragraph
  const section = schema.nodes.section.createAndFill({}, [
    schema.nodes.section_title.create(),
    paragraph,
  ]) as ManuscriptNode

  // Create the BoxElement node with a figcaption and the section
  const node = schema.nodes.box_element.createAndFill({}, [
    schema.nodes.figcaption.create({}, [schema.nodes.caption_title.create()]),
    section,
  ]) as BoxElementNode

  if (position && dispatch) {
    const tr = state.tr.insert(position, node)
    dispatch(tr)
  }

  return true
}
export const insertGraphicalAbstract = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch,
  view?: EditorView
) => {
  if (
    getChildOfType(state.doc, schema.nodes.graphical_abstract_section, true)
  ) {
    return false
  }
  const abstracts = findChildrenByType(state.doc, schema.nodes.abstracts)[0]

  // Insert Graphical abstract at the end of abstracts section
  const pos = abstracts.pos + abstracts.node.content.size + 1
  const section = schema.nodes.graphical_abstract_section.createAndFill({}, [
    schema.nodes.section_title.create({}, schema.text('Graphical Abstract')),
    createAndFillFigureElement(state),
  ]) as GraphicalAbstractSectionNode

  const tr = state.tr.insert(pos, section)

  if (dispatch) {
    // place cursor inside section title
    const selection = TextSelection.create(tr.doc, pos + 1)
    if (view) {
      view.focus()
    }
    dispatch(tr.setSelection(selection).scrollIntoView())
  }
  return true
}

export const insertSection =
  (subsection = false) =>
  (state: ManuscriptEditorState, dispatch?: Dispatch, view?: EditorView) => {
    const nodes = schema.nodes
    const $pos = state.selection.$from

    let pos
    if (findParentNodeOfTypeClosestToPos($pos, nodes.bibliography_section)) {
      //disallow insert (sub)section in bibliography_section
      return false
    } else if (subsection) {
      pos =
        findPosBeforeFirstSubsection($pos) || findPosAfterParentSection($pos)
      if (!pos) {
        return false
      }
      //move pos inside the section for a subsection
      pos -= 1
    } else if (findParentNodeOfTypeClosestToPos($pos, nodes.box_element)) {
      //only subsections are allowed for box_element, which should be
      //handled before
      return false
    } else if (findParentNodeOfTypeClosestToPos($pos, nodes.body)) {
      pos = findPosAfterParentSection($pos)
    }

    if (!pos) {
      //this means one of 2 things:
      //- the selection points outside the body
      //- the selection points inside the body, but to an element without a parent section
      //for both cases, insert the section at the end of the body
      const body = findBody(state.doc)
      pos = body.pos + body.node.content.size + 1
    }

    const section = nodes.section.createAndFill() as SectionNode
    const tr = state.tr.insert(pos, section)

    if (dispatch) {
      // place cursor inside section title
      const selection = TextSelection.create(tr.doc, pos + 2)
      view?.focus()
      dispatch(tr.setSelection(selection).scrollIntoView())
    }
    return true
  }
export const insertBackmatterSection =
  (category: SectionCategory) =>
  (state: ManuscriptEditorState, dispatch?: Dispatch, view?: EditorView) => {
    const backmatter = findBackmatter(state.doc)

    const sections = findChildrenByType(backmatter.node, schema.nodes.section)
    // Check if the section already exists
    if (sections.some((s) => s.node.attrs.category === category.id)) {
      return false
    }

    // check if reference node exist to insert before it.
    const bibliography = findBibliographySection(state.doc)

    let pos
    if (bibliography) {
      pos = bibliography.pos
    } else {
      pos = backmatter.pos + backmatter.node.content.size + 1
    }

    const attrs = {
      category: category.id,
    }
    const node = schema.nodes.section.create(attrs, [
      schema.nodes.section_title.create({}, schema.text(category.titles[0])),
    ])

    const tr = state.tr.insert(pos, node)
    if (dispatch) {
      // place cursor inside section title
      const selection = TextSelection.create(tr.doc, pos)
      view?.focus()
      dispatch(tr.setSelection(selection).scrollIntoView())
    }

    return true
  }

const findSelectedList = (selection: Selection) =>
  (selection instanceof NodeSelection &&
    selection.node.type === schema.nodes.list && {
      pos: selection.from,
      node: selection.node,
    }) ||
  findParentNodeOfType([schema.nodes.list])(selection)

export const insertAbstract = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch,
  view?: EditorView
) => {
  if (
    getMatchingChild(
      state.doc,
      (node) => node.attrs.category === 'abstract',
      true
    )
  ) {
    return false
  }
  const abstracts = findChildrenByType(state.doc, schema.nodes.abstracts)[0]
  // Insert abstract at the top of abstracts section
  const pos = abstracts.pos + 1
  const section = schema.nodes.section.createAndFill({ category: 'abstract' }, [
    schema.nodes.section_title.create({}, schema.text('Abstract')),
    schema.nodes.paragraph.create({ placeholder: 'Type abstract here...' }),
  ]) as ManuscriptNode

  const tr = state.tr.insert(pos, section)

  if (dispatch) {
    // Find the start position of the newly inserted section
    const sectionStart = tr.doc.resolve(pos)

    const sectionNode = sectionStart.nodeAfter

    if (sectionNode && sectionNode.firstChild) {
      // Calculate the position for the cursor within the paragraph node
      const paragraphPos = pos + sectionNode.firstChild.nodeSize + 2 // Adjusted calculation

      // Place cursor inside the paragraph element
      const selection = TextSelection.create(tr.doc, paragraphPos)

      if (view) {
        // Focus the editor view before setting the selection
        view.focus()
      }

      dispatch(tr.setSelection(selection).scrollIntoView())
    }
  }
  return true
}

export const insertContributors = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch,
  view?: EditorView
) => {
  // Check if another contributors node already exists
  if (getChildOfType(state.doc, schema.nodes.contributors, true)) {
    return false
  }

  // Find the title node
  const title = findChildrenByType(state.doc, state.schema.nodes.title)[0]
  const pos = title.pos + title.node.nodeSize
  const contributors = state.schema.nodes.contributors.create({
    id: '',
  })

  const tr = state.tr.insert(pos, contributors)

  if (dispatch) {
    const selection = NodeSelection.create(tr.doc, pos)
    if (view) {
      view.focus()
    }
    dispatch(tr.setSelection(selection).scrollIntoView())
  }

  return true
}

export const insertAffiliation = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch,
  view?: EditorView
) => {
  // Check if another contributors node already exists
  if (getChildOfType(state.doc, schema.nodes.affiliations, true)) {
    return false
  }
  // Find the title node
  const title = findChildrenByType(state.doc, state.schema.nodes.title)[0]
  let pos = title.pos + title.node.nodeSize

  // Find the contributors node
  const contributors = findChildrenByType(
    state.doc,
    state.schema.nodes.contributors
  )[0]

  // update the pos if the contributors node exists
  if (contributors) {
    pos = contributors.pos + contributors.node.nodeSize
  }

  const affiliations = state.schema.nodes.affiliations.create({
    id: '',
  })

  const tr = state.tr.insert(pos, affiliations)
  if (dispatch) {
    const selection = NodeSelection.create(tr.doc, pos)
    if (view) {
      view.focus()
    }
    dispatch(tr.setSelection(selection).scrollIntoView())
  }

  return true
}

export const insertAward = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch,
  view?: EditorView
) => {
  const award = schema.nodes.award.create() as AwardNode
  const tr = state.tr
  const awards = insertAwardsNode(tr)
  const pos = awards.pos + awards.node.nodeSize - 1
  tr.insert(pos, award)
  const selection = NodeSelection.create(tr.doc, pos)
  view && view.focus()
  if (dispatch) {
    dispatch(tr.setSelection(selection).scrollIntoView())
  }
  return true
}

export const insertKeywords = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch,
  view?: EditorView
) => {
  // Check if another keywords node already exists
  if (getChildOfType(state.doc, schema.nodes.keywords, true)) {
    return false
  }
  // determine the position to insert the keywords node
  const supplements = findChildrenByType(
    state.doc,
    state.schema.nodes.supplements
  )[0]
  const abstracts = findChildrenByType(
    state.doc,
    state.schema.nodes.abstracts
  )[0]
  let pos
  if (supplements) {
    pos = supplements.pos + supplements.node.nodeSize
  } else {
    pos = abstracts.pos
  }
  const keywords = schema.nodes.keywords.createAndFill({}, [
    schema.nodes.section_title.create({}, schema.text('Keywords')),
    schema.nodes.keywords_element.create({}, [
      schema.nodes.keyword_group.create({}, []),
    ]),
  ]) as KeywordsNode

  const tr = state.tr.insert(pos, keywords)

  if (dispatch) {
    const selection = NodeSelection.create(tr.doc, pos)
    if (view) {
      view.focus()
    }
    dispatch(tr.setSelection(selection).scrollIntoView())
  }

  return true
}

const findRootList = ($pos: ResolvedPos) => {
  for (let i = 0; i < $pos.depth; i++) {
    const node = $pos.node(i)
    if (isListNode(node)) {
      const pos = $pos.start(i)
      return {
        node,
        pos,
      }
    }
  }
}

//Somewhat expensive logic, should this be in a plugin?
const findListsAtSameLevel = (doc: ManuscriptNode, list: NodeWithPos) => {
  const $pos = doc.resolve(list.pos + 1)
  // find the top-level list. This is an optimization to
  // avoid traversing the entire document looking for lists
  const root = findRootList($pos)
  if (!root) {
    return [list]
  }
  const target = $pos.depth
  const lists: NodeWithPos[] = []
  root.node.descendants((node, pos) => {
    const $pos = doc.resolve(root.pos + pos + 1)
    if ($pos.depth === target && isListNode(node)) {
      lists.push({ node, pos: $pos.before(target) })
    }
    return $pos.depth <= target
  })
  return lists
}

function toggleOffList(
  state: EditorState,
  dispatch: (tr: ManuscriptTransaction) => void
) {
  const {
    selection: { $from },
    tr,
  } = state

  let rootList = findRootList($from)

  if (
    state.selection instanceof NodeSelection &&
    state.selection.node.type === schema.nodes.list
  ) {
    rootList = {
      pos: state.selection.from,
      node: state.selection.node as ListNode,
    }
  }

  if (rootList) {
    state.doc.nodesBetween(
      rootList.pos,
      rootList.pos + rootList.node.nodeSize,
      (node, pos) => {
        // remove all the nodes that are not fully in the range
        if (
          pos < rootList!.pos ||
          node.nodeSize > rootList!.pos + rootList!.node.nodeSize
        ) {
          return true
        }
        const $fromPos = tr.doc.resolve(tr.mapping.map(pos))
        const $toPos = tr.doc.resolve(tr.mapping.map(pos + node.nodeSize - 1))
        const nodeRange = $fromPos.blockRange($toPos)
        if (!nodeRange) {
          return
        }

        const targetLiftDepth = liftTarget(nodeRange)
        if (targetLiftDepth || targetLiftDepth === 0) {
          tr.lift(nodeRange, targetLiftDepth)
          return false // do not descend as the content of this node will be lifted already anyway
        }
      }
    )
    dispatch(tr)
    return true
  } else {
    return false
  }
}

export const insertList =
  (type: ManuscriptNodeType, style?: string) =>
  (state: ManuscriptEditorState, dispatch?: Dispatch, view?: EditorView) => {
    const list = findSelectedList(state.selection)

    if (list) {
      if (!dispatch) {
        return true
      }

      if (list.node.attrs.listStyleType === style) {
        return toggleOffList(state, dispatch)
      }

      // list was found: update the type and style
      // of every list at the same level
      const nodes = findListsAtSameLevel(state.doc, list)
      const tr = state.tr
      for (const { node, pos } of nodes) {
        tr.setNodeMarkup(
          pos,
          type,
          {
            ...node.attrs,
            listStyleType: style,
          },
          node.marks
        )
      }
      dispatch(tr)
      return true
    } else {
      // no list found, create new list
      const { selection } = state
      let tr = state.tr
      const startPosition = selection.$from.pos + 1

      return wrapInList(type, { listStyleType: style })(state, (tempTr) => {
        // if we dispatch all steps in this transaction track-changes-plugin will not be able to revert ReplaceAroundStep
        // as we have another ReplaceStep that will make transaction more complicated, so to make it easy to tracker we dispatch first ReplaceAroundStep
        // then will dispatch reminder steps in one transaction
        const range = selection.$from.blockRange(selection.$to)
        if (range && dispatch) {
          tempTr.steps.map((step) => {
            if (step instanceof ReplaceAroundStep) {
              dispatch(tr.step(step))
              tr = view?.state.tr || tr
            } else {
              tr.step(step)
            }
          })
          if (startPosition) {
            const selection = createSelection(
              state.schema.nodes.paragraph,
              startPosition,
              tr.doc
            )
            view?.focus()
            tr.setSelection(selection)
          }

          dispatch(tr)
        }
      })
    }
  }

export const insertBibliographySection = () => {
  return false
}

export const insertTOCSection = () => {
  return false
}

// Copied from prosemirror-commands
const findCutBefore = ($pos: ResolvedPos) => {
  if (!$pos.parent.type.spec.isolating) {
    for (let i = $pos.depth - 1; i >= 0; i--) {
      if ($pos.index(i) > 0) {
        return $pos.doc.resolve($pos.before(i + 1))
      }
      if ($pos.node(i).type.spec.isolating) {
        break
      }
    }
  }
  return null
}

export const isAtStartOfTextBlock = (
  state: ManuscriptEditorState,
  $cursor: ResolvedPos,
  view?: ManuscriptEditorView
) => (view ? view.endOfTextblock('backward', state) : $cursor.parentOffset <= 0)

export const isTextSelection = (
  selection: Selection
): selection is ManuscriptTextSelection => selection instanceof TextSelection

// Ignore atom blocks (as backspace handler), instead of deleting them.
// Adapted from selectNodeBackward in prosemirror-commands
export const ignoreAtomBlockNodeBackward = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch,
  view?: ManuscriptEditorView
): boolean => {
  const { selection } = state

  if (!isTextSelection(selection)) {
    return false
  }

  const { $cursor } = selection

  if (!$cursor) {
    return false
  }

  // ignore empty blocks
  if ($cursor.parent.content.size === 0) {
    return false
  }

  // handle cursor at start of textblock
  if (!isAtStartOfTextBlock(state, $cursor, view)) {
    return false
  }

  const $cut = findCutBefore($cursor)

  if (!$cut) {
    return false
  }

  const node = $cut.nodeBefore

  if (!node) {
    return false
  }

  return node.isBlock && node.isAtom
}

export const ignoreMetaNodeBackspaceCommand = (
  state: ManuscriptEditorState
) => {
  const { selection } = state

  if (!isNodeSelection(selection)) {
    return false
  }

  return (
    selection.node.type === schema.nodes.keyword_group ||
    selection.node.type === schema.nodes.keyword ||
    selection.node.type === schema.nodes.affiliations ||
    selection.node.type === schema.nodes.affiliation ||
    selection.node.type === schema.nodes.contributors ||
    selection.node.type === schema.nodes.contributor ||
    selection.node.type === schema.nodes.awards ||
    selection.node.type === schema.nodes.award
  )
}
// Copied from prosemirror-commands
const findCutAfter = ($pos: ResolvedPos) => {
  if (!$pos.parent.type.spec.isolating) {
    for (let i = $pos.depth - 1; i >= 0; i--) {
      const parent = $pos.node(i)
      if ($pos.index(i) + 1 < parent.childCount) {
        return $pos.doc.resolve($pos.after(i + 1))
      }
      if (parent.type.spec.isolating) {
        break
      }
    }
  }
  return null
}

export const isAtEndOfTextBlock = (
  state: ManuscriptEditorState,
  $cursor: ResolvedPos,
  view?: ManuscriptEditorView
) =>
  view
    ? view.endOfTextblock('forward', state)
    : $cursor.parentOffset >= $cursor.parent.content.size

// Ignore atom blocks (as delete handler), instead of deleting them.
// Adapted from selectNodeForward in prosemirror-commands
export const ignoreAtomBlockNodeForward = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch,
  view?: ManuscriptEditorView
): boolean => {
  const { selection } = state

  if (!isTextSelection(selection)) {
    return false
  }

  const { $cursor } = selection

  if (!$cursor) {
    return false
  }

  // ignore empty blocks
  if ($cursor.parent.content.size === 0) {
    return false
  }

  // handle cursor at start of textblock
  if (!isAtEndOfTextBlock(state, $cursor, view)) {
    return false
  }

  const $cut = findCutAfter($cursor)

  if (!$cut) {
    return false
  }

  const node = $cut.nodeAfter

  if (!node) {
    return false
  }

  return node.isBlock && node.isAtom
}

const selectIsolatingParent = (
  state: ManuscriptEditorState
): TextSelection | null => {
  const { $anchor } = state.selection

  for (let d = $anchor.depth; d >= 0; d--) {
    const node = $anchor.node(d)

    if (node.type.spec.isolating) {
      return TextSelection.create(
        state.tr.doc,
        $anchor.start(d),
        $anchor.end(d)
      )
    }
  }

  return null
}

/**
 * "Select All" the contents of an isolating block instead of the whole document
 */
export const selectAllIsolating = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch
): boolean => {
  const selection = selectIsolatingParent(state)

  if (!selection) {
    return false
  }

  if (dispatch) {
    dispatch(state.tr.setSelection(selection))
  }

  return true
}

export type TableConfig = {
  numberOfColumns: number
  numberOfRows: number
  includeHeader: boolean
}

const DEFAULT_TABLE_CONFIG: TableConfig = {
  numberOfColumns: 2,
  numberOfRows: 2,
  includeHeader: true,
}

/**
 * Create a table containing a configurable number of rows and columns.
 * The table can optionally include a header row.
 */
export const createAndFillTableElement = (
  state: ManuscriptEditorState,
  config = DEFAULT_TABLE_CONFIG
) => {
  const { numberOfColumns, numberOfRows, includeHeader } = config
  const createRow = (cellType: ManuscriptNodeType) => {
    const cells = Array.from({ length: numberOfColumns }, () =>
      cellType.create({}, schema.nodes.text_block.create())
    )
    return schema.nodes.table_row.create({}, cells)
  }

  const tableRows = includeHeader ? [createRow(schema.nodes.table_header)] : []

  for (let i = 0; i < numberOfRows; i++) {
    tableRows.push(createRow(schema.nodes.table_cell))
  }

  return schema.nodes.table_element.createChecked({}, [
    createAndFillFigcaptionElement(state),
    schema.nodes.table.create({}, tableRows),
    schema.nodes.listing.create(),
  ])
}

const createAndFillFigureElement = (state: ManuscriptEditorState) =>
  state.schema.nodes.figure_element.create({}, [
    state.schema.nodes.figure.create({}, [
      state.schema.nodes.figcaption.create(),
    ]),
    createAndFillFigcaptionElement(state),
    state.schema.nodes.listing.create(),
  ])

const createAndFillFigcaptionElement = (state: ManuscriptEditorState) =>
  state.schema.nodes.figcaption.create({}, [
    state.schema.nodes.caption_title.create(),
    state.schema.nodes.caption.create(),
  ])

const createImageElement = (state: ManuscriptEditorState) =>
  state.schema.nodes.image_element.create({}, [
    state.schema.nodes.figure.create(),
  ])
/**
 * This to make sure we get block node
 */
const getParentNode = (selection: Selection) => {
  const parentNode = findParentNodeWithId(selection)
  const node = parentNode?.node

  if (node?.type === schema.nodes.table) {
    return findParentNodeOfType(schema.nodes.table_element)(selection)?.node
  }

  return node
}

// TODO:: remove this check when we allow all type of block node to have comment
export const isCommentingAllowed = (type: NodeType) =>
  type === schema.nodes.title ||
  type === schema.nodes.section ||
  type === schema.nodes.citation ||
  type === schema.nodes.bibliography_item ||
  type === schema.nodes.footnotes_section ||
  type === schema.nodes.bibliography_section ||
  type === schema.nodes.box_element ||
  type === schema.nodes.graphical_abstract_section ||
  type === schema.nodes.keyword_group ||
  type === schema.nodes.paragraph ||
  type === schema.nodes.figure_element ||
  type === schema.nodes.list ||
  type === schema.nodes.table_element ||
  type === schema.nodes.embed ||
  type === schema.nodes.affiliations ||
  type === schema.nodes.contributors ||
  type === schema.nodes.image_element

export const addNodeComment = (
  node: ManuscriptNode,
  state: ManuscriptEditorState,
  dispatch?: Dispatch
) => {
  if (!isCommentingAllowed(node.type)) {
    return false
  }

  const props = getEditorProps(state)
  const contribution = buildContribution(props.userID)
  const attrs = {
    id: generateNodeID(schema.nodes.comment),
    contents: '',
    target: node.attrs.id,
    contributions: [contribution],
  } as CommentAttrs
  const comment = schema.nodes.comment.create(attrs)
  const comments = findChildrenByType(state.doc, schema.nodes.comments)[0]
  if (comments) {
    const pos = comments.pos + 1

    const tr = state.tr.insert(pos, comment)
    const key = getCommentKey(attrs, undefined, node)
    setCommentSelection(tr, key, attrs.id, true)
    if (dispatch) {
      dispatch(tr)
    }
    return true
  }
  return false
}

export const addInlineComment = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch
): boolean => {
  const selection = state.selection
  const node = getParentNode(selection)
  if (!node || !isCommentingAllowed(node.type)) {
    return false
  }
  let from = selection.from
  let to = selection.to

  if (from === to) {
    // Use the current cursor position to determine the boundaries of the intended word
    const result = findWordBoundaries(state, from)
    from = result.from
    to = result.to
  }

  const props = getEditorProps(state)
  const contribution = buildContribution(props.userID)
  const attrs = {
    id: generateNodeID(schema.nodes.comment),
    contents: '',
    target: node.attrs.id,
    contributions: [contribution],
    originalText: selectedText() || state.doc.textBetween(from, to),
    selector: {
      from,
      to,
    },
  } as CommentAttrs
  const comment = schema.nodes.comment.create(attrs)
  const comments = findChildrenByType(state.doc, schema.nodes.comments)[0]
  if (comments) {
    const pos = comments.pos + 1

    const tr = state.tr.insert(pos, comment)

    const start = schema.nodes.highlight_marker.create({
      id: comment.attrs.id,
      tid: node.attrs.id,
      position: 'start',
    })
    const end = schema.nodes.highlight_marker.create({
      id: comment.attrs.id,
      tid: node.attrs.id,
      position: 'end',
    })
    tr.insert(from, start).insert(to + 1, end)

    const range = getCommentRange(attrs)
    const key = getCommentKey(attrs, range, node)
    setCommentSelection(tr, key, attrs.id, true)
    if (dispatch) {
      dispatch(tr)
    }
    return true
  }
  return false
}

export const addRows =
  (direction: 'top' | 'bottom') =>
  (state: EditorState, dispatch?: (tr: Transaction) => void): boolean => {
    if (dispatch) {
      const { tr } = state
      const rect = selectedRect(state)
      const selectedRows = rect.bottom - rect.top
      for (let i = 0; i < selectedRows; i++) {
        addRow(tr, rect, rect[direction])
      }
      dispatch(tr)
    }
    return true
  }

export const addHeaderRow =
  (direction: 'above' | 'below') =>
  (state: EditorState, dispatch?: (tr: Transaction) => void): boolean => {
    if (dispatch) {
      const { tr } = state
      const rect = selectedRect(state)
      const addRowStep = addRow(
        state.tr,
        rect,
        rect[direction === 'below' ? 'bottom' : 'top']
      ).steps.pop()
      if (addRowStep && addRowStep instanceof ReplaceStep) {
        const { from, to, slice } = addRowStep
        const cells = flatten(slice.content.firstChild as ManuscriptNode, false)
        const row = schema.nodes.table_row.create(
          undefined,
          cells.map((cell) =>
            schema.nodes.table_header.create(cell.node.attrs, cell.node.content)
          )
        )
        tr.step(
          new ReplaceStep(
            from,
            to,
            new Slice(Fragment.from(row), slice.openStart, slice.openEnd)
          )
        )
        dispatch(tr)
      }
    }
    return true
  }

export const addColumns =
  (direction: 'right' | 'left') =>
  (state: EditorState, dispatch?: (tr: Transaction) => void): boolean => {
    if (dispatch) {
      const { tr } = state
      const rect = selectedRect(state.apply(tr))
      const selectedRows = rect.right - rect.left
      for (let i = 0; i < selectedRows; i++) {
        const command = direction === 'right' ? addColumnAfter : addColumnBefore
        command(state.apply(tr), (t) => t.steps.map((s) => tr.step(s)))
      }
      dispatch(tr)
    }
    return true
  }

export const autoComplete = (
  state: ManuscriptEditorState,
  dispatch?: Dispatch
) => {
  const complete = checkForCompletion(state)
  if (complete && complete.suggestion.length > 0) {
    const tr = state.tr.insertText(complete.suggestion, state.selection.from)
    const inserted = complete.title.substring(
      0,
      complete.title.length - complete.suggestion.length
    )
    if (inserted) {
      // replacing to provide text case as required
      tr.replaceWith(
        state.selection.from - inserted.length,
        state.selection.from,
        schema.text(inserted)
      )
    }

    dispatch && dispatch(tr)
    return true
  }
  return false
}

// List of restricted node types that should not allow indentation
// Add more restricted nodes here in the future as needed

export const isIndentingAllowed = (type: NodeType) =>
  type === schema.nodes.footnote || type === schema.nodes.general_table_footnote

export const canIndent =
  (type: ManuscriptNodeType) =>
  (state: ManuscriptEditorState): boolean => {
    const { $from, $to } = state.selection

    const node = $from.node($from.depth)

    //prevent indentation for frontmatter and backmatter sections
    const isBody = hasParentNodeOfType(schema.nodes.body)(state.selection)

    // Ensure selection is valid
    if (!$from || !$to || !isBody || isDeleted(node) || isPendingInsert(node)) {
      return false
    }

    // If the node type is "paragraph", check the parent node type
    if (type === schema.nodes.paragraph) {
      const parentNode = $from.node($from.depth - 1)

      // If the parent node is restricted, prevent indentation
      if (isIndentingAllowed(parentNode?.type)) {
        return false
      }
    }

    // Check if the selection is within the specified node type
    const isTargetNode = $from.node().type === type

    return isTargetNode
  }

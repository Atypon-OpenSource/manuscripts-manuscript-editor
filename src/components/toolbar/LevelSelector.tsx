/*!
 * © 2024 Atypon Systems LLC
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
  getListType,
  isSectionNodeType,
  ManuscriptEditorState,
  ManuscriptEditorView,
  ManuscriptNode,
  ManuscriptNodeType,
  nodeNames,
  SectionTitleNode,
} from '@manuscripts/transform'
import { Fragment } from 'prosemirror-model'
import { TextSelection, Transaction } from 'prosemirror-state'
import { findParentNodeOfType } from 'prosemirror-utils'
import React, { CSSProperties } from 'react'
import Select, {
  CSSObjectWithLabel,
  GroupProps,
  OnChangeValue,
} from 'react-select'
import styled from 'styled-components'

import { findClosestParentElement } from '../../lib/hierarchy'
import { nodeTypeIcon } from '../../node-type-icons'
import { handleParagraphIndentOrMove } from './helpers'

const optionName = (
  nodeType: ManuscriptNodeType,
  depth: number,
  listType?: string
) => {
  switch (nodeType) {
    case nodeType.schema.nodes.section:
      return (depth > 0 ? 'sub'.repeat(depth - 1) : '') + 'section heading'
    case nodeType.schema.nodes.list:
      return listType === 'order' ? 'Ordered list' : 'Bulleted list'
    default:
      return nodeNames.get(nodeType) || nodeType.name
  }
}

const titleCase = (text: string) =>
  text.replace(/\b([a-z])/g, (match) => match.toUpperCase())

interface Option {
  action?: () => void
  depth: number
  icon: JSX.Element | null
  isDisabled: boolean
  isSelected: boolean
  isFocused: boolean
  label: string
  nodeType: ManuscriptNodeType
  value: number
  listType?: string
}

interface SelectorOptionProps {
  action?: () => void
  depth: number
  isDisabled?: boolean
  isSelected?: boolean
  isFocused?: boolean
  nodeType: ManuscriptNodeType
  value: number
  listType?: string
}

interface NodeWithPosition {
  node: ManuscriptNode
  before: number
  after: number
}

const buildOption = (props: SelectorOptionProps): Option => ({
  ...props,
  icon: nodeTypeIcon(props.nodeType, props.listType),
  label: titleCase(optionName(props.nodeType, props.depth, props.listType)),
  isDisabled: Boolean(props.isDisabled),
  isSelected: Boolean(props.isSelected),
  isFocused: Boolean(props.isFocused),
})

type GroupedOptions = Array<{ options: Option[] }>
type Options = GroupedOptions | Option[]

const buildOptions = (
  state: ManuscriptEditorState,
  dispatch: (tr: Transaction) => void,
  view?: ManuscriptEditorView
): Options => {
  const {
    doc,
    selection: { $from, $to },
    schema,
    tr,
  } = state
  const { nodes } = schema

  if (!$from.sameParent($to)) {
    return []
  }

  const parentElement = findClosestParentElement($from)

  if (!parentElement) {
    return []
  }

  const depth =
    findParentNodeOfType(schema.nodes.box_element)(state.selection)?.depth || 1

  // append the section to the preceding section as a subsection
  const moveSectionToSubsection = () => {
    const sectionTitle = $from.node()

    const sectionDepth = $from.depth - 1
    const section = $from.node(sectionDepth)
    const beforeSection = $from.before(sectionDepth)
    const afterSection = $from.after(sectionDepth)

    const parentSectionDepth = $from.depth - 2
    const parentSection = $from.node(parentSectionDepth)
    const startIndex = $from.index(parentSectionDepth)

    const previousSection = parentSection.child(startIndex - 1)

    const beforePreviousSection = beforeSection - previousSection.nodeSize

    tr.replaceWith(
      beforePreviousSection,
      afterSection,
      previousSection.content.append(Fragment.from(section))
    )

    const anchor = beforeSection + 1

    tr.setSelection(
      TextSelection.create(tr.doc, anchor, anchor + sectionTitle.content.size)
    )

    dispatch(tr.scrollIntoView())
    view && view.focus()
  }

  // move the section up the tree
  // TODO: target depth
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const promoteSection = (target: number) => () => {
    const sectionDepth = $from.depth - 1
    const section = $from.node(sectionDepth)
    const beforeSection = $from.before(sectionDepth)
    const sectionTitle = $from.node($from.depth)

    const $beforeSection = doc.resolve(beforeSection)
    const beforeSectionOffset = $beforeSection.parentOffset
    const afterSectionOffset = beforeSectionOffset + section.nodeSize

    const parentSectionDepth = $from.depth - 2
    const parentSection = $from.node(parentSectionDepth)
    const startIndex = $from.index(parentSectionDepth)
    const endIndex = $from.indexAfter(parentSectionDepth)
    const beforeParentSection = $from.before(parentSectionDepth)
    const afterParentSection = $from.after(parentSectionDepth)

    const items = []

    let offset = 0

    if (startIndex > 0) {
      const precedingSection = parentSection.cut(0, beforeSectionOffset)
      items.push(precedingSection)
      offset += precedingSection.nodeSize
    }

    items.push(section)

    if (endIndex < parentSection.childCount) {
      const fragment = Fragment.from(nodes.section_title.create()).append(
        parentSection.content.cut(afterSectionOffset)
      )

      items.push(parentSection.copy(fragment))
    }

    tr.replaceWith(beforeParentSection, afterParentSection, items)

    const anchor = beforeParentSection + offset + 2

    tr.setSelection(
      TextSelection.create(tr.doc, anchor, anchor + sectionTitle.content.size)
    )

    dispatch(tr.scrollIntoView())
    view && view.focus()
  }

  // move paragraph to title of new section at this position, along with the rest of the section
  // TODO: target depth
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const promoteParagraphToSection = (target: number) => () => {
    const paragraph = $from.node($from.depth)
    const beforeParagraph = $from.before($from.depth)
    const $beforeParagraph = doc.resolve(beforeParagraph)
    const beforeParagraphOffset = $beforeParagraph.parentOffset
    const afterParagraphOffset = beforeParagraphOffset + paragraph.nodeSize

    const sectionDepth = $from.depth - depth
    const parentSection = $from.node(sectionDepth)
    const startIndex = $from.index(sectionDepth)
    const endIndex = $from.indexAfter(sectionDepth)
    const beforeParentSection = $from.before(sectionDepth)
    const afterParentSection = $from.after(sectionDepth)

    const items = []
    let offset = 0

    if (startIndex > 0) {
      // add the original section with content up to the paragraph
      const precedingSection = parentSection.cut(0, beforeParagraphOffset)
      items.push(precedingSection)
      offset += precedingSection.nodeSize
    }

    const textContent = paragraph.textContent

    const sectionTitle: SectionTitleNode = textContent
      ? nodes.section_title.create({}, schema.text(textContent))
      : nodes.section_title.create()

    let sectionContent = Fragment.from(sectionTitle)

    if (endIndex < parentSection.childCount) {
      sectionContent = sectionContent.append(
        parentSection.content.cut(afterParagraphOffset)
      )
    } else {
      sectionContent = sectionContent.append(Fragment.from(paragraph.copy()))
    }

    items.push(parentSection.copy(sectionContent))

    tr.replaceWith(beforeParentSection, afterParentSection, items)

    const anchor = beforeParentSection + offset + 2

    tr.setSelection(
      TextSelection.create(tr.doc, anchor, anchor + sectionTitle.content.size)
    )

    dispatch(tr.scrollIntoView())
    view && view.focus()
  }

  const demoteSectionToParagraph = () => {
    const sectionTitle = $from.node($from.depth)
    const afterSectionTitle = $from.after($from.depth)
    const $afterSectionTitle = doc.resolve(afterSectionTitle)
    const afterSectionTitleOffset = $afterSectionTitle.parentOffset

    const sectionDepth = $from.depth - depth
    const section = $from.node(sectionDepth)
    const beforeSection = $from.before(sectionDepth)
    const afterSection = $from.after(sectionDepth)

    const $beforeSection = doc.resolve(beforeSection)
    const previousNode = $beforeSection.nodeBefore
    const paragraph = nodes.paragraph.create(
      {
        id: generateNodeID(nodes.paragraph),
      },
      sectionTitle.content
    )

    let anchor

    if (previousNode && isSectionNodeType(previousNode.type)) {
      tr.replaceWith(
        beforeSection - previousNode.nodeSize,
        afterSection,
        previousNode.copy(
          Fragment.from(previousNode.content)
            .append(Fragment.from(paragraph))
            .append(section.content.cut(afterSectionTitleOffset))
        )
      )

      anchor = beforeSection
    } else {
      tr.replaceWith(
        beforeSection,
        afterSection,
        Fragment.from(paragraph).append(
          section.content.cut(afterSectionTitleOffset)
        )
      )

      anchor = beforeSection + 1
    }

    tr.setSelection(
      TextSelection.create(tr.doc, anchor, anchor + paragraph.content.size)
    )

    dispatch(tr.scrollIntoView())
    view && view.focus()
  }

  const convertParagraphToList =
    (nodeType: ManuscriptNodeType, listType: string) => () => {
      const paragraph = $from.node($from.depth)
      const beforeParagraph = $from.before($from.depth)
      const afterParagraph = $from.after($from.depth)
      const list = nodeType.create(
        {
          id: generateNodeID(nodeType),
          listStyleType: listType,
        },
        nodes.list_item.create(
          {},
          schema.nodes.paragraph.create({}, paragraph.content)
        )
      )
      tr.replaceWith(beforeParagraph, afterParagraph, list)

      const anchor = beforeParagraph + 3

      tr.setSelection(
        TextSelection.create(tr.doc, anchor, anchor + paragraph.content.size)
      )

      dispatch(tr.scrollIntoView())
      view && view.focus()
    }

  const convertListType =
    (nodeType: ManuscriptNodeType, list: NodeWithPosition, listType: string) =>
    () => {
      tr.setNodeMarkup(list.before, nodeType, {
        ...list.node.attrs,
        listStyleType: listType,
      })

      dispatch(tr.scrollIntoView())
      view && view.focus()
    }

  const parentElementType = parentElement.node.type
  switch (parentElementType) {
    case parentElementType.schema.nodes.section: {
      const sectionDepth = Math.max(1, $from.depth - depth)
      const parentSectionDepth = sectionDepth - 1
      const minimumDepth = Math.max(1, parentSectionDepth)
      const beforeSection = $from.before(sectionDepth)
      const $beforeSection = doc.resolve(beforeSection)
      const sectionOffset = $beforeSection.parentOffset
      const typeOptions: Option[] = [
        buildOption({
          nodeType: nodes.paragraph,
          value: -4,
          depth: 1,
          action: demoteSectionToParagraph,
          isDisabled: sectionDepth <= 1 && sectionOffset <= 1,
        }),
        buildOption({
          nodeType: nodes.list,
          value: -3,
          depth: 1,
          isDisabled: true,
          listType: 'order',
        }),
        buildOption({
          nodeType: nodes.list,
          value: -2,
          depth: 1,
          isDisabled: true,
          listType: 'bullet',
        }),
      ]
      const sectionOptions: Option[] = []

      // Section lvl 1 is hidden, we will start from level 2
      for (let depth = 2; depth < sectionDepth; depth++) {
        const node = $from.node(depth)

        if (isSectionNodeType(node.type)) {
          const indentLevel = depth - 1
          sectionOptions.push(
            buildOption({
              nodeType: nodes.section,
              value: depth,
              depth: indentLevel,
              action: promoteSection(depth),
              isDisabled: depth < minimumDepth,
            })
          )
        }
      }

      sectionOptions.push(
        buildOption({
          nodeType: nodes.section,
          value: parentSectionDepth + 1,
          depth: parentSectionDepth,
          isDisabled: true,
          isSelected: true,
        })
      )

      const parentSection = $from.node(parentSectionDepth)

      const beforeSectionPos = $from.before(parentSectionDepth + 1)
      const $beforeSectionPos = doc.resolve(beforeSectionPos)

      const precedingSections: ManuscriptNode[] = []

      parentSection.nodesBetween(0, $beforeSectionPos.parentOffset, (node) => {
        if (isSectionNodeType(node.type)) {
          precedingSections.push(node)
        }
        return false
      })

      if (precedingSections.length > 0) {
        sectionOptions.push(
          buildOption({
            nodeType: nodes.section,
            value: parentSectionDepth + 2,
            depth: parentSectionDepth + 2,
            action: moveSectionToSubsection,
          })
        )
      }
      return [{ options: typeOptions }, { options: sectionOptions }]
    }

    case parentElementType.schema.nodes.paragraph: {
      const sectionDepth = $from.depth - depth
      const minimumDepth = Math.max(1, sectionDepth)

      let parentSectionDepth = 0

      const typeOptions: Option[] = [
        buildOption({
          nodeType: nodes.paragraph,
          value: -4,
          depth: 1,
          isDisabled: true,
          isSelected: true,
        }),
        buildOption({
          nodeType: nodes.list,
          value: -3,
          depth: 1,
          action: convertParagraphToList(nodes.list, 'order'),
          listType: 'order',
        }),
        buildOption({
          nodeType: nodes.list,
          value: -2,
          depth: 1,
          action: convertParagraphToList(nodes.list, 'bullet'),
          listType: 'bullet',
        }),
      ]

      const sectionOptions: Option[] = []
      // Section level 1 is hidden, we will start from level 2
      for (let depth = 2; depth <= sectionDepth; depth++) {
        const node = $from.node(depth)

        if (isSectionNodeType(node.type)) {
          const indentLevel = depth - 1
          sectionOptions.push(
            buildOption({
              nodeType: nodes.section,
              value: depth,
              depth: indentLevel,
              action: promoteParagraphToSection(depth),
              isDisabled: depth < minimumDepth,
            })
          )

          parentSectionDepth = depth
        }
      }

      sectionOptions.push(
        buildOption({
          nodeType: nodes.section,
          value: parentSectionDepth + 1,
          depth: parentSectionDepth + 1,
          action: () => handleParagraphIndentOrMove(false),
        })
      )

      return [{ options: typeOptions }, { options: sectionOptions }]
    }

    case schema.nodes.list: {
      const { style } = getListType(parentElement.node.attrs.listStyleType)
      return [
        {
          options: [
            buildOption({
              nodeType: parentElementType,
              value: -4,
              depth: 1,
              isDisabled: true,
              isSelected: true,
            }),
          ],
        },
        {
          options: [
            buildOption({
              nodeType: nodes.list,
              value: -3,
              depth: 1,
              action: convertListType(nodes.list, parentElement, style),
              listType:
                style === 'none' || style === 'disc' ? 'bullet' : 'order',
            }),
          ],
        },
      ]
    }

    default: {
      return [
        buildOption({
          nodeType: parentElementType,
          value: -3,
          depth: 1,
          isDisabled: true,
          isSelected: true,
        }),
      ]
    }
  }
}

const OptionContainer = styled.div`
  display: flex;
  align-items: center;
`

const OptionIcon = styled.span`
  display: inline-flex;
  width: ${(props) => props.theme.grid.unit * 4}px;
  justify-content: center;
  align-items: center;
  margin-right: ${(props) => props.theme.grid.unit * 2}px;
  flex-shrink: 0;
`

const OptionLabel = styled.span`
  flex: 1;
`

const Group = styled.div`
  &:not(:last-child) {
    border-bottom: 1px solid ${(props) => props.theme.colors.border.secondary};
  }
`

const StyledSelect = styled(Select<Option, false>)`
  z-index: 3;

  & > div:hover {
    border-color: ${(props) => props.theme.colors.border.secondary};
  }
`

const findSelectedOption = (options: GroupedOptions): Option | undefined => {
  for (const group of options) {
    for (const option of group.options) {
      if (option.isSelected) {
        return option
      }
    }
  }
}

export const LevelSelector: React.FC<{
  state: ManuscriptEditorState
  dispatch: (tr: Transaction) => void
  view?: ManuscriptEditorView
}> = ({ state, dispatch, view }) => {
  const {
    schema: { nodes },
  } = state

  const options = buildOptions(state, dispatch, view)
  return (
    <StyledSelect
      isDisabled={options.length <= 1}
      isSearchable={false}
      options={options}
      value={
        options.length === 1
          ? (options[0] as Option | undefined)
          : findSelectedOption(options as GroupedOptions)
      }
      components={{
        Group: (props: GroupProps<Option, false>) => (
          <Group {...props.innerProps} ref={null}>
            {props.children}
          </Group>
        ),
        GroupHeading: () => null,
        Option: (props) => {
          const data = props.data as Option

          const style = props.getStyles('option', props) as CSSProperties

          style.display = 'flex'
          style.fontSize = 16
          style.cursor = 'pointer'
          style.paddingLeft = 8 + (data.depth - 1) * 16
          style.minWidth = 200

          if (data.nodeType === nodes.section) {
            style.fontSize = Math.max(14, 23 - 3 * (data.value - 1))
            style.fontWeight = 600
          }

          if (props.isFocused) {
            style.backgroundColor = '#f5fbfc'
          }
          if (props.isSelected) {
            style.backgroundColor = '#f2fbfc'
            style.borderBottom = '1px solid #bce7f6'
            style.borderTop = '1px solid #bce7f6'
          }
          style.color = '#353535'

          if (props.isDisabled && !props.isSelected) {
            style.opacity = 0.4
          }

          return (
            <OptionContainer {...props.innerProps} ref={null} style={style}>
              <OptionIcon>
                {nodeTypeIcon(data.nodeType, data.listType)}
              </OptionIcon>
              <OptionLabel>{data.label}</OptionLabel>
            </OptionContainer>
          )
        },
      }}
      onChange={(value: OnChangeValue<Option, false>) => {
        if (value && value.action) {
          value.action()
        }
      }}
      styles={{
        control: (styles: CSSObjectWithLabel): CSSObjectWithLabel => ({
          ...styles,
          backgroundColor: '#fff',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: '#e2e2e2',
          boxShadow: 'none',
          fontSize: '14px',
          minHeight: 0,
          padding: 0,
          width: 200,
          overflowX: 'hidden',
          textOverflow: 'ellipsis',
          cursor: 'pointer',
          height: 32,
        }),
        indicatorSeparator: (): CSSObjectWithLabel => ({
          display: 'none',
        }),
        dropdownIndicator: (
          styles: CSSObjectWithLabel
        ): CSSObjectWithLabel => ({
          ...styles,
          padding: '0 4px',
        }),
        menu: (styles: CSSObjectWithLabel): CSSObjectWithLabel => ({
          ...styles,
          width: 'auto',
        }),
        singleValue: (styles: CSSObjectWithLabel): CSSObjectWithLabel => ({
          ...styles,
          padding: 0,
        }),
        valueContainer: (styles: CSSObjectWithLabel): CSSObjectWithLabel => ({
          ...styles,
          padding: '1px 8px',
        }),
        container: (styles: CSSObjectWithLabel): CSSObjectWithLabel => ({
          ...styles,
          border: 'none',
        }),
      }}
    />
  )
}

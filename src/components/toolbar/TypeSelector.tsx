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
import { TickIcon } from '@manuscripts/style-guide'
import {
  ManuscriptEditorView,
  ManuscriptNodeType,
  schema,
} from '@manuscripts/transform'
import { EditorState, Transaction } from 'prosemirror-state'
import { hasParentNodeOfType } from 'prosemirror-utils'
import React from 'react'
import Select, {
  CSSObjectWithLabel,
  OnChangeValue,
  OptionProps,
} from 'react-select'
import styled from 'styled-components'

import { findClosestParentElement } from '../../lib/hierarchy'
import {
  demoteSectionToParagraph,
  findSelectedOption,
  optionName,
  promoteParagraphToSection,
  titleCase,
} from './helpers'

export interface Option {
  action?: (
    state: EditorState,
    dispatch: (tr: Transaction) => void,
    view?: ManuscriptEditorView
  ) => void
  isDisabled: boolean
  isSelected: boolean
  label: string
  nodeType: ManuscriptNodeType
}

const OptionContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  cursor: pointer;
  padding: 8px;
  min-width: 200px;

  &:hover {
    background: ${(props) => props.theme.colors.background.fifth};
  }
`
const OptionLabel = styled.span``

const TickIconWrapper = styled.div`
  margin-right: 16px;
`

const OptionComponent: React.FC<OptionProps<Option, false>> = ({
  innerProps,
  data,
}) => {
  return (
    <OptionContainer {...innerProps} ref={null}>
      <OptionLabel>{titleCase(optionName(data.nodeType))}</OptionLabel>
      {data.isSelected && (
        <TickIconWrapper>
          <TickIcon />
        </TickIconWrapper>
      )}
    </OptionContainer>
  )
}

const buildOptions = (state: EditorState): Option[] => {
  const {
    doc,
    selection: { $from, $to },
    schema,
  } = state
  const { nodes } = schema

  if (!$from.sameParent($to)) {
    return []
  }

  const parentElement = findClosestParentElement($from)

  if (!parentElement) {
    return []
  }

  const parentElementType = parentElement.node.type
  const options: Option[] = []

  switch (parentElementType) {
    case parentElementType.schema.nodes.section: {
      const sectionDepth = Math.max(1, $from.depth - 1)
      const beforeSection = $from.before(sectionDepth)
      const $beforeSection = doc.resolve(beforeSection)
      const sectionOffset = $beforeSection.parentOffset

      options.push(
        {
          nodeType: nodes.paragraph,
          label: 'Paragraph',
          action: demoteSectionToParagraph,
          isDisabled: sectionDepth <= 1 && sectionOffset <= 1,
          isSelected: false,
        },
        {
          nodeType: nodes.section,
          label: 'Heading',
          isDisabled: true,
          isSelected: true,
        }
      )
      return options
    }
    case parentElementType.schema.nodes.paragraph: {
      options.push(
        {
          nodeType: nodes.paragraph,
          label: 'Paragraph',
          isDisabled: true,
          isSelected: true,
        },
        {
          nodeType: nodes.section,
          label: 'Heading',
          action: promoteParagraphToSection,
          isDisabled: false,
          isSelected: false,
        }
      )
      return options
    }
    default: {
      options.push({
        nodeType: parentElementType,
        label: titleCase(optionName(parentElementType)),
        isDisabled: true,
        isSelected: true,
      })
      return options
    }
  }
}

const StyledSelect = styled(Select<Option, false>)`
  & > div:hover {
    border-color: ${(props) => props.theme.colors.border.secondary};
  }
`

export const TypeSelector: React.FC<{
  state: EditorState
  dispatch: (tr: Transaction) => void
  view?: ManuscriptEditorView
}> = ({ state, dispatch, view }) => {
  const options = buildOptions(state)
  const isInBody = hasParentNodeOfType(schema.nodes.body)(state.selection)
  return (
    <StyledSelect
      onChange={(value: OnChangeValue<Option, false>) => {
        if (value && value.action) {
          value.action(state, dispatch, view)
        }
      }}
      value={
        options.length === 1
          ? (options[0] as Option | undefined)
          : findSelectedOption(options)
      }
      options={options}
      components={{
        Option: OptionComponent,
      }}
      styles={customStyles}
      isDisabled={options.length <= 1 || !isInBody}
      isSearchable={false}
    />
  )
}

const customStyles = {
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
  dropdownIndicator: (styles: CSSObjectWithLabel): CSSObjectWithLabel => ({
    ...styles,
    padding: '0 4px',
  }),
  menu: (styles: CSSObjectWithLabel): CSSObjectWithLabel => ({
    ...styles,
    width: '200px',
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
}

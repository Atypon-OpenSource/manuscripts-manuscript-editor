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
  ButtonGroup,
  CloseButton,
  IconButton,
  IconButtonGroup,
  ModalBody,
  ModalContainer,
  ModalHeader,
  ModalSidebar,
  ModalSidebarHeader,
  ModalSidebarTitle,
  PrimaryButton,
  SidebarContent,
  StyledModal,
} from '@manuscripts/style-guide'
import { EditorView } from 'prosemirror-view'
import React, { MouseEvent, useState } from 'react'
import Select, { OptionProps, SingleValue } from 'react-select'
import styled from 'styled-components'

import { getEditorProps } from '../../plugins/editor-props'
import ReactSubView from '../../views/ReactSubView'

// Ranges brought from: https://www.unicode.org/Public/UCD/latest/ucd/Blocks.txt
const unicodeRanges = [
  { label: 'Latin', value: [0x0100, 0x024f] },
  { label: 'Greek and Coptic', value: [0x0370, 0x03ff] },
  { label: 'Mathematical Operators', value: [0x2200, 0x22ff] },
  { label: 'Specials', value: [0xfffc, 0xfffd] },
  { label: 'Arrows', value: [0x2190, 0x21ff] },
]

type OptionType = { value: number[]; label: string }

const generateCharacters = (start: number, end: number) =>
  Array.from({ length: end - start + 1 }, (_, i) =>
    String.fromCharCode(start + i)
  )

const InsertSpecialCharacterDialog: React.FC<{ view: EditorView }> = ({
  view,
}) => {
  const [isOpen, setOpen] = useState(true)
  const [range, setRange] = useState(unicodeRanges[0].value)

  const handleRangeChange = (range: SingleValue<OptionType>) =>
    range && setRange(range.value)

  const handleClose = () => setOpen(false)

  const addCharacter = (event: MouseEvent<HTMLButtonElement>) =>
    view.dispatch(
      view.state.tr.insertText(
        event.currentTarget.value,
        view.state.selection.from
      )
    )

  return (
    <StyledModal
      isOpen={isOpen}
      onRequestClose={handleClose}
      shouldCloseOnOverlayClick={true}
    >
      <Container data-cy="special-characters-modal">
        <ModalHeader>
          <CloseButton onClick={handleClose} data-cy="modal-close-button" />
        </ModalHeader>
        <StyledModalBody>
          <StyledModalSidebar>
            <ModalSidebarHeader>
              <ModalSidebarTitle>Insert special characters</ModalSidebarTitle>
            </ModalSidebarHeader>
            <StyledSidebarContent>
              <Select<OptionType>
                onChange={handleRangeChange}
                defaultValue={unicodeRanges[0]}
                options={unicodeRanges}
                components={{
                  Option: OptionComponent,
                }}
                styles={{
                  control: (provided) => ({
                    ...provided,
                    width: 'fit-content',
                  }),
                  menu: (provided) => ({
                    ...provided,
                    minWidth: '220px',
                  }),
                }}
                menuPosition="fixed"
              />
              <CharactersSetContainer>
                <CharactersSet>
                  {generateCharacters(range[0], range[1]).map((character) => (
                    <Character
                      key={character}
                      value={character}
                      onClick={addCharacter}
                      data-cy="special-character"
                    >
                      {character}
                    </Character>
                  ))}
                </CharactersSet>
              </CharactersSetContainer>
            </StyledSidebarContent>
            <ButtonsContainer>
              <PrimaryButton onClick={handleClose}>Close</PrimaryButton>
            </ButtonsContainer>
          </StyledModalSidebar>
        </StyledModalBody>
      </Container>
    </StyledModal>
  )
}

const OptionComponent: React.FC<OptionProps<OptionType, false>> = ({
  innerProps,
  data,
}) => {
  return (
    <OptionWrapper {...innerProps} ref={null}>
      {data.label}
    </OptionWrapper>
  )
}

const Container = styled(ModalContainer)`
  padding: 8px;
`

const StyledModalSidebar = styled(ModalSidebar)`
  background: white;
  width: 30vw;
`

const StyledModalBody = styled(ModalBody)`
  height: 60vh;
`

const StyledSidebarContent = styled(SidebarContent)`
  display: flex;
  flex-direction: column;
`

const ButtonsContainer = styled(ButtonGroup)`
  padding-top: ${(props) => props.theme.grid.unit * 5}px;
`

const OptionWrapper = styled.div<{ focused?: boolean }>`
  padding-left: ${(props) => props.theme.grid.unit * 4}px;
  padding-top: ${(props) => props.theme.grid.unit * 2}px;
  padding-bottom: ${(props) => props.theme.grid.unit * 2}px;

  background-color: ${(props) =>
    props.focused ? props.theme.colors.background.fifth : 'transparent'};

  &:hover {
    background-color: ${(props) => props.theme.colors.background.fifth};
  }
`

const CharactersSetContainer = styled.div`
  flex: 1;
  overflow-y: scroll;
  margin: 18px 0;
  border: 1px solid #ddd;
`

const CharactersSet = styled(IconButtonGroup)`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(28px, max-content));
  height: ${(props) => props.theme.grid.unit * 8}px;
`

const Character = styled(IconButton)`
  border-bottom: 1px solid #ddd;
  border-right: 1px solid #ddd;
  border-radius: unset;

  :hover {
    background-color: #f0f0f0 !important;
  }

  :active,
  :focus {
    color: inherit !important;
    border-bottom: 1px solid #ddd !important;
    border-right: 1px solid #ddd !important;
  }
`

export const openInsertSpecialCharacterDialog = (view?: EditorView) => {
  if (!view) {
    return
  }

  const { state } = view
  const props = getEditorProps(state)

  const dialog = ReactSubView(
    props,
    InsertSpecialCharacterDialog,
    { view },
    state.doc,
    () => 0,
    view
  )

  document.body.appendChild(dialog)
}

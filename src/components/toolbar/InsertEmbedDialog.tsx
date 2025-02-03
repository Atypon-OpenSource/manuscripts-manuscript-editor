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
  ButtonGroup,
  DialogModalBody,
  MessageContainer,
  PrimaryBoldHeading,
  PrimaryButton,
  PrimarySmallText,
  SecondaryButton,
  StyledModal,
  TextArea,
} from '@manuscripts/style-guide'
import { ManuscriptEditorState } from '@manuscripts/transform'
import { EditorView } from 'prosemirror-view'
import React, { useEffect, useState } from 'react'
import styled from 'styled-components'

import { Dispatch, insertEmbed } from '../../commands'
import { getOEmbedHTML } from '../../lib/oembed'
import { allowedHref } from '../../lib/url'
import { useDoWithDebounce } from '../../lib/use-do-with-debounce'
import { getEditorProps } from '../../plugins/editor-props'
import ReactSubView from '../../views/ReactSubView'
import { FieldHeading, Open } from '../views/LinkForm'

const Label = styled.label`
  padding-bottom: 4px;
`

const HeaderContainer = styled(PrimaryBoldHeading)`
  font-size: ${(props) => props.theme.font.size.large};
`

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding-bottom: 16px;
`

const DialogContainer = styled(DialogModalBody)`
  min-width: 750px;
`

const PreviewContainer = styled.div`
  display: flex;
  justify-content: center;
  border: 1px solid ${(props) => props.theme.colors.border.field.default};
  border-radius: ${(props) => props.theme.grid.radius.small};
  padding: 6px ${(props) => props.theme.grid.unit * 4}px;
`

export type InsertEmbedDialogProps = {
  state: ManuscriptEditorState
  dispatch: Dispatch
  pos?: number
}

export const InsertEmbedDialog: React.FC<InsertEmbedDialogProps> = ({
  state,
  dispatch,
  pos,
}) => {
  const attrs = pos ? state.doc.nodeAt(pos)?.attrs : undefined
  const [isOpen, setOpen] = useState(true)
  const [url, setUrl] = useState<string>(attrs?.href)
  const [oembedHTML, setOEmbedHTML] = useState<string>()

  const debounce = useDoWithDebounce()

  const handleSave = () => {
    if (!pos) {
      insertEmbed(state, dispatch, { href: url })
    } else {
      const tr = state.tr.setNodeAttribute(pos, 'href', url)
      dispatch(tr)
    }
    setOpen(false)
  }

  useEffect(
    () => {
      debounce(async () => {
        const html = await getOEmbedHTML(url, 368, 217)
        setOEmbedHTML(html)
      })
    },
    [url] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const operation = pos ? 'Update' : 'Insert'

  return (
    <StyledModal isOpen={isOpen} onRequestClose={() => setOpen(false)}>
      <DialogContainer data-cy="media-editor">
        <HeaderContainer>{operation} external media</HeaderContainer>

        <MessageContainer>
          <Container>
            <FieldHeading>
              <Label htmlFor={'embed-link'}>Media link</Label>
              {url && allowedHref(url) && (
                <Open
                  id={'media-link'}
                  href={url}
                  target={'_blank'}
                  rel={'noopener'}
                />
              )}
            </FieldHeading>
            <TextArea
              id={'embed-link'}
              rows={2}
              cols={2}
              defaultValue={url}
              autoFocus={true}
              required={true}
              placeholder={'https://youtube.com/...'}
              onChange={(e) => setUrl(e.target.value.trim())}
            />
          </Container>
          {url && allowedHref(url) && (
            <Container>
              <Label>Preview</Label>
              {(oembedHTML && (
                <PreviewContainer
                  dangerouslySetInnerHTML={{ __html: oembedHTML }}
                />
              )) || <NoPreviewMessage />}
            </Container>
          )}
        </MessageContainer>

        <ButtonGroup>
          <SecondaryButton onClick={() => setOpen(false)}>
            Cancel
          </SecondaryButton>
          <PrimaryButton
            onClick={handleSave}
            disabled={!(url && allowedHref(url))}
          >
            {operation}
          </PrimaryButton>
        </ButtonGroup>
      </DialogContainer>
    </StyledModal>
  )
}

const Wrapper = styled.div`
  display: flex;
  justify-content: center;
  padding: 50px 0;
`

const NoPreviewMessage: React.FC = () => (
  <PreviewContainer>
    <Wrapper>Preview not available</Wrapper>
  </PreviewContainer>
)

const NoPreviewContainer = styled(PreviewContainer)`
  flex-direction: column;
  background: #fafafa;
  padding: 16px 56px 16px 48px;
`

const Heading = styled(PrimaryBoldHeading)`
  font-size: ${(props) => props.theme.font.size.medium};
`

export const NoPreviewMessageWithLink: React.FC<{ href: string }> = ({
  href,
}) => (
  <NoPreviewContainer>
    <Heading>Preview currently not available</Heading>
    <PrimarySmallText>
      <a href={href} target={'_blank'} rel="noreferrer">
        Click here
      </a>{' '}
      to see the source media
    </PrimarySmallText>
  </NoPreviewContainer>
)

export const openEmbedDialog = (view?: EditorView, pos?: number) => {
  if (!view) {
    return
  }
  const { state, dispatch } = view

  const dialog = ReactSubView(
    getEditorProps(state),
    InsertEmbedDialog,
    {
      state,
      dispatch,
      pos,
    },
    state.doc,
    () => 0,
    view
  )

  document.body.appendChild(dialog)
}

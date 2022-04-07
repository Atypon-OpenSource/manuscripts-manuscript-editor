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

import {
  FigureNode,
  isInGraphicalAbstractSection,
} from '@manuscripts/manuscript-transform'
import { Capabilities, MissingImage } from '@manuscripts/style-guide'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'

import { useFileInputRef } from '../components/hooks/figure-upload'
import { OptionsDropdown } from '../components/views/FilesDropdown'
import { FileUpload } from '../components/views/FileUpload'
import { addExternalFileRef, ExternalFileRef } from '../lib/external-files'
import { setNodeAttrs as setGivenNodeAttrs } from './FigureElement'
import { ReactViewComponentProps } from './ReactView'

export type SubmissionAttachment = {
  id: string
  name: string
  type: SubmissionAttachmentType
  link: string
}

export type SubmissionAttachmentType = {
  id: string
  label?: string
}

export interface FigureProps {
  permissions: { write: boolean }
  externalFiles?: SubmissionAttachment[]
  submissionId: string
  uploadAttachment: (designation: string, file: File) => Promise<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  updateDesignation: (designation: string, name: string) => Promise<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  capabilities?: Capabilities
  isInGraphicalAbstract?: boolean
  mediaAlternativesEnabled?: boolean
}

const WEB_FORMAT_QUERY = 'format=jpg'
export const addFormatQuery = (url?: string) => {
  if (url) {
    const join = url.includes('?') ? '&' : '?'
    return url + join + WEB_FORMAT_QUERY
  }
}

const FigureComponent = ({
  permissions,
  uploadAttachment,
  capabilities: can,
  mediaAlternativesEnabled,
  externalFiles,
  submissionId,
}: FigureProps) => {
  const Component: React.FC<ReactViewComponentProps<FigureNode>> = ({
    nodeAttrs,
    viewProps,
    dispatch,
    contentDOM,
  }) => {
    const figure = viewProps.node
    const resolvedPos = viewProps.view.state.doc.resolve(viewProps.getPos())
    const isInGraphicalAbstract = isInGraphicalAbstractSection(resolvedPos)

    const src = useMemo(() => {
      if (nodeAttrs.src) {
        return nodeAttrs.src
      }

      const imageExternalFile = nodeAttrs.externalFileReferences?.find(
        (file) => file && file.kind === 'imageRepresentation'
      )
      // in the new implementation ExternalFileRef url will be attachment id LEAN-988
      let url = imageExternalFile?.url
      if (!imageExternalFile?.url.includes('https://')) {
        const attachmentId = imageExternalFile?.url.replace('attachment:', '')
        url = externalFiles?.find((file) => file.id === attachmentId)?.link
      }

      return addFormatQuery(url) // these links are always provided with url query, it's safe to assume we need to use amp here
    }, [nodeAttrs.src, externalFiles]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      if (figure?.attrs?.externalFileReferences?.length) {
        figure?.attrs?.externalFileReferences?.map((exRef: ExternalFileRef) => {
          if (exRef && typeof exRef.ref === 'undefined') {
            const ref = externalFiles?.find((file) => {
              // in the new implementation ExternalFileRef url will be attachment id LEAN-988
              if (exRef.url.includes('https://')) {
                return file.link === exRef.url
              } else {
                return file.id === exRef.url.replace('attachment:', '')
              }
            })
            exRef.ref = ref
            if (ref) {
              setFigureAttrs({
                externalFileReferences: [
                  ...figure?.attrs.externalFileReferences,
                ],
              })
            }
          }
        })
      }
    }, [externalFiles]) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      if (figure?.attrs?.externalFileReferences?.length && contentDOM) {
        figure?.attrs?.externalFileReferences?.map((exRef: ExternalFileRef) => {
          if (exRef) {
            const file = externalFiles?.find((file) => {
              if (exRef.url.includes('https://')) {
                return file.link === exRef.url
              } else {
                return file.id === exRef.url.replace('attachment:', '')
              }
            })
            if (file) {
              contentDOM.setAttribute('id', file.id) // to allow focus in this node
            }
          }
        })
      }
    }, [contentDOM, figure?.attrs?.externalFileReferences])
    /* eslint-disable react-hooks/exhaustive-deps */

    const setFigureAttrs = useCallback(
      /* eslint-enable react-hooks/exhaustive-deps */
      setGivenNodeAttrs(figure, viewProps, dispatch, viewProps.getPos()),
      [figure, viewProps, dispatch]
    )

    const addFigureExFileRef = useCallback(
      (relation, publicUrl, attachmentId) => {
        if (figure) {
          setFigureAttrs({
            externalFileReferences: addExternalFileRef(
              figure?.attrs.externalFileReferences,
              `attachment:${attachmentId}`,
              relation
            ),
            src: publicUrl,
          })
        }
      },
      [figure, setFigureAttrs]
    )

    const { fileInputRef, onUploadClick } = useFileInputRef()

    const [imageError, setImageError] = useState(false)
    const onError = useCallback(() => setImageError(true), [])

    return (
      <Container>
        {permissions.write && (
          <FileUpload
            fileInputRef={fileInputRef}
            uploadAttachment={uploadAttachment}
            addFigureExFileRef={addFigureExFileRef}
            designation={
              isInGraphicalAbstract ? 'graphical-abstract' : 'figure'
            }
            accept={'image/*'}
            relation={'imageRepresentation'}
          />
        )}

        {src && src.length > 0 ? (
          <UnstyledButton
            type="button"
            onClick={onUploadClick}
            error={imageError}
          >
            <OptionsDropdown
              url={src}
              submissionId={submissionId}
              onUploadClick={onUploadClick}
              setFigureAttrs={setFigureAttrs}
              externalFiles={externalFiles}
              mediaAlternativesEnabled={mediaAlternativesEnabled}
              canReplaceFile={can?.replaceFile}
              canDownloadFile={can?.downloadFiles}
            />

            {(imageError && (
              <Placeholder error>
                <div>
                  <MissingImage />
                  <Header>Missing image</Header>
                  {permissions.write && <Label>Drag or click to upload</Label>}
                </div>
              </Placeholder>
            )) || (
              <img
                id={nodeAttrs.id}
                src={src}
                onError={onError}
                alt={nodeAttrs.label}
                style={{ cursor: 'pointer' }}
              />
            )}
          </UnstyledButton>
        ) : (
          <UnstyledButton type="button" onClick={onUploadClick}>
            <Placeholder>
              <div>
                {permissions.write
                  ? 'Click to add image'
                  : 'No image here yet…'}
              </div>
            </Placeholder>
          </UnstyledButton>
        )}
      </Container>
    )
  }

  return Component
}

const UnstyledButton = styled.button<{ error?: boolean }>`
  display: block;
  border: none;
  background: none;
  ${(props) => !props.error && 'margin-left: auto;'};
  margin-right: ${(props) => (props.error && '8px') || 'auto'};
  margin-bottom: ${(props) => props.theme.grid.unit * 4}px;
  ${(props) => props.error && 'width: 100%;'};
  min-width: 250px;
  padding: 0;
  position: relative;

  &:focus {
    outline: rgb(13, 121, 208) auto 1px;
  }
  img {
    max-width: 100%;
  }
  &:hover {
    .options_button {
      visibility: visible;
    }
  }
`

const Placeholder = styled.div<{ error?: boolean }>`
  align-items: center;
  border-radius: 16px;
  border: 1px dashed
    ${(props) =>
      (props.error && props.theme.colors.border.error) ||
      props.theme.colors.border.secondary};
  ${(props) => props.error && 'background: #fafafa;'}
  color: #6e6e6e;
  cursor: pointer;
  display: flex;
  justify-content: center;
  text-align: center;
  padding: 64px 32px;
  min-height: 100px;
`

const Container = styled.div`
  position: relative;
`

const Label = styled.div`
  font-weight: ${(props) => props.theme.font.weight.normal};
  line-height: ${(props) => props.theme.font.lineHeight.large};
  font-size: ${(props) => props.theme.font.size.small};
`

const Header = styled(Label)`
  font-size: ${(props) => props.theme.font.size.large};
  letter-spacing: -0.369231px;
`
export default FigureComponent

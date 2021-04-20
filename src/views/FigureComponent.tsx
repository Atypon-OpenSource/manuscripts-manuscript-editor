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

import { FigureNode } from '@manuscripts/manuscript-transform'
import React, { SyntheticEvent, useEffect, useRef, useState } from 'react'
import styled from 'styled-components'

import { addImageRepresentation } from '../lib/external-files'
import { ReactViewComponentProps } from './ReactView'

export interface FigureProps {
  permissions: { write: boolean }
  putAttachment: (file: File, type: string) => Promise<string>
}

const FigureComponent = ({ putAttachment, permissions }: FigureProps) => {
  const Component: React.FC<ReactViewComponentProps<FigureNode>> = ({
    nodeAttrs,
    setNodeAttrs,
  }) => {
    const imageExternalFile = nodeAttrs.externalFileReferences?.find(
      (file) => file.kind === 'imageRepresentation'
    )
    const webFormatQuery = '&format=jpg'
    let externalFilesSrc = imageExternalFile?.url + webFormatQuery // these links are aways provided with url query, it's safe to assume we need to use amp here
    externalFilesSrc = externalFilesSrc?.replace(
      'ciplit.com.ciplit.com',
      'ciplit.com'
    ) // hotfix for weird bug needed for a presentation

    const [displayUrl, setDisplayUrl] = useState<string>(
      externalFilesSrc || nodeAttrs.src || ''
    )
    const fileInput = useRef<HTMLInputElement>(null)
    useEffect(() => {
      setDisplayUrl(nodeAttrs.src || externalFilesSrc || '')
      // @TODO eslint disable with hotfix removal
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodeAttrs.src])

    const handleUpload = async (e: SyntheticEvent) => {
      e.preventDefault()

      const file =
        fileInput.current &&
        fileInput.current.files &&
        fileInput.current.files[0]

      if (!file || !permissions.write) {
        return
      }
      const url = await putAttachment(file, 'figure')
      setDisplayUrl(url)
      setNodeAttrs({
        contentType: file.type,
        externalFileReferences: addImageRepresentation(
          nodeAttrs.externalFileReferences,
          url
        ),
        src: url + webFormatQuery,
        label: url,
      })
    }

    const handleImageClick = (e: SyntheticEvent) => {
      e.preventDefault()

      if (!permissions.write || !fileInput.current) {
        return
      }

      fileInput.current.click()
    }

    return (
      <>
        {permissions.write && (
          <HiddenInput
            type="file"
            ref={fileInput}
            onChange={handleUpload}
            accept="image/*"
          />
        )}

        {displayUrl ? (
          <UnstyledButton type="button" onClick={handleImageClick}>
            <img
              src={displayUrl}
              alt={nodeAttrs.label}
              style={{ cursor: 'pointer' }}
            />
          </UnstyledButton>
        ) : (
          <UnstyledButton type="button" onClick={handleImageClick}>
            <Placeholder>
              <div>
                {permissions.write
                  ? 'Click to add image'
                  : 'No image here yet…'}
              </div>
            </Placeholder>
          </UnstyledButton>
        )}
      </>
    )
  }

  return Component
}

const HiddenInput = styled.input`
  display: none;
`

const UnstyledButton = styled.button`
  display: block;
  border: none;
  background: none;
  margin-left: auto;
  margin-right: auto;
  min-width: 250px;
  padding: 0;

  &:focus {
    outline: rgb(13, 121, 208) auto 1px;
  }
  img {
    max-width: 100%;
  }
`

const Placeholder = styled.div`
  align-items: center;
  border-radius: 16px;
  border: 1px dashed #e2e2e2;
  color: #6e6e6e;
  cursor: pointer;
  display: flex;
  justify-content: center;
  text-align: center;
  padding: 64px 32px;
  min-height: 100px;
`

export default FigureComponent

/*!
 * © 2023 Atypon Systems LLC
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

import React from 'react'
import styled from 'styled-components'

import { BibliographyItemAttrs, metadata } from '../../lib/references'

export const Metadata = styled.div`
  color: ${(props) => props.theme.colors.text.secondary};
  flex: 1;
  font-weight: ${(props) => props.theme.font.weight.light};
  margin-top: ${(props) => props.theme.grid.unit}px;
`

export const MetadataContainer = styled.div`
  flex: 1;
`

export const ReferenceLine: React.FC<{
  item: BibliographyItemAttrs
}> = ({ item }) => (
  <MetadataContainer>
    <div>{item.title || 'Untitled'}</div>
    <Metadata>{metadata(item)}</Metadata>
  </MetadataContainer>
)

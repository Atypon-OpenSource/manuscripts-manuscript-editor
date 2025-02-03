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
  AffiliationIcon,
  CrclTickAnimation,
  DeleteIcon,
  Tooltip,
} from '@manuscripts/style-guide'
import React, { useRef } from 'react'
import styled from 'styled-components'

import { AffiliationAttrs } from '../../lib/authors'

const AffiliationContainer = styled.div`
  padding: ${(props) => props.theme.grid.unit * 2}px 0
    ${(props) => props.theme.grid.unit * 2}px;
  display: flex;
  align-items: center;
  transition: background-color 0.25s;
  border: 1px solid transparent;
  border-left: 0;
  border-right: 0;
  cursor: pointer;
  &:hover,
  &.active {
    background: ${(props) => props.theme.colors.background.fifth};
  }

  &.active {
    border-color: ${(props) => props.theme.colors.border.primary};
  }
`
const AffiliationName = styled.div`
  margin-left: 12px;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  width: 250px;
`

const AffiliationDetails = styled.div`
  margin-left: 12px;
  flex: 1;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 16px;
  margin-top: 2px;
  color: ${(props) => props.theme.colors.text.secondary};
`

const AffiliationBox = styled.div`
  display: flex;
  flex-direction: column;
  margin-left: 4px;
`

const RemoveButton = styled.div`
  display: flex;
  align-items: center;
  margin-right: 8px;
  svg {
    cursor: pointer;
  }
  .icon_element {
    fill: #6e6e6e;
  }
`

export interface AffiliationContainerProps {
  affiliation: AffiliationAttrs
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
  showSuccessIcon?: boolean
}

export const AffiliationItem: React.FC<AffiliationContainerProps> = ({
  affiliation,
  isSelected,
  onClick,
  onDelete,
  showSuccessIcon,
}) => {
  const ref = useRef<HTMLDivElement>(null)
  if (isSelected) {
    ref.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
    })
  }
  return (
    <AffiliationContainer
      data-cy="affiliation-item"
      onClick={onClick}
      className={isSelected ? 'active' : ''}
      ref={ref}
    >
      <AffiliationIcon
        opacity={showSuccessIcon ? 0.05 : 1}
        style={{ minWidth: 24, minHeight: 24 }}
      />
      <AffiliationBox>
        <AffiliationName data-cy="affiliation-name">
          {affiliation.institution}
        </AffiliationName>
        <AffiliationDetails>
          {affiliation.city && (
            <>
              {affiliation.city}
              {affiliation.county || affiliation.country ? ', ' : ''}
            </>
          )}
          {affiliation.county && (
            <>
              {affiliation.county}
              {affiliation.country ? ', ' : ''}
            </>
          )}
          {affiliation.country && <>{affiliation.country}</>}
        </AffiliationDetails>
      </AffiliationBox>
      {showSuccessIcon && (
        <CrclTickAnimation
          size={36}
          style={{ position: 'absolute', left: '10px' }}
        />
      )}
      {isSelected && (
        <RemoveButton
          onClick={() => onDelete()}
          data-tooltip-id={'delete-button-tooltip'}
        >
          <DeleteIcon fill={'#6E6E6E'} />
          <Tooltip id={'delete-button-tooltip'} place="bottom">
            {'Delete'}
          </Tooltip>
        </RemoveButton>
      )}
    </AffiliationContainer>
  )
}

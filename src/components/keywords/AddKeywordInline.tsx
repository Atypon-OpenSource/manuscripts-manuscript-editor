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
import { Build, buildKeyword, Keyword } from '@manuscripts/json-schema'
import { Category, Dialog, PlusIcon } from '@manuscripts/style-guide'
import { ManuscriptEditorView, ManuscriptNode } from '@manuscripts/transform'
import { TextSelection } from 'prosemirror-state'
import React, {
  ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import styled from 'styled-components'

import { isDeleted } from '../../lib/track-changes-utils'

const AddNewKeyword = styled.div`
  position: relative;
  display: inline-block;
`

const KeywordField = styled.input`
  font-size: 13px;
  margin: 0;
  padding: 0;
  border: none;
  height: 16px;
  width: 100px;

  &:focus {
    outline: none;
  }
`

const NewKeywordButton = styled.button`
  font-size: 13px;
  color: #6e6e6e;
  background: transparent;
  border: none;
  margin: 0;
  padding: 0;
  cursor: pointer;
`

const CreateKeywordButtonWrapper = styled.div`
  position: absolute;
  left: 0;
  top: 24px;
  background: #fff;
  border: 1px solid #e2e2e2;
  border-radius: 8px;
  padding: 8px 0;
`

const CreateKeywordButton = styled.button`
  font-size: 12px;
  white-space: nowrap;
  color: #353535;
  background: #f2fbfc;
  border: 1px solid #f2f2f2;
  border-width: 1px 0;
  padding: 9px 13px;
  cursor: pointer;
`

const PlusIconWrapper = styled.span`
  padding: 0 8px 0 0;
`

interface KeywordEntry {
  id: string
  contents: string
}

export const AddKeywordInline: React.FC<{
  viewProps: {
    view: ManuscriptEditorView
    getPos: () => number
    node: ManuscriptNode
  }
  getUpdatedNode: () => ManuscriptNode
}> = ({ viewProps, getUpdatedNode }) => {
  const nodeRef = useRef<HTMLDivElement>(null)
  const [newKeyword, setNewKeyword] = useState<string>('')
  const [isAddingNewKeyword, setIsAddingNewKeyword] = useState<boolean>(false)
  const [isExistingKeywordError, setIsExistingKeywordError] =
    useState<boolean>(false)
  const { getPos, view } = viewProps
  const getKeywords = (node: ManuscriptNode) => {
    const keywords: KeywordEntry[] = []
    node.content.descendants((descNode) => {
      if (
        descNode.type === descNode.type.schema.nodes.keyword &&
        !isDeleted(descNode)
      ) {
        keywords.push({
          id: descNode.attrs.id,
          contents: descNode.textContent,
        })
      }
    })
    return keywords
  }

  const handleClickOutside = useCallback(
    (event: Event) => {
      if (
        nodeRef.current &&
        !nodeRef.current.contains(event.target as Node) &&
        isAddingNewKeyword
      ) {
        handleCancel()
      }
    },
    [isAddingNewKeyword]
  )

  useEffect(() => {
    if (isAddingNewKeyword) {
      document.addEventListener('mousedown', handleClickOutside)
    } else {
      document.removeEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [handleClickOutside, isAddingNewKeyword])

  const isValidNewKeyword = () => {
    return newKeyword.trim().length > 0
  }

  const isExistingKeyword = () => {
    const keywordClean = newKeyword.trim()
    const keywords: KeywordEntry[] = getKeywords(getUpdatedNode())
    return keywords.some((keyword) => keyword.contents === keywordClean)
  }

  const handleCancel = () => {
    setIsAddingNewKeyword(false)
    setNewKeyword('')
  }

  const handleAddKeyword = () => {
    const keyword: Build<Keyword> = buildKeyword(newKeyword)
    if (!isExistingKeyword() && isValidNewKeyword()) {
      const node = getUpdatedNode()
      const keywordNode = node.type.schema.nodes.keyword.create(
        {
          id: keyword._id,
          contents: keyword.name,
          comments: [],
        },
        node.type.schema.text(keyword.name)
      )
      const nodePosition = getPos() + node.nodeSize - 1
      view.dispatch(view.state.tr.insert(nodePosition, keywordNode))

      setIsAddingNewKeyword(false)
      setNewKeyword('')
    } else {
      handleCancel()
      setIsExistingKeywordError(true)
    }
  }

  const KeywordInput: React.FC = () => {
    const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
      setNewKeyword(event.target.value.trimStart())
      return
    }

    return (
      <KeywordField
        value={newKeyword}
        onChange={handleInputChange}
        onFocus={() =>
          view.dispatch(
            view.state.tr.setSelection(TextSelection.create(view.state.doc, 0))
          )
        }
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') {
            e.preventDefault() // Prevent focus loss
            handleAddKeyword()
          } else if (e.key === 'Escape') {
            handleCancel()
          }
        }}
        onKeyUp={(e) => {
          e.stopPropagation()
        }}
        onKeyPress={(e) => {
          e.stopPropagation()
        }}
        autoFocus
      />
    )
  }

  const CreateKeywordButtonElement: React.FC = () => {
    return (
      <CreateKeywordButtonWrapper>
        <CreateKeywordButton
          onClick={() => {
            handleAddKeyword()
          }}
        >
          <PlusIconWrapper>
            <PlusIcon />
          </PlusIconWrapper>
          {`Create keyword "${newKeyword}"`}
        </CreateKeywordButton>
      </CreateKeywordButtonWrapper>
    )
  }

  const actions = {
    primary: {
      action: () => {
        setIsExistingKeywordError(false)
      },
      title: 'OK',
    },
  }

  return (
    <AddNewKeyword ref={nodeRef}>
      {!isAddingNewKeyword && (
        <NewKeywordButton
          onClick={() => {
            setIsAddingNewKeyword(true)
          }}
        >
          New keyword...
        </NewKeywordButton>
      )}
      {isAddingNewKeyword && <KeywordInput />}
      {isAddingNewKeyword && isValidNewKeyword() && (
        <CreateKeywordButtonElement />
      )}
      <Dialog
        isOpen={isExistingKeywordError}
        actions={actions}
        category={Category.confirmation}
        header={'Keyword already exists'}
        message={`You can’t add this keyword because it already exists. You can add another one.`}
      />
    </AddNewKeyword>
  )
}

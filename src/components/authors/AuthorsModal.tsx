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
  buildBibliographicName,
  generateID,
  ObjectTypes,
} from '@manuscripts/json-schema'
import {
  AddIcon,
  CloseButton,
  ModalBody,
  ModalContainer,
  ModalHeader,
  ModalSidebar,
  ModalSidebarHeader,
  ModalSidebarTitle,
  ScrollableModalContent,
  SidebarContent,
  StyledModal,
} from '@manuscripts/style-guide'
import { isEqual } from 'lodash'
import React, { useEffect, useReducer, useRef, useState } from 'react'
import styled from 'styled-components'

import { arrayReducer } from '../../lib/array-reducer'
import {
  AffiliationAttrs,
  authorComparator,
  ContributorAttrs,
} from '../../lib/authors'
import { AuthorActions } from './AuthorActions'
import { AuthorAffiliations } from './AuthorAffiliations'
import { AuthorDetailsForm, FormActions } from './AuthorDetailsForm'
import { AuthorFormPlaceholder } from './AuthorFormPlaceholder'
import { AuthorList } from './AuthorList'
import { RequiredFieldConfirmationDialog } from './RequiredFieldConfirmationDialog'
import { SaveAuthorConfirmationDialog } from './SaveAuthorConfirmationDialog'

const AddAuthorButton = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: ${(props) => props.theme.grid.unit * 4}px;
  margin-left: ${(props) => props.theme.grid.unit * 4}px;
  cursor: pointer;
`

const ActionTitle = styled.div`
  padding-left: ${(props) => props.theme.grid.unit * 2}px;
`

const FormLabel = styled.legend`
  margin-top: 12px;
  margin-bottom: 12px;
  font: ${(props) => props.theme.font.weight.normal}
    ${(props) => props.theme.font.size.xlarge} /
    ${(props) => props.theme.font.lineHeight.large}
    ${(props) => props.theme.font.family.sans};
  letter-spacing: -0.4px;
  color: ${(props) => props.theme.colors.text.secondary};
`

const AuthorForms = styled.div`
  padding-left: ${(props) => props.theme.grid.unit * 3}px;
  padding-right: ${(props) => props.theme.grid.unit * 3}px;
`

const StyledSidebarContent = styled(SidebarContent)`
  padding: 0;
`

const authorsReducer = arrayReducer<ContributorAttrs>((a, b) => a.id === b.id)
const affiliationsReducer = arrayReducer<AffiliationAttrs>(
  (a, b) => a.id === b.id
)

const normalize = (author: ContributorAttrs) => ({
  id: author.id,
  role: author.role,
  affiliations: author.affiliations || [],
  bibliographicName: author.bibliographicName,
  email: author.email || '',
  isCorresponding: author.isCorresponding || false,
  ORCIDIdentifier: author.ORCIDIdentifier || '',
  priority: author.priority,
  isJointContributor: author.isJointContributor || false,
  userID: '',
  invitationID: '',
  footnote: author.footnote || [],
  corresp: author.corresp || [],
})

export interface AuthorsModalProps {
  author?: ContributorAttrs
  authors: ContributorAttrs[]
  affiliations: AffiliationAttrs[]
  onSaveAuthor: (author: ContributorAttrs) => void
  onDeleteAuthor: (author: ContributorAttrs) => void
  onSaveAffiliation: (affiliation: AffiliationAttrs) => void
  addNewAuthor?: boolean
}

export const AuthorsModal: React.FC<AuthorsModalProps> = ({
  authors: $authors,
  affiliations: $affiliations,
  author,
  onSaveAuthor,
  onDeleteAuthor,
  onSaveAffiliation,
  addNewAuthor = false,
}) => {
  const [isOpen, setOpen] = useState(true)
  const [isDisableSave, setDisableSave] = useState(false)
  const [isEmailRequired, setEmailRequired] = useState(false)
  const [showSuccessIcon, setShowSuccessIcon] = useState(false)
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false)
  const [
    showRequiredFieldConfirmationDialog,
    setShowRequiredFieldConfirmationDialog,
  ] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [newAuthor, setNewAuthor] = useState(false)
  const [unSavedChanges, setUnSavedChanges] = useState(false)
  const [nextAuthor, setNextAuthor] = useState<ContributorAttrs | null>(null)
  const valuesRef = useRef<ContributorAttrs>()
  const actionsRef = useRef<FormActions>()
  const [authors, dispatchAuthors] = useReducer(
    authorsReducer,
    $authors.sort(authorComparator)
  )
  const [affiliations, dispatchAffiliations] = useReducer(
    affiliationsReducer,
    $affiliations
  )

  useEffect(() => {
    if (addNewAuthor) {
      handleAddAuthor()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addNewAuthor])

  const [selection, setSelection] = useState(author)

  const handleSelect = (author: ContributorAttrs) => {
    const values = valuesRef.current

    if (values && selection && !isEqual(values, normalize(selection))) {
      setShowConfirmationDialog(true)
      setNextAuthor(author)
    } else {
      setShowSuccessIcon(false)
      setSelection(author)
    }
  }

  useEffect(() => {
    const values = valuesRef.current
    if (values && selection && !isEqual(values, normalize(selection))) {
      setUnSavedChanges(true)
    }
  }, [selection])

  const handleClose = () => {
    if (isDisableSave) {
      setShowRequiredFieldConfirmationDialog(true)
    } else if (unSavedChanges) {
      setShowConfirmationDialog(true)
    } else {
      setOpen(false)
    }
  }

  const handleSave = () => {
    if (valuesRef.current && selection) {
      handleSaveAuthor(valuesRef.current)
    }

    if (nextAuthor) {
      setSelection(nextAuthor)
      setNextAuthor(null)
    } else if (newAuthor) {
      createNewAuthor()
      setNewAuthor(false)
    }

    setShowConfirmationDialog(false)
  }

  const handleCancel = () => {
    handleResetAuthor()

    if (nextAuthor) {
      setSelection(nextAuthor)
      setNextAuthor(null)
    } else if (newAuthor) {
      createNewAuthor()
      setNewAuthor(false)
    }

    setShowConfirmationDialog(false)
  }

  const handleSaveAuthor = (values: ContributorAttrs | undefined) => {
    if (!values || !selection) {
      return
    }

    const author = {
      ...selection,
      ...values,
    }
    onSaveAuthor(author)
    setShowSuccessIcon(true)
    setSelection(author)
    setShowConfirmationDialog(false)
    dispatchAuthors({
      type: 'update',
      items: [author],
    })
  }

  const handleMoveAuthor = (from: number, to: number) => {
    const copy = [...authors]
    const order = copy.map((_, i) => (i === from ? to : i))
    copy.sort((a, b) => order[authors.indexOf(a)] - order[authors.indexOf(b)])
    copy.forEach((a, i) => {
      if (a.priority !== i) {
        a.priority = i
        onSaveAuthor(a)
      }
    })
    dispatchAuthors({
      type: 'set',
      state: copy,
    })
  }
  const createNewAuthor = () => {
    const name = buildBibliographicName({ given: '', family: '' })
    const author: ContributorAttrs = {
      id: generateID(ObjectTypes.Contributor),
      role: 'author',
      affiliations: [],
      bibliographicName: name,
      email: '',
      isCorresponding: false,
      ORCIDIdentifier: '',
      priority: authors.length,
      isJointContributor: false,
      userID: '',
      invitationID: '',
      corresp: [],
      footnote: [],
    }
    setShowSuccessIcon(false)
    setSelection(author)
  }

  const handleAddAuthor = () => {
    const values = valuesRef.current

    if (values && selection && !isEqual(values, normalize(selection))) {
      setShowConfirmationDialog(true)
      setNextAuthor(null)
      setNewAuthor(true)
    } else {
      createNewAuthor()
    }
  }

  const handleDeleteAuthor = () => {
    if (!selection) {
      return
    }
    onDeleteAuthor(selection)
    setSelection(undefined)
    dispatchAuthors({
      type: 'delete',
      item: selection,
    })
  }

  const handleSaveAffiliation = (affiliation: AffiliationAttrs) => {
    onSaveAffiliation(affiliation)
    dispatchAffiliations({
      type: 'update',
      items: [affiliation],
    })
  }

  const handleAddAffiliation = (affiliation: AffiliationAttrs) => {
    if (!valuesRef.current) {
      return
    }
    const values = valuesRef.current
    const affiliations = values.affiliations || []
    handleSaveAuthor({
      ...values,
      affiliations: [...affiliations, affiliation.id],
    })
  }

  const handleRemoveAffiliation = (affiliation: AffiliationAttrs) => {
    if (!valuesRef.current) {
      return
    }
    const values = valuesRef.current
    handleSaveAuthor({
      ...values,
      affiliations: values.affiliations?.filter((i) => i !== affiliation.id),
    })
  }

  const handleResetAuthor = () => {
    actionsRef.current?.reset()
    setShowConfirmationDialog(false)
    setUnSavedChanges(false)
    if (!newAuthor && !nextAuthor) {
      setOpen(false)
    } else {
      setNewAuthor(false)
      createNewAuthor()
    }
  }

  const handleChangeAuthor = (values: ContributorAttrs) => {
    const isUnchanged = isEqual(
      normalize(selection as ContributorAttrs),
      values
    )
    valuesRef.current = values
    const { given, family } = values.bibliographicName
    const { email, isCorresponding } = values
    const isNameFilled = given?.length && family?.length
    if (isNameFilled && !isCorresponding && !isUnchanged) {
      setDisableSave(false)
    } else if (
      isCorresponding &&
      email?.length &&
      isNameFilled &&
      !isUnchanged
    ) {
      setDisableSave(false)
    } else {
      setDisableSave(true)
    }
    if (isCorresponding && !email?.length) {
      setEmailRequired(true)
    } else {
      setEmailRequired(false)
    }
  }

  const handleShowDeleteDialog = () => {
    setShowDeleteDialog((prev) => !prev)
  }

  return (
    <StyledModal
      isOpen={isOpen}
      onRequestClose={() => handleClose()}
      shouldCloseOnOverlayClick={true}
    >
      <ModalContainer>
        <ModalHeader>
          <CloseButton
            onClick={() => handleClose()}
            data-cy="modal-close-button"
          />
        </ModalHeader>
        <ModalBody>
          <ModalSidebar data-cy="authors-sidebar">
            <ModalSidebarHeader>
              <ModalSidebarTitle>Authors</ModalSidebarTitle>
            </ModalSidebarHeader>
            <StyledSidebarContent>
              <AddAuthorButton
                data-cy="add-author-button"
                onClick={handleAddAuthor}
              >
                <AddIcon width={18} height={18} />
                <ActionTitle>New Author</ActionTitle>
              </AddAuthorButton>
              <AuthorList
                author={selection}
                authors={authors}
                onSelect={handleSelect}
                onDelete={handleShowDeleteDialog}
                moveAuthor={handleMoveAuthor}
                showSuccessIcon={showSuccessIcon}
              />
            </StyledSidebarContent>
          </ModalSidebar>
          <ScrollableModalContent data-cy="author-modal-content">
            {selection ? (
              <AuthorForms>
                <RequiredFieldConfirmationDialog
                  isOpen={showRequiredFieldConfirmationDialog}
                  onSave={() => setShowRequiredFieldConfirmationDialog(false)}
                  onCancel={handleCancel}
                />
                <SaveAuthorConfirmationDialog
                  isOpen={showConfirmationDialog}
                  onSave={handleSave}
                  onCancel={handleCancel}
                />
                <AuthorActions
                  onSave={() => handleSaveAuthor(valuesRef.current)}
                  onDelete={handleDeleteAuthor}
                  showDeleteDialog={showDeleteDialog}
                  handleShowDeleteDialog={handleShowDeleteDialog}
                  newAuthor={newAuthor}
                  isDisableSave={isDisableSave}
                />
                <FormLabel>Details</FormLabel>
                <AuthorDetailsForm
                  values={normalize(selection)}
                  onChange={handleChangeAuthor}
                  onSave={handleSaveAuthor}
                  actionsRef={actionsRef}
                  isEmailRequired={isEmailRequired}
                />
                <FormLabel>Affiliations</FormLabel>
                <AuthorAffiliations
                  author={selection}
                  affiliations={affiliations}
                  onSave={handleSaveAffiliation}
                  onAdd={handleAddAffiliation}
                  onRemove={handleRemoveAffiliation}
                />
              </AuthorForms>
            ) : (
              <AuthorFormPlaceholder />
            )}
          </ScrollableModalContent>
        </ModalBody>
      </ModalContainer>
    </StyledModal>
  )
}

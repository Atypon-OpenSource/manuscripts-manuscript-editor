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
  getGroupCategories,
  isSectionNode,
  schema,
  SectionCategory,
} from '@manuscripts/transform'
import { EditorState } from 'prosemirror-state'
import { findChildrenByType } from 'prosemirror-utils'
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view'

import { EditorProps } from '../../configs/ManuscriptsEditor'
import { sectionCategoryIcon } from '../../icons'
import { PopperManager } from '../../lib/popper'
import { PluginState } from './index'

const popper = new PopperManager()

function createMenuItem(
  contents: string,
  handler: EventListener,
  isDisabled = false,
  isSelected = false
) {
  const item = document.createElement('button')
  item.className = `menu-item ${isDisabled ? 'disabled' : ''} ${
    isSelected ? 'selected' : ''
  }`
  item.textContent = contents
  item.addEventListener('mousedown', (event) => {
    handler(event)
    popper.destroy()
  })
  return item
}

function createMenu(
  currentCategory: SectionCategory | undefined,
  categories: SectionCategory[],
  usedCategoryIDs: Set<string>,
  onSelect: (category: SectionCategory) => void
) {
  const menu = document.createElement('div')
  menu.className = 'section-category menu'
  categories.forEach((category) => {
    const item = createMenuItem(
      category.titles[0],
      () => onSelect(category),
      category.isUnique && usedCategoryIDs.has(category.id),
      currentCategory === category
    )
    menu.appendChild(item)
  })

  document.addEventListener('mousedown', (event) => {
    if (!menu.contains(event.target as Node)) {
      popper.destroy()
    }
  })

  return menu
}

function createButton(
  view: EditorView,
  pos: number,
  currentCategory: SectionCategory | undefined,
  categories: SectionCategory[],
  usedCategoryIDs: Set<string>,
  canEdit = true
) {
  const handleSelect = (category: SectionCategory) => {
    const tr = view.state.tr
    tr.setNodeAttribute(pos, 'category', category.id)
    view.dispatch(tr)
  }
  const arrow = document.createElement('div')
  arrow.className = 'section-category popper-arrow'
  const button = document.createElement('button')
  button.innerHTML = sectionCategoryIcon
  button.classList.add('section-category-button')
  if (currentCategory) {
    button.classList.add('assigned')
  }
  if (canEdit) {
    button.addEventListener('mousedown', () => {
      popper.destroy()
      const menu = createMenu(
        currentCategory,
        categories,
        usedCategoryIDs,
        handleSelect
      )
      popper.show(button, menu, 'bottom-end', false, [
        { name: 'offset', options: { offset: [0, -10] } },
      ])
    })
  } else {
    button.addEventListener('mouseenter', () => {
      const tooltip = document.createElement('div')
      tooltip.className = 'section-category tooltip'
      tooltip.textContent = 'Category:'
      const span = document.createElement('span')
      span.textContent = currentCategory?.titles[0] || ''
      tooltip.appendChild(span)
      tooltip.appendChild(arrow)
      popper.show(button, tooltip, 'left', false, [
        { name: 'offset', options: { offset: [0, 10] } },
        { name: 'arrow', options: { element: arrow } },
      ])
    })
    button.addEventListener('mouseleave', () => {
      popper.destroy()
    })
  }

  return button
}

export function buildPluginState(
  state: EditorState,
  props: EditorProps
): PluginState {
  const decorations: Decoration[] = []
  const can = props.getCapabilities()
  const categories = props.sectionCategories
  const usedCategoryIDs = getUsedSectionCategoryIDs(state)

  state.doc.descendants((node, pos) => {
    if (node.type === schema.nodes.box_element) {
      return false
    }
    if (isSectionNode(node)) {
      const categoryID = node.attrs.category
      const category = categories.get(categoryID)
      if (category && category.group) {
        const groupCategories = getGroupCategories(categories, category.group)
        decorations.push(
          Decoration.widget(pos + 1, (view) =>
            createButton(
              view,
              pos,
              category,
              groupCategories,
              usedCategoryIDs,
              can?.editArticle
            )
          )
        )
      }
      return false
    }
  })

  return { decorations: DecorationSet.create(state.doc, decorations) }
}

const getUsedSectionCategoryIDs = (state: EditorState): Set<string> => {
  const sections = findChildrenByType(state.doc, schema.nodes.section)
  const used = new Set<string>()
  sections.forEach(({ node }) => {
    node.attrs.category && used.add(node.attrs.category)
  })
  return used
}

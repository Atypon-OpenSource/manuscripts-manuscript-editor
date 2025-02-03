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
  ImageDefaultIcon,
  ImageLeftIcon,
  ImageRightIcon,
  TriangleCollapsedIcon,
} from '@manuscripts/style-guide'
import {
  getListType,
  isInBibliographySection,
  isSectionTitleNode,
  ManuscriptEditorView,
  ManuscriptNode,
  ManuscriptNodeType,
  nodeNames,
  Nodes,
  schema,
} from '@manuscripts/transform'
import { Attrs, ResolvedPos } from 'prosemirror-model'
import { findChildrenByType } from 'prosemirror-utils'
import React, { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  addNodeComment,
  createBlock,
  findPosBeforeFirstSubsection,
  insertGeneralTableFootnote,
  insertInlineTableFootnote,
  isCommentingAllowed,
} from '../commands'
import { figurePositions } from '../views/figure_editable'
import { PopperManager } from './popper'
import {
  getMatchingChild,
  isChildOfNodeTypes,
  isSelectionInNode,
} from './utils'
import { updateNodeAttrs } from './view'

const popper = new PopperManager()

const readonlyTypes = [
  schema.nodes.keywords,
  schema.nodes.bibliography_element,
  schema.nodes.bibliography_section,
]

const isBoxElementSectionTitle = ($pos: ResolvedPos, node: ManuscriptNode) =>
  isSectionTitleNode(node) &&
  $pos.node($pos.depth - 1).type === schema.nodes.box_element

export const sectionLevel = (depth: number) => {
  switch (depth) {
    case 1:
      return 'Section'
    default:
      return 'Sub' + 'sub'.repeat(depth - 2) + 'section'
  }
}

type InsertableNodes = Nodes | 'subsection'

const hasAny = <T>(set: Set<T>, ...items: T[]) => {
  return items.some((i) => set.has(i))
}

export const contextMenuBtnClass = 'btn-context-menu'
const contextSubmenuBtnClass = 'context-submenu-trigger'

export class ContextMenu {
  private readonly node: ManuscriptNode
  private readonly view: ManuscriptEditorView
  private readonly getPos: () => number

  public constructor(
    node: ManuscriptNode,
    view: ManuscriptEditorView,
    getPos: () => number
  ) {
    this.node = node
    this.view = view
    this.getPos = getPos
  }

  public showAddMenu = (target: Element, after: boolean) => {
    const menu = document.createElement('div')
    menu.className = 'menu'
    const $pos = this.resolvePos()
    // we don`t want to add section after 'REFERENCES'
    if (isInBibliographySection($pos)) {
      after = false
    }
    const insertPos = after ? $pos.after($pos.depth) : $pos.before($pos.depth)
    const endPos = $pos.end()
    const types = this.insertableTypes(after, insertPos, endPos)

    const insertNode = (
      type: ManuscriptNodeType,
      pos?: number,
      attrs?: Attrs
    ) => {
      const { state, dispatch } = this.view

      if (pos === undefined) {
        pos = after ? this.getPos() + this.node.nodeSize : this.getPos()
      }

      createBlock(type, pos, state, dispatch, attrs)
    }

    if (hasAny(types, 'section', 'subsection')) {
      menu.appendChild(
        this.createMenuSection((section: HTMLElement) => {
          const sectionTitle = $pos.node($pos.depth).child(0).textContent
          const itemTitle = sectionTitle
            ? `“${this.trimTitle(sectionTitle, 30)}”`
            : 'This Section'
          if (
            types.has('section') &&
            !isChildOfNodeTypes(this.view.state.doc, $pos.pos, [
              schema.nodes.abstracts,
              schema.nodes.backmatter,
            ])
          ) {
            const labelPosition = after ? 'After' : 'Before'
            const level = sectionLevel($pos.depth - 1)
            const label = `New ${level} ${labelPosition} ${itemTitle}`

            section.appendChild(
              this.createMenuItem(label, () => {
                insertNode(schema.nodes.section, insertPos)
                popper.destroy()
              })
            )
          }

          if (types.has('subsection')) {
            const insPos = findPosBeforeFirstSubsection($pos) || endPos
            const level = sectionLevel($pos.depth)
            const label = `New ${level} to ${itemTitle}`

            section.appendChild(
              this.createMenuItem(label, () => {
                insertNode(schema.nodes.section, insPos)
                popper.destroy()
              })
            )
          }
        })
      )
    }
    if (hasAny(types, 'paragraph', 'list')) {
      menu.appendChild(
        this.createMenuSection((section: HTMLElement) => {
          if (types.has('paragraph')) {
            section.appendChild(
              this.createMenuItem('Paragraph', () => {
                insertNode(schema.nodes.paragraph)
                popper.destroy()
              })
            )
          }

          if (types.has('list')) {
            section.appendChild(
              this.createMenuItem('Bulleted List', () => {
                insertNode(schema.nodes.list, undefined, {
                  listStyleType: 'bullet',
                })
                popper.destroy()
              })
            )
            section.appendChild(
              this.createMenuItem('Ordered List', () => {
                insertNode(schema.nodes.list, undefined, {
                  listStyleType: 'order',
                })
                popper.destroy()
              })
            )
          }
        })
      )
    }

    if (hasAny(types, 'figure_element', 'equation_element')) {
      menu.appendChild(
        this.createMenuSection((section: HTMLElement) => {
          if (types.has('figure_element')) {
            section.appendChild(
              this.createMenuItem('Figure Panel', () => {
                insertNode(schema.nodes.figure_element)
                popper.destroy()
              })
            )
          }

          if (types.has('equation_element')) {
            section.appendChild(
              this.createMenuItem('Equation', () => {
                insertNode(schema.nodes.equation_element)
                popper.destroy()
              })
            )
          }
        })
      )
    }

    if (hasAny(types, 'blockquote_element')) {
      menu.appendChild(
        this.createMenuSection((section: HTMLElement) => {
          if (types.has('blockquote_element')) {
            section.appendChild(
              this.createMenuItem('Block Quote', () => {
                insertNode(schema.nodes.blockquote_element)
                popper.destroy()
              })
            )
          }
        })
      )
    }

    popper.show(target, menu, 'right', true)

    this.addPopperEventListeners()
  }

  public showEditMenu = (target: Element) => {
    const menu = document.createElement('div')
    menu.className = 'menu'

    const $pos = this.resolvePos()
    const isBox = isBoxElementSectionTitle($pos, this.node)
    const type = isBox ? schema.nodes.box_element : this.node.type

    if (
      type === schema.nodes.figure_element ||
      type === schema.nodes.image_element
    ) {
      const figure = getMatchingChild(
        this.node,
        (node) => node.type === schema.nodes.figure
      )

      if (figure) {
        const attrType = figure.attrs.type
        const submenuOptions = [
          {
            title: 'Left',
            action: () =>
              updateNodeAttrs(this.view, schema.nodes.figure, {
                ...figure.attrs,
                type: figurePositions.left,
              }),
            Icon: ImageLeftIcon,
            selected: attrType === figurePositions.left,
          },
          {
            title: 'Default',
            action: () =>
              updateNodeAttrs(this.view, schema.nodes.figure, {
                ...figure.attrs,
                type: figurePositions.default,
              }),
            Icon: ImageDefaultIcon,
            selected: !attrType,
          },
          {
            title: 'Right',
            action: () =>
              updateNodeAttrs(this.view, schema.nodes.figure, {
                ...figure.attrs,
                type: figurePositions.right,
              }),
            Icon: ImageRightIcon,
            selected: attrType === figurePositions.right,
          },
        ]
        const submenuLabel = 'Position'
        const submenu = this.createSubmenu(submenuLabel, submenuOptions)
        menu.appendChild(submenu)
      }
    }

    if (type === schema.nodes.list) {
      menu.appendChild(
        this.createMenuSection((section: HTMLElement) => {
          const attrs = this.node.attrs
          const listType = getListType(attrs.listStyleType).style
          if (listType === 'none' || listType === 'disc') {
            section.appendChild(
              this.createMenuItem('Change to Numbered List', () => {
                this.changeNodeType(null, 'order')
                popper.destroy()
              })
            )
          } else {
            section.appendChild(
              this.createMenuItem('Change to Bulleted list', () => {
                this.changeNodeType(null, 'bullet')
                popper.destroy()
              })
            )
          }
        })
      )
    }

    const commentTarget = this.getCommentTarget()
    if (isCommentingAllowed(commentTarget.type)) {
      menu.appendChild(
        this.createMenuSection((section: HTMLElement) => {
          section.appendChild(
            this.createMenuItem('Comment', () => {
              addNodeComment(commentTarget, this.view.state, this.view.dispatch)
              popper.destroy()
            })
          )
        })
      )
    }

    if (type === schema.nodes.table_element) {
      const items: Node[] = []
      const isInsideNode = isSelectionInNode(this.view.state, this.node)
      if (isInsideNode && insertInlineTableFootnote(this.view.state)) {
        const item = this.createMenuItem('Add Reference Note', () => {
          insertInlineTableFootnote(this.view.state, this.view.dispatch)
        })
        items.push(item)
      }
      const pos = this.getPos()
      if (insertGeneralTableFootnote([this.node, pos], this.view.state)) {
        const item = this.createMenuItem('Add General Note', () => {
          insertGeneralTableFootnote(
            [this.node, pos],
            this.view.state,
            this.view.dispatch
          )
        })
        items.push(item)
      }
      if (items.length) {
        menu.append(this.createMenuSection((e) => e.append(...items)))
      }
    }

    if (
      !readonlyTypes.includes(type) &&
      !readonlyTypes.includes($pos.parent.type)
    ) {
      menu.appendChild(
        this.createMenuSection((section: HTMLElement) => {
          let nodeName = nodeNames.get(type) || ''
          if (type === schema.nodes.section_title) {
            nodeName = nodeNames.get(schema.nodes.section) as string
          }
          section.appendChild(
            this.createMenuItem(`Delete ${nodeName}`, () => {
              this.deleteNode(type)
              popper.destroy()
            })
          )
        })
      )
    }

    popper.show(target, menu, 'right', true)

    this.addPopperEventListeners()
  }

  private createSubmenuTrigger = (contents: string) => {
    const item = document.createElement('div')
    item.className = 'menu-item'
    const textNode = document.createTextNode(contents)
    item.innerHTML = renderToStaticMarkup(createElement(TriangleCollapsedIcon))
    item.prepend(textNode)
    item.classList.add(contextSubmenuBtnClass)

    item.addEventListener('mousedown', this.toggleSubmenu)

    return item
  }

  private createMenuItem = (
    contents: string,
    handler: EventListener,
    Icon: React.FC | null = null,
    selected = false
  ) => {
    const item = document.createElement('div')
    item.className = 'menu-item'
    selected && item.classList.add('selected')
    if (Icon) {
      item.innerHTML = renderToStaticMarkup(createElement(Icon))
    }
    const textNode = document.createTextNode(contents)
    item.appendChild(textNode)

    item.addEventListener('mousedown', (event) => {
      event.preventDefault()
      handler(event)
    })

    return item
  }

  private createMenuSection = (
    createMenuItems: (section: HTMLElement) => void,
    isSubmenu = false
  ) => {
    const section = document.createElement('div')
    section.className = 'menu-section'
    isSubmenu && section.classList.add('menu')
    createMenuItems(section)
    return section
  }

  private createSubmenu = (
    submenuLabel: string,
    items: {
      title: string
      action: () => void
      Icon: React.FC | null
      selected: boolean
    }[]
  ) => {
    const submenu = document.createElement('div')
    submenu.classList.add('menu-section', 'context-submenu')
    submenu.append(
      this.createSubmenuTrigger(submenuLabel),
      this.createMenuSection((section: HTMLElement) => {
        items.forEach(({ title, action, Icon, selected }) => {
          section.appendChild(
            this.createMenuItem(title, action, Icon, selected)
          )
        })
      }, true)
    )

    return submenu
  }

  private insertableTypes = (
    after: boolean,
    insertPos: number,
    endPos: number
  ): Set<InsertableNodes> => {
    const { nodes } = schema

    const insertable = new Set<InsertableNodes>()

    const doc = this.view.state.doc

    const getPos = (pos?: number) => {
      if (pos === undefined) {
        pos = after ? this.getPos() + this.node.nodeSize : this.getPos()
      }
      return pos
    }

    const canInsertAt = (type: ManuscriptNodeType, pos?: number) => {
      const $pos = doc.resolve(getPos(pos))
      const index = $pos.index()
      return $pos.parent.canReplaceWith(index, index, type)
    }

    const checkNode = (node: Nodes, pos?: number) => {
      canInsertAt(nodes[node], pos) && insertable.add(node)
    }

    if (canInsertAt(nodes.section, endPos)) {
      insertable.add('subsection')
    }
    checkNode('section', insertPos)
    checkNode('paragraph')
    checkNode('list')
    checkNode('figure_element')
    checkNode('table_element')
    checkNode('equation_element')
    checkNode('blockquote_element')
    checkNode('pullquote_element')

    return insertable
  }

  private changeNodeType = (
    nodeType: ManuscriptNodeType | null,
    listType: string
  ) => {
    this.view.dispatch(
      this.view.state.tr.setNodeMarkup(this.getPos(), nodeType, {
        id: this.node.attrs.id,
        listStyleType: listType,
      })
    )
    popper.destroy()
  }

  private deleteNode = (nodeType: ManuscriptNodeType) => {
    switch (nodeType.name) {
      case 'section_title': {
        const $pos = this.resolvePos()

        this.view.dispatch(
          this.view.state.tr.delete($pos.before(), $pos.after())
        )

        break
      }

      case 'box_element': {
        const $pos = this.resolvePos()

        this.view.dispatch(
          this.view.state.tr.delete(
            $pos.before($pos.depth - 1),
            $pos.after($pos.depth - 1)
          )
        )

        break
      }

      default: {
        const pos = this.getPos()

        this.view.dispatch(
          this.view.state.tr.delete(pos, pos + this.node.nodeSize)
        )

        break
      }
    }
  }

  private resolvePos = () => this.view.state.doc.resolve(this.getPos())

  private addPopperEventListeners = () => {
    const mouseListener: EventListener = (event) => {
      const target = event.target as HTMLElement
      // if target is one of btn-context-menu buttons, do not destroy popper
      if (
        target.classList.contains(contextMenuBtnClass) ||
        target.classList.contains(contextSubmenuBtnClass)
      ) {
        return
      }
      window.requestAnimationFrame(() => {
        window.removeEventListener('mousedown', mouseListener)
        popper.destroy()
      })
    }

    const keyListener: EventListener = (event) => {
      if ((event as KeyboardEvent).key === 'Escape') {
        window.removeEventListener('keydown', keyListener)
        popper.destroy()
      }
    }

    window.addEventListener('mousedown', mouseListener)
    window.addEventListener('keydown', keyListener)
  }

  private trimTitle = (title: string, max: number) => {
    return title.length > max ? title.substring(0, max) + '…' : title
  }

  private getCommentTarget = () => {
    if (this.node.type === schema.nodes.section_title) {
      const $pos = this.resolvePos()
      const parent = $pos.parent
      if (parent.type === schema.nodes.keywords) {
        const groups = findChildrenByType(parent, schema.nodes.keyword_group)
        return groups.length ? groups[0].node : this.node
      }
      return parent
    }
    return this.node
  }

  private toggleSubmenu = (ev: MouseEvent) => {
    const submenu = (ev.target as HTMLElement).nextElementSibling
    submenu?.classList.toggle('show')
  }
}

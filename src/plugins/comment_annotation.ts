/*!
 * © 2022 Atypon Systems LLC
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
  getModelsByType,
  ManuscriptNode,
  ManuscriptSchema,
  schema,
} from '@manuscripts/manuscript-transform'
import {
  CommentAnnotation,
  Model,
  ObjectTypes,
} from '@manuscripts/manuscripts-json-schema'
import { NodeType } from 'prosemirror-model'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

import { SET_COMMENT } from './highlight'

export const commentAnnotation = new PluginKey<DecorationSet, ManuscriptSchema>(
  'comment_annotation'
)

interface CommentAnnotationProps {
  setCommentTarget: (target?: string) => void
  modelMap: Map<string, Model>
}

type Comment = {
  id: string
  target: string
  position: number
  location: 'block' | 'point'
  count: number
  targetType: NodeType
}

/**
 * This plugin creates a icon decoration for both inline and block comment.
 */
export default (props: CommentAnnotationProps) => {
  return new Plugin<DecorationSet, ManuscriptSchema>({
    key: commentAnnotation,
    state: {
      init: (tr) => commentsState(props.modelMap, tr.doc),
      apply: (tr) => {
        const meta = tr.getMeta(commentAnnotation)

        if (meta) {
          if (SET_COMMENT in meta) {
            props.setCommentTarget(meta[SET_COMMENT])
          }
        }

        return commentsState(props.modelMap, tr.doc)
      },
    },
    props: {
      decorations: (state) => {
        const pluginState = commentAnnotation.getState(state)
        if (pluginState) {
          return pluginState
        }
      },
    },
  })
}

const commentsState = (
  modelMap: Map<string, Model>,
  doc: ManuscriptNode
): DecorationSet => {
  const comments = getModelsByType<CommentAnnotation>(
    modelMap,
    ObjectTypes.CommentAnnotation
  )
  const blockCommentsCount = new Map<string, number>()
  const pointCommentsCount = new Map<string, number>()

  /**
   * gather comments with their count that belongs to a target node
   */
  const targetComments = comments.reduce((map, { _id, target, selector }) => {
    if (
      !selector ||
      (selector.from === selector.to &&
        !target.includes(ObjectTypes.CommentAnnotation))
    ) {
      let count
      if (!selector) {
        count = (blockCommentsCount.get(target) || 0) + 1
        blockCommentsCount.set(target, count)
      } else {
        count = (pointCommentsCount.get(target) || 0) + 1
        pointCommentsCount.set(target, count)
      }

      const comments = [
        ...(map.get(target) || []),
        {
          id: _id,
          target,
          location: selector ? 'point' : 'block',
          position: selector?.from,
          count: count,
        },
      ]
      map.set(target, comments)
    }
    return map
  }, new Map<string, Omit<Partial<Comment>, 'targetType' | 'location'>[]>())

  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    const id = node.attrs['id'] || node.attrs['rid']
    const targetComment = targetComments.get(id)
    if (targetComment && isAllowedType(node.type)) {
      targetComment.map((comment) => {
        decorations.push(
          Decoration.widget(
            comment.position || pos + 1,
            getCommentIcon({ ...comment, targetType: node.type } as Comment)
          )
        )
      })
    }
  })

  return DecorationSet.create(doc, decorations)
}

// TODO:: remove this check when we implement individual references
const isAllowedType = (type: NodeType) =>
  type !== type.schema.nodes.bibliography_element

const getCommentIcon = (comment: Comment) => () => {
  const { id, target, targetType, count, location } = comment
  const element = document.createElement('div')
  const isSection =
    targetType === schema.nodes.section ||
    targetType === targetType.schema.nodes.footnotes_section ||
    targetType === targetType.schema.nodes.bibliography_section
  const isFigure = targetType === schema.nodes.figure_element

  const elementClass = isSection
    ? 'block_comment'
    : isFigure
    ? 'figure_comment'
    : 'inline_comment'

  if (targetType === schema.nodes.citation || location === 'point') {
    element.id = target
    element.classList.add(
      location === 'point' ? 'point_comment' : 'inline_citation'
    )
  }

  element.classList.add('block_comment_button', elementClass)

  element.onclick = () => {
    const el = document.querySelector(`[id="${id}"]`)
    if (el) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      })
    }
  }

  const groupCommentIcon =
    (count > 1 &&
      ` <svg class="group_comment_icon" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="12" height="12" rx="6" fill="#F7B314"></rect>
          <text x="6" y="8" fill="#FFF" font-size="9px" text-anchor="middle" font-weight="400">${count}</text>
      </svg>`) ||
    ''

  element.innerHTML = `
      <svg class="comment_icon" width="16" height="13" viewBox="0 0 16 13" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4.0625 2.9375V7.3125L1.4375 11.6875H12.8125C13.7794 11.6875 14.5625 10.9044 14.5625 9.9375V2.9375C14.5625 1.97062 13.7794 1.1875 12.8125 1.1875H5.8125C4.84562 1.1875 4.0625 1.97062 4.0625 2.9375Z"
                fill="#FFFCDB" stroke="#FFBD26" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M6.6875 4.6875H11.9375" stroke="#FFBD26" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M6.6875 8.1875H9.3125" stroke="#FFBD26" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      ${groupCommentIcon}
  `
  return element
}

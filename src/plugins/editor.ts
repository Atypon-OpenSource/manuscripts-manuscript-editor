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

import 'prosemirror-gapcursor/style/gapcursor.css'
import 'prosemirror-tables/style/tables.css'

import {
  BibliographyItem,
  CommentAnnotation,
  Manuscript,
  Model,
} from '@manuscripts/json-schema'
import { CitationProvider } from '@manuscripts/library'
import { Build } from '@manuscripts/transform'
import { dropCursor } from 'prosemirror-dropcursor'
import { history } from 'prosemirror-history'
import { Plugin } from 'prosemirror-state'
import { tableEditing } from 'prosemirror-tables'

import keys from '../keys'
import rules from '../rules'
import bibliography from './bibliography'
import elements from './elements'
import footnotes from './footnotes'
import highlights from './highlight'
import keywords from './keywords'
import objects from './objects'
import paragraphs from './paragraphs'
import persist from './persist'
import placeholder from './placeholder'
import sections from './sections'
import styles from './styles'
import toc from './toc'

interface PluginProps {
  deleteModel: (id: string) => Promise<string>
  getCitationProvider: () => CitationProvider | undefined
  getLibraryItem: (id: string) => BibliographyItem | undefined
  getModel: <T extends Model>(id: string) => T | undefined
  getManuscript: () => Manuscript
  getModelMap: () => Map<string, Model>
  saveModel: <T extends Model>(model: T | Build<T> | Partial<T>) => Promise<T>
  setComment: (comment?: CommentAnnotation) => void
  plugins?: Array<Plugin<null>>
}

export default (props: PluginProps) => {
  const {
    getCitationProvider,
    getLibraryItem,
    getModel,
    getManuscript,
    getModelMap,
    setComment,
  } = props

  const plugins = props.plugins || []

  return [
    rules,
    ...keys,
    dropCursor(),
    history(),
    ...plugins, // TODO: should these run after persist?
    elements(),
    persist(),
    sections(),
    toc({ getModelMap }),
    footnotes(),
    styles({ getModel, getManuscript, getModelMap }),
    keywords(),
    bibliography({
      getCitationProvider,
      getLibraryItem,
      getModel,
    }),
    objects({ getManuscript, getModel }),
    paragraphs(),
    placeholder(),
    tableEditing(),
    highlights({ setComment }),
  ]
}

// for tables
document.execCommand('enableObjectResizing', false, 'false')
document.execCommand('enableInlineTableEditing', false, 'false')

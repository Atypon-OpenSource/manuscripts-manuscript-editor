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
  trackChangesPlugin,
  TrackChangesStatus,
} from '@manuscripts/track-changes-plugin'
import { collab } from 'prosemirror-collab'
import { dropCursor } from 'prosemirror-dropcursor'
import { history } from 'prosemirror-history'
import { tableEditing } from 'prosemirror-tables'

import keys from '../keys'
import affiliations from '../plugins/affiliations'
import bibliography from '../plugins/bibliography'
import comments from '../plugins/comments'
import cross_references from '../plugins/cross-references'
import doi from '../plugins/doi'
import editorProps from '../plugins/editor-props'
import elements from '../plugins/elements'
import footnotes from '../plugins/footnotes'
import objects from '../plugins/objects'
import paragraphs from '../plugins/paragraphs'
import persist from '../plugins/persist'
import placeholder from '../plugins/placeholder'
import search_replace from '../plugins/search-replace'
import section_title from '../plugins/section_title'
import section_category from '../plugins/section-category'
import selected_suggestion from '../plugins/selected-suggestion'
import table_editing_fix from '../plugins/tables-cursor-fix'
import rules from '../rules'
import { EditorProps } from './ManuscriptsEditor'

export default (props: EditorProps) => {
  const allPlugins = [
    rules,
    ...keys,
    dropCursor(),
    history(),
    trackChangesPlugin({
      userID: props.userID,
      debug: props.debug,
      initialStatus: props.getCapabilities().editWithoutTracking
        ? TrackChangesStatus.disabled
        : TrackChangesStatus.enabled,
    }),
    section_title(),
    table_editing_fix(),
    elements(),
    persist(),
    bibliography(props),
    objects(),
    affiliations(),
    comments(),
    paragraphs(),
    placeholder(),
    tableEditing(),
    selected_suggestion(),
    footnotes(props),
    editorProps(props),
    doi(),
    section_category(props),
    cross_references(),
    search_replace(),
  ]

  if (props.collabProvider) {
    allPlugins.push(collab({ version: props.collabProvider.currentVersion }))
  }

  return allPlugins
}

// for tables
document.execCommand('enableObjectResizing', false, 'false')
document.execCommand('enableInlineTableEditing', false, 'false')

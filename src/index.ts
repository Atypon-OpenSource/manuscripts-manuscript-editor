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

export * from './commands'
export { ManuscriptOutline } from './components/outline/ManuscriptOutline'
export { OutlineItemIcon } from './components/outline/Outline'
export { TypeSelector } from './components/toolbar/TypeSelector'
export * from './components/toolbar/ListMenuItem'
export * from './components/toolbar/InsertTableDialog'
export * from './menus'
export { ChangeReceiver } from './types'
export { CollabProvider } from './classes/collabProvider'
export { PopperManager } from './lib/popper'
export * from './toolbar'
export * from './lib/comments'
export * from './lib/files'
export * from './lib/footnotes'
export * from './lib/doc'
export * from './plugins/comments'
export { selectedSuggestionKey } from './plugins/selected-suggestion'
export * from './selection'
export * from './lib/utils'
export * from './lib/track-changes-utils'
export * from './useEditor'
export * from './lib/math'
export { objectsKey as objectsPluginKey } from './plugins/objects'
export { footnotesKey as footnotesPluginKey } from './plugins/footnotes'
export { bibliographyKey as bibliographyPluginKey } from './plugins/bibliography'
export { metadata, BibliographyItemAttrs } from './lib/references'
export {
  authorLabel,
  affiliationLabel,
  AffiliationAttrs,
  ContributorAttrs,
} from './lib/authors'

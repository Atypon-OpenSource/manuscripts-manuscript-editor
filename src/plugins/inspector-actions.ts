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

import { Plugin, PluginKey, Transaction } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'

export const inspectorActionPluginKey = new PluginKey('inspectorActionPlugin')

interface InspectorOpenTabs {
  primaryTab: string | null
  secondaryTab: string | null
}

interface PluginState {
  inspectorOpenTabs: InspectorOpenTabs
}

export default () => {
  return new Plugin<PluginState>({
    key: inspectorActionPluginKey,
    state: {
      init: () => ({
        inspectorOpenTabs: {
          primaryTab: null,
          secondaryTab: null,
        },
      }),
      apply: (tr: Transaction, value: PluginState) => {
        const meta = tr.getMeta(inspectorActionPluginKey)
        if (meta && meta.inspectorOpenTabs !== undefined) {
          return { ...value, inspectorOpenTabs: meta.inspectorOpenTabs }
        }
        return value
      },
    },
    props: {
      handleClick: (view: EditorView, pos: number, event: MouseEvent) => {
        const target = event.target as HTMLElement
        const inspectorOpenTabs: InspectorOpenTabs = {
          primaryTab: null,
          secondaryTab: null,
        }

        switch (target.dataset.action) {
          case 'open-other-files':
            event.stopPropagation()
            inspectorOpenTabs.primaryTab = 'files'
            inspectorOpenTabs.secondaryTab = 'other-files'
            break
          case 'open-supplement-files':
            event.stopPropagation()
            inspectorOpenTabs.primaryTab = 'files'
            inspectorOpenTabs.secondaryTab = 'supplements-files'
            break
          default:
            break
        }

        if (inspectorOpenTabs) {
          const tr = view.state.tr.setMeta(inspectorActionPluginKey, {
            inspectorOpenTabs,
          })
          view.dispatch(tr)
        }

        return false
      },
    },
  })
}

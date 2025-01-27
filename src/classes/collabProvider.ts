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

import { Step } from 'prosemirror-transform'

export abstract class CollabProvider {
  currentVersion: number
  protected newStepsListener: (steps?: Step[], clientIDs?: number[]) => void
  abstract sendSteps(
    version: number,
    steps: readonly Step[],
    clientID: string | number,
    flush?: boolean
  ): Promise<void>
  abstract onNewSteps(listener: CollabProvider['newStepsListener']): void
  abstract stepsSince(version: number): Promise<
    | {
        steps: Step[]
        clientIDs: number[]
        version: number
      }
    | undefined
  >
}

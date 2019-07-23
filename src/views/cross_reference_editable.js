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
import { buildAuxiliaryObjectReference } from '@manuscripts/manuscript-transform';
import React from 'react';
import { CrossReferenceItems } from '../components/views/CrossReferenceItems';
import { INSERT, modelsKey } from '../plugins/models';
import { objectsKey } from '../plugins/objects';
import { createEditableNodeView } from './creators';
import { CrossReferenceView } from './cross_reference';
export class CrossReferenceEditableView extends CrossReferenceView {
    constructor() {
        super(...arguments);
        this.selectNode = () => {
            const { permissions, renderReactComponent } = this.props;
            if (!permissions.write) {
                return;
            }
            const { rid } = this.node.attrs;
            const auxiliaryObjectReference = rid
                ? this.getAuxiliaryObjectReference(rid)
                : null;
            if (!this.popperContainer) {
                this.popperContainer = document.createElement('div');
                this.popperContainer.className = 'citation-editor';
            }
            renderReactComponent(React.createElement(CrossReferenceItems, { referencedObject: auxiliaryObjectReference
                    ? auxiliaryObjectReference.referencedObject
                    : null, handleSelect: this.handleSelect, targets: this.getTargets(), handleCancel: this.handleCancel }), this.popperContainer);
            this.props.popper.show(this.dom, this.popperContainer, 'right');
        };
        this.destroy = () => {
            this.props.popper.destroy();
            if (this.popperContainer) {
                this.props.unmountReactComponent(this.popperContainer);
            }
        };
        this.deselectNode = () => {
            this.handleCancel();
        };
        this.getTargets = () => {
            const targets = objectsKey.getState(this.view.state);
            return Array.from(targets.values());
        };
        this.handleCancel = () => {
            if (!this.node.attrs.rid) {
                const { state } = this.view;
                const pos = this.getPos();
                this.view.dispatch(state.tr
                    .delete(pos, pos + this.node.nodeSize)
                    .setSelection(this.view.state.selection));
            }
            else {
                this.destroy();
            }
        };
        this.handleSelect = (rid) => {
            const $pos = this.view.state.doc.resolve(this.getPos());
            const auxiliaryObjectReference = buildAuxiliaryObjectReference($pos.parent.attrs.id, rid);
            this.view.dispatch(this.view.state.tr
                .setMeta(modelsKey, { [INSERT]: [auxiliaryObjectReference] })
                .setNodeMarkup(this.getPos(), undefined, Object.assign({}, this.node.attrs, { rid: auxiliaryObjectReference._id }))
                .setSelection(this.view.state.selection));
            this.destroy();
        };
    }
}
export default createEditableNodeView(CrossReferenceEditableView);

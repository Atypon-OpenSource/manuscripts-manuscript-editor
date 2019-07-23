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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import AttentionOrange from '@manuscripts/assets/react/AttentionOrange';
import { isNodeType, } from '@manuscripts/manuscript-transform';
import { Tip } from '@manuscripts/style-guide';
import React, { useContext, useEffect, useState } from 'react';
import { RequirementsContext } from './RequirementsProvider';
export const RequirementsAlert = ({ node, }) => {
    const [items, setItems] = useState();
    const buildRequirementsAlerts = useContext(RequirementsContext);
    useEffect(() => {
        const timer = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
            if (isNodeType(node, 'manuscript') ||
                isNodeType(node, 'section')) {
                const alerts = yield buildRequirementsAlerts(node);
                const items = Object.values(alerts).filter(_ => _);
                setItems(items);
            }
        }), 250);
        return () => {
            clearTimeout(timer);
        };
    }, [buildRequirementsAlerts, node]);
    if (items && items.length) {
        return (React.createElement(Tip, { placement: 'right', title: items.join('. ') },
            React.createElement(AttentionOrange, { height: '1em' })));
    }
    return null;
};

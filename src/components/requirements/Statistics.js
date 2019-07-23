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
import { Tip } from '@manuscripts/style-guide';
import '@manuscripts/style-guide/styles/tip.css';
import * as Comlink from 'comlink';
import React, { useContext, useEffect, useState } from 'react';
import styled from 'styled-components';
import { buildText } from '../../lib/statistics';
import { RequirementsContext } from './RequirementsProvider';
const StatisticsWorker = Comlink.wrap(new Worker('../../lib/statistics.worker', { type: 'module' }));
const AlertContainer = styled.div `
  display: inline-flex;
  align-items: center;
  width: 20px;
  cursor: pointer;
`;
const StatisticContainer = styled.div `
  display: flex;
  align-items: center;
  margin: 8px 0;
`;
const Statistic = ({ value, singular, plural, alert }) => (React.createElement(StatisticContainer, null,
    React.createElement(AlertContainer, null, alert && (React.createElement(Tip, { placement: 'left', title: alert },
        React.createElement(AttentionOrange, { width: 12, height: 12 })))),
    value.toLocaleString(),
    " ",
    value === 1 ? singular : plural));
export const Statistics = ({ node }) => {
    const [statistics, setStatistics] = useState();
    const [alerts, setAlerts] = useState();
    const buildRequirementsAlerts = useContext(RequirementsContext);
    useEffect(() => {
        const timer = setTimeout(() => __awaiter(this, void 0, void 0, function* () {
            const text = buildText(node);
            const statistics = {
                text,
                characters: yield StatisticsWorker.countWords(text),
                words: yield StatisticsWorker.countWords(text),
            };
            setStatistics(statistics);
            const alerts = yield buildRequirementsAlerts(node, statistics);
            setAlerts(alerts);
        }), 250);
        return () => {
            clearTimeout(timer);
        };
    }, [buildRequirementsAlerts, node]);
    if (!statistics || !alerts) {
        return null;
    }
    return (React.createElement(Container, null,
        React.createElement(Statistic, { value: statistics.words, alert: alerts.words, singular: 'word', plural: 'words' }),
        React.createElement(Statistic, { value: statistics.characters, alert: alerts.characters, singular: 'character', plural: 'characters' })));
};
const Container = styled.div `
  margin: 8px 0;
`;

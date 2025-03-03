/*!
 * © 2025 Atypon Systems LLC
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
import Select, { CSSObjectWithLabel } from 'react-select'
import styled from 'styled-components'

import { Option } from './TypeSelector'

export const StyledSelect = styled(Select<Option, false>)`
  & > div:hover {
    border-color: ${(props) => props.theme.colors.border.secondary};
  }
`

export const customStyles = {
  control: (styles: CSSObjectWithLabel): CSSObjectWithLabel => ({
    ...styles,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e2e2e2',
    boxShadow: 'none',
    fontSize: '14px',
    minHeight: 0,
    padding: 0,
    width: 200,
    overflowX: 'hidden',
    textOverflow: 'ellipsis',
    cursor: 'pointer',
    height: 32,
  }),
  indicatorSeparator: (): CSSObjectWithLabel => ({
    display: 'none',
  }),
  dropdownIndicator: (styles: CSSObjectWithLabel): CSSObjectWithLabel => ({
    ...styles,
    padding: '0 4px',
  }),
  menu: (styles: CSSObjectWithLabel): CSSObjectWithLabel => ({
    ...styles,
    width: '200px',
  }),
  singleValue: (styles: CSSObjectWithLabel): CSSObjectWithLabel => ({
    ...styles,
    padding: 0,
  }),
  valueContainer: (styles: CSSObjectWithLabel): CSSObjectWithLabel => ({
    ...styles,
    padding: '1px 8px',
  }),
  container: (styles: CSSObjectWithLabel): CSSObjectWithLabel => ({
    ...styles,
    border: 'none',
  }),
}

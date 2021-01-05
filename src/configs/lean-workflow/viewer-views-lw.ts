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

import { FigureNode } from '@manuscripts/manuscript-transform'

import { Dispatch } from '../../commands'
import bibliographyElement from '../../views/bibliography_element'
import blockquoteElement from '../../views/blockquote_element'
import bulletList from '../../views/bullet_list'
import citation, { CitationViewProps } from '../../views/citation'
import crossReference, {
  CrossReferenceViewProps,
} from '../../views/cross_reference'
import equation from '../../views/equation'
import equationElement from '../../views/equation_element'
import Figure, { FigureProps } from '../../views/Figure'
import figureElement from '../../views/figure_element'
import inlineEquation from '../../views/inline_equation'
import inlineFootnote, {
  InlineFootnoteProps,
} from '../../views/inline_footnote'
import keywordsElement from '../../views/keywords_element'
import link from '../../views/link'
import orderedList from '../../views/ordered_list'
import paragraph from '../../views/paragraph'
import placeholder from '../../views/placeholder'
import placeholderElement from '../../views/placeholder_element'
import pullquoteElement from '../../views/pullquote_element'
import ReactView from '../../views/ReactView'
import sectionTitle from '../../views/section_title'
import tableElement from '../../views/table_element'
import tocElement from '../../views/toc_element'

type ViewerProps = CitationViewProps &
  CrossReferenceViewProps &
  InlineFootnoteProps &
  FigureProps

export default (props: ViewerProps, dispatch: Dispatch) => ({
  bibliography_element: bibliographyElement(props),
  blockquote_element: blockquoteElement(props),
  bullet_list: bulletList(props),
  citation: citation(props),
  cross_reference: crossReference(props),
  equation: equation(props),
  equation_element: equationElement(props),
  figure: ReactView(dispatch)<FigureNode>(Figure(props)),
  figure_element: figureElement(props),
  inline_equation: inlineEquation(props),
  inline_footnote: inlineFootnote(props),
  keywords_element: keywordsElement(props),
  link: link(props),
  ordered_list: orderedList(props),
  paragraph: paragraph(props),
  placeholder: placeholder(props),
  placeholder_element: placeholderElement(props),
  pullquote_element: pullquoteElement(props),
  section_title: sectionTitle(props),
  table_element: tableElement(props),
  toc_element: tocElement(props),
})

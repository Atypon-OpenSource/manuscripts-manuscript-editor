import { BibliographyItem } from '@manuscripts/manuscripts-json-schema'
import { stringify } from 'qs'
import { convertDataToBibliographyItem } from '../transformer/csl'

const search = (query: string, rows: number) =>
  window
    .fetch(
      'https://api.crossref.org/works?' +
        stringify({
          filter: 'type:journal-article',
          query,
          rows,
        })
    )
    .then(response => response.json())
    .then(data => data.message.items)

const fetch = (item: BibliographyItem) =>
  window
    .fetch(
      'https://data.crossref.org/' + encodeURIComponent(item.DOI as string),
      {
        headers: {
          accept: 'application/vnd.citationstyles.csl+json',
        },
      }
    )
    .then(response => response.json())
    .then(convertDataToBibliographyItem)

export const crossref = { fetch, search }

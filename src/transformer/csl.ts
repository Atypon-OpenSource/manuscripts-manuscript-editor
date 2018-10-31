import {
  BibliographicDate,
  BibliographicName,
  BibliographyItem,
  Bundle,
} from '@manuscripts/manuscripts-json-schema'
import axios from 'axios'
import CSL from 'citeproc'
import { basename } from 'path'
import { buildBibliographicDate, buildBibliographicName } from './builders'

interface Locales {
  'language-names': { [key: string]: string[] }
}

const contributorFields = [
  'author',
  'collection-editor',
  'composer',
  'container-author',
  'director',
  'editor',
  'editorial-director',
  'interviewer',
  'illustrator',
  'original-author',
  'recipient',
  'reviewed-author',
  'translator',
]

const dateFields = [
  'accessed',
  'container',
  'event-date',
  'issued',
  'original-date',
  'submitted',
]

const standardFields = [
  'abstract',
  'annote',
  'archive',
  'archive-place',
  'archive_location',
  'authority',
  'call-number',
  'categories',
  'chapter-number',
  'citation-label',
  'citation-number',
  'collection-number',
  'collection-title',
  'container-title',
  'container-title-short',
  'dimensions',
  'DOI',
  'edition',
  'event',
  'event-place',
  'first-reference-note-number',
  'genre',
  'ISBN',
  'ISSN',
  'issue',
  'journalAbbreviation',
  'jurisdiction',
  'keyword',
  'language',
  'locator',
  'medium',
  'note',
  'number',
  'number-of-pages',
  'number-of-volumes',
  'original-publisher',
  'original-publisher-place',
  'original-title',
  'page',
  'page-first',
  'PMCID',
  'PMID',
  'publisher',
  'publisher-place',
  'references',
  'reviewed-title',
  'scale',
  'section',
  'shortTitle',
  'source',
  'status',
  'title',
  'title-short',
  'type',
  'URL',
  'version',
  'volume',
  'year-suffix',
]

export const convertDataToBibliographyItem = (
  data: CSL.Data
): Partial<BibliographyItem> =>
  Object.entries(data).reduce(
    (output, [key, item]) => {
      if (standardFields.includes(key)) {
        output[key] = item as string
      } else if (contributorFields.includes(key)) {
        output[key] = (item as CSL.Person[]).map(
          (value: Partial<BibliographicName>) => buildBibliographicName(value)
        ) as BibliographicName[]
      } else if (dateFields.includes(key)) {
        output[key] = buildBibliographicDate(
          item as CSL.StructuredDate
        ) as BibliographicDate
      }

      return output
    },
    {} as Partial<BibliographyItem & { [key: string]: any }> // tslint:disable-line
  )

export const convertBibliographyItemToData = (
  bibliographyItem: BibliographyItem
): CSL.Data =>
  Object.entries(bibliographyItem).reduce(
    (output, [key, item]) => {
      if (standardFields.includes(key as CSL.StandardFieldKey)) {
        output[key] = item as string
      } else if (contributorFields.includes(key as CSL.PersonFieldKey)) {
        output[key] = (item as BibliographicName[]).map(name => {
          const { _id, objectType, ...rest } = name
          return rest
        }) as CSL.Person[]
      } else if (dateFields.includes(key as CSL.DateFieldKey)) {
        const { _id, objectType, ...rest } = item as BibliographicDate
        output[key] = rest as CSL.StructuredDate
      }

      return output
    },
    {
      id: bibliographyItem._id,
      type: 'article-journal', // TODO: more types
    } as CSL.Data // tslint:disable-line
  )

export class CitationManager {
  private readonly baseURL: string

  public constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  public createProcessor = async (
    bundleID: string,
    primaryLanguageCode: string,
    getLibraryItem: (id: string) => BibliographyItem | undefined
  ) => {
    const bundle = await this.fetchBundle(bundleID)

    if (!bundle) {
      throw new Error('Bundle not found')
    }

    if (!bundle.csl || !bundle.csl.cslIdentifier) {
      throw new Error('No CSL identifier')
    }

    const cslIdentifier = basename(bundle.csl.cslIdentifier, '.csl')

    const citationStyleData = await this.fetchStyle(cslIdentifier)

    const citationLocales = await this.fetchCitationLocales(
      citationStyleData,
      primaryLanguageCode
    )

    return new CSL.Engine(
      {
        retrieveItem: (id: string) => {
          const item = getLibraryItem(id)

          if (!item) {
            throw new Error('Library item not found')
          }

          return convertBibliographyItemToData(item)
        },
        retrieveLocale: localeName => citationLocales.get(localeName) as string,
        // embedBibliographyEntry: '',
        // wrapCitationEntry: '',
      },
      citationStyleData,
      primaryLanguageCode,
      false
    )
  }

  public fetchBundle = async (bundleID: string): Promise<Bundle> => {
    const bundles = await this.fetchBundles()

    const bundle = bundles.find(item => item._id === bundleID)

    if (!bundle) {
      throw new Error('Bundle not found: ' + bundleID)
    }

    return bundle
  }

  public fetchBundles = async (): Promise<Bundle[]> =>
    this.fetchJSON('shared/bundles.json')

  public fetchLocales = (): Promise<Locales> =>
    this.fetchJSON('csl/locales/locales.json')

  private buildURL = (path: string) => this.baseURL + '/' + path

  private async fetchText(path: string) {
    const response = await axios.get(this.buildURL(path), {
      responseType: 'text',
    })

    return response.data
  }

  private async fetchJSON(path: string) {
    const response = await axios.get(this.buildURL(path))

    return response.data
  }

  private fetchLocale(id: string) {
    return this.fetchText(`csl/locales/locales-${id}.xml`)
  }

  private fetchStyle(id: string) {
    return this.fetchText(`csl/styles/${id}.csl`)
  }

  private async fetchCitationLocales(
    citationStyleData: string,
    primaryLanguageCode: string
  ) {
    const locales: Map<string, string> = new Map()

    const localeNames = CSL.getLocaleNames(
      citationStyleData,
      primaryLanguageCode
    )

    await Promise.all(
      localeNames.map(async localeName => {
        const data = await this.fetchLocale(localeName)
        locales.set(localeName, data)
      })
    )

    return locales
  }
}

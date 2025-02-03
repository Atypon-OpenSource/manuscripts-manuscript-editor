/*!
 * © 2024 Atypon Systems LLC
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
import providers from 'oembed-providers'

export type ProviderJson = {
  type: 'photo' | 'video' | 'link' | 'rich'
  html?: string
  url?: string
  title?: string
}

/**
 * get oembed url by matching source link with provider scheme,
 * or hit head request to find link from header
 */
export const getOEmbedUrl = async (
  url: string,
  width: number,
  height: number
) => {
  let oembedUrl
  for (const provider of providers) {
    if (provider) {
      const { provider_url, endpoints } = provider
      for (const endpoint of endpoints) {
        if (
          endpoint.schemes &&
          endpoint.schemes.find((schema) => globToRegex(schema).test(url))
        ) {
          oembedUrl = endpoint.url.replace('{format}', 'json')
          break
        } else if (!endpoint.schemes && url.startsWith(provider_url)) {
          oembedUrl = endpoint.url.replace('{format}', 'json')
          break
        }
      }
    }
  }

  if (oembedUrl) {
    const params = new URLSearchParams()
    params.append('url', url)
    params.set('format', 'json')
    params.append('maxwidth', width.toString())
    params.append('maxheight', height.toString())
    return `${oembedUrl}?${params.toString()}`
  } else {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      let oembedUrl
      const linkHeader = response.headers.get('link')
      if (linkHeader) {
        linkHeader.split(',').map((link: string) => {
          const typeMatch = /type="([^"]*)"/.exec(link)
          if (
            typeMatch &&
            (typeMatch[1] === 'application/json+oembed' ||
              typeMatch[1] === 'text/xml+oembed')
          ) {
            oembedUrl = /<([^>]*)>/.exec(link)
          }
        })
      }
      return oembedUrl
    } catch (e) {
      return undefined
    }
  }
}

const globToRegex = (glob: string) => {
  const regex = glob
    .replace(/\./g, '\\.') // Escape dots
    .replace(/\*/g, '.*')
  return new RegExp(`^${regex}$`)
}

export const getOEmbedHTML = async (
  url: string,
  width: number,
  height: number
) => {
  try {
    const oembedUrl = await getOEmbedUrl(url, width, height)
    if (!oembedUrl) {
      return
    }

    const response = await fetch(oembedUrl)
    if (response.status === 200) {
      const json = await response.json()
      return json.html || renderAlternativeHTML(json)
    }
  } catch (e) {
    return
  }
}

const renderAlternativeHTML = (oembed: ProviderJson) => {
  if (oembed.type === 'photo') {
    return `<img src="${oembed.url}">`
  }
}

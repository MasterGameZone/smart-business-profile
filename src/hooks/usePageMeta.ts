import { useEffect } from 'react'

const DEFAULT_TITLE = 'Smart Business Profile'
const DEFAULT_DESCRIPTION =
  'Create and share professional digital business profiles with public links, QR codes, and business discovery.'
const DEFAULT_SOCIAL_DESCRIPTION =
  'Create professional digital business profiles and discover businesses online.'
const DEFAULT_OG_TYPE = 'website'
const DEFAULT_TWITTER_CARD = 'summary'

interface PageMetaOptions {
  title?: string
  description?: string
  ogTitle?: string
  ogDescription?: string
  ogType?: string
  ogUrl?: string
  twitterTitle?: string
  twitterDescription?: string
}

function resolveText(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim()
  return trimmed || fallback
}

function currentUrl(): string {
  if (typeof window === 'undefined') return ''
  return window.location.href
}

function setMetaContent(attribute: 'name' | 'property', key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)

  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }

  element.setAttribute('content', content)
}

export function usePageMeta(options: PageMetaOptions): void {
  useEffect(() => {
    const title = resolveText(options.title, DEFAULT_TITLE)
    const description = resolveText(options.description, DEFAULT_DESCRIPTION)
    const socialTitle = resolveText(options.ogTitle, title)
    const socialDescription = resolveText(options.ogDescription, options.description || DEFAULT_SOCIAL_DESCRIPTION)
    const twitterTitle = resolveText(options.twitterTitle, socialTitle)
    const twitterDescription = resolveText(options.twitterDescription, socialDescription)

    document.title = title
    setMetaContent('name', 'description', description)
    setMetaContent('property', 'og:title', socialTitle)
    setMetaContent('property', 'og:description', socialDescription)
    setMetaContent('property', 'og:type', resolveText(options.ogType, DEFAULT_OG_TYPE))
    setMetaContent('property', 'og:url', resolveText(options.ogUrl, currentUrl()))
    setMetaContent('property', 'og:site_name', DEFAULT_TITLE)
    setMetaContent('name', 'twitter:card', DEFAULT_TWITTER_CARD)
    setMetaContent('name', 'twitter:title', twitterTitle)
    setMetaContent('name', 'twitter:description', twitterDescription)
  }, [
    options.description,
    options.ogDescription,
    options.ogTitle,
    options.ogType,
    options.ogUrl,
    options.title,
    options.twitterDescription,
    options.twitterTitle,
  ])
}

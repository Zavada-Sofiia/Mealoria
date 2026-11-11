import { useEffect } from 'react'

const DEFAULT_TITLE = 'Mealoria'
const DEFAULT_DESCRIPTION = 'Mealoria: тижневе меню, калорії та список продуктів в одному місці.'

function ensure(selector: string, tag: 'meta' | 'link', init: Record<string, string>): Element {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement(tag)
    for (const [key, value] of Object.entries(init)) el.setAttribute(key, value)
    document.head.appendChild(el)
  }
  return el
}

function apply(title: string, description: string) {
  const url = `${window.location.origin}${window.location.pathname}`
  document.title = title
  ensure('meta[name="description"]', 'meta', { name: 'description' }).setAttribute('content', description)
  ensure('meta[property="og:title"]', 'meta', { property: 'og:title' }).setAttribute('content', title)
  ensure('meta[property="og:description"]', 'meta', { property: 'og:description' }).setAttribute('content', description)
  ensure('meta[property="og:url"]', 'meta', { property: 'og:url' }).setAttribute('content', url)
  ensure('link[rel="canonical"]', 'link', { rel: 'canonical' }).setAttribute('href', url)
}

/** Title, description and canonical address of a public page; the defaults come back when the page is left. */
export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    apply(title, description)
    return () => apply(DEFAULT_TITLE, DEFAULT_DESCRIPTION)
  }, [title, description])
}

/**
 * 微信分享 meta 注入（H5 端）
 * 微信抓取分享卡片优先读 og:title / og:description / og:image，此处动态 upsert，
 * JS-SDK（setupPageShare）作为兜底。imgUrl 必须为绝对 URL。
 */
export interface SeoMetaInput {
  title?: string
  desc?: string
  imgUrl?: string
}

function upsertMeta(doc: Document, property: string, content?: string): void {
  if (!content) return
  let el = doc.querySelector(`meta[property="${property}"]`)
  if (!el) {
    el = doc.createElement('meta')
    el.setAttribute('property', property)
    doc.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

export function applySeoMeta(meta: SeoMetaInput): void {
  if (typeof window === 'undefined' || !window.document) return
  const doc = window.document
  if (meta.title) doc.title = meta.title
  upsertMeta(doc, 'og:title', meta.title)
  upsertMeta(doc, 'og:description', meta.desc)
  upsertMeta(doc, 'og:image', meta.imgUrl)
}

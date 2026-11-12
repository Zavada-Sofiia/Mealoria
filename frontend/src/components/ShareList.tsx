import { useState } from 'react'
import { shareLinks, shoppingText } from '../shareList'
import { t } from '../i18n'

/** Sends what is still to buy to a chat: the system share sheet where there is one, messenger links, copy. */
export default function ShareList({ title, lines }: { title: string; lines: string[] }) {
  const [copied, setCopied] = useState(false)
  if (lines.length === 0) return null

  const site = window.location.origin
  const text = shoppingText(title, lines, `Mealoria · ${site.replace(/^https?:\/\//, '')}`)
  const links = shareLinks(text, site)
  const canShare = typeof navigator.share === 'function'

  async function share() {
    try {
      await navigator.share({ title, text })
    } catch {
      // closed without sending: nothing to do
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // clipboard blocked: the links above still work
    }
  }

  return (
    <div style={{ margin: '14px 0' }}>
      <strong>{t('Надіслати список')}</strong>
      <div className="actions" style={{ marginTop: 8 }}>
        {canShare && <button type="button" onClick={() => void share()}>{t('Поділитися…')}</button>}
        <a href={links.telegram} target="_blank" rel="noopener noreferrer"><button type="button">Telegram</button></a>
        <a href={links.viber} target="_blank" rel="noopener noreferrer"><button type="button">Viber</button></a>
        <a href={links.whatsapp} target="_blank" rel="noopener noreferrer"><button type="button">WhatsApp</button></a>
        <button type="button" onClick={() => void copy()}>{copied ? t('Скопійовано ✓') : t('Копіювати текст')}</button>
      </div>
    </div>
  )
}

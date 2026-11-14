import { t } from '../i18n'

/** The grey status line; while loading it shows shimmering placeholders instead of plain text. */
export default function StatusLine({ text }: { text: string }) {
  if (!text) return null
  if (text === t('Завантаження…')) {
    return (
      <div className="skeleton-list" role="status" aria-label={text}>
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton short" />
      </div>
    )
  }
  return <p className="status">{text}</p>
}

import { useEffect, useState } from 'react'
import { fetchNotice, noticeText, REFRESH_MS, type Notice } from '../notice'
import { t } from '../i18n'

export function NoticeBar({ level, text, onClose }: { level: string; text: string; onClose?: () => void }) {
  return (
    <div className={`notice ${level}`} role="status">
      <span className="notice-icon" aria-hidden="true">
        {level === 'warning' ? '⚠' : 'ℹ'}
      </span>
      <span className="notice-text">{text}</span>
      {onClose && (
        <button type="button" aria-label={t('Закрити оголошення')} onClick={onClose}>
          ×
        </button>
      )}
    </div>
  )
}

/** A message from the team for every visitor ("technical problems"), switched on in the developer page. */
export default function NoticeBanner() {
  const [notice, setNotice] = useState<Notice | null>(null)
  const [closed, setClosed] = useState(() => {
    try {
      return sessionStorage.getItem('noticeClosed') ?? ''
    } catch {
      return ''
    }
  })

  useEffect(() => {
    let current = true
    const load = () => void fetchNotice().then((n) => current && setNotice(n))
    load()
    const timer = setInterval(load, REFRESH_MS)
    const onVisible = () => !document.hidden && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      current = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!notice?.active) return null
  const text = noticeText(notice)
  if (!text || closed === text) return null

  return (
    <NoticeBar
      level={notice.level}
      text={text}
      onClose={() => {
        setClosed(text)
        try {
          sessionStorage.setItem('noticeClosed', text)
        } catch {
          // the notice just comes back after a reload
        }
      }}
    />
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { t } from '../i18n'

type Props = { onCode: (code: string) => void; onClose: () => void }

function cameraError(e: unknown): string {
  const name = e instanceof Error ? e.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return t('Немає доступу до камери. Дозвольте її в налаштуваннях браузера або введіть код вручну.')
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'TypeError')
    return t('Камеру не знайдено. Введіть код вручну.')
  return t('Не вдалося запустити камеру. Введіть код вручну.')
}

/** Reads a product barcode with the camera. The picture stays on the device; only the number is used. */
export default function BarcodeScanner({ onCode, onClose }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const latest = useRef(onCode)
  latest.current = onCode
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(true)
  const [typed, setTyped] = useState('')

  useEffect(() => {
    let stopped = false
    let stop: (() => void) | null = null
    let found = false

    async function start() {
      try {
        // loaded only now, so the rest of the site does not pay for the reader
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import('@zxing/browser'),
          import('@zxing/library'),
        ])
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ])
        const reader = new BrowserMultiFormatReader(hints)
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          video.current ?? undefined,
          (result) => {
            if (!result || found || stopped) return
            found = true
            stop?.()
            latest.current(result.getText())
          },
        )
        stop = () => controls.stop()
        if (stopped || found) controls.stop()
        else setStarting(false)
      } catch (e) {
        if (!stopped) {
          setError(cameraError(e))
          setStarting(false)
        }
      }
    }
    void start()
    return () => {
      stopped = true
      stop?.()
    }
  }, [])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (/^\d{8,14}$/.test(typed)) onCode(typed)
  }

  return (
    <>
      <div className="confirm-backdrop" onClick={onClose} />
      <div
        className="confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-title"
        style={{ width: 'min(480px, calc(100vw - 32px))' }}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <h3 id="scan-title">{t('Сканувати штрихкод')}</h3>
        {error ? (
          <p className="status">{error}</p>
        ) : (
          <>
            <video ref={video} muted playsInline style={{ width: '100%', borderRadius: 8, background: '#000', maxHeight: '45vh', objectFit: 'cover' }} />
            <p className="muted">{starting ? t('Запускаємо камеру…') : t('Наведіть камеру на штрихкод на упаковці')}</p>
          </>
        )}
        <form onSubmit={submit} className="actions" style={{ justifyContent: 'flex-start', marginBottom: 10 }}>
          <input inputMode="numeric" pattern="\d{8,14}" placeholder={t('Або введіть цифри під штрихкодом')} value={typed}
            maxLength={14} style={{ maxWidth: 260 }} onChange={(e) => setTyped(e.target.value.replace(/\D/g, ''))} />
          <button type="submit" disabled={!/^\d{8,14}$/.test(typed)}>{t('Знайти')}</button>
        </form>
        <div className="actions">
          <button type="button" onClick={onClose}>{t('Закрити')}</button>
        </div>
      </div>
    </>
  )
}

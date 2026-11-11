import { useEffect, useRef, useState } from 'react'
import { onConfirmRequest } from '../confirm'

type Open = Parameters<NonNullable<Parameters<typeof onConfirmRequest>[0]>>[0]

/** Mounted once: shows the confirmation window that askConfirm() asks for. */
export default function ConfirmHost() {
  const [request, setRequest] = useState<Open>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    onConfirmRequest(setRequest)
    return () => onConfirmRequest(null)
  }, [])

  useEffect(() => {
    if (request) cancelRef.current?.focus()
  }, [request])

  if (!request) return null

  const close = (ok: boolean) => {
    request.resolve(ok)
    setRequest(null)
  }

  return (
    <>
      <div className="confirm-backdrop" onClick={() => close(false)} />
      <div
        className={`confirm${request.danger ? ' danger' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onKeyDown={(e) => e.key === 'Escape' && close(false)}
      >
        <h3 id="confirm-title">{request.title}</h3>
        {request.text && <p className="muted">{request.text}</p>}
        <div className="actions">
          <button type="button" ref={cancelRef} onClick={() => close(false)}>
            {request.cancelLabel}
          </button>
          <button type="button" className={request.danger ? 'danger' : ''} onClick={() => close(true)}>
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </>
  )
}

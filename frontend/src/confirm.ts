export type ConfirmOptions = {
  title: string
  text?: string
  confirmLabel: string
  cancelLabel: string
  danger?: boolean
}

type Request = ConfirmOptions & { resolve: (ok: boolean) => void }

let listener: ((r: Request | null) => void) | null = null

/** Opens the site's own confirmation window; resolves to true when the user confirms. */
export function askConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!listener) return resolve(window.confirm(options.title)) // the host is not mounted yet
    listener({ ...options, resolve })
  })
}

export function onConfirmRequest(fn: ((r: Request | null) => void) | null) {
  listener = fn
}

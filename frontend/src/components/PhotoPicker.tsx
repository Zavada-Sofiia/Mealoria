import { useId, useState, type DragEvent } from 'react'

type Props = {
  onFile: (file: File) => void
  disabled?: boolean
  busy?: boolean
  title?: string
  hint?: string
}

/** A large drop zone that replaces the browser's default "choose file" button. */
export default function PhotoPicker({
  onFile,
  disabled = false,
  busy = false,
  title = 'Обрати фото',
  hint = 'або перетягніть зображення сюди',
}: Props) {
  const id = useId()
  const [over, setOver] = useState(false)

  function drop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/') && !disabled) onFile(file)
  }

  return (
    <label
      htmlFor={id}
      className={`dropzone${over ? ' over' : ''}${disabled ? ' disabled' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 8a2 2 0 0 1 2-2h1.5l1.2-1.6A1 1 0 0 1 9.5 4h5a1 1 0 0 1 .8.4L16.5 6H18a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      <span className="dropzone-title">{busy ? 'Завантажуємо…' : title}</span>
      <span className="dropzone-hint drag-hint">{hint}</span>
      <span className="dropzone-hint">JPEG, PNG або WebP</span>
      <input
        id={id}
        className="sr-only"
        type="file"
        accept="image/*"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </label>
  )
}

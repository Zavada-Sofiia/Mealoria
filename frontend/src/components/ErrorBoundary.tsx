import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportError } from '../monitoring'
import { t } from '../i18n'

type State = { failed: boolean }

/** Shows a friendly message instead of a blank page when a component crashes. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(Object.assign(error, { componentStack: info.componentStack }))
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="page narrow">
        <h1>{t('Щось пішло не так')}</h1>
        <p className="muted">
          {t('Сторінка зламалася. Ми вже отримали звіт про помилку. Спробуйте оновити сторінку.')}
        </p>
        <button onClick={() => window.location.reload()}>{t('Оновити сторінку')}</button>
      </div>
    )
  }
}

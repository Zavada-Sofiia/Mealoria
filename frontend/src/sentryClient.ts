// Only the parts of Sentry the site uses: a named re-export lets the bundler leave the rest of the SDK
// (replay, tracing, feedback widgets) out of the file that monitoring.ts loads on demand.
export { captureException, captureMessage, init } from '@sentry/react'

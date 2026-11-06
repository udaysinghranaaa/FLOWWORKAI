import { Component, type ReactNode } from 'react'
import { ErrorState } from './page'
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <main className="error-boundary">
        <ErrorState
          description="The frontend encountered an unexpected error. Reload to restore the original demo. Unsaved demo changes will reset."
          onRetry={() => window.location.reload()}
        />
      </main>
    ) : (
      this.props.children
    )
  }
}

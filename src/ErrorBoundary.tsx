import { Component, type ReactNode } from 'react'

/** If rendering ever throws, show a message and a reload button instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error(error)
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div style={{ padding: 24, maxWidth: 480 }}>
        <h1 style={{ fontSize: 18 }}>Something went wrong</h1>
        <p>The planner hit an unexpected error. Reload the page to start again.</p>
        <button onClick={() => location.reload()}>Reload</button>
      </div>
    )
  }
}

import { Component, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div className="max-w-md">
          <h1 className="text-2xl font-semibold">Er ging iets mis</h1>
          <p className="mt-2 text-muted-foreground">De app kon dit scherm niet tonen. Uw opgeslagen gegevens zijn niet gewijzigd.</p>
          <p className="mt-2 break-words rounded-xl bg-muted p-3 text-left text-xs text-muted-foreground">{this.state.error.message}</p>
          <div className="mt-5 flex justify-center gap-2">
            <button className="h-12 rounded-xl bg-primary px-5 font-semibold text-white" onClick={() => window.location.reload()}>
              Opnieuw laden
            </button>
            <button
              className="h-12 rounded-xl border px-5 font-semibold"
              onClick={() => {
                sessionStorage.removeItem('overstapadvies.draft.v2')
                window.location.hash = '#/'
                window.location.reload()
              }}
            >
              Nieuw advies starten
            </button>
          </div>
        </div>
      </div>
    )
  }
}

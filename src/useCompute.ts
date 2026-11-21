import { useEffect, useRef, useState } from 'react'
import { Frame } from './geo/frame'
import type { Input, Result } from './engine'
import type { Reply, Request } from './engine/worker'

type State = { result: Result | null; busy: boolean; error: string | null }

/**
 * Runs the rules engine in a Web Worker so drawing and dragging never wait on it.
 * Only one request is in flight; if the input changes meanwhile, just the newest one is sent next.
 */
export function useCompute(input: Input | null): State {
  const [state, setState] = useState<State>({ result: null, busy: false, error: null })
  const worker = useRef<Worker | null>(null)
  const inflight = useRef(false)
  const nextId = useRef(0)
  const latest = useRef<Input | null>(null)
  const dropUpTo = useRef(0) // replies for requests up to this id were sent before the plot was cleared

  const pump = () => {
    const w = worker.current
    const input = latest.current
    if (!w || inflight.current || !input) return
    latest.current = null
    inflight.current = true
    const req: Request = { id: ++nextId.current, input }
    w.postMessage(req)
  }

  useEffect(() => {
    const w = new Worker(new URL('./engine/worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    w.onmessage = (e: MessageEvent<Reply>) => {
      inflight.current = false
      const { id, result, error } = e.data
      if (id > dropUpTo.current) {
        setState({
          result: result && { ...result, frame: new Frame(result.frame.lon0, result.frame.lat0) },
          busy: latest.current !== null,
          error,
        })
      }
      pump()
    }
    w.onerror = () => {
      inflight.current = false
      setState((s) => ({ ...s, busy: false, error: 'The calculation failed. Try redrawing the plot.' }))
    }
    pump()
    return () => w.terminate()
  }, [])

  useEffect(() => {
    if (!input) {
      latest.current = null
      dropUpTo.current = nextId.current
      setState((s) => (s.result || s.error || s.busy ? { result: null, busy: false, error: null } : s))
      return
    }
    latest.current = input
    setState((s) => (s.busy ? s : { ...s, busy: true }))
    pump()
  }, [input])

  return state
}

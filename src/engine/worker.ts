/// <reference lib="webworker" />
import { compute, type Input, type Result } from './index'

export type Request = { id: number; input: Input }
/** `Frame` is a class, so it travels as its two numbers and is rebuilt on the page. */
export type WireResult = Omit<Result, 'frame'> & { frame: { lon0: number; lat0: number } }
export type Reply = { id: number; result: WireResult | null; error: string | null; ms: number }

self.onmessage = (e: MessageEvent<Request>) => {
  const { id, input } = e.data
  const t0 = performance.now()
  let reply: Reply
  try {
    const r = compute(input)
    reply = { id, result: r && { ...r, frame: { lon0: r.frame.lon0, lat0: r.frame.lat0 } }, error: null, ms: 0 }
  } catch (err) {
    reply = { id, result: null, error: err instanceof Error ? err.message : 'Could not work out this shape.', ms: 0 }
  }
  reply.ms = performance.now() - t0
  self.postMessage(reply)
}

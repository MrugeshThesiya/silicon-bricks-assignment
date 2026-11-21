// Minimal typings for the parts of clipper-lib (Clipper 6, Boost licence) that we use.
declare module 'clipper-lib' {
  export type IntPoint = { X: number; Y: number }
  export class PolyNode {
    Contour(): IntPoint[]
    Childs(): PolyNode[]
    IsHole(): boolean
  }
  export class PolyTree extends PolyNode {}
  export class Clipper {
    AddPaths(paths: IntPoint[][], polyType: number, closed: boolean): boolean
    Execute(clipType: number, solution: PolyTree, subjFill: number, clipFill: number): boolean
  }
  export class ClipperOffset {
    constructor(miterLimit?: number, arcTolerance?: number)
    AddPaths(paths: IntPoint[][], joinType: number, endType: number): void
    Execute(solution: PolyTree, delta: number): void
  }
  const ClipperLib: {
    Clipper: typeof Clipper
    ClipperOffset: typeof ClipperOffset
    PolyTree: typeof PolyTree
    PolyNode: typeof PolyNode
    PolyType: { ptSubject: number; ptClip: number }
    ClipType: { ctIntersection: number; ctUnion: number; ctDifference: number; ctXor: number }
    PolyFillType: { pftEvenOdd: number; pftNonZero: number; pftPositive: number; pftNegative: number }
    JoinType: { jtSquare: number; jtRound: number; jtMiter: number }
    EndType: { etClosedPolygon: number; etClosedLine: number; etOpenButt: number; etOpenSquare: number; etOpenRound: number }
  }
  export default ClipperLib
}

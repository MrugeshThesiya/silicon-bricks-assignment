export type XY = [number, number]

const M_PER_DEG_LAT = 110574

/** Local flat frame in metres around an origin. Fine for plots a few hundred metres across. */
export class Frame {
  private readonly kx: number
  constructor(readonly lon0: number, readonly lat0: number) {
    this.kx = 111320 * Math.cos((lat0 * Math.PI) / 180)
  }
  toXY([lon, lat]: [number, number]): XY {
    return [(lon - this.lon0) * this.kx, (lat - this.lat0) * M_PER_DEG_LAT]
  }
  toLL([x, y]: XY): [number, number] {
    return [this.lon0 + x / this.kx, this.lat0 + y / M_PER_DEG_LAT]
  }
}

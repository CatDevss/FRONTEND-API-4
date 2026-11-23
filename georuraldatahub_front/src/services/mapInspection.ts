import type { Feature, FeatureCollection, Geometry, Position } from 'geojson'

export type InspectableFeature = Feature<Geometry | null>

export interface MapInspection {
  latitude: number
  longitude: number
  groups: { fileId: number; name: string; color: string; features: InspectableFeature[] }[]
  pending: string[]
  failed: string[]
}
type Bounds = [number, number, number, number]
export interface IndexedFeature {
  feature: InspectableFeature
  bounds: Bounds
}
export interface HitQuery {
  longitude: number
  latitude: number
  bounds: Bounds
  pixel: { x: number; y: number }
  project: (position: Position) => { x: number; y: number }
  tolerance: number
}

function* positions(geometry: Geometry): Generator<Position> {
  switch (geometry.type) {
    case 'Point':
      yield geometry.coordinates
      break
    case 'MultiPoint':
    case 'LineString':
      yield* geometry.coordinates
      break
    case 'Polygon':
    case 'MultiLineString':
      for (const line of geometry.coordinates) yield* line
      break
    case 'MultiPolygon':
      for (const polygon of geometry.coordinates) for (const ring of polygon) yield* ring
      break
    case 'GeometryCollection':
      for (const child of geometry.geometries) yield* positions(child)
  }
}

export function indexFeatures(collection: FeatureCollection<Geometry | null>): IndexedFeature[] {
  const index: IndexedFeature[] = []
  for (const feature of collection.features) {
    if (!feature.geometry) continue
    const bounds: Bounds = [Infinity, Infinity, -Infinity, -Infinity]
    for (const [x, y] of positions(feature.geometry)) {
      if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) continue
      bounds[0] = Math.min(bounds[0], x)
      bounds[1] = Math.min(bounds[1], y)
      bounds[2] = Math.max(bounds[2], x)
      bounds[3] = Math.max(bounds[3], y)
    }
    if (Number.isFinite(bounds[0])) index.push({ feature, bounds })
  }
  return index
}

// 0 = fora, 1 = interior, 2 = borda. A borda de um buraco também pertence ao polígono.
function ringLocation(ring: Position[], x: number, y: number): number {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j],
      b = ring[i]
    if (!a || !b) continue
    const [ax, ay] = a,
      [bx, by] = b
    if (ax === undefined || ay === undefined || bx === undefined || by === undefined) continue
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax)
    if (
      Math.abs(cross) <= 1e-10 &&
      x >= Math.min(ax, bx) &&
      x <= Math.max(ax, bx) &&
      y >= Math.min(ay, by) &&
      y <= Math.max(ay, by)
    )
      return 2
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside
  }
  return inside ? 1 : 0
}

function inPolygon(rings: Position[][], query: HitQuery): boolean {
  if (!rings[0]) return false
  const outer = ringLocation(rings[0], query.longitude, query.latitude)
  if (outer !== 1) return outer === 2
  for (const hole of rings.slice(1)) {
    const location = ringLocation(hole, query.longitude, query.latitude)
    if (location === 2) return true
    if (location === 1) return false
  }
  return true
}

function nearLine(coordinates: Position[], query: HitQuery): boolean {
  for (let i = 1; i < coordinates.length; i++) {
    const a = query.project(coordinates[i - 1]!),
      b = query.project(coordinates[i]!)
    const dx = b.x - a.x,
      dy = b.y - a.y
    const length = dx * dx + dy * dy
    const t = length
      ? Math.max(0, Math.min(1, ((query.pixel.x - a.x) * dx + (query.pixel.y - a.y) * dy) / length))
      : 0
    if (Math.hypot(query.pixel.x - a.x - t * dx, query.pixel.y - a.y - t * dy) <= query.tolerance)
      return true
  }
  return false
}

function hit(geometry: Geometry, query: HitQuery): boolean {
  switch (geometry.type) {
    case 'Point': {
      const point = query.project(geometry.coordinates)
      return Math.hypot(point.x - query.pixel.x, point.y - query.pixel.y) <= query.tolerance
    }
    case 'MultiPoint':
      return geometry.coordinates.some((coordinates) => hit({ type: 'Point', coordinates }, query))
    case 'LineString':
      return nearLine(geometry.coordinates, query)
    case 'MultiLineString':
      return geometry.coordinates.some((line) => nearLine(line, query))
    case 'Polygon':
      return inPolygon(geometry.coordinates, query)
    case 'MultiPolygon':
      return geometry.coordinates.some((polygon) => inPolygon(polygon, query))
    case 'GeometryCollection':
      return geometry.geometries.some((child) => hit(child, query))
  }
}

export function featuresAt(index: IndexedFeature[], query: HitQuery): InspectableFeature[] {
  return index
    .filter(
      ({ feature, bounds }) =>
        bounds[0] <= query.bounds[2] &&
        bounds[2] >= query.bounds[0] &&
        bounds[1] <= query.bounds[3] &&
        bounds[3] >= query.bounds[1] &&
        feature.geometry &&
        hit(feature.geometry, query),
    )
    .map(({ feature }) => feature)
}

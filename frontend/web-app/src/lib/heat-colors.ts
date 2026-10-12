// Temperature -> colour, and the soft colour layer drawn over the map.

export const TEMP_STOPS: [number, [number, number, number]][] = [
  [8, [49, 104, 201]],
  [16, [60, 170, 220]],
  [24, [70, 180, 110]],
  [30, [240, 200, 40]],
  [36, [244, 140, 30]],
  [42, [214, 40, 57]],
  [48, [120, 14, 40]],
];

export function tempRgb(t: number): [number, number, number] {
  if (t <= TEMP_STOPS[0]![0]) return TEMP_STOPS[0]![1];
  for (let i = 1; i < TEMP_STOPS.length; i++) {
    const [t1, c1] = TEMP_STOPS[i]!;
    if (t <= t1) {
      const [t0, c0] = TEMP_STOPS[i - 1]!;
      const k = (t - t0) / (t1 - t0);
      return [0, 1, 2].map((n) => Math.round(c0[n]! + (c1[n]! - c0[n]!) * k)) as [number, number, number];
    }
  }
  return TEMP_STOPS[TEMP_STOPS.length - 1]![1];
}

export const tempCss = (t: number) => `rgb(${tempRgb(t).join(',')})`;
export const legendGradient = () =>
  `linear-gradient(90deg, ${TEMP_STOPS.map(([t, c], i) => `rgb(${c.join(',')}) ${Math.round((i / (TEMP_STOPS.length - 1)) * 100)}%`).join(', ')})`;

export interface GridPoint { latitude: number; longitude: number; temperatureC: number }

// Web-map tiles are Mercator, so a straight pixel row is not a straight latitude.
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const mercLat = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;

/** Smooth image of the grid, sized to the given bounds. Returns a data URL. */
export function buildHeatImage(points: GridPoint[], size: number, south: number, north: number, resolution = 120): string {
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = resolution;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(resolution, resolution);

  const yTop = mercY(north);
  const yBottom = mercY(south);
  // Points arrive row by row, top (north) first.
  const at = (row: number, col: number) => points[row * size + col]!.temperatureC;

  for (let py = 0; py < resolution; py++) {
    const lat = mercLat(yTop + ((yBottom - yTop) * (py + 0.5)) / resolution);
    const fr = Math.min(size - 1, Math.max(0, ((north - lat) / (north - south)) * (size - 1)));
    const r0 = Math.floor(fr);
    const r1 = Math.min(size - 1, r0 + 1);
    for (let px = 0; px < resolution; px++) {
      const fc = ((px + 0.5) / resolution) * (size - 1);
      const c0 = Math.floor(fc);
      const c1 = Math.min(size - 1, c0 + 1);
      const top = at(r0, c0) + (at(r0, c1) - at(r0, c0)) * (fc - c0);
      const bottom = at(r1, c0) + (at(r1, c1) - at(r1, c0)) * (fc - c0);
      const [r, g, b] = tempRgb(top + (bottom - top) * (fr - r0));
      const i = (py * resolution + px) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

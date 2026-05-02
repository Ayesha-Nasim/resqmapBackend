/**
 * Grid is built in degrees (good enough for v1).
 * cellSizeDeg ~ 0.005 ≈ ~500m (varies with latitude).
 *
 * IMPORTANT:
 * We DO NOT allocate grid.cells for huge bboxes.
 * Instead we return grid metadata + helpers so caller can generate polygons lazily.
 */
export function buildGrid(bbox, cellSizeDeg = 0.005, opts = {}) {
  const [minLng, minLat, maxLng, maxLat] = bbox;

  const cols = Math.ceil((maxLng - minLng) / cellSizeDeg);
  const rows = Math.ceil((maxLat - minLat) / cellSizeDeg);

  const totalCells = rows * cols;

  const maxCells = Number(opts.maxCells || 4000);

  // 🚫 Safety: refuse huge grids BEFORE allocating arrays
  if (totalCells > maxCells) {
    return {
      bbox,
      cellSizeDeg,
      rows,
      cols,
      totalCells,
      limited: true,
      maxCells,
      // no cells allocated
    };
  }

  // ✅ For small grids, optionally prebuild cells (handy for debugging)
  const cells = [];
  let id = 0;

  for (let r = 0; r < rows; r++) {
    const lat0 = minLat + r * cellSizeDeg;
    const lat1 = Math.min(lat0 + cellSizeDeg, maxLat);

    for (let c = 0; c < cols; c++) {
      const lng0 = minLng + c * cellSizeDeg;
      const lng1 = Math.min(lng0 + cellSizeDeg, maxLng);

      const ring = [
        [lng0, lat0],
        [lng1, lat0],
        [lng1, lat1],
        [lng0, lat1],
        [lng0, lat0],
      ];

      cells.push({
        id: `cell_${id++}`,
        row: r,
        col: c,
        ring,
        bbox: [lng0, lat0, lng1, lat1],
        center: [(lng0 + lng1) / 2, (lat0 + lat1) / 2],
      });
    }
  }

  return {
    bbox,
    cellSizeDeg,
    rows,
    cols,
    totalCells,
    limited: false,
    maxCells,
    cells,
  };
}

/**
 * Fast coordinate→cell mapping (O(1)).
 * Returns cell index (0..totalCells-1) OR null if outside bbox.
 */
export function coordToCellIndex({ lng, lat, grid }) {
  const [minLng, minLat, maxLng, maxLat] = grid.bbox;

  if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) return null;

  const col = Math.floor((lng - minLng) / grid.cellSizeDeg);
  const row = Math.floor((lat - minLat) / grid.cellSizeDeg);

  if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) return null;

  const idx = row * grid.cols + col;
  return idx >= 0 && idx < grid.totalCells ? idx : null;
}

/**
 * Get polygon ring for a given (row,col) WITHOUT storing all cells.
 */
export function getCellRing({ row, col, grid }) {
  const [minLng, minLat, maxLng, maxLat] = grid.bbox;
  const cs = grid.cellSizeDeg;

  const lat0 = minLat + row * cs;
  const lat1 = Math.min(lat0 + cs, maxLat);

  const lng0 = minLng + col * cs;
  const lng1 = Math.min(lng0 + cs, maxLng);

  return [
    [lng0, lat0],
    [lng1, lat0],
    [lng1, lat1],
    [lng0, lat1],
    [lng0, lat0],
  ];
}

/**
 * Stable cell id (same style you used before).
 */
export function cellIdFromIndex(idx) {
  return `cell_${idx}`;
}
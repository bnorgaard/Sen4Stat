#!/usr/bin/env python3
"""Align TESSERA v1 embeddings on the grid of a Sentinel-2 tile.

For one S2 tile and one year, writes in the output directory:
  TESSERA_<tile>_<year>_<version>.tif         int8, one band per dimension
  TESSERA_<tile>_<year>_<version>_scales.tif  float32 per-pixel scale, 0 = no data

Each S2 pixel takes, by nearest neighbour, the value of the TESSERA tile whose
0.1 degree cell contains the pixel centre. Values are copied, never computed.
The result is then checked against the source tiles, pixel by pixel.

Runs with Python 3.8, numpy 1.17 and GDAL 3.3 (image sen4x/crop-map-s4s:0.5.0).
"""
import argparse
import math
import os
import sys
import time
from typing import Dict, List, Tuple

import numpy as np
from osgeo import gdal, ogr, osr

gdal.UseExceptions()
ogr.UseExceptions()
osr.UseExceptions()

PIXEL_SIZE = 10
DEFAULT_SIZE = 10980
CELLS_PER_DEGREE = 10
NUM_DIMENSIONS = 128
DENSIFY_POINTS = 100
DEFAULT_ROOT = "/eodata/geoAI-embeddings/Tessera"

# nearest neighbour, exact reprojection (no approximation), full resolution only
WARP_OPTIONS = ["-r", "near", "-et", "0", "-ovr", "NONE", "-wo", "NUM_THREADS=ALL_CPUS"]

# MINISBLACK: no band may be taken for RGB or alpha
WORK_OPTIONS = [
    "TILED=YES",
    "BLOCKXSIZE=256",
    "BLOCKYSIZE=256",
    "INTERLEAVE=PIXEL",
    "PHOTOMETRIC=MINISBLACK",
    "BIGTIFF=YES",
    "SPARSE_OK=TRUE",
]
FINAL_OPTIONS = [
    "TILED=YES",
    "BLOCKXSIZE=256",
    "BLOCKYSIZE=256",
    "INTERLEAVE=PIXEL",
    "PHOTOMETRIC=MINISBLACK",
    "BIGTIFF=YES",
    "COMPRESS=ZSTD",
    "NUM_THREADS=ALL_CPUS",
]


def srs_from_epsg(epsg: int) -> osr.SpatialReference:
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(epsg)
    srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return srs


def densified_ring(x0, y0, x1, y1, n=DENSIFY_POINTS) -> List[Tuple[float, float]]:
    points = []
    for k in range(n):
        points.append((x0 + (x1 - x0) * k / n, y0))
    for k in range(n):
        points.append((x1, y0 + (y1 - y0) * k / n))
    for k in range(n):
        points.append((x1 - (x1 - x0) * k / n, y1))
    for k in range(n):
        points.append((x0, y1 - (y1 - y0) * k / n))
    points.append(points[0])
    return points


def polygon(points) -> ogr.Geometry:
    ring = ogr.Geometry(ogr.wkbLinearRing)
    for p in points:
        ring.AddPoint_2D(p[0], p[1])
    geom = ogr.Geometry(ogr.wkbPolygon)
    geom.AddGeometry(ring)
    return geom


def overlaps(a: ogr.Geometry, b: ogr.Geometry) -> bool:
    # interiors intersect; a shared edge or corner is not enough
    return a.Intersects(b) and not a.Touches(b)


def cell_index(lon, lat):
    # a point belongs to exactly one cell: [i / 10, (i + 1) / 10)
    return np.floor(lon * CELLS_PER_DEGREE), np.floor(lat * CELLS_PER_DEGREE)


class Cell(object):
    def __init__(self, i: int, j: int):
        self.i = i
        self.j = j
        self.name = "grid_{:.2f}_{:.2f}".format(
            (i + 0.5) / CELLS_PER_DEGREE, (j + 0.5) / CELLS_PER_DEGREE
        )

    def corners(self):
        return (
            self.i / CELLS_PER_DEGREE,
            self.j / CELLS_PER_DEGREE,
            (self.i + 1) / CELLS_PER_DEGREE,
            (self.j + 1) / CELLS_PER_DEGREE,
        )

    def paths(self, root: str, version: str, year: int) -> Tuple[str, str]:
        directory = os.path.join(
            root,
            f"Tessera-Embeddings-{version}",
            str(year),
            f"Tessera_{year}_{version}_{self.name}",
        )
        return (
            os.path.join(directory, f"{self.name}.tif"),
            os.path.join(directory, f"{self.name}_scales.tif"),
        )


class TileGrid(object):
    def __init__(self, epsg: int, ulx: float, uly: float, size: int):
        self.epsg = epsg
        self.ulx = ulx
        self.uly = uly
        self.size = size
        self.srs = srs_from_epsg(epsg)
        self.geo_transform = (ulx, PIXEL_SIZE, 0.0, uly, 0.0, -PIXEL_SIZE)

    def bounds(self):
        return (
            self.ulx,
            self.uly - self.size * PIXEL_SIZE,
            self.ulx + self.size * PIXEL_SIZE,
            self.uly,
        )

    def pixel_centre(self, row, col):
        return (
            self.ulx + (col + 0.5) * PIXEL_SIZE,
            self.uly - (row + 0.5) * PIXEL_SIZE,
        )

    def window_centres(self, window):
        xoff, yoff, xsize, ysize = window
        cols = np.arange(xoff, xoff + xsize, dtype=np.float64)
        rows = np.arange(yoff, yoff + ysize, dtype=np.float64)
        x, y = self.pixel_centre(rows, cols)
        return np.meshgrid(x, y)


def transform_arrays(ct, x, y):
    points = np.column_stack([x.ravel(), y.ravel()]).tolist()
    out = np.array(ct.TransformPoints(points))
    return out[:, 0].reshape(x.shape), out[:, 1].reshape(x.shape)


def list_cells(grid: TileGrid, to_lonlat, lonlat_bbox) -> Tuple[List[Cell], int]:
    footprint = polygon(to_lonlat.TransformPoints(densified_ring(*grid.bounds())))
    lon_min, lon_max, lat_min, lat_max = footprint.GetEnvelope()
    bbox = polygon(densified_ring(*lonlat_bbox, n=1)) if lonlat_bbox else None

    cells = []
    skipped = 0
    for i in range(math.floor(lon_min * CELLS_PER_DEGREE), math.ceil(lon_max * CELLS_PER_DEGREE)):
        for j in range(math.floor(lat_min * CELLS_PER_DEGREE), math.ceil(lat_max * CELLS_PER_DEGREE)):
            cell = Cell(i, j)
            cell_geom = polygon(densified_ring(*cell.corners(), n=1))
            if not overlaps(footprint, cell_geom):
                continue
            if bbox is not None and not overlaps(bbox, cell_geom):
                skipped += 1
                continue
            cells.append(cell)
    return cells, skipped


def cell_window(grid: TileGrid, cell: Cell, from_lonlat):
    points = from_lonlat.TransformPoints(densified_ring(*cell.corners()))
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    # one pixel of margin; the exact selection is done per pixel afterwards
    col0 = max(math.floor((min(xs) - grid.ulx) / PIXEL_SIZE) - 1, 0)
    col1 = min(math.ceil((max(xs) - grid.ulx) / PIXEL_SIZE) + 1, grid.size)
    row0 = max(math.floor((grid.uly - max(ys)) / PIXEL_SIZE) - 1, 0)
    row1 = min(math.ceil((grid.uly - min(ys)) / PIXEL_SIZE) + 1, grid.size)
    if col1 <= col0 or row1 <= row0:
        return None
    return (col0, row0, col1 - col0, row1 - row0)


def read_block(ds, window) -> np.ndarray:
    data = ds.ReadAsArray(*window)
    if data.ndim == 2:
        data = data[np.newaxis, :, :]
    return data


def write_block(ds, data: np.ndarray, window):
    xoff, yoff, xsize, ysize = window
    ds.WriteRaster(
        xoff,
        yoff,
        xsize,
        ysize,
        np.ascontiguousarray(data).tobytes(),
        band_list=list(range(1, data.shape[0] + 1)),
    )


def warp_window(source, grid: TileGrid, window) -> np.ndarray:
    xoff, yoff, xsize, ysize = window
    xmin = grid.ulx + xoff * PIXEL_SIZE
    ymax = grid.uly - yoff * PIXEL_SIZE
    ds = gdal.Warp(
        "",
        source,
        format="MEM",
        options=list(WARP_OPTIONS),
        outputBounds=(xmin, ymax - ysize * PIXEL_SIZE, xmin + xsize * PIXEL_SIZE, ymax),
        width=xsize,
        height=ysize,
        dstSRS=f"EPSG:{grid.epsg}",
    )
    return read_block(ds, (0, 0, xsize, ysize))


def open_embeddings(path: str, bands: List[int]):
    if len(bands) == NUM_DIMENSIONS:
        return gdal.Open(path)
    return gdal.Translate("", path, format="VRT", bandList=bands)


def pick_samples(rng, mask: np.ndarray, window, count: int) -> List[Tuple[int, int]]:
    # pixels of the cell next to a pixel of another cell
    padded = np.pad(mask, 1, mode="constant", constant_values=False)
    interior = (
        padded[1:-1, 1:-1]
        & padded[:-2, 1:-1]
        & padded[2:, 1:-1]
        & padded[1:-1, :-2]
        & padded[1:-1, 2:]
    )
    rows, cols = np.nonzero(mask & ~interior)
    if len(rows) == 0:
        return []
    picked = rng.choice(len(rows), min(count, len(rows)), replace=False)
    return [(int(rows[k]) + window[1], int(cols[k]) + window[0]) for k in picked]


def create_work_file(path, grid: TileGrid, band_count, data_type, options):
    driver = gdal.GetDriverByName("GTiff")
    ds = driver.Create(path, grid.size, grid.size, band_count, data_type, options)
    ds.SetGeoTransform(grid.geo_transform)
    ds.SetProjection(grid.srs.ExportToWkt())
    return ds


def check_output(
    grid: TileGrid,
    embeddings_path: str,
    scales_path: str,
    bands: List[int],
    samples: List[Tuple[int, int]],
    sources: Dict[Tuple[int, int], Tuple[str, str]],
    to_lonlat,
) -> int:
    """Recompute the expected value of each sample directly from the sources."""
    errors = 0
    emb_ds = gdal.Open(embeddings_path)
    scales_ds = gdal.Open(scales_path)

    if emb_ds.GetGeoTransform() != grid.geo_transform:
        print(f"ERROR: geotransform {emb_ds.GetGeoTransform()} != {grid.geo_transform}")
        errors += 1
    if (emb_ds.RasterXSize, emb_ds.RasterYSize) != (grid.size, grid.size):
        print(f"ERROR: size {emb_ds.RasterXSize} x {emb_ds.RasterYSize}")
        errors += 1
    if not grid.srs.IsSame(emb_ds.GetSpatialRef()):
        print("ERROR: spatial reference differs from the S2 tile")
        errors += 1

    opened = {}
    transforms = {}
    for row, col in samples:
        x, y = grid.pixel_centre(row, col)
        lon, lat, _ = to_lonlat.TransformPoint(x, y)
        i, j = cell_index(lon, lat)
        key = (int(i), int(j))

        out_values = np.frombuffer(
            emb_ds.ReadRaster(col, row, 1, 1, band_list=list(range(1, len(bands) + 1))),
            dtype=np.int8,
        )
        out_scale = scales_ds.ReadAsArray(col, row, 1, 1)[0, 0]

        if key not in sources:
            expected_values = np.zeros(len(bands), dtype=np.int8)
            expected_scale = np.float32(0)
        else:
            if key not in opened:
                emb_path, scl_path = sources[key]
                src = gdal.Open(emb_path)
                src_srs = src.GetSpatialRef().Clone()
                src_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
                opened[key] = (src, gdal.Open(scl_path))
                transforms[key] = osr.CoordinateTransformation(grid.srs, src_srs)
            src, src_scales = opened[key]
            xs, ys, _ = transforms[key].TransformPoint(x, y)
            gt = src.GetGeoTransform()
            c = math.floor((xs - gt[0]) / gt[1])
            r = math.floor((ys - gt[3]) / gt[5])
            if not (0 <= c < src.RasterXSize and 0 <= r < src.RasterYSize):
                print(f"ERROR: pixel ({row}, {col}) falls outside its source tile")
                errors += 1
                continue
            expected_values = np.frombuffer(src.ReadRaster(c, r, 1, 1, band_list=bands), dtype=np.int8)
            expected_scale = src_scales.ReadAsArray(c, r, 1, 1)[0, 0]

        same_scale = out_scale == expected_scale or (
            np.isnan(out_scale) and np.isnan(expected_scale)
        )
        if not np.array_equal(out_values, expected_values) or not same_scale:
            errors += 1
            if errors <= 10:
                print(
                    f"ERROR: pixel ({row}, {col}) cell {key}: "
                    f"scale {out_scale} != {expected_scale} or values differ"
                )
    return errors


def main():
    parser = argparse.ArgumentParser(
        description="Align TESSERA embeddings on the grid of a Sentinel-2 tile",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--tile", required=True, help="S2 tile id, used in file names")
    parser.add_argument("--epsg", type=int, required=True, help="EPSG code of the S2 tile")
    parser.add_argument("--ulx", type=float, required=True, help="upper left x of the S2 tile")
    parser.add_argument("--uly", type=float, required=True, help="upper left y of the S2 tile")
    parser.add_argument("--size", type=int, default=DEFAULT_SIZE, help="tile size in pixels")
    parser.add_argument("--year", type=int, required=True, help="TESSERA year")
    parser.add_argument("--version", default="v1.0", help="TESSERA version")
    parser.add_argument("--root", default=DEFAULT_ROOT, help="TESSERA root directory")
    parser.add_argument("--bands", type=int, nargs="*", help="dimensions to keep (1-128)")
    parser.add_argument(
        "--lonlat-bbox",
        type=float,
        nargs=4,
        metavar=("LON_MIN", "LAT_MIN", "LON_MAX", "LAT_MAX"),
        help="only process the cells intersecting this box (tests)",
    )
    parser.add_argument("--output-dir", required=True, help="output directory")
    parser.add_argument("--check-samples", type=int, default=2000, help="random pixels to check")
    parser.add_argument("--edge-samples", type=int, default=3, help="cell edge pixels to check, per cell")
    parser.add_argument("--seed", type=int, default=0, help="random seed of the check")
    args = parser.parse_args()

    gdal.SetConfigOption("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
    start = time.time()

    bands = args.bands or list(range(1, NUM_DIMENSIONS + 1))
    if any(b < 1 or b > NUM_DIMENSIONS for b in bands):
        parser.error(f"bands must be between 1 and {NUM_DIMENSIONS}")

    grid = TileGrid(args.epsg, args.ulx, args.uly, args.size)
    lonlat = srs_from_epsg(4326)
    to_lonlat = osr.CoordinateTransformation(grid.srs, lonlat)
    from_lonlat = osr.CoordinateTransformation(lonlat, grid.srs)

    cells, skipped = list_cells(grid, to_lonlat, args.lonlat_bbox)
    print(f"{len(cells)} cells to process, {skipped} skipped by --lonlat-bbox")

    name = f"TESSERA_{args.tile}_{args.year}_{args.version}"
    if len(bands) != NUM_DIMENSIONS:
        name += "_b" + "-".join(map(str, bands))
    os.makedirs(args.output_dir, exist_ok=True)
    embeddings_path = os.path.join(args.output_dir, f"{name}.tif")
    scales_path = os.path.join(args.output_dir, f"{name}_scales.tif")
    work_embeddings = embeddings_path + ".work.tif"
    work_scales = scales_path + ".work.tif"

    emb_ds = create_work_file(
        work_embeddings, grid, len(bands), gdal.GDT_Byte, WORK_OPTIONS + ["PIXELTYPE=SIGNEDBYTE"]
    )
    scales_ds = create_work_file(work_scales, grid, 1, gdal.GDT_Float32, WORK_OPTIONS)

    rng = np.random.RandomState(args.seed)
    samples = []
    sources: Dict[Tuple[int, int], Tuple[str, str]] = {}
    missing = []
    assigned = 0
    filled = 0

    for n, cell in enumerate(cells, start=1):
        window = cell_window(grid, cell, from_lonlat)
        if window is None:
            continue
        lon, lat = transform_arrays(to_lonlat, *grid.window_centres(window))
        i, j = cell_index(lon, lat)
        mask = (i == cell.i) & (j == cell.j)
        count = int(mask.sum())
        if count == 0:
            continue
        assigned += count
        samples += pick_samples(rng, mask, window, args.edge_samples)

        emb_path, scl_path = cell.paths(args.root, args.version, args.year)
        if not (os.path.exists(emb_path) and os.path.exists(scl_path)):
            missing.append(cell.name)
            print(f"[{n}/{len(cells)}] {cell.name}: missing, {count} pixels left at 0")
            continue

        t0 = time.time()
        values = warp_window(open_embeddings(emb_path, bands), grid, window)
        scales = warp_window(scl_path, grid, window)

        block = read_block(emb_ds, window)
        block[:, mask] = values[:, mask]
        write_block(emb_ds, block, window)

        block = read_block(scales_ds, window)
        block[:, mask] = scales[:, mask]
        write_block(scales_ds, block, window)

        sources[(cell.i, cell.j)] = (emb_path, scl_path)
        filled += count
        print(f"[{n}/{len(cells)}] {cell.name}: {count} pixels, {time.time() - t0:.1f} s")

    for k, b in enumerate(bands, start=1):
        emb_ds.GetRasterBand(k).SetDescription(f"TESSERA_{b - 1:03d}")
    scales_ds.GetRasterBand(1).SetDescription("TESSERA_SCALE")
    scales_ds.GetRasterBand(1).SetNoDataValue(0)
    metadata = {
        "TESSERA_VERSION": args.version,
        "TESSERA_YEAR": str(args.year),
        "S2_TILE": args.tile,
        "RESAMPLING": "nearest neighbour, exact reprojection",
        "MOSAIC_RULE": "tile whose 0.1 degree cell contains the pixel centre",
        "NO_DATA": "scale 0 and all dimensions 0",
    }
    emb_ds.SetMetadata(metadata)
    scales_ds.SetMetadata(metadata)
    emb_ds = None
    scales_ds = None

    print("Compressing outputs")
    gdal.Translate(
        embeddings_path,
        work_embeddings,
        creationOptions=FINAL_OPTIONS + ["PIXELTYPE=SIGNEDBYTE", "PREDICTOR=2"],
    )
    gdal.Translate(scales_path, work_scales, creationOptions=FINAL_OPTIONS + ["PREDICTOR=3"])
    os.remove(work_embeddings)
    os.remove(work_scales)

    total = grid.size * grid.size
    print(f"Pixels: {total} in tile, {assigned} assigned to a cell, {filled} filled, {total - filled} at 0")
    if missing:
        print(f"Missing tiles ({len(missing)}): {' '.join(missing)}")
    if not args.lonlat_bbox and assigned != total:
        print(f"ERROR: {total - assigned} pixels belong to no listed cell")

    rows = rng.randint(0, grid.size, args.check_samples)
    cols = rng.randint(0, grid.size, args.check_samples)
    samples += list(zip(rows.tolist(), cols.tolist()))
    print(f"Checking {len(samples)} pixels against the source tiles")
    errors = check_output(grid, embeddings_path, scales_path, bands, samples, sources, to_lonlat)
    if not args.lonlat_bbox and assigned != total:
        errors += 1

    print(f"Done in {time.time() - start:.0f} s: {embeddings_path}, {scales_path}")
    if errors:
        print(f"CHECK FAILED: {errors} error(s)")
        sys.exit(1)
    print("CHECK OK")


if __name__ == "__main__":
    main()

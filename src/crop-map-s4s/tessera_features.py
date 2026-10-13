"""TESSERA embeddings as crop mapping features.

Used by crop-map-s4s.py when the feature filter contains "tessera":
  check_availability  fail early when the embeddings are missing on CreoDias
  prepare_tile        align one year of embeddings on the grid of a S2 tile
  vrt_bands           VRT bands that dequantize the embeddings on the fly

Each S2 pixel takes, by nearest neighbour, the value of the TESSERA tile whose
0.1 degree cell contains the pixel centre; values are copied, never computed.
The int8 values are stored as Int16: GDAL 3.3 has no signed 8-bit type and
reads negative values as 128..255.

Runs with Python 3.8, numpy 1.17 and GDAL 3.3 (sen4x/crop-map-s4s:0.5.0).
GDAL exceptions are not enabled, so that crop-map-s4s.py keeps its behaviour.
"""
import math
import os
import time
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

import numpy as np
from lxml.builder import E
from osgeo import gdal, ogr, osr

DEFAULT_ROOT = "/eodata/geoAI-embeddings/Tessera"
DEFAULT_VERSION = "v1.0"
NUM_DIMENSIONS = 128
PIXEL_SIZE = 10
CELLS_PER_DEGREE = 10
DENSIFY_POINTS = 100
BLOCK_SIZE = 256

# nearest neighbour, exact reprojection (no approximation), full resolution only
WARP_OPTIONS = ["-r", "near", "-et", "0", "-ovr", "NONE", "-wo", "NUM_THREADS=ALL_CPUS"]

# uncompressed, like the other per-tile features of the job
CREATION_OPTIONS = [
    "TILED=YES",
    f"BLOCKXSIZE={BLOCK_SIZE}",
    f"BLOCKYSIZE={BLOCK_SIZE}",
    "INTERLEAVE=PIXEL",
    "PHOTOMETRIC=MINISBLACK",
    "BIGTIFF=YES",
    "SPARSE_OK=TRUE",
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
            year_directory(root, version, year), f"Tessera_{year}_{version}_{self.name}"
        )
        return (
            os.path.join(directory, f"{self.name}.tif"),
            os.path.join(directory, f"{self.name}_scales.tif"),
        )

    def exists(self, root: str, version: str, year: int) -> bool:
        return all(os.path.exists(p) for p in self.paths(root, version, year))


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


def year_directory(root: str, version: str, year: int) -> str:
    return os.path.join(root, f"Tessera-Embeddings-{version}", str(year))


def select_year(season_start: date, season_end: date) -> int:
    """Year holding most of the season; the later one on a tie."""
    days: Dict[int, int] = {}
    d = season_start
    while d <= season_end:
        days[d.year] = days.get(d.year, 0) + 1
        d += timedelta(days=1)
    return max(days, key=lambda y: (days[y], y))


def band_names(year: int) -> List[str]:
    return [f"TESSERA_{year}_{d:03d}" for d in range(NUM_DIMENSIONS)]


def output_paths(tile_id: str, year: int, version: str) -> Tuple[str, str]:
    name = f"TESSERA_{tile_id}_{year}_{version}"
    return (f"{name}.tif", f"{name}_scales.tif")


def transform_arrays(ct, x, y):
    points = np.column_stack([x.ravel(), y.ravel()]).tolist()
    out = np.array(ct.TransformPoints(points))
    return out[:, 0].reshape(x.shape), out[:, 1].reshape(x.shape)


def tile_cells(grid: TileGrid, area: Optional[ogr.Geometry] = None) -> List[Cell]:
    """Cells overlapping the tile, and the area (lon/lat) when given."""
    to_lonlat = osr.CoordinateTransformation(grid.srs, srs_from_epsg(4326))
    footprint = polygon(to_lonlat.TransformPoints(densified_ring(*grid.bounds())))
    if area is not None:
        clipped = area.Intersection(footprint)
        if clipped is None:
            # invalid site geometry: require every cell of the tile
            area = None
        elif clipped.IsEmpty():
            return []
        else:
            area = clipped
    lon_min, lon_max, lat_min, lat_max = footprint.GetEnvelope()

    cells = []
    for i in range(math.floor(lon_min * CELLS_PER_DEGREE), math.ceil(lon_max * CELLS_PER_DEGREE)):
        for j in range(math.floor(lat_min * CELLS_PER_DEGREE), math.ceil(lat_max * CELLS_PER_DEGREE)):
            cell = Cell(i, j)
            cell_geom = polygon(densified_ring(*cell.corners(), n=1))
            if not overlaps(footprint, cell_geom):
                continue
            if area is not None and not overlaps(area, cell_geom):
                continue
            cells.append(cell)
    return cells


def check_availability(
    tiles: List[Tuple[str, int, float, float]],
    site_area: Optional[ogr.Geometry],
    root: str,
    version: str,
    year: int,
    size: int,
) -> Optional[str]:
    """Error message when embeddings are missing for the site, None otherwise.

    tiles: (tile id, EPSG code, upper left x, upper left y) of the S2 tiles.
    site_area: site geometry in lon/lat; cells outside it (sea) are not required.
    """
    remedy = (
        "Remove 'tessera' from processor.s4s_crop_mapping.features-filter "
        "or choose a season covered by TESSERA."
    )
    if not os.path.isdir(root):
        return (
            f"TESSERA directory {root} not found; check that /eodata is mounted "
            f"in the container (general.orchestrator.docker_add_mounts)."
        )
    directory = year_directory(root, version, year)
    if not os.path.isdir(directory):
        return (
            f"TESSERA {version} embeddings for {year} are not available on CreoDias "
            f"(no directory {directory}). {remedy}"
        )

    problems = []
    for tile_id, epsg, ulx, uly in tiles:
        cells = tile_cells(TileGrid(epsg, ulx, uly, size), site_area)
        missing = [c.name for c in cells if not c.exists(root, version, year)]
        print(f"TESSERA {tile_id}: {len(cells)} cells required, {len(missing)} missing")
        if missing:
            shown = ", ".join(missing[:5]) + (", ..." if len(missing) > 5 else "")
            problems.append(
                f"{len(missing)} of {len(cells)} required 0.1 degree cells are missing "
                f"on tile {tile_id} ({shown})"
            )
    if problems:
        return (
            f"TESSERA {version} embeddings for {year} are not available on CreoDias "
            f"for this site: {'; '.join(problems)}. {remedy}"
        )
    return None


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


def open_dataset(path: str):
    ds = gdal.Open(path)
    if ds is None:
        raise RuntimeError(f"Cannot open {path}: {gdal.GetLastErrorMsg()}")
    return ds


def read_block(ds, window) -> np.ndarray:
    data = ds.ReadAsArray(*window)
    if data is None:
        raise RuntimeError(f"Cannot read {ds.GetDescription()}: {gdal.GetLastErrorMsg()}")
    if data.ndim == 2:
        data = data[np.newaxis, :, :]
    return data


def write_masked(ds, data: np.ndarray, mask: np.ndarray, window):
    """Write the pixels of the mask only, run by run; neighbours are untouched."""
    xoff, yoff = window[0], window[1]
    bands = list(range(1, data.shape[0] + 1))
    for r in np.nonzero(mask.any(axis=1))[0]:
        cols = np.nonzero(mask[r])[0]
        breaks = np.nonzero(np.diff(cols) > 1)[0]
        for s, e in zip(np.concatenate([[0], breaks + 1]), np.concatenate([breaks, [len(cols) - 1]])):
            c0, c1 = int(cols[s]), int(cols[e])
            run = np.ascontiguousarray(data[:, r, c0 : c1 + 1])
            err = ds.WriteRaster(xoff + c0, yoff + int(r), c1 - c0 + 1, 1, run.tobytes(), band_list=bands)
            if err != gdal.CE_None:
                raise RuntimeError(f"Cannot write {ds.GetDescription()}: {gdal.GetLastErrorMsg()}")


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
    if ds is None:
        raise RuntimeError(f"Cannot warp {source.GetDescription()}: {gdal.GetLastErrorMsg()}")
    return read_block(ds, (0, 0, xsize, ysize))


def create_raster(path: str, grid: TileGrid, band_count: int, data_type):
    driver = gdal.GetDriverByName("GTiff")
    ds = driver.Create(path, grid.size, grid.size, band_count, data_type, CREATION_OPTIONS)
    if ds is None:
        raise RuntimeError(f"Cannot create {path}: {gdal.GetLastErrorMsg()}")
    ds.SetGeoTransform(grid.geo_transform)
    ds.SetProjection(grid.srs.ExportToWkt())
    return ds


def pick_samples(rng, mask: np.ndarray, window, edge: int, inner: int) -> List[Tuple[int, int]]:
    """Pixels of the cell to check: next to another cell, and anywhere."""
    padded = np.pad(mask, 1, mode="constant", constant_values=False)
    interior = (
        padded[1:-1, 1:-1]
        & padded[:-2, 1:-1]
        & padded[2:, 1:-1]
        & padded[1:-1, :-2]
        & padded[1:-1, 2:]
    )
    picked = []
    for candidates, count in ((mask & ~interior, edge), (mask, inner)):
        rows, cols = np.nonzero(candidates)
        if len(rows):
            for k in rng.choice(len(rows), min(count, len(rows)), replace=False):
                picked.append((int(rows[k]) + window[1], int(cols[k]) + window[0]))
    return picked


ALL_BANDS = list(range(1, NUM_DIMENSIONS + 1))


def output_pixel(emb_ds, scales_ds, row: int, col: int):
    values = np.frombuffer(emb_ds.ReadRaster(col, row, 1, 1, band_list=ALL_BANDS), dtype=np.int16)
    return values, scales_ds.ReadAsArray(col, row, 1, 1)[0, 0]


def source_pixel(src, src_scales, to_src, grid: TileGrid, row: int, col: int):
    """Source pixel containing the centre of the S2 pixel, computed by hand."""
    x, y = grid.pixel_centre(row, col)
    xs, ys, _ = to_src.TransformPoint(x, y)
    gt = src.GetGeoTransform()
    c = math.floor((xs - gt[0]) / gt[1])
    r = math.floor((ys - gt[3]) / gt[5])
    if not (0 <= c < src.RasterXSize and 0 <= r < src.RasterYSize):
        return None
    raw = src.ReadRaster(c, r, 1, 1, band_list=ALL_BANDS)
    values = np.frombuffer(raw, dtype=np.int8).astype(np.int16)
    return values, src_scales.ReadAsArray(c, r, 1, 1)[0, 0]


def same_pixel(a, b) -> bool:
    if a is None or b is None:
        return False
    scale_a, scale_b = a[1], b[1]
    same_scale = scale_a == scale_b or (np.isnan(scale_a) and np.isnan(scale_b))
    return bool(np.array_equal(a[0], b[0]) and same_scale)


def prepare_tile(
    tile_id: str,
    epsg: int,
    ulx: float,
    uly: float,
    size: int,
    root: str,
    version: str,
    year: int,
    output_dir: str = ".",
    edge_samples: int = 1,
    inner_samples: int = 5,
    seed: int = 0,
) -> Tuple[str, str]:
    """Align one year of embeddings on the grid of a S2 tile; skip if done.

    Pixels without a source tile get 0 values and a 0 scale (no data).
    A few pixels of each cell are checked against the source, recomputed by
    hand, while its blocks are still cached; RuntimeError on any mismatch.
    """
    names = output_paths(tile_id, year, version)
    embeddings_path, scales_path = [os.path.join(output_dir, n) for n in names]
    if os.path.exists(embeddings_path) and os.path.exists(scales_path):
        print(f"TESSERA {tile_id}: {embeddings_path} already exists")
        return embeddings_path, scales_path

    start = time.time()
    gdal.SetConfigOption("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
    grid = TileGrid(epsg, ulx, uly, size)
    lonlat = srs_from_epsg(4326)
    to_lonlat = osr.CoordinateTransformation(grid.srs, lonlat)
    from_lonlat = osr.CoordinateTransformation(lonlat, grid.srs)
    cells = tile_cells(grid)

    # written under a temporary name, so that an interrupted run is not reused
    work_embeddings = embeddings_path + ".part"
    work_scales = scales_path + ".part"
    emb_ds = create_raster(work_embeddings, grid, NUM_DIMENSIONS, gdal.GDT_Int16)
    scales_ds = create_raster(work_scales, grid, 1, gdal.GDT_Float32)

    rng = np.random.RandomState(seed)
    assigned = 0
    aligned = 0
    checked = 0
    missing = []
    errors = []
    for cell in cells:
        window = cell_window(grid, cell, from_lonlat)
        if window is None:
            continue
        lon, lat = transform_arrays(to_lonlat, *grid.window_centres(window))
        i, j = cell_index(lon, lat)
        mask = (i == cell.i) & (j == cell.j)
        if not mask.any():
            continue
        assigned += int(mask.sum())
        samples = pick_samples(rng, mask, window, edge_samples, inner_samples)
        checked += len(samples)

        if not cell.exists(root, version, year):
            missing.append(cell.name)
            empty = (np.zeros(NUM_DIMENSIONS, dtype=np.int16), np.float32(0))
            for row, col in samples:
                if not same_pixel(output_pixel(emb_ds, scales_ds, row, col), empty):
                    errors.append((cell.name, row, col))
            continue

        emb_path, scl_path = cell.paths(root, version, year)
        src = open_dataset(emb_path)
        src_scales = open_dataset(scl_path)
        src_srs = src.GetSpatialRef().Clone()
        src_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
        to_src = osr.CoordinateTransformation(grid.srs, src_srs)

        # GDAL 3.3 returns the int8 values as uint8: restore the sign
        values = warp_window(src, grid, window).view(np.int8).astype(np.int16)
        write_masked(emb_ds, values, mask, window)
        write_masked(scales_ds, warp_window(src_scales, grid, window), mask, window)
        aligned += 1

        for row, col in samples:
            expected = source_pixel(src, src_scales, to_src, grid, row, col)
            if not same_pixel(output_pixel(emb_ds, scales_ds, row, col), expected):
                errors.append((cell.name, row, col))

    for k, name in enumerate(band_names(year), start=1):
        emb_ds.GetRasterBand(k).SetDescription(name)
    scales_ds.GetRasterBand(1).SetDescription(f"TESSERA_{year}_SCALE")
    scales_ds.GetRasterBand(1).SetNoDataValue(0)
    metadata = {
        "TESSERA_VERSION": version,
        "TESSERA_YEAR": str(year),
        "S2_TILE": tile_id,
        "RESAMPLING": "nearest neighbour, exact reprojection",
        "MOSAIC_RULE": "tile whose 0.1 degree cell contains the pixel centre",
        "NO_DATA": "scale 0 and all dimensions 0",
    }
    emb_ds.SetMetadata(metadata)
    scales_ds.SetMetadata(metadata)
    emb_ds = None
    scales_ds = None

    if assigned != size * size:
        errors.append(("partition", size * size - assigned, "pixels outside every cell"))
    if errors:
        raise RuntimeError(
            f"TESSERA alignment check failed for tile {tile_id}: {len(errors)} error(s), "
            f"first {errors[0]}"
        )
    os.rename(work_embeddings, embeddings_path)
    os.rename(work_scales, scales_path)
    print(
        f"TESSERA {tile_id}: {aligned} cells aligned, {len(missing)} missing, "
        f"{checked} pixels checked, {time.time() - start:.0f} s"
    )
    return embeddings_path, scales_path


def vrt_bands(tile_id: str, year: int, version: str, first_band: int, size: int) -> list:
    """Float32 VRT bands computing int16 value x scale when read (GDAL "mul")."""
    embeddings, scales = output_paths(tile_id, year, version)
    bands = []
    for d, name in enumerate(band_names(year)):
        band = E.VRTRasterBand(
            {
                "dataType": "Float32",
                "band": str(first_band + d),
                "subClass": "VRTDerivedRasterBand",
                "blockXSize": str(BLOCK_SIZE),
                "blockYSize": str(BLOCK_SIZE),
            },
            E.Description(name),
            E.PixelFunctionType("mul"),
            E.SourceTransferType("Float32"),
            source(embeddings, d + 1, "Int16", size),
            source(scales, 1, "Float32", size),
        )
        bands.append(band)
    return bands


def source(filename: str, band: int, data_type: str, size: int):
    return E.SimpleSource(
        E.SourceFilename({"relativeToVRT": "1"}, filename),
        E.SourceBand(str(band)),
        E.SourceProperties(
            {
                "RasterXSize": str(size),
                "RasterYSize": str(size),
                "DataType": data_type,
                "BlockXSize": str(BLOCK_SIZE),
                "BlockYSize": str(BLOCK_SIZE),
            }
        ),
    )

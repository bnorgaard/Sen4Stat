#!/usr/bin/env python3
"""Step 5 checks on a Sen4Stat machine, inside sen4x/crop-map-s4s:0.5.0.

Not part of the product. Uses the modified crop-map-s4s.py and
tessera_features.py, copied in the same directory as this script.

  check    availability check of a site, as done at the start of a job
  prepare  alignment of a window of a S2 tile, in Int16
  vrt      VRT of dequantized bands, random points and expected values
  compare  values read by GDAL 3.3 and by erdy against the expected values
"""
import argparse
import csv
import importlib.util
import os
import sqlite3
import sys
from datetime import date

import numpy as np
from lxml import etree
from lxml.builder import E
from osgeo import gdal, ogr, osr

SRC = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SRC)
import tessera_features as tf  # noqa: E402

TEST_NAME = "TEST"


def load_crop_map():
    spec = importlib.util.spec_from_file_location(
        "crop_map_s4s", os.path.join(SRC, "crop-map-s4s.py")
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


cms = load_crop_map()


def connect(args):
    ns = argparse.Namespace(
        config_file=args.config_file,
        site_id=args.site_id,
        job_id=None,
        date_filter=None,
        stratum_filter=None,
        stratum_start_dates=None,
        stratum_end_dates=None,
    )
    config = cms.Config(ns)
    return config, cms.get_connection(config)


def site_tiles(args):
    config, conn = connect(args)
    with conn:
        tiles = cms.load_tiles(conn, args.site_id, args.tiles)
        strata = cms.get_site_strata(conn, config, tiles)
        if strata:
            tiles = list(set([t for s in strata for t in s.tiles]))
        area = cms.get_site_area(conn, args.site_id)
    return tiles, area


def cmd_check(args):
    tiles, area = site_tiles(args)
    year = args.year or tf.select_year(args.season_start, args.season_end)
    print(
        f"Site {args.site_id}: {len(tiles)} tiles ({' '.join(sorted(t.tile_id for t in tiles))}), "
        f"year {year}, site geometry {'found' if area is not None else 'missing'}"
    )
    message = tf.check_availability(
        [(t.tile_id, t.epsg_code, t.geo_transform[0], t.geo_transform[3]) for t in tiles],
        area,
        args.root,
        args.version,
        year,
        10980,
    )
    print("Result:", message or "embeddings available")


def test_grid(args):
    tiles, _ = site_tiles(args)
    tile = next(t for t in tiles if t.tile_id == args.tiles[0])
    ulx = tile.geo_transform[0] + args.col_offset * tf.PIXEL_SIZE
    uly = tile.geo_transform[3] - args.row_offset * tf.PIXEL_SIZE
    return tile.epsg_code, ulx, uly


def cmd_prepare(args):
    epsg, ulx, uly = test_grid(args)
    print(f"Window of {args.tiles[0]}: EPSG {epsg}, origin ({ulx}, {uly}), {args.size} pixels")
    tf.prepare_tile(
        TEST_NAME, epsg, ulx, uly, args.size, args.root, args.version, args.year, output_dir=args.work
    )


def cmd_vrt(args):
    epsg, ulx, uly = test_grid(args)
    srs = tf.srs_from_epsg(epsg)
    vrt = E.VRTDataset(
        {"rasterXSize": str(args.size), "rasterYSize": str(args.size)},
        E.SRS({"dataAxisToSRSAxisMapping": "1,2"}, srs.ExportToWkt()),
        E.GeoTransform(f"{ulx}, 10, 0.0, {uly}, 0.0, -10"),
        E.BlockXSize("256"),
        E.BlockYSize("256"),
    )
    for band in tf.vrt_bands(TEST_NAME, args.year, args.version, 1, args.size):
        vrt.append(band)
    etree.ElementTree(vrt).write(os.path.join(args.work, "bands_test.vrt"), pretty_print=True, encoding="utf-8")

    # expected values computed with numpy from the Int16 and scale files, not from the VRT
    emb_name, scl_name = tf.output_paths(TEST_NAME, args.year, args.version)
    emb = gdal.Open(os.path.join(args.work, emb_name))
    scl = gdal.Open(os.path.join(args.work, scl_name))
    rng = np.random.RandomState(1)
    rows = rng.randint(0, args.size, args.points)
    cols = rng.randint(0, args.size, args.points)

    driver = ogr.GetDriverByName("GPKG")
    path = os.path.join(args.work, "points_test.gpkg")
    if os.path.exists(path):
        driver.DeleteDataSource(path)
    ds = driver.CreateDataSource(path)
    layer = ds.CreateLayer("output", srs, ogr.wkbPoint)
    layer.CreateField(ogr.FieldDefn("crop_code", ogr.OFTInteger))
    names = tf.band_names(args.year)
    with open(os.path.join(args.work, "expected.csv"), "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["point", "row", "col"] + names)
        for k, (r, c) in enumerate(zip(rows.tolist(), cols.tolist())):
            values = emb.ReadAsArray(c, r, 1, 1)[:, 0, 0].astype(np.float32)
            scale = scl.ReadAsArray(c, r, 1, 1)[0, 0]
            writer.writerow([k, r, c] + [repr(float(v)) for v in values * scale])
            point = ogr.Geometry(ogr.wkbPoint)
            point.AddPoint_2D(ulx + (c + 0.5) * 10, uly - (r + 0.5) * 10)
            feature = ogr.Feature(layer.GetLayerDefn())
            feature.SetField("crop_code", k)
            feature.SetGeometry(point)
            layer.CreateFeature(feature)
    ds = None
    with open(os.path.join(args.work, "fields.txt"), "w") as f:
        f.write(" ".join(n.lower() for n in names))
    print(f"bands_test.vrt, points_test.gpkg ({args.points} points), expected.csv, fields.txt written")
    print(f"Point 0: row {rows[0]}, col {cols[0]}")


def read_expected(work):
    with open(os.path.join(work, "expected.csv")) as f:
        reader = csv.reader(f)
        header = next(reader)
        rows = [r for r in reader]
    names = header[3:]
    return names, {int(r[0]): (int(r[1]), int(r[2]), np.array([float(v) for v in r[3:]], dtype=np.float32)) for r in rows}


def cmd_compare(args):
    names, expected = read_expected(args.work)

    vrt = gdal.Open(os.path.join(args.work, "bands_test.vrt"))
    worst = 0.0
    for k, (r, c, want) in expected.items():
        got = vrt.ReadAsArray(c, r, 1, 1)[:, 0, 0]
        worst = max(worst, float(np.abs(got - want).max()))
    print(f"GDAL {gdal.__version__} on the VRT: {len(expected)} points, max difference {worst:.2e}")

    samples = os.path.join(args.work, "samples_test.sqlite")
    if not os.path.exists(samples):
        print("No erdy output yet")
        return
    db = sqlite3.connect(samples)
    # the samples table is the one with a crop_code column
    tables = [r[0] for r in db.execute("select name from sqlite_master where type = 'table'")]
    table = next(
        t for t in tables if "crop_code" in [c[1].lower() for c in db.execute(f'pragma table_info("{t}")')]
    )
    columns = [n.lower() for n in names]
    rows = db.execute(f"select crop_code, {', '.join(columns)} from {table}").fetchall()
    worst = 0.0
    for row in rows:
        want = expected[int(row[0])][2]
        worst = max(worst, float(np.abs(np.array(row[1:], dtype=np.float32) - want).max()))
    print(f"erdy (table {table}): {len(rows)} of {len(expected)} points, max difference {worst:.2e}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["check", "prepare", "vrt", "compare"])
    parser.add_argument("-c", "--config-file", default="/etc/sen2agri/sen2agri.conf")
    parser.add_argument("-s", "--site-id", type=int, default=91)
    parser.add_argument("--season-start", type=date.fromisoformat, default=date(2024, 1, 1))
    parser.add_argument("--season-end", type=date.fromisoformat, default=date(2024, 12, 31))
    parser.add_argument("--year", type=int, help="force the TESSERA year")
    parser.add_argument("--tiles", nargs="*", help="tile filter")
    parser.add_argument("--root", default=tf.DEFAULT_ROOT)
    parser.add_argument("--version", default=tf.DEFAULT_VERSION)
    parser.add_argument("--size", type=int, default=1500, help="test window size, pixels")
    parser.add_argument("--col-offset", type=int, default=1000)
    parser.add_argument("--row-offset", type=int, default=7500)
    parser.add_argument("--points", type=int, default=200)
    parser.add_argument("--work", default="/w")
    args = parser.parse_args()
    if args.command in ("prepare", "vrt") and not args.year:
        args.year = tf.select_year(args.season_start, args.season_end)
    {"check": cmd_check, "prepare": cmd_prepare, "vrt": cmd_vrt, "compare": cmd_compare}[args.command](args)


if __name__ == "__main__":
    main()

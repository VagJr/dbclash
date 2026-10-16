"""Import ordered 6x6 artwork sheets into the 714-card Nexus collection."""
import argparse
import hashlib
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "cards_image"
MANIFEST_PATH = ROOT / "assets/rework/art-manifest.json"
COLLECTION_SIZE = 714
SOURCE_COLUMNS = 6
SOURCE_MAX_ROWS = 7
GUTTER_THRESHOLD = 0.62


def ordered_sources(folder):
    files = list(folder.glob("*.png"))
    pairs = []
    for path in files:
        match = re.search(r"-(\d+)$", path.stem)
        if not match:
            raise ValueError(f"Nome sem número de ordem: {path.name}")
        pairs.append((int(match.group(1)), path))
    pairs.sort(key=lambda pair: pair[0])
    if [number for number, _ in pairs] != list(range(1, len(pairs) + 1)):
        raise ValueError("As folhas precisam estar numeradas em sequência, começando por -1.")
    if not pairs:
        raise ValueError(f"Nenhum PNG encontrado em {folder}")
    return [path for _, path in pairs]


def gutter_spans(profile, count, dimension, axis, source_name, radius, threshold=GUTTER_THRESHOLD, allow_ideal=False):
    spans = []
    for boundary_number in range(1, count):
        expected = round(dimension * boundary_number / count)
        start = max(0, expected - radius)
        end = min(dimension, expected + radius + 1)
        candidates = []
        run_start = None
        for coordinate in range(start, end):
            if profile[coordinate] >= threshold:
                if run_start is None:
                    run_start = coordinate
            elif run_start is not None:
                candidates.append((run_start, coordinate))
                run_start = None
        if run_start is not None:
            candidates.append((run_start, end))
        if not candidates:
            if allow_ideal:
                spans.append((expected, min(dimension, expected + 1)))
                continue
            raise ValueError(f"Não encontrei o gutter {axis} {boundary_number} em {source_name}.")
        gutter = max(candidates, key=lambda span: (span[1] - span[0], -abs((span[0] + span[1]) / 2 - expected)))
        if gutter[1] - gutter[0] < 1:
            raise ValueError(f"Gutter {axis} muito estreito/ambíguo em {source_name}: {gutter}.")
        if spans and gutter[0] - spans[-1][1] < 90:
            raise ValueError(f"Divisores {axis} repetidos em {source_name}; grade ambígua.")
        spans.append(gutter)
    return spans


def cut_cells(path):
    image = Image.open(path).convert("RGB")
    pixels = np.asarray(image)
    height, width = pixels.shape[:2]
    xprofile = np.maximum((pixels.max(axis=2) < 40).mean(axis=0), (pixels.min(axis=2) > 245).mean(axis=0))
    yprofile = np.maximum((pixels.max(axis=2) < 40).mean(axis=1), (pixels.min(axis=2) > 245).mean(axis=1))
    xgutters = gutter_spans(xprofile, SOURCE_COLUMNS, width, "vertical", path.name, 12, threshold=0.28, allow_ideal=True)
    layouts = []
    for candidate_rows in (6, 7):
        try:
            gutters = gutter_spans(yprofile, candidate_rows, height, "horizontal", path.name, 110)
        except ValueError:
            continue
        layouts.append((sum(gutter[1] - gutter[0] for gutter in gutters), candidate_rows, gutters))
    if not layouts:
        raise ValueError(f"Não encontrei as divisões horizontais da grade em {path.name}.")
    _, rows, ygutters = max(layouts, key=lambda item: item[0])
    columns = SOURCE_COLUMNS
    xedges = [(0, xgutters[0][0])] + [(left[1], right[0]) for left, right in zip(xgutters, xgutters[1:])] + [(xgutters[-1][1], width)]
    yedges = [(0, ygutters[0][0])] + [(top[1], bottom[0]) for top, bottom in zip(ygutters, ygutters[1:])] + [(ygutters[-1][1], height)]
    cells = []
    for row, (y0, y1) in enumerate(yedges):
        for column, (x0, x1) in enumerate(xedges):
            tile = image.crop((x0, y0, x1, y1))
            aspect = tile.width / tile.height
            if not 0.43 <= aspect <= 1.1:
                raise ValueError(f"Corte inesperado em {path.name}, linha {row + 1}, coluna {column + 1}: {tile.size}, razão {aspect:.3f}.")
            cells.append({"image": tile, "rect": [x0, y0, x1, y1], "row": row, "column": column})
    return image.size, cells, xgutters, ygutters, columns, rows


def read_inputs(folder, dry_run):
    sources = ordered_sources(folder)
    ordered_cells = []
    sheets = []
    expected_size = None
    for index, source in enumerate(sources, start=1):
        size, cells, xgutters, ygutters, columns, rows = cut_cells(source)
        if expected_size is None:
            expected_size = size
        if size != expected_size:
            raise ValueError(f"Folhas com tamanhos diferentes: {source.name} é {size}; esperado {expected_size}.")
        sheets.append({"number": index, "path": source, "size": list(size), "columns": columns, "rows": rows,
            "xGutters": [list(x) for x in xgutters], "yGutters": [list(y) for y in ygutters], "cellCount": len(cells)})
        for cell in cells:
            cell.update(source=source, sourceBatch=index, sourceSize=list(size))
            ordered_cells.append(cell)
    if len(ordered_cells) < COLLECTION_SIZE:
        raise ValueError(f"Só há {len(ordered_cells)} posições; a coleção exige {COLLECTION_SIZE}.")
    if len(ordered_cells) - COLLECTION_SIZE >= SOURCE_COLUMNS * SOURCE_MAX_ROWS:
        raise ValueError("As folhas têm posições excedentes demais para presumir descarte final seguro.")
    return sources, ordered_cells[:COLLECTION_SIZE], len(ordered_cells) - COLLECTION_SIZE, sheets


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--dry-run", action="store_true", help="Validate/order/crop the sheets without writing game assets.")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8-sig"))
    cards = manifest.get("cards", [])
    ordered_cards = sorted(cards, key=lambda card: (card["sheet"], card["slot"]))
    if len(ordered_cards) != COLLECTION_SIZE or len({card["id"] for card in ordered_cards}) != COLLECTION_SIZE:
        raise ValueError("O manifesto não tem exatamente 714 IDs únicos.")
    if manifest.get("collectionSize") != COLLECTION_SIZE:
        raise ValueError("Tamanho declarado da coleção incompatível.")

    sources, cells, surplus, source_sheets = read_inputs(args.source_dir, args.dry_run)
    if args.dry_run:
        print(json.dumps({"sourceFiles": len(sources), "sourceGrids": [{"file": item["path"].name, "columns": item["columns"], "rows": item["rows"], "cells": item["cellCount"]} for item in source_sheets], "sourceDimensions": source_sheets[0]["size"],
            "sourceCards": len(cells) + surplus, "assigned": len(cells), "surplusExcluded": surplus,
            "firstMapping": {"card": ordered_cards[0]["id"], "source": cells[0]["source"].name, "cell": [cells[0]["row"], cells[0]["column"]], "rect": cells[0]["rect"]},
            "lastMapping": {"card": ordered_cards[-1]["id"], "source": cells[-1]["source"].name, "cell": [cells[-1]["row"], cells[-1]["column"]], "rect": cells[-1]["rect"]},
            "gutterDetection": "measured dark or white separator bands; native resolution; no upscale"}, ensure_ascii=False, indent=2))
        return

    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archive = ROOT / "assets/rework/import-backups" / f"before-sequence-{now}"
    crops_dir = ROOT / "assets/rework/cards"
    archive.mkdir(parents=True, exist_ok=True)
    (archive / "art-manifest.json").write_bytes(MANIFEST_PATH.read_bytes())
    old_targets = [ROOT / card["cropPath"] for card in ordered_cards]
    for target in old_targets:
        if target.is_file():
            shutil.copy2(target, archive / target.name)
    for sheet in manifest.get("sheets", []):
        atlas_target = ROOT / sheet["path"]
        if atlas_target.is_file():
            shutil.copy2(atlas_target, archive / f"atlas-{atlas_target.name}")

    digest_for = {}
    for card, cell in zip(ordered_cards, cells):
        target = ROOT / card["cropPath"]
        target.parent.mkdir(parents=True, exist_ok=True)
        cell["image"].save(target, format="PNG", optimize=True)
        digest_for[card["id"]] = hashlib.sha256(target.read_bytes()).hexdigest()
        card.update(status="imported-review", nativeWidth=cell["image"].width, nativeHeight=cell["image"].height,
            sha256=digest_for[card["id"]], identityQa="pending", finalQualityApproved=False,
            sourceFile=cell["source"].relative_to(ROOT).as_posix(), sourceBatch=cell["sourceBatch"],
            sourceRow=cell["row"], sourceColumn=cell["column"], sourceRectPx=cell["rect"], sourceDimensions=cell["sourceSize"])

    # Rebuild the canonical 7x7 contact atlases in collection order. Card crops
    # stay at their native resolution; only these convenience atlases are fit down.
    tile_w = min(cell["image"].width for cell in cells)
    tile_h = min(cell["image"].height for cell in cells)
    sheets_manifest = manifest.get("sheets", [])
    for sheet_number, sheet in enumerate(sheets_manifest, start=1):
        slice_start = (sheet_number - 1) * 49
        members = ordered_cards[slice_start:slice_start + 49]
        atlas = Image.new("RGB", (tile_w * 7, tile_h * 7), "#07101c")
        for slot, card in enumerate(members):
            thumb = (ROOT / card["cropPath"]).open("rb")
            with Image.open(thumb) as image:
                image = image.convert("RGB")
                image.thumbnail((tile_w, tile_h), Image.Resampling.LANCZOS)
                x = (slot % 7) * tile_w + (tile_w - image.width) // 2
                y = (slot // 7) * tile_h + (tile_h - image.height) // 2
                atlas.paste(image, (x, y))
        atlas_path = ROOT / sheet["path"]
        atlas_path.parent.mkdir(parents=True, exist_ok=True)
        atlas.save(atlas_path, format="PNG", optimize=True)
        sheet.update(status="imported-review", columns=7, rows=7, occupiedSlots=len(members), emptySlots=list(range(len(members), 49)),
            sourceSheets=sorted({cell["sourceBatch"] for cell in cells[slice_start:slice_start + len(members)]}),
            width=atlas.width, height=atlas.height, cellWidth=tile_w, cellHeight=tile_h,
            identityQa="pending", finalQualityApproved=False)

    manifest["productionStatus"] = "imported-art-review"
    manifest["sourceImport"] = {"sourceDirectory": args.source_dir.relative_to(ROOT).as_posix(), "sourceOrdering": "numeric filename suffix, then row-major",
        "sourceFiles": [path.relative_to(ROOT).as_posix() for path in sources], "sourceCount": len(sources),
        "sourceGrids": [{"file": sheet["path"].relative_to(ROOT).as_posix(), "columns": sheet["columns"], "rows": sheet["rows"], "cells": sheet["cellCount"], "xGutters": sheet["xGutters"], "yGutters": sheet["yGutters"]} for sheet in source_sheets],
        "sourceDimensions": source_sheets[0]["size"], "sourceCards": COLLECTION_SIZE + surplus,
        "assignedCards": COLLECTION_SIZE, "surplusExcluded": surplus, "cropMethod": "detected dark/white gutters; native-resolution crop; no upscale",
        "importedAt": datetime.now(timezone.utc).isoformat(), "visualIdentityQa": "pending"}
    manifest["qualityNote"] = (f"714 collection cards imported sequentially from {len(sources)} supplied 6-column sheets with 6 or 7 rows. "
        f"Dark and light gutters were measured and removed for precise native-resolution crops; no upscaling. "
        f"{surplus} surplus cells were excluded. Per-card identity, anatomy, exact scene match and definition review remains pending.")
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Imported {COLLECTION_SIZE} ordered card crops from {len(sources)} 6-column sheets; excluded {surplus} surplus cells.")
    print(f"Native crop size range: {min(cell['image'].width for cell in cells)}-{max(cell['image'].width for cell in cells)} × {min(cell['image'].height for cell in cells)}-{max(cell['image'].height for cell in cells)} px; no upscaling.")
    print(f"Prior crops, atlases and manifest preserved in {archive.relative_to(ROOT).as_posix()}.")


if __name__ == "__main__":
    main()

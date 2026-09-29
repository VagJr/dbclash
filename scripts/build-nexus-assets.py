"""Crop generated atlases without upscaling. Retain source files and truthful QA status."""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'rework'

def crop_ui():
    source = OUT / 'nexus-ui.png'
    image = Image.open(source).convert('RGBA')
    names = ['primary-button', 'secondary-button', 'panel-cyan', 'panel-orange',
             'hud-left', 'hud-right', 'card-frame-orange', 'card-frame-cyan',
             'booster', 'portal', 'header', 'footer']
    folder = OUT / 'ui'
    folder.mkdir(exist_ok=True)
    records = []
    for index, name in enumerate(names):
        col, row = index % 4, index // 4
        box = (round(col * image.width / 4), round(row * image.height / 3),
               round((col + 1) * image.width / 4), round((row + 1) * image.height / 3))
        cell = image.crop(box)
        bounds = cell.getchannel('A').getbbox()
        if bounds:
            cell = cell.crop(bounds)
        target = folder / f'{name}.png'
        cell.save(target)
        records.append({'name': name, 'path': target.relative_to(ROOT).as_posix(),
                        'width': cell.width, 'height': cell.height, 'alpha': True})
    (OUT / 'ui-manifest.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'UI: {len(records)} components cropped with alpha preserved.')

def crop_sheet(number, columns, rows, source_path=None):
    source = OUT / f'source-sheet-{number:02d}.png'
    if source_path:
        incoming = Path(source_path).resolve()
        if incoming != source.resolve():
            if source.exists():
                backup = OUT / f'source-sheet-{number:02d}-{hashlib.sha256(source.read_bytes()).hexdigest()[:12]}.png'
                if not backup.exists():
                    shutil.copy2(source, backup)
            shutil.copy2(incoming, source)
    if not source.is_file():
        raise SystemExit(f'Missing original generated sheet: {source}')
    image = Image.open(source).convert('RGB')
    manifest_path = OUT / 'art-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8-sig'))
    sheet = next(item for item in manifest['sheets'] if item['number'] == number)
    cells = [item for item in manifest['cards'] if item['sheet'] == number]
    folder = OUT / 'cards'
    folder.mkdir(exist_ok=True)
    expected_cols = manifest['layout']['columns']
    expected_rows = manifest['layout']['rows']
    # Source is always retained. Extra cells require an explicit source layout;
    # never interpret old 12x12 drafts as the new 7x7 collection geometry.
    native_w, native_h = image.width // columns, image.height // rows
    cell_w = native_w
    cell_h = native_h
    atlas = Image.new('RGB', (cell_w * expected_cols, cell_h * expected_rows), '#07101c')
    for item in cells:
        col, row = item['column'], item['row']
        x0, y0 = round(col * image.width / columns), round(row * image.height / rows)
        x1, y1 = round((col + 1) * image.width / columns), round((row + 1) * image.height / rows)
        # Fit by scaling down only. Preserve the entire scene/head; no center crop.
        scene = image.crop((x0, y0, x1, y1))
        scene.thumbnail((cell_w, cell_h), Image.Resampling.LANCZOS)
        cell = Image.new('RGB', (cell_w, cell_h), '#07101c')
        cell.paste(scene, ((cell_w - scene.width) // 2, (cell_h - scene.height) // 2))
        target = ROOT / item['cropPath']
        cell.save(target)
        atlas.paste(cell, (col * cell_w, row * cell_h))
        item.update(status='imported-review', nativeWidth=cell_w, nativeHeight=cell_h,
                    sha256=hashlib.sha256(target.read_bytes()).hexdigest(), identityQa='pending')
    atlas.save(ROOT / sheet['path'])
    sheet.update(status='imported-review', sourcePath=source.relative_to(ROOT).as_posix(),
                 sourceWidth=image.width, sourceHeight=image.height,
                 sourceColumns=columns, sourceRows=rows, width=atlas.width, height=atlas.height,
                 cellWidth=cell_w, cellHeight=cell_h, gridNormalized=(columns != expected_cols or rows != expected_rows),
                 identityQa='pending', finalQualityApproved=False)
    manifest['productionStatus'] = 'imported-art-review'
    manifest['qualityNote'] = ('Native crop dimensions recorded for every sheet. No upscaling or face cropping. '
                              'Imported character identity, action, anatomy, framing and definition require per-card QA '
                              'before finalQualityApproved can become true.')
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Sheet {number}: {len(cells)} crops; source {image.size} / {columns}x{rows}; '
          f'output {atlas.size}; cell {cell_w}x{cell_h}; identity QA pending.')

parser = argparse.ArgumentParser()
parser.add_argument('--ui', action='store_true')
parser.add_argument('--sheet', type=int, choices=range(1, 16))
parser.add_argument('--columns', type=int, default=7)
parser.add_argument('--rows', type=int, default=7)
parser.add_argument('--source', help='Path of a supplied 7x7 image. The original is retained and prior sources backed up.')
args = parser.parse_args()
if args.ui:
    crop_ui()
if args.sheet:
    if args.columns < 7 or args.rows < 7:
        raise SystemExit('An undersized generated grid cannot cover a 7x7 sheet. Regenerate the source.')
    crop_sheet(args.sheet, args.columns, args.rows, args.source)

"""Import individually named high-resolution art into the 714-card collection."""
import argparse
import hashlib
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "cards_image_hq"
MANIFEST_PATH = ROOT / "assets/rework/art-manifest.json"
COLLECTION_SIZE = 714
SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
PREVIEW_TILE = (280, 392)


def ordered_cards(manifest):
    cards = sorted(manifest.get("cards", []), key=lambda card: (card["sheet"], card["slot"]))
    ids = [card["id"] for card in cards]
    if len(cards) != COLLECTION_SIZE or len(set(ids)) != COLLECTION_SIZE:
        raise ValueError("O manifesto precisa conter exatamente 714 IDs únicos.")
    if manifest.get("collectionSize") != COLLECTION_SIZE:
        raise ValueError("Tamanho declarado da coleção incompatível.")
    return cards


def find_artwork(folder, cards, min_width, min_height):
    if not folder.is_dir():
        raise ValueError(f"A pasta de entrada não existe: {folder}")
    by_id = {}
    unknown = []
    for path in folder.iterdir():
        if not path.is_file() or path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        if path.stem not in {card["id"] for card in cards}:
            unknown.append(path.name)
            continue
        if path.stem in by_id:
            raise ValueError(f"Mais de um arquivo para o ID {path.stem}: {by_id[path.stem].name}, {path.name}")
        by_id[path.stem] = path

    ids = {card["id"] for card in cards}
    missing = sorted(ids - set(by_id))
    invalid = []
    dimensions = []
    for card in cards:
        path = by_id.get(card["id"])
        if path is None:
            continue
        try:
            with Image.open(path) as image:
                image.verify()
            with Image.open(path) as image:
                width, height = image.size
                if width < min_width or height < min_height:
                    invalid.append({"file": path.name, "reason": f"{width}x{height}, mínimo {min_width}x{min_height}"})
                if not 0.43 <= width / height <= 1.1:
                    invalid.append({"file": path.name, "reason": f"proporção {width / height:.3f} fora de 0.43–1.1"})
                dimensions.append((width, height))
        except Exception as error:
            invalid.append({"file": path.name, "reason": f"imagem inválida: {error}"})
    return by_id, missing, sorted(unknown), invalid, dimensions


def rebuild_preview_atlases(manifest, cards):
    for sheet in manifest.get("sheets", []):
        start = (sheet["number"] - 1) * 49
        members = cards[start:start + 49]
        atlas = Image.new("RGB", (PREVIEW_TILE[0] * 7, PREVIEW_TILE[1] * 7), "#07101c")
        for slot, card in enumerate(members):
            with Image.open(ROOT / card["cropPath"]) as source:
                image = source.convert("RGB")
                image.thumbnail(PREVIEW_TILE, Image.Resampling.LANCZOS)
                x = (slot % 7) * PREVIEW_TILE[0] + (PREVIEW_TILE[0] - image.width) // 2
                y = (slot // 7) * PREVIEW_TILE[1] + (PREVIEW_TILE[1] - image.height) // 2
                atlas.paste(image, (x, y))
        path = ROOT / sheet["path"]
        path.parent.mkdir(parents=True, exist_ok=True)
        atlas.save(path, format="PNG", optimize=True)
        sheet.pop("sourceSheets", None)
        sheet.update(status="imported-review", columns=7, rows=7, occupiedSlots=len(members),
            emptySlots=list(range(len(members), 49)), width=atlas.width, height=atlas.height,
            cellWidth=PREVIEW_TILE[0], cellHeight=PREVIEW_TILE[1], identityQa="pending", finalQualityApproved=False)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--min-width", type=int, default=700)
    parser.add_argument("--min-height", type=int, default=1000)
    parser.add_argument("--dry-run", action="store_true", help="Confere IDs, formatos e resolução sem gravar artes.")
    args = parser.parse_args()

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8-sig"))
    cards = ordered_cards(manifest)
    by_id, missing, unknown, invalid, dimensions = find_artwork(args.source_dir, cards, args.min_width, args.min_height)
    report = {"sourceDirectory": str(args.source_dir), "collectionCards": len(cards), "found": len(by_id),
        "missing": len(missing), "unknownFiles": unknown, "invalid": invalid,
        "minimumPixels": [args.min_width, args.min_height],
        "sourceWidthRange": [min((size[0] for size in dimensions), default=0), max((size[0] for size in dimensions), default=0)],
        "sourceHeightRange": [min((size[1] for size in dimensions), default=0), max((size[1] for size in dimensions), default=0)],
        "firstId": cards[0]["id"], "lastId": cards[-1]["id"], "dryRun": args.dry_run,
        "readyToImport": not missing and not unknown and not invalid, "upscalePerformed": False}
    if args.dry_run:
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return
    if not report["readyToImport"]:
        print("Importacao cancelada: este comando so injeta imagens ja geradas; ele nao cria nem amplia artes.")
        if not by_id:
            print(f"Nenhuma imagem valida foi encontrada em {args.source_dir}. Adicione as 714 artes com os nomes de ID listados no CSV antes de importar.")
        else:
            print(json.dumps({"missingSample": missing[:12], "missingCount": len(missing), "unknownFiles": unknown, "invalid": invalid[:20]}, ensure_ascii=True, indent=2))
        raise SystemExit(2)

    now = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    archive = ROOT / "assets/rework/import-backups" / f"before-hq-{now}"
    archive.mkdir(parents=True, exist_ok=True)
    (archive / "art-manifest.json").write_bytes(MANIFEST_PATH.read_bytes())
    for card in cards:
        target = ROOT / card["cropPath"]
        if target.is_file():
            shutil.copy2(target, archive / target.name)
    for sheet in manifest.get("sheets", []):
        target = ROOT / sheet["path"]
        if target.is_file():
            shutil.copy2(target, archive / f"atlas-{target.name}")

    prior_import = manifest.get("sourceImport")
    for card in cards:
        source_path = by_id[card["id"]]
        target = ROOT / card["cropPath"]
        target.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source_path) as source:
            image = source.convert("RGBA" if "A" in source.getbands() else "RGB")
            image.save(target, format="PNG", optimize=True)
            width, height = image.size
        card.update(status="imported-review", nativeWidth=width, nativeHeight=height,
            sha256=hashlib.sha256(target.read_bytes()).hexdigest(), identityQa="pending", finalQualityApproved=False,
            sourceFile=source_path.relative_to(ROOT).as_posix(), sourceDimensions=[width, height],
            sourceFormat=source_path.suffix.lower(), upscaleApplied=False)

    rebuild_preview_atlases(manifest, cards)
    manifest["productionStatus"] = "imported-hq-art-review"
    manifest["sourceImport"] = {"mode": "individual-images-keyed-by-card-id", "sourceDirectory": args.source_dir.relative_to(ROOT).as_posix(),
        "sourceCount": len(cards), "assignedCards": len(cards), "minimumPixels": [args.min_width, args.min_height],
        "sourceWidthRange": report["sourceWidthRange"], "sourceHeightRange": report["sourceHeightRange"],
        "sourceOrdering": "manifest card ID; no positional sequence ambiguity", "cropMethod": "full-frame image preserved at native resolution; no crop or upscale",
        "importedAt": datetime.now(timezone.utc).isoformat(), "visualIdentityQa": "pending", "previousImport": prior_import}
    manifest["qualityNote"] = (f"{COLLECTION_SIZE} individual high-resolution illustrations imported by stable card ID at native resolution, without crop or upscale. "
        "Per-card identity, anatomy, exact scene match and definition review remains pending.")
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Imported {len(cards)} high-resolution illustrations by card ID; no crop or upscale.")
    print(f"Native source dimensions: width {report['sourceWidthRange'][0]}-{report['sourceWidthRange'][1]} px, height {report['sourceHeightRange'][0]}-{report['sourceHeightRange'][1]} px.")
    print(f"Previous crops, preview atlases and manifest preserved in {archive.relative_to(ROOT).as_posix()}.")


if __name__ == "__main__":
    main()

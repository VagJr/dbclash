import fs from 'node:fs';
import path from 'node:path';
import { CARD_DATABASE } from '../js/card-database.js';
import { ATLAS_COLUMNS, ATLAS_ROWS, ATLAS_CAPACITY, COLLECTION_SIZE, collectionSummary } from '../js/collection-nexus.js';
import { getCardRule } from '../js/content-rules.js';

const output = path.resolve('assets/rework');
fs.mkdirSync(output, { recursive: true });
const manifestPath = path.join(output, 'art-manifest.json');
const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const layoutChanged = previous.layout?.columns !== ATLAS_COLUMNS || previous.layout?.rows !== ATLAS_ROWS;
const previousCards = new Map((previous.cards || []).map(card => [card.id, card]));
const archiveName = `art-manifest.${previous.layout?.columns || 'unknown'}x${previous.layout?.rows || 'unknown'}-concept-source.json`;
if (layoutChanged && previous.cards?.length) {
  fs.writeFileSync(path.join(output, archiveName), JSON.stringify({ ...previous, productionStatus: 'legacy-concept-source', finalQualityApproved: false }, null, 2) + '\n');
}

// Canonical moves need recognizable, mechanically correct staging rather than a generic blast.
const legacyScenes = {
  atk_01: 'Goku chaining a fast punch and knee strike at close range, orange motion trails',
  atk_02: 'Goku firing the Kamehameha: hands cupped together at the hip then palms extended, bright blue beam',
  atk_03: 'Vegeta firing Final Flash with both arms extended and palms spread, brilliant yellow beam',
  atk_04: 'Goku delivering a forceful Dragon Fist punch, golden dragon-shaped ki following the fist',
  atk_05: 'Piccolo holding two fingers toward the target, firing a narrow spiral Special Beam Cannon',
  atk_06: 'Future Trunks cutting with his real steel sword, lavender hair, focused two-handed sword stance',
  atk_07: 'Frieza pointing one fingertip and firing a very thin purple Death Beam',
  atk_08: 'Vegeta charging Galick Gun at his side, firing a broad violet beam from both palms',
  atk_09: 'Gohan placing open hands above the forehead and firing the golden Masenko beam',
  atk_10: 'Future Trunks completing the characteristic fast Burning Attack hand motions, golden energy sphere in front of both palms',
  atk_11: 'Frieza balancing a huge orange Supernova sphere above one raised finger',
  atk_12: 'Piccolo directing many separate floating ki grenades around the enemy, fingers extended, no single straight beam',
  atk_13: 'Vegeta standing side-on with one palm extended, launching the spherical blue Big Bang Attack',
  atk_14: 'Goku in black-haired base form making a hard physical punch surrounded by a scarlet Kaioken aura',
  atk_15: 'Kuririn holding a flat spinning golden Kienzan energy disc above one palm',
  atk_16: 'young SSJ2 Gohan with golden upright hair firing a blue Kamehameha, faint supportive spirit silhouette of Goku behind him',
  atk_17: 'Piccolo gathering a compact golden Light Grenade between both hands in front of his chest',
  atk_18: 'Frieza forming a dark violet Death Ball overhead, black sparks around the energy sphere',
  atk_19: 'Vegeta launching an intense emerald Final Shine energy beam from one extended palm',
  atk_20: 'Goku delivering a rapid sequence of physical kicks, multiple leg motion afterimages',
  atk_21: 'Future Trunks performing a high-speed close-range fist and elbow combination',
  atk_22: 'Piccolo spreading both hands to release many small ki bolts at different angles',
  atk_23: 'Future Trunks holding the enormous glowing Sword of Hope with both hands, steel sword inside a blue-gold ki blade',
  atk_24: 'Golden Frieza with metallic gold skin and purple accents firing a pinpoint golden-purple finger beam',
  atk_25: 'Super Saiyan Blue Goku with cyan upright hair firing a powerful blue Kamehameha',
  atk_26: 'Vegeta closing one hand after a targeted ki detonation, an orange airborne explosion behind the hand',
  atk_27: 'Goku with both arms raised, a vast blue-white Spirit Bomb sphere suspended overhead',
  atk_28: 'Goku lunging forward with a physical shoulder-and-fist rush, fierce orange aura',
  def_01: 'Goku bracing behind a curved transparent blue ki shield, incoming attack stopped outside the barrier',
  def_02: 'Gohan surrounding himself with a compact blue ki barrier, absorbed light feeding his aura',
  def_03: 'Android 17 holding a hand open inside his distinctive green spherical barrier',
  def_04: 'Beerus calmly blocking behind a violet divine energy wall, no offensive blast',
  def_05: 'Piccolo healing a visible scratch while maintaining a soft emerald protective dome',
  def_06: 'Vegeta taking a planted royal guard stance, crossing forearms behind a bright blue shield',
  def_07: 'Goku deflecting an incoming blast sideways with both forearms, defensive impact sparks',
  def_08: 'Vegeta holding an iron guard with crossed arms, feet planted, no energy attack',
  def_09: 'Android 16 sheltering behind a heavy translucent green ki wall, broad armored silhouette',
  def_10: 'Frieza calmly enclosing himself in a violet protective force field that draws in enemy energy',
  def_11: 'Gohan projecting a broad blue energy dome over his own position',
  def_12: 'Future Trunks blocking a physical strike with the flat of his real steel sword, crossed defensive pose',
  def_13: 'Goku repelling an incoming ki bolt outward with a defensive aura pulse',
  def_14: 'Piccolo creating a gentle green healing barrier, protected posture, no attacking beam',
  def_15: 'Super Saiyan Goku with golden upright hair bracing behind a golden ki wall',
  evd_01: 'Goku disappearing in a sharp high-speed Z-Vanish afterimage while an incoming strike misses',
  evd_02: 'Kuririn leaving several fading physical afterimages to dodge a punch, no blast',
  evd_03: 'Goku touching two fingers to his forehead in the Instant Transmission pose and disappearing',
  evd_04: 'Future Trunks making a clean lateral sidestep, steel sword sheathed, incoming strike missing',
  evd_05: 'Hit slipping aside through subtle purple speed afterimages, calm assassin posture',
  evd_06: 'Ultra Instinct Goku with silver hair and silver eyes effortlessly leaning away from a strike, pale silver aura',
  evd_07: 'Future Trunks moving too quickly to strike, several fading blue afterimages',
  evd_08: 'Gohan using a sudden aura-assisted evasive step while gathering a small ki glow, no attack',
  evd_09: 'Whis making a graceful evasive step with his staff and pale blue motion traces, no fantasy armor',
  ctr_01: 'Tenshinhan performing Solar Flare, fingers spread beside the eyes, blinding white light halting an enemy',
  ctr_02: 'Vegeta releasing an outward explosive ki wave just as an incoming attack reaches him',
  ctr_03: 'Hit stopping an attacker during Time Skip, violet frozen-motion fragments and a precise counterpunch',
  ctr_04: 'Goku redirecting an incoming ki beam with one open palm, enemy beam bending away',
  ctr_05: 'Captain Ginyu, purple skin and black-white horns, shouting Body Change as a narrow exchange beam leaves his mouth',
  ctr_06: 'Future Trunks countering an incoming strike with a short blue shockwave from his free hand',
  ctr_07: 'Goku returning a powerful close-range counterstrike with a golden dragon-shaped ki silhouette',
  ctr_08: 'Frieza using one finger to interrupt a close-range physical attacker, sharp purple counter-impact',
  ctr_09: 'Gohan answering an incoming attack with a compact golden ki counterblast',
  tch_01: 'Goku powering up in Kaioken, scarlet aura, visibly strained muscles, no outgoing attack',
  tch_02: 'Kuririn eating a small green Senzu Bean from his hand, wounds fading and strength restored, no projectile',
  tch_03: 'Goku raising both open hands to gather energy from the surroundings into a Spirit Bomb overhead',
  tch_04: 'Vegeta gathering royal golden-blue ki around clenched fists before his next attack, no fired beam',
  tch_05: 'Gohan awakening hidden potential, calm upright pose and bright white aura, no weapon',
  tch_06: 'Frieza transforming into Golden Frieza, metallic gold body with purple accents and radiant power-up aura',
  tch_07: 'Piccolo healing his own injuries with Namekian regeneration, soft emerald light, calm hands near the chest',
  tch_08: 'Future Trunks practicing stance and controlled breathing inside the bright white Hyperbolic Time Chamber, no attack',
  tch_09: 'Goku recovering strength and gathering ki during an awakening power-up, amber aura, no outgoing blast'
};

function visualRuleSummary(card) {
  const rule = getCardRule(card);
  const cues = [];
  if (card.type === 'attack') cues.push(card.isBeam ? 'beam attack' : card.damageKind === 'ki' || !card.isCombo ? 'ki or impact attack' : 'physical combo');
  if (card.type === 'defense') cues.push('defensive shield, not an outgoing attack');
  if (card.type === 'evade') cues.push('evasion or afterimages, not a weapon or blast');
  if (card.type === 'counter') cues.push('intercept and retaliate against an incoming attack');
  if (rule.heal) cues.push(`heal ${rule.heal} HP with recovery imagery`);
  if (rule.kiGain) cues.push(`gather ${rule.kiGain} Ki`);
  if (rule.nextAttackBonus) cues.push('store energy for the next strike, not fire it now');
  if (rule.selfDamage) cues.push('power-up with visible strain and cost');
  if (rule.physicalOnly) cues.push('incoming physical strike');
  if (rule.beamOnly) cues.push('incoming energy beam');
  if (rule.reflect) cues.push('reflect incoming energy');
  if (rule.stealKi || rule.drainKi) cues.push('draw away enemy ki');
  if (rule.draw) cues.push('tactical awareness, no literal paper cards or symbols');
  return cues.join('; ');
}

const cards = CARD_DATABASE.map(card => {
  const earlier = previousCards.get(card.id);
  const retained = !layoutChanged ? (earlier || {}) : {};
  const scene = legacyScenes[card.id] || card.artPrompt.replace(/; portrait action illustration.*$/, '');
  return {
    ...retained,
    id: card.id, number: card.setNumber, name: card.name, character: card.character,
    type: card.type, archetypes: card.archetypes,
    artPrompt: `${scene}; card action ${card.nameEn || card.name}; ${visualRuleSummary(card)}; anatomically correct Dragon Ball anime character, precise recognizable costume, clean ink and cel shading`,
    sheet: card.art.sheet, row: card.art.row, column: card.art.column, slot: card.art.slot,
    columns: ATLAS_COLUMNS, rows: ATLAS_ROWS,
    sheetPath: card.art.sheetPath, cropPath: card.art.cropPath, fallbackPath: card.art.fallbackPath,
    status: layoutChanged ? 'pending' : earlier?.status || 'pending',
    ...(layoutChanged && earlier?.status === 'generated-concept' ? { legacyConceptCrop: { manifestPath: `assets/rework/${archiveName}`, cropPath: earlier.cropPath, status: 'legacy-concept-source' } } : {}),
    identityQa: layoutChanged ? 'pending' : retained.identityQa || 'pending',
    finalQualityApproved: false,
    provenance: 'custom-generated-fan-art', officialLicensed: false
  };
});
const sheetCount = Math.ceil(COLLECTION_SIZE / ATLAS_CAPACITY);
const requestedCellWidth = 700;
const requestedCellHeight = 980;
const sheets = Array.from({ length: sheetCount }, (_, index) => {
  const priorSheet = !layoutChanged ? (previous.sheets || []).find(sheet => sheet.number === index + 1) || {} : {};
  const occupiedSlots = Math.min(ATLAS_CAPACITY, COLLECTION_SIZE - index * ATLAS_CAPACITY);
  return { ...priorSheet, number: index + 1, path: `assets/rework/sheet-${String(index + 1).padStart(2, '0')}.png`,
    columns: ATLAS_COLUMNS, rows: ATLAS_ROWS,
    status: layoutChanged ? 'pending' : priorSheet.status || 'pending', occupiedSlots,
    emptySlots: Array.from({ length: ATLAS_CAPACITY - occupiedSlots }, (_, slot) => occupiedSlots + slot),
    identityQa: layoutChanged ? 'pending' : priorSheet.identityQa || 'pending', finalQualityApproved: false };
});
const manifest = {
  ...(!layoutChanged ? previous : {}),
  schema: 'dbclash-art-atlas-v2', collectionSize: COLLECTION_SIZE,
  layout: { columns: ATLAS_COLUMNS, rows: ATLAS_ROWS, cellAspectRatio: '5:7', order: 'row-major', requestedCellWidth, requestedCellHeight,
    requestedSheetWidth: ATLAS_COLUMNS * requestedCellWidth, requestedSheetHeight: ATLAS_ROWS * requestedCellHeight },
  productionStatus: layoutChanged ? 'regeneration-required-7x7' : previous.productionStatus || 'concept-production',
  qualityNote: 'New 7x7 production targets larger cells with correct Dragon Ball anime anatomy, costume, character and action. Native dimensions and per-card identity/pose/mechanics QA must be recorded. Old 12x12 source images and crops are legacy concepts only and do not satisfy this layout or final quality. Upscaling does not create definition; no card is quality approved.',
  rightsNote: previous.rightsNote || 'Custom generated fan art for this project, not official licensed Dragon Ball artwork.',
  summary: collectionSummary(CARD_DATABASE),
  legacyConceptSources: [...(previous.legacyConceptSources || []), ...(layoutChanged && previous.cards?.length ? [{ manifestPath: `assets/rework/${archiveName}`, layout: previous.layout, status: 'legacy-concept-source', finalQualityApproved: false }] : [])],
  sheets, cards
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
for (let sheet = 1; sheet <= sheetCount; sheet++) {
  const entries = cards.filter(card => card.sheet === sheet);
  const empty = sheets[sheet - 1].emptySlots;
  const lines = [
    `Dragon Clash Nexus illustration atlas ${sheet}/${sheetCount}. EXACTLY ${ATLAS_COLUMNS} columns x ${ATLAS_ROWS} rows: 49 uniform portrait cells, row-major order. Requested canvas 4900x6860, each cell 700x980. Grid alignment and 49 discrete images are mandatory.`,
    'Premium Dragon Ball anime drawing: recognizable canonical faces, correct hair shape and color, accurate clothing, proportional bodies, hands with five fingers, clear martial arts poses, clean confident black ink contours, controlled two-tone cel shading, detailed but readable backgrounds and luminous ki effects. Prioritize correct character identity and the named action over elaborate scenery. No fantasy armor, generic monsters, comic lettering or realism.',
    'No text, numbers, labels, watermarks, logos, card frames, typography or UI anywhere. Each cell is one separate complete illustration; no body or energy effect crosses a cell boundary. Keep 3% safe margins inside each cell and narrow charcoal gutters. All 7 columns and 7 rows have equal dimensions. Do not add extra rows or columns.',
    'The assignments below describe references; their names and coordinates must not appear as visible lettering. Healing cards show healing; evasion shows movement; defensive cards block; energy attacks use the exact named hand pose where specified. No offensive blast on a recovery or training card.',
    ...entries.map(card => `R${card.row + 1}C${card.column + 1}: ${card.artPrompt}.`),
    ...(empty.length ? [`Empty cells ${empty.map(slot => `R${Math.floor(slot / ATLAS_COLUMNS) + 1}C${slot % ATLAS_COLUMNS + 1}`).join(', ')}: plain dark charcoal, exactly ${empty.length} deliberate unused cells. No character, scenery or lettering.`] : []),
    'Output only the perfectly aligned 7x7 illustration sheet. All 49 positions remain present even on the final sheet with empty cells.'
  ];
  fs.writeFileSync(path.join(output, `art-prompts-sheet-${String(sheet).padStart(2, '0')}.txt`), lines.join('\n') + '\n');
}
console.log(JSON.stringify({ ...manifest.summary, layoutChanged, requestedCellWidth, requestedCellHeight }));

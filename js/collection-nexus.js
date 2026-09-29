/* Dragon Clash: Nexus collection. Deterministic gameplay data, not generated illustrations. */
export const COLLECTION_SIZE = 714;
export const LEGACY_COLLECTION_SIZE = 70;
export const ATLAS_COLUMNS = 7;
export const ATLAS_ROWS = 7;
export const ATLAS_CAPACITY = ATLAS_COLUMNS * ATLAS_ROWS;
export const NEXUS_SET = Object.freeze({ id: 'NXS', name: 'Nexus: Ecos da Simulação', size: COLLECTION_SIZE, version: 1 });

export const NEXUS_ROSTER = Object.freeze([
  ['goku', 'Son Goku', 'aggro', 'orange gi, black spiky hair', 'ruined tournament arena'],
  ['vegeta', 'Vegeta', 'aggro', 'blue suit, white armor, upright black hair', 'fractured royal observatory'],
  ['gohan', 'Son Gohan', 'control', 'purple gi, short black hair', 'violet time chamber'],
  ['piccolo', 'Piccolo', 'healing', 'green Namekian, purple gi, white cape', 'emerald Namek landscape'],
  ['trunks', 'Trunks do Futuro', 'combo', 'lavender hair, blue jacket, sword', 'rainy future city'],
  ['frieza', 'Frieza', 'control', 'white and purple alien emperor', 'crimson orbital fortress'],
  ['cell', 'Cell', 'control', 'green spotted bio-android, black crown', 'bio-digital laboratory'],
  ['buu', 'Majin Buu', 'healing', 'pink magical fighter, white trousers', 'pink nebula sanctuary'],
  ['broly', 'Broly', 'aggro', 'muscular Saiyan, green aura, black hair', 'shattered volcanic plateau'],
  ['bardock', 'Bardock', 'combo', 'black hair, red headband, Saiyan armor', 'scarlet planetary battlefield'],
  ['goten', 'Son Goten', 'combo', 'young boy, black spiky hair, orange gi', 'sunlit training valley'],
  ['krillin', 'Kuririn', 'defense', 'bald martial artist, six forehead dots, orange gi', 'ocean island dojo'],
  ['tien', 'Tenshinhan', 'defense', 'bald martial artist, third eye, green sash', 'mountaintop dojo'],
  ['yamcha', 'Yamcha', 'combo', 'long black hair, cheek scars, orange gi', 'desert canyon'],
  ['android17', 'Androide 17', 'defense', 'straight black hair, green shirt, orange scarf', 'forest reserve'],
  ['android18', 'Androide 18', 'control', 'blonde bob haircut, blue denim vest', 'neon city overpass'],
  ['android16', 'Androide 16', 'defense', 'tall android, orange mohawk, green armor', 'wildflower digital meadow'],
  ['beerus', 'Bills', 'control', 'purple feline deity, Egyptian blue gold clothes', 'floating divine temple'],
  ['whis', 'Whis', 'healing', 'pale blue angel, white hair, staff, neck halo', 'celestial garden'],
  ['hit', 'Hit', 'control', 'purple assassin, long segmented coat', 'frozen time corridor'],
  ['jiren', 'Jiren', 'defense', 'muscular gray alien, red black uniform', 'cosmic tournament void'],
  ['kefla', 'Kefla', 'aggro', 'female Saiyan fusion, black spiky hair, magenta top', 'green lightning arena'],
  ['gogeta', 'Gogeta', 'beam', 'fusion Saiyan, black orange vest, white trousers', 'prismatic fusion dimension'],
  ['vegito', 'Vegetto', 'beam', 'fusion Saiyan, blue orange gi, Potara earrings', 'golden energy skyline'],
  ['gokublack', 'Goku Black', 'control', 'black gray gi, pink energy blade', 'corrupted future skyline'],
  ['zamasu', 'Zamasu', 'healing', 'green Kai, white hair, purple dark robes', 'broken divine garden'],
  ['cabba', 'Cabba', 'combo', 'slender Saiyan, black hair, blue yellow armor', 'Planet Sadala citadel'],
  ['mai', 'Mai do Futuro', 'defense', 'black hair, dark military coat, resistance fighter', 'underground resistance shelter']
].map(([id, name, archetype, appearance, setting]) => Object.freeze({ id, name, archetype, appearance, setting })));

const RECIPES = Object.freeze([
  { id: 'pulse', namePt: 'Pulso de Combate', nameEn: 'Combat Pulse', type: 'attack', cost: 1, power: 16, damageKind: 'physical', combo: true, archetype: 'combo', scene: 'rapid close-range martial arts sequence, orange speed trails', rules: () => ({ retainInitiative: true }) },
  { id: 'fracture', namePt: 'Ruptura de Guarda', nameEn: 'Guard Fracture', type: 'attack', cost: 2, power: 25, damageKind: 'physical', archetype: 'aggro', scene: 'impacting a translucent energy shield with a focused fist', rules: () => ({ defensePierce: 0.5 }) },
  { id: 'channel', namePt: 'Canalização de Ki', nameEn: 'Ki Channel', type: 'attack', cost: 3, power: 34, damageKind: 'beam', archetype: 'beam', scene: 'launching a luminous blue energy beam from both palms', rules: tone => ({ drainKi: 1 + Math.floor(tone / 3) }) },
  { id: 'zenith', namePt: 'Feixe do Zênite', nameEn: 'Zenith Beam', type: 'attack', cost: 4, power: 43, damageKind: 'beam', archetype: 'beam', scene: 'concentrated white-gold beam piercing a crystalline dome', rules: () => ({ defensePierce: 1 }) },
  { id: 'suppress', namePt: 'Cerco de Energia', nameEn: 'Energy Siege', type: 'attack', cost: 3, power: 29, damageKind: 'ki', archetype: 'control', scene: 'controlling a ring of violet ki bolts around the enemy', rules: tone => ({ burnDefense: 1, drainKi: 1 + Math.floor(tone / 3) }) },
  { id: 'rush', namePt: 'Investida do Nexus', nameEn: 'Nexus Rush', type: 'attack', cost: 3, power: 23, damageKind: 'physical', combo: true, archetype: 'aggro', scene: 'explosive flying kick through fragments of a digital barrier', rules: () => ({ retainInitiative: true, breakShield: true }) },
  { id: 'scatter', namePt: 'Cascata de Feixes', nameEn: 'Beam Cascade', type: 'attack', cost: 3, power: 32, damageKind: 'beam', archetype: 'control', scene: 'multiple converging cyan beams forming a radiant helix', rules: () => ({ burnDefense: 1 }) },
  { id: 'sever', namePt: 'Corte de Frequência', nameEn: 'Frequency Sever', type: 'attack', cost: 3, power: 27, damageKind: 'ki', archetype: 'control', scene: 'slicing the air with an arcing crimson blade of ki', rules: () => ({ defensePierce: 1, drainKi: 1 }) },
  { id: 'break', namePt: 'Impacto de Colapso', nameEn: 'Collapse Impact', type: 'attack', cost: 4, power: 36, damageKind: 'physical', archetype: 'aggro', scene: 'heavy downward strike shattering hexagonal shield panels', rules: () => ({ breakShield: true, burnDefense: 1 }) },
  { id: 'sanctuary', namePt: 'Guarda Restauradora', nameEn: 'Restorative Guard', type: 'defense', cost: 2, block: 20, archetype: 'healing', scene: 'protective emerald dome with healing motes around the fighter', rules: tone => ({ heal: 10 + tone * 3, draw: 1 }) },
  { id: 'mirror', namePt: 'Muralha Prismática', nameEn: 'Prismatic Wall', type: 'defense', cost: 2, block: 24, archetype: 'defense', scene: 'reflective blue crystalline barrier redirecting a beam', rules: (tone, tier) => ({ kiGain: 1 + Math.floor(tone / 3), kiGainVsBeam: 1, reflect: 4 + tier * 2 }) },
  { id: 'absorb', namePt: 'Escudo de Absorção', nameEn: 'Absorption Shield', type: 'defense', cost: 3, block: 26, archetype: 'control', scene: 'absorbing glowing enemy energy into a violet shield', rules: tone => ({ stealKi: 1 + Math.floor(tone / 3), kiGain: 1, gainInitiative: true }) },
  { id: 'read', namePt: 'Leitura Defensiva', nameEn: 'Defensive Read', type: 'defense', cost: 2, block: 18, archetype: 'defense', scene: 'calm fighting stance behind rotating amber tactical glyphs', rules: tone => ({ draw: 1 + Math.floor(tone / 3), gainInitiative: true }) },
  { id: 'slip', namePt: 'Passo Entre Ecos', nameEn: 'Echo Step', type: 'evade', cost: 1, archetype: 'combo', scene: 'vanishing sideways into cyan afterimages and digital particles', rules: tone => ({ draw: 1 + Math.floor(tone / 3), kiGain: 1 + tone % 3 }) },
  { id: 'phantom', namePt: 'Fantasma Tático', nameEn: 'Tactical Phantom', type: 'evade', cost: 1, archetype: 'control', scene: 'multiple solid afterimages evading a close-range punch', rules: tone => ({ physicalOnly: true, stealInitiative: true, draw: 1 + Math.floor(tone / 3), kiGain: 1 + tone % 3 }) },
  { id: 'rift', namePt: 'Salto de Dimensão', nameEn: 'Dimension Leap', type: 'evade', cost: 2, archetype: 'combo', scene: 'instant high-speed displacement with fading anime afterimages and violet ki speed lines, no fantasy portal', rules: tone => ({ stealInitiative: true, kiGain: 2 + tone % 4, draw: 1 + Math.floor(tone / 4) }) },
  { id: 'reversal', namePt: 'Reversão Marcial', nameEn: 'Martial Reversal', type: 'counter', cost: 2, archetype: 'defense', scene: 'catching an incoming physical strike and returning a shockwave', rules: (tone, tier) => ({ physicalOnly: true, counterDamage: 18 + tone * 2 + tier * 3, kiGain: 1 }) },
  { id: 'refract', namePt: 'Refração de Ki', nameEn: 'Ki Refraction', type: 'counter', cost: 2, archetype: 'beam', scene: 'splitting an enemy beam into luminous violet arcs with one hand', rules: (tone, tier) => ({ beamOnly: true, counterDamage: 24 + tone * 3 + tier * 2, kiGain: 1 }) },
  { id: 'reply', namePt: 'Resposta do Nexus', nameEn: 'Nexus Reply', type: 'counter', cost: 3, archetype: 'control', scene: 'releasing a spherical golden counterattack at the moment of impact', rules: (tone, tier) => ({ counterDamage: 15 + tone * 2 + tier * 3, kiGain: 1 + Math.floor(tone / 3) }) },
  { id: 'restore', namePt: 'Memória Vital', nameEn: 'Vital Memory', type: 'tech', cost: 2, archetype: 'healing', scene: 'healing visible scratches with a gentle green ki aura, calm hands held near own chest, no attack', rules: (tone, tier) => ({ heal: 26 + tone * 5, draw: 1 + tier % 2 }) },
  { id: 'focus', namePt: 'Foco da Simulação', nameEn: 'Simulation Focus', type: 'tech', cost: 2, archetype: 'beam', scene: 'focused breathing in a martial arts stance, gathering blue ki around the body, no attack', rules: tone => ({ kiGain: 2 + tone % 4, draw: 1 + Math.floor(tone / 4) }) },
  { id: 'prime', namePt: 'Potencial Armazenado', nameEn: 'Stored Potential', type: 'tech', cost: 2, archetype: 'aggro', scene: 'charging a golden aura around clenched fists before the next strike', rules: (tone, tier) => ({ nextAttackBonus: 12 + tone * 3, kiGain: 1 + tier % 2 }) },
  { id: 'overdrive', namePt: 'Sobrecarga de Alma', nameEn: 'Soul Overdrive', type: 'tech', cost: 1, archetype: 'combo', scene: 'strained Kaioken-like power-up, scarlet aura and visible exhaustion, no weapon or attack', rules: tone => ({ selfDamage: 20 + tone * 3, kiGain: 3 + tone % 3, draw: 1 + Math.floor(tone / 3) }) }
]);

export const SUPPORTED_NEXUS_RULES = Object.freeze(['retainInitiative', 'defensePierce', 'unblockableDefense', 'breakShield', 'drainKi', 'burnDefense', 'kiGain', 'draw', 'heal', 'kiGainVsBeam', 'reflect', 'stealKi', 'gainInitiative', 'stealInitiative', 'physicalOnly', 'counterDamage', 'beamOnly', 'selfDamage', 'nextAttackBonus', 'attackLike', 'reactionSeconds']);

export function atlasPosition(index) {
  const sheet = Math.floor(index / ATLAS_CAPACITY) + 1;
  const slot = index % ATLAS_CAPACITY;
  return Object.freeze({ sheet, row: Math.floor(slot / ATLAS_COLUMNS), column: slot % ATLAS_COLUMNS, slot, columns: ATLAS_COLUMNS, rows: ATLAS_ROWS, sheetPath: `assets/rework/sheet-${String(sheet).padStart(2, '0')}.png` });
}

function rulesText(card, rule, lang = 'pt') {
  const pt = lang === 'pt';
  const text = [];
  if (card.type === 'attack') text.push(pt ? `Causa ${card.power} de dano.` : `Deal ${card.power} damage.`);
  if (card.type === 'defense') text.push(pt ? `Bloqueia ${card.block} de dano.` : `Block ${card.block} damage.`);
  if (card.type === 'evade') text.push(pt ? 'Evita o ataque; indisponível durante Guarda Aberta.' : 'Evade the attack; unavailable during Open Guard.');
  if (card.type === 'counter') text.push(pt ? 'Anula o ataque.' : 'Cancel the attack.');
  if (rule.physicalOnly) text.push(pt ? 'Somente contra golpes físicos.' : 'Only against physical attacks.');
  if (rule.beamOnly) text.push(pt ? 'Somente contra feixes.' : 'Only against beams.');
  if (card.isBeam) text.push(pt ? 'Pode responder a outro feixe em Disputa de Ki.' : 'Can answer another beam in a Ki Clash.');
  if (rule.retainInitiative) text.push(pt ? 'Mantém iniciativa; em combate simultâneo reduz a espera da ação.' : 'Retain initiative; in simultaneous combat reduce action recovery.');
  if (rule.defensePierce) text.push(pt ? `Ignora ${rule.defensePierce * 100}% do bloqueio.` : `Ignore ${rule.defensePierce * 100}% of block.`);
  if (rule.unblockableDefense) text.push(pt ? 'Não pode ser respondido com Defesa.' : 'Cannot be answered with Defense.');
  if (rule.breakShield) text.push(pt ? 'Se acertar, quebra ao menos um segmento de escudo.' : 'On hit, break at least one shield segment.');
  if (rule.drainKi) text.push(pt ? `Se causar dano, reduz o Ki inimigo em ${rule.drainKi}.` : `On damage, reduce enemy Ki by ${rule.drainKi}.`);
  if (rule.burnDefense) text.push(pt ? 'Se causar dano, descarta uma Defesa da mão inimiga.' : 'On damage, discard one Defense from the enemy hand.');
  if (rule.counterDamage) text.push(pt ? `Retalia com ${rule.counterDamage} de dano.` : `Retaliate for ${rule.counterDamage} damage.`);
  if (rule.reflect) text.push(pt ? `Reflete ${rule.reflect} de dano.` : `Reflect ${rule.reflect} damage.`);
  if (rule.stealKi) text.push(pt ? `Rouba até ${rule.stealKi} Ki do atacante.` : `Steal up to ${rule.stealKi} Ki from the attacker.`);
  if (rule.selfDamage) text.push(pt ? `Sofre ${rule.selfDamage} de dano.` : `Take ${rule.selfDamage} damage.`);
  if (rule.heal) text.push(pt ? `Cura ${rule.heal} HP, até o HP máximo.` : `Heal ${rule.heal} HP, up to maximum HP.`);
  if (rule.kiGain) text.push(pt ? `Ganha ${rule.kiGain} Ki, até 10.` : `Gain ${rule.kiGain} Ki, up to 10.`);
  if (rule.kiGainVsBeam) text.push(pt ? `Contra feixe, ganha mais ${rule.kiGainVsBeam} Ki.` : `Against a beam, gain another ${rule.kiGainVsBeam} Ki.`);
  if (rule.draw) text.push(pt ? `Compra ${rule.draw} carta(s), respeitando o limite de mão.` : `Draw ${rule.draw} card(s), respecting the hand limit.`);
  if (rule.nextAttackBonus) text.push(pt ? `Prepara +${rule.nextAttackBonus} de dano para o próximo ataque (não acumula).` : `Prime +${rule.nextAttackBonus} damage for the next attack (does not stack).`);
  if (rule.gainInitiative || rule.stealInitiative) text.push(pt ? 'Recebe a próxima iniciativa; em combate simultâneo acelera a prontidão.' : 'Take the next initiative; in simultaneous combat accelerate readiness.');
  if (card.type === 'defense' || card.type === 'evade' || card.type === 'counter') text.push(pt ? 'Em raid, protege contra o próximo ataque do chefe.' : 'In raids, prepare against the next boss attack.');
  return text.join(' ');
}

function createCard(actor, actorIndex, recipe, recipeIndex) {
  // Four resource tiers and seven effect accents produce distinct, auditable choices.
  const profile = (actorIndex * 11) % NEXUS_ROSTER.length;
  const tier = Math.floor(profile / 7);
  const tone = profile % 7;
  const rule = Object.freeze(recipe.rules(tone, tier));
  const power = recipe.type === 'attack' ? recipe.power + tone * 2 + tier * 3 : recipe.type === 'counter' ? rule.counterDamage : 0;
  const card = {
    id: `nxs_${actor.id}_${String(recipeIndex + 1).padStart(2, '0')}`,
    name: `${actor.name} — ${recipe.namePt}`,
    nameEn: `${actor.name} — ${recipe.nameEn}`,
    character: actor.name,
    characterId: actor.id,
    type: recipe.type,
    cost: recipe.cost + tier,
    power,
    ...(recipe.type === 'defense' ? { block: recipe.block + tone * 3 + tier * 4 } : {}),
    isCombo: !!recipe.combo,
    isBeam: recipe.damageKind === 'beam',
    damageKind: recipe.damageKind || null,
    rarity: tier === 3 || recipe.id === 'zenith' ? 'super-rare' : tier >= 1 ? 'rare' : 'common',
    synergyGroup: recipe.archetype,
    archetypes: [...new Set([recipe.archetype, actor.archetype])],
    keywords: Object.keys(rule),
    rules: rule,
    icon: { attack: '⚡', defense: '🛡️', evade: '🌀', counter: '↩️', tech: '✦' }[recipe.type],
    set: NEXUS_SET.id,
    setNumber: LEGACY_COLLECTION_SIZE + actorIndex * RECIPES.length + recipeIndex + 1,
    lore: `Eco de ${actor.name} preservado pelo Nexus. Cada decisão reescreve a simulação.`,
    art: Object.freeze({ ...atlasPosition(LEGACY_COLLECTION_SIZE + actorIndex * RECIPES.length + recipeIndex), status: 'pending', provenance: 'custom-generated-fan-art', officialLicensed: false, cropPath: `assets/rework/cards/nxs_${actor.id}_${String(recipeIndex + 1).padStart(2, '0')}.png`, fallbackPath: `assets/cards/${recipe.type === 'attack' ? 'atk_01' : recipe.type === 'defense' ? 'def_01' : recipe.type === 'evade' ? 'evd_01' : recipe.type === 'counter' ? 'ctr_01' : 'tch_01'}.png` }),
    artPrompt: `${actor.name} (${actor.appearance}), ${recipe.scene}, move ${recipe.nameEn}, ${actor.setting}; portrait action illustration, distinct pose, no text or card frame`
  };
  card.descPt = rulesText(card, rule, 'pt');
  card.descEn = rulesText(card, rule, 'en');
  return Object.freeze(card);
}

export const NEXUS_CARDS = Object.freeze(NEXUS_ROSTER.flatMap((actor, index) => RECIPES.map((recipe, recipeIndex) => createCard(actor, index, recipe, recipeIndex))));
export const NEXUS_CARD_RULES = Object.freeze(Object.fromEntries(NEXUS_CARDS.map(card => [card.id, card.rules])));

const LEGACY_ACTORS = Object.freeze({
  atk_01: 'goku', atk_02: 'goku', atk_03: 'vegeta', atk_04: 'goku', atk_05: 'piccolo', atk_06: 'trunks', atk_07: 'frieza', atk_08: 'vegeta', atk_09: 'gohan', atk_10: 'trunks', atk_11: 'frieza', atk_12: 'piccolo', atk_13: 'vegeta', atk_14: 'goku', atk_15: 'krillin', atk_16: 'gohan', atk_17: 'piccolo', atk_18: 'frieza', atk_19: 'vegeta', atk_20: 'goku', atk_21: 'trunks', atk_22: 'piccolo', atk_23: 'trunks', atk_24: 'frieza', atk_25: 'goku', atk_26: 'vegeta', atk_27: 'goku', atk_28: 'goku',
  def_01: 'goku', def_02: 'gohan', def_03: 'android17', def_04: 'beerus', def_05: 'piccolo', def_06: 'vegeta', def_07: 'goku', def_08: 'vegeta', def_09: 'android16', def_10: 'frieza', def_11: 'gohan', def_12: 'trunks', def_13: 'goku', def_14: 'piccolo', def_15: 'goku',
  evd_01: 'goku', evd_02: 'krillin', evd_03: 'goku', evd_04: 'trunks', evd_05: 'hit', evd_06: 'goku', evd_07: 'trunks', evd_08: 'gohan', evd_09: 'whis',
  ctr_01: 'tien', ctr_02: 'vegeta', ctr_03: 'hit', ctr_04: 'goku', ctr_05: 'frieza', ctr_06: 'trunks', ctr_07: 'goku', ctr_08: 'frieza', ctr_09: 'gohan',
  tch_01: 'goku', tch_02: 'krillin', tch_03: 'goku', tch_04: 'vegeta', tch_05: 'gohan', tch_06: 'frieza', tch_07: 'piccolo', tch_08: 'trunks', tch_09: 'goku'
});

export function createNexusCollection(legacyCards) {
  if (legacyCards.length !== LEGACY_COLLECTION_SIZE) throw new Error('Nexus requires the preserved 70-card legacy collection.');
  const enrichedLegacy = legacyCards.map((card, index) => {
    const actor = card.id === 'ctr_05' ? { id: 'ginyu', name: 'Capitão Ginyu', appearance: 'purple muscular alien, black white horns, black Saiyan armor', setting: 'Namek spaceship landing zone' } : NEXUS_ROSTER.find(item => item.id === LEGACY_ACTORS[card.id]) || NEXUS_ROSTER[0];
    return {
      ...card,
      character: actor.name,
      characterId: actor.id,
      set: 'LEGACY',
      setNumber: index + 1,
      archetypes: [card.synergyGroup === 'tech' ? 'healing' : card.synergyGroup === 'beam' ? 'beam' : card.synergyGroup === 'combo' ? 'combo' : card.synergyGroup === 'defense' ? 'defense' : 'control'],
      art: Object.freeze({ ...atlasPosition(index), status: 'legacy-ready', provenance: 'existing-project-art', officialLicensed: false, cropPath: `assets/rework/cards/${card.id}.png`, fallbackPath: `assets/cards/${card.id}.png` }),
      artPrompt: `${actor.name} (${actor.appearance}), ${card.name}, ${actor.setting}; portrait action illustration, unique move and pose, no text or card frame`
    };
  });
  const collection = [...enrichedLegacy, ...NEXUS_CARDS];
  if (collection.length !== COLLECTION_SIZE || new Set(collection.map(card => card.id)).size !== COLLECTION_SIZE) throw new Error('Nexus collection is not 714 unique IDs.');
  return collection;
}

export function collectionSummary(cards) {
  return {
    total: cards.length,
    byType: Object.fromEntries(['attack', 'defense', 'evade', 'counter', 'tech'].map(type => [type, cards.filter(card => card.type === type).length])),
    byRarity: Object.fromEntries(['common', 'rare', 'super-rare'].map(rarity => [rarity, cards.filter(card => card.rarity === rarity).length])),
    archetypes: ['aggro', 'defense', 'healing', 'control', 'combo', 'beam'],
    sheets: Math.ceil(cards.length / ATLAS_CAPACITY),
    emptySlots: Math.ceil(cards.length / ATLAS_CAPACITY) * ATLAS_CAPACITY - cards.length
  };
}


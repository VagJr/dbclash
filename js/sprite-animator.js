/**
 * SpriteAnimator — Plays pixel-art sprite sheet animations in the arena.
 * Each attack type maps to its specific sheet in assets/spritesheets/fx/.
 * 
 * Usage:
 *   spriteAnimator.play('punch', x, y, damage);
 */

const SPRITE_BASE = './assets/spritesheets/fx/';

// Sprite sheet definitions: { file, frames, fw (frameW), fh (frameH), fps, scale }
const SPRITE_DEFS = {
  punch:          { file: 'punch_sheet.png',          frames: 8,  fw: 64,  fh: 64, fps: 18, scale: 3.5 },
  ki_blast:       { file: 'ki_blast_sheet.png',        frames: 10, fw: 64,  fh: 64, fps: 16, scale: 3.0 },
  kamehameha:     { file: 'kamehameha_sheet.png',      frames: 8,  fw: 96,  fh: 64, fps: 14, scale: 4.0, rowOffset: 0 },
  final_flash:    { file: 'final_flash_sheet.png',     frames: 10, fw: 64,  fh: 64, fps: 14, scale: 4.0 },
  big_bang:       { file: 'big_bang_sheet.png',        frames: 10, fw: 64,  fh: 64, fps: 14, scale: 4.0 },
  genki_dama:     { file: 'genki_dama_sheet.png',      frames: 10, fw: 64,  fh: 64, fps: 12, scale: 4.5 },
  dragon_fist:    { file: 'dragon_fist_sheet.png',     frames: 10, fw: 64,  fh: 64, fps: 16, scale: 4.0 },
  kaioken:        { file: 'kaioken_strike_sheet.png',  frames: 10, fw: 64,  fh: 64, fps: 16, scale: 3.5 },
  death_beam:     { file: 'death_beam_sheet.png',      frames: 10, fw: 64,  fh: 64, fps: 18, scale: 3.0 },
  special_beam:   { file: 'special_beam_sheet.png',    frames: 10, fw: 64,  fh: 64, fps: 14, scale: 3.5 },
  masenko:        { file: 'masenko_sheet.png',          frames: 10, fw: 64,  fh: 64, fps: 14, scale: 3.5 },
  galick_gun:     { file: 'galick_gun_sheet.png',       frames: 10, fw: 64,  fh: 64, fps: 14, scale: 4.0 },
  burning_attack: { file: 'burning_attack_sheet.png',  frames: 10, fw: 64,  fh: 64, fps: 14, scale: 3.5 },
  solar_flare:    { file: 'solar_flare_sheet.png',     frames: 10, fw: 64,  fh: 64, fps: 14, scale: 4.0 },
  supernova:      { file: 'supernova_sheet.png',        frames: 10, fw: 64,  fh: 64, fps: 12, scale: 5.0 },
  kienzan:        { file: 'kienzan_sheet.png',          frames: 10, fw: 64,  fh: 64, fps: 16, scale: 3.5 },
  kikoho:         { file: 'kikoho_sheet.png',           frames: 10, fw: 64,  fh: 64, fps: 14, scale: 4.0 },
  spirit_sword:   { file: 'spirit_sword_sheet.png',    frames: 10, fw: 64,  fh: 64, fps: 16, scale: 3.5 },
  barrier:        { file: 'barrier_sheet.png',          frames: 8,  fw: 64,  fh: 64, fps: 14, scale: 3.0 },
  time_skip:      { file: 'time_skip_sheet.png',        frames: 10, fw: 64,  fh: 64, fps: 14, scale: 3.5 },
  vanish:         { file: 'vanish_sheet.png',           frames: 8,  fw: 64,  fh: 64, fps: 18, scale: 3.0 },
};

// Attack type → sprite key mapping (for handleFXEvent types)
const ATTACK_SPRITE_MAP = {
  punch:           'punch',
  dragonFist:      'dragon_fist',
  kaiokenStrike:   'kaioken',
  meteorCombination: 'punch',
  kamehameha:      'kamehameha',
  genkidama:       'genki_dama',
  finalFlash:      'final_flash',
  deathBeam:       'death_beam',
  specialBeam:     'special_beam',
  masenko:         'masenko',
  bigBang:         'big_bang',
  burningAttack:   'burning_attack',
  galickGun:       'galick_gun',
  solarFlare:      'solar_flare',
  supernova:       'supernova',
  kienzan:         'kienzan',
  kikoho:          'kikoho',
  spiritSword:     'spirit_sword',
  barrier:         'barrier',
  timeSkip:        'time_skip',
  kiBlast:         'ki_blast',
  vanish:          'vanish',
  // default fallback
  default:         'punch',
};

class SpriteAnimator {
  constructor() {
    this._cache = {}; // preloaded Image objects
    this._preloadAll();
  }

  _preloadAll() {
    if (typeof Image === 'undefined') return;
    for (const [key, def] of Object.entries(SPRITE_DEFS)) {
      const img = new Image();
      img.src = SPRITE_BASE + def.file;
      this._cache[key] = img;
    }
  }

  /**
   * Play a sprite animation centered at (x, y) in the arena.
   * @param {string} attackType - the FX event type (e.g. 'punch', 'kamehameha')
   * @param {number} x - center X in arena-relative px
   * @param {number} y - center Y in arena-relative px
   * @param {number} damage - damage number to display
   * @param {string} defenderKey - 'player' or 'opponent'
   */
  play(attackType, x, y, damage = 40, defenderKey = 'opponent') {
    const spriteKey = ATTACK_SPRITE_MAP[attackType] || ATTACK_SPRITE_MAP.default;
    const def = SPRITE_DEFS[spriteKey];
    const img = this._cache[spriteKey];
    if (!def || !img) return;

    const arena = document.getElementById('scene-arena');
    if (!arena) return;

    const displayW = def.fw * def.scale;
    const displayH = def.fh * def.scale;

    // Create canvas element
    const canvas = document.createElement('canvas');
    canvas.width = displayW;
    canvas.height = displayH;
    canvas.style.cssText = `
      position: absolute;
      left: ${x - displayW / 2}px;
      top: ${y - displayH / 2}px;
      pointer-events: none;
      z-index: 9500;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    `;
    arena.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    let frame = 0;
    const totalFrames = def.frames;
    const frameInterval = 1000 / def.fps;
    let last = performance.now();

    // Damage number element
    const dmgEl = document.createElement('div');
    dmgEl.className = 'sprite-damage-number';
    dmgEl.textContent = `-${damage}`;
    dmgEl.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y - displayH / 2 - 10}px;
      transform: translateX(-50%);
      pointer-events: none;
      z-index: 9600;
    `;
    arena.appendChild(dmgEl);

    // Draw first frame immediately
    const drawFrame = (now) => {
      if (now - last >= frameInterval) {
        ctx.clearRect(0, 0, displayW, displayH);
        const sx = frame * def.fw;
        const sy = (def.rowOffset || 0) * def.fh;
        ctx.drawImage(img, sx, sy, def.fw, def.fh, 0, 0, displayW, displayH);
        last = now;
        frame++;
      }

      if (frame < totalFrames) {
        requestAnimationFrame(drawFrame);
      } else {
        // Fade out canvas
        canvas.style.transition = 'opacity 0.18s ease-out';
        canvas.style.opacity = '0';
        setTimeout(() => {
          canvas.remove();
          dmgEl.remove();
        }, 200);
      }
    };

    if (img.complete) {
      requestAnimationFrame(drawFrame);
    } else {
      img.onload = () => requestAnimationFrame(drawFrame);
    }
  }

  /**
   * Play a COMBO sequence: multiple bursts of the same sprite at staggered timing.
   */
  playCombo(attackType, x, y, damage, defenderKey, count = 3) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const jitterX = x + (Math.random() - 0.5) * 80;
        const jitterY = y + (Math.random() - 0.5) * 60;
        this.play(attackType, jitterX, jitterY, i === count - 1 ? damage : null, defenderKey);
      }, i * 160);
    }
  }
}

export const spriteAnimator = new SpriteAnimator();

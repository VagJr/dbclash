/* ==========================================================================
   Dragon Ball Clash Action TCG - Audio Director
   BGM + SFX + atmospheric layers using the assets already stored in /music.
   Browser-safe autoplay unlock, media pooling and distinct attack sound profiles.
   ========================================================================== */

export const SOUND_ASSETS = Object.freeze({
  menu: 'soundtrack.mp3',
  battle1: 'battle1.mp3',
  battle2: 'battle2.mp3',
  awakening: 'awakening.mp3',
  kiCharge: 'carregar_ki.mp3',
  meleeClash: 'clash_punchs.mp3',
  beamDamage: 'dano_do_beam.mp3',
  beam: 'dbz-beam-fx.wav',
  heavyKick: 'dragonball-z-heavy-kick-fx.wav',
  kamehameha: 'kamehameha.mp3',
  vanish: 'teleport_vanish.wav'
});

export const ATTACK_SFX_PROFILES = Object.freeze({
  punch: [
    { asset: 'heavyKick', volume: 0.86, rate: 1.0 }
  ],
  kamehameha: [
    { asset: 'beamDamage', volume: 0.82, rate: 1.0 },
    { asset: 'beam', volume: 0.42, rate: 0.94, delay: 35 }
  ],
  genkidama: [
    { asset: 'beamDamage', volume: 0.95, rate: 0.72 },
    { asset: 'heavyKick', volume: 0.42, rate: 0.70, delay: 70 }
  ],
  finalFlash: [
    { asset: 'beam', volume: 0.92, rate: 0.78 },
    { asset: 'beamDamage', volume: 0.72, rate: 0.84, delay: 65 }
  ],
  deathBeam: [
    { asset: 'beam', volume: 0.78, rate: 1.55, stopMs: 520 },
    { asset: 'beamDamage', volume: 0.38, rate: 1.28, delay: 45, stopMs: 520 }
  ],
  specialBeam: [
    { asset: 'beam', volume: 0.88, rate: 1.20 },
    { asset: 'beamDamage', volume: 0.56, rate: 0.92, delay: 55 }
  ],
  masenko: [
    { asset: 'beam', volume: 0.78, rate: 1.10 },
    { asset: 'beamDamage', volume: 0.52, rate: 1.08, delay: 40 }
  ],
  bigBang: [
    { asset: 'beamDamage', volume: 0.88, rate: 0.78 },
    { asset: 'heavyKick', volume: 0.58, rate: 0.82, delay: 55 }
  ],
  burningAttack: [
    { asset: 'beam', volume: 0.72, rate: 1.28, stopMs: 700 },
    { asset: 'meleeClash', volume: 0.36, rate: 1.16, delay: 35, stopMs: 520 }
  ],
  supernova: [
    { asset: 'beamDamage', volume: 0.96, rate: 0.64 },
    { asset: 'beam', volume: 0.52, rate: 0.74, delay: 80 }
  ],
  kienzan: [
    { asset: 'beam', volume: 0.68, rate: 1.62, stopMs: 650 },
    { asset: 'vanish', volume: 0.34, rate: 1.25, delay: 25, stopMs: 500 }
  ],
  kikoho: [
    { asset: 'heavyKick', volume: 0.80, rate: 0.72 },
    { asset: 'beamDamage', volume: 0.64, rate: 0.76, delay: 55 }
  ],
  dragonFist: [
    { asset: 'meleeClash', volume: 0.62, rate: 0.92, stopMs: 750 },
    { asset: 'heavyKick', volume: 0.96, rate: 0.82, delay: 130 }
  ],
  meteorCombination: [
    { asset: 'meleeClash', volume: 0.92, rate: 1.18, stopMs: 900 },
    { asset: 'heavyKick', volume: 0.70, rate: 1.05, delay: 330 }
  ],
  spiritSword: [
    { asset: 'vanish', volume: 0.52, rate: 1.32, stopMs: 550 },
    { asset: 'beam', volume: 0.58, rate: 1.48, delay: 35, stopMs: 620 },
    { asset: 'heavyKick', volume: 0.52, rate: 1.08, delay: 115 }
  ],
  kiBlast: [
    { asset: 'beam', volume: 0.76, rate: 1.34, stopMs: 560 }
  ]
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.masterVolume = 1;
    this.bgmVolume = 0.34;
    this.sfxVolume = 0.9;
    this.bgmAudio = null;
    this.currentBgmKey = null;
    this.desiredBgmKey = 'menu';
    this.bgmSwitchToken = 0;
    this.unlocked = false;
    this.preloaded = new Map();
    this.activeKamehameha = null;
    this.activePunchClash = null;
    this.ambienceNodes = [];
    this.ambienceMode = null;
    this.lastImpactAt = new Map();

    if (typeof window !== 'undefined') {
      this._loadPreferences();
      this._bindUnlock();
    }
  }

  _loadPreferences() {
    try {
      const muted = localStorage.getItem('dbclash_audio_muted');
      const master = Number(localStorage.getItem('dbclash_audio_master'));
      if (muted !== null) this.isMuted = muted === '1';
      if (Number.isFinite(master) && master > 0) this.masterVolume = clamp(master, 0, 1);
    } catch {}
  }

  _savePreferences() {
    try {
      localStorage.setItem('dbclash_audio_muted', this.isMuted ? '1' : '0');
      localStorage.setItem('dbclash_audio_master', String(this.masterVolume));
    } catch {}
  }

  _assetUrl(assetOrFile) {
    const file = SOUND_ASSETS[assetOrFile] || assetOrFile;
    return new URL(`../music/${file}`, import.meta.url).href;
  }

  _getBgm() {
    if (typeof document === 'undefined') return this.bgmAudio;
    const dom = document.getElementById('app-bgm');
    if (dom) {
      this.bgmAudio = dom;
      this.bgmAudio.loop = true;
      this.bgmAudio.preload = 'auto';
      this.bgmAudio.playsInline = true;
      return dom;
    }
    if (!this.bgmAudio && typeof Audio !== 'undefined') {
      this.bgmAudio = new Audio();
      this.bgmAudio.loop = true;
      this.bgmAudio.preload = 'auto';
    }
    return this.bgmAudio;
  }

  _bindUnlock() {
    const unlock = () => this.unlock();
    const opts = { capture: true, passive: true, once: true };
    window.addEventListener('pointerdown', unlock, opts);
    window.addEventListener('touchstart', unlock, opts);
    window.addEventListener('keydown', unlock, { capture: true, once: true });
  }

  unlock() {
    if (typeof window === 'undefined') return;
    this.init();
    this.unlocked = true;
    this.preloadSfx();
    this._applyBgmVolume();
    if (!this.isMuted) this._switchBgm(this.desiredBgmKey, { immediate: true });
    if (this.ambienceMode) this.startAmbience(this.ambienceMode);
  }

  init() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  preloadSfx() {
    if (typeof Audio === 'undefined') return;
    const keys = ['awakening', 'kiCharge', 'meleeClash', 'beamDamage', 'beam', 'heavyKick', 'kamehameha', 'vanish'];
    for (const key of keys) {
      if (this.preloaded.has(key)) continue;
      try {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = this._assetUrl(key);
        audio.load();
        this.preloaded.set(key, audio);
      } catch {}
    }
  }

  setMuted(value) {
    this.isMuted = !!value;
    this._savePreferences();
    const bgm = this._getBgm();
    if (bgm) bgm.muted = this.isMuted;
    if (this.isMuted) this.stopAmbience();
    else if (this.unlocked) {
      this._switchBgm(this.desiredBgmKey, { immediate: true });
      if (this.ambienceMode) this.startAmbience(this.ambienceMode);
    }
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  setMasterVolume(value) {
    this.masterVolume = clamp(value, 0, 1);
    this._savePreferences();
    this._applyBgmVolume();
  }

  _applyBgmVolume(multiplier = 1) {
    const bgm = this._getBgm();
    if (!bgm) return;
    bgm.volume = clamp(this.bgmVolume * this.masterVolume * multiplier, 0, 1);
    bgm.muted = this.isMuted;
  }

  _playFile(assetOrFile, options = {}) {
    if (this.isMuted || typeof Audio === 'undefined') return null;
    this.init();

    const {
      volume = 0.7,
      rate = 1,
      startTime = 0,
      stopMs = 0,
      delay = 0,
      loop = false
    } = options;

    const launch = () => {
      try {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = this._assetUrl(assetOrFile);
        audio.volume = clamp(volume * this.sfxVolume * this.masterVolume, 0, 1);
        audio.playbackRate = clamp(rate, 0.5, 2);
        audio.loop = !!loop;
        audio.playsInline = true;

        const playNow = () => {
          if (startTime > 0) {
            try { audio.currentTime = startTime; } catch {}
          }
          audio.play().catch(() => {});
        };

        if (startTime > 0 && audio.readyState < 1) {
          audio.addEventListener('loadedmetadata', playNow, { once: true });
          audio.load();
        } else {
          playNow();
        }

        if (stopMs > 0) {
          setTimeout(() => {
            try {
              audio.pause();
              audio.currentTime = 0;
            } catch {}
          }, stopMs);
        }
        return audio;
      } catch {
        return null;
      }
    };

    if (delay > 0) {
      setTimeout(launch, delay);
      return null;
    }
    return launch();
  }

  _tone({ frequency = 220, endFrequency = null, duration = 0.12, volume = 0.08, type = 'sine', delay = 0 } = {}) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const run = () => {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, frequency), now);
      if (endFrequency) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
      }
      gain.gain.setValueAtTime(Math.max(0.0001, volume * this.masterVolume), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    };

    if (delay > 0) setTimeout(run, delay);
    else run();
  }

  _noiseBurst(duration = 0.14, volume = 0.06, lowpass = 1800) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const frames = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    gain.gain.setValueAtTime(volume * this.masterVolume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    source.start();
  }

  duckBgm(multiplier = 0.55, durationMs = 420) {
    const bgm = this._getBgm();
    if (!bgm || this.isMuted) return;
    this._applyBgmVolume(multiplier);
    setTimeout(() => this._applyBgmVolume(1), durationMs);
  }

  async _switchBgm(key, { immediate = false } = {}) {
    this.desiredBgmKey = key;
    if (this.isMuted || !this.unlocked) return;

    const bgm = this._getBgm();
    if (!bgm) return;

    const asset = SOUND_ASSETS[key] || SOUND_ASSETS.menu;
    const target = this._assetUrl(asset);
    if (this.currentBgmKey === key && bgm.src === target && !bgm.paused) return;

    const token = ++this.bgmSwitchToken;

    const setTrack = async () => {
      if (token !== this.bgmSwitchToken) return;
      bgm.pause();
      bgm.src = target;
      bgm.currentTime = 0;
      bgm.loop = true;
      bgm.muted = false;
      this.currentBgmKey = key;
      this._applyBgmVolume(1);
      await bgm.play().catch(() => {});
    };

    if (immediate || bgm.paused) {
      await setTrack();
      return;
    }

    const startVolume = bgm.volume;
    const steps = 6;
    for (let i = steps - 1; i >= 0; i--) {
      if (token !== this.bgmSwitchToken) return;
      bgm.volume = startVolume * (i / steps);
      await new Promise(resolve => setTimeout(resolve, 35));
    }
    await setTrack();
  }

  playMenuTheme() {
    this._switchBgm('menu');
  }

  playBattleTheme() {
    const next = this.currentBgmKey === 'battle1' ? 'battle2' :
      (Math.random() > 0.5 ? 'battle1' : 'battle2');
    this._switchBgm(next);
  }

  playQueueTheme() {
    this._switchBgm('battle1');
    const bgm = this._getBgm();
    if (bgm) bgm.volume = clamp(0.22 * this.masterVolume, 0, 1);
  }

  stopAmbience() {
    for (const node of this.ambienceNodes) {
      try { node.stop?.(); } catch {}
      try { node.disconnect?.(); } catch {}
    }
    this.ambienceNodes = [];
  }

  startAmbience(mode = 'menu') {
    this.ambienceMode = mode;
    if (this.isMuted || !this.unlocked) return;
    this.init();
    if (!this.ctx) return;

    this.stopAmbience();
    this.ambienceMode = mode;

    const makeDrone = (freq, volume, type = 'sine') => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = volume * this.masterVolume;
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      this.ambienceNodes.push(osc, gain);
    };

    if (mode === 'battle') {
      makeDrone(48, 0.016, 'sine');
      makeDrone(96, 0.006, 'triangle');

      const seconds = 2;
      const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const source = this.ctx.createBufferSource();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      source.buffer = buffer;
      source.loop = true;
      filter.type = 'lowpass';
      filter.frequency.value = 460;
      gain.gain.value = 0.010 * this.masterVolume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      source.start();
      this.ambienceNodes.push(source, filter, gain);
    } else if (mode === 'queue') {
      makeDrone(62, 0.012, 'triangle');
      makeDrone(124, 0.004, 'sine');
    } else {
      makeDrone(55, 0.006, 'sine');
      makeDrone(82.5, 0.003, 'sine');
    }
  }

  playClick() {
    this._tone({ frequency: 620, endFrequency: 330, duration: 0.055, volume: 0.075 });
  }

  playCardPlay() {
    this._tone({ frequency: 523, endFrequency: 784, duration: 0.14, volume: 0.10, type: 'triangle' });
  }

  playKiCharge() {
    this._playFile('kiCharge', { volume: 0.82, stopMs: 1800 });
    this._tone({ frequency: 90, endFrequency: 280, duration: 0.8, volume: 0.035, type: 'sawtooth' });
  }

  playZVanish() {
    this._playFile('vanish', { volume: 0.86, rate: 1.0 });
    this._tone({ frequency: 1100, endFrequency: 230, duration: 0.12, volume: 0.05 });
  }

  playPunch() {
    this._playFile('heavyKick', { volume: 0.88 });
    this._noiseBurst(0.08, 0.04, 1100);
  }

  playClashPunches(durationMs = 700) {
    if (this.activePunchClash) {
      try { this.activePunchClash.pause(); } catch {}
    }
    this.activePunchClash = this._playFile('meleeClash', {
      volume: 0.86,
      stopMs: durationMs
    });
  }

  playKamehamehaCharge() {
    if (this.activeKamehameha) {
      try { this.activeKamehameha.pause(); } catch {}
    }
    this.activeKamehameha = this._playFile('kamehameha', { volume: 0.9 });
    this.duckBgm(0.72, 900);
  }

  playKamehamehaImpact() {
    if (this.activeKamehameha) {
      try {
        this.activeKamehameha.currentTime = Math.min(7.5, this.activeKamehameha.duration || 7.5);
      } catch {}
    }
    this._playFile('beamDamage', { volume: 0.82 });
    this._noiseBurst(0.22, 0.07, 950);
    this.duckBgm(0.48, 700);
  }

  playBeamBlast() {
    this._playFile('beam', { volume: 0.84 });
    this._tone({ frequency: 290, endFrequency: 820, duration: 0.18, volume: 0.035, type: 'sawtooth' });
  }

  playBeamDamage() {
    this._playFile('beamDamage', { volume: 0.86 });
    this._noiseBurst(0.12, 0.045, 1200);
  }

  playAwaken() {
    this._playFile('awakening', { volume: 0.92 });
    this._tone({ frequency: 70, endFrequency: 440, duration: 1.0, volume: 0.04, type: 'sawtooth' });
    this.duckBgm(0.52, 1300);
  }

  playCardClash() {
    this._playFile('heavyKick', { volume: 0.62, rate: 0.94 });
    this._playFile('meleeClash', { volume: 0.56, rate: 1.1, stopMs: 620, delay: 25 });
  }

  playImpact(attackType = 'punch', damage = 40) {
    const key = ATTACK_SFX_PROFILES[attackType] ? attackType : 'punch';
    const now = Date.now();
    const last = this.lastImpactAt.get(key) || 0;
    if (now - last < 55) return;
    this.lastImpactAt.set(key, now);

    for (const layer of ATTACK_SFX_PROFILES[key]) {
      this._playFile(layer.asset, layer);
    }

    const power = clamp((Number(damage) || 40) / 100, 0.2, 1.5);
    if (['genkidama', 'supernova', 'finalFlash', 'bigBang', 'kikoho'].includes(key)) {
      this._tone({
        frequency: 95,
        endFrequency: 42,
        duration: 0.34,
        volume: 0.055 * power,
        type: 'sine'
      });
      this._noiseBurst(0.24, 0.055 * power, 820);
      this.duckBgm(0.42, 760);
    } else if (['deathBeam', 'specialBeam', 'masenko', 'kiBlast', 'kienzan', 'spiritSword'].includes(key)) {
      this._tone({
        frequency: 680,
        endFrequency: 170,
        duration: 0.13,
        volume: 0.032 * power,
        type: 'sawtooth'
      });
      this.duckBgm(0.62, 360);
    } else {
      this._noiseBurst(0.09, 0.035 * power, 1300);
      this.duckBgm(0.70, 260);
    }
  }

  playSolarFlare() {
    this._tone({ frequency: 1200, endFrequency: 2100, duration: 0.28, volume: 0.045, type: 'sine' });
    this._tone({ frequency: 1700, endFrequency: 900, duration: 0.32, volume: 0.022, type: 'triangle', delay: 45 });
  }

  playTimeSkip() {
    this._playFile('vanish', { volume: 0.72, rate: 0.72, stopMs: 620 });
    this._tone({ frequency: 420, endFrequency: 75, duration: 0.18, volume: 0.04, type: 'square' });
  }

  playReaction(mode = 'defense') {
    if (mode === 'evade') {
      this.playZVanish();
    } else if (mode === 'counter') {
      this._playFile('heavyKick', { volume: 0.82, rate: 1.18 });
      this._tone({ frequency: 260, endFrequency: 620, duration: 0.11, volume: 0.035, type: 'square' });
    } else {
      this._playFile('heavyKick', { volume: 0.52, rate: 0.82 });
      this._playFile('beamDamage', { volume: 0.32, rate: 1.2, delay: 20, stopMs: 450 });
    }
  }

  playResult(isWin) {
    if (isWin) {
      this._tone({ frequency: 392, endFrequency: 784, duration: 0.42, volume: 0.055, type: 'triangle' });
      this._tone({ frequency: 523, endFrequency: 1046, duration: 0.42, volume: 0.035, type: 'sine', delay: 120 });
    } else {
      this._tone({ frequency: 220, endFrequency: 73, duration: 0.55, volume: 0.05, type: 'sawtooth' });
    }
    this.duckBgm(0.55, 900);
  }

  playMatchFound() {
    this._tone({ frequency: 440, endFrequency: 880, duration: 0.16, volume: 0.06, type: 'triangle' });
    this._tone({ frequency: 660, endFrequency: 1100, duration: 0.18, volume: 0.04, type: 'triangle', delay: 120 });
  }

  // Compatibility aliases used by older UI code.
  playAttack() { this.playPunch(); }
  hit() { this.playPunch(); }
  kamehameha() { this.playBeamBlast(); }
  genkidama() { this.playImpact('genkidama', 90); }
  kiBlast() { this.playImpact('kiBlast', 30); }
  counter() { this.playReaction('counter'); }
}

export const soundEngine = new SoundEngine();

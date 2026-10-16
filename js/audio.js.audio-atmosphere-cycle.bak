/* ==========================================================================
   Dragon Ball Clash Action TCG - Sound Engine (High Definition DBZ SFX & BGM)
   Manages high quality audio files from /music with intelligent trimming,
   seek/fast-forward, auto-stop cuts, and WebAudio synth fallbacks.
   ========================================================================== */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.bgmAudio = null;
    this.activeKamehameha = null;
    this.activePunchClash = null;

    if (typeof window !== 'undefined') {
      const getBgm = () => {
        return document.getElementById('app-bgm') || this.bgmAudio;
      };

      // Try grabbing existing DOM element or fallback
      this.bgmAudio = document.getElementById('app-bgm') || new Audio('music/soundtrack.mp3');
      this.bgmAudio.loop = true;

      const unlockAndPlay = () => {
        this.init();
        const bgm = getBgm();
        if (bgm) {
          bgm.muted = false;
          bgm.volume = 0.35;
          if (!bgm.src || bgm.src === '' || bgm.src.endsWith('/')) {
            bgm.src = 'music/soundtrack.mp3';
          }
          if (bgm.paused && !this.isMuted) {
            bgm.play().catch(() => {});
          }
        }
      };

      // Attempt immediate silent autoplay on load
      try {
        this.bgmAudio.volume = 0.35;
        this.bgmAudio.play().then(() => {
          // If browser allowed autoplay, unmute immediately
          this.bgmAudio.muted = false;
        }).catch(() => {
          // Autoplay blocked, wait for first touch/click/scroll/hover
        });
      } catch (e) {}

      const events = ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown', 'scroll'];
      events.forEach(evt => {
        window.addEventListener(evt, unlockAndPlay, { passive: true });
      });
    }
  }

  init() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Helper to play an MP3/WAV file from music/ folder with options.
   */
  _playFile(src, volume = 0.7, startTime = 0, autoStopMs = 0) {
    if (this.isMuted || typeof window === 'undefined') return null;
    try {
      const audio = new Audio(`music/${src}`);
      audio.volume = volume;
      if (startTime > 0) {
        audio.currentTime = startTime;
      }
      audio.play().catch(() => {});

      if (autoStopMs > 0) {
        setTimeout(() => {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch(e) {}
        }, autoStopMs);
      }
      return audio;
    } catch (e) {
      return null;
    }
  }

  // Button Click SFX
  playClick() {
    if (this.isMuted) return;
    this.init();
    if (this.ctx) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    }
  }

  // Card Play Chime
  playCardPlay() {
    if (this.isMuted) return;
    this.init();
    if (this.ctx) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, this.ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, this.ctx.currentTime + 0.04);
      osc.frequency.setValueAtTime(783.99, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    }
  }

  // Ki Charge (music/carregar_ki.mp3)
  playKiCharge() {
    this._playFile('carregar_ki.mp3', 0.8, 0, 1800);
  }

  // Z-Vanish Teleport (music/teleport_vanish.wav)
  playZVanish() {
    this._playFile('teleport_vanish.wav', 0.85);
  }

  // Heavy Physical Punch Impact (music/dragonball-z-heavy-kick-fx.wav)
  playPunch() {
    this._playFile('dragonball-z-heavy-kick-fx.wav', 0.85);
  }

  // Rapid Punch Melee Clash (music/clash_punchs.mp3) — plays fast burst and cuts quickly
  playClashPunches(durationMs = 700) {
    if (this.activePunchClash) {
      try { this.activePunchClash.pause(); } catch(e){}
    }
    this.activePunchClash = this._playFile('clash_punchs.mp3', 0.85, 0, durationMs);
  }

  // Kamehameha Charge Phase (music/kamehameha.mp3 from 0s)
  playKamehamehaCharge() {
    if (this.activeKamehameha) {
      try { this.activeKamehameha.pause(); } catch(e){}
    }
    this.activeKamehameha = this._playFile('kamehameha.mp3', 0.9, 0);
  }

  // Kamehameha Launch & Impact Phase (Advances active track to impact section or plays beam damage SFX)
  playKamehamehaImpact() {
    if (this.activeKamehameha) {
      try {
        // Fast-forward track to the beam launch/impact section (~7.5 seconds)
        this.activeKamehameha.currentTime = 7.5;
      } catch (e) {
        this._playFile('dano_do_beam.mp3', 0.9);
      }
    } else {
      this._playFile('dano_do_beam.mp3', 0.9);
    }
    this._playFile('dano_do_beam.mp3', 0.7);
  }

  // Ki Beam Blast (music/dbz-beam-fx.wav)
  playBeamBlast() {
    this._playFile('dbz-beam-fx.wav', 0.85);
  }

  // Energy Beam Impact Damage (music/dano_do_beam.mp3)
  playBeamDamage() {
    this._playFile('dano_do_beam.mp3', 0.85);
  }

  // Awaken Transformation Roar (music/awakening.mp3)
  playAwaken() {
    this._playFile('awakening.mp3', 0.9);
  }

  // Defense / Reaction Card Clash SFX
  playCardClash() {
    this.playPunch();
    this.playClashPunches(650);
  }

  // Menu Theme BGM (music/soundtrack.mp3)
  playMenuTheme() {
    if (this.isMuted) return;
    const bgm = document.getElementById('app-bgm') || this.bgmAudio;
    if (!bgm) return;
    bgm.muted = false;
    bgm.volume = 0.35;
    if (bgm.src && bgm.src.includes('soundtrack.mp3') && !bgm.paused) return;
    bgm.src = 'music/soundtrack.mp3';
    bgm.play().catch(() => {});
  }

  // Battle Theme BGM (music/battle1.mp3 or music/battle2.mp3)
  playBattleTheme() {
    if (this.isMuted) return;
    const bgm = document.getElementById('app-bgm') || this.bgmAudio;
    if (!bgm) return;
    bgm.muted = false;
    bgm.volume = 0.35;
    const battleTrack = Math.random() > 0.5 ? 'music/battle1.mp3' : 'music/battle2.mp3';
    bgm.src = battleTrack;
    bgm.play().catch(() => {});
  }

  // Aliases for compatibility
  playAttack() { this.playPunch(); }
  hit() { this.playPunch(); }
  kamehameha() { this.playBeamBlast(); }
  genkidama() { this.playBeamDamage(); }
  kiBlast() { this.playBeamBlast(); }
  counter() { this.playCardClash(); }
}

export const soundEngine = new SoundEngine();

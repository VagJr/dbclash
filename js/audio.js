/* ==========================================================================
   Dragon Ball Clash Action TCG - Web Audio API Sound Synthesizer
   Zero-dependency real-time audio generation for instant DBZ sound effects
   ========================================================================== */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.bgmAudio = null;
    if (typeof window !== 'undefined') {
      this.bgmAudio = new Audio();
      this.bgmAudio.loop = true;
      this.bgmAudio.volume = 0.4;
    }

    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        this.init();
        if (this.bgmAudio && this.bgmAudio.src && this.bgmAudio.paused) {
          this.bgmAudio.play().catch(() => {});
        }
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('click', unlockAudio);
      };
      window.addEventListener('pointerdown', unlockAudio);
      window.addEventListener('keydown', unlockAudio);
      window.addEventListener('click', unlockAudio);
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

  // Button Click SFX
  playClick() {
    if (this.isMuted) return;
    this.init();
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

  // Card Play Chime
  playCardPlay() {
    if (this.isMuted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, this.ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, this.ctx.currentTime + 0.04); // E5
    osc.frequency.setValueAtTime(783.99, this.ctx.currentTime + 0.08); // G5

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  // Ki Charge Aura Hum & Rise
  playKiCharge() {
    if (this.isMuted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(480, this.ctx.currentTime + 0.4);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.45);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.45);
  }

  // Z-Vanish Teleport Whistle (Fast Pitch Sweep)
  playZVanish() {
    if (this.isMuted) return;
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1800, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  // Heavy Physical Punch Impact
  playPunch() {
    if (this.isMuted) return;
    this.init();
    
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.1);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    whiteNoise.start();
    whiteNoise.stop(this.ctx.currentTime + 0.1);
  }

  // Kamehameha / Energy Beam Blast Explosion
  playBeamBlast() {
    if (this.isMuted) return;
    this.init();
    
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(150, this.ctx.currentTime);
    subOsc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.5);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);

    subOsc.start();
    subOsc.stop(this.ctx.currentTime + 0.5);

    this.playPunch();
  }

  // Shield Break Shatter SFX
  playShieldBreak() {
    if (this.isMuted) return;
    this.init();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.25);

    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
  }

  // Awaken Transformation Roar
  playAwaken() {
    if (this.isMuted) return;
    this.init();

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'square';

    osc1.frequency.setValueAtTime(100, this.ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(600, this.ctx.currentTime + 0.8);

    osc2.frequency.setValueAtTime(105, this.ctx.currentTime);
    osc2.frequency.linearRampToValueAtTime(610, this.ctx.currentTime + 0.8);

    gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.35, this.ctx.currentTime + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 1.0);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(this.ctx.currentTime + 1.0);
    osc2.stop(this.ctx.currentTime + 1.0);
  }

  // Menu Theme BGM (music/soundtrack.mp3)
  playMenuTheme() {
    if (this.isMuted || !this.bgmAudio) return;
    if (this.bgmAudio.src.includes('soundtrack.mp3') && !this.bgmAudio.paused) return;
    this.bgmAudio.src = 'music/soundtrack.mp3';
    this.bgmAudio.play().catch(() => {});
  }

  // Battle Theme BGM (music/battle1.mp3 or music/battle2.mp3)
  playBattleTheme() {
    if (this.isMuted || !this.bgmAudio) return;
    const battleTrack = Math.random() > 0.5 ? 'music/battle1.mp3' : 'music/battle2.mp3';
    this.bgmAudio.src = battleTrack;
    this.bgmAudio.play().catch(() => {});
  }

  // Aliases for compatibility
  playAttack() { this.playPunch(); }
  hit() { this.playPunch(); }
  kamehameha() { this.playBeamBlast(); }
  genkidama() { this.playBeamBlast(); }
  kiBlast() { this.playPunch(); }
  counter() { this.playShieldBreak(); }
}

export const soundEngine = new SoundEngine();

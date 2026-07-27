/* ==========================================================================
   Dragon Ball Clash Action TCG - Anime Visual FX & Canvas Engine
   High-performance particle, energy beam & anime clash renderer for DBZ visual juice
   ========================================================================== */

export class FXEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.particles = [];
    this.activeBeams = [];
    this.activePillars = [];
    this.afterimages = [];
    this.activeOrbs = [];
    this.activeClash = null;

    if (this.canvas) {
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
      this.startLoop();
    }
  }

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  startLoop() {
    const loop = () => {
      this.updateAndRender();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  updateAndRender() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = this.activeBeams.length - 1; i >= 0; i--) {
      const b = this.activeBeams[i];
      b.life -= 0.035;
      if (b.life <= 0) {
        this.activeBeams.splice(i, 1);
      } else {
        this.renderAnimeBeam(b);
      }
    }

    // 4. Render Active Moving Orbs / Projectiles / Discs (Genki Dama, Supernova, Kienzan, etc.)
    for (let i = this.activeOrbs.length - 1; i >= 0; i--) {
      const orb = this.activeOrbs[i];
      orb.life -= orb.speed || 0.035;
      if (orb.life <= 0) {
        this.activeOrbs.splice(i, 1);
        for (let p = 0; p < 35; p++) {
          const angle = Math.random() * Math.PI * 2;
          const spd = Math.random() * 14 + 4;
          this.particles.push({
            x: orb.toX, y: orb.toY,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            radius: Math.random() * 8 + 3,
            color: orb.color || '#00f2fe',
            alpha: 1.0
          });
        }
      } else {
        const progress = 1.0 - orb.life;
        const curX = orb.fromX + (orb.toX - orb.fromX) * progress;
        const curY = orb.fromY + (orb.toY - orb.fromY) * progress;

        this.ctx.save();
        if (orb.type === 'genkiDama') {
          // Giant Spirit Bomb sphere (r = 50px) traveling vertically
          const r = 50 + Math.sin(Date.now() * 0.02) * 6;
          const grad = this.ctx.createRadialGradient(curX, curY, 5, curX, curY, r);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.3, '#00f2fe');
          grad.addColorStop(0.7, '#1fa2ff');
          grad.addColorStop(1, 'rgba(0, 242, 254, 0)');
          this.ctx.fillStyle = grad;
          this.ctx.beginPath();
          this.ctx.arc(curX, curY, r, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (orb.type === 'supernova') {
          // Planet-destroying Sun Sphere
          const r = 56 + Math.sin(Date.now() * 0.03) * 8;
          const grad = this.ctx.createRadialGradient(curX, curY, 5, curX, curY, r);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.3, '#ffd700');
          grad.addColorStop(0.7, '#ef4444');
          grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
          this.ctx.fillStyle = grad;
          this.ctx.beginPath();
          this.ctx.arc(curX, curY, r, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (orb.type === 'kienzan') {
          // Razor golden disc
          this.ctx.translate(curX, curY);
          this.ctx.rotate(Date.now() * 0.04);
          this.ctx.fillStyle = '#ffd700';
          this.ctx.beginPath();
          this.ctx.arc(0, 0, 26, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.strokeStyle = '#ffffff';
          this.ctx.lineWidth = 4;
          this.ctx.stroke();
        } else if (orb.type === 'meteorBarrage') {
          // 3 flaming meteor streaks
          for (let offset of [-28, 0, 28]) {
            this.ctx.fillStyle = '#ff8c00';
            this.ctx.beginPath();
            this.ctx.arc(curX + offset, curY, 14, 0, Math.PI * 2);
            this.ctx.fill();
          }
        } else if (orb.type === 'spiritSword') {
          // Golden Energy Sword
          this.ctx.strokeStyle = '#ffd700';
          this.ctx.lineWidth = 18;
          this.ctx.beginPath();
          this.ctx.moveTo(orb.fromX, orb.fromY);
          this.ctx.lineTo(curX, curY);
          this.ctx.stroke();
        }
        this.ctx.restore();
      }
    }

    // 5. Render Active Beam Clash Tug-of-War
    if (this.activeClash && this.activeClash.life > 0) {
      this.renderClashTugOfWar(this.activeClash);
      this.activeClash.life -= 0.016;
    }

    // 6. Render Shockwave & Particle Explosions
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.alpha -= 0.025;
      pt.radius = Math.max(0, pt.radius - 0.1);

      if (pt.alpha <= 0 || pt.radius <= 0) {
        this.particles.splice(i, 1);
      } else {
        this.ctx.save();
        this.ctx.globalAlpha = pt.alpha;
        this.ctx.fillStyle = pt.color;
        this.ctx.beginPath();
        this.ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
    }
  }

  // ── Render Individual Anime Beam ───────────────────────────────────────
  renderAnimeBeam(b) {
    const time = Date.now() * 0.012;
    this.ctx.save();
    this.ctx.globalAlpha = Math.min(1.0, b.life * 1.2);

    // Outer Aura Glow
    this.ctx.strokeStyle = b.glowColor;
    this.ctx.lineWidth = b.thickness + 32;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(b.fromX, b.fromY);
    this.ctx.lineTo(b.toX, b.toY);
    this.ctx.stroke();

    // Inner Secondary Core
    this.ctx.strokeStyle = b.secondaryColor;
    this.ctx.lineWidth = b.thickness + 12;
    this.ctx.beginPath();
    this.ctx.moveTo(b.fromX, b.fromY);
    this.ctx.lineTo(b.toX, b.toY);
    this.ctx.stroke();

    // Intense White Inner Beam
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = Math.max(4, b.thickness - 12);
    this.ctx.beginPath();
    this.ctx.moveTo(b.fromX, b.fromY);
    this.ctx.lineTo(b.toX, b.toY);
    this.ctx.stroke();

    // Spiraling Double-Helix Energy Ribbons
    const dx = b.toX - b.fromX;
    const dy = b.toY - b.fromY;
    const dist = Math.hypot(dx, dy);
    const steps = 24;

    this.ctx.strokeStyle = b.helixColor || '#ffffff';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = b.fromX + dx * t;
      const py = b.fromY + dy * t + Math.sin(t * Math.PI * 6 + time) * (b.thickness * 0.7);
      if (i === 0) this.ctx.moveTo(px, py);
      else this.ctx.lineTo(px, py);
    }
    this.ctx.stroke();

    // Charging Sphere at Source
    this.ctx.fillStyle = b.glowColor;
    this.ctx.beginPath();
    this.ctx.arc(b.fromX, b.fromY, b.thickness + 16, 0, Math.PI * 2);
    this.ctx.fill();

    // Impact Blast Orb at Destination
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(b.toX, b.toY, b.thickness + 24, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  // ── Render Dynamic Vertical Beam Clash Tug-of-War ─────────────────────────
  renderClashTugOfWar(clash) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Player 1 (Bottom HUD) to Player 2 (Top HUD) vertical vector
    const p1X = w / 2;
    const p1Y = h - 140;
    const p2X = w / 2;
    const p2Y = 130;

    // Calculate dynamic clash point based on player mashing percentage (0 - 100%)
    const pct = Math.max(0, Math.min(100, clash.p1Progress)) / 100;
    const clashX = w / 2;
    const clashY = p1Y + (p2Y - p1Y) * pct;

    this.ctx.save();

    // Player Beam (Left to Clash Point)
    this.ctx.strokeStyle = clash.p1Color || '#00f2fe';
    this.ctx.lineWidth = 40;
    this.ctx.beginPath();
    this.ctx.moveTo(p1X, p1Y);
    this.ctx.lineTo(clashX, clashY);
    this.ctx.stroke();

    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 18;
    this.ctx.beginPath();
    this.ctx.moveTo(p1X, p1Y);
    this.ctx.lineTo(clashX, clashY);
    this.ctx.stroke();

    // Opponent Beam (Right to Clash Point)
    this.ctx.strokeStyle = clash.p2Color || '#ffd700';
    this.ctx.lineWidth = 40;
    this.ctx.beginPath();
    this.ctx.moveTo(p2X, p2Y);
    this.ctx.lineTo(clashX, clashY);
    this.ctx.stroke();

    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 18;
    this.ctx.beginPath();
    this.ctx.moveTo(p2X, p2Y);
    this.ctx.lineTo(clashX, clashY);
    this.ctx.stroke();

    // Blinding Collision Explosion Orb at Clash Point
    const pulseRadius = 50 + Math.sin(Date.now() * 0.02) * 12;
    const grad = this.ctx.createRadialGradient(clashX, clashY, 10, clashX, clashY, pulseRadius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, clash.p1Color || '#00f2fe');
    grad.addColorStop(0.8, clash.p2Color || '#ffd700');
    grad.addColorStop(1, 'transparent');

    this.ctx.fillStyle = grad;
    this.ctx.beginPath();
    this.ctx.arc(clashX, clashY, pulseRadius, 0, Math.PI * 2);
    this.ctx.fill();

    // Electric Arc Lightning Sparks
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const len = Math.random() * 60 + 20;
      this.ctx.strokeStyle = Math.random() > 0.5 ? '#ffffff' : '#ffd700';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(clashX, clashY);
      this.ctx.lineTo(clashX + Math.cos(angle) * len, clashY + Math.sin(angle) * len);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  // ── Public Anime Visual Triggers ───────────────────────────────────────
  fireKamehameha(fromX, fromY, toX, toY, isGolden = false) {
    const glowColor = isGolden ? 'rgba(255, 215, 0, 0.9)' : 'rgba(0, 242, 254, 0.9)';
    const secondaryColor = isGolden ? '#ff8c00' : '#00bfff';
    const helixColor = isGolden ? '#ffffff' : '#e0f7fa';

    this.activeBeams.push({
      fromX, fromY, toX, toY,
      thickness: isGolden ? 45 : 32,
      glowColor,
      secondaryColor,
      helixColor,
      life: 1.0
    });

    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 10 + 3;
      this.particles.push({
        x: toX,
        y: toY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 7 + 3,
        color: isGolden ? '#ffd700' : '#00f2fe',
        alpha: 1.0
      });
    }
  }

  fireFinalFlash(fromX, fromY, toX, toY) {
    // Massive Double-Wide Golden Beam with Electrical Discharges
    this.activeBeams.push({
      fromX, fromY, toX, toY,
      thickness: 52,
      glowColor: 'rgba(255, 215, 0, 0.95)',
      secondaryColor: '#ff8c00',
      helixColor: '#ffffff',
      life: 1.2
    });

    // Lightning arcs along destination
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 14 + 5;
      this.particles.push({
        x: toX,
        y: toY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 8 + 4,
        color: Math.random() > 0.5 ? '#ffd700' : '#ffffff',
        alpha: 1.0
      });
    }
  }

  fireGenkiDama(fromX, fromY, toX, toY) {
    // Spirit Bomb Expansion & Impact
    const cx = (fromX + toX) / 2;
    const cy = (fromY + toY) / 2;
    this.activePillars.push({
      x: cx, y: cy + 40,
      width: 120,
      height: 160,
      color: 'rgba(0, 242, 254, 0.9)',
      alpha: 1.0
    });

    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 16 + 6;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 9 + 4,
        color: Math.random() > 0.5 ? '#1fa2ff' : '#00f2fe',
        alpha: 1.0
      });
    }
  }

  fireDeathBeam(fromX, fromY, toX, toY) {
    // Sharp Piercing Crimson Laser Thread
    this.activeBeams.push({
      fromX, fromY, toX, toY,
      thickness: 14,
      glowColor: 'rgba(255, 0, 85, 0.95)',
      secondaryColor: '#a855f7',
      helixColor: '#ffffff',
      life: 0.8
    });

    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 12 + 4;
      this.particles.push({
        x: toX, y: toY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 6 + 2,
        color: '#ff0055',
        alpha: 1.0
      });
    }
  }

  fireSpecialBeam(fromX, fromY, toX, toY) {
    // Makankosappo Double-Helix Spiral Drill
    this.activeBeams.push({
      fromX, fromY, toX, toY,
      thickness: 24,
      glowColor: 'rgba(168, 85, 247, 0.9)',
      secondaryColor: '#ffd700',
      helixColor: '#ffffff',
      life: 1.0
    });

    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 11 + 3;
      this.particles.push({
        x: toX, y: toY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 6 + 3,
        color: '#a855f7',
        alpha: 1.0
      });
    }
  }

  fireMasenko(fromX, fromY, toX, toY) {
    // Amber/Orange Dual Energy Blast
    this.activeBeams.push({
      fromX, fromY, toX, toY,
      thickness: 30,
      glowColor: 'rgba(255, 140, 0, 0.9)',
      secondaryColor: '#ffd700',
      helixColor: '#ffffff',
      life: 0.9
    });

    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 10 + 3;
      this.particles.push({
        x: toX, y: toY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 6 + 3,
        color: '#ff8c00',
        alpha: 1.0
      });
    }
  }

  fireBigBang(fromX, fromY, toX, toY) {
    // Royal Blue Orb Explosion
    this.activeBeams.push({
      fromX, fromY, toX, toY,
      thickness: 38,
      glowColor: 'rgba(0, 200, 255, 0.9)',
      secondaryColor: '#3b82f6',
      helixColor: '#ffffff',
      life: 1.0
    });

    this.triggerImpactHit(toX, toY);
  }

  fireBurningAttack(fromX, fromY, toX, toY) {
    // Flame-Burst Energy Wave
    this.activeBeams.push({
      fromX, fromY, toX, toY,
      thickness: 36,
      glowColor: 'rgba(255, 87, 34, 0.9)',
      secondaryColor: '#ffd700',
      helixColor: '#ffffff',
      life: 1.0
    });
  }

  fireMeteorCombination(fromX, fromY, toX, toY) {
    this.activeOrbs.push({
      type: 'meteorBarrage',
      fromX, fromY, toX, toY,
      speed: 0.045,
      color: '#ff8c00',
      life: 1.0
    });
    this.triggerImpactHit(toX, toY);
  }

  fireSupernova(fromX, fromY, toX, toY) {
    this.activeOrbs.push({
      type: 'supernova',
      fromX, fromY, toX, toY,
      speed: 0.025,
      color: '#ef4444',
      life: 1.0
    });
  }

  fireKienzan(fromX, fromY, toX, toY) {
    this.activeOrbs.push({
      type: 'kienzan',
      fromX, fromY, toX, toY,
      speed: 0.05,
      color: '#ffd700',
      life: 1.0
    });
  }

  fireKikoho(fromX, fromY, toX, toY) {
    this.activeBeams.push({
      fromX, fromY, toX, toY,
      thickness: 44,
      glowColor: 'rgba(255, 215, 0, 0.95)',
      secondaryColor: '#ffffff',
      life: 1.0
    });
    this.triggerImpactHit(toX, toY);
  }

  fireDragonFist(fromX, fromY, toX, toY) {
    this.activeBeams.push({
      fromX, fromY, toX, toY,
      thickness: 48,
      glowColor: 'rgba(255, 140, 0, 0.95)',
      secondaryColor: '#ffd700',
      life: 1.1
    });
    this.triggerImpactHit(toX, toY);
  }

  fireSpiritSword(fromX, fromY, toX, toY) {
    this.activeOrbs.push({
      type: 'spiritSword',
      fromX, fromY, toX, toY,
      speed: 0.04,
      color: '#ffd700',
      life: 1.0
    });
  }

  fireSolarFlare(x = window.innerWidth / 2, y = window.innerHeight / 2) {
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 18 + 5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 10 + 4,
        color: '#ffffff',
        alpha: 1.0
      });
    }
  }

  fireTimeSkip(x = window.innerWidth / 2, y = window.innerHeight / 2) {
    this.triggerZVanish(x, y, '#a78bfa');
  }

  triggerBeamClash(p1Progress, p1Color = '#00f2fe', p2Color = '#ffd700') {
    this.activeClash = {
      p1Progress,
      p1Color,
      p2Color,
      life: 1.0
    };
  }

  triggerZVanish(x, y, color = '#00f2fe') {
    for (let i = 0; i < 5; i++) {
      this.afterimages.push({
        x: x + (Math.random() * 50 - 25),
        y: y + (Math.random() * 50 - 25),
        radius: 38,
        color,
        alpha: 0.95
      });
    }
  }

  spawnKiAura(x, y, color = '#ffd700') {
    this.activePillars.push({
      x, y,
      width: 45,
      height: 70,
      color,
      alpha: 1.0
    });
  }

  triggerImpactHit(x, y) {
    for (let i = 0; i < 25; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 12 + 4;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: Math.random() * 6 + 2,
        color: Math.random() > 0.5 ? '#ff3b30' : '#ffd700',
        alpha: 1.0
      });
    }
  }

  triggerAwakenBurst(x, color = '#ffd700') {
    this.spawnKiAura(x, 400, color);
    this.triggerImpactHit(x, 300);
  }
}

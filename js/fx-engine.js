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
    this.activeClash = null;
    this.lightningArcs = [];

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.animating = false;
    this.startLoop();
  }

  resizeCanvas() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  startLoop() {
    if (this.animating) return;
    this.animating = true;
    const loop = () => {
      this.updateAndRender();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  updateAndRender() {
    if (!this.ctx || !this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    // 1. Render Z-Vanish Afterimage Ghosts
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const img = this.afterimages[i];
      img.alpha -= 0.04;
      if (img.alpha <= 0) {
        this.afterimages.splice(i, 1);
      } else {
        this.ctx.save();
        this.ctx.globalAlpha = img.alpha * 0.6;
        this.ctx.fillStyle = img.color || '#00f2fe';
        this.ctx.beginPath();
        this.ctx.arc(img.x, img.y, img.radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Speed trailing lines
        this.ctx.strokeStyle = img.color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(img.x - 40, img.y);
        this.ctx.lineTo(img.x + 40, img.y);
        this.ctx.stroke();
        this.ctx.restore();
      }
    }

    // 2. Render Ki Aura Flame Pillars
    for (let i = this.activePillars.length - 1; i >= 0; i--) {
      const p = this.activePillars[i];
      p.alpha -= 0.025;
      p.height += 10;
      p.width += 3;
      if (p.alpha <= 0) {
        this.activePillars.splice(i, 1);
      } else {
        this.ctx.save();
        this.ctx.globalAlpha = p.alpha;
        const grad = this.ctx.createLinearGradient(p.x, p.y, p.x, p.y - p.height);
        grad.addColorStop(0, p.color);
        grad.addColorStop(0.5, 'rgba(255, 215, 0, 0.4)');
        grad.addColorStop(1, 'transparent');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(p.x - p.width / 2, p.y - p.height, p.width, p.height);
        this.ctx.restore();
      }
    }

    // 3. Render Active Energy Beams (Kamehameha / Final Flash / Death Beam)
    for (let i = this.activeBeams.length - 1; i >= 0; i--) {
      const b = this.activeBeams[i];
      b.life -= 0.035;
      if (b.life <= 0) {
        this.activeBeams.splice(i, 1);
      } else {
        this.renderAnimeBeam(b);
      }
    }

    // 4. Render Active Beam Clash Tug-of-War
    if (this.activeClash && this.activeClash.life > 0) {
      this.renderClashTugOfWar(this.activeClash);
      this.activeClash.life -= 0.016;
    }

    // 5. Render Shockwave & Particle Explosions
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

    // Secondary Energy Layer
    this.ctx.strokeStyle = b.secondaryColor || '#00f2fe';
    this.ctx.lineWidth = b.thickness + 12;
    this.ctx.beginPath();
    this.ctx.moveTo(b.fromX, b.fromY);
    this.ctx.lineTo(b.toX, b.toY);
    this.ctx.stroke();

    // Inner Blinding White Core
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = b.thickness;
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

  // ── Render Dynamic Beam Clash Tug-of-War ───────────────────────────────
  renderClashTugOfWar(clash) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    const p1X = 120;
    const p1Y = h * 0.75;
    const p2X = w - 120;
    const p2Y = h * 0.25;

    // Calculate dynamic clash point based on player mashing percentage (0 - 100%)
    const pct = Math.max(0, Math.min(100, clash.p1Progress)) / 100;
    const clashX = p1X + (p2X - p1X) * pct;
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
  fireKamehameha(fromX, fromY, toX, toY, isGolden = false, color = '#00f2fe') {
    const glowColor = isGolden ? 'rgba(255, 215, 0, 0.9)' : 'rgba(0, 242, 254, 0.9)';
    const secondaryColor = isGolden ? '#ff8800' : '#00b4d8';
    const helixColor = '#ffffff';

    this.activeBeams.push({
      fromX, fromY, toX, toY,
      thickness: 32,
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

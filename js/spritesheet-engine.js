/* ==========================================================================
   Dragon Ball Clash Action TCG — 2D SpriteSheet Animation Framework
   High-performance frame-exact 2D sprite sheet loader and renderer
   ========================================================================== */

export class SpriteSheet {
  constructor(imageUrl, frameWidth = 64, frameHeight = 64, totalFrames = 1) {
    this.imageUrl = imageUrl;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.totalFrames = totalFrames;
    this.image = new Image();
    this.loaded = false;

    this.image.onload = () => {
      this.loaded = true;
    };
    this.image.src = imageUrl;
  }
}

export class SpriteInstance {
  constructor(spriteSheet, options = {}) {
    this.spriteSheet = spriteSheet;
    this.startFrame = options.startFrame || 0;
    this.endFrame = options.endFrame || (spriteSheet.totalFrames - 1);
    this.currentFrame = this.startFrame;
    this.fps = options.fps || 10;
    this.loop = options.loop !== undefined ? options.loop : true;
    this.scale = options.scale || 1.0;
    this.flipX = options.flipX || false;
    this.onComplete = options.onComplete || null;

    this.lastFrameTime = performance.now();
    this.finished = false;
  }

  setAnimation(startFrame, endFrame, loop = true, fps = 10, onComplete = null) {
    this.startFrame = startFrame;
    this.endFrame = endFrame;
    this.currentFrame = startFrame;
    this.loop = loop;
    this.fps = fps;
    this.onComplete = onComplete;
    this.finished = false;
    this.lastFrameTime = performance.now();
  }

  update(now = performance.now()) {
    if (this.finished || !this.spriteSheet.loaded) return;

    const frameInterval = 1000 / this.fps;
    if (now - this.lastFrameTime >= frameInterval) {
      this.lastFrameTime = now;
      if (this.currentFrame < this.endFrame) {
        this.currentFrame++;
      } else {
        if (this.loop) {
          this.currentFrame = this.startFrame;
        } else {
          this.finished = true;
          if (typeof this.onComplete === 'function') {
            this.onComplete();
          }
        }
      }
    }
  }

  draw(ctx, x, y) {
    if (!this.spriteSheet.loaded || !ctx) return;

    const fw = this.spriteSheet.frameWidth;
    const fh = this.spriteSheet.frameHeight;
    const sourceX = this.currentFrame * fw;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    ctx.translate(x, y);
    if (this.flipX) {
      ctx.scale(-1, 1);
    }
    ctx.scale(this.scale, this.scale);

    ctx.drawImage(
      this.spriteSheet.image,
      sourceX, 0, fw, fh,
      -fw / 2, -fh / 2, fw, fh
    );

    ctx.restore();
  }
}

export class SpriteSheetEngine {
  constructor() {
    this.sheets = new Map();
    this.instances = [];
  }

  loadSheet(key, url, frameWidth = 64, frameHeight = 64, totalFrames = 1) {
    if (!this.sheets.has(key)) {
      this.sheets.set(key, new SpriteSheet(url, frameWidth, frameHeight, totalFrames));
    }
    return this.sheets.get(key);
  }

  createInstance(sheetKey, options = {}) {
    const sheet = this.sheets.get(sheetKey);
    if (!sheet) {
      console.warn(`[SpriteSheetEngine] Sheet not found: ${sheetKey}`);
      return null;
    }
    const instance = new SpriteInstance(sheet, options);
    this.instances.push(instance);
    return instance;
  }

  updateAndRenderAll(ctx, now = performance.now()) {
    for (let i = this.instances.length - 1; i >= 0; i--) {
      const inst = this.instances[i];
      inst.update(now);
      if (inst.finished && !inst.loop) {
        this.instances.splice(i, 1);
      }
    }
  }
}

export const spriteEngine = new SpriteSheetEngine();

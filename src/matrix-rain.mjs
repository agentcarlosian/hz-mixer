const MATRIX_GLYPHS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ\uFF71\uFF72\uFF73\uFF74\uFF75\uFF76\uFF77\uFF78\uFF79\uFF7A';
const MATRIX_CELL = 24;

export function createRainStreams(width, height) {
  const count = Math.min(96, Math.max(1, Math.ceil(width / 30)));
  return Array.from({ length: count }, (_, index) => {
    const length = 12 + index * 7 % 15;
    return { x: (index + .5) * width / count, length, speed: 24 + index * 17 % 33, offset: index * 137 % (height + length * MATRIX_CELL) };
  });
}

export class MatrixRain {
  constructor(canvas, onChange = () => {}) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.onChange = onChange;
    this.media = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.active = false; this.paused = false; this.frame = null;
    this.elapsed = 0; this.lastTime = null; this.lastPaint = null;
    this.width = 0; this.height = 0; this.ratio = 0; this.streams = [];
    this.tick = (time) => {
      this.frame = null;
      if (!this.shouldRun()) return;
      if (this.lastTime !== null) this.elapsed += Math.min(.1, Math.max(0, (time - this.lastTime) / 1000));
      this.lastTime = time;
      if (this.lastPaint === null || time - this.lastPaint >= 50) { this.draw(); this.lastPaint = time; }
      this.frame = requestAnimationFrame(this.tick);
    };
    this.sync = this.sync.bind(this);
    this.media.addEventListener('change', this.sync);
    document.addEventListener('visibilitychange', this.sync);
    window.addEventListener('resize', this.sync);
  }

  shouldRun() { return Boolean(this.context) && this.active && !this.paused && !this.media.matches && !document.hidden; }

  setActive(active) { if (this.active !== active) { this.active = active; this.sync(); } }
  setPaused(paused) { if (this.paused !== paused) { this.paused = paused; this.sync(); } }

  sync() {
    const visible = Boolean(this.context) && this.active && !this.media.matches;
    const wasHidden = this.canvas.hidden;
    this.canvas.hidden = !visible;
    if (visible) {
      const width = window.innerWidth, height = window.innerHeight, ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      if (width !== this.width || height !== this.height || ratio !== this.ratio) {
        this.width = width; this.height = height; this.ratio = ratio;
        this.canvas.width = Math.ceil(width * ratio); this.canvas.height = Math.ceil(height * ratio);
        this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
        this.context.font = '18px Consolas, monospace'; this.context.textBaseline = 'top';
        this.streams = createRainStreams(width, height);
        this.draw();
      } else if (wasHidden) this.draw();
    }
    if (this.shouldRun()) {
      if (this.frame === null) this.frame = requestAnimationFrame(this.tick);
    } else {
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      this.frame = null; this.lastTime = null; this.lastPaint = null;
      if (!visible && this.context) this.context.clearRect(0, 0, this.width, this.height);
    }
    this.onChange({ active: this.active, paused: this.paused, reduced: this.media.matches, supported: Boolean(this.context), running: this.shouldRun() });
  }

  draw() {
    const context = this.context;
    context.clearRect(0, 0, this.width, this.height);
    // Stable glyphs travel smoothly; they do not randomly flash between frames.
    this.streams.forEach((stream, column) => {
      const track = this.height + stream.length * MATRIX_CELL;
      const distance = this.elapsed * stream.speed + stream.offset;
      const head = distance % track, cycle = Math.floor(distance / track);
      for (let row = 0; row < stream.length; row++) {
        const y = head - row * MATRIX_CELL;
        if (y < -MATRIX_CELL || y > this.height) continue;
        context.globalAlpha = .12 + .78 * (1 - row / stream.length) ** 1.5;
        context.fillStyle = row === 0 ? '#b5ffcb' : '#4bd579';
        context.fillText(MATRIX_GLYPHS[(column * 17 + row * 11 + cycle * 7) % MATRIX_GLYPHS.length], stream.x, y);
      }
    });
    context.globalAlpha = 1;
  }
}

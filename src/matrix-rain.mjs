const MATRIX_KANJI = '\u97F3\u6CE2\u97FF\u9759\u5FC3\u5922\u7A7A\u5149\u96E8\u6C34\u6D41\u6D77\u68EE\u98A8\u96F7\u661F\u6708\u65E5\u5929\u96FB\u6C17\u529B\u4FE1\u53F7\u5468\u671F\u4F4D\u76F8\u5DE6\u53F3\u4E2D\u6DF1\u7DD1\u9752\u5B66\u66F8\u77E5\u8B58\u6DF7\u5408';
const MATRIX_KANA = Array.from({ length: 56 }, (_, index) => String.fromCharCode(0xFF66 + index)).join('');
const MATRIX_LATIN = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MATRIX_WORDS = ['BINAURAL', 'BEAT', 'MIXER', 'MONAURAL', 'ISOCHRONIC', 'CARRIER', 'PULSE', 'AUDIO', 'FREQUENCY', 'DELTA', 'THETA', 'ALPHA', 'BETA', 'GAMMA', 'WAVE', 'SPECTRUM', 'STREAM', 'WATERFALL', 'THUNDER', 'NOISE', 'STEREO', 'SIGNAL', 'SESSION', 'HZ'];
const MATRIX_CELL = 24;

export function createRainGlyphs(column, cycle, length) {
  let seed = (Math.imul(column + 1, 0x9E3779B1) ^ Math.imul(cycle + 1, 0x85EBCA6B)) || 1;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  const glyphs = Array.from({ length }, () => {
    const kind = random() % 10;
    const pool = kind < 6 ? MATRIX_KANJI : kind < 8 ? MATRIX_KANA : MATRIX_LATIN;
    return pool[random() % pool.length];
  });
  if ((column + cycle) % 2 === 0) {
    const word = MATRIX_WORDS[(Math.floor(column / 2) + cycle * 5) % MATRIX_WORDS.length];
    glyphs.splice(length - word.length - 1, word.length, ...word);
  }
  return glyphs;
}

export function createRainStreams(width, height) {
  const count = Math.min(96, Math.max(1, Math.ceil(width / 30)));
  return Array.from({ length: count }, (_, index) => {
    const length = 12 + index * 7 % 15;
    return { x: (index + .5) * width / count, length, speed: 24 + index * 17 % 33, offset: index * 137 % (height + length * MATRIX_CELL), cycle: 0, glyphs: createRainGlyphs(index, 0, length) };
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
        this.context.font = '18px Consolas, "Yu Gothic", "Hiragino Kaku Gothic ProN", "Noto Sans CJK JP", monospace';
        this.context.textBaseline = 'top'; this.context.textAlign = 'center';
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
      if (stream.cycle !== cycle) { stream.glyphs = createRainGlyphs(column, cycle, stream.length); stream.cycle = cycle; }
      for (let row = 0; row < stream.length; row++) {
        const y = head - row * MATRIX_CELL;
        if (y < -MATRIX_CELL || y > this.height) continue;
        context.globalAlpha = .12 + .78 * (1 - row / stream.length) ** 1.5;
        context.fillStyle = row === 0 ? '#b5ffcb' : '#4bd579';
        context.fillText(stream.glyphs[stream.length - 1 - row], stream.x, y);
      }
    });
    context.globalAlpha = 1;
  }
}

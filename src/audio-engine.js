import { SOUNDS, NOISES } from './mix-state.mjs';
import { audioBytes } from './resources.js';
import { toneGraph, outputGraph, loopBuffer, noiseBuffer, bufferLayer, setLayerLevels } from './audio-graph.mjs';
import { sessionSeconds, scheduleEnvelope, signalError } from './program.mjs';

export class AudioEngine {
  constructor(onTrackState = () => {}) {
    this.context = null; this.tone = null; this.layers = new Map(); this.buffers = new Map();
    this.playing = false; this.position = 0; this.anchor = 0; this.onTrackState = onTrackState; this.generation = 0; this.stopGeneration = 0; this.stopping = false;
  }
  initialize() {
    if (this.context) return;
    const context = this.context = new AudioContext();
    this.analyser = context.createAnalyser(); this.analyser.fftSize = 2048;
    this.transport = context.createGain();
    this.transport.connect(this.analyser).connect(context.destination);
    this.output = outputGraph(context, this.mix, this.transport);
  }
  elapsed() { return this.position + (this.playing ? this.context.currentTime - this.anchor : 0); }
  async buffer(id) {
    this.initialize();
    if (!this.buffers.has(id)) {
      this.onTrackState(id, 'Loading');
      const task = (async () => {
        if (NOISES.some((noise) => noise.id === id)) return noiseBuffer(this.context, id);
        return loopBuffer(this.context, await this.context.decodeAudioData(await audioBytes(id)));
      })();
      this.buffers.set(id, task);
      task.catch(() => this.buffers.delete(id));
    }
    try { const buffer = await this.buffers.get(id); this.onTrackState(id, ''); return buffer; }
    catch { this.onTrackState(id, 'Unavailable'); throw new Error('Could not load ' + id + '.'); }
  }
  rebuildTone() {
    const now = this.context.currentTime;
    if (this.tone) {
      this.tone.output.gain.cancelScheduledValues(now);
      this.tone.output.gain.setTargetAtTime(0, now, .015);
      this.tone.stop(now + .08);
    }
    const from = this.elapsed();
    this.horizon = from + (sessionSeconds(this.mix) || 3600) + 1;
    this.tone = toneGraph(this.context, this.mix, this.output.master, from, now, this.horizon);
  }
  rescheduleEnvelope() {
    const now = this.context.currentTime, from = this.elapsed();
    this.output.envelope.gain.cancelScheduledValues(now);
    scheduleEnvelope(this.output.envelope.gain, this.mix, from, from + (sessionSeconds(this.mix) || 3600) + 1, now);
  }
  update(mix) {
    const old = this.mix;
    this.mix = structuredClone(mix);
    if (!this.context) return;
    if (this.playing && (old?.mode !== mix.mode || JSON.stringify(old?.pulse) !== JSON.stringify(mix.pulse) || JSON.stringify(old?.automation) !== JSON.stringify(mix.automation) || old?.beat !== mix.beat)) this.rebuildTone();
    if (old?.carrier !== mix.carrier) this.tone?.carrier(mix.carrier);
    if (old?.duration !== mix.duration || JSON.stringify(old?.fades) !== JSON.stringify(mix.fades) || JSON.stringify(old?.automation) !== JSON.stringify(mix.automation)) this.rescheduleEnvelope();
    if (this.playing) {
      for (const { id } of [...SOUNDS, ...NOISES]) {
        const enabled = (mix.sounds[id] || mix.noise[id]).enabled;
        if (enabled && !this.layers.has(id)) this.startLayer(id);
        else if (!enabled && this.layers.has(id)) {
          const layer = this.layers.get(id); this.layers.delete(id);
          if (layer.source) { layer.gain.gain.setTargetAtTime(0, this.context.currentTime, .03); layer.stop(this.context.currentTime + .15); }
        }
      }
    }
    setLayerLevels(this.context, mix, this.tone, this.layers, this.output.master);
  }
  async startLayer(id) {
    const token = this.generation, pending = {};
    this.layers.set(id, pending);
    try {
      const buffer = await this.buffer(id);
      if (token !== this.generation || this.layers.get(id) !== pending || !this.playing) return;
      this.layers.set(id, bufferLayer(this.context, buffer, this.output.master, this.elapsed()));
      setLayerLevels(this.context, this.mix, this.tone, this.layers, this.output.master);
    } catch { if (this.layers.get(id) === pending) this.layers.delete(id); }
  }
  async play(mix) {
    const error = signalError(mix); if (error) throw new Error(error);
    this.mix = structuredClone(mix); this.initialize();
    await this.context.resume();
    this.anchor = this.context.currentTime; this.playing = true; this.stopping = false;
    this.transport.gain.cancelScheduledValues(this.anchor); this.transport.gain.setValueAtTime(1, this.anchor);
    this.rebuildTone(); this.rescheduleEnvelope(); this.update(mix);
  }
  async pause() {
    if (!this.context) return;
    this.position = this.elapsed(); this.playing = false; this.generation++;
    this.tone?.stop(); this.tone = null;
    for (const layer of this.layers.values()) if (layer.source) layer.stop();
    this.layers.clear();
    await this.context.suspend();
  }
  async stop(immediate = false) {
    if (!this.context) { this.position = 0; return; }
    const generation = ++this.stopGeneration;
    if (this.playing && !immediate && this.mix.fades.out) {
      this.stopping = true;
      const now = this.context.currentTime;
      this.transport.gain.cancelScheduledValues(now); this.transport.gain.setValueAtTime(this.transport.gain.value, now);
      this.transport.gain.linearRampToValueAtTime(0, now + this.mix.fades.out);
      await new Promise((resolve) => setTimeout(resolve, this.mix.fades.out * 1000));
      if (generation !== this.stopGeneration) return;
    }
    await this.pause(); this.position = 0; this.stopping = false;
  }
  tick() {
    if (this.playing && this.elapsed() + 60 > this.horizon && !sessionSeconds(this.mix)) { this.rebuildTone(); setLayerLevels(this.context, this.mix, this.tone, this.layers, this.output.master); }
    return this.playing && sessionSeconds(this.mix) > 0 && this.elapsed() >= sessionSeconds(this.mix);
  }
  resetPosition() {
    this.position = 0;
    if (!this.context) return;
    this.anchor = this.context.currentTime;
    if (this.playing) { this.rebuildTone(); this.rescheduleEnvelope(); setLayerLevels(this.context, this.mix, this.tone, this.layers, this.output.master); }
  }
}

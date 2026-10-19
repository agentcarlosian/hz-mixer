import { SOUNDS, NOISES, BELLS, layerSettings } from './mix-state.mjs';
import { audioBytes } from './resources.js';
import { toneGraph, outputGraph, loopBuffer, noiseBuffer, bufferLayer, bellLayer, setLayerLevels } from './audio-graph.mjs';
import { sessionSeconds, scheduleEnvelope, signalError } from './program.mjs';
import { generatorSpecs, effectsFor } from './studio-state.mjs';
import { hasStudioLane } from './studio-program.mjs';

export class AudioEngine {
  constructor(onTrackState = () => {}) {
    this.context = null; this.tone = null; this.voices = new Map(); this.layers = new Map(); this.buffers = new Map();
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
        const decoded = await this.context.decodeAudioData(await audioBytes(id));
        return BELLS.some((bell) => bell.id === id) ? decoded : loopBuffer(this.context, decoded);
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
    for (const graph of this.voices.values()) { graph.output.gain.cancelScheduledValues(now); graph.output.gain.setTargetAtTime(0, now, .015); graph.stop(now + .08); }
    this.voices.clear();
    const from = this.elapsed();
    this.horizon = from + (sessionSeconds(this.mix) || 3600) + 1;
    this.tone = toneGraph(this.context, this.mix, this.output.master, from, now, this.horizon);
    for (const voice of generatorSpecs(this.mix)) if (voice.id !== 'tone' && voice.enabled) this.voices.set(voice.id, toneGraph(this.context, this.mix, this.output.master, from, now, this.horizon, voice.id));
  }
  levels() {
    setLayerLevels(this.context, this.mix, this.tone, this.layers, this.output.master, false, this.voices, { from: this.elapsed(), until: this.horizon || this.elapsed() + 3600, when: this.context.currentTime });
  }
  sourceEffectsActive(id) {
    const effects = effectsFor(this.mix, id);
    return effects.am.enabled || effects.pan.enabled || effects.filter.type !== 'off' && hasStudioLane(this.mix, id + ':filterFrequency');
  }
  replaceLayer(id) {
    const layer = this.layers.get(id), cursor = layer?.sourcePosition ? { position: layer.sourcePosition(), at: this.context.currentTime } : null;
    this.layers.delete(id);
    if (layer?.stop) { layer.gain.gain.setTargetAtTime(0, this.context.currentTime, .01); layer.stop(this.context.currentTime + .04); }
    this.startLayer(id, false, cursor);
  }
  refreshStudioLayers() {
    for (const { id } of [...SOUNDS, ...NOISES]) if (layerSettings(this.mix, id).enabled && this.sourceEffectsActive(id)) this.replaceLayer(id);
  }
  rescheduleEnvelope() {
    const now = this.context.currentTime, from = this.elapsed();
    this.output.envelope.gain.cancelScheduledValues(now);
    scheduleEnvelope(this.output.envelope.gain, this.mix, from, from + (sessionSeconds(this.mix) || 3600) + 1, now);
  }
  update(mix, initialBells = false) {
    const old = this.mix;
    this.mix = structuredClone(mix);
    if (!this.context) return;
    const structure = (value) => value?.studio ? JSON.stringify({ timbre: value.studio.timbre, pan: value.studio.pan, effects: ['tone', 'voice-2', 'voice-3'].map((id) => value.studio.effects[id]), voices: value.studio.voices.map(({ level, muted, solo, ...voice }) => voice) }) : '';
    if (this.playing && (old?.mode !== mix.mode || JSON.stringify(old?.pulse) !== JSON.stringify(mix.pulse) || JSON.stringify(old?.automation) !== JSON.stringify(mix.automation) || old?.beat !== mix.beat || old?.duration !== mix.duration || structure(old) !== structure(mix))) this.rebuildTone();
    if (old?.carrier !== mix.carrier) this.tone?.carrier(mix.carrier);
    if (old?.duration !== mix.duration || JSON.stringify(old?.fades) !== JSON.stringify(mix.fades) || JSON.stringify(old?.automation) !== JSON.stringify(mix.automation)) this.rescheduleEnvelope();
    if (this.playing) {
      for (const { id } of [...SOUNDS, ...NOISES, ...BELLS]) {
        const enabled = layerSettings(mix, id).enabled;
        if (mix.bells[id] && this.layers.has(id) && (old?.bells?.[id]?.interval !== mix.bells[id].interval || old?.duration !== mix.duration || JSON.stringify(old?.automation) !== JSON.stringify(mix.automation))) {
          const layer = this.layers.get(id); this.layers.delete(id); layer.stop?.();
        }
        const am = effectsFor(mix, id).am;
        if (!mix.bells[id] && enabled && this.layers.has(id) && (JSON.stringify(old?.studio?.effects[id]) !== JSON.stringify(mix.studio?.effects[id]) || this.sourceEffectsActive(id) && (JSON.stringify(old?.automation) !== JSON.stringify(mix.automation) || am.enabled && am.sync && (old?.beat !== mix.beat || old?.duration !== mix.duration)))) {
          this.replaceLayer(id); continue;
        }
        if (enabled && !this.layers.has(id)) this.startLayer(id, initialBells);
        else if (!enabled && this.layers.has(id)) {
          const layer = this.layers.get(id); this.layers.delete(id);
          if (layer.stop) { layer.gain.gain.setTargetAtTime(0, this.context.currentTime, .03); layer.stop(this.context.currentTime + .15); }
        }
      }
    }
    this.levels();
  }
  async startLayer(id, initialStrike = false, cursor = null) {
    const token = this.generation, pending = cursor ? { sourcePosition: () => cursor.position + this.context.currentTime - cursor.at } : {};
    this.layers.set(id, pending);
    try {
      const buffer = await this.buffer(id);
      if (token !== this.generation || this.layers.get(id) !== pending || !this.playing) return;
      const from = this.elapsed();
      this.layers.set(id, this.mix.bells[id]
        ? bellLayer(this.context, buffer, this.output.master, this.mix.bells[id].interval, from, from + 10800, this.context.currentTime, sessionSeconds(this.mix) || Infinity, initialStrike)
        : bufferLayer(this.context, buffer, this.output.master, from, this.context.currentTime, { mix: this.mix, id, until: this.horizon || from + 3600, sourceOffset: cursor ? cursor.position + this.context.currentTime - cursor.at : from }));
      this.levels();
    } catch { if (this.layers.get(id) === pending) this.layers.delete(id); }
  }
  async play(mix) {
    const error = signalError(mix); if (error) throw new Error(error);
    this.mix = structuredClone(mix); this.initialize();
    const contextError = signalError(mix, this.context.sampleRate); if (contextError) throw new Error(contextError);
    await this.context.resume();
    const current = this.mix;
    const currentError = signalError(current, this.context.sampleRate); if (currentError) throw new Error(currentError);
    this.anchor = this.context.currentTime; this.playing = true; this.stopping = false;
    this.transport.gain.cancelScheduledValues(this.anchor); this.transport.gain.setValueAtTime(1, this.anchor);
    this.rebuildTone(); this.rescheduleEnvelope(); this.update(current, this.position === 0);
  }
  async pause() {
    if (!this.context) return;
    this.position = this.elapsed(); this.playing = false; this.generation++;
    this.tone?.stop(); this.tone = null;
    for (const graph of this.voices.values()) graph.stop(); this.voices.clear();
    for (const layer of this.layers.values()) layer.stop?.();
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
    if (this.playing) for (const { id } of BELLS) {
      const layer = this.layers.get(id);
      if (layer?.extend && this.elapsed() + 60 > layer.until) layer.extend(this.elapsed() + 10800);
    }
    if (this.playing && this.elapsed() + 60 > this.horizon && !sessionSeconds(this.mix)) {
      this.rebuildTone();
      this.refreshStudioLayers();
      this.levels();
    }
    return this.playing && sessionSeconds(this.mix) > 0 && this.elapsed() >= sessionSeconds(this.mix);
  }
  resetPosition() {
    this.position = 0;
    if (!this.context) return;
    this.anchor = this.context.currentTime;
    if (this.playing) {
      this.rebuildTone(); this.rescheduleEnvelope();
      for (const { id } of BELLS) {
        this.layers.get(id)?.stop?.(); this.layers.delete(id);
        if (this.mix.bells[id].enabled) this.startLayer(id, true);
      }
      this.refreshStudioLayers();
      this.levels();
    }
  }
}

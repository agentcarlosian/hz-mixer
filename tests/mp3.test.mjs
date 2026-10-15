import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { MP3_BITRATES, mp3Error, planarPcm16, renderMp3 } from '../src/mp3-export.mjs';
import { defaultMix } from '../src/mix-state.mjs';

const root = new URL('../', import.meta.url);
test('MP3 validation reuses signal/silence/duration gates and limits bitrate choices', async () => {
  const mix = defaultMix();
  for (const bitrate of MP3_BITRATES) for (const rate of [44100, 48000]) assert.equal(mp3Error(mix, 1, rate, bitrate), '');
  for (const bitrate of [0, NaN, 127, 321]) assert(mp3Error(mix, 1, 44100, bitrate));
  for (const seconds of [0, NaN, 7201]) assert(mp3Error(mix, seconds, 44100, 256));
  mix.masterMuted = true; assert(mp3Error(mix, 1, 44100, 256));
  const abort = new AbortController(); abort.abort();
  await assert.rejects(renderMp3(defaultMix(), 1, 44100, 256, () => {}, () => {}, abort.signal), { name: 'AbortError' });
  assert.deepEqual([...planarPcm16([-2, 0, .5, 2])], [-32768, 0, 16384, 32767]);
});
test('the unmodified pinned encoder emits stereo MPEG-1 Layer III at every offered bitrate/rate', async () => {
  const bytes = await readFile(new URL('vendor/lamejs/lamejs.iife.js', root));
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  assert.equal(hash(bytes), '0be202ec162aa3042d5c5c4e6288ad326cff8cec7312c2894a0a91ad2f9aeda1');
  assert.equal(hash(await readFile(new URL('vendor/lamejs/source.tar.gz', root))), 'af8f08f0ff9a13777f2ffff737b48e40019b53a4b21db270dd62e829574e2b83');
  const context = {}; runInNewContext(bytes.toString(), context);
  for (const rate of [44100, 48000]) for (const bitrate of MP3_BITRATES) {
    const encoder = new context.lamejs.Mp3Encoder(2, rate, bitrate);
    const l = Int16Array.from({ length: rate }, (_, i) => Math.round(8000 * Math.sin(2 * Math.PI * 196 * i / rate)));
    const r = Int16Array.from({ length: rate }, (_, i) => Math.round(8000 * Math.sin(2 * Math.PI * 204 * i / rate)));
    const encoded = Buffer.concat([Buffer.from(encoder.encodeBuffer(l, r)), Buffer.from(encoder.flush())]);
    assert.equal(encoded[0], 255); assert.equal(encoded[1] & 254, 250);
    assert.equal((encoded[3] >> 6) & 3, 0, 'full stereo, not mono/joint-stereo');
    const rates = [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320];
    assert.equal(rates[encoded[2] >> 4], bitrate);
    assert.equal([44100,48000,32000][(encoded[2] >> 2) & 3], rate);
    assert(encoded.length > bitrate * 100);
  }
});

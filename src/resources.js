import { recordingPath } from './mix-state.mjs';

export function iconUrl(name) {
  return './assets/icons/' + name + '.svg';
}

export async function audioBytes(name) {
  const response = await fetch('./' + recordingPath(name));
  if (!response.ok) throw new Error('Recording unavailable: ' + name);
  return response.arrayBuffer();
}

let mp3EncoderPromise;
export function loadMp3Encoder() {
  if (!mp3EncoderPromise) mp3EncoderPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './vendor/lamejs/lamejs.iife.js';
    script.onload = () => {
      if (globalThis.lamejs?.Mp3Encoder) resolve(globalThis.lamejs.Mp3Encoder);
      else { mp3EncoderPromise = null; script.remove(); reject(new Error('MP3 encoder unavailable.')); }
    };
    script.onerror = () => { mp3EncoderPromise = null; script.remove(); reject(new Error('Could not load the local MP3 encoder.')); };
    document.head.append(script);
  });
  return mp3EncoderPromise;
}

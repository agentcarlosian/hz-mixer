export function iconUrl(name) {
  return './assets/icons/' + name + '.svg';
}

export async function audioBytes(name) {
  const response = await fetch('./assets/audio/' + name + '.mp3');
  if (!response.ok) throw new Error('Recording unavailable: ' + name);
  return response.arrayBuffer();
}

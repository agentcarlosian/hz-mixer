import { generatorSpecs } from './studio-state.mjs';
import { curveValue } from './program.mjs';

export function sourceProgram(mix, id) {
  const voice = generatorSpecs(mix).find((item) => item.id === id);
  if (!voice || voice.program === 'follow') return mix;
  return { ...mix, beat: voice.beat, automation: voice.program === 'sweep' ? { kind: 'sweep', sweep: voice.sweep } : { kind: 'fixed' } };
}
export function hasStudioLane(mix, target) {
  return mix.automation.kind === 'sequence' && mix.automation.stages.some((stage) => stage.lanes?.some((lane) => lane.target === target));
}
function studioTimeline(mix, target, base) {
  const points = [{ time: 0, value: base }]; let elapsed = 0, held = base;
  const push = (time, value) => { if (points.at(-1).time === time) points[points.length - 1] = { time, value }; else points.push({ time, value }); };
  if (mix.automation.kind !== 'sequence') return points;
  for (const stage of mix.automation.stages) {
    const lane = stage.lanes?.find((item) => item.target === target);
    if (lane) {
      const transition = elapsed > 0 && held !== lane.start ? .02 : 0;
      push(elapsed, elapsed ? held : lane.start);
      if (transition) push(elapsed + transition, lane.start);
      const count = lane.curve === 'smooth' ? 256 : 1;
      for (let i = 1; i <= count; i++) push(elapsed + transition + (stage.seconds - transition) * i / count, curveValue(lane.start, lane.end, i / count, lane.curve));
      held = lane.end;
    }
    elapsed += stage.seconds;
  }
  return points;
}
function studioPointValue(points, time) {
  if (time <= points[0].time) return points[0].value;
  for (let i = 1; i < points.length; i++) if (time <= points[i].time) {
    const left = points[i - 1], right = points[i];
    return curveValue(left.value, right.value, (time - left.time) / (right.time - left.time));
  }
  return points.at(-1).value;
}
export function studioValue(mix, target, base, time) { return studioPointValue(studioTimeline(mix, target, base), time); }
export function studioPoints(mix, target, base, from, until) {
  const points = studioTimeline(mix, target, base);
  return [{ time: from, value: studioPointValue(points, from) }, ...points.filter((point) => point.time > from && point.time < until), ...(until > from ? [{ time: until, value: studioPointValue(points, until) }] : [])];
}
export function studioSchedule(parameter, mix, target, base, from, until, when, scale = 1) {
  if (!hasStudioLane(mix, target)) { parameter.setValueAtTime(base * scale, when); return; }
  const points = studioPoints(mix, target, base, from, until);
  parameter.setValueAtTime(points[0].value * scale, when);
  for (const point of points.slice(1)) parameter.linearRampToValueAtTime(point.value * scale, when + point.time - from);
}
export function studioIntegral(mix, target, base, time) {
  if (!hasStudioLane(mix, target)) return base * time;
  const points = studioPoints(mix, target, base, 0, Math.max(0, time)); let value = 0;
  for (let i = 1; i < points.length; i++) value += (points[i].time - points[i - 1].time) * (points[i].value + points[i - 1].value) / 2;
  return value;
}

import { useEffect, useRef } from 'react';
import type { ThemePalette } from './theme';

type Point = { x: number; y: number };
type Snowflake = Point & { size: number; speed: number; drift: number; phase: number };
type AmbientParticle = Snowflake & { rotation: number; spin: number; opacity: number; colour: string };
type WebConfig = { rings: number; spokes: number; spacing: number };
export type BatFlight = { entryEdge: number; exitEdge: number; start: Point; control1: Point; control2: Point; end: Point; phase: number; scale: number; flutter: number };

const CANVAS_EFFECT_PALETTES: ThemePalette[] = ['valentines', 'bonfire', 'new-year', 'spring', 'summer', 'autumn', 'winter', 'halloween', 'christmas'];

export function hasSeasonalCanvasEffects(palette: ThemePalette): boolean {
  return CANVAS_EFFECT_PALETTES.includes(palette);
}

function edgePoint(edge: number, width: number, height: number, random: () => number): Point {
  const margin = 48;
  if (edge === 0) return { x: random() * width, y: -margin };
  if (edge === 1) return { x: width + margin, y: random() * height };
  if (edge === 2) return { x: random() * width, y: height + margin };
  return { x: -margin, y: random() * height };
}

export function createBatFlights(width: number, height: number, count: number, random: () => number = Math.random): BatFlight[] {
  return Array.from({ length: count }, (_, index) => {
    const entryEdge = Math.floor(random() * 4);
    const exitEdge = (entryEdge + 2) % 4;
    return {
      entryEdge,
      exitEdge,
      start: edgePoint(entryEdge, width, height, random),
      control1: { x: width * (.12 + random() * .76), y: height * (.08 + random() * .72) },
      control2: { x: width * (.12 + random() * .76), y: height * (.18 + random() * .74) },
      end: edgePoint(exitEdge, width, height, random),
      phase: index * 1.9 + random() * Math.PI,
      scale: .24 + random() * .07,
      flutter: 11 + random() * 13,
    };
  });
}

function cubic(start: number, control1: number, control2: number, end: number, progress: number): number {
  const inverse = 1 - progress;
  return inverse ** 3 * start + 3 * inverse ** 2 * progress * control1 + 3 * inverse * progress ** 2 * control2 + progress ** 3 * end;
}

function drawWeb(context: CanvasRenderingContext2D, origin: Point, direction: Point, config: WebConfig, mouse: Point | undefined, mouseStrength: number, time: number, reducedMotion: boolean) {
  const { rings, spokes, spacing } = config;
  const points: Point[][] = [];
  for (let ring = 1; ring <= rings; ring += 1) {
    points[ring] = [];
    for (let spoke = 0; spoke < spokes; spoke += 1) {
      const angle = (spoke / (spokes - 1)) * Math.PI / 2;
      const distance = ring * spacing;
      const base = { x: origin.x + Math.cos(angle) * distance * direction.x, y: origin.y + Math.sin(angle) * distance * direction.y };
      const mouseDistance = mouse ? Math.hypot(base.x - mouse.x, base.y - mouse.y) : Infinity;
      const influence = Math.max(0, 1 - mouseDistance / 115) * mouseStrength;
      const wobble = reducedMotion ? 0 : Math.sin(time / 230 + ring + spoke) * influence * 5;
      points[ring][spoke] = { x: base.x + wobble * direction.y, y: base.y + wobble * direction.x };
    }
  }
  context.beginPath();
  for (let spoke = 0; spoke < spokes; spoke += 1) {
    context.moveTo(origin.x, origin.y);
    for (let ring = 1; ring <= rings; ring += 1) context.lineTo(points[ring][spoke].x, points[ring][spoke].y);
  }
  for (let ring = 1; ring <= rings; ring += 1) {
    context.moveTo(points[ring][0].x, points[ring][0].y);
    for (let spoke = 1; spoke < spokes; spoke += 1) context.lineTo(points[ring][spoke].x, points[ring][spoke].y);
  }
  context.stroke();
}

function drawBatFlock(context: CanvasRenderingContext2D, progress: number, time: number, flights: BatFlight[], darkMode: boolean, mouse?: Point) {
  for (let index = 0; index < flights.length; index += 1) {
    const flight = flights[index];
    const localProgress = Math.max(0, Math.min(1, (progress - index * .025) / (1 - flights.length * .025)));
    const wander = Math.sin(localProgress * Math.PI * (5 + index) + flight.phase);
    let x = cubic(flight.start.x, flight.control1.x, flight.control2.x, flight.end.x, localProgress) + Math.sin(time / 170 + flight.phase) * flight.flutter + wander * 8;
    let y = cubic(flight.start.y, flight.control1.y, flight.control2.y, flight.end.y, localProgress) + Math.cos(time / 135 + flight.phase) * flight.flutter * .75 + Math.sin(localProgress * Math.PI * 9 + flight.phase) * 13;
    if (mouse) {
      const dx = x - mouse.x;
      const dy = y - mouse.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 105 && distance > 0) {
        const avoidance = (105 - distance) * .72;
        x += dx / distance * avoidance;
        y += dy / distance * avoidance;
      }
    }
    const flap = Math.sin(time / 58 + flight.phase) * 9;
    const nextProgress = Math.min(1, localProgress + .008);
    const nextX = cubic(flight.start.x, flight.control1.x, flight.control2.x, flight.end.x, nextProgress);
    const nextY = cubic(flight.start.y, flight.control1.y, flight.control2.y, flight.end.y, nextProgress);
    context.save();
    context.translate(x, y);
    context.rotate(Math.atan2(nextY - y, nextX - x) * .18);
    context.scale(flight.scale, flight.scale);
    context.fillStyle = '#16121df0';
    if (darkMode) { context.shadowColor = 'rgba(185, 26, 39, .62)'; context.shadowBlur = 24; }
    context.beginPath();
    context.moveTo(0, 2);
    context.quadraticCurveTo(-18, -13 - flap, -35, 2);
    context.quadraticCurveTo(-18, -2 + flap, -7, 8);
    context.quadraticCurveTo(0, 13, 7, 8);
    context.quadraticCurveTo(18, -2 + flap, 35, 2);
    context.quadraticCurveTo(18, -13 - flap, 0, 2);
    context.fill();
    context.restore();
  }
}

function particleColours(palette: ThemePalette): string[] {
  if (palette === 'valentines') return ['#ff7096', '#ff9fba', '#d94f79'];
  if (palette === 'bonfire') return ['#ffce55', '#ff8a24', '#ed4d20'];
  if (palette === 'new-year') return ['#f7d76d', '#d6ad3c', '#fff2bd', '#8eb7ff'];
  if (palette === 'spring') return ['#ffb7cf', '#ffd7e4', '#f59abb', '#ffffff'];
  if (palette === 'summer') return ['#fff0a0', '#ffd35e', '#fff8ce'];
  if (palette === 'autumn') return ['#d78236', '#b44b27', '#e2a23f', '#8d3f24'];
  return ['#d9efff', '#a8d4f2', '#ffffff'];
}

function createAmbientParticles(palette: ThemePalette, width: number, height: number): AmbientParticle[] {
  const colours = particleColours(palette);
  const density = palette === 'bonfire' ? 38 : palette === 'new-year' ? 28 : palette === 'summer' ? 22 : 32;
  return Array.from({ length: Math.max(density, Math.floor(width / 42)) }, (_, index) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: 2 + Math.random() * (palette === 'valentines' ? 5 : palette === 'autumn' ? 4 : 3),
    speed: 7 + Math.random() * (palette === 'bonfire' ? 30 : 18),
    drift: 4 + Math.random() * 13,
    phase: index * .83 + Math.random() * Math.PI,
    rotation: Math.random() * Math.PI * 2,
    spin: (Math.random() - .5) * 1.4,
    opacity: .28 + Math.random() * .42,
    colour: colours[index % colours.length],
  }));
}

function drawAmbientParticle(context: CanvasRenderingContext2D, particle: AmbientParticle, palette: ThemePalette) {
  context.save();
  context.translate(particle.x, particle.y);
  context.rotate(particle.rotation);
  context.globalAlpha = particle.opacity;
  context.fillStyle = particle.colour;
  context.strokeStyle = particle.colour;
  if (palette === 'valentines') {
    const size = particle.size;
    context.beginPath();
    context.moveTo(0, size * .8);
    context.bezierCurveTo(-size * 1.6, -size * .15, -size * .75, -size * 1.3, 0, -size * .55);
    context.bezierCurveTo(size * .75, -size * 1.3, size * 1.6, -size * .15, 0, size * .8);
    context.fill();
  } else if (palette === 'spring') {
    context.beginPath(); context.ellipse(0, 0, particle.size * 1.5, particle.size * .62, 0, 0, Math.PI * 2); context.fill();
  } else if (palette === 'autumn') {
    context.beginPath(); context.ellipse(0, 0, particle.size * 1.45, particle.size * .72, 0, 0, Math.PI * 2); context.fill();
    context.globalAlpha *= .7; context.lineWidth = .7; context.beginPath(); context.moveTo(-particle.size, 0); context.lineTo(particle.size, 0); context.stroke();
  } else if (palette === 'winter') {
    context.globalAlpha *= .7; context.lineWidth = 1;
    for (let spoke = 0; spoke < 3; spoke += 1) { context.rotate(Math.PI / 3); context.beginPath(); context.moveTo(-particle.size, 0); context.lineTo(particle.size, 0); context.stroke(); }
  } else if (palette === 'new-year') {
    context.fillRect(-particle.size * .35, -particle.size, particle.size * .7, particle.size * 2);
  } else {
    context.beginPath(); context.arc(0, 0, particle.size, 0, Math.PI * 2); context.fill();
  }
  context.restore();
}

function drawFirework(context: CanvasRenderingContext2D, width: number, height: number, time: number, offset: number, colour: string) {
  const cycle = ((time + offset) % 7200) / 1150;
  if (cycle < 0 || cycle > 1) return;
  const originX = width * (offset ? .72 : .27);
  const originY = height * (offset ? .28 : .2);
  const radius = 18 + cycle * 62;
  context.save();
  context.globalAlpha = Math.sin(cycle * Math.PI) * .42;
  context.strokeStyle = colour;
  context.lineWidth = 1.2;
  for (let ray = 0; ray < 14; ray += 1) {
    const angle = ray / 14 * Math.PI * 2;
    context.beginPath();
    context.moveTo(originX + Math.cos(angle) * radius * .55, originY + Math.sin(angle) * radius * .55);
    context.lineTo(originX + Math.cos(angle) * radius, originY + Math.sin(angle) * radius);
    context.stroke();
  }
  context.restore();
}

export function SeasonalEffects({ palette }: { palette: ThemePalette }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!hasSeasonalCanvasEffects(palette)) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let mouse: Point | undefined;
    let webMouse: Point | undefined;
    let webMouseStrength = 0;
    let lastTime = performance.now();
    let ambientStart = palette === 'halloween' ? lastTime + (import.meta.env.DEV ? 2500 : 45000 + Math.random() * 75000) : Infinity;
    const ambientDuration = 8500;
    let batFlights: BatFlight[] = [];
    const webConfigs: [WebConfig, WebConfig] = [0, 1].map(() => ({ rings: 4 + Math.floor(Math.random() * 2), spokes: 6 + Math.floor(Math.random() * 2), spacing: 15 + Math.random() * 5 })) as [WebConfig, WebConfig];
    let snow: Snowflake[] = [];
    let particles: AmbientParticle[] = [];

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = Math.max(1, window.innerHeight - 64);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (palette === 'halloween' && batFlights.length === 0) batFlights = createBatFlights(width, height, 2 + Math.floor(Math.random() * 2));
      if (palette === 'christmas') snow = Array.from({ length: Math.max(35, Math.floor(width / 20)) }, (_, index) => ({ x: Math.random() * width, y: Math.random() * height, size: 1 + Math.random() * 2.4, speed: 12 + Math.random() * 25, drift: 5 + Math.random() * 12, phase: index * .7 }));
      else if (palette !== 'halloween') particles = createAmbientParticles(palette, width, height);
    };
    const pointerMove = (event: PointerEvent) => { mouse = { x: event.clientX, y: event.clientY - 64 }; };
    const pointerLeave = () => { mouse = undefined; };
    const scheduleNext = (time: number) => {
      if (palette !== 'halloween') return;
      ambientStart = time + (import.meta.env.DEV ? 30000 + Math.random() * 30000 : 180000 + Math.random() * 240000);
      batFlights = createBatFlights(width, height, 2 + Math.floor(Math.random() * 2));
    };
    const render = (time: number) => {
      const delta = Math.min((time - lastTime) / 1000, .05);
      lastTime = time;
      context.clearRect(0, 0, width, height);
      if (palette === 'halloween') {
        if (mouse) {
          webMouse ??= { ...mouse };
          webMouse.x += (mouse.x - webMouse.x) * .16;
          webMouse.y += (mouse.y - webMouse.y) * .16;
          webMouseStrength += (1 - webMouseStrength) * .12;
        } else {
          webMouseStrength *= .92;
          if (webMouseStrength < .01) webMouse = undefined;
        }
        context.strokeStyle = 'rgba(102, 91, 117, .105)';
        context.lineWidth = 1;
        drawWeb(context, { x: 0, y: 0 }, { x: 1, y: 1 }, webConfigs[0], webMouse, webMouseStrength, time, reducedMotion);
        drawWeb(context, { x: width, y: 0 }, { x: -1, y: 1 }, webConfigs[1], webMouse, webMouseStrength, time, reducedMotion);
        if (!reducedMotion && time >= ambientStart && time <= ambientStart + ambientDuration) drawBatFlock(context, (time - ambientStart) / ambientDuration, time, batFlights, document.documentElement.dataset.theme === 'dark', mouse);
      } else if (palette === 'christmas') {
        context.fillStyle = 'rgba(230, 244, 255, .72)';
        for (const flake of snow) {
          if (!reducedMotion) {
            flake.y += flake.speed * delta;
            flake.x += Math.sin(time / 900 + flake.phase) * flake.drift * delta;
            if (mouse) {
              const dx = flake.x - mouse.x;
              const dy = flake.y - mouse.y;
              const distance = Math.hypot(dx, dy);
              if (distance < 90 && distance > 0) { flake.x += dx / distance * (90 - distance) * 2.4 * delta; flake.y += dy / distance * (90 - distance) * 2.4 * delta; }
            }
            if (flake.y > height + 5) { flake.y = -5; flake.x = Math.random() * width; }
          }
          context.beginPath(); context.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2); context.fill();
        }
      } else {
        const rises = palette === 'valentines' || palette === 'bonfire' || palette === 'summer';
        for (const particle of particles) {
          if (!reducedMotion) {
            particle.y += (rises ? -1 : 1) * particle.speed * delta;
            particle.x += Math.sin(time / 900 + particle.phase) * particle.drift * delta;
            particle.rotation += particle.spin * delta;
            if (rises && particle.y < -12) { particle.y = height + 12; particle.x = palette === 'bonfire' ? width * (.35 + Math.random() * .3) : Math.random() * width; }
            if (!rises && particle.y > height + 12) { particle.y = -12; particle.x = Math.random() * width; }
          }
          drawAmbientParticle(context, particle, palette);
        }
        if (!reducedMotion && (palette === 'new-year' || palette === 'bonfire')) {
          drawFirework(context, width, height, time, 0, palette === 'new-year' ? '#f7d76d' : '#ff9b32');
          drawFirework(context, width, height, time, 3600, palette === 'new-year' ? '#8eb7ff' : '#ef6040');
        }
      }
      if (!reducedMotion && palette === 'halloween' && time > ambientStart + ambientDuration) scheduleNext(time);
      frame = requestAnimationFrame(render);
    };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', pointerMove, { passive: true });
    document.addEventListener('mouseleave', pointerLeave);
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', pointerMove);
      document.removeEventListener('mouseleave', pointerLeave);
    };
  }, [palette]);

  if (!hasSeasonalCanvasEffects(palette)) return null;
  return <canvas ref={canvasRef} className="seasonal-effects" aria-hidden="true"/>;
}

import { useEffect, useRef } from 'react';
import type { ThemePalette } from './theme';

type Point = { x: number; y: number };
type Snowflake = Point & { size: number; speed: number; drift: number; phase: number };

function drawWeb(context: CanvasRenderingContext2D, origin: Point, direction: Point, mouse: Point | undefined, mouseStrength: number, time: number, reducedMotion: boolean) {
  const rings = 5;
  const spokes = 7;
  const points: Point[][] = [];
  for (let ring = 1; ring <= rings; ring += 1) {
    points[ring] = [];
    for (let spoke = 0; spoke < spokes; spoke += 1) {
      const angle = (spoke / (spokes - 1)) * Math.PI / 2;
      const distance = ring * 27;
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

function drawBat(context: CanvasRenderingContext2D, progress: number, width: number, height: number, time: number) {
  const x = -55 + progress * (width + 110);
  const y = Math.max(75, height * .18 + Math.sin(progress * Math.PI * 5) * 45);
  const flap = Math.sin(time / 80) * 9;
  context.save();
  context.translate(x, y);
  context.fillStyle = '#16121de0';
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

function drawSleigh(context: CanvasRenderingContext2D, progress: number, width: number) {
  const x = width + 180 - progress * (width + 360);
  const y = 62 + Math.sin(progress * Math.PI * 3) * 12;
  context.save();
  context.translate(x, y);
  context.strokeStyle = '#7b2531cc';
  context.fillStyle = '#a8323fcc';
  context.lineWidth = 3;
  context.beginPath(); context.roundRect(-12, -12, 50, 22, 6); context.fill();
  context.beginPath(); context.moveTo(-18, 13); context.quadraticCurveTo(15, 24, 48, 10); context.stroke();
  context.fillStyle = '#f2eadbcc'; context.beginPath(); context.arc(27, -20, 8, 0, Math.PI * 2); context.fill();
  context.strokeStyle = '#8f5639b8'; context.lineWidth = 2;
  context.beginPath(); context.moveTo(-16, -1); context.lineTo(-68, -8); context.stroke();
  for (const offset of [-80, -115]) {
    context.beginPath(); context.ellipse(offset, -9, 14, 7, 0, 0, Math.PI * 2); context.stroke();
    context.beginPath(); context.moveTo(offset + 7, -15); context.lineTo(offset + 13, -27); context.lineTo(offset + 18, -20); context.stroke();
  }
  context.restore();
}

export function SeasonalEffects({ palette }: { palette: ThemePalette }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (palette !== 'halloween' && palette !== 'christmas') return;
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
    let ambientStart = lastTime + (import.meta.env.DEV ? (palette === 'halloween' ? 2500 : 6000) : 12000 + Math.random() * 10000);
    let ambientDuration = palette === 'halloween' ? 6000 : 9000;
    let snow: Snowflake[] = [];

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = Math.max(1, window.innerHeight - 64);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (palette === 'christmas') snow = Array.from({ length: Math.max(35, Math.floor(width / 20)) }, (_, index) => ({ x: Math.random() * width, y: Math.random() * height, size: 1 + Math.random() * 2.4, speed: 12 + Math.random() * 25, drift: 5 + Math.random() * 12, phase: index * .7 }));
    };
    const pointerMove = (event: PointerEvent) => { mouse = { x: event.clientX, y: event.clientY - 64 }; };
    const pointerLeave = () => { mouse = undefined; };
    const scheduleNext = (time: number) => {
      ambientStart = time + (palette === 'halloween' ? 18000 + Math.random() * 22000 : 35000 + Math.random() * 40000);
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
        context.strokeStyle = 'rgba(102, 91, 117, .23)';
        context.lineWidth = 1;
        drawWeb(context, { x: 0, y: 0 }, { x: 1, y: 1 }, webMouse, webMouseStrength, time, reducedMotion);
        drawWeb(context, { x: width, y: 0 }, { x: -1, y: 1 }, webMouse, webMouseStrength, time, reducedMotion);
        if (!reducedMotion && time >= ambientStart && time <= ambientStart + ambientDuration) drawBat(context, (time - ambientStart) / ambientDuration, width, height, time);
      } else {
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
        if (!reducedMotion && time >= ambientStart && time <= ambientStart + ambientDuration) drawSleigh(context, (time - ambientStart) / ambientDuration, width);
      }
      if (!reducedMotion && time > ambientStart + ambientDuration) scheduleNext(time);
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

  if (palette !== 'halloween' && palette !== 'christmas') return null;
  return <canvas ref={canvasRef} className="seasonal-effects" aria-hidden="true"/>;
}

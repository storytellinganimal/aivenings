import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  POSTER_W,
  POSTER_H,
  WORDS,
  FONT_SIZE,
  fontFamilyFor,
  hsl,
  mulberry32,
} from "./posterData";

export type PosterSettings = {
  topHue: number;
  topSat: number;
  topLight: number;
  botHue: number;
  botSat: number;
  botLight: number;
  bubbleCount: number;
  bubbleSize: number; // diameter in poster px
  bubbleSpeed: number; // px / second
  bubbleSeed: number;
  pixel: number; // 1 = crisp, higher = chunkier
};

type Body = { x: number; y: number; vx: number; vy: number };

function clientToPoster(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) * POSTER_W / rect.width,
    y: (clientY - rect.top) * POSTER_H / rect.height,
  };
}

// The gradient runs from the top stop to the bottom stop; the bubbles share
// the bottom (accent) colour.
function palette(s: PosterSettings) {
  return {
    top: hsl(s.topHue, s.topSat, s.topLight),
    accent: hsl(s.botHue, s.botSat, s.botLight),
  };
}

function lowRes(pixel: number) {
  return {
    w: Math.max(1, Math.round(POSTER_W / pixel)),
    h: Math.max(1, Math.round(POSTER_H / pixel)),
  };
}

function drawBackground(canvas: HTMLCanvasElement, s: PosterSettings) {
  const { w, h } = lowRes(s.pixel);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const { accent, top } = palette(s);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(0.256, top);
  g.addColorStop(0.858, accent);
  g.addColorStop(1, accent);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawBubbles(
  canvas: HTMLCanvasElement,
  s: PosterSettings,
  bodies: Body[]
) {
  const { w, h } = lowRes(s.pixel);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  const { top, accent } = palette(s);
  const r = s.bubbleSize / 2 / s.pixel;
  for (const b of bodies) {
    const cx = b.x / s.pixel;
    const cy = b.y / s.pixel;
    const g = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    g.addColorStop(0, accent);
    g.addColorStop(1, top);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Advance the bubble simulation by dt seconds: move, bounce off walls, and
// resolve equal-mass elastic collisions between bubbles.
// pinnedIdx: index of a bubble held by the user (treated as infinite mass).
function step(bodies: Body[], dt: number, radius: number, pinnedIdx = -1) {
  for (let i = 0; i < bodies.length; i++) {
    if (i === pinnedIdx) continue;
    const b = bodies[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < radius) {
      b.x = radius;
      b.vx = Math.abs(b.vx);
    } else if (b.x > POSTER_W - radius) {
      b.x = POSTER_W - radius;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y < radius) {
      b.y = radius;
      b.vy = Math.abs(b.vy);
    } else if (b.y > POSTER_H - radius) {
      b.y = POSTER_H - radius;
      b.vy = -Math.abs(b.vy);
    }
  }
  const min = radius * 2;
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      if (dist < min) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = min - dist;
        const aPin = i === pinnedIdx;
        const bPin = j === pinnedIdx;
        if (aPin) {
          // a is held: push b the full overlap, reflect b off a (infinite mass wall)
          b.x += nx * overlap;
          b.y += ny * overlap;
          const rel = b.vx * nx + b.vy * ny;
          if (rel < 0) { b.vx -= 2 * rel * nx; b.vy -= 2 * rel * ny; }
        } else if (bPin) {
          // b is held: push a the full overlap, reflect a off b
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          const aRel = a.vx * nx + a.vy * ny;
          if (aRel > 0) { a.vx -= 2 * aRel * nx; a.vy -= 2 * aRel * ny; }
        } else {
          // equal-mass elastic collision
          const half = overlap / 2;
          a.x -= nx * half;
          a.y -= ny * half;
          b.x += nx * half;
          b.y += ny * half;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            a.vx += rel * nx;
            a.vy += rel * ny;
            b.vx -= rel * nx;
            b.vy -= rel * ny;
          }
        }
      }
    }
  }
}

export default function Poster({
  settings,
  exportRef,
}: {
  settings: PosterSettings;
  exportRef: React.MutableRefObject<(() => void) | undefined>;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const bubbleRef = useRef<HTMLCanvasElement>(null);
  const bodiesRef = useRef<Body[]>([]);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [scale, setScale] = useState(1);
  const dragIdxRef = useRef(-1);
  const dragVelRef = useRef({ vx: 0, vy: 0 });
  const dragLastRef = useRef({ x: 0, y: 0, t: 0 });

  // Fit the fixed-size poster into the available stage area.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(() => {
      const pad = 48;
      const sw = stage.clientWidth - pad;
      const sh = stage.clientHeight - pad;
      setScale(Math.max(0.05, Math.min(sw / POSTER_W, sh / POSTER_H)));
    });
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  // Background only needs to repaint when colour or pixelation changes.
  useEffect(() => {
    if (bgRef.current) drawBackground(bgRef.current, settings);
  }, [
    settings.topHue,
    settings.topSat,
    settings.topLight,
    settings.botHue,
    settings.botSat,
    settings.botLight,
    settings.pixel,
  ]);

  // Build a fresh, deterministic bubble field whenever the seed changes.
  useEffect(() => {
    const rand = mulberry32(settings.bubbleSeed);
    const speed = settingsRef.current.bubbleSpeed;
    const r = settingsRef.current.bubbleSize / 2;
    bodiesRef.current = Array.from(
      { length: settingsRef.current.bubbleCount },
      () => {
        const angle = rand() * Math.PI * 2;
        return {
          x: r + rand() * (POSTER_W - 2 * r),
          y: r + rand() * (POSTER_H - 2 * r),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
        };
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.bubbleSeed]);

  // Add/remove bubbles to match the count, keeping existing ones in place.
  useEffect(() => {
    const bodies = bodiesRef.current;
    const speed = settings.bubbleSpeed || 1;
    const r = settings.bubbleSize / 2;
    while (bodies.length < settings.bubbleCount) {
      const angle = Math.random() * Math.PI * 2;
      bodies.push({
        x: r + Math.random() * (POSTER_W - 2 * r),
        y: r + Math.random() * (POSTER_H - 2 * r),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      });
    }
    bodies.length = Math.min(bodies.length, settings.bubbleCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.bubbleCount]);

  // Rescale every velocity to the new speed, preserving travel direction.
  useEffect(() => {
    for (const b of bodiesRef.current) {
      const mag = Math.hypot(b.vx, b.vy);
      if (mag > 0) {
        b.vx = (b.vx / mag) * settings.bubbleSpeed;
        b.vy = (b.vy / mag) * settings.bubbleSpeed;
      } else if (settings.bubbleSpeed > 0) {
        const angle = Math.random() * Math.PI * 2;
        b.vx = Math.cos(angle) * settings.bubbleSpeed;
        b.vy = Math.sin(angle) * settings.bubbleSpeed;
      }
    }
  }, [settings.bubbleSpeed]);

  // Animation loop: physics + bubble repaint every frame.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = settingsRef.current;
      step(bodiesRef.current, dt, s.bubbleSize / 2, dragIdxRef.current);
      if (bubbleRef.current) drawBubbles(bubbleRef.current, s, bodiesRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Drag-to-move: click and hold a bubble to reposition it.
  useEffect(() => {
    const canvas = bubbleRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const { x, y } = clientToPoster(canvas, e.clientX, e.clientY);
      const r = settingsRef.current.bubbleSize / 2;
      const bodies = bodiesRef.current;
      for (let i = 0; i < bodies.length; i++) {
        if (Math.hypot(bodies[i].x - x, bodies[i].y - y) <= r) {
          dragIdxRef.current = i;
          dragVelRef.current = { vx: 0, vy: 0 };
          dragLastRef.current = { x, y, t: performance.now() };
          canvas.style.cursor = "grabbing";
          e.preventDefault();
          break;
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const { x, y } = clientToPoster(canvas, e.clientX, e.clientY);
      if (dragIdxRef.current === -1) {
        const r = settingsRef.current.bubbleSize / 2;
        const hovering = bodiesRef.current.some(
          (b) => Math.hypot(b.x - x, b.y - y) <= r
        );
        canvas.style.cursor = hovering ? "grab" : "default";
        return;
      }
      const now = performance.now();
      const dt = (now - dragLastRef.current.t) / 1000;
      if (dt > 0) {
        dragVelRef.current = {
          vx: (x - dragLastRef.current.x) / dt,
          vy: (y - dragLastRef.current.y) / dt,
        };
      }
      dragLastRef.current = { x, y, t: now };
      const body = bodiesRef.current[dragIdxRef.current];
      if (body) {
        const r = settingsRef.current.bubbleSize / 2;
        body.x = Math.max(r, Math.min(POSTER_W - r, x));
        body.y = Math.max(r, Math.min(POSTER_H - r, y));
      }
    };

    const onMouseUp = () => {
      if (dragIdxRef.current === -1) return;
      const body = bodiesRef.current[dragIdxRef.current];
      if (body) {
        const { vx, vy } = dragVelRef.current;
        const speed = settingsRef.current.bubbleSpeed;
        const mag = Math.hypot(vx, vy);
        if (mag > 0) {
          body.vx = (vx / mag) * speed;
          body.vy = (vy / mag) * speed;
        } else {
          const angle = Math.random() * Math.PI * 2;
          body.vx = Math.cos(angle) * speed;
          body.vy = Math.sin(angle) * speed;
        }
      }
      dragIdxRef.current = -1;
      canvas.style.cursor = "default";
    };

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const { x, y } = clientToPoster(canvas, touch.clientX, touch.clientY);
      const r = settingsRef.current.bubbleSize / 2;
      const bodies = bodiesRef.current;
      for (let i = 0; i < bodies.length; i++) {
        if (Math.hypot(bodies[i].x - x, bodies[i].y - y) <= r) {
          dragIdxRef.current = i;
          dragVelRef.current = { vx: 0, vy: 0 };
          dragLastRef.current = { x, y, t: performance.now() };
          e.preventDefault();
          break;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (dragIdxRef.current === -1) return;
      e.preventDefault();
      const touch = e.touches[0];
      const { x, y } = clientToPoster(canvas, touch.clientX, touch.clientY);
      const now = performance.now();
      const dt = (now - dragLastRef.current.t) / 1000;
      if (dt > 0) {
        dragVelRef.current = {
          vx: (x - dragLastRef.current.x) / dt,
          vy: (y - dragLastRef.current.y) / dt,
        };
      }
      dragLastRef.current = { x, y, t: now };
      const body = bodiesRef.current[dragIdxRef.current];
      if (body) {
        const r = settingsRef.current.bubbleSize / 2;
        body.x = Math.max(r, Math.min(POSTER_W - r, x));
        body.y = Math.max(r, Math.min(POSTER_H - r, y));
      }
    };

    const onTouchEnd = () => {
      if (dragIdxRef.current === -1) return;
      const body = bodiesRef.current[dragIdxRef.current];
      if (body) {
        const { vx, vy } = dragVelRef.current;
        const speed = settingsRef.current.bubbleSpeed;
        const mag = Math.hypot(vx, vy);
        if (mag > 0) {
          body.vx = (vx / mag) * speed;
          body.vy = (vy / mag) * speed;
        } else {
          const angle = Math.random() * Math.PI * 2;
          body.vx = Math.cos(angle) * speed;
          body.vy = Math.sin(angle) * speed;
        }
      }
      dragIdxRef.current = -1;
    };

    canvas.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // Compose all three layers into a single PNG and download it.
  useEffect(() => {
    exportRef.current = async () => {
      await document.fonts.ready;
      const out = document.createElement("canvas");
      out.width = POSTER_W;
      out.height = POSTER_H;
      const ctx = out.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      if (bgRef.current) ctx.drawImage(bgRef.current, 0, 0, POSTER_W, POSTER_H);
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#fff";
      for (const word of WORDS) {
        ctx.font = `${FONT_SIZE}px ${fontFamilyFor(word.variant)}`;
        // DOM uses line-height: normal, so the baseline sits one font-ascent
        // below the element top — mirror that with the measured ascent.
        const ascent = ctx.measureText(word.text).fontBoundingBoxAscent;
        ctx.fillText(word.text, word.left, word.top + ascent);
      }
      if (bubbleRef.current)
        ctx.drawImage(bubbleRef.current, 0, 0, POSTER_W, POSTER_H);
      out.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "aivenings.png";
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    };
  }, [exportRef]);

  return (
    <div className="stage" ref={stageRef}>
      <div
        className="poster"
        style={{
          width: POSTER_W,
          height: POSTER_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <canvas ref={bgRef} className="layer pixelated" />
        <div className="layer text-layer">
          {WORDS.map((word, i) => (
            <p
              key={i}
              className={word.variant === "open" ? "word open" : "word"}
              style={{ left: word.left, top: word.top }}
            >
              {word.text}
            </p>
          ))}
        </div>
        <canvas ref={bubbleRef} className="layer pixelated" />
      </div>
    </div>
  );
}

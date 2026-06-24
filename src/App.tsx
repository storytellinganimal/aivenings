import { useRef, useState } from "react";
import Poster, { type PosterSettings } from "./Poster";
import { hsl, MAX_BUBBLES } from "./posterData";
import "./App.css";

const DEFAULTS: PosterSettings = {
  // top stop ≈ #b5b5b5 (neutral grey)
  topHue: 0,
  topSat: 0,
  topLight: 71,
  // bottom stop ≈ #ff00dd (magenta) — also used by the bubbles
  botHue: 313,
  botSat: 100,
  botLight: 50,
  bubbleCount: 5,
  bubbleSize: 360,
  bubbleSpeed: 60,
  bubbleSeed: 7,
  pixel: 1,
};

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  track?: string;
};

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  track,
}: SliderProps) {
  return (
    <label className="slider">
      <span className="slider-head">
        <span className="slider-label">{label}</span>
        <span className="slider-value">
          {Math.round(value)}
          {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={track ? { background: track } : undefined}
      />
    </label>
  );
}

type Hsl = { h: number; s: number; l: number };

// Hue / Saturation / Lightness controls for one gradient stop.
function ColorStop({
  name,
  value,
  onChange,
}: {
  name: string;
  value: Hsl;
  onChange: (v: Hsl) => void;
}) {
  const hueTrack = `linear-gradient(90deg, ${Array.from({ length: 13 }, (_, i) =>
    hsl(i * 30, value.s, value.l)
  ).join(",")})`;
  return (
    <div className="subgroup">
      <div className="sub-head">
        <span>{name}</span>
        <span className="swatch" style={{ background: hsl(value.h, value.s, value.l) }} />
      </div>
      <Slider
        label="Hue"
        value={value.h}
        min={0}
        max={360}
        unit="°"
        onChange={(h) => onChange({ ...value, h })}
        track={hueTrack}
      />
      <Slider
        label="Saturation"
        value={value.s}
        min={0}
        max={100}
        unit="%"
        onChange={(s) => onChange({ ...value, s })}
        track={`linear-gradient(90deg, ${hsl(value.h, 0, value.l)}, ${hsl(
          value.h,
          100,
          value.l
        )})`}
      />
      <Slider
        label="Lightness"
        value={value.l}
        min={0}
        max={100}
        unit="%"
        onChange={(l) => onChange({ ...value, l })}
        track={`linear-gradient(90deg, #000, ${hsl(value.h, value.s, 50)}, #fff)`}
      />
    </div>
  );
}

export default function App() {
  const [s, setS] = useState<PosterSettings>(DEFAULTS);
  const exportRef = useRef<(() => void) | undefined>(undefined);
  const set = (patch: Partial<PosterSettings>) =>
    setS((prev) => ({ ...prev, ...patch }));

  return (
    <div className="app">
      <Poster settings={s} exportRef={exportRef} />

      <aside className="panel">
        <div className="panel-scroll">
          <header className="panel-head">
            <h1>Aivenings</h1>
            <p>poster editor</p>
          </header>

          <section className="group">
            <div className="group-head">
              <h2>Colour</h2>
              <button
                className="btn-text"
                onClick={() =>
                  set({
                    topHue: Math.floor(Math.random() * 360),
                    topSat: Math.floor(40 + Math.random() * 60),
                    topLight: Math.floor(35 + Math.random() * 35),
                    botHue: Math.floor(Math.random() * 360),
                    botSat: Math.floor(40 + Math.random() * 60),
                    botLight: Math.floor(35 + Math.random() * 35),
                  })
                }
              >
                shuffle
              </button>
            </div>
            <ColorStop
              name="Color 1"
              value={{ h: s.topHue, s: s.topSat, l: s.topLight }}
              onChange={(v) => set({ topHue: v.h, topSat: v.s, topLight: v.l })}
            />
            <ColorStop
              name="Color 2"
              value={{ h: s.botHue, s: s.botSat, l: s.botLight }}
              onChange={(v) => set({ botHue: v.h, botSat: v.s, botLight: v.l })}
            />
          </section>

          <section className="group">
            <div className="group-head">
              <h2>Bubbles</h2>
              <button
                className="btn-text"
                onClick={() =>
                  set({ bubbleSeed: Math.floor(Math.random() * 1e9) })
                }
              >
                shuffle
              </button>
            </div>
            <Slider
              label="Count"
              value={s.bubbleCount}
              min={0}
              max={MAX_BUBBLES}
              onChange={(v) => set({ bubbleCount: v })}
            />
            <Slider
              label="Size"
              value={s.bubbleSize}
              min={80}
              max={700}
              step={10}
              unit="px"
              onChange={(v) => set({ bubbleSize: v })}
            />
            <Slider
              label="Speed"
              value={s.bubbleSpeed}
              min={0}
              max={240}
              step={5}
              onChange={(v) => set({ bubbleSpeed: v })}
            />
            <p className="hint">They drift over the text and bounce off each other.</p>
          </section>

          <section className="group">
            <div className="group-head">
              <h2>Pixelate</h2>
            </div>
            <Slider
              label="Block size"
              value={s.pixel}
              min={1}
              max={40}
              unit="px"
              onChange={(v) => set({ pixel: v })}
            />
            <p className="hint">
              Affects gradient &amp; bubbles — text stays sharp.
            </p>
          </section>
        </div>

        <footer className="actions">
          <button className="btn-tonal" onClick={() => setS(DEFAULTS)}>
            Reset
          </button>
          <button className="btn-filled" onClick={() => exportRef.current?.()}>
            Export PNG
          </button>
        </footer>
      </aside>
    </div>
  );
}

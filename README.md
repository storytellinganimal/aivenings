# AIvenings — poster editor

A minimal, dark-mode editor that recreates the *AIvenings* Instagram poster
([Figma](https://www.figma.com/design/lrCDckTF9ixt2Ssjqv7h4u/AIvenings?node-id=4-80))
and lets you tweak it live.

## Controls

- **Colour** — independent Hue / Saturation / Lightness for the **Top** and
  **Bottom** stops of the background gradient. The bubbles follow the bottom stop.
- **Bubbles** — `Count` (0–24), uniform `Size`, and `Speed`. Bubbles drift over the
  text and bounce elastically off the walls and each other. `shuffle` re-seeds their
  starting layout.
- **Pixelate** — `Block size` chunks the gradient and bubbles into pixels. The text
  stays crisp at every setting.
- **Export PNG** — composites all three layers into a 1080×1350 PNG download.

## How it works

The poster is composed of three stacked layers so pixelation can skip the text:

1. **Background canvas** — vertical gradient, drawn at a reduced resolution and
   scaled up with `image-rendering: pixelated`.
2. **Text layer** — DOM `<p>` elements in the *Terminal Grotesque* font (the
   outlined "open" variant for some words). Always sharp.
3. **Bubble canvas** — transparent canvas with the ellipses, pixelated the same
   way as the background. A `requestAnimationFrame` loop runs the bubble physics
   (movement, wall bounce, equal-mass elastic collisions) in full poster
   coordinates and repaints this layer each frame.

The "block size" slider just changes each canvas's internal resolution; a value of
`1` is full resolution (no pixelation).

## Run

```bash
npm install
npm run dev
```

Fonts (Terminal Grotesque, by [Velvetyne](https://velvetyne.fr/)) are bundled in
`public/fonts/`, so it works offline.

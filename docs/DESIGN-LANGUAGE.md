# AETHER — Cinematic design language

The opening, the archive and the ending are chapters of one story. These rules keep them that way.

## Story

**Arrival → Exploration → Discovery → Contributions → Final Protocol → Restart.**
Curiosity (a figure emerges from darkness), interest (the work), exploration (the archive), memory (the ending), and a door back to the beginning.

## Palette

| Token | Value | Use |
|---|---|---|
| Obsidian | `#06070a` | every background; the darkness scenes emerge from |
| Graphite | `#14171c` – `#2a2f37` | panels, under-structure, empty launch pads |
| Titanium | `#c9ced6` | body text; metal plates (`#7d848f` in 3D) |
| Silver | `#eef1f5` | headlines |
| Electric cobalt | `#3d7bff` | energy, focus, the one accent colour |
| Ion | `#a9c6ff` | cooled energy, secondary accent |
| White-hot | `#f3f7ff` | the hottest light: cores, peak days |
| Ember | `#ff8a4c` | reserved: a brief fringe on the ignition only |

No other hues. Data intensity uses the cobalt → white-hot ramp, never a rainbow.

## Light

- **Backlight first.** Subjects are lit from behind; their shape comes from rim light, not front light.
- **One studio.** Both 3D scenes reflect the same dark virtual studio (`scenes/core/env.ts`): near-black walls, one soft key panel, thin cobalt strips. Metal reflects darkness with crisp light edges.
- **Light is an event.** Big light (the ignition, the pulse) is brief, local and followed by quiet. Full-frame flashes stay below 40 % opacity and happen once.

## Materials

Titanium plates (`metalness 1`, clearcoat) over a graphite skeleton; emissive cobalt lines for energy. The armored figure and the mechanical hand share the same three materials, so they read as one engineering family.

## Typography

| Role | Face | Treatment |
|---|---|---|
| Display | Archivo, expanded (width 125 %), 760–820 | uppercase, tight tracking (-0.02 to -0.035em) |
| Editorial voice | Instrument Serif, italic | supporting lines, emphasis words inside headlines |
| Telemetry | JetBrains Mono | 11 px uppercase labels, 0.22em tracking; chapter codes `CH.04`, `P-01`, `W-01` |

All fonts are self-hosted (Fontsource), so no third-party font requests.

## Camera

Slow, motivated moves only: wide → close push-ins with `easeInOutSine`, low angles for heroism, ±0.15 unit idle drift. Shake only on impact, decaying within ~1.5 s.

## Motion curves

| Name | Curve | Use |
|---|---|---|
| cinematic | `cubic-bezier(0.16, 1, 0.3, 1)` | reveals, titles, camera settles |
| ignite | `cubic-bezier(0.7, 0, 0.84, 0)` | build-ups that end in an event |
| drift | `cubic-bezier(0.45, 0, 0.55, 1)` | ambient motion |
| settle | `cubic-bezier(0.22, 1, 0.36, 1)` | UI feedback |

Durations: 180 ms (UI), 420 ms (state), 900 ms (reveal), 1.1–1.6 s (cinematic type).

## Transitions

- Letters rise from below a mask with a blur-to-sharp focus pull.
- Rules draw from the left; codas wipe from the left.
- Sections fade up 18 px once, on first view — never scrubbed by scroll.

## Sound

Synthesized live (Web Audio), never recorded, **always off until the visitor turns it on**. Sub-bass weight instead of loudness; long reverb tails; real silence after the biggest moment (the finale's hush); glassy single tones when type lands.

## Originality

The opening and ending are inspired by the *feeling* of great cinematic moments, not their assets. The figure, its visor line and dorsal vanes, the launch column, the mechanical hand with its "A" mark and five monochrome energy cores are all original designs built from code. No footage, soundtrack, dialogue, characters or distinctive protected designs are used.

# Piramida Tirana · 3D Event Manager

Interactive 3D event manager for the Pyramid of Tirana, built with **Next.js 16 (App Router)** +
**@react-three/fiber** + **@react-three/drei**.

## Run

```bash
npm run dev      # http://localhost:3000
npm run build    # production build
```

## How it works

The whole experience is **procedural and data-driven** — there is no `.glb` to ship. Everything
is generated from `lib/pyramid-data.ts`, so changing a number there (or in the UI) updates the 3D
scene live.

### Interaction flow
1. **Exterior** — stepped white pyramid (matches the renovated MVRDV building). Pick a floor from the
   hexagon selector (`P · -1 · 0 · 1 · 2 · 3`) or click a terrace.
2. **Floor** — the app-style radial layer of colour-coded tenant cubes for that floor. Click a cube.
3. **Interior** — a generated event room. The furniture is solved from the event data:
   - `chairs` → theatre / classroom rows or banquet seating
   - `layout` → `theater | classroom | banquet | standing`
   - **Change the chair count in the right-hand panel and the room re-lays-out instantly.**

The camera flies between the three views; orbit/zoom is always available.

## Where to edit

| What | File |
|------|------|
| Floors, tenants, events, chair counts | `lib/pyramid-data.ts` |
| App state (view, selection, overrides) | `lib/store.ts` |
| Exterior pyramid geometry | `components/three/Pyramid.tsx` |
| Radial tenant cubes | `components/three/FloorSpaces.tsx` |
| Event room + furniture | `components/three/InteriorRoom.tsx`, `Furniture.tsx` |
| Camera / lights / canvas | `components/three/Scene.tsx` |
| UI overlay | `components/ui/*` |

## Swapping in a real .glb

If you later get a proper segmented model, load it in `Pyramid.tsx`:

```tsx
const { scene } = useGLTF("/models/pyramid.glb"); // file in /public/models/
return <primitive object={scene} />;
```

(The 32 MB Meshy export you have is a single untextured mesh — fine as a static backdrop, but it
can't be split into clickable floors, which is why the build is procedural.)

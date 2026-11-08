# Chunk — a voxel sandbox

<!-- hanzo-badges -->
<p align="left">
  <a href="https://platform.hanzo.ai/new?repo=https%3A%2F%2Fgithub.com%2Fhanzo-apps%2Fvoxel-craft&template=voxel-craft"><img src="https://gallery.hanzo.ai/deploy.svg" alt="Deploy to Hanzo" height="32" /></a>
  <a href="https://hanzo.ai/chat?template=voxel-craft"><img src="https://gallery.hanzo.ai/badges/edit-in-hanzo.svg" alt="Edit in Hanzo.ai" height="32" /></a>
  <a href="https://gallery.hanzo.ai/templates/voxel-craft"><img src="https://gallery.hanzo.ai/badges/live-preview.svg" alt="Live Preview" height="32" /></a>
  <a href="https://gallery.hanzo.ai/llms/voxel-craft/LLM.md"><img src="https://gallery.hanzo.ai/badges/llm-md.svg" alt="LLM.md Playbook" height="32" /></a>
</p>
<!-- /hanzo-badges -->

First-person voxel world: procedural terrain, face-culled chunk meshing into one merged
`BufferGeometry` per chunk, pointer-lock controls, and place/break editing that re-meshes
only the chunk you touched.

Live: https://voxel-craft.hanzo.app

A voxel world is a **meshing** problem, not a drawing problem. 81 chunks of 16x16x24 voxels
is ~500k cells; emitting only the faces that touch air leaves ~62k quads and holds 60 fps.

## Build

```sh
npm install && npm run build
```

## Deploy to hanzo.app

An engine build is far bigger than the 4 MiB the public edge accepts in one request
body, so games ship through the **release lane**, not the artifact lane: put the built
tree in your object space, then publish it server-side.

```sh
# 1. declare the engine — `unity`, `unreal`, `godot` make clients/sites serve the
#    site cross-origin-isolated (COOP/COEP) so multithreaded WASM gets SharedArrayBuffer
curl -X POST https://api.hanzo.ai/v1/projects -H "Authorization: Bearer $TOKEN" \
  -H "X-Org-Id: $ORG" -H "Content-Type: application/json" \
  -d "{\"slug\":\"my-game\",\"name\":\"my-game\",\"framework\":\"godot\"}"

# 2. stage the build to s3.hanzo.ai under <org>/_stage/my-game/
# 3. promote it into an immutable content-addressed release + flip the pointer
curl -X POST https://api.hanzo.ai/v1/sites/my-game/publish -H "Authorization: Bearer $TOKEN" \
  -H "X-Org-Id: $ORG" -H "Content-Type: application/json" -d "{\"source\":\"_stage/my-game\"}"
```

**Fingerprint your asset names.** The site server serves a content-hashed filename
`immutable` and everything else with a plain `max-age`. A redeploy that reuses the same
asset name leaves browsers and the CDN running the OLD loader against the NEW binary —
for a WASM app that is a silent, permanent hang with no error, not a visible failure.

## License

MIT (this sandbox). three.js is MIT, (c) the three.js authors.

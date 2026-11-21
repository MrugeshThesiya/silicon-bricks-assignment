# AGENTS.md

## Save the session transcript (do not lose it on compaction)

The General Machines assignment requires the raw AI session transcripts, starting with the session where the assignment is started. Context compaction can drop earlier messages from the conversation, so the full transcript must be copied into this directory regularly.

Raw transcripts are stored by Claude Code as JSONL at:

```
/home/mrugesh/.claude/projects/-mnt-data-Repos-silicon-bricks-hiring-assignment/<session-id>.jsonl
```

The current session's file is:

```
/home/mrugesh/.claude/projects/-mnt-data-Repos-silicon-bricks-hiring-assignment/51b861e2-90bc-4325-bc21-93e4dfc28687.jsonl
```

### What to do

1. Create `./transcripts/` in this directory if it doesn't exist.
2. Save each session file as a new, timestamped snapshot. Never overwrite an existing file:
   ```
   mkdir -p ./transcripts
   TS=$(date -u +%Y%m%dT%H%M%SZ)
   for f in /home/mrugesh/.claude/projects/-mnt-data-Repos-silicon-bricks-hiring-assignment/*.jsonl; do
     cp -n "$f" "./transcripts/$(basename "$f" .jsonl)__$TS.jsonl" \
       && chmod 444 "./transcripts/$(basename "$f" .jsonl)__$TS.jsonl"
   done
   (cd ./transcripts && sha256sum *.jsonl > SHA256SUMS.new && cat SHA256SUMS.new >> SHA256SUMS.log && rm SHA256SUMS.new)
   ```
   `cp -n` refuses to replace an existing file, and `chmod 444` makes each snapshot read-only. Checksums are appended to `SHA256SUMS.log`, which is only ever appended to.
3. Do this:
   - right after the assignment is started,
   - after every major milestone (design decision, deploy, big feature),
   - before any expected compaction or when the context is getting long,
   - before submitting.
4. Copy every `.jsonl` in that folder, not just the current one. Each new chat is a separate session, and all of them must be kept.
5. Never edit, trim, rewrite, rename, move or delete anything in `./transcripts/`, and never overwrite or truncate a file there. Every snapshot is kept exactly as it was copied, even though a later snapshot of the same session will contain more. Older snapshots are not redundant, they are the record. Don't run `cp -f`, `mv`, `rm`, `sed -i`, `>` redirects or similar against files in that folder, and don't `chmod` them writable.
6. Never touch the original `.jsonl` files in `~/.claude/projects/`. Only read and copy them.

### Privacy

- Transcripts contain the candidate's email and the assignment access key. Do not commit `./transcripts/` to a public repo.
- Add `transcripts/` to `.gitignore` of any public repo created for the submission. Share the transcripts only through the submission itself.

## Assignment rules

- Never call `start_assignment` until the candidate has read the warning and said yes in the conversation. Never call it to preview the brief.
- The access key is returned once. Store it in `./.assignment-key` (git-ignored, private). Never put it in code, in a public repo, or in the submission doc.
- The write-up and every submission value (name, phone, links) must come from the candidate. Do not guess or invent any of them.
- Candidate: Mrugesh Thesiya
- **Calling the MCP server:** use `curl`, not Python `urllib` or similar (the server answers those with 403 Forbidden). POST JSON-RPC to `https://siliconbricks.co/hiring/mcp` with `Content-Type: application/json` and `Accept: application/json, text/event-stream` (a GET returns 405). Read the key from `./.assignment-key`, send the request body on stdin (`curl ... -d @-`) so the key isn't in the process arguments, and never print the key or the email in output. `time_left` and `check_submission` are read-only; `submit_application` is only called with values the candidate gave.

## Project decisions (agreed with the candidate)

- **Zone:** an orange (medium-to-high-density residential) sub-zone in Bangkok, under the 2013 Comprehensive Plan. The exact district and sub-zone code are decided later, after checking the official zoning map. Don't hard-code a rule number that wasn't read in the primary source.
- **Hosting:** Cloudflare Pages, static site only, no backend.
- **Data:** bake as much as possible into static files (GeoJSON / PMTiles) at build time. No live Overpass or other third-party API calls at runtime in the demo.
- **District (decided 2026-11-21 from a measured comparison, plot sub-area still to confirm):** **Sukhumvit Road at BTS Bang Chak** (Phra Khanong district), with Sukhumvit sois 91 to 99 and Soi Sukhumvit 62. Map centre about 13.6982 N, 100.6063 E. The official 2013 map labels it **Y.7-21** (read by eye); in a 500 m circle around the station 95 % of the zoned area is orange, OSM building cover is 21 % and there are three road classes. The BTS station is inside 500 m by construction. Full method, table and limits: `docs/area-ranking.md` (script `scripts/area_stats.py`). Earlier choices were wrong: Huai Khwang / Ratchada (MRT Huai Khwang is brown Y.9) and a Lat Phrao Road spot (0 % orange, 79 % brown when measured). The exact plot's sub-area code, road width and station distance are **not verified**: confirm on the BMA parcel tool or the "Check ผังเมือง กทม." app. The app's **Example plot** button loads a 50 m by 40 m corner plot on the south side of Soi 95 at Sukhumvit Road with estimated values (zone Y.7, Soi 95 12 m, Sukhumvit Road 36 m, station within 500 m): see `src/example.ts` and `docs/area-ranking.md`. Never present these as verified. Fallbacks: BTS Punnawithi (next station, more high-rise), Suan Luang Rama IX (Yellow Line, Y.7-22), Phahonyothin 24 / Ratchayothin (Chatuchak, Y.7-4).
- **Build order for the plot:** start by building for an empty field only, with nothing on the plot. Redevelopment (a plot with existing buildings) is a later step, only after the empty-field version works end to end. The assignment doesn't say the plot is empty, so the design must not block redevelopment later. When it is added, existing buildings inside the plot are treated as to be demolished: ghosted or hidden (a toggle is ideal), counting none of their area toward FAR or open space. Neighbouring buildings and roads always stay. Demolition rules, existing-structure rights and heritage constraints are out of scope. State the assumption and its limits in the write-up.
- **Stack:** Vite + TypeScript, MapLibre GL JS (Three.js dropped: the envelope slope uses thin extrusion slices), Terra Draw, clipper-lib (replaced Turf.js and polyclip-ts, which was too slow), Web Workers, Vitest. Open source only.

### OSM attribution (required, do not skip)

OpenStreetMap data is licensed under the ODbL, so every place that shows or ships OSM-derived data must credit it.

- Show **© OpenStreetMap contributors** on the map at all times, visible and linking to https://www.openstreetmap.org/copyright. Use MapLibre's attribution control, and make sure each tile/data source sets its `attribution` field.
- Also credit the basemap provider (OpenFreeMap / Protomaps / Overture, whichever is used) as that provider requires.
- Add a "Data & credits" section to the README and the app footer or an About panel: OSM (ODbL) and any other dataset, with links and licence names.
- Put a licence note and the extraction date beside every baked data file (for example `data/README.md`). If the baked files are published in the repo, say they are derived from OSM under ODbL.
- Any exported file or screenshot meant to leave the app (for example GLB) should keep the credit.
- Never hide or shrink the attribution to make the UI look cleaner.

## Rules reference

All zoning and building rules, their sources and our assumptions are in `docs/zoning-rules.md`. Use its rule IDs (R-xx) and assumption IDs (A-xx) in code comments and tests. Do not add a rule to the code that isn't in that file, and update the file first when a rule changes.

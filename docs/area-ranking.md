# Choosing the demo area: a measured comparison

Date: 2026-11-21. Script: `scripts/area_stats.py` (with `scripts/fetch-osm-tiles.mjs`). Full results for 142 stations: `docs/area-stats.csv`.
Data: land-use annex map of the 2013 Bangkok plan (BMA; see `docs/zoning-rules.md` section 2.3) and OpenStreetMap buildings and roads from the OpenFreeMap tiles the app draws (© OpenStreetMap contributors, ODbL).

## Why this exists
The area was first picked by eye, and the pick was wrong twice: first Huai Khwang (brown Y.9), then a spot on Lat Phrao Road (its 500 m circle is **0 % orange, 79 % brown, 19 % red/blue** when measured). Both slips came from reading a raster map by eye. This comparison measures instead.

## Method
Every mass-transit station (BTS, MRT, Yellow/Pink lines, SRT Red lines, ARL) in central Bangkok is a candidate, because the 10,000 m² housing rule needs a plot within 500 m of a station (article 37, measured to the platform boundary). For each station, inside a **500 m circle**:
- **Orange**: share of the zoned pixels of the plan map that are orange (Y.5 to Y.7). The map is placed using the station coordinates, shifted to line the stations up with the rail lines drawn on the map (good to about 300 m). The figure is the **worst case over shifts of 240 m**, so it does not rely on a lucky alignment.
- **Building cover**: share of the circle covered by OSM building footprints. Very low values mean the area is unmapped.
- **Heights tagged**: share of footprint area whose height is not the default 5 m. It shows where OSM has height or levels data.
- **High-rise share**: share of footprint area in buildings of 23 m or more, a sign of condo-type development.
- **Road classes**: how many of four classes (primary or larger, secondary, tertiary, minor) have at least 300 m in the circle: a proxy for a main road plus sois of different widths.
- **Score** = orange × mean(min(building cover / 20 %, 1), heights tagged, road classes / 4). The weights are my choice, so the ranking was also run under four other recipes.

## Result (top 12 of 142)
| Rank | Station | Orange | Brown | Building cover | Heights tagged | High-rise share | Road classes (of 4) | Score |
|---|---|---|---|---|---|---|---|---|
| 1 | Suan Luang Rama IX | 93 % | 3 % | 17 % | 62 % | 0 % | 2 | 0.614 |
| 2 | Bang Chak | 95 % | 5 % | 21 % | 4 % | 3 % | 3 | 0.564 |
| 3 | Bearing | 94 % | 3 % | 14 % | 5 % | 3 % | 4 | 0.539 |
| 4 | Punnawithi | 92 % | 6 % | 7 % | 41 % | 37 % | 3 | 0.468 |
| 5 | Phahonyothin 24 | 79 % | 6 % | 22 % | 12 % | 12 % | 2 | 0.427 |
| 6 | Si La Salle | 98 % | 2 % | 10 % | 6 % | 6 % | 3 | 0.425 |
| 7 | Ramkhamhaeng | 62 % | 12 % | 21 % | 6 % | 3 % | 4 | 0.424 |
| 8 | Ratchayothin | 93 % | 3 % | 10 % | 6 % | 5 % | 3 | 0.409 |
| 9 | Phetkasem 48 | 94 % | 4 % | 2 % | 18 % | 18 % | 4 | 0.399 |
| 10 | Chatuchak | 66 % | 7 % | 12 % | 0 % | 0 % | 4 | 0.358 |
| 11 | Si Udom | 95 % | 5 % | 2 % | 0 % | 0 % | 4 | 0.348 |
| 12 | Chok Chai 4 | 52 % | 7 % | 20 % | 0 % | 0 % | 3 | 0.301 |

**Robustness.** Under five scoring recipes, **Bang Chak** and **Bearing** were in the top five every time, **Suan Luang Rama IX** four times, **Punnawithi** and **Phahonyothin 24** three times.

**Bearing is excluded:** the Bangkok boundary runs through its circle, so part of it is outside the BMA plan.

## Decision
Bang Chak is rank 2 on the main score, behind Suan Luang Rama IX, but it is the only station in the top five under **all five** recipes. Suan Luang Rama IX has no high-rise buildings and only two road classes, so it scores well mainly on height tagging. Bang Chak is the steadier pick.

**Sukhumvit Road at BTS Bang Chak (Phra Khanong district), with the sois Sukhumvit 91 to 99 and Soi Sukhumvit 62 beside it.**
- 95 % orange (the map labels it **Y.7-21**, read by eye) and 5 % brown, nothing public or commercial inside the circle.
- 21 % of the circle is covered by OSM building footprints (the highest among the top candidates), with a primary road, sois and minor roads.
- The BTS line is on the plot's doorstep, so the 500 m station rule is met by construction.
- Neighbour BTS Punnawithi (0.9 km south-east, also about 92 % orange) has far more high-rise buildings tagged (37 % of footprint area), so the surroundings there look more like condo country but are thinly mapped (7 % cover). A plot between the two stations is within about 460 m of both.
- Fallbacks: Suan Luang Rama IX (Yellow Line, Y.7-22, best height tagging, no high-rise) and Phahonyothin 24 / Ratchayothin (Chatuchak, Y.7-4).

## Limits (read before relying on this)
- Zone codes are read **by eye** from a raster; the shares are measured, the labels are not. The exact plot must still be checked on the BMA parcel tool or the "Check ผังเมือง กทม." app.
- Map alignment is good to about 300 m. The 500 m circles on the map are approximate; shares near a zone border can move by 10 to 20 points.
- OSM coverage and tagging are patchy everywhere; "heights tagged" is low even in the best areas, so most surroundings are drawn at a default height.
- Weights in the score are a judgement call. The top-five counts above show how much they matter.
- "Condo-heavy" is not measured, only the high-rise share as a sign of it.

## Example plot and its assumed values (final, all estimates)
The BMA parcel tool cannot be reached from the build machine, so the example plot uses the best statistical estimates below, and every one is labelled as an estimate in the app and the code (`src/example.ts`).

| Value | Assumed | How it was estimated |
|---|---|---|
| Zone | **Y.7** (map label Y.7-21) | Official 2013 map: 95 % of the zoned area in a 500 m circle around BTS Bang Chak is orange. The label was read by eye. |
| Sukhumvit Road right-of-way | **36 m** | OSM building-to-building gap across the road (171 samples): 10th percentile 32 m, lower quartile 40 m, median 55 m. The two carriageway lines are 20.6 m apart. The ROW cannot be larger than the gap, so a value between the 10th percentile and lower quartile was taken. |
| Sukhumvit Soi 95 right-of-way | **12 m** | Gap across the soi (33 samples): 10th percentile 9 m, lower quartile 12 m, median 13 m. Soi 91: 13 m. Soi 93 is wider (about 20 m). |
| Within 500 m of a station | **yes** (about 175 to 230 m) | Distance from the plot's corners to the BTS Bang Chak station node. The legal measure is to the platform boundary (article 37). |
| Plot | **50 m by 40 m = 2,000 m²**, empty | Hypothetical, at the corner of Sukhumvit Road and Soi 95; edge 1 faces the soi, edge 4 faces Sukhumvit Road (A-01). |

Effect of the values: the soi gives a 1.2 m road setback (R-13), Sukhumvit Road 2 m (R-14); the 36 m road sets the height plane (R-21, R-22); the 10,000 m² limit is reached at FAR 5 and is allowed because a station is within 500 m (R-40). Sukhumvit Road being 32 m or 40 m instead of 36 m changes only the height plane.

# Zoning and building rules: orange zone (Y.5 – Y.7), Bangkok

Research notes for the plot planner. Rules have IDs (R-xx) so code, tests and the write-up can point to them. Assumptions have IDs (A-xx). Open questions are in section 8.

**Status key:** ✅ read in the official Thai text · ⚠️ secondary source or memory, not checked · 🅰️ our assumption, made so the tool can run

Translations are mine, and the PDF text had extraction glitches. Before a number goes into a test or the write-up, re-read the Thai article cited.

## 1. Sources

| ID | Document | Used for | Link |
|---|---|---|---|
| A | Ministerial Regulation enforcing the Bangkok Comprehensive Plan B.E. 2556 (2013). Royal Gazette vol. 130, part 41 ก, 16 May 2013 | Zone types, FAR, OSR, allowed uses, FAR bonus | https://download.asa.or.th/03media/04law/cpa/mr56-bma.pdf |
| B | Ministerial Regulation No. 55 (B.E. 2543) under the Building Control Act B.E. 2522, copy updated to MR No. 68 (B.E. 2563) | Buildings up to 23 m: open space, road and canal setbacks, height, boundary distances | https://download.asa.or.th/03media/04law/cba/mr/mr43-55-upd68.pdf |
| C | Ministerial Regulation No. 33 (B.E. 2535) as amended, copy updated to MR No. 69 (B.E. 2564) | High-rise (23 m or more) and special large buildings | https://download.asa.or.th/03media/04law/cba/mr/mr35-33-upd69.pdf |

- The **2013 plan is the one in force.** A 4th revision is in draft (expected around 2027). Do not use its numbers.
- Sources B and C are copies on the Association of Siamese Architects site, not the Royal Gazette. Amendments after the dates above may exist.
- Parking figures come only from news and teaching material, not from the regulations (see A-09).

## 2. Which zone, and the density limits

### 2.1 What orange means (✅ A, article 7 (2))

Orange is **medium-density residential**, in three land types, each with numbered sub-areas on the zoning map:

| Type | Purpose | Sub-areas |
|---|---|---|
| Y.5 | Residential growth next to the inner city | Y.5-1 to Y.5-37 |
| Y.6 | Residential next to the inner city, suburban centres and industrial estates | Y.6-1 to Y.6-48 |
| Y.7 | As Y.6, within reach of mass transit | Y.7-1 to Y.7-30 |

### 2.2 Limits (✅ A, articles 12, 13, 14)

| ID | Type | Max FAR | Min OSR |
|---|---|---|---|
| R-01 | **Y.5** | **4 : 1** | **7.5 %** |
| R-02 | **Y.6** | **4.5 : 1** | **6.5 %** |
| R-03 | **Y.7** | **5 : 1** | **6 %** |

### 2.3 Where orange actually is: check against the official map (read 2026-11-21)

**Source.** The land-use annex map of the 2013 plan ("แผนผังกำหนดการใช้ประโยชน์ที่ดินตามที่ได้จำแนกประเภทท้ายกฎกระทรวง ... ผังเมืองรวมกรุงเทพมหานคร พ.ศ. ๒๕๕๖", A0 sheet, PDF dated 15 May 2013), published by the BMA City Planning Department at `cityplangis.bangkok.go.th/cpdPortal/wp-content/uploads/2019/08/02_cpd56.pdf`. The BMA site blocks automated access from the development machine, so the file was taken from the Internet Archive's copy of that URL (snapshot of 2022-07-22). The PDF is a raster image with no text layer. Zones and sub-area codes were read **by eye** from crops rendered at 200 dpi (crops kept locally in `notes/zone-map/`, not in the repository).

**What the map shows** (labels are the sub-area codes printed on the map; Thai digits converted). **Corrected 2026-11-21**: an earlier version of this table said the Lat Phrao Road stretch near the five-way was orange; measuring it showed it is not.

| Place | What the map shows | Colour |
|---|---|---|
| Ratchadaphisek Road at MRT Huai Khwang, and west of it (Din Daeng) | Y.9-5, Y.9-6, Y.9-13, Y.9-14, Y.9-18 | **Brown** (high density), not orange |
| Huai Khwang district, east of Ratchadaphisek (about 0.5 to 1 km from the road) | Y.6-16, Y.6-24, Y.6-23, Y.7-13, Y.7-15, Y.7-16, Y.5-18, Y.5-19 | **Orange** |
| Lat Phrao Road between the Phahon Yothin five-way and MRT Lat Phrao (earlier demo spot, 13.8112 N 100.5655 E) | Y.9-1, Y.9-2, with red (commercial) and blue (public) land | **Not orange**: a 500 m circle there is 0 % orange, 79 % brown, 19 % red/blue |
| Phahon Yothin Road north of the five-way, at BTS Phahon Yothin 24 and Ratchayothin | Y.7-4, with Y.5-12 beside it | **Orange** (about 80 to 93 % of a 500 m circle) |
| Lat Phrao Road east of Ratchadaphisek, towards Wang Thonglang (Yellow Line) | Y.7-5, Y.7-7, Y.7-9, Y.7-10 as a strip, Y.4 (yellow) beside it | Orange strip; about 52 to 90 % orange at the Yellow Line stations |
| Sukhumvit Road at BTS Bang Chak (Phra Khanong district) | Y.7-21 | **Orange** (95 % of a 500 m circle) |
| Srinagarindra Road at Suan Luang Rama IX (Yellow Line) | Y.7-22 | **Orange** |
| Wang Thonglang north-east of Lat Phrao Road; Lat Phrao (Ladprao) district | Y.4-xx | **Yellow** (low density) |

**Reading.** Y.7 follows the rail lines, but not all of them: the Lat Phrao Road stretch near the five-way is brown and red. The measured comparison of every station is in `docs/area-ranking.md`, which picks **BTS Bang Chak on Sukhumvit Road (Y.7-21)**. **MRT Huai Khwang is on brown.**

**Limits of this check (⚠️).**
- The codes were read visually from a raster. A digit can be misread (for example ๓ and ๗). Check the exact plot on the BMA parcel tool or the "Check ผังเมือง กทม." app.
- Sub-area labels sit inside their areas and do not say where a boundary runs next to a particular soi. Boundaries near roads follow the plan's own lines; a soi at the edge of a zone can fall on either side.
- The map is the 2013 plan. A 4th revision is in draft and may change zones (A-12 and section 1).
- Brown Y.8 to Y.10 were not studied in this tool (article 15 to 17); the app models orange only.

Definitions (✅ A, article 4):

- **FAR** = floor area of all floors of all buildings ÷ area of the plot the buildings stand on.
- **OSR** = uncovered open space on the plot ÷ **total floor area** of all floors. It is *not* a share of plot area.
- The open space must also be at least the **building-law minimum** (sections 3.3 and 4.3). The larger of the two wins.
- At least **50 %** of the open space must be permeable ground for planting.
- Plots that were split must still meet the limits when taken together.

**What counts as open space** (✅ C, article 1, "ที่ว่าง"): ground that has no roof or structure over it. It can be ponds, pools, waste tanks, outdoor parking, and structures no higher than 1.20 m without a cover.

## 3. Rules by building height

The regime depends on the **height of the design**, so the tool has to pick it per design.

| Height | Regime |
|---|---|
| Under 23.00 m | Source B (MR 55) |
| 23.00 m or more ("high-rise"), or any floor or total of 10,000 m² or more ("special large building") | Source C (MR 33) **and** source B. The stricter value applies. |

How height is measured:

- From ground level to the **roof slab** (✅ C, article 1). For gable or hip roofs, to the top of the wall of the highest floor (✅ B, article 44).
- A high-rise is a building people can enter or use (✅ C, article 1).

### 3.1 Buildings under 23 m (✅ B)

| ID | Rule | Requirement | Art. |
|---|---|---|---|
| R-10 | Open space, housing | At least **30 %** of the **largest single floor area** | 33 |
| R-11 | Road setback, road under 6 m wide | At least **3 m from the road centre line** | 41 |
| R-12 | Road setback, building over 2 storeys or over 8 m, road under 10 m wide | At least **6 m from the road centre line** | 41 (1) |
| R-13 | Same, road 10 to 20 m wide | At least **1/10 of the road width** from the road boundary | 41 (2) |
| R-14 | Same, road over 20 m wide | At least **2 m** from the road boundary | 41 (3) |
| R-15 | Canal or small waterway | Under 10 m wide: at least **3 m** from its boundary. 10 m or wider: **6 m**. Large water body (lake, sea): **12 m**. Bridges, fences, piers, signs and open parking are exempt. | 42 |
| R-16 | Boundary distance, walls with openings or balconies | **2 m** if the building is up to 9 m high. **3 m** if over 9 m and under 23 m. | 50 |
| R-17 | Boundary distance, walls closer than R-16 | Must be solid walls at least **0.5 m** from the boundary. A building up to 15 m high may sit on the boundary with the neighbour's written consent. | 50 |
| R-18 | Distance between buildings on one plot | Facing walls with openings: 4 m, 5 m or 6 m depending on the two heights. Solid walls: 1 to 3.5 m. See the article for the table. | 48 |
| R-19 | Fence on the road line | A fence or wall nearer to the road than its own height may be at most 3 m high. | 47 |

### 3.2 Height limit from the road (✅ B, articles 44 to 46)

| ID | Rule |
|---|---|
| R-20 | At any point, building height ≤ **2 × the horizontal distance** from that point, measured at right angles to the **boundary of the public road on the opposite side**, taking the nearest road. |
| R-21 | A building between two roads of different widths: the limit uses the **wider** road, if the roads are within 60 m of each other and the building's width along the wider road is within 60 m (article 45). |
| R-22 | A corner building: the limit uses the wider road, and the building's length along the narrower road must not exceed 60 m (article 46). |

R-20 makes the top of the envelope a **sloped plane** rising from the far side of the road. Worked example: a 10 m wide road, building set back 6 m from the road boundary. The distance to the far boundary is 16 m, so the height limit there is 32 m. It rises 2 m for every metre further from the road.

### 3.3 High-rise and special large buildings (✅ C)

| ID | Rule | Requirement | Art. |
|---|---|---|---|
| R-30 | Plot frontage, total floor area up to 30,000 m² | One side of the plot at least **12 m** long, touching a public road with a **right-of-way of at least 10 m**. That road must run on continuously to join another public road with a right-of-way of at least 10 m. | 2 |
| R-31 | Plot frontage, total floor area over 30,000 m² | Same, with a right-of-way of at least **18 m**. | 2 |
| R-32 | Access | The plot side on the road must be at least 12 m wide all the way to the building and kept clear for fire-engine access. | 2 |
| R-33 | Fire lane | A road surface at least **6 m wide**, with nothing over it, **all the way round the building**. | 3 |
| R-34 | Distance from boundaries | The outermost part of the building, above or below ground, must be at least **6 m from a neighbour's plot boundary or from a public road**. Foundations are excluded. | 4 |
| R-35 | FAR cap | Total floor area of all buildings on the plot ÷ plot area **at most 10 : 1**. Not the binding limit in orange zones, where the zone FAR is lower. | 5 |
| R-36 | Open space | Residential: at least **30 % of the plot area**. Other uses: 10 %. Mixed uses with housing: 30 %. | 6 |
| R-37 | Basement | A floor below ground must not be used for housing. It needs its own ventilation and drainage, separate from the floors above. | 7 |

R-34 means a high-rise has **6 m on every side**, including the road side. This is stricter than R-13 and R-14, so for a high-rise the 6 m governs.

### 3.4 Use limits in the orange zones (✅ A, articles 12, 13, 14)

| ID | Rule |
|---|---|
| R-40 | A residential building with total floor area over **10,000 m²** is **prohibited** unless the plot is on a public road with a right-of-way of at least **30 m**, or **within 500 m of a mass-transit station**. Y.5 and Y.6 also allow it for low-income housing run by the Bangkok Metropolitan Administration, the National Housing Authority, or the Community Organizations Development Institute. |
| R-41 | Other uses (hotels, commercial space, offices) have size limits that need a wide road or a station nearby. They are not needed for a condo-only first version. Read articles 12 to 14 before offering other types. |

## 4. How the rules combine

### 4.1 Allowed floor area

```
max_floor_area = FAR_zone × plot_area                 (R-01 to R-03)
```

### 4.2 Required open space

```
open_space_min = max( OSR_zone × floor_area,          (R-01 to R-03)
                      building_law_minimum )
building_law_minimum =
   height < 23 m  : 0.30 × largest_floor_area         (R-10)
   height ≥ 23 m  : 0.30 × plot_area                  (R-36)
planted_min = 0.5 × open_space_min
```

### 4.3 Worked example, Y.6, plot 2,000 m²

| Quantity | Value |
|---|---|
| Max floor area | 4.5 × 2,000 = **9,000 m²** |
| OSR minimum | 6.5 % × 9,000 = 585 m² |
| High-rise open space (R-36) | 30 % × 2,000 = **600 m²**, so this governs |
| Footprint limit (plot − open space) | 2,000 − 600 = 1,400 m² |
| Floors needed at the footprint limit | 9,000 ÷ 1,400 ≈ 6.4, about 7 floors |
| Height at 3.2 m per floor | about 22 m, so **under 23 m** |

At 7 floors the building is not a high-rise, so source B applies and the open space is 30 % of the largest floor instead. A taller, slimmer design crosses 23 m and switches to source C. **The tool must decide the regime per design**, and each design's checklist should say which regime it used.

### 4.4 Envelope construction

1. Start from the plot polygon.
2. Remove a strip for each edge: road edges by R-11 to R-14, canal edges by R-15, other edges by R-16, or R-34 (6 m) for a high-rise. Use the stricter value.
3. For a high-rise, check R-30 to R-33 (frontage, fire lane).
4. Cap the height with the road plane (R-20 to R-22), and with the 23 m line if the design is meant to stay under it.
5. Fit floors until the floor area reaches the FAR limit (4.1).
6. Check open space (4.2) and report pass or fail.

## 5. FAR bonus (✅ A, articles 50 to 57)

The total bonus is capped at **20 %** of the base FAR (article 57).

| Route | Bonus | Condition | Art. |
|---|---|---|---|
| Low-income or existing-resident housing in the project | up to 20 % | Extra floor area at most 4 × the housing area provided | 52 |
| Water retention | 5 % at 1 m³ per 50 m² of plot, more in proportion, up to 20 % | | 55 |
| Energy-efficient building | 5, 10, 15 or 20 % for certification levels 1 to 4 | Green-building certification | 56 |
| Public open space | up to 20 % | Only for public buildings in brown and commercial zones, not orange | 53 |
| Public parking near stations | up to 20 % | Only for public buildings | 54 |

First version: show the base limit, and list the bonus routes as "not modelled".

## 6. Parking (⚠️ not in the regulations we read)

- ✅ **No general FAR exemption for parking** in source A. The only parking exemption is extra public parking in public buildings near certain stations (article 54). So **parking floors count toward FAR** unless an exemption is found elsewhere.
- ⚠️ Two secondary sources (a Bangkok Biznews article and a car-parking guide) say Bangkok requires **1 space per 120 m²** of floor area for residential buildings, attributing it to Ministerial Regulation No. 7 or a Bangkok bylaw. I did not find the text. Treat as informational (A-09).
- ⚠️ Checked again on 2026-11-21 with a web search: [Thailand Construction](https://thailand-construction.com/bangkok-car-park-rules-under-scrutiny) and [The Nation](https://www.nationthailand.com/business/40068634) repeat the figure of **1 space per 120 m² of construction area** for a new Bangkok condominium, and a Japanese government report on Thai building rules lists **Ministerial Regulation No. 7 (1974)** as the one on parking structure. Still no regulation text, so the figure stays informational. The same sources say the condo industry association (RESAM) is asking for mandatory parking to be dropped near rail stations; we saw no sign this has been adopted, so we do not model it. A [Chulalongkorn study](https://so05.tci-thaijo.org/index.php/sarasatr/article/view/242164) finds Bangkok condos provide about 105 % of the minimum on average.

## 7. Assumptions

| ID | Assumption | Why | Effect if wrong |
|---|---|---|---|
| A-01 | The plot is an **empty field**. Redevelopment comes later. | Agreed with the candidate. The brief doesn't say. | Existing buildings on the plot are ignored. |
| A-02 | The demo plot is in orange **Y.7** (or Y.5/Y.6, set by the user). **Changed 2026-11-21 (twice):** the official map shows **brown Y.9 at MRT Huai Khwang**, and the Lat Phrao Road stretch near the five-way is also not orange. The measured comparison (`docs/area-ranking.md`) picks **Sukhumvit Road at BTS Bang Chak**, which the map labels **Y.7-21**. The sub-area **of the exact plot is still to be checked on the parcel tool**. | Read from the official land-use map of the plan (section 2.3) and measured with a script. | FAR and OSR change (R-01 to R-03). A plot on a different sub-area needs a different zone selection in the app. |
| A-03 | Floor-to-floor height is **3.2 m** for housing. | Typical for condos. | Floor counts and the 23 m switch move. |
| A-04 | **All floors count toward FAR**, including parking and basements. | Source A has no general exemption. This is the conservative reading. | Designs may show less floor area than the authority would allow. |
| A-05 | The road width the user enters is the **right-of-way width** (boundary to boundary). | R-30 and R-20 use boundaries. OpenStreetMap only has road centre lines. | Heights and setbacks are off. We need a visible input and a default. |
| A-06 | Walls are assumed to have **openings**. | Stricter, so it is the safe side (R-16). | Side setbacks may be larger than needed. |
| A-07 | If **any part** of a design reaches 23 m, the **whole building** is treated as a high-rise. | The 6 m rule applies to the outermost part of the building (R-34). | A low podium may be allowed closer than we allow. |
| A-08 | A plot on two or more roads uses the **widest** road for the height plane. | R-21 and R-22 say the wider road for two roads (corner plot, or a building between two roads). We extend it to more than two. | Height limit may be too generous or too tight. |
| A-09 | Parking is **informational**: 1 space per 120 m² of floor area, shown but not pass or fail. | Unverified (section 6). | Not part of the checklist. |
| A-10 | The user states whether the plot is **within 500 m of a station** or on a **30 m road**, with a toggle. | R-40 needs it. We have no station data baked in. | A big condo may be shown as allowed when it isn't. |
| A-11 | The ground is **flat**. Heights are measured from the plot's ground level. | Bangkok is flat. | Negligible. |
| A-12 | No local **building-line** or road-widening ordinance applies. | Unknown. C article 3 says to measure from such a line if one exists. | Road setbacks may be short. |
| A-13 | A **canal** edge is a small waterway: 3 m setback if under 10 m wide, 6 m if 10 m or wider (R-15). A high-rise keeps its 6 m (R-34). The plot boundary is taken as the water's edge. A large water body (12 m) is not offered. Canals do not make a height plane. | R-15. R-20 to R-22 are about roads only. | A plot on a river or lake would be shown with too small a setback. |
| A-14 | Extra **road** edges each get their own setback (R-11 to R-14) from their own width. For a corner plot the length of the building along each narrower road is checked against 60 m (R-22). R-21 (a plot between two roads, not a corner) is **not** modelled. | R-21, R-22. | A through-plot may get a different height limit from the authority. |

## 8. Open questions

- ❓ The sub-area code at the chosen district, checked on the official BMA zoning map. Official data service: not found. The BMA open-data listing points to a map service on a bangkok.go.th host, but we could not reach its catalogue, so the check is manual (the "Check ผังเมือง กทม." app or the BMA map).
- ❓ Parking count and any FAR exemption for parking and basements. Partly answered: the 1 per 120 m² figure is confirmed by more secondary sources (section 6) but not by regulation text. Still to read: the Bangkok building bylaw (B.E. 2544) and MR No. 7 (B.E. 2517).
- ✅ **How the 500 m to a station is measured:** from the **platform boundary** of the mass-transit station (แนวเขตชานชาลา), not from the entrance or the station centre. Source A, article 37 (read in the Royal Gazette text, 2026-11-21). The tool still takes a yes/no input (A-10) and does not measure; the user should measure to the platform edge.
- ❓ Article 36 sets stricter tests for "a road of 30 m" (a plot side of at least 30 m on a road of at least 30 m that runs through to a road of at least 16 m, within 500 m). Its wording covers land uses along roads listed in the plan's annex, so whether it applies to the 10,000 m² housing rule (R-40) needs a closer read. Until then A-10 treats "a 30 m road" simply as a road with a 30 m right-of-way.
- ❓ Whether the rooftop-structure paragraph added to MR 55 article 44 in 2020 changes how height is measured. The PDF text for it was damaged.
- ❓ Amendments to MR 33, 55 and the plan after the dates of the copies we read.
- ❓ Fire-lane details (R-33): does it need to be continuous and public, and can it overlap the open space? A web search found no text on this. A search summary also mentioned that the Cabinet approved a draft amendment to MR 33 on fire safety for high-rise buildings in 2023; we did not read it, so treat it as a lead to check.

## 9. For the write-up

- Which plan we use (2013, not the 4th draft), and that numbers come from the Royal Gazette text of A and from copies of B and C.
- The assumptions above, in plain words, especially A-01, A-03, A-04, A-05.
- What the tool does not model: FAR bonus, parking, fire and structural rules, redevelopment, other zones.
- A research note: a web search turned up a public GitHub project with a similar idea. We did **not** open or use it. The rules in this file come from the official texts above.

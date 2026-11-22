# Rule IDs and the tests that mention them

Generated from `docs/zoning-rules.md` (every R-xx and A-xx ID in it) by searching `src/**/*.test.ts` for the ID. **A test file mentioning an ID is not proof that the rule is fully tested**: it only shows where to look. IDs with no test mention are listed first.

52 IDs in the doc: 15 are named in at least one test file, **37 are not**.

## Not named in any test

A-01, A-02, A-03, A-04, A-06, A-08, A-09, A-11, A-12, A-15, A-16, A-17, A-18, A-19, A-20, A-21, R-02, R-03, R-10, R-12, R-13, R-16, R-17, R-18, R-19, R-21, R-31, R-32, R-33, R-34, R-35, R-37, R-40, R-41, R-52, R-53, R-54

## All IDs

| ID | Named in tests | Used in code |
|---|---|---|
| A-01 | **none** | example.ts, existingBuildings.ts, store.ts |
| A-02 | **none** | example.ts, store.ts |
| A-03 | **none** | rules/zones.ts |
| A-04 | **none** | engine/index.ts |
| A-05 | engine/engine.test.ts | engine/index.ts, example.ts, rules/setbacks.ts, store.ts |
| A-06 | **none** | rules/setbacks.ts |
| A-07 | engine/engine.test.ts | engine/index.ts |
| A-08 | **none** | engine/index.ts |
| A-09 | **none** | engine/index.ts |
| A-10 | example.test.ts | engine/index.ts, example.ts, store.ts |
| A-11 | **none** | - |
| A-12 | **none** | - |
| A-13 | engine/engine.test.ts | engine/index.ts, rules/setbacks.ts |
| A-14 | engine/engine.test.ts | engine/index.ts |
| A-15 | **none** | - |
| A-16 | **none** | rules/uses.ts |
| A-17 | **none** | engine/index.ts |
| A-18 | **none** | engine/index.ts, rules/uses.ts |
| A-19 | **none** | engine/index.ts, rules/uses.ts |
| A-20 | **none** | engine/index.ts, rules/uses.ts |
| A-21 | **none** | engine/index.ts, engine/rows.ts, rules/uses.ts |
| R-01 | engine/engine.test.ts | engine/index.ts, rules/zones.ts |
| R-02 | **none** | - |
| R-03 | **none** | engine/index.ts, rules/zones.ts |
| R-10 | **none** | engine/index.ts, rules/setbacks.ts |
| R-11 | engine/t4-roadwidth.test.ts | rules/setbacks.ts |
| R-12 | **none** | engine/index.ts, rules/setbacks.ts |
| R-13 | **none** | rules/setbacks.ts |
| R-14 | engine/engine.test.ts, engine/t4-roadwidth.test.ts | rules/setbacks.ts |
| R-15 | engine/engine.test.ts | rules/setbacks.ts |
| R-16 | **none** | engine/index.ts, rules/setbacks.ts |
| R-17 | **none** | - |
| R-18 | **none** | - |
| R-19 | **none** | - |
| R-20 | engine/engine.test.ts | engine/index.ts |
| R-21 | **none** | engine/index.ts |
| R-22 | engine/engine.test.ts, example.test.ts | engine/index.ts, rules/setbacks.ts |
| R-30 | engine/engine.test.ts | engine/index.ts, rules/setbacks.ts |
| R-31 | **none** | engine/index.ts, rules/setbacks.ts |
| R-32 | **none** | - |
| R-33 | **none** | engine/index.ts |
| R-34 | **none** | engine/index.ts, rules/setbacks.ts |
| R-35 | **none** | - |
| R-36 | uses.test.ts | engine/index.ts, rules/setbacks.ts, rules/uses.ts |
| R-37 | **none** | - |
| R-40 | **none** | engine/index.ts, rules/uses.ts |
| R-41 | **none** | - |
| R-50 | uses.test.ts | engine/index.ts, rules/uses.ts |
| R-52 | **none** | engine/index.ts, rules/uses.ts |
| R-53 | **none** | engine/index.ts, rules/uses.ts |
| R-54 | **none** | engine/index.ts, rules/uses.ts |
| R-56 | engine/engine.test.ts, uses.test.ts | engine/index.ts, rules/setbacks.ts, rules/uses.ts |

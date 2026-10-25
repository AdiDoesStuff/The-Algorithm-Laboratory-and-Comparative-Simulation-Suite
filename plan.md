# AlgoLab Implementation Plan

**Project:** The Algorithm Laboratory and Comparative Simulation Suite
**Written:** 25 Oct 2026, from the README, the abstract/roadmap, and the technical audit of the current working tree.
**Last updated:** 25 Oct 2026 — Phase B3-B5 in progress on branch `phase-b-shell` (baseline 78/78 tests green before B3; B2 lesson engine shipped).
**Stack constraint:** Flask + vanilla JS/HTML/CSS, no frontend build system. Keep it that way.

---

## 0. Where things stand

| Area | State |
| --- | --- |
| Sorting Duel (10 algos) | Done, mature. Lives on `sorting.html` and opens directly; `index.html` is the hub and owns the landing splash. |
| Pathfinding Lab (3 algos) | Done, mature. |
| Glossary | Done. Separate page, not yet contextual. |
| BST / binary tree module | ✅ **Stable.** Op-log backend, stateless replay, stable node IDs, successor relinking, tree mirroring / structural comparison, insertion path highlight, dual-canvas Compare section, automatic fit-view, 78 pytest tests in the suite. Committed on `phase-a-stabilize`. |
| Backend structure | ✅ `validation.py`, `tracing.py` extracted. Global error handlers (HTTPException + 500). Binary array mode with hole-drop policy. `docs/TRACE_SPEC.md` committed with dual-snapshot spec. |
| Frontend engine | ✅ `engine/PlaybackController.js` (ES module). `bst.js` uses op-log, busy gate, stale-response guard, error banner, bracket sanitization, auto fit-view. |
| Primitives | `TreeCanvas` (production with animated fit-view and path highlight), `treeAdapter` (production), `BucketGrid` and `GrowthChart` (fixture-tested only, `test.html`). |
| Hub, shared nav, unit registry | ✅ **B1 shipped.** `shell/units.js` (single source of truth), `shell/nav.js` (classic script, one `<nav>`), `index.html` hub with the landing splash, live/soon cards, empty progress slots, disabled "Test yourself", Guided Path placeholder. |
| Lesson engine | ✅ **B2 shipped.** `engine/LessonRunner.js` (generic, unit-agnostic), `lessons/bstLessons.js` (two data-only lessons), pinned narration, predict-then-reveal checkpoints, `quiz_prompt` placeholder. QuizEngine and progress are still B3-B4. |
| Heap / AVL / Trie / Hash / DP / Bench | Empty stubs in `app.py` and `trees.py`. |
| Tests | ✅ 78/78 pytest tests green (38 API, 40 unit). Covers delete cases, traversals, classify, duplicates, replay property, stability, binary mode, bad-payload validation, structural tree mirroring, search/insert path ancestor chains, and B1 static routes. |

### Audit findings that shape the plan

1. ~~BST files are untracked. Commit first.~~ ✅ Committed on branch `phase-a-stabilize` (`b201ff8`).
2. ~~**State model flaw.** The UI stores a `values[]` history and the backend rebuilds by re-inserting. After a two-child delete the displayed tree and the rebuilt tree can differ in shape. AVL will make this far worse because shape depends on rotation history.~~ ✅ Replaced with **op-log** (`b201ff8`). Client sends `ops[]`; backend replays statelessly. `values` shim kept as deprecated fallback (remove end of Phase B).
3. ~~Node IDs reset per request, and two-child delete rewrites a label in place, so identity is unstable.~~ ✅ Node ID = index of inserting op (`b201ff8`). Two-child delete relinks successor, preserving its ID.
4. ~~`/tree` calls `int()` with no guard: bad input gives a 500.~~ ✅ `validation.py` guards all inputs; all errors return `400 {"error","field"}` (`ffd73d3`, `8d0588c`, `8e20f62`).
5. ~~Duplicate handling disagrees between `_silent_insert` (discards) and `bst_insert_steps` (inserts right).~~ ✅ Both paths reject duplicates with `ValidationError` → HTTP 400 (`b201ff8`).
6. ~~Traversal ignores `tree_type`, so array-built binary trees are traversed as a rebuilt BST.~~ ✅ `tree_type` respected; binary mode takes `array` field; `ops` rejected for `tree_type="binary"` (`d186ef3`).
7. ~~No busy gate or sequence counter: overlapping requests and stale responses repaint wrongly.~~ ✅ `isBusy` gate in `runAction()`; `createLatest()` sequence guard on classify/height-depth (`541154a`).
8. `TreeCanvas` redraws the DOM and has no tweening, so rotation animation needs new work. *(Open — Phase C1.)*
9. The bar renderer is tied to sorting. The heap dual panel needs it extracted. *(Open — Phase C1.)*
10. ~~Navigation markup is duplicated across pages. `index.html` is the sorting page, not a hub.~~ ✅ `shell/nav.js` renders one `<nav aria-label="Primary">` from `shell/units.js`; sorting moved to `sorting.html`; `index.html` is the hub. *(B1, `71e91b3`, `2c48c40`.)*

---

## 1. Guiding principles

- Backend generates authoritative traces. Frontend renders, narrates, interacts. Quizzes never touch the backend.
- Stateless backend: the client sends the full op log, the server rebuilds from scratch.
- One trace contract for everything. New units add `type` strings, not new response shapes.
- Primitives are reused, never forked per unit.
- Playground and Guided Path share unit pages. One codebase, two entry points.
- Learn Mode is bidirectional (forward and back) from the start.
- Soft gating only. No XP, streaks, or leaderboards. Predict-then-reveal over gamification.
- Stabilize each phase before expanding. A phase is done only when its exit criteria pass.
- Terminology precision: the knapsack coverage is strictly **0/1 Knapsack solved three ways**.

---

## 2. Target architecture

### 2.1 Directory layout (target)

```text
backend/
  app.py                  # routes, validation helpers, error handlers
  validation.py           # shared request validators
  tracing.py              # make_step, DEFAULT_ROLES, snapshot helpers
  algs.py                 # sorting
  pathfinding.py
  trees.py                # BST / binary tree
  heaps.py                # heap + heapsort
  avl.py
  tries.py
  hashing.py
  merkle.py
  design/
    knapsack.py
    nqueens.py
    recursion_tree.py
    bench.py
  tests/
    test_trees.py, test_heaps.py, test_avl.py, ...
frontend/
  index.html              # hub + landing splash
  sorting.html            # moved from index.html, opens directly
  pathfinding.html, bst.html, heaps.html, avl.html, tries.html,
  hashing.html, merkle.html, design.html, definitions.html
  js/
    shell/                # units.js, nav.js, hub.js, landing.js (B1);
                          # layout.js, progress.js (B2-B3)
    engine/               # PlaybackController.js, LessonRunner.js
    primitives/           # TreeCanvas, treeAdapter, BucketGrid, GrowthChart,
                          # ArrayStrip, QuizEngine
    lessons/              # bstLesson.js, avlLesson.js, ...
    quizzes/              # bstQuiz.js, sortingQuiz.js, ...
    pages/                # bst.js, heaps.js, ... (thin page controllers)
docs/
  TRACE_SPEC.md           # authoritative trace contract
  LESSON_SPEC.md
```

### 2.2 Request contract: op log

```json
{
  "algorithm": "bst_op",
  "tree_type": "bst",
  "ops": [{"op":"insert","value":50},{"op":"insert","value":30},{"op":"delete","value":50}],
  "action": {"op":"insert","value":40}
}
```

- `ops` is the replayed history. `action` is the one op whose steps are returned.
- The server replays `ops`, then emits steps for `action`, and returns `final_tree`, `steps`, `metrics`.
- Node ID = index of the op that created it. Stable across rebuilds.
- Deletion **relinks** the successor node, so IDs stay attached to values.

### 2.3 Step contract (to freeze in `docs/TRACE_SPEC.md`)

```json
{
  "type": "compare",
  "kind": "tree",
  "snapshot": {},
  "annotation": "text",
  "highlighted": [], "comparing": [], "rotating": [],
  "pruned": [], "new_node": [], "selected": [],
  "payload": {}
}
```

- Top-level response: `{ steps, final_tree|final_state, metrics, metadata }`.
- `kind` is `tree | array | grid | chart`, so one dispatcher can route snapshots.
- Rotation steps add `snapshot_before`, `snapshot_during`, `snapshot_after` and a `rotating` array.
- Every `type` must be listed in `TRACE_SPEC.md` with its role arrays and payload fields. No undocumented types.

### 2.4 Error contract

All validation failures return `400 {"error": "...", "field": "..."}`. Nothing user-reachable returns a 500.

---

## 3. Phase overview

| Phase | Name | Est. sessions* | Depends on |
| --- | --- | --- | --- |
| A | Stabilize Unit 1 (BST) | 4-5 | none |
| B | Shell: hub, nav, Learn/Play engine, quizzes, progress | 5-6 | A |
| C | Unit 2: Heaps and AVL | 7-9 | B |
| D | Unit 3: Tries, Hashing, Merkle | 5-7 | B |
| E | Unit 4: Design and Analysis | 8-10 | B (C helpful) |
| F | Migration and polish | 5-6 | B-E |

*A session is about 3-4 focused hours. Total is roughly 35-43 sessions. D can run in parallel with C if you want, but they share the shell, so finish B first.

---

## Phase A: Stabilize Unit 1

**Goal:** BST is correct, tested, tracked, and safe to build on.

### A0. Safety (first, 15 min)
- [x] Commit all untracked BST files (`trees.py`, `bst.html`, `bst.js`, `primitives/`, `primitives.css`, `test.html`). ✅ `b201ff8`
- [x] Create branch `phase-a-stabilize`. ✅ active branch

### A1. Backend contract
- [x] Add `validation.py` with helpers (`require_list`, `require_int`, `require_enum`, bounds). No raw `int()` in `app.py`. ✅ `ffd73d3`
- [x] Add a Flask error handler so unexpected exceptions return JSON, not an HTML 500. Separate handlers for `werkzeug.HTTPException` (preserves status code) and generic `Exception` (fixed "Internal server error" message, traceback logged server-side, never `str(e)`). ✅ `8d0588c`, `8e20f62`
- [x] Move `/tree` to the op-log request shape. Keep the old `values` shape as a deprecated shim until the frontend migrates (remove at end of Phase B). ✅ `b201ff8`
- [x] Stable IDs: ID = index of the inserting op. Remove the global `Node._next_id` reset dependency. ✅ `b201ff8`
- [x] Two-child delete relinks the successor node. IDs persist. ✅ `b201ff8`
- [x] Duplicate policy: reject insert with `400` and message. Make `_silent_insert` and `bst_insert_steps` use the same code path. ✅ `b201ff8`
- [x] Add `tree_type` to traversal. Binary trees are never rebuilt as BSTs. Binary mode uses `array` field; `ops` rejected for `tree_type="binary"`. ✅ `d186ef3`
- [x] Handle `array_to_tree` holes: orphaned descendants of a `null` are **dropped** (not rejected); warning string surfaced in response under `warnings[]`. ✅ `d186ef3`
- [x] Extract `make_step` and `DEFAULT_ROLES` into `tracing.py`. `delete_done` step type added and documented. ✅ `ffd73d3`, `d186ef3`
- [x] Write `docs/TRACE_SPEC.md` (see §2.3). ✅ `1664efa`
- [x] `bst_height_depth`: `target_id` takes exclusive priority; `target_value` used only when `target_id` absent; 400 with `field="target_id"` if ID not found. ✅ `8e20f62`
- [x] Absent-value delete raises `ValidationError(field="delete_value")` directly. No broad `except ValueError`. ✅ `8e20f62`

### A2. Tests (pytest, dev-only requirements)
- [x] `requirements-dev.txt` with pytest. Runtime `requirements.txt` stays minimal. ✅ `1664efa`
- [x] Insert: empty tree, root, left, right, duplicate rejected. ✅ `941e729`
- [x] Delete: leaf, one child (left and right), two children (immediate + deep successor), root, absent value. ✅ `941e729`
- [x] Traversals: inorder/preorder/postorder/levelorder, empty tree, binary array tree. ✅ `941e729`
- [x] Classify: empty, single, skewed, full-not-complete, complete-not-full, perfect, unbalanced, hole-filled binary tree. ✅ `941e729`
- [x] Height/depth: `target_id` exclusive search, `target_value` fallback. ✅ `941e729`, `8e20f62`
- [x] Validation: bad payload per algorithm (8 parametrized cases), non-JSON body, missing/bad algorithm, binary-mode rejects `ops`, binary-mode requires `array`. ✅ `941e729`
- [x] **Replay property test:** for random op sequences, the tree after replay equals the last step's `snapshot`. ✅ `941e729`
- [x] **Stability test:** IDs of surviving nodes unchanged after unrelated inserts and deletes. ✅ `941e729`
- [x] GET `/tree` returns 405 JSON. Generic 500 handler test. Stateless replay matches step-by-step construction. ✅ `941e729`, `8e20f62`
- [x] **Mirror & structural comparison tests:** 24 unit and API tests covering happy path, identical mode, mismatch reporting, dual snapshots, 40-run brute-force oracle property test, and 5 parametrized bad payloads. ✅ `facdbf8`
- [x] **Path ancestor chain tests:** verify `payload.path` forms an unbroken ancestor chain from root to current compare node, and ends at the parent node on final insert. ✅ `7655621`
- **78 / 78 tests passing** (38 API, 40 unit). Phase A closed at 75/75; B1 added 3 static-route tests. Last run: `0.45s`.

### A3. Frontend robustness
- [x] Build `engine/PlaybackController.js`: step list, cursor, play/pause/resume, next/prev/seek, speed, cancel token, annotation callback, `onStep` and `onDone` hooks. ✅ `541154a`
- [x] Refactor Play and Learn in `bst.js` to use it. `btn-pause` replaced by `btn-play-pause` toggle that updates its label dynamically. ✅ `541154a`
- [x] Busy gate: `isBusy` flag + `setControlsDisabled()` — all action buttons and mode switches disabled during requests. ✅ `541154a`, `7655621`
- [x] Sequence counter on every `fetchTreeSteps`; `createLatest()` guard applied to classify, height-depth, and compare; stale responses resolve to `null` and are ignored. ✅ `541154a`, `7655621`
- [x] Surface API errors in `#tree-error-banner` (role=alert, aria-live=polite). No silent `console.error`-only paths. ✅ `541154a`
- [x] Switch `bst.js` to the op log; local state is `ops[]`, not `values[]`. Op only committed after a 200 response. ✅ `541154a`
- [x] Node click uses stable IDs (`target_id` sent to height/depth; `selectedNodeId` cleared on delete). ✅ `541154a`
- [x] Pass `tree_type` for traversal. `buildRequest()` sends `array` vs `ops` based on `currentTreeType`. ✅ `541154a`
- [x] Dev-only tree-sync assertion: `window.ALGOLAB_DEBUG` (default false) replays local ops via `/tree` after every mutating action and logs diffs if screen differs from server replay. ✅ `7655621`
- [x] Bracket input sanitization: `cleanNumberTokens()` strips `[ ]`, `( )`, `{ }` across all input fields so bracketed lists like `[50, 30, 70]` do not drop the leading element. ✅ `f84e55d`
- [x] Automatic fit-view: smooth animated `fitView(true)` executed automatically before and after insertions, deletions, array builds, and comparison runs. ✅ `913553f`

### A4. Fill abstract gaps (Unit 1)
- [x] Insertion shows the comparison path from root to insertion point (`payload.path`, persistent `.path` class on nodes and edges). ✅ `7655621`
- [x] Tree mirroring / structural comparison: backend `bst_mirror_steps(tree_a, tree_b, mode)` with dual snapshots, suffixed role arrays (`_a`/`_b`), brute-force oracle property test, API validation, and minimal Compare frontend section in `bst.html`/`bst.js` with dual TreeCanvas instances, mode toggles, and verdict banner. ✅ `facdbf8`, `7655621`
- [x] Live height/depth recalculates after every mutation (called in `onInsertClick`, `onDeleteClick`, `onBuildFromArrayClick`). ✅ `541154a`

### A5. Exit criteria
- [x] All tests green. ✅ 78/78 passing (Phase A closed at 75; B1 added 3 static-route tests).
- [x] Manual checklist verified: rapid-click gate, delete-then-reinsert same value, node click after two-child delete, binary-mode traversal, empty-tree guard, duplicate rejection, garbage-input filtering, bracketed input parsing, Learn next/prev/reset, mode switch mid-animation, auto fit-view.
- [x] README says BST is stable (remove "Beta"). ✅
- [x] Merge `phase-a-stabilize` to `main`. ✅ Verified merged: `git branch --merged main` lists both `main` and `phase-a-stabilize`.

---

## Phase B: Shell, Learn/Play engine, quizzes, progress

**Goal:** the pedagogy shell exists once, and BST is its first tenant. After this, adding a unit is mostly writing a backend generator plus lesson/quiz data.

### B1. Shared shell
- [x] `shell/nav.js` (classic script, `window.AlgoLabNav.mount`) renders one `<nav>` from a route table built from `shell/units.js`. Replaces the duplicated inline SVG nav in sorting/pathfinding/bst and is also mounted on definitions. ✅ `71e91b3`, `2c48c40`
- [x] Semantic `<nav aria-label="Primary">`, real `<a href>` links, keyboard focus order, `aria-current="page"`, visible `:focus-visible` ring. ✅ Browser-verified: 5 links, correct current item on all 5 pages, tab order starts Home → units → Definitions.
- [x] Rename current `index.html` to `sorting.html` via `git mv`. Updated all links, `app.py` (`/` hub, explicit `/sorting.html`), `start_app` scripts (root URL only), `definitions.js` back link, and README. ✅ `2c48c40`, `9495d48`
- [x] Move the landing splash (`MatrixBackground`, Go button, digit-sort transition) from sorting to the hub in `shell/landing.js` (classic script); the hub sits in `#main-app.app-hidden` until the transition ends. `sorting.html` now opens straight into the duel. Timeout fallbacks stop a throttled `requestAnimationFrame`/CSS animation from trapping the user on the splash or leaving the hub invisible. ✅ `5b75ef2`, `6c839fc`
- [x] New `index.html` hub: hero blurb, unit cards with status (live / coming soon), empty `<span data-progress-slot="{id}">`, disabled "Test yourself" (`title="Coming with quizzes"`), disabled Guided Path placeholder, Playground grid. ✅ `2c48c40`
- [x] Unit registry (`shell/units.js`): id, title, page, status, blurb, glossaryTerms. Single source of truth for nav + hub. `lessonId`/`quizId` land with B2/B3. ✅
- [x] Backend tests: `GET /` 200 + hub marker, `GET /sorting.html` 200, `GET /nonexistent-file.html` JSON 404. 78/78 pytest green. ✅ `9495d48`
- [x] Hub responsive at 375 px: 1-column grid (332 px cards), nav wraps to 3 rows, no horizontal overflow. ✅ Browser-verified via a 375 px same-origin iframe (`scrollWidth == clientWidth == 360`).
- [x] Hub splash responsive at 375 px: `.landing-content` 347 px wide, Go button reachable, no horizontal overflow. ✅ Browser-verified via iframe (`scrollWidth == clientWidth == 375`).

### B2. Lesson engine
- [x] `docs/LESSON_SPEC.md` and `engine/LessonRunner.js`. ✅ Spec covers the lesson schema, builder contract, anchor resolution, narration order, checkpoint rules, quiz sentinel, and the add-a-lesson checklist. ✅ Runner owns a `PlaybackController`, caches built steps per lesson id, and stale-guards overlapping loads.
- [x] Lesson format (data only):

```js
export const bstInsertLesson = {
  id: "bst-insert-basics",
  title: "Inserting into a BST",
  ops: [50, 30, 70, 20, 40, 60, 80].map(v => ({op:"insert", value:v})),
  narration: { /* stepIndex or step type -> text */ },
  checkpoints: [ /* optional predict-then-reveal prompts */ ],
  quizId: "bstQuiz"
};
```
- [x] Runner handles next/prev/reset, narration pinned beside canvas, checkpoint steps (predict, then reveal), and the `quiz_prompt` sentinel as the final step. ✅ `prev()`/`seek()`/`reset()` never trigger a checkpoint; a checkpoint blocks only forward movement. ✅ Browser-verified: both insertion checkpoints fire, correct/incorrect feedback differ, quiz panel appears with forward disabled and hides again on Prev.
- [x] Replace hardcoded `learnSequence` in `bst.js` with the lesson registry. Learn state is rebuilt from ops, never inverse operations. ✅ `buildLessonSteps` calls `/tree` once per op with the ops replayed so far, so a lesson can span inserts and deletes. ✅ Browser-verified: switching lessons mid-session rebuilds the timeline from scratch (queued through the busy gate instead of being dropped).
- [x] Add at least two BST lessons: insertion basics, deletion (three cases). ✅ `bstInsertLesson` (7 inserts, 2 checkpoints) and `bstDeleteLesson` (6 inserts, then leaf / one-child / two-child deletes, 3 checkpoints). ✅ Browser-verified: deletion lesson renders 9 pills with `−` markers, all three checkpoints fire, and the final tree is 60 (root) with children 30 and 40.
- [x] Lessons are data-only: adding one means appending to `frontend/js/lessons/bstLessons.js`. No runner or page-controller edits. ✅ Both registry entries use the same builder and the same runner.
- [x] Learn panel responsive at 375 px: single-column layout, 322 px panel, tree canvas 360 px, no horizontal overflow. ✅ Browser-verified via iframe (`scrollWidth == clientWidth == 360`). Fixed a pre-existing 2 px border-box overflow on `.tree-canvas-container` that only surfaced once the Learn panel occupied the narrow column.

**B2 notes**

- `frontend/js/bst.js` still owns `buildLessonSteps` because it is unit-specific (it knows `bst_insert` / `bst_delete`). Lesson *content* is data; the *builder* is per-unit plumbing and lives next to the page controller.
- The quiz sentinel currently opens a placeholder panel with a disabled button. B3 replaces it with `QuizEngine` + `bstQuiz.js`, and wires `quizId` through `shell/units.js`.
- `LessonRunner.play()` is unwired and untested; decide in F1 whether Learn gets autoplay. No UI button was added and no debug globals exist.
- Lesson-switching race re-verified in B3 Stage 0.1: 5 rapid switches (including during a closing busy gate) end on the last selection with the correct pill count (9), description, and narration. No code change needed.
- Not browser-verified in B2: touch/pointer interactions on phones, and screen-reader announcement order for checkpoint feedback (the panel is `aria-live="polite"`, but no AT was used).

### B3. Quiz and progress
- [x] Thread `quizId` through `shell/units.js` and the lesson registry (single `"bstQuiz"` string shared by `bstLessons.js` and the quiz registry). `units.js` carries `quizId` + `guidedOrder`; `bst.js` resolves lesson/unit ids through `getQuiz()` and reports misses in the page error banner. Commit `020e504`.
- [x] Hub progress badges derived generically from `progress.js` (`data-progress-slot`): text + icon (never color alone), full-sentence `aria-label`, refreshed on `pageshow` and `storage`. Commit `74368a7`.
- [x] `primitives/QuizEngine.js`: state machine per question (unanswered, answered, revealed, next). `render(container, {questions, onComplete, passThreshold, rng, secondaryAction})` → `{destroy, restart}`. Shuffles options every start and question order on retake; `onComplete` fires once per attempt; results show score, percentage, pass/not-yet text, topic breakdown, missed questions, and a storage-unavailable note. Fixture self-check in `frontend/test.html`: 11/11 checks pass (flow, single `onComplete`, seeded-rng reshuffle, correctness-by-id survives shuffling). Commit `c02fbb5`.
- [x] `quizzes/bstQuiz.js`: static data, deliberately logic-free. 10 questions (3 traversal, 3 deletion, 1 classification, 1 insertion, 2 height vs depth), 4 options each, every answer verified against `backend/trees.py` by a throwaway script (traversal sequences, deletion shapes, classification flags, edge-counted height/depth). Registry: `quizzes/index.js` `getQuiz()` throws on a miss. Commit `aa8261c`; spec in `docs/QUIZ_SPEC.md`.
- [x] `shell/progress.js`: wraps localStorage (`algolab_progress`), try/catch on every read/write, schema versioned. ✅ Classic script (`window.AlgoLabProgress`) shared by hub and `bst.js`; in-memory fallback on unavailable/corrupt/unknown-version storage; `quizPassed` recomputed from `bestScore/total` on read; unrecognized raw data backed up before the first overwrite.
  - Entry: `{quizPassed, score, total, bestScore, lastAttempt}`.
  - Pass threshold constant: 80%. Store raw score so the bar can change.
- [x] Two entry points to the same engine: end of Learn Mode sentinel (enabled "Take the quiz" mounts in the panel; Prev destroys it and steps back) and "Test yourself" on hub cards as `bst.html?quiz=bstQuiz` (unknown ids show the banner error). Commits `020e504` / `74368a7`.
- [x] Guided Path wrapper: linear registry order via `guidedOrder` (Sorting Duel → Pathfinding → BST & Trees → Heaps & AVL → Tries/Hashing/Merkle → Design & Analysis). Live units are links, coming-soon units are non-linked. Soft nudge when the immediately previous unit has an unpassed quiz, with "Take the quiz" / "Continue anyway" / "Dismiss"; never blocks a navigation. Commit `74368a7`.

### B4. Glossary hooks
- [x] `shell/glossaryTooltip.js`: inline `?` markers that open the glossary entry in a popover. Data comes from the existing glossary source, now extracted to `shell/glossaryData.js` (`window.ALGOLAB_GLOSSARY`, 94 terms, stable slugs). Markers use `{{term:Name|label}}`; the popover shows the plain-text definition, an "Open in glossary" link, Escape/outside-click dismissal, and focus return. Commits `0846412` / `2146391`.
- [x] Wire tooltips into BST narration for terms like height, depth, successor, balanced: insertion narration marks binary search tree / depth / height / balanced tree, deletion narration marks depth / successor / traversal, the successor checkpoint marks successor, and the traversal lesson marks traversal. Content validator resolves every marker and every `units.js` `glossaryTerms` entry (`dev/validate_content.mjs`, 8 checks). Commit `2146391`; coverage in `70dd76b`.

### B5. Exit criteria
- [x] Full flow works: hub, BST Learn, quiz, badge on hub, Guided Path nudge. Verified in the browser: a deliberate 3-miss attempt scores 7/10 ("Not passed yet") and stores `quizPassed: false`; a clean retake scores 10/10, stores the pass, and the hub badge/Guided Path tag flip to "Quiz passed"; the nudge renders with "Take the quiz", "Continue anyway" (`href="bst.html"`), and "Dismiss".
- [x] Adding a new insert/delete lesson needs no engine edits. Proof: a temporary third BST lesson (`bst-temp-proof`) was appended to `BST_LESSONS`, appeared as a third picker option, ran its checkpoint, and reached the quiz prompt with no engine/page-controller edits; it was then removed and the tree is clean. The validator picked it up automatically (8 checks while present). The real third lesson (`bst-traversal-orders`) additionally needed a `traverse` branch in the unit's `buildLessonSteps`; `LessonRunner` and the other engines stayed untouched.
- [x] Nav is defined in exactly one place: `frontend/js/shell/nav.js` builds every link from `units.js` plus its two fixed entries; pages only carry empty `data-algo-nav` mounts.
- [x] Remove the deprecated `values` shim from `/tree`. `values` (top level, or inside a `bst_mirror` tree spec) now returns 400 with `field: "values"`; `normalize_ops` and the tree builders accept `ops` only. Tests assert the 400. Commit `de1b1fc`.
- [x] localStorage unavailable (private window): app still works, progress just doesn't persist. Browser-tested with a throwing `localStorage` getter, a `QuotaExceededError` on write, corrupt JSON, and an unknown schema version: no caller throws, entries stay in session memory, corrupt/unknown raw data is backed up, and the quiz results show "Progress won't be saved in this browser mode."

### B3–B5 notes
- Quizzes and progress never touch the backend. `bstQuiz.js` is static data; `progress.js` owns the only `localStorage` access, and `QuizEngine` never imports a unit.
- Pass state is derived from `bestScore / total >= 0.8` (edges-based height/depth, matching `backend/trees.py`). The quiz is 10 questions: 3 traversal, 3 deletion, 1 classification, 1 insertion, 2 height vs depth.
- Lesson/quiz alignment: the third lesson (`bst-traversal-orders`) builds the seven-node perfect tree and walks inorder, preorder, and postorder. The quiz follows the lesson order (height/depth → insertion → deletion → classification → traversal) and every traversal question uses that same tree, so the quiz asks only what Learn Mode showed.
- Deep links: `bst.html?quiz=bstQuiz` mounts the quiz and Back returns to the hub; a quiz opened from Learn returns to the last lesson step; an unknown quiz id shows the page error banner.
- Guided Path uses `units.js` registry order via `guidedOrder`. The soft nudge only fires when the immediately previous unit has a `quizId` and is unpassed. With today's shipped data BST is the last live unit and every earlier live unit has no quiz, so the nudge cannot be reached from the real UI yet; the rule itself was exercised by injecting a `quizId` on `pathfinding` at runtime. This is a data limitation, not dead code.
- Glossary: 94 terms in `shell/glossaryData.js` (the original 76 verbatim + 18 terms `units.js` already advertised). Markers use `{{term:Name|label}}` and render in narration and checkpoint prompt/reveal/feedback; `description` and `choices` stay plain text and the validator enforces both rules.
- Tooltip definitions render as plain text (tags stripped); the glossary page keeps its curated HTML. Cards are keyboard-operable and `definitions.html#term-<slug>` highlights and opens the target. The glossary modal keeps an inline `visibility: visible` while opening so the close button can take focus before the fade finishes.
- `LessonRunner.play()` still has no UI caller; no autoplay button or debug global was added. F1 owns that decision.
- Not verified: real screen-reader announcement order, touch/pointer behaviour on phones, and load-time focus into the glossary modal in a focused window (the harness tab reports `document.hasFocus() === false`; click-open, Escape, and focus return were verified).
- 375px re-check: hub, BST Learn, quiz, and glossary pages have no horizontal overflow; the tooltip popover clamps inside a 375px viewport.
- Post-B5 UI polish: `.glossary-ref` keeps a term and its `?` toggle on one line with a 6px gap, `.lab-container` adds an 8px side gutter to the lab pages, and `.step-annotation-box` uses normal block/inline flow so glossary markers do not turn a narration sentence into flex columns. Browser-verified at 1000px and 375px.

---

## Phase C: Unit 2, Heaps and AVL

### C1. Prerequisites (do before any unit logic)
- [ ] Extract `primitives/ArrayStrip.js` from the sorting `renderer.js`: generic array-of-cells with highlight roles (`comparing`, `swapping`, `sorted`, `heap-boundary`).
- [ ] Add node tweening to `TreeCanvas`: keep SVG elements keyed by node ID, animate position changes (CSS transitions or requestAnimationFrame lerp) instead of full redraw. Needed for rotations.
- [ ] Define the dual-panel contract: a step carries both `snapshot.array` and `snapshot.tree`. Two renderers subscribe to one `PlaybackController`.

### C2. Heap (backend `heaps.py`)
- [ ] Min-heap and max-heap toggle.
- [ ] `heap_insert_steps`: append, then `bubble_up` compare/swap steps, with array and tree snapshots.
- [ ] `heap_extract_steps`: swap root with last, remove, then `bubble_down`/`heapify` steps.
- [ ] `heap_build_steps` (bottom-up heapify) as a Play option.
- [ ] `heapsort_steps`: build-heap, then repeated extract; `heap-boundary` marks the sorted region.
- [ ] Tests: heap invariant holds after every step snapshot; heapsort output sorted; empty and single element.

### C3. Heap frontend
- [ ] `heaps.html` + `pages/heaps.js`: dual panel (array on top, tree below), index labels, parent/child index formulas shown in narration (`2i+1`, `2i+2`, `(i-1)//2`).
- [ ] Learn lessons: insert with bubble-up, extract with bubble-down, heapsort.
- [ ] `heapQuiz.js`.

### C4. AVL (backend `avl.py`)
**Design the rotation trace on paper before coding.**

```text
rotate_LL step:
  type: "rotate_LL"
  rotating: [pivotId, childId]          // z and y
  payload: { unbalanced: z, pivot: y, subtrees: {...} }
  snapshot_before, snapshot_during, snapshot_after
  annotation: "Node 30 balance factor +2 (left-left case): rotate right at 30"
```

- [ ] Node fields: `height`, `balance_factor` serialized into `sublabel` (e.g., `bf:+1`).
- [ ] Order of build:
  1. Standard insert plus height/balance update, emitting `update_balance` steps up the path.
  2. Detect first unbalanced ancestor.
  3. `rotate_LL` and `rotate_RR`.
  4. `rotate_LR` and `rotate_RL`, composed as two single rotations with a combined annotation.
  5. Cascading demo: canned sequences (e.g., ascending inserts 1..n, and a LR/RL-heavy sequence).
  6. **Delete with rebalancing last.** Cut this first if time is short.
- [ ] Rotation preserves node IDs. Only parent/child links change.
- [ ] Tests: BST property and AVL property hold after every insert; |bf| <= 1 everywhere in final tree; each of four rotation cases triggered by a specific minimal input; random insert sequences stay balanced; IDs stable.

### C5. AVL frontend
- [ ] `avl.html` + `pages/avl.js`. Balance factor badge on every node (color-coded at +/-2).
- [ ] Rotation replay: before, during (highlight `rotating`), after, with the tween from C1.
- [ ] "Compare with plain BST" toggle: same inserts into a BST and an AVL side by side (reuse two `TreeCanvas` instances).
- [ ] Lessons: LL/RR, LR/RL, cascading rotations. `avlQuiz.js` (predict which rotation).

### C6. Exit criteria
- [ ] Heap and AVL tests green; invariants checked per step.
- [ ] All four rotations animate correctly with stable identity.
- [ ] Hub cards flip to "live" with Learn, Play, quiz.
- [ ] `TRACE_SPEC.md` updated with new types.

---

## Phase D: Unit 3, Tries, Hashing, Merkle

### D1. Trie (`tries.py`)
- [ ] `trie_insert_steps(words_ops, word)`: per-letter `node_reused` or `node_created` steps; end-of-word marker.
- [ ] `trie_search_steps` and `trie_prefix_steps` (autocomplete: matched path lights up, returns completions list).
- [ ] Frontend `tries.html`: `TreeCanvas` with created (green) vs reused (blue) color-coding, live prefix search while typing (debounced, with sequence counter).
- [ ] Tests: reuse vs create counts, prefix completions, empty string, duplicates, case policy (lowercase-normalize and document it).

### D2. Hashing (`hashing.py`)
- [ ] Hash function endpoint: show the computation steps (e.g., sum of char codes mod size) so the bucket index is explainable. Offer 2 hash functions (a bad one and a decent one) to show clustering.
- [ ] Chaining trace: `hash_compute`, `chain_append`.
- [ ] Open addressing trace: `hash_compute`, `probe` (linear; quadratic as extension), `place`.
- [ ] Load factor tracking and `resize` step (rehash all keys, emit per-key moves) at a threshold (e.g., 0.75 for open addressing).
- [ ] Delete handling: tombstones for open addressing, shown visibly (decide and document).
- [ ] Frontend `hashing.html`: **first production use of `BucketGrid`**. Two panels run the same key sequence side by side. Load-factor meter. Collision highlighting.
- [ ] Tests: lookups succeed after resize; probe sequences terminate; full-table behavior defined; tombstones.

### D3. Merkle (`merkle.py`)
- [ ] Use real SHA-256, truncated for display (state this in the UI).
- [ ] `merkle_build_steps`: leaf hashing, then pair up level by level, then root. Odd-node policy (duplicate last) documented.
- [ ] `merkle_tamper_steps`: edit one leaf, recompute only the path to root, emit `mismatch` steps coloring changed hashes.
- [ ] Frontend `merkle.html`: `TreeCanvas` with hash in `sublabel`; editable leaf blocks; tamper propagation animation.
- [ ] Tests: root changes iff any leaf changes; path-only recompute equals full rebuild; odd leaf counts.

### D4. Learn and quizzes
- [ ] Lessons and quizzes for trie, hashing, merkle. Hashing lesson must show chaining vs open addressing on identical input.

### D5. Exit criteria
- [ ] Three pages live, each with Play, Learn, quiz.
- [ ] `BucketGrid` and `TreeCanvas` handle all new roles (`created`, `reused`, `probing`, `mismatch`) documented in `TRACE_SPEC.md`.

---

## Phase E: Unit 4, Design and Analysis

**Order matters: prototype the riskiest traces first.**

### E0. Trace prototypes (1 session, before any UI)
- [ ] **Knapsack B&B trace.** One step per tree node: `{type:"expand", payload:{level, weight, value, bound, taken|skipped}}`, `prune` steps with a reason (`over_capacity` or `bound<=best`), `update_best` steps. Hand-verify on a 4-item instance.
- [ ] **N-Queens trace.** Steps: `place`, `conflict` (with `threatened` cells payload: rows/cols/diagonals), `safe`, `backtrack` (remove queen). Verify solution counts for n=4 (2) and n=8 (92).
- [ ] Write both into `TRACE_SPEC.md` and review before building UI.

### E1. Growth curves (`design/bench.py`)
- [ ] Run selected sort algorithms at increasing n server-side, repeat each size k times, return median ms per size.
- [ ] Exclude Bogo variants from sweeps; cap max n; cap total runtime per request.
- [ ] `GrowthChart` in production: load Chart.js (CDN or vendored), overlay theoretical O(n), O(n log n), O(n^2) curves normalized to measured data.
- [ ] Note timing noise in the UI (it's a measurement, not a proof).

### E2. Recursion tree
- [ ] Merge sort and quicksort call frames as tree nodes (`call`, `return`); expand/collapse support in `TreeCanvas` (new, small feature: collapsed subtrees render as one node with a count).
- [ ] Show subarray ranges in labels. Quicksort pivot choice visible; show the worst case (sorted input).

### E3. 0/1 Knapsack x3 (`design/knapsack.py`)
- [ ] Greedy by value/weight ratio, with a built-in counterexample instance where it fails.
- [ ] DP bottom-up: `BucketGrid` cell-by-cell fill (`dp_fill`), source-cell highlighting (`dp-source`), traceback of chosen items.
- [ ] DP top-down memoized: call-pattern trace showing cache hits.
- [ ] Branch and Bound: from E0 trace, rendered in `TreeCanvas` with pruned nodes grayed.
- [ ] Same-input side-by-side layout for all three. Results panel (value, items, nodes explored/cells computed).
- [ ] Tests: DP optimal equals brute force on random small instances; B&B optimal equals DP; greedy fails on the canned counterexample.

### E4. Iterative vs recursive memoization
- [ ] Same problem (e.g., Fibonacci and/or knapsack subproblem), two call patterns side by side, with call counts.

### E5. N-Queens (`design/nqueens.py`)
- [ ] `BucketGrid` as board with roles `queen`, `safe`, `threatened`, `backtrack`.
- [ ] Controls: board size 4-8 (cap at 8-10 for trace size), step-through, speed, find first vs count all.
- [ ] Tests: solution counts correct; every `place` step passes a safety check; backtrack restores prior state.

### E6. Standalone B&B state-space tree
- [ ] Reuse the E3 B&B trace and `TreeCanvas`, with live bound shown as node labels. May be the same page with a different framing; if so, state it clearly instead of duplicating.

### E7. Learn and quizzes
- [ ] Lessons: "why greedy fails", "DP fills a table", "pruning saves work", "backtracking". Quizzes for each.

### E8. Exit criteria
- [ ] Trace size limits enforced (max steps per request) so the browser doesn't choke.
- [ ] All correctness tests green, including cross-checks between the three knapsack methods.

---

## Phase F: Migration and polish

### F1. Port sorting and pathfinding into the shell
- [ ] Add Learn scripts (narration per algorithm) via the lesson registry. Engines do not change.
- [ ] Use `PlaybackController` where practical. If the sorting animation loop is too different, wrap it behind the same interface rather than rewriting.
- [ ] `sortingQuiz.js`, `pathfindingQuiz.js`.

### F2. Glossary
- [ ] Contextual `?` tooltips on all unit pages. Glossary entries link back to the unit that visualizes each term.
- [ ] Add new terms from Units 2-4 (rotation, balance factor, load factor, collision, probe, memoization, pruning, bound, backtracking, Merkle root).

### F3. Quality
- [ ] Mobile layout pass (README roadmap lists it): hub, tree pages, dual panels.
- [ ] Accessibility pass: keyboard controls for play/pause/next/prev, focus management in modals, ARIA labels, reduced-motion preference respected, color not the only signal for roles.
- [ ] Remove `frontend/test.html` or move it under `dev/`.
- [ ] Configure Flask `debug` via env var, default off.
- [ ] Request size limits and max array/steps caps on all endpoints.
- [ ] Backend tests for sorting and pathfinding (at least correctness plus validation).

### F4. Docs and release
- [ ] Rewrite README: unit status table, architecture diagram, op-log request examples, trace contract summary, how to add a unit (checklist), how to run tests.
- [ ] Confirm LICENSE is present and referenced.
- [ ] Optional: hosted demo (Render, Fly.io, or PythonAnywhere). Frontend is static, backend is small.
- [ ] Final regression pass using the manual checklist from each phase.

---

## 4. "How to add a new unit" checklist (the payoff of Phases A-B)

1. Add backend generator returning the standard trace; register in `app.py`; add validators.
2. Add `type` strings to `TRACE_SPEC.md` and role mappings to `tracing.py`.
3. Write tests, including a per-step invariant check.
4. Add page HTML and a thin `pages/<unit>.js` controller using `PlaybackController`.
5. Add `lessons/<unit>Lesson.js` and `quizzes/<unit>Quiz.js` (data only).
6. Register in `shell/units.js`; the hub card, nav, and progress badge appear automatically.
7. Add glossary entries and tooltips.

---

## 5. Testing strategy

| Layer | Approach |
| --- | --- |
| Backend generators | pytest; **invariant check on every step snapshot** (BST order, heap property, AVL balance, hash lookups, DP optimality) |
| Cross-checks | Brute-force oracle vs algorithm on random small inputs (knapsack, N-Queens counts, sorting) |
| Replay | Final snapshot equals state rebuilt from the op log |
| API | Validation matrix per endpoint: wrong type, missing field, out-of-range, oversize |
| Frontend | Manual checklist per phase (rapid clicks, stale responses, empty states, mobile width); optional light DOM tests if you add a runner later |
| Regression | Run full pytest before each merge to `main` |

---

## 6. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| State model not fixed before AVL | AVL traces desync from UI | Phase A op log is non-negotiable |
| Rotation animation needs new renderer work | Schedule slip in Phase C | C1 tweening first, prototype with a hardcoded rotation before backend |
| Content writing (lessons, quizzes) is slower than code | Units ship with no pedagogy | Ship Play first, lessons second, quizzes last per unit; time-box narration |
| Trace size explosion (N-Queens 8, B&B, growth runs) | Slow responses, frozen browser | Step caps, size caps, server-side runtime caps |
| Timing noise in growth curves | Misleading charts | Median of k runs, warm-up run, disclaimer |
| Scope creep from the abstract | Never finishing | Follow the cut order below |
| No tests | Silent regressions across units | Tests are part of each phase's exit criteria, not a later phase |
| Untracked work lost | Catastrophic | A0 commit first |

---

## 7. Scope cut order (if time runs short)

Cut from the top first:

1. Sorting and pathfinding quizzes
2. Iterative vs recursive memoization comparison (E4)
3. Merkle tamper-detection polish (keep basic build)
4. Standalone B&B page (keep it inside Knapsack)
5. AVL delete with rebalancing (keep insert-only AVL)
6. N-Queens beyond n=8 or count-all mode
7. Trie autocomplete polish

**Never cut:** Phase A, Phase B, AVL insert with all four rotations, hashing chaining vs open addressing, DP table fill, per-phase tests.

---

## 8. Definition of done (whole project)

- Every unit in the abstract has a live page with Play, Learn, and a quiz, or is explicitly listed as deferred in the README.
- One trace contract, documented, with every step `type` listed.
- Hub, Guided Path with soft gating, and localStorage progress work, including with storage disabled.
- Backend tests green; per-step invariants verified for each data structure.
- No user-reachable 500s; all errors are 400 JSON with a field name.
- Keyboard-operable controls and reduced-motion support.
- README accurate, LICENSE present, `debug` off by default.

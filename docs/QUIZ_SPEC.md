# Quiz Spec

**Status:** Phase B3.
**Scope:** quiz question format, the quiz registry contract, the `QuizEngine` renderer contract, pass threshold, the `progress.js` storage schema and failure behavior, and the "Test yourself" deep link. Quizzes and progress never touch the backend.

---

## 1. Where things live

| File | Role |
| --- | --- |
| `frontend/js/quizzes/bstQuiz.js` | Static quiz data for the BST unit. No logic. |
| `frontend/js/quizzes/index.js` | Registry: `getQuiz(id)`, `listQuizzes()`, `getQuizIds()`. |
| `frontend/js/primitives/QuizEngine.js` | Generic renderer. Knows nothing about any unit. |
| `frontend/js/shell/progress.js` | The only module that reads/writes `localStorage` for progress. |
| `frontend/css/quiz.css` | Quiz styles (shared by the BST page and the dev fixture page). |
| `dev/validate_content.mjs` | Dev-only content validator (not imported by the app). |

---

## 2. Question schema

```js
{
    id: "bst-inorder-balanced",        // unique within the quiz
    prompt: "Insert 50, 30, ... What is the inorder traversal?",
    topic: "Traversal",                // optional; powers the result breakdown
    options: [
        { id: "inorder", text: "20, 30, 40, 50, 60, 70, 80" },
        { id: "preorder", text: "50, 30, 20, 40, 70, 60, 80" },
        { id: "postorder", text: "20, 40, 30, 60, 80, 70, 50" },
        { id: "level", text: "50, 30, 70, 20, 40, 60, 80" }
    ],
    correctOptionId: "inorder",        // correctness is by id, NEVER by position
    explanation: "Inorder visits left subtree, node, right subtree..."
}
```

- 3-4 options per question, unique option ids within the question.
- `prompt`, every option `text`, and `explanation` are plain strings. The engine renders them with `textContent`; they are never parsed as HTML.
- The engine shuffles options on every attempt (Fisher-Yates) and shuffles question order on retake. Position therefore has no meaning.
- `rng` is injectable for tests (`render(..., { rng })`); the default is `Math.random`.

## 3. Quiz object and registry contract

```js
export const bstQuiz = {
    id: "bstQuiz",        // registry key; lessons reference this exact string
    unitId: "bst",        // must match an id in frontend/js/shell/units.js
    title: "BST & Trees: check yourself",
    questions: [ /* ... */ ]
};
```

`getQuiz(quizId)` **throws** a descriptive `Error` when the id is unknown. It never returns `undefined` and never falls back to another quiz, so a typo surfaces instead of silently showing the wrong content.

### Adding a quiz

1. Add `frontend/js/quizzes/<unit>Quiz.js` exporting the object above.
2. Import it in `frontend/js/quizzes/index.js` and add it to the `QUIZZES` map.
3. Add `quizId: "<unit>Quiz"` to the unit entry in `frontend/js/shell/units.js`.
4. Add `quizId: "<unit>Quiz"` to the unit's lesson(s) in the lesson data.
5. Run `node dev/validate_content.mjs`.

No engine, page-controller, or CSS edits are needed. Anything the engine needs comes from the data object.

## 4. QuizEngine contract

```js
import { render } from "../primitives/QuizEngine.js";

const controller = render(container, {
    questions,
    onComplete: ({ score, total, passed, answers }) => { /* ... */ },
    passThreshold: 0.8,        // optional
    rng: Math.random,          // optional
    secondaryAction: { label: "Back to lesson", onClick: () => {} }  // optional
});
controller.restart();  // new attempt, reshuffles options + question order
controller.destroy();  // removes its DOM and listeners
```

- Per question: `unanswered` → `answered` (radio selected, "Check answer" enabled) → `revealed` (correct/incorrect + explanation, options locked) → next. No going back after reveal, no skipping.
- `onComplete` fires **exactly once per completed attempt**. It does not fire when `destroy()` is called mid-quiz.
- Results show `X / Y`, percentage, pass/not-yet text, a per-topic breakdown when topics exist, every missed question with the correct answer and explanation, "Retake quiz", and the caller's secondary action.
- `render()` on the same container replaces the previous instance (no stacked handlers). Calling `destroy()` twice is a no-op.
- If `window.AlgoLabProgress.isAvailable()` reports false, the results screen shows "Progress won't be saved in this browser mode." Nothing is blocked.

## 5. Pass threshold

`PASS_THRESHOLD = 0.8` lives in `frontend/js/shell/progress.js` only. A quiz passes when `bestScore / total >= PASS_THRESHOLD`. Scores are stored as raw correct counts, and pass state is recomputed on read — changing the threshold later applies retroactively.

## 6. Progress schema and failure behavior

Storage key: `algolab_progress`. Value:

```json
{
    "version": 1,
    "units": {
        "bst": {
            "quizPassed": true,
            "score": 9,
            "total": 10,
            "bestScore": 9,
            "lastAttempt": "2026-10-25T12:00:00.000Z"
        }
    }
}
```

- `score` = correct count on the latest attempt; `bestScore` = highest correct count ever; `total` = question count; `lastAttempt` = ISO timestamp.
- `bestScore` never decreases. If a quiz is edited and `total` changes, the stored best is clamped to the new total on read (`Math.min(bestScore, total)`).
- API: `getUnit(unitId)`, `getAll()`, `recordAttempt(unitId, score, total)`, `isPassed(unitId)`, `isAvailable()`.
- Invalid programmer input throws: `unitId` must be a non-empty string, `total` an integer ≥ 1 and `score` an integer in `[0, total]`.

Every storage access is wrapped in `try/catch`. If storage is missing, throws, contains invalid JSON, has an unknown `version`, or has the wrong shape:

- the module falls back to an in-memory object for the session;
- callers never see the storage error;
- unrecognized raw data is copied to `algolab_progress_backup` before the first successful write of a new valid object, so it stays recoverable;
- `isAvailable()` returns `false` so the UI can show a quiet note.

## 7. Deep links ("Test yourself")

`bst.html?quiz=bstQuiz` mounts that quiz directly in the Learn panel without requiring the lesson to be played.

- Unknown ids show the page's error banner; they never produce a blank page or a crash.
- Back behaviour: a deep-linked quiz returns to the hub; a quiz started from the end of a Learn lesson returns to the last lesson step.

## 8. Content validator

```powershell
node dev/validate_content.mjs
```

Checks: unique question ids, 3-4 options with unique ids, `correctOptionId` present, non-empty prompts/explanations, every lesson `quizId` resolving through the registry, and every registered quiz's `unitId` existing in `units.js`. It is dev-only, has no runtime dependency, and cleans up the temp `.mjs` copies it needs to import ES modules from plain Node.

## 9. Answer verification

Every correct answer in `bstQuiz.js` was checked against `backend/trees.py` with a throwaway script (not committed) that rebuilt each tree from its insertion order and compared traversals, deletion shapes, classification flags, and height/depth. This app counts height and depth in **edges**: a leaf has height 0, an empty tree has height -1, and the root sits at depth 0. Questions state that convention where it matters, because some textbooks count nodes instead.

Questions are grouped in the order the three Learn Mode lessons teach them (height/depth and insertion, then deletion, then classification and traversal) and reuse the tree each lesson builds. That keeps the quiz scoped to material the lesson actually showed.

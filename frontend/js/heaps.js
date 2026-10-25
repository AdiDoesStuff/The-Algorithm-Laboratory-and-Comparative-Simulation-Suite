/**
 * heaps.js — Controller for Unit 2a: heaps and heapsort.
 *
 * One PlaybackController drives two renderers from a single dual-panel step:
 * ArrayStrip for the backing array (with heap | sorted divider) and TreeCanvas
 * for the complete binary tree the array encodes. Node and cell identity is
 * the element id, so swaps move elements without losing focus or selection.
 *
 * Backend contract: docs/TRACE_SPEC.md §5 and §6. POST /heap only.
 */

import { ArrayStrip } from './primitives/ArrayStrip.js';
import { TreeCanvas } from './primitives/TreeCanvas.js';
import { PlaybackController } from './engine/PlaybackController.js';
import { LessonRunner } from './engine/LessonRunner.js';
import { HEAP_LESSONS } from './lessons/heapLessons.js';
import { render as renderQuiz } from './primitives/QuizEngine.js';
import { getQuiz } from './quizzes/index.js';
import { renderGlossaryText } from './shell/glossaryTooltip.js';

const MAX_HEAP_SIZE = 31;
const MULTI_VALUE_LIMIT = 31;

let heapType = 'min';            // 'min' | 'max' (Play mode only)
let ops = [];                   // stateless op log for POST /heap
let currentMode = 'play';       // 'play' | 'learn'
let isBusy = false;

let strip = null;
let canvas = null;
let lastStep = null;
let lastSnapshot = null;
let selectedId = null;
let selectedIndex = null;

// Totals for the currently loaded trace (comparisons and swaps are trace-wide,
// heap size is per step).
let traceTotals = { comparisons: 0, swaps: 0 };

// Lesson state
let currentLesson = HEAP_LESSONS[0];
let activeCheckpoint = null;
let pendingLearnReset = false;
let checkpointHideTimer = null;
const lessonTotals = new Map();  // lessonId -> { comparisons, swaps, steps }

// Quiz state
let quizController = null;
let quizSource = null;

// --- Playback (Play mode) ---------------------------------------------------

const playback = new PlaybackController({
    onStep: (step) => renderStep(step),
    onDone: () => {
        updatePlayPauseButton();
        canvas?.fitView(true);
    },
    onAnnotation: (text) => updateAnnotation(text),
    onStateChange: () => {
        updatePlayPauseButton();
        updateStepControls();
    }
});

// --- Lesson runner ----------------------------------------------------------

const lessonRunner = new LessonRunner({
    buildSteps: buildLessonSteps,
    onStep: (step) => {
        if (step?.snapshot) renderStep(step);
        if (!activeCheckpoint) hideCheckpoint();
    },
    onAnnotation: (text) => {
        updateAnnotation(text);
        const el = document.getElementById('lesson-narration');
        if (el) renderGlossaryText(el, text || '');
    },
    onCheckpoint: (checkpoint) => {
        activeCheckpoint = checkpoint;
        if (checkpointHideTimer !== null) {
            window.clearTimeout(checkpointHideTimer);
            checkpointHideTimer = null;
        }
        showCheckpoint(checkpoint);
        updateLearnControls();
    },
    onCheckpointResolved: ({ correct }) => {
        activeCheckpoint = null;
        const feedback = document.getElementById('checkpoint-feedback');
        if (feedback) {
            feedback.textContent = correct === true
                ? 'Correct.'
                : (correct === false ? 'Not quite — read the reveal above.' : '');
        }
        if (checkpointHideTimer !== null) window.clearTimeout(checkpointHideTimer);
        checkpointHideTimer = window.setTimeout(() => {
            checkpointHideTimer = null;
            if (!activeCheckpoint) hideCheckpoint();
        }, 1500);
        updateLearnControls();
    },
    onQuizPrompt: (quizId) => {
        const panel = document.getElementById('quiz-prompt-panel');
        if (panel) panel.classList.remove('hidden');
        const startBtn = document.getElementById('btn-lesson-quiz');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.title = '';
            startBtn.textContent = 'Take the quiz';
        }
        updateLearnControls();
    },
    onStateChange: (state) => {
        if (state.status !== 'quiz' && !quizController) hideQuizPrompt();
        updateLearnControls();
    },
    onError: (error) => {
        showError({ message: error?.message || String(error), field: 'lesson' });
    }
});

// --- Boot -------------------------------------------------------------------

window.addEventListener('DOMContentLoaded', async () => {
    initRenderers();
    bindEventListeners();
    initLessonSelector();
    updateUIForMode('play');
    updateHeapTypeUI();
    clearHeap('Ready. Insert a value, build a heap, or choose Learn Mode to begin.');
    await initQuizDeepLink();
});

function initRenderers() {
    const arrayEl = document.getElementById('heap-array');
    if (arrayEl) {
        strip = new ArrayStrip(arrayEl, {
            onSelect: (id, index) => {
                selectedId = id;
                selectedIndex = index;
                if (lastStep) renderStep(lastStep);
                else updateFormulaPanel();
            }
        });
    }

    const treeEl = document.getElementById('heap-tree');
    if (treeEl) {
        canvas = new TreeCanvas(treeEl, { tweenMs: 220 });
    }
}

function bindEventListeners() {
    document.getElementById('btn-mode-play')?.addEventListener('click', () => setMode('play'));
    document.getElementById('btn-mode-learn')?.addEventListener('click', () => setMode('learn'));

    document.getElementById('btn-heap-min')?.addEventListener('click', () => setHeapType('min'));
    document.getElementById('btn-heap-max')?.addEventListener('click', () => setHeapType('max'));

    document.getElementById('btn-insert')?.addEventListener('click', onInsertClick);
    document.getElementById('btn-extract')?.addEventListener('click', onExtractClick);
    document.getElementById('btn-build')?.addEventListener('click', onBuildClick);
    document.getElementById('btn-heapsort')?.addEventListener('click', onHeapsortClick);
    document.getElementById('btn-clear')?.addEventListener('click', () => clearHeap());

    document.getElementById('btn-play-pause')?.addEventListener('click', togglePlayPause);
    document.getElementById('btn-step-prev')?.addEventListener('click', () => playback.prev());
    document.getElementById('btn-step-next')?.addEventListener('click', () => playback.next());

    document.getElementById('speed-slider')?.addEventListener('input', (event) => {
        const speedVal = parseFloat(event.target.value) || 1;
        playback.setSpeed(600 / speedVal);
    });

    document.getElementById('btn-learn-prev')?.addEventListener('click', onLearnPrev);
    document.getElementById('btn-learn-next')?.addEventListener('click', onLearnNext);
    document.getElementById('btn-learn-reset')?.addEventListener('click', onLearnReset);
    document.getElementById('btn-lesson-quiz')?.addEventListener('click', onTakeLessonQuiz);
    document.getElementById('btn-checkpoint-reveal')?.addEventListener('click', () => lessonRunner.revealCheckpoint());

    for (const [id, handler] of [
        ['input-insert', onInsertClick],
        ['input-build', onBuildClick],
        ['input-heapsort', onHeapsortClick]
    ]) {
        document.getElementById(id)?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') handler();
        });
    }
}

// --- Busy gate --------------------------------------------------------------

async function runAction(fn) {
    if (isBusy) return;
    isBusy = true;
    setControlsDisabled(true);
    try {
        await fn();
    } finally {
        isBusy = false;
        setControlsDisabled(false);
        if (pendingLearnReset) {
            pendingLearnReset = false;
            onLearnReset();
        }
    }
}

function setControlsDisabled(disabled) {
    const ids = [
        'btn-insert', 'input-insert',
        'btn-extract',
        'btn-build', 'input-build',
        'btn-heapsort', 'input-heapsort',
        'btn-clear',
        'btn-heap-min', 'btn-heap-max',
        'btn-mode-play', 'btn-mode-learn',
        'lesson-select'
    ];
    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = disabled;
            el.classList.toggle('disabled-control', disabled);
        }
    });
}

// --- Errors -----------------------------------------------------------------

function showError(errorObj) {
    const banner = document.getElementById('heap-error-banner');
    const text = document.getElementById('heap-error-text');
    if (!banner || !text) return;
    const msg = typeof errorObj === 'string' ? errorObj : (errorObj?.message || 'Request failed');
    const field = errorObj?.field ? `[${errorObj.field}] ` : '';
    text.textContent = `${field}${msg}`;
    banner.classList.remove('hidden');
}

function clearError() {
    document.getElementById('heap-error-banner')?.classList.add('hidden');
}

// --- Input parsing ----------------------------------------------------------

function cleanTokens(str) {
    if (!str) return [];
    return String(str)
        .replace(/[\[\]\(\)\{\}]/g, ' ')
        .split(/[\s,]+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 0);
}

/**
 * Parses strict integers. "5.5", "abc" and "" are rejected instead of being
 * silently truncated, so the backend never sees a value the user did not type.
 */
function parseIntList(raw) {
    const tokens = cleanTokens(raw);
    if (tokens.length === 0) return { values: [], invalid: [] };
    const values = [];
    const invalid = [];
    for (const token of tokens) {
        if (!/^[+-]?\d+$/.test(token)) {
            invalid.push(token);
            continue;
        }
        const value = Number(token);
        if (!Number.isSafeInteger(value)) {
            invalid.push(token);
            continue;
        }
        values.push(value);
    }
    return { values, invalid };
}

// --- Heap type --------------------------------------------------------------

function setHeapType(type) {
    if (type !== 'min' && type !== 'max') return;
    if (heapType === type) return;
    heapType = type;
    updateHeapTypeUI();
    clearHeap(`Switched to a ${type}-heap. The heap was cleared; insert values or build a new one.`);
}

function updateHeapTypeUI() {
    const minBtn = document.getElementById('btn-heap-min');
    const maxBtn = document.getElementById('btn-heap-max');
    if (minBtn) {
        minBtn.classList.toggle('active-tab', heapType === 'min');
        minBtn.setAttribute('aria-pressed', heapType === 'min' ? 'true' : 'false');
    }
    if (maxBtn) {
        maxBtn.classList.toggle('active-tab', heapType === 'max');
        maxBtn.setAttribute('aria-pressed', heapType === 'max' ? 'true' : 'false');
    }
    const note = document.getElementById('heap-type-note');
    if (note) {
        note.textContent = heapType === 'min'
            ? 'Every parent is ≤ its children, so index 0 holds the minimum.'
            : 'Every parent is ≥ its children, so index 0 holds the maximum.';
    }
}

// --- Dual-panel rendering ---------------------------------------------------

function renderStep(step) {
    if (!step || !step.snapshot) return;
    lastStep = step;

    const arraySnap = step.snapshot.array || {};
    const cells = Array.isArray(arraySnap.cells) ? arraySnap.cells : [];
    const heapSize = Number.isFinite(arraySnap.heap_size) ? arraySnap.heap_size : cells.length;
    const snapType = arraySnap.heap_type === 'max' ? 'max' : (arraySnap.heap_type === 'min' ? 'min' : heapType);
    lastSnapshot = { cells, heap_size: heapSize, heap_type: snapType };

    // Keep the user's selected element (by id) across swaps; drop it if gone.
    if (selectedId !== null) {
        const nextIndex = cells.findIndex((cell) => cell.id === selectedId);
        if (nextIndex === -1) {
            selectedId = null;
            selectedIndex = null;
        } else {
            selectedIndex = nextIndex;
        }
    }

    const selectedRoles = Array.isArray(step.selected) ? [...step.selected] : [];
    if (selectedId !== null && !selectedRoles.includes(selectedId)) selectedRoles.push(selectedId);

    if (strip) {
        strip.update({
            cells,
            heapSize,
            roles: {
                comparing: step.comparing || [],
                swapping: step.swapping || [],
                sorted: step.sorted || [],
                selected: selectedRoles,
                new_node: step.new_node || [],
                removed: step.removed || []
            },
            showIndices: true,
            showParentChild: true,
            ariaLabel: `${snapType}-heap array, ${cells.length} cell${cells.length === 1 ? '' : 's'}`
        }, { durationMs: 180 });
    }

    if (canvas && step.snapshot.tree) {
        canvas.render(step.snapshot.tree, {
            comparing: step.comparing || [],
            selected: selectedRoles,
            highlighted: step.highlighted || [],
            new_node: step.new_node || [],
            // TreeCanvas has no "swapping" class; the orange rotate ring is the
            // tree-side counterpart of the array's swap border.
            rotating: step.swapping || []
        });
    }

    updateFormulaPanel();
    const sizeEl = document.getElementById('metric-size');
    if (sizeEl) sizeEl.textContent = String(heapSize);
}

function updateFormulaPanel() {
    const empty = document.getElementById('formula-empty');
    const detail = document.getElementById('formula-detail');
    if (!empty || !detail) return;

    const cells = lastSnapshot?.cells || [];
    if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= cells.length) {
        empty.classList.remove('hidden');
        detail.classList.add('hidden');
        return;
    }

    const size = Number.isFinite(lastSnapshot.heap_size) ? lastSnapshot.heap_size : cells.length;
    const index = selectedIndex;
    const value = cells[index]?.value;
    const parent = index === 0 ? null : Math.floor((index - 1) / 2);
    const left = 2 * index + 1;
    const right = 2 * index + 2;

    const describe = (childIndex) => {
        if (childIndex >= cells.length) return `${childIndex} (past the end of the array)`;
        const cellValue = cells[childIndex].value;
        if (childIndex >= size) return `${childIndex} (value ${cellValue}, outside the heap)`;
        return `${childIndex} (value ${cellValue})`;
    };

    document.getElementById('formula-index').textContent = String(index);
    document.getElementById('formula-value').textContent = String(value);
    document.getElementById('formula-parent').textContent = parent === null
        ? 'none — this is the root'
        : `${parent} (value ${cells[parent].value})`;
    document.getElementById('formula-left').textContent = describe(left);
    document.getElementById('formula-right').textContent = describe(right);

    empty.classList.add('hidden');
    detail.classList.remove('hidden');
}

function updateAnnotation(text) {
    const el = document.getElementById('step-annotation');
    if (el) renderGlossaryText(el, text || '');
}

// --- Trace metrics ----------------------------------------------------------

function setTraceMetrics(totals, totalSteps) {
    traceTotals = {
        comparisons: Number(totals?.comparisons) || 0,
        swaps: Number(totals?.swaps) || 0
    };
    const comparisonsEl = document.getElementById('metric-comparisons');
    const swapsEl = document.getElementById('metric-swaps');
    const stepsEl = document.getElementById('metric-steps');
    if (comparisonsEl) comparisonsEl.textContent = String(traceTotals.comparisons);
    if (swapsEl) swapsEl.textContent = String(traceTotals.swaps);
    if (stepsEl) stepsEl.textContent = String(Number(totalSteps) || 0);
}

function clearMetrics() {
    setTraceMetrics({ comparisons: 0, swaps: 0 }, 0);
    const sizeEl = document.getElementById('metric-size');
    if (sizeEl) sizeEl.textContent = '0';
}

function countStepTypes(steps) {
    let comparisons = 0;
    let swaps = 0;
    for (const step of steps) {
        if (step.type === 'compare') comparisons += 1;
        else if (step.type === 'swap') swaps += 1;
    }
    return { comparisons, swaps };
}

// --- Play-mode actions ------------------------------------------------------

async function onInsertClick() {
    await runAction(async () => {
        const input = document.getElementById('input-insert');
        if (!input || !input.value.trim()) return;

        const { values, invalid } = parseIntList(input.value);
        if (invalid.length) {
            showError({ message: `Not an integer: ${invalid.join(', ')}`, field: 'value' });
            return;
        }
        if (values.length === 0) {
            showError({ message: 'Enter at least one integer', field: 'value' });
            return;
        }
        if (ops.length + values.length > MAX_HEAP_SIZE) {
            showError({
                message: `A heap holds at most ${MAX_HEAP_SIZE} elements; this would reach ${ops.length + values.length}.`,
                field: 'ops'
            });
            return;
        }

        const allSteps = [];
        let comparisons = 0;
        let swaps = 0;
        let added = 0;

        for (const value of values) {
            const res = await window.fetchHeapSteps({
                algorithm: 'heap_op',
                heap_type: heapType,
                ops: ops.map((op) => ({ ...op })),
                action: { op: 'insert', value }
            });
            if (!res.ok) {
                showError(res.error);
                break;
            }
            clearError();
            // Commit only after a 200 response.
            ops.push({ op: 'insert', value });
            added += 1;
            if (Array.isArray(res.data?.steps)) allSteps.push(...res.data.steps);
            comparisons += Number(res.data?.metrics?.comparisons) || 0;
            swaps += Number(res.data?.metrics?.swaps) || 0;
        }

        input.value = added > 0 && added === values.length ? '' : input.value;
        if (allSteps.length > 0) {
            setTraceMetrics({ comparisons, swaps }, allSteps.length);
            playback.load(allSteps);
            canvas?.fitView(true);
            playback.play();
        }
    });
}

async function onExtractClick() {
    await runAction(async () => {
        if (ops.length === 0) {
            showError({ message: 'Cannot extract from an empty heap.', field: 'action' });
            return;
        }

        const res = await window.fetchHeapSteps({
            algorithm: 'heap_op',
            heap_type: heapType,
            ops: ops.map((op) => ({ ...op })),
            action: { op: 'extract' }
        });
        if (!res.ok) {
            showError(res.error);
            return;
        }

        clearError();
        // Extracts must join the op log, otherwise the next replay would still
        // contain the extracted root and every later step would diverge.
        ops.push({ op: 'extract' });

        const steps = Array.isArray(res.data?.steps) ? res.data.steps : [];
        setTraceMetrics(res.data?.metrics, steps.length);
        playback.load(steps);
        canvas?.fitView(true);
        playback.play();
    });
}

async function onBuildClick() {
    await runAction(async () => {
        const input = document.getElementById('input-build');
        if (!input || !input.value.trim()) return;

        const { values, invalid } = parseIntList(input.value);
        if (invalid.length) {
            showError({ message: `Not an integer: ${invalid.join(', ')}`, field: 'values' });
            return;
        }
        if (values.length === 0) {
            showError({ message: 'Enter at least one integer to build a heap.', field: 'values' });
            return;
        }
        if (values.length > MAX_HEAP_SIZE) {
            showError({ message: `A heap holds at most ${MAX_HEAP_SIZE} elements.`, field: 'values' });
            return;
        }

        // build is only valid with an empty op log, so Build always replaces the
        // current heap rather than appending to it.
        const res = await window.fetchHeapSteps({
            algorithm: 'heap_op',
            heap_type: heapType,
            ops: [],
            action: { op: 'build', values }
        });
        if (!res.ok) {
            showError(res.error);
            return;
        }

        clearError();
        ops = [{ op: 'build', values: [...values] }];
        const steps = Array.isArray(res.data?.steps) ? res.data.steps : [];
        setTraceMetrics(res.data?.metrics, steps.length);
        playback.load(steps);
        canvas?.fitView(true);
        playback.play();
    });
}

async function onHeapsortClick() {
    await runAction(async () => {
        const input = document.getElementById('input-heapsort');
        let values = [];

        if (input && input.value.trim()) {
            const parsed = parseIntList(input.value);
            if (parsed.invalid.length) {
                showError({ message: `Not an integer: ${parsed.invalid.join(', ')}`, field: 'array' });
                return;
            }
            values = parsed.values;
        } else if (lastSnapshot && Array.isArray(lastSnapshot.cells)) {
            // "Sort the current array" means the whole visible array, including
            // any sorted tail left by a previous heapsort.
            values = lastSnapshot.cells.map((cell) => cell.value);
        }

        if (values.length === 0) {
            showError({ message: 'Enter an array, or insert values first.', field: 'array' });
            return;
        }
        if (values.length > MAX_HEAP_SIZE) {
            showError({ message: `Heapsort supports at most ${MAX_HEAP_SIZE} values.`, field: 'array' });
            return;
        }

        const res = await window.fetchHeapSteps({
            algorithm: 'heapsort',
            heap_type: heapType,
            array: values
        });
        if (!res.ok) {
            showError(res.error);
            return;
        }

        clearError();
        // The trace is self-contained: after it ends the array is sorted and
        // there is no op log that can reproduce heap_size 0, so start clean.
        ops = [];
        if (input) input.value = '';

        const steps = Array.isArray(res.data?.steps) ? res.data.steps : [];
        setTraceMetrics(res.data?.metrics, steps.length);
        playback.load(steps);
        canvas?.fitView(true);
        playback.play();
    });
}

function clearHeap(message) {
    // load([]) resets the cursor and step list, so Prev/Next cannot replay a
    // trace that no longer matches the (empty) op log.
    playback.load([]);
    ops = [];
    lastStep = null;
    lastSnapshot = null;
    selectedId = null;
    selectedIndex = null;
    clearError();
    clearMetrics();
    updateFormulaPanel();

    if (strip) {
        strip.update({
            cells: [],
            heapSize: 0,
            roles: {},
            showIndices: true,
            showParentChild: true,
            ariaLabel: `${heapType}-heap array, empty`
        }, { durationMs: 0 });
    }
    if (canvas) {
        canvas.render({ nodes: [], root_id: null });
    }

    updateStepControls();
    updateAnnotation(message || 'Cleared. Insert a value or build a heap to begin.');
}

// --- Playback UI ------------------------------------------------------------

function togglePlayPause() {
    if (playback.state.playing) playback.pause();
    else playback.play();
}

function updatePlayPauseButton() {
    const btn = document.getElementById('btn-play-pause');
    if (!btn) return;
    const state = playback.state;
    btn.textContent = state.playing ? 'Pause' : 'Play';
    btn.disabled = state.total === 0;
}

function updateStepControls() {
    const prevBtn = document.getElementById('btn-step-prev');
    const nextBtn = document.getElementById('btn-step-next');
    const counter = document.getElementById('step-counter');
    const state = playback.state;
    const total = state.total;

    if (counter) {
        counter.textContent = total > 0
            ? `Step ${state.cursor + 1} of ${total}`
            : 'No trace yet.';
    }
    if (prevBtn) prevBtn.disabled = total === 0 || state.cursor <= 0;
    if (nextBtn) nextBtn.disabled = total === 0 || state.cursor >= total - 1;

    const playBtn = document.getElementById('btn-play-pause');
    if (playBtn) playBtn.disabled = total === 0;
}

// --- Mode switcher ----------------------------------------------------------

async function setMode(mode) {
    if (currentMode === mode) return;
    currentMode = mode;
    updateUIForMode(mode);

    if (mode === 'learn') {
        await onLearnReset();
    } else {
        lessonRunner.cancel();
        activeCheckpoint = null;
        hideCheckpoint();
        hideQuizPrompt();
        clearHeap('Play mode. Insert a value or build a heap to begin.');
    }
}

function updateUIForMode(mode) {
    const playPanel = document.getElementById('play-controls-panel');
    const learnPanel = document.getElementById('learn-controls-panel');
    const playTab = document.getElementById('btn-mode-play');
    const learnTab = document.getElementById('btn-mode-learn');
    const typeGroup = document.getElementById('heap-type-group');

    const isPlay = mode === 'play';
    playPanel?.classList.toggle('hidden', !isPlay);
    learnPanel?.classList.toggle('hidden', isPlay);
    playTab?.classList.toggle('active-tab', isPlay);
    learnTab?.classList.toggle('active-tab', !isPlay);
    playTab?.setAttribute('aria-selected', isPlay ? 'true' : 'false');
    learnTab?.setAttribute('aria-selected', isPlay ? 'false' : 'true');
    // Lessons name their own heap type, so the Play-mode toggle is hidden here.
    typeGroup?.classList.toggle('hidden', !isPlay);
}

// --- Lesson building --------------------------------------------------------

/**
 * Resolve `anchorType`/`occurrence` checkpoints to an absolute step index.
 * The question fires two steps before the named step, which places it before
 * the swap that produces the result the question asks about.
 */
function resolveCheckpointAnchors(checkpoints, steps) {
    const list = Array.isArray(checkpoints) ? checkpoints : [];
    return list.map((checkpoint) => {
        if (!checkpoint || !checkpoint.anchorType) return checkpoint;
        let seen = 0;
        for (let index = 0; index < steps.length; index += 1) {
            if (steps[index].type !== checkpoint.anchorType) continue;
            seen += 1;
            if (seen === (checkpoint.occurrence || 1)) {
                return { ...checkpoint, atStep: Math.max(0, index - 2) };
            }
        }
        return checkpoint;
    });
}

function appendQuizSentinel(lesson, steps) {
    if (lesson.emitQuizPrompt && lesson.quizId) {
        steps.push({
            type: 'quiz_prompt',
            quizId: lesson.quizId,
            annotation: 'Lesson complete. Test yourself to check what stuck.'
        });
    }
}

async function heapRequestOrThrow(payload) {
    const res = await window.fetchHeapSteps(payload);
    if (!res.ok) {
        throw new Error(res.error?.message || 'Heap trace request failed');
    }
    return res.data;
}

async function buildLessonSteps(lesson) {
    const steps = [];
    const blocks = [];
    const lessonType = lesson.heapType === 'max' ? 'max' : 'min';

    if (lesson.mode === 'heapsort' || Array.isArray(lesson.array)) {
        const data = await heapRequestOrThrow({
            algorithm: 'heapsort',
            heap_type: lessonType,
            array: lesson.array.slice()
        });
        if (Array.isArray(data.steps)) steps.push(...data.steps);
        blocks.push({ action: { op: 'heapsort' }, start: 0, end: steps.length - 1 });
    } else {
        const simOps = [];
        for (const action of (Array.isArray(lesson.ops) ? lesson.ops : [])) {
            const start = steps.length;
            const payloadAction = action.op === 'build'
                ? { op: 'build', values: [...action.values] }
                : (action.op === 'extract' ? { op: 'extract' } : { op: 'insert', value: action.value });

            const data = await heapRequestOrThrow({
                algorithm: 'heap_op',
                heap_type: lessonType,
                ops: simOps.map((op) => ({ ...op })),
                action: payloadAction
            });

            if (Array.isArray(data.steps)) steps.push(...data.steps);

            let subjectValue = action.value;
            if (action.op === 'extract') {
                const rootStep = (data.steps || []).find((step) => step.type === 'extract_root');
                subjectValue = rootStep?.payload?.value;
            }
            blocks.push({
                action: { ...action, value: subjectValue },
                start,
                end: steps.length - 1
            });
            simOps.push(payloadAction);
        }
    }

    const totals = countStepTypes(steps);
    lessonTotals.set(lesson.id, { comparisons: totals.comparisons, swaps: totals.swaps, steps: steps.length });

    appendQuizSentinel(lesson, steps);
    return {
        steps,
        checkpoints: resolveCheckpointAnchors(lesson.checkpoints, steps),
        blocks
    };
}

// --- Learn mode -------------------------------------------------------------

function initLessonSelector() {
    const select = document.getElementById('lesson-select');
    if (!select) return;

    select.textContent = '';
    for (const lesson of HEAP_LESSONS) {
        const option = document.createElement('option');
        option.value = lesson.id;
        option.textContent = lesson.title;
        select.appendChild(option);
    }
    select.value = currentLesson.id;

    select.addEventListener('change', () => {
        const next = HEAP_LESSONS.find((lesson) => lesson.id === select.value);
        if (!next || next.id === currentLesson.id) return;
        currentLesson = next;
        onLearnReset();
    });

    updateLessonDescription();
}

function updateLessonDescription() {
    const el = document.getElementById('lesson-description');
    if (el) el.textContent = currentLesson?.description || '';
}

async function onLearnReset() {
    if (isBusy) {
        pendingLearnReset = true;
        return;
    }

    await runAction(async () => {
        playback.cancel();
        lessonRunner.pause();
        ops = [];
        activeCheckpoint = null;
        lastStep = null;
        lastSnapshot = null;
        selectedId = null;
        selectedIndex = null;
        clearError();
        hideCheckpoint();
        hideQuizPrompt();
        renderLearnPills(currentLesson);
        updateLessonDescription();

        if (strip) {
            strip.update({ cells: [], heapSize: 0, roles: {}, showIndices: true, showParentChild: true, ariaLabel: 'heap array, empty' }, { durationMs: 0 });
        }
        if (canvas) canvas.render({ nodes: [], root_id: null });
        updateFormulaPanel();

        const state = await lessonRunner.loadLesson(currentLesson);
        if (state.status === 'error') return;

        const totals = lessonTotals.get(currentLesson.id);
        if (totals) setTraceMetrics(totals, lessonRunner.state.total);
        updateLearnControls();
        canvas?.fitView(true);
    });
}

function onLearnNext() {
    lessonRunner.next();
}

function onLearnPrev() {
    if (quizController) {
        exitQuiz();
        return;
    }
    lessonRunner.prev();
}

function updateLearnControls() {
    const prevBtn = document.getElementById('btn-learn-prev');
    const nextBtn = document.getElementById('btn-learn-next');
    if (!prevBtn && !nextBtn) return;

    const state = lessonRunner.state;
    const quizActive = quizController !== null;
    const blockedBoth = state.status === 'loading' || state.status === 'error';
    const blockedForward = blockedBoth ||
        state.status === 'quiz' ||
        state.status === 'checkpoint' ||
        quizActive;

    if (prevBtn) {
        prevBtn.disabled = blockedBoth || (!quizActive && state.cursor <= 0);
    }
    if (nextBtn) {
        nextBtn.disabled = blockedForward || state.total === 0 || state.cursor >= state.total - 1;
    }
}

function renderLearnPills(lesson) {
    const container = document.getElementById('learn-pills-row');
    if (!container) return;
    container.textContent = '';

    const labels = [];
    if (Array.isArray(lesson?.array)) {
        labels.push('sort: ' + lesson.array.join(', '));
    } else if (Array.isArray(lesson?.ops)) {
        for (const action of lesson.ops) {
            if (action.op === 'insert') labels.push(String(action.value));
            else if (action.op === 'extract') labels.push('−root');
            else if (action.op === 'build') labels.push('build');
        }
    }

    labels.forEach((label, index) => {
        const pill = document.createElement('span');
        pill.className = 'learn-pill' + (index === 0 ? ' pill-active' : '');
        pill.textContent = label;
        container.appendChild(pill);
    });
}

function showCheckpoint(checkpoint) {
    const panel = document.getElementById('checkpoint-panel');
    const prompt = document.getElementById('checkpoint-prompt');
    const choices = document.getElementById('checkpoint-choices');
    const feedback = document.getElementById('checkpoint-feedback');
    const revealBtn = document.getElementById('btn-checkpoint-reveal');
    if (!panel) return;

    panel.classList.remove('hidden');
    if (prompt) renderGlossaryText(prompt, checkpoint.prompt || '');
    if (feedback) feedback.textContent = '';

    if (!choices) return;
    choices.textContent = '';

    const hasChoices = Array.isArray(checkpoint.choices) && checkpoint.choices.length > 0;
    if (hasChoices) {
        checkpoint.choices.forEach((label, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.style.minHeight = '44px';
            button.addEventListener('click', () => lessonRunner.answerCheckpoint(index));
            choices.appendChild(button);
        });
        revealBtn?.classList.add('hidden');
    } else if (revealBtn) {
        revealBtn.classList.remove('hidden');
    }
}

function hideCheckpoint() {
    document.getElementById('checkpoint-panel')?.classList.add('hidden');
}

// --- Quiz wiring ------------------------------------------------------------

function readProgressStore() {
    const progress = window.AlgoLabProgress;
    return progress && typeof progress.recordAttempt === 'function' ? progress : null;
}

function onTakeLessonQuiz() {
    const quizId = lessonRunner.currentLesson?.quizId || currentLesson?.quizId;
    if (!quizId) return;
    openQuiz(quizId, 'lesson');
}

function openQuiz(quizId, source) {
    let quiz;
    try {
        quiz = getQuiz(quizId);
    } catch (error) {
        showError({ message: error.message, field: 'quiz' });
        hideQuizPrompt();
        return false;
    }

    destroyQuiz();

    const panel = document.getElementById('quiz-prompt-panel');
    const mount = document.getElementById('quiz-mount');
    if (!panel || !mount) return false;

    quizSource = source;
    document.getElementById('quiz-prompt-text')?.classList.add('hidden');
    document.getElementById('btn-lesson-quiz')?.classList.add('hidden');
    mount.classList.remove('hidden');
    panel.classList.remove('hidden');
    clearError();

    quizController = renderQuiz(mount, {
        questions: quiz.questions,
        onComplete: (result) => {
            const progress = readProgressStore();
            if (!progress) return;
            try {
                progress.recordAttempt(quiz.unitId, result.score, result.total);
            } catch (error) {
                console.warn('[AlgoLab] Quiz progress was not saved:', error.message);
            }
        },
        secondaryAction: {
            label: source === 'deep-link' ? 'Back to hub' : 'Back to lesson',
            onClick: exitQuiz
        }
    });

    updateLearnControls();
    return true;
}

function destroyQuiz() {
    if (quizController) {
        quizController.destroy();
        quizController = null;
    }
    quizSource = null;
    const mount = document.getElementById('quiz-mount');
    if (mount) mount.textContent = '';
}

function exitQuiz() {
    const source = quizSource;
    hideQuizPrompt();
    if (source === 'deep-link') {
        window.location.href = 'index.html';
        return;
    }
    if (lessonRunner.status === 'quiz') {
        lessonRunner.prev();
    }
    updateLearnControls();
}

function hideQuizPrompt() {
    destroyQuiz();
    document.getElementById('quiz-prompt-panel')?.classList.add('hidden');
    document.getElementById('quiz-prompt-text')?.classList.remove('hidden');
    document.getElementById('btn-lesson-quiz')?.classList.remove('hidden');
}

async function initQuizDeepLink() {
    const quizId = new URLSearchParams(window.location.search).get('quiz');
    if (!quizId) return;

    try {
        getQuiz(quizId);
    } catch (error) {
        if (currentMode !== 'learn') await setMode('learn');
        showError({ message: `Unknown quiz "${quizId}". ${error.message}`, field: 'quiz' });
        return;
    }

    if (currentMode !== 'learn') {
        await setMode('learn');
    } else {
        await onLearnReset();
    }
    openQuiz(quizId, 'deep-link');
    updateLearnControls();
}

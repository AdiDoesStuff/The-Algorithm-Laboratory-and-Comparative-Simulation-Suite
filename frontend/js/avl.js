/**
 * avl.js — Controller for Unit 2b: AVL trees.
 *
 * One PlaybackController drives the main TreeCanvas. Every snapshot carries a
 * live `bf:+N` sublabel computed by the backend from that snapshot's links, so
 * a badge can never be stale. The frontend only decorates it: when |bf| > 1 the
 * sublabel gains a trailing " !" and the node gets the `unbalanced` role, which
 * the stylesheet draws as a dashed rose ring. State is therefore conveyed by
 * text and shape, not colour alone.
 *
 * Rotation replay is one snapshot per backend step: `unbalanced` shows the
 * pre-rotation shape, each `rotate_*` step shows its own post-rotation snapshot
 * (LR/RL emit phase 1 and 2), and `rotation_done` shows the settled subtree.
 * TreeCanvas tweens positions between those snapshots while node ids stay put.
 *
 * The optional Compare panel asks /tree for `bst_classify` over the same op log
 * and draws the plain BST next to the AVL tree with both heights, which is what
 * makes the rebalancing benefit visible.
 *
 * Backend contract: docs/TRACE_SPEC.md §7. POST /avl and POST /tree.
 */

import { TreeCanvas } from './primitives/TreeCanvas.js';
import { PlaybackController } from './engine/PlaybackController.js';
import { LessonRunner } from './engine/LessonRunner.js';
import { AVL_LESSONS } from './lessons/avlLessons.js';
import { render as renderQuiz } from './primitives/QuizEngine.js';
import { getQuiz } from './quizzes/index.js';
import { renderGlossaryText } from './shell/glossaryTooltip.js';

const MAX_AVL_OPS = 64;
const BF_PATTERN = /^bf:([+-]?\d+)$/;

let ops = [];                    // stateless op log for POST /avl
let currentMode = 'play';        // 'play' | 'learn'
let isBusy = false;

let canvas = null;
let compareCanvas = null;
let compareEnabled = false;
let lastStep = null;
let lastSnapshot = null;

let traceTotals = { comparisons: 0, rotations: 0, height: -1 };

// Comparison state. `compareKey` deduplicates re-renders when a lesson moves
// between steps of the same action.
let compareHeight = -1;
let compareNodeCount = 0;
let compareError = null;
let compareKey = null;
const latestCompare = window.createLatest ? window.createLatest() : (fn => fn());

// Lesson state
let currentLesson = AVL_LESSONS[0];
let activeCheckpoint = null;
let pendingLearnReset = false;
let checkpointHideTimer = null;
let lessonBlocks = [];           // [{ action, start, end, compare }]
const lessonTotals = new Map();  // lessonId -> { comparisons, rotations, steps, height }

// Quiz state
let quizController = null;
let quizSource = null;

// --- Playback (Play mode) ---------------------------------------------------

const playback = new PlaybackController({
    onStep: (step, index) => renderStep(step, index),
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
    onStep: (step, index) => {
        if (step?.snapshot) renderStep(step, index);
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
    onQuizPrompt: () => {
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
    updateCompareUI();
    clearTree('Ready. Insert a value or choose Learn Mode to begin.');
    await initQuizDeepLink();
});

function initRenderers() {
    const treeEl = document.getElementById('avl-tree');
    if (treeEl) {
        canvas = new TreeCanvas(treeEl, { tweenMs: 220 });
    }
}

function bindEventListeners() {
    document.getElementById('btn-mode-play')?.addEventListener('click', () => setMode('play'));
    document.getElementById('btn-mode-learn')?.addEventListener('click', () => setMode('learn'));

    document.getElementById('btn-insert')?.addEventListener('click', onInsertClick);
    document.getElementById('btn-delete')?.addEventListener('click', onDeleteClick);
    document.getElementById('btn-clear')?.addEventListener('click', () => clearTree());
    document.getElementById('btn-compare')?.addEventListener('click', toggleCompare);

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
        ['input-delete', onDeleteClick]
    ]) {
        document.getElementById(id)?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') handler();
        });
    }

    window.addEventListener('resize', () => {
        canvas?.fitView();
        if (compareEnabled) compareCanvas?.fitView();
    });
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
        'btn-delete', 'input-delete',
        'btn-clear', 'btn-compare',
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
    const banner = document.getElementById('avl-error-banner');
    const text = document.getElementById('avl-error-text');
    if (!banner || !text) return;
    const msg = typeof errorObj === 'string' ? errorObj : (errorObj?.message || 'Request failed');
    const field = errorObj?.field ? `[${errorObj.field}] ` : '';
    text.textContent = `${field}${msg}`;
    banner.classList.remove('hidden');
}

function clearError() {
    document.getElementById('avl-error-banner')?.classList.add('hidden');
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

// --- Snapshot helpers -------------------------------------------------------

function parseBalanceFactor(sublabel) {
    const match = BF_PATTERN.exec(String(sublabel || ''));
    return match ? Number(match[1]) : null;
}

/**
 * Copy the snapshot with " !" appended to any out-of-range balance factor.
 * The backend's `bf:+N` stays the source of truth; this only makes the illegal
 * state readable without relying on colour.
 */
function decorateSnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.nodes)) {
        return { nodes: [], root_id: null };
    }
    const nodes = snapshot.nodes.map((node) => {
        const bf = parseBalanceFactor(node.sublabel);
        if (bf === null || Math.abs(bf) <= 1) return node;
        return { ...node, sublabel: `bf:${bf > 0 ? '+' : ''}${bf} !` };
    });
    return { ...snapshot, nodes };
}

/**
 * Every node whose snapshot badge is out of range, plus anything the backend
 * already marked. Deriving from the snapshot means the ring follows the drawn
 * state on every step, not just on the `unbalanced` step.
 */
function deriveUnbalanced(step) {
    const ids = new Set(Array.isArray(step.unbalanced) ? step.unbalanced : []);
    for (const node of step.snapshot?.nodes || []) {
        const bf = parseBalanceFactor(node.sublabel);
        if (bf !== null && Math.abs(bf) > 1) ids.add(node.id);
    }
    return [...ids];
}

/** Height in edges computed from a snapshot's links (display only). */
function snapshotHeight(snapshot) {
    const nodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
    if (nodes.length === 0 || snapshot?.root_id === null || snapshot?.root_id === undefined) return -1;

    const children = new Map();
    for (const node of nodes) children.set(node.id, []);
    for (const node of nodes) {
        if (node.parent_id !== null && node.parent_id !== undefined && children.has(node.parent_id)) {
            children.get(node.parent_id).push(node.id);
        }
    }

    const visit = (id) => {
        const kids = children.get(id) || [];
        if (kids.length === 0) return 0;
        let deepest = 0;
        for (const kid of kids) deepest = Math.max(deepest, visit(kid));
        return 1 + deepest;
    };
    return visit(snapshot.root_id);
}

// --- Rendering --------------------------------------------------------------

function renderStep(step, index) {
    if (!step || !step.snapshot) return;
    lastStep = step;

    const snapshot = decorateSnapshot(step.snapshot);
    lastSnapshot = snapshot;

    if (canvas) {
        canvas.render(snapshot, {
            comparing: step.comparing || [],
            highlighted: step.highlighted || [],
            new_node: step.new_node || [],
            rotating: step.rotating || [],
            unbalanced: deriveUnbalanced(step),
            // TreeCanvas reads payload.path to highlight the search route.
            payload: step.payload || {}
        });
    }

    const heightEl = document.getElementById('metric-height');
    if (heightEl) heightEl.textContent = String(snapshotHeight(snapshot));

    if (compareEnabled) renderCompareForIndex(index);
}

function updateAnnotation(text) {
    const el = document.getElementById('step-annotation');
    if (el) renderGlossaryText(el, text || '');
}

// --- Trace metrics ----------------------------------------------------------

function setTraceMetrics(metrics, totalSteps) {
    traceTotals = {
        comparisons: Number(metrics?.comparisons) || 0,
        rotations: Number(metrics?.rotations) || 0,
        height: Number.isFinite(Number(metrics?.height)) ? Number(metrics.height) : -1
    };

    const comparisonsEl = document.getElementById('metric-comparisons');
    const rotationsEl = document.getElementById('metric-rotations');
    const stepsEl = document.getElementById('metric-steps');
    const heightEl = document.getElementById('metric-height');
    if (comparisonsEl) comparisonsEl.textContent = String(traceTotals.comparisons);
    if (rotationsEl) rotationsEl.textContent = String(traceTotals.rotations);
    if (stepsEl) stepsEl.textContent = String(Number(totalSteps) || 0);
    if (heightEl) heightEl.textContent = String(traceTotals.height);
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
        if (ops.length + values.length > MAX_AVL_OPS) {
            showError({
                message: `An AVL op log holds at most ${MAX_AVL_OPS} operations; this would reach ${ops.length + values.length}.`,
                field: 'ops'
            });
            return;
        }

        const allSteps = [];
        let comparisons = 0;
        let rotations = 0;
        let height = traceTotals.height;
        let added = 0;

        for (const value of values) {
            const res = await window.fetchAvlSteps({
                algorithm: 'avl_insert',
                ops: ops.map((op) => ({ ...op })),
                value
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
            rotations += Number(res.data?.metrics?.rotations) || 0;
            if (Number.isFinite(Number(res.data?.metrics?.height))) {
                height = Number(res.data.metrics.height);
            }
        }

        input.value = added > 0 && added === values.length ? '' : input.value;
        if (added === 0) return;

        setTraceMetrics({ comparisons, rotations, height }, allSteps.length);
        playback.load(allSteps);
        canvas?.fitView(true);
        playback.play();
        await refreshCompare();
    });
}

async function onDeleteClick() {
    await runAction(async () => {
        const input = document.getElementById('input-delete');
        if (!input || !input.value.trim()) return;

        const { values, invalid } = parseIntList(input.value);
        if (invalid.length) {
            showError({ message: `Not an integer: ${invalid.join(', ')}`, field: 'value' });
            return;
        }
        if (values.length === 0) {
            showError({ message: 'Enter at least one integer to delete.', field: 'value' });
            return;
        }
        if (ops.length + values.length > MAX_AVL_OPS) {
            showError({
                message: `An AVL op log holds at most ${MAX_AVL_OPS} operations; this would reach ${ops.length + values.length}.`,
                field: 'ops'
            });
            return;
        }

        const allSteps = [];
        let comparisons = 0;
        let rotations = 0;
        let height = traceTotals.height;
        let removed = 0;

        for (const value of values) {
            const res = await window.fetchAvlSteps({
                algorithm: 'avl_delete',
                ops: ops.map((op) => ({ ...op })),
                value
            });
            if (!res.ok) {
                showError(res.error);
                break;
            }
            clearError();
            ops.push({ op: 'delete', value });
            removed += 1;
            if (Array.isArray(res.data?.steps)) allSteps.push(...res.data.steps);
            comparisons += Number(res.data?.metrics?.comparisons) || 0;
            rotations += Number(res.data?.metrics?.rotations) || 0;
            if (Number.isFinite(Number(res.data?.metrics?.height))) {
                height = Number(res.data.metrics.height);
            }
        }

        input.value = removed > 0 && removed === values.length ? '' : input.value;
        if (removed === 0) return;

        setTraceMetrics({ comparisons, rotations, height }, allSteps.length);
        playback.load(allSteps);
        canvas?.fitView(true);
        playback.play();
        await refreshCompare();
    });
}

function clearTree(message) {
    // load([]) resets the cursor and step list, so Prev/Next cannot replay a
    // trace that no longer matches the (empty) op log.
    playback.load([]);
    ops = [];
    lastStep = null;
    lastSnapshot = null;
    lessonBlocks = [];
    clearError();
    setTraceMetrics({ comparisons: 0, rotations: 0, height: -1 }, 0);

    if (canvas) canvas.render({ nodes: [], root_id: null });
    renderEmptyCompare();

    updateStepControls();
    updateAnnotation(message || 'Cleared. Insert a value to begin.');
}

// --- Compare with a plain BST -----------------------------------------------

function ensureCompareCanvas() {
    if (compareCanvas) return compareCanvas;
    const el = document.getElementById('compare-tree');
    if (!el) return null;
    compareCanvas = new TreeCanvas(el, { tweenMs: 0 });
    return compareCanvas;
}

function toggleCompare() {
    compareEnabled = !compareEnabled;
    updateCompareUI();

    if (!compareEnabled) {
        // Invalidate any in-flight comparison so it cannot paint a hidden panel.
        latestCompare(() => Promise.resolve(null));
        compareKey = null;
        return;
    }

    if (currentMode === 'learn') {
        renderCompareForIndex(lessonRunner.state.cursor, { force: true });
        return;
    }
    refreshCompare({ force: true });
}

function updateCompareUI() {
    const btn = document.getElementById('btn-compare');
    const status = document.getElementById('compare-status');
    const panels = document.getElementById('tree-panels');
    const card = document.getElementById('compare-card');

    if (btn) btn.setAttribute('aria-pressed', compareEnabled ? 'true' : 'false');
    if (panels) panels.classList.toggle('compare-on', compareEnabled);
    if (card) card.classList.toggle('hidden', !compareEnabled);
    if (status) {
        status.textContent = compareEnabled
            ? 'On — the same operations are drawn as a plain BST beside the AVL tree.'
            : 'Off — the plain BST is hidden.';
    }
    if (compareEnabled) {
        ensureCompareCanvas();
    }
}

async function fetchCompareForOps(opList, { avlHeight, key }) {
    const payload = {
        ops: opList.map((op) => ({ op: op.op, value: op.value }))
    };
    const res = await latestCompare(() => window.fetchTreeSteps('bst_classify', payload));

    // null means a newer comparison superseded this one.
    if (res === null) return null;

    if (!res.ok) {
        return {
            key,
            snapshot: null,
            height: -1,
            nodeCount: 0,
            error: res.error?.message || 'request failed',
            avlHeight,
            opsCount: opList.length
        };
    }

    const snapshot = res.data?.tree || null;
    return {
        key,
        snapshot,
        height: Number.isFinite(Number(res.data?.height)) ? Number(res.data.height) : snapshotHeight(snapshot),
        nodeCount: Number(res.data?.node_count) || (Array.isArray(snapshot?.nodes) ? snapshot.nodes.length : 0),
        error: null,
        avlHeight,
        opsCount: opList.length
    };
}

async function refreshCompare({ force = false } = {}) {
    if (!compareEnabled || currentMode !== 'play') return;
    const key = `play:${ops.map((op) => `${op.op}:${op.value}`).join(',')}`;
    if (!force && key === compareKey) return;

    const result = await fetchCompareForOps(ops, { avlHeight: traceTotals.height, key });
    if (!result) return;
    applyCompareResult(result, force);
}

function renderCompareForIndex(index, { force = false } = {}) {
    if (!compareEnabled || currentMode !== 'learn') return;
    if (!Array.isArray(lessonBlocks) || lessonBlocks.length === 0) {
        renderEmptyCompare();
        return;
    }

    let block = lessonBlocks.find((entry) => index >= entry.start && index <= entry.end);
    if (!block) block = lessonBlocks[0];

    if (!block?.compare) {
        renderEmptyCompare();
        return;
    }
    applyCompareResult(block.compare, force);
}

function applyCompareResult(result, force = false) {
    if (!compareEnabled) return;
    if (!force && result.key === compareKey) return;
    compareKey = result.key;
    compareHeight = Number(result.height);
    compareNodeCount = Number(result.nodeCount) || 0;
    compareError = result.error || (result.snapshot ? null : 'comparison unavailable');

    const cv = ensureCompareCanvas();
    if (cv && result.snapshot) {
        cv.render(result.snapshot, {});
        cv.fitView();
    }
    updateCompareCaption(result);
}

function renderEmptyCompare() {
    compareKey = null;
    compareHeight = -1;
    compareNodeCount = 0;
    compareError = null;
    if (compareEnabled) {
        const cv = ensureCompareCanvas();
        if (cv) cv.render({ nodes: [], root_id: null });
    }
    updateCompareCaption(null);
}

function updateCompareCaption(result) {
    const el = document.getElementById('compare-caption');
    if (!el || !compareEnabled) return;

    if (compareError) {
        el.textContent = `Plain BST unavailable: ${compareError}`;
        return;
    }

    const avlHeight = result
        ? Number(result.avlHeight)
        : (lastSnapshot ? snapshotHeight(lastSnapshot) : -1);
    const bstHeight = result ? compareHeight : -1;
    const opCount = result ? Number(result.opsCount) || 0 : ops.length;

    if (compareNodeCount === 0) {
        el.textContent = 'Both trees are empty.';
        return;
    }

    let text = `Same ${opCount} operation${opCount === 1 ? '' : 's'}: AVL height ${avlHeight}, plain BST height ${bstHeight} (${compareNodeCount} node${compareNodeCount === 1 ? '' : 's'}).`;
    if (bstHeight > avlHeight) {
        text += ' The plain BST is taller — that extra depth is what rebalancing removes.';
    } else if (bstHeight === avlHeight) {
        text += ' Both shapes happen to have the same height here.';
    } else {
        text += ' The plain BST is not taller for this input.';
    }
    el.textContent = text;
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
        lessonBlocks = [];
        clearTree('Play mode. Insert a value to begin.');
    }
}

function updateUIForMode(mode) {
    const playPanel = document.getElementById('play-controls-panel');
    const learnPanel = document.getElementById('learn-controls-panel');
    const playTab = document.getElementById('btn-mode-play');
    const learnTab = document.getElementById('btn-mode-learn');

    const isPlay = mode === 'play';
    playPanel?.classList.toggle('hidden', !isPlay);
    learnPanel?.classList.toggle('hidden', isPlay);
    playTab?.classList.toggle('active-tab', isPlay);
    learnTab?.classList.toggle('active-tab', !isPlay);
    playTab?.setAttribute('aria-selected', isPlay ? 'true' : 'false');
    learnTab?.setAttribute('aria-selected', isPlay ? 'false' : 'true');
}

// --- Lesson building --------------------------------------------------------

/**
 * Resolve `anchorType`/`occurrence` checkpoints to an absolute step index.
 * The question fires two steps before the named step: with the LL trace that
 * puts the prediction on the `insert` step, before the retrace names the case.
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

async function avlRequestOrThrow(payload) {
    const res = await window.fetchAvlSteps(payload);
    if (!res.ok) {
        throw new Error(res.error?.message || 'AVL trace request failed');
    }
    return res.data;
}

async function buildLessonSteps(lesson) {
    const steps = [];
    const blocks = [];
    const simOps = [];
    let comparisons = 0;
    let rotations = 0;
    let height = -1;

    for (const action of (Array.isArray(lesson.ops) ? lesson.ops : [])) {
        const start = steps.length;
        const op = action.op === 'delete' ? 'delete' : 'insert';
        const data = await avlRequestOrThrow({
            algorithm: op === 'delete' ? 'avl_delete' : 'avl_insert',
            ops: simOps.map((entry) => ({ ...entry })),
            value: action.value
        });

        if (Array.isArray(data.steps)) steps.push(...data.steps);
        comparisons += Number(data.metrics?.comparisons) || 0;
        rotations += Number(data.metrics?.rotations) || 0;
        height = Number.isFinite(Number(data.metrics?.height)) ? Number(data.metrics.height) : height;

        simOps.push({ op, value: action.value });

        // The plain BST is built from the same op log after this action. A
        // failure here must not break the lesson: the caption reports it.
        const compare = await fetchCompareForOps(simOps, {
            avlHeight: height,
            key: `lesson:${start}`
        });

        blocks.push({
            action: { ...action, op },
            start,
            end: steps.length - 1,
            compare: compare || {
                key: `lesson:${start}`,
                snapshot: null,
                height: -1,
                nodeCount: 0,
                error: 'request superseded',
                avlHeight: height,
                opsCount: simOps.length
            }
        });
    }

    lessonBlocks = blocks;
    lessonTotals.set(lesson.id, { comparisons, rotations, steps: steps.length, height });

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
    for (const lesson of AVL_LESSONS) {
        const option = document.createElement('option');
        option.value = lesson.id;
        option.textContent = lesson.title;
        select.appendChild(option);
    }
    select.value = currentLesson.id;

    select.addEventListener('change', () => {
        const next = AVL_LESSONS.find((lesson) => lesson.id === select.value);
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
        lessonBlocks = [];
        clearError();
        hideCheckpoint();
        hideQuizPrompt();
        renderLearnPills(currentLesson);
        updateLessonDescription();

        if (canvas) canvas.render({ nodes: [], root_id: null });
        renderEmptyCompare();

        // forceRebuild keeps `lessonBlocks` (and therefore the per-action plain
        // BST snapshots) in step with the lesson actually being shown.
        const state = await lessonRunner.loadLesson(currentLesson, { forceRebuild: true });
        if (state.status === 'error') return;

        const totals = lessonTotals.get(currentLesson.id);
        if (totals) setTraceMetrics(totals, lessonRunner.state.total);
        updateLearnControls();
        canvas?.fitView(true);
        if (compareEnabled) renderCompareForIndex(lessonRunner.state.cursor, { force: true });
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
    if (Array.isArray(lesson?.ops)) {
        for (const action of lesson.ops) {
            if (action.op === 'insert') labels.push(String(action.value));
            else if (action.op === 'delete') labels.push(`−${action.value}`);
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

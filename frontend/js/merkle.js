/**
 * merkle.js — Controller for Unit 3c: Merkle trees.
 *
 * One PlaybackController drives a TreeCanvas in binary layout. The backend
 * lays the full node structure out on step 0 (pending hashes show as an
 * ellipsis), then fills digests bottom-up, so the layout never jumps between
 * steps. Tamper traces keep the same ids; only the leaf-to-root path is
 * recomputed, and every step carries the accumulated mismatch ids.
 *
 * Leaves are edited in Play mode. Build commits all current inputs; a per-row
 * Tamper sends the committed leaves plus that row's new data and commits the
 * edit only after a 200 response. Hashes are real SHA-256; the UI shows the
 * first 8 of 64 hex characters and the inspector shows the full digest.
 *
 * Backend contract: docs/TRACE_SPEC.md §10. POST /merkle.
 */

import { TreeCanvas } from './primitives/TreeCanvas.js';
import { PlaybackController } from './engine/PlaybackController.js';
import { LessonRunner } from './engine/LessonRunner.js';
import { MERKLE_LESSONS } from './lessons/merkleLessons.js';
import { render as renderQuiz } from './primitives/QuizEngine.js';
import { getQuiz } from './quizzes/index.js';
import { renderGlossaryText } from './shell/glossaryTooltip.js';

const DEFAULT_LEAVES = ['a', 'b', 'c', 'd'];
const MAX_LEAVES = 16;
const MAX_LEAF_LEN = 40;

let leaves = DEFAULT_LEAVES.slice();
let committedLeaves = null;       // leaves represented by the current tree
let currentMode = 'play';
let isBusy = false;

let canvas = null;
let currentSnapshot = null;
let activeSteps = [];
let selectedNodeId = null;
let lastTamperMetrics = null;

const latestMerkle = window.createLatest ? window.createLatest() : (fn => fn());

// Lesson state
let currentLesson = MERKLE_LESSONS[0];
let activeCheckpoint = null;
let pendingLearnReset = false;
let checkpointHideTimer = null;

// Quiz state
let quizController = null;
let quizSource = null;

// --- Playback ---------------------------------------------------------------

const playback = new PlaybackController({
    onStep: (step, index) => renderStep(step, index),
    onDone: () => {
        updatePlayPauseButton();
        updateLeafEditorDisabled();
        canvas?.fitView(true);
    },
    onAnnotation: (text) => updateAnnotation(text),
    onStateChange: () => {
        updatePlayPauseButton();
        updateStepControls();
        updateLeafEditorDisabled();
    }
});

// --- Lesson runner ----------------------------------------------------------

const lessonRunner = new LessonRunner({
    buildSteps: buildLessonSteps,
    onStep: (step, index) => {
        if (step?.snapshot) renderStep(step, index);
        if (!activeCheckpoint) hideCheckpoint();
        updateLeafEditorDisabled();
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
        document.getElementById('quiz-prompt-panel')?.classList.remove('hidden');
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
    renderLeafEditor();
    resetPlayState({ message: 'Ready. Press Build to hash the four sample blocks.' });
    await initQuizDeepLink();
});

function initRenderers() {
    const treeEl = document.getElementById('merkle-tree');
    if (treeEl) {
        canvas = new TreeCanvas(treeEl, {
            layout: 'binary',
            tweenMs: 220,
            onNodeClick: (id) => onNodeClick(id)
        });
    }
}

function bindEventListeners() {
    document.getElementById('btn-mode-play')?.addEventListener('click', () => setMode('play'));
    document.getElementById('btn-mode-learn')?.addEventListener('click', () => setMode('learn'));

    document.getElementById('btn-build')?.addEventListener('click', onBuildClick);
    document.getElementById('btn-reset-leaves')?.addEventListener('click', onResetLeaves);
    document.getElementById('btn-add-leaf')?.addEventListener('click', onAddLeaf);
    document.getElementById('btn-remove-leaf')?.addEventListener('click', onRemoveLeaf);

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

    window.addEventListener('resize', () => canvas?.fitView());
}

// --- Busy gate and editor state ---------------------------------------------

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
    ['btn-mode-play', 'btn-mode-learn', 'lesson-select'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = disabled;
            el.classList.toggle('disabled-control', disabled);
        }
    });
    updateLeafEditorDisabled();
}

function editorDisabled() {
    return isBusy || playback.state.playing || currentMode !== 'play';
}

function updateLeafEditorDisabled() {
    const disabled = editorDisabled();
    document.querySelectorAll('.leaf-input').forEach((input) => {
        input.disabled = disabled;
    });
    document.querySelectorAll('.leaf-tamper').forEach((button) => {
        button.disabled = disabled || committedLeaves === null;
    });

    const add = document.getElementById('btn-add-leaf');
    const remove = document.getElementById('btn-remove-leaf');
    const build = document.getElementById('btn-build');
    const reset = document.getElementById('btn-reset-leaves');
    if (add) add.disabled = disabled || leaves.length >= MAX_LEAVES;
    if (remove) remove.disabled = disabled || leaves.length <= 1;
    if (build) build.disabled = disabled;
    if (reset) reset.disabled = disabled;
}

// --- Errors and notices -----------------------------------------------------

function showError(errorObj) {
    const banner = document.getElementById('merkle-error-banner');
    const text = document.getElementById('merkle-error-text');
    if (!banner || !text) return;
    const msg = typeof errorObj === 'string' ? errorObj : (errorObj?.message || 'Request failed');
    const field = errorObj?.field ? `[${errorObj.field}] ` : '';
    text.textContent = `${field}${msg}`;
    banner.classList.remove('hidden');
}

function clearError() {
    document.getElementById('merkle-error-banner')?.classList.add('hidden');
}

function showNotice(text) {
    const el = document.getElementById('merkle-notice');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
}

function clearNotice() {
    document.getElementById('merkle-notice')?.classList.add('hidden');
}

// --- Leaf editor ------------------------------------------------------------

function nextLeafLabel() {
    const used = new Set(leaves);
    for (let i = 0; i < 26; i += 1) {
        const candidate = String.fromCharCode(97 + i);
        if (!used.has(candidate)) return candidate;
    }
    return `leaf${leaves.length + 1}`;
}

function renderLeafEditor() {
    const container = document.getElementById('leaf-editor');
    if (!container) return;
    container.textContent = '';

    leaves.forEach((value, index) => {
        const row = document.createElement('div');
        row.className = 'leaf-row';

        const label = document.createElement('label');
        label.setAttribute('for', `leaf-input-${index}`);
        label.textContent = `Block ${index}`;
        row.appendChild(label);

        const input = document.createElement('input');
        input.type = 'text';
        input.id = `leaf-input-${index}`;
        input.className = 'leaf-input';
        input.maxLength = MAX_LEAF_LEN;
        input.value = value;
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.dataset.index = String(index);
        if (committedLeaves && committedLeaves[index] !== value) input.classList.add('pending');
        input.addEventListener('input', () => {
            leaves[index] = input.value;
            input.classList.toggle(
                'pending',
                committedLeaves !== null && committedLeaves[index] !== input.value
            );
            updateLeafEditorStatus();
        });
        row.appendChild(input);

        const tamper = document.createElement('button');
        tamper.type = 'button';
        tamper.className = 'leaf-tamper';
        tamper.textContent = 'Tamper';
        tamper.setAttribute('aria-label', `Tamper with block ${index}`);
        tamper.disabled = editorDisabled() || committedLeaves === null;
        tamper.addEventListener('click', () => onTamper(index));
        row.appendChild(tamper);

        container.appendChild(row);
    });

    updateLeafEditorStatus();
    updateLeafEditorDisabled();
}

function updateLeafEditorStatus() {
    const el = document.getElementById('leaf-editor-status');
    if (!el) return;

    if (committedLeaves === null) {
        el.textContent = 'No built tree yet. Press Build first; per-block Tamper becomes available after a build.';
        return;
    }

    let dirty = 0;
    leaves.forEach((value, index) => {
        if (committedLeaves[index] !== value) dirty += 1;
    });
    el.textContent = dirty === 0
        ? 'The tree matches every committed block. Edit one and press Tamper, or press Build to rebuild all.'
        : `${dirty} unsaved edit${dirty === 1 ? '' : 's'}. Build commits every block; Tamper commits only the row you press.`;
}

function validateLeaves(list) {
    if (!Array.isArray(list) || list.length < 1 || list.length > MAX_LEAVES) {
        showError({ message: `Use between 1 and ${MAX_LEAVES} blocks.`, field: 'leaves' });
        return false;
    }
    for (const value of list) {
        if (typeof value !== 'string' || value.length > MAX_LEAF_LEN) {
            showError({ message: `Each block is a string of at most ${MAX_LEAF_LEN} characters.`, field: 'leaves' });
            return false;
        }
    }
    return true;
}

function onAddLeaf() {
    if (leaves.length >= MAX_LEAVES) return;
    leaves.push(nextLeafLabel());
    committedLeaves = null;
    resetPlayState({ message: 'Block added. Press Build to hash the new leaf set.' });
    renderLeafEditor();
}

function onRemoveLeaf() {
    if (leaves.length <= 1) return;
    leaves.pop();
    committedLeaves = null;
    resetPlayState({ message: 'Last block removed. Press Build to hash the remaining leaves.' });
    renderLeafEditor();
}

function onResetLeaves() {
    leaves = DEFAULT_LEAVES.slice();
    committedLeaves = null;
    resetPlayState({ message: 'Leaves reset to a, b, c, d. Press Build to hash them.' });
    renderLeafEditor();
    showNotice('Leaves restored to the four-block sample.');
}

// --- Play actions -----------------------------------------------------------

async function onBuildClick() {
    if (!validateLeaves(leaves)) return;

    await runAction(async () => {
        const requestLeaves = leaves.slice();
        const res = await latestMerkle(() => window.fetchMerkleSteps({
            algorithm: 'merkle_build',
            leaves: requestLeaves
        }));
        if (res === null) return;
        if (!res.ok) {
            showError(res.error);
            return;
        }

        clearError();
        clearNotice();
        leaves = requestLeaves.slice();
        committedLeaves = requestLeaves.slice();
        lastTamperMetrics = null;
        selectedNodeId = null;
        renderLeafEditor();
        resetInspector();
        setRootBanner(`Hashing ${requestLeaves.length} blocks bottom-up\u2026`, null);

        activeSteps = Array.isArray(res.data?.steps) ? res.data.steps : [];
        currentSnapshot = null;
        playback.load(activeSteps);
        canvas?.fitView(true);
        playback.play();
    });
}

async function onTamper(index) {
    if (committedLeaves === null) {
        showError({ message: 'Build the tree before tampering with a block.', field: 'leaves' });
        return;
    }
    if (index < 0 || index >= committedLeaves.length) return;

    const newData = leaves[index];
    if (typeof newData !== 'string' || newData.length > MAX_LEAF_LEN) {
        showError({ message: `Block ${index} must be a string of at most ${MAX_LEAF_LEN} characters.`, field: 'new_data' });
        return;
    }

    await runAction(async () => {
        const baseLeaves = committedLeaves.slice();
        const res = await latestMerkle(() => window.fetchMerkleSteps({
            algorithm: 'merkle_tamper',
            leaves: baseLeaves,
            index,
            new_data: newData
        }));
        if (res === null) return;
        if (!res.ok) {
            showError(res.error);
            return;
        }

        clearError();
        clearNotice();
        committedLeaves = baseLeaves;
        committedLeaves[index] = newData;
        leaves[index] = newData;
        lastTamperMetrics = res.data?.metrics || null;
        renderLeafEditor();
        setRootBanner(`Recomputing the path from block ${index} to the root\u2026`, null);

        activeSteps = Array.isArray(res.data?.steps) ? res.data.steps : [];
        currentSnapshot = null;
        playback.load(activeSteps);
        canvas?.fitView(true);
        playback.play();
    });
}

// --- Reset and rendering ----------------------------------------------------

function resetPlayState({ message } = {}) {
    playback.cancel();
    playback.load([]);
    activeSteps = [];
    currentSnapshot = null;
    selectedNodeId = null;
    lastTamperMetrics = null;
    clearError();
    clearNotice();
    canvas?.render({ nodes: [], root_id: null });
    resetInspector();
    updateMetrics(null);
    setRootBanner('not built yet — press Build.', null);
    updateStepControls();
    updateLeafEditorDisabled();
    updateAnnotation(message || 'Ready. Press Build to hash the current blocks.');
}

function short(hex) {
    return typeof hex === 'string' && hex.length > 8 ? `${hex.slice(0, 8)}\u2026` : String(hex ?? '\u2026');
}

function setRootBanner(text, state) {
    const banner = document.getElementById('root-banner');
    const el = document.getElementById('root-banner-text');
    if (el) el.textContent = text;
    if (!banner) return;
    banner.classList.remove('changed', 'matched');
    if (state === 'changed' || state === 'matched') banner.classList.add(state);
}

function updateRootBannerForStep(step) {
    const p = step?.payload || {};

    if (step.type === 'root_ready') {
        const count = committedLeaves ? committedLeaves.length : leaves.length;
        setRootBanner(
            `Merkle root ${short(p.root)} (first 8 of 64 hex). One digest commits to ${count} block${count === 1 ? '' : 's'}.`,
            null
        );
        return;
    }
    if (step.type === 'build_done') {
        setRootBanner(
            `Merkle root ${short(p.root)} \u00b7 ${p.leaves} block${p.leaves === 1 ? '' : 's'}, ` +
            `${p.nodes} nodes, ${p.levels} level${p.levels === 1 ? '' : 's'}.`,
            'matched'
        );
        return;
    }
    if (step.type === 'tamper_edit' && p.changed !== false) {
        setRootBanner(`Block ${p.index} changed from "${p.old_data}" to "${p.new_data}". Walking its path to the root\u2026`, null);
        return;
    }
    if (step.type === 'root_compare' || step.type === 'tamper_done') {
        const original = p.original_root ?? lastTamperMetrics?.original_root;
        const updated = p.new_root ?? p.root ?? lastTamperMetrics?.new_root;
        const changed = p.root_changed ?? lastTamperMetrics?.root_changed ?? (original !== updated);
        const recomputed = p.recomputed ?? lastTamperMetrics?.recomputed;
        const total = p.total_internal ?? lastTamperMetrics?.total_internal;
        const pathNote = (recomputed !== undefined && total !== undefined)
            ? ` Recomputed ${recomputed} of ${total} internal hash${total === 1 ? '' : 'es'}.`
            : '';
        const rebuildNote = lastTamperMetrics?.matches_full_rebuild
            ? ' The path recompute matches a full rebuild.'
            : '';
        setRootBanner(
            changed
                ? `Root changed: ${short(original)} \u2260 ${short(updated)}.${pathNote}${rebuildNote}`
                : `Root unchanged: ${short(original)} = ${short(updated)}.${pathNote}${rebuildNote}`,
            changed ? 'changed' : 'matched'
        );
    }
}

function renderStep(step, index) {
    if (!step) return;

    if (step.snapshot) {
        currentSnapshot = step.snapshot;
        canvas?.render(step.snapshot, step);
        if (selectedNodeId !== null) renderInspector(selectedNodeId);
    }

    updateMetrics(collectMetrics(activeSteps, index));
    updateRootBannerForStep(step);
}

function collectMetrics(steps, index) {
    if (!Array.isArray(steps)) return null;
    let result = null;
    const last = Math.min(index, steps.length - 1);
    for (let i = 0; i <= last; i += 1) {
        const step = steps[i];
        if (step?.type !== 'build_done' && step?.type !== 'tamper_done') continue;
        if (step.payload && typeof step.payload === 'object') result = { ...step.payload };
    }
    return result;
}

function updateMetrics(metrics) {
    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
    };

    if (!metrics) {
        set('metric-leaves', 0);
        set('metric-nodes', 0);
        set('metric-levels', 0);
        set('metric-root', '\u2014');
        set('metric-recomputed', '\u2014');
        return;
    }

    set('metric-leaves', metrics.leaves ?? 0);
    set('metric-nodes', metrics.nodes ?? 0);
    set('metric-levels', metrics.levels ?? 0);
    set('metric-root', metrics.root_short ? `${metrics.root_short}\u2026` : '\u2014');
    set('metric-recomputed',
        metrics.recomputed !== undefined
            ? `${metrics.recomputed} of ${metrics.total_internal}`
            : '\u2014');
}

function updateAnnotation(text) {
    const el = document.getElementById('step-annotation');
    if (el) renderGlossaryText(el, text || '');
}

// --- Node inspector ---------------------------------------------------------

function onNodeClick(id) {
    selectedNodeId = Number(id);
    renderInspector(selectedNodeId);
}

function resetInspector() {
    selectedNodeId = null;
    const box = document.getElementById('node-inspector');
    if (!box) return;
    box.textContent = '';
    const p = document.createElement('p');
    p.textContent = 'Click any node to see its full 64-character SHA-256 hash and children.';
    box.appendChild(p);
}

function definitionList(entries) {
    const dl = document.createElement('dl');
    entries.forEach(([term, value, className]) => {
        const dt = document.createElement('dt');
        dt.textContent = term;
        const dd = document.createElement('dd');
        if (className) dd.className = className;
        if (value instanceof Node) dd.appendChild(value);
        else dd.textContent = String(value);
        dl.appendChild(dt);
        dl.appendChild(dd);
    });
    return dl;
}

function renderInspector(id) {
    const box = document.getElementById('node-inspector');
    if (!box) return;
    const nodes = currentSnapshot?.nodes || [];
    const node = nodes.find((entry) => entry.id === id);
    if (!node) {
        resetInspector();
        return;
    }

    const children = nodes.filter((entry) => entry.parent_id === node.id);
    const isLeaf = children.length === 0 && node.duplicate_of === null;
    let type = 'internal';
    if (node.parent_id === null) type = 'root';
    else if (isLeaf) type = 'leaf';
    if (node.duplicate_of !== null) type = `duplicate of #${node.duplicate_of}`;

    const childText = children.length === 0
        ? 'none (leaf)'
        : children.map((child) => `${child.label} (#${child.id})`).join(', ');
    const fullHash = node.full_hash
        ? node.full_hash
        : 'pending \u2014 this node has not been hashed yet';

    box.textContent = '';
    box.appendChild(definitionList([
        ['Label', node.label],
        ['Node id', `#${node.id}`],
        ['Type', type],
        ['First 8 hex', node.sublabel || '\u2026'],
        ['Children', childText],
        ['Duplicate of', node.duplicate_of === null ? 'not a duplicate' : `#${node.duplicate_of}`],
        ['Full SHA-256', fullHash, node.full_hash ? 'full-hash' : null]
    ]));
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
        committedLeaves = null;
        resetPlayState({ message: 'Play mode. Press Build to hash the current blocks.' });
        renderLeafEditor();
    }
}

function updateUIForMode(mode) {
    const playPanel = document.getElementById('play-controls-panel');
    const learnPanel = document.getElementById('learn-controls-panel');
    const playTab = document.getElementById('btn-mode-play');
    const learnTab = document.getElementById('btn-mode-learn');
    const editorCard = document.getElementById('leaf-editor-card');

    const isPlay = mode === 'play';
    playPanel?.classList.toggle('hidden', !isPlay);
    learnPanel?.classList.toggle('hidden', isPlay);
    editorCard?.classList.toggle('hidden', !isPlay);
    playTab?.classList.toggle('active-tab', isPlay);
    learnTab?.classList.toggle('active-tab', !isPlay);
    playTab?.setAttribute('aria-selected', isPlay ? 'true' : 'false');
    learnTab?.setAttribute('aria-selected', isPlay ? 'false' : 'true');
}

// --- Lesson building --------------------------------------------------------

function resolveCheckpointAnchors(checkpoints, steps) {
    const list = Array.isArray(checkpoints) ? checkpoints : [];
    return list.map((checkpoint) => {
        if (!checkpoint || !checkpoint.anchorType) return checkpoint;
        const offset = Number.isInteger(checkpoint.anchorOffset) ? checkpoint.anchorOffset : -1;
        let seen = 0;
        for (let index = 0; index < steps.length; index += 1) {
            if (steps[index].type !== checkpoint.anchorType) continue;
            seen += 1;
            if (seen === (checkpoint.occurrence || 1)) {
                return { ...checkpoint, atStep: Math.max(0, Math.min(steps.length - 1, index + offset)) };
            }
        }
        console.warn('[Merkle] checkpoint anchor not found', checkpoint);
        return { ...checkpoint, atStep: Math.max(0, steps.length - 1) };
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

async function merkleRequestOrThrow(payload) {
    const res = await window.fetchMerkleSteps(payload);
    if (!res.ok) {
        throw new Error(res.error?.message || 'Merkle trace request failed');
    }
    return res.data;
}

async function buildLessonSteps(lesson) {
    const steps = [];

    for (const action of (Array.isArray(lesson.actions) ? lesson.actions : [])) {
        let payload;
        if (action.op === 'build') {
            payload = { algorithm: 'merkle_build', leaves: action.leaves };
        } else if (action.op === 'tamper') {
            payload = {
                algorithm: 'merkle_tamper',
                leaves: action.leaves,
                index: action.index,
                new_data: action.newData
            };
        } else {
            throw new Error(`Unknown Merkle lesson action: ${action.op}`);
        }

        const data = await merkleRequestOrThrow(payload);
        if (Array.isArray(data.steps)) steps.push(...data.steps);
        if (action.op === 'tamper') lastTamperMetrics = data.metrics || null;
    }

    appendQuizSentinel(lesson, steps);
    activeSteps = steps;
    return {
        steps,
        checkpoints: resolveCheckpointAnchors(lesson.checkpoints, steps)
    };
}

// --- Learn mode -------------------------------------------------------------

function initLessonSelector() {
    const select = document.getElementById('lesson-select');
    if (!select) return;

    select.textContent = '';
    for (const lesson of MERKLE_LESSONS) {
        const option = document.createElement('option');
        option.value = lesson.id;
        option.textContent = lesson.title;
        select.appendChild(option);
    }
    select.value = currentLesson.id;

    select.addEventListener('change', () => {
        const next = MERKLE_LESSONS.find((lesson) => lesson.id === select.value);
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
        activeCheckpoint = null;
        activeSteps = [];
        currentSnapshot = null;
        selectedNodeId = null;
        lastTamperMetrics = null;
        clearError();
        clearNotice();
        hideCheckpoint();
        hideQuizPrompt();

        canvas?.render({ nodes: [], root_id: null });
        resetInspector();
        updateMetrics(null);
        setRootBanner('Building the lesson tree\u2026', null);

        renderLearnPills(currentLesson);
        updateLessonDescription();

        const state = await lessonRunner.loadLesson(currentLesson, { forceRebuild: true });
        if (state.status === 'error') return;

        canvas?.fitView(true);
        updateLearnControls();
        updateLeafEditorDisabled();
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

    (Array.isArray(lesson?.actions) ? lesson.actions : []).forEach((action, index) => {
        const pill = document.createElement('span');
        pill.className = 'learn-pill' + (index === 0 ? ' pill-active' : '');
        if (action.op === 'build') {
            pill.textContent = `build ${action.leaves.length}`;
        } else if (action.op === 'tamper') {
            pill.textContent = `tamper block ${action.index}`;
        }
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

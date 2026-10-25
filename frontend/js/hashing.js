/**
 * hashing.js — Controller for Unit 3b: Hashing.
 *
 * One PlaybackController drives two BucketGrid panels from the same backend
 * step. Each step carries snapshots for both strategies, so the panel that is
 * not currently being narrated simply keeps its previous snapshot. Step types
 * from the backend tell us which panel owns the action and which cells to
 * decorate; role arrays are suffixed by panel (`probing_open`,
 * `created_chaining`) and BucketGrid reads the suffix itself.
 *
 * The op log is stateless. Insert and delete are committed only after a 200
 * response; search never mutates it. Changing the hash function or initial
 * table size clears the log, because the same keys must be replayed under the
 * new settings and the backend owns the resize history.
 *
 * Backend contract: docs/TRACE_SPEC.md §9. POST /hash.
 */

import { BucketGrid } from './primitives/BucketGrid.js';
import { PlaybackController } from './engine/PlaybackController.js';
import { LessonRunner } from './engine/LessonRunner.js';
import { HASH_LESSONS } from './lessons/hashLessons.js';
import { render as renderQuiz } from './primitives/QuizEngine.js';
import { getQuiz } from './quizzes/index.js';
import { renderGlossaryText } from './shell/glossaryTooltip.js';

const MAX_KEY_LEN = 12;
const KEY_RE = /^[\x21-\x7E]{1,12}$/;
const METRIC_KEYS = [
    'collisions', 'max_chain_length', 'max_probe_length',
    'total_probes', 'resizes', 'tombstones', 'load_factor', 'size', 'count'
];

let ops = [];
let hashFn = 'sum_mod';
let tableSize = 7;
let currentMode = 'play';
let isBusy = false;
let suppressSettingReset = false;

let chainingGrid = null;
let openGrid = null;
let currentSnapshot = null;
let activeSteps = [];
let metrics = zeroMetrics();
let latestCompute = { chaining: null, open: null };

const latestHash = window.createLatest ? window.createLatest() : (fn => fn());

// Lesson state
let currentLesson = HASH_LESSONS[0];
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
    resetSession({
        announcement: 'Ready. Insert a key, or choose a preset or Learn Mode to begin.'
    });
    await initQuizDeepLink();
});

function initRenderers() {
    const chainEl = document.getElementById('chaining-grid');
    const openEl = document.getElementById('open-grid');
    if (chainEl) chainingGrid = new BucketGrid(chainEl, { showCaption: true });
    if (openEl) openGrid = new BucketGrid(openEl, { showCaption: true });
}

function bindEventListeners() {
    document.getElementById('btn-mode-play')?.addEventListener('click', () => setMode('play'));
    document.getElementById('btn-mode-learn')?.addEventListener('click', () => setMode('learn'));

    document.getElementById('btn-insert')?.addEventListener('click', () => onActionClick('hash_insert'));
    document.getElementById('btn-delete')?.addEventListener('click', () => onActionClick('hash_delete'));
    document.getElementById('btn-search')?.addEventListener('click', () => onActionClick('hash_search'));
    document.getElementById('btn-clear')?.addEventListener('click', () => {
        resetSession({ announcement: 'Cleared. Insert a key to begin.' });
    });

    document.getElementById('preset-anagram')?.addEventListener('click', () => runPreset('anagram'));
    document.getElementById('preset-resize')?.addEventListener('click', () => runPreset('resize'));

    document.getElementById('hash-fn')?.addEventListener('change', onSettingChanged);
    document.getElementById('table-size')?.addEventListener('change', onSettingChanged);

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

    document.getElementById('key-input')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') onActionClick('hash_insert');
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
        'btn-insert', 'btn-delete', 'btn-search', 'key-input',
        'hash-fn', 'table-size', 'btn-clear',
        'preset-anagram', 'preset-resize',
        'btn-mode-play', 'btn-mode-learn', 'lesson-select'
    ];
    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = disabled;
            el.classList.toggle('disabled-control', disabled);
        }
    });
    document.querySelectorAll('#key-chips .chip').forEach((chip) => {
        chip.disabled = disabled;
    });
}

// --- Errors and notices -----------------------------------------------------

function showError(errorObj) {
    const banner = document.getElementById('hash-error-banner');
    const text = document.getElementById('hash-error-text');
    if (!banner || !text) return;
    const msg = typeof errorObj === 'string' ? errorObj : (errorObj?.message || 'Request failed');
    const field = errorObj?.field ? `[${errorObj.field}] ` : '';
    text.textContent = `${field}${msg}`;
    banner.classList.remove('hidden');
}

function clearError() {
    document.getElementById('hash-error-banner')?.classList.add('hidden');
}

function showNotice(text) {
    const el = document.getElementById('hash-notice');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
}

function clearNotice() {
    document.getElementById('hash-notice')?.classList.add('hidden');
}

// --- Settings ---------------------------------------------------------------

function onSettingChanged() {
    if (suppressSettingReset) return;
    const fnSelect = document.getElementById('hash-fn');
    const sizeSelect = document.getElementById('table-size');
    const nextFn = fnSelect ? fnSelect.value : hashFn;
    const nextSize = sizeSelect ? Number(sizeSelect.value) : tableSize;
    if (nextFn === hashFn && nextSize === tableSize) return;

    hashFn = nextFn;
    tableSize = nextSize;
    resetSession({
        announcement: 'Settings changed. Insert a key to start a fresh trace.',
        notice: `Hash function is now ${fnLabel(hashFn)} and the initial table size is ${tableSize}. The op log was cleared so every stored key is replayed under the new settings.`
    });
}

function fnLabel(value) {
    return value === 'poly' ? 'polynomial x31' : 'sum of char codes';
}

// --- Session reset ----------------------------------------------------------

function emptySnapshot(size) {
    return {
        chaining: {
            strategy: 'chaining',
            size,
            count: 0,
            load_factor: 0,
            threshold: 1.0,
            buckets: Array.from({ length: size }, () => [])
        },
        open: {
            strategy: 'open',
            size,
            count: 0,
            tombstones: 0,
            load_factor: 0,
            threshold: 0.75,
            slots: Array.from({ length: size }, () => null)
        }
    };
}

function resetSession({ announcement, notice } = {}) {
    playback.cancel();
    playback.load([]);
    ops = [];
    activeSteps = [];
    metrics = zeroMetrics();
    latestCompute = { chaining: null, open: null };
    currentSnapshot = emptySnapshot(tableSize);
    clearError();
    if (notice) showNotice(notice);
    else clearNotice();

    renderGrids(currentSnapshot, null);
    renderExplainer();
    updateCompare();
    renderChips();
    updateStepControls();
    updateActivePanel(null);
    updateAnnotation(announcement || 'Cleared. Insert a key to begin.');
}

function renderGrids(snapshot, step) {
    if (!snapshot) return;
    if (chainingGrid && snapshot.chaining) chainingGrid.render(snapshot.chaining, step || {});
    if (openGrid && snapshot.open) openGrid.render(snapshot.open, step || {});
    updateMeters(snapshot.chaining, snapshot.open);
}

// --- Play-mode actions ------------------------------------------------------

function readKey() {
    const input = document.getElementById('key-input');
    if (!input) return null;
    const key = input.value;
    if (!KEY_RE.test(key)) {
        showError({
            message: `A key is 1-${MAX_KEY_LEN} printable characters with no spaces (ASCII 33-126).`,
            field: 'key'
        });
        return null;
    }
    return key;
}

function requestPayload(algorithm, key) {
    return {
        algorithm,
        hash_fn: hashFn,
        table_size: tableSize,
        probing: 'linear',
        ops: ops.map((op) => ({ ...op })),
        action: { key }
    };
}

async function onActionClick(algorithm) {
    await runAction(async () => {
        const key = readKey();
        if (key === null) return;

        const res = await latestHash(() => window.fetchHashSteps(requestPayload(algorithm, key)));
        if (res === null) return;
        if (!res.ok) {
            showError(res.error);
            return;
        }

        clearError();
        clearNotice();
        if (algorithm === 'hash_insert') {
            ops.push({ op: 'insert', key });
            const input = document.getElementById('key-input');
            if (input) input.value = '';
        } else if (algorithm === 'hash_delete') {
            ops.push({ op: 'delete', key });
        }

        renderChips();
        activeSteps = Array.isArray(res.data?.steps) ? res.data.steps : [];
        metrics = zeroMetrics();
        playback.load(activeSteps);
        playback.play();
    });
}

// --- Presets ----------------------------------------------------------------

async function runPreset(kind) {
    await runAction(async () => {
        const preset = kind === 'resize'
            ? {
                fn: 'sum_mod',
                size: 5,
                keys: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
                label: 'Fill to trigger resize (size 5)'
            }
            : {
                fn: 'sum_mod',
                size: 7,
                keys: ['listen', 'silent', 'enlist', 'tinsel'],
                label: 'Anagram collision demo (sum of codes, size 7)'
            };

        hashFn = preset.fn;
        tableSize = preset.size;
        const fnSelect = document.getElementById('hash-fn');
        const sizeSelect = document.getElementById('table-size');
        suppressSettingReset = true;
        if (fnSelect) fnSelect.value = hashFn;
        if (sizeSelect) sizeSelect.value = String(tableSize);
        suppressSettingReset = false;

        resetSession({ notice: `${preset.label}: replaying the keys and comparing both panels.` });

        const allSteps = [];
        const simOps = [];
        for (const key of preset.keys) {
            const res = await latestHash(() => window.fetchHashSteps({
                algorithm: 'hash_insert',
                hash_fn: hashFn,
                table_size: tableSize,
                probing: 'linear',
                ops: simOps.map((op) => ({ ...op })),
                action: { key }
            }));
            if (res === null) return;
            if (!res.ok) {
                showError(res.error);
                break;
            }
            simOps.push({ op: 'insert', key });
            if (Array.isArray(res.data?.steps)) allSteps.push(...res.data.steps);
        }

        ops = simOps;
        renderChips();
        clearError();
        activeSteps = allSteps;
        metrics = zeroMetrics();
        playback.load(activeSteps);
        playback.play();
    });
}

// --- Step rendering ---------------------------------------------------------

function zeroMetrics() {
    return {
        chaining: {
            collisions: 0, max_chain_length: 0, total_probes: 0,
            resizes: 0, tombstones: 0, load_factor: 0, size: 0, count: 0
        },
        open: {
            collisions: 0, max_probe_length: 0, total_probes: 0,
            resizes: 0, tombstones: 0, load_factor: 0, size: 0, count: 0
        }
    };
}

function collectMetrics(steps, index) {
    let result = zeroMetrics();
    if (!Array.isArray(steps)) return result;
    const last = Math.min(index, steps.length - 1);
    for (let i = 0; i <= last; i += 1) {
        const step = steps[i];
        if (step?.phaseStart) result = zeroMetrics();
        const panel = step?.panel;
        const payload = step?.payload;
        if (!panel || !payload || typeof step.type !== 'string') continue;
        if (!step.type.endsWith('_done')) continue;
        if (payload.total_probes === undefined) continue;
        if (!result[panel]) continue;
        const next = { ...result[panel] };
        for (const key of METRIC_KEYS) {
            if (payload[key] !== undefined) next[key] = payload[key];
        }
        result[panel] = next;
    }
    return result;
}

function renderStep(step, index) {
    if (!step) return;

    if (step.phaseStart) {
        latestCompute = { chaining: null, open: null };
    }

    if (step.snapshot) {
        currentSnapshot = step.snapshot;
        renderGrids(step.snapshot, step);
    }

    if (step.type === 'hash_compute' && step.panel && step.payload) {
        latestCompute = { ...latestCompute, [step.panel]: step.payload };
        renderExplainer();
    }

    metrics = collectMetrics(activeSteps, index);
    updateCompare();
    updateActivePanel(step.panel || null);
}

function updateActivePanel(panel) {
    const chainPanel = document.getElementById('chaining-panel');
    const openPanel = document.getElementById('open-panel');
    const chainNow = document.getElementById('chaining-now');
    const openNow = document.getElementById('open-now');

    chainPanel?.classList.toggle('is-active-panel', panel === 'chaining');
    openPanel?.classList.toggle('is-active-panel', panel === 'open');
    if (chainNow) chainNow.textContent = panel === 'chaining' ? 'Now playing' : '';
    if (openNow) openNow.textContent = panel === 'open' ? 'Now playing' : '';
}

function updateAnnotation(text) {
    const el = document.getElementById('step-annotation');
    if (el) renderGlossaryText(el, text || '');
}

// --- Load meters ------------------------------------------------------------

function updateMeters(chaining, open) {
    updateMeter('chaining', chaining);
    updateMeter('open', open);
}

function updateMeter(panel, snapshot) {
    const meter = document.getElementById(`${panel}-meter`);
    const fill = document.getElementById(`${panel}-meter-fill`);
    const thresholdEl = document.getElementById(`${panel}-meter-threshold`);
    const text = document.getElementById(`${panel}-meter-text`);
    if (!meter || !fill || !thresholdEl || !text) return;

    const size = Number(snapshot?.size) || 0;
    const count = Number(snapshot?.count) || 0;
    const tombstones = Number(snapshot?.tombstones) || 0;
    const threshold = Number(snapshot?.threshold) || (panel === 'open' ? 0.75 : 1.0);
    const load = size > 0 ? count / size : 0;
    const effective = size > 0 ? (count + tombstones) / size : 0;
    const over = effective > threshold + 1e-9;
    const gauge = panel === 'open' ? effective : load;

    fill.style.width = `${Math.min(100, Math.max(0, gauge * 100))}%`;
    thresholdEl.style.left = `${Math.min(100, Math.max(0, threshold * 100))}%`;
    meter.classList.toggle('over', over);

    const parts = [
        `${load.toFixed(2)} live / ${threshold.toFixed(2)} threshold`,
        `${count} key${count === 1 ? '' : 's'} in ${size} ${panel === 'open' ? 'slots' : 'buckets'}`
    ];
    if (panel === 'open') {
        parts.push(`${tombstones} tombstone${tombstones === 1 ? '' : 's'}`);
        parts.push(`effective ${effective.toFixed(2)} incl. tombstones`);
    }
    if (over) parts.push('OVER THRESHOLD');

    text.textContent = parts.join(' \u00b7 ');
    meter.setAttribute('role', 'img');
    meter.setAttribute('aria-label', `${panel === 'open' ? 'Open addressing' : 'Separate chaining'} load meter: ${text.textContent}`);
}

// --- Hash explainer ---------------------------------------------------------

function renderExplainer() {
    const box = document.getElementById('hash-explainer');
    if (!box) return;
    box.textContent = '';

    const panels = ['chaining', 'open'];
    const any = panels.some((panel) => latestCompute[panel]);
    if (!any) {
        const formula = document.createElement('span');
        formula.className = 'hash-formula';
        formula.textContent = 'h(key)';
        const hint = document.createElement('span');
        hint.textContent = 'Enter a key and insert it to see the per-character terms, the raw hash and the index.';
        box.appendChild(formula);
        box.appendChild(hint);
        return;
    }

    panels.forEach((panel) => {
        const payload = latestCompute[panel];
        if (!payload) return;
        const line = document.createElement('div');
        line.className = 'hash-explain-line';

        const name = document.createElement('strong');
        name.textContent = panel === 'chaining' ? 'Chaining' : 'Open';
        line.appendChild(name);

        const fn = document.createElement('span');
        fn.textContent = `${fnLabel(payload.hash_fn)}:`;
        line.appendChild(fn);

        const terms = document.createElement('span');
        terms.className = 'hash-terms';
        (Array.isArray(payload.terms) ? payload.terms : []).forEach((term) => {
            const termEl = document.createElement('span');
            termEl.className = 'hash-term';
            termEl.textContent = `${term.char}(${term.code}) \u2192 ${term.running}`;
            terms.appendChild(termEl);
        });
        line.appendChild(terms);

        const result = document.createElement('span');
        result.className = 'hash-formula';
        result.textContent = `${payload.raw} mod ${payload.table_size} = ${payload.index}`;
        line.appendChild(result);

        box.appendChild(line);
    });
}

// --- Metrics comparison -----------------------------------------------------

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
}

function updateCompare() {
    const chainSnapshot = currentSnapshot?.chaining || {};
    const openSnapshot = currentSnapshot?.open || {};
    const chainMetrics = metrics.chaining || {};
    const openMetrics = metrics.open || {};

    setText('cmp-chain-count', Number(chainSnapshot.count) || 0);
    setText('cmp-open-count', Number(openSnapshot.count) || 0);
    setText('cmp-chain-size', Number(chainSnapshot.size) || 0);
    setText('cmp-open-size', Number(openSnapshot.size) || 0);
    setText('cmp-chain-load', (Number(chainSnapshot.load_factor) || 0).toFixed(2));
    setText('cmp-open-load', (Number(openSnapshot.load_factor) || 0).toFixed(2));

    setText('cmp-chain-collisions', Number(chainMetrics.collisions) || 0);
    setText('cmp-open-collisions', Number(openMetrics.collisions) || 0);
    setText('cmp-chain-longest', Number(chainMetrics.max_chain_length) || 0);
    setText('cmp-open-longest', Number(openMetrics.max_probe_length) || 0);
    setText('cmp-chain-probes', Number(chainMetrics.total_probes) || 0);
    setText('cmp-open-probes', Number(openMetrics.total_probes) || 0);
    setText('cmp-chain-resizes', Number(chainMetrics.resizes) || 0);
    setText('cmp-open-resizes', Number(openMetrics.resizes) || 0);
    setText('cmp-chain-tombstones', '0 (never)');
    setText('cmp-open-tombstones', Number(openSnapshot.tombstones) || Number(openMetrics.tombstones) || 0);
}

// --- Key chips --------------------------------------------------------------

function liveKeys(opLog) {
    const order = [];
    const live = new Set();
    for (const op of opLog) {
        if (op.op === 'insert') {
            if (!live.has(op.key)) {
                live.add(op.key);
                order.push(op.key);
            }
        } else if (op.op === 'delete') {
            live.delete(op.key);
        }
    }
    return order.filter((key) => live.has(key));
}

function renderChips() {
    const container = document.getElementById('key-chips');
    if (!container) return;
    container.textContent = '';

    const keys = liveKeys(ops);
    if (keys.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'control-hint';
        empty.style.margin = '0';
        empty.textContent = 'No keys yet.';
        container.appendChild(empty);
        return;
    }

    keys.forEach((key) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.setAttribute('role', 'listitem');
        chip.setAttribute('aria-label', `Search for ${key}`);
        chip.textContent = key;
        chip.disabled = isBusy;
        chip.addEventListener('click', () => {
            const input = document.getElementById('key-input');
            if (input) input.value = key;
            onActionClick('hash_search');
        });
        container.appendChild(chip);
    });
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
        resetSession({ announcement: 'Play mode. Insert a key to begin.' });
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

function lessonPhases(lesson) {
    if (Array.isArray(lesson?.phases) && lesson.phases.length > 0) {
        return lesson.phases.map((phase) => ({
            hashFn: phase.hashFn || lesson.hashFn || 'sum_mod',
            tableSize: phase.tableSize || lesson.tableSize || 7,
            actions: Array.isArray(phase.actions) ? phase.actions : [],
            intro: phase.intro || null
        }));
    }
    return [{
        hashFn: lesson?.hashFn || 'sum_mod',
        tableSize: lesson?.tableSize || 7,
        actions: Array.isArray(lesson?.actions) ? lesson.actions : [],
        intro: null
    }];
}

function lessonTableSize(lesson) {
    const phases = lessonPhases(lesson);
    return phases[0]?.tableSize || 7;
}

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
        console.warn('[Hash] checkpoint anchor not found', checkpoint);
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

async function hashRequestOrThrow(payload) {
    const res = await window.fetchHashSteps(payload);
    if (!res.ok) {
        throw new Error(res.error?.message || 'Hash trace request failed');
    }
    return res.data;
}

async function buildLessonSteps(lesson) {
    const phases = lessonPhases(lesson);
    const steps = [];

    for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex += 1) {
        const phase = phases[phaseIndex];
        const simOps = [];
        const phaseStart = steps.length;

        for (const action of phase.actions) {
            let algorithm;
            if (action.op === 'insert') algorithm = 'hash_insert';
            else if (action.op === 'delete') algorithm = 'hash_delete';
            else if (action.op === 'search') algorithm = 'hash_search';
            else throw new Error(`Unknown hash lesson action: ${action.op}`);

            const data = await hashRequestOrThrow({
                algorithm,
                hash_fn: phase.hashFn,
                table_size: phase.tableSize,
                probing: 'linear',
                ops: simOps.map((op) => ({ ...op })),
                action: { key: action.key }
            });

            if (Array.isArray(data.steps)) steps.push(...data.steps);
            if (action.op === 'insert') simOps.push({ op: 'insert', key: action.key });
            if (action.op === 'delete') simOps.push({ op: 'delete', key: action.key });
        }

        if (phaseIndex > 0 && phase.intro && phaseStart < steps.length) {
            // Show the phase handover on the first step of the new table. The
            // step itself still comes from the backend; only the narration and
            // the metric-reset flag are page-local.
            lesson.narration = { ...(lesson.narration || {}), [String(phaseStart)]: phase.intro };
            steps[phaseStart].phaseStart = true;
        }
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
    for (const lesson of HASH_LESSONS) {
        const option = document.createElement('option');
        option.value = lesson.id;
        option.textContent = lesson.title;
        select.appendChild(option);
    }
    select.value = currentLesson.id;

    select.addEventListener('change', () => {
        const next = HASH_LESSONS.find((lesson) => lesson.id === select.value);
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
        activeSteps = [];
        metrics = zeroMetrics();
        latestCompute = { chaining: null, open: null };
        currentSnapshot = emptySnapshot(lessonTableSize(currentLesson));
        clearError();
        clearNotice();
        hideCheckpoint();
        hideQuizPrompt();

        renderLearnPills(currentLesson);
        updateLessonDescription();
        renderChips();
        renderGrids(currentSnapshot, null);
        renderExplainer();
        updateCompare();
        updateActivePanel(null);

        const state = await lessonRunner.loadLesson(currentLesson, { forceRebuild: true });
        if (state.status === 'error') return;

        updateLearnControls();
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

    const entries = [];
    if (Array.isArray(lesson?.phases) && lesson.phases.length > 0) {
        lesson.phases.forEach((phase) => {
            const prefix = phase.hashFn === 'poly' ? 'poly' : 'sum';
            (phase.actions || []).forEach((action) => {
                entries.push(`${prefix} ${action.op} ${action.key}`);
            });
        });
    } else {
        (lesson?.actions || []).forEach((action) => {
            entries.push(`${action.op} ${action.key}`);
        });
    }

    entries.forEach((label, index) => {
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

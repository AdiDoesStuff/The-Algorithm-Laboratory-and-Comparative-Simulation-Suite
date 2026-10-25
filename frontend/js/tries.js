/**
 * tries.js — Controller for Unit 3a: Tries.
 *
 * One PlaybackController drives a TreeCanvas in `nary` layout. Every backend
 * step carries the whole trie snapshot, so node ids, shared prefixes and
 * terminal markers are always derived from the same state the animation is
 * showing. Roles come from the step itself (`created`, `reused`, `matched`,
 * `probing`) and each has a glyph or ring cue, never colour alone.
 *
 * The op log is stateless: every request replays the committed inserts, then
 * applies the action. Inserts are committed only after a 200 response.
 * Search and prefix actions never mutate the op log.
 *
 * The autocomplete box is a separate read-only preview. It is debounced and
 * guarded by createLatest(), so a slow response can never overwrite a newer
 * prefix, and typing never changes the stored words.
 *
 * Backend contract: docs/TRACE_SPEC.md §8. POST /trie.
 */

import { TreeCanvas } from './primitives/TreeCanvas.js';
import { PlaybackController } from './engine/PlaybackController.js';
import { LessonRunner } from './engine/LessonRunner.js';
import { TRIE_LESSONS } from './lessons/trieLessons.js';
import { render as renderQuiz } from './primitives/QuizEngine.js';
import { getQuiz } from './quizzes/index.js';
import { renderGlossaryText } from './shell/glossaryTooltip.js';

const MAX_WORDS = 30;
const MAX_WORD_LEN = 12;
const WORD_RE = /^[a-z]+$/;

let ops = [];                    // committed inserts for POST /trie
let currentMode = 'play';        // 'play' | 'learn'
let isBusy = false;

let canvas = null;
let lastSnapshot = null;
let lastFinalTree = null;
let totals = { nodes: 1, words: 0, created: 0, reused: 0, letters: 0 };

let suggestTimer = null;
const latestSuggest = window.createLatest ? window.createLatest() : (fn => fn());

// Lesson state
let currentLesson = TRIE_LESSONS[0];
let activeCheckpoint = null;
let pendingLearnReset = false;
let checkpointHideTimer = null;
const lessonTotals = new Map();  // lessonId -> totals

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
    clearTree('Ready. Insert a word or choose Learn Mode to begin.');
    await initQuizDeepLink();
});

function initRenderers() {
    const treeEl = document.getElementById('trie-tree');
    if (treeEl) {
        canvas = new TreeCanvas(treeEl, { layout: 'nary', tweenMs: 220 });
    }
}

function bindEventListeners() {
    document.getElementById('btn-mode-play')?.addEventListener('click', () => setMode('play'));
    document.getElementById('btn-mode-learn')?.addEventListener('click', () => setMode('learn'));

    document.getElementById('btn-insert')?.addEventListener('click', onInsertClick);
    document.getElementById('btn-search')?.addEventListener('click', onSearchClick);
    document.getElementById('btn-prefix')?.addEventListener('click', onPrefixClick);
    document.getElementById('btn-clear')?.addEventListener('click', () => clearTree());

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
        ['input-word', onInsertClick],
        ['input-search', onSearchClick]
    ]) {
        document.getElementById(id)?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') handler();
        });
    }

    document.getElementById('input-prefix')?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') onPrefixClick();
    });
    document.getElementById('input-prefix')?.addEventListener('input', onPrefixTyped);

    window.addEventListener('resize', () => canvas?.fitView());
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
        'btn-insert', 'input-word',
        'btn-search', 'input-search',
        'btn-prefix', 'input-prefix',
        'btn-clear', 'btn-mode-play', 'btn-mode-learn',
        'lesson-select'
    ];
    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = disabled;
            el.classList.toggle('disabled-control', disabled);
        }
    });
    document.querySelectorAll('#word-chips .chip').forEach((chip) => {
        chip.disabled = disabled;
    });
}

// --- Errors -----------------------------------------------------------------

function showError(errorObj) {
    const banner = document.getElementById('trie-error-banner');
    const text = document.getElementById('trie-error-text');
    if (!banner || !text) return;
    const msg = typeof errorObj === 'string' ? errorObj : (errorObj?.message || 'Request failed');
    const field = errorObj?.field ? `[${errorObj.field}] ` : '';
    text.textContent = `${field}${msg}`;
    banner.classList.remove('hidden');
}

function clearError() {
    document.getElementById('trie-error-banner')?.classList.add('hidden');
}

// --- Input parsing ----------------------------------------------------------

/**
 * Split on commas/whitespace, lowercase, and validate. Empty prefixes are
 * allowed only when `allowEmpty` is set (prefix autocomplete).
 */
function parseText(raw, { allowEmpty = false, multiple = false } = {}) {
    const text = String(raw ?? '').trim().toLowerCase();
    if (text === '' && allowEmpty) return { values: [''], invalid: [] };
    if (text === '') return { values: [], invalid: [] };

    const tokens = text.replace(/[\[\]\(\)\{\}]/g, ' ').split(/[\s,]+/).filter(Boolean);
    if (!multiple && tokens.length > 1) {
        return { values: [], invalid: tokens };
    }
    const values = [];
    const invalid = [];
    for (const token of tokens) {
        if (!WORD_RE.test(token) || token.length > MAX_WORD_LEN) {
            invalid.push(token);
            continue;
        }
        values.push(token);
    }
    return { values, invalid };
}

// --- Rendering --------------------------------------------------------------

function renderStep(step) {
    if (!step || !step.snapshot) return;
    lastSnapshot = step.snapshot;
    canvas?.render(step.snapshot, step);

    const terminalCount = (step.snapshot.nodes || []).filter((node) => node.terminal).length;
    const compressionEl = document.getElementById('compression-line');
    if (compressionEl && totals.letters > 0) {
        const shared = Math.max(0, totals.letters - Math.max(0, totals.nodes - 1));
        compressionEl.textContent =
            `${totals.letters} letters across ${totals.words} word${totals.words === 1 ? '' : 's'} ` +
            `share ${Math.max(0, totals.nodes - 1)} node${totals.nodes - 1 === 1 ? '' : 's'} (excluding the root); ` +
            `${terminalCount} terminal node${terminalCount === 1 ? '' : 's'}. ` +
            (shared > 0 ? `${shared} letter${shared === 1 ? '' : 's'} would need separate nodes without sharing.` : '');
    }
}

function updateAnnotation(text) {
    const el = document.getElementById('step-annotation');
    if (el) renderGlossaryText(el, text || '');
}

function setTraceMetrics(metrics, totalSteps) {
    totals = {
        nodes: Number(metrics?.nodes) || 1,
        words: Number(metrics?.words) || 0,
        created: Number(metrics?.created) || 0,
        reused: Number(metrics?.reused) || 0,
        letters: Number(metrics?.compression?.letters_total) || Number(metrics?.letters_total) || 0
    };

    const set = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
    };
    set('metric-nodes', totals.nodes);
    set('metric-words', totals.words);
    set('metric-created', totals.created);
    set('metric-reused', totals.reused);
    set('metric-steps', Number(totalSteps) || 0);

    const terminalCount = Array.isArray(lastFinalTree?.nodes)
        ? lastFinalTree.nodes.filter((node) => node.terminal).length
        : 0;
    const compressionEl = document.getElementById('compression-line');
    if (compressionEl) {
        if (totals.words === 0) {
            compressionEl.textContent = 'Letters and nodes will appear here after the first insert.';
        } else {
            const shared = Math.max(0, totals.letters - Math.max(0, totals.nodes - 1));
            compressionEl.textContent =
                `${totals.letters} letters across ${totals.words} word${totals.words === 1 ? '' : 's'} ` +
                `share ${Math.max(0, totals.nodes - 1)} node${totals.nodes - 1 === 1 ? '' : 's'} (excluding the root); ` +
                `${terminalCount} terminal node${terminalCount === 1 ? '' : 's'}. ` +
                (shared > 0 ? `${shared} letter${shared === 1 ? '' : 's'} would need separate nodes without sharing.` : '');
        }
    }
}

function applyResponseMetrics(data, { lastInsert = false } = {}) {
    const metrics = data?.metrics || {};
    lastFinalTree = data?.final_tree || lastFinalTree;
    totals = {
        ...totals,
        nodes: Number(metrics.nodes) || totals.nodes,
        words: Number(metrics.words) || 0,
        letters: Number(metrics.compression?.letters_total) || Number(metrics.letters_total) || totals.letters
    };
    if (lastInsert) {
        totals.created = Number(metrics.created) || 0;
        totals.reused = Number(metrics.reused) || 0;
    }
}

// --- Play-mode actions ------------------------------------------------------

async function onInsertClick() {
    await runAction(async () => {
        const input = document.getElementById('input-word');
        if (!input || !input.value.trim()) return;

        const { values, invalid } = parseText(input.value, { multiple: true });
        if (invalid.length) {
            showError({ message: `Use lowercase letters a-z, 1-${MAX_WORD_LEN} per word: ${invalid.join(', ')}`, field: 'word' });
            return;
        }
        if (values.length === 0) {
            showError({ message: 'Enter at least one word', field: 'word' });
            return;
        }

        const stored = new Set(ops.map((op) => op.word));
        const seen = new Set();
        const duplicate = values.find((word) => stored.has(word) || seen.has(word) || (seen.add(word), false));
        if (duplicate) {
            showError({ message: `Duplicate word: ${duplicate} already exists`, field: 'word' });
            return;
        }
        if (ops.length + values.length > MAX_WORDS) {
            showError({
                message: `A trie op log holds at most ${MAX_WORDS} words; this would reach ${ops.length + values.length}.`,
                field: 'ops'
            });
            return;
        }

        const allSteps = [];
        let added = 0;

        for (const word of values) {
            const res = await window.fetchTrieSteps({
                algorithm: 'trie_insert',
                ops: ops.map((op) => ({ ...op })),
                word
            });
            if (!res.ok) {
                showError(res.error);
                break;
            }
            clearError();
            // Commit only after a 200 response.
            ops.push({ op: 'insert', word });
            added += 1;
            if (Array.isArray(res.data?.steps)) allSteps.push(...res.data.steps);
            applyResponseMetrics(res.data, { lastInsert: true });
        }

        input.value = added > 0 && added === values.length ? '' : input.value;
        if (added === 0) return;

        renderChips();
        setTraceMetrics(totals, allSteps.length);
        playback.load(allSteps);
        canvas?.fitView(true);
        playback.play();
        updateSuggestionsIfIdle();
    });
}

async function onSearchClick() {
    await runAction(async () => {
        const input = document.getElementById('input-search');
        if (!input || !input.value.trim()) return;

        const { values, invalid } = parseText(input.value);
        if (invalid.length || values.length !== 1) {
            showError({ message: `Enter one stored word using a-z only: ${input.value.trim()}`, field: 'word' });
            return;
        }

        const res = await window.fetchTrieSteps({
            algorithm: 'trie_search',
            ops: ops.map((op) => ({ ...op })),
            word: values[0]
        });
        if (!res.ok) {
            showError(res.error);
            return;
        }
        clearError();
        applyResponseMetrics(res.data);
        setTraceMetrics(totals, res.data?.steps?.length || 0);
        playback.load(res.data?.steps || []);
        canvas?.fitView(true);
        playback.play();
    });
}

async function onPrefixClick() {
    await runAction(async () => {
        const input = document.getElementById('input-prefix');
        if (!input) return;
        const prefix = String(input.value || '').trim().toLowerCase();
        if (prefix.length > MAX_WORD_LEN || (prefix && !WORD_RE.test(prefix))) {
            showError({ message: `A prefix uses lowercase a-z letters, at most ${MAX_WORD_LEN}.`, field: 'prefix' });
            return;
        }

        const res = await window.fetchTrieSteps({
            algorithm: 'trie_prefix',
            ops: ops.map((op) => ({ ...op })),
            prefix
        });
        if (!res.ok) {
            showError(res.error);
            return;
        }
        clearError();
        applyResponseMetrics(res.data);
        setTraceMetrics(totals, res.data?.steps?.length || 0);
        playback.load(res.data?.steps || []);
        canvas?.fitView(true);
        playback.play();
        renderSuggestions(prefix, res.data?.metadata?.completions, res.data?.metadata?.truncated);
    });
}

function clearTree(message) {
    playback.load([]);
    ops = [];
    lastSnapshot = null;
    lastFinalTree = null;
    if (suggestTimer !== null) {
        window.clearTimeout(suggestTimer);
        suggestTimer = null;
    }
    latestSuggest(() => Promise.resolve(null));
    clearError();
    totals = { nodes: 1, words: 0, created: 0, reused: 0, letters: 0 };
    setTraceMetrics(totals, 0);

    canvas?.render({ nodes: [], root_id: null });
    renderChips();
    renderSuggestions('', [], false, 'Type a prefix to see completions.');

    const prefixInput = document.getElementById('input-prefix');
    if (prefixInput) prefixInput.value = '';
    updateStepControls();
    updateAnnotation(message || 'Cleared. Insert a word to begin.');
}

// --- Autocomplete preview ---------------------------------------------------

function onPrefixTyped() {
    if (suggestTimer !== null) window.clearTimeout(suggestTimer);
    suggestTimer = window.setTimeout(() => {
        suggestTimer = null;
        updateSuggestionsIfIdle();
    }, 200);
}

function updateSuggestionsIfIdle() {
    const input = document.getElementById('input-prefix');
    if (!input) return;

    if (isBusy) {
        setSuggestionStatus('Suggestions pause while a trace is being requested.');
        return;
    }
    if (playback.state.playing) {
        setSuggestionStatus('Suggestions update when playback stops.');
        return;
    }

    const prefix = String(input.value || '').trim().toLowerCase();
    if (prefix && !WORD_RE.test(prefix)) {
        renderSuggestions(prefix, [], false, 'Prefixes use lowercase a-z letters only.');
        return;
    }
    if (prefix.length > MAX_WORD_LEN) {
        renderSuggestions(prefix, [], false, `Prefixes are at most ${MAX_WORD_LEN} letters.`);
        return;
    }
    if (ops.length === 0) {
        renderSuggestions(prefix, [], false, 'No words stored yet — insert one first.');
        return;
    }
    void runSuggestions(prefix);
}

async function runSuggestions(prefix) {
    const res = await latestSuggest(() => window.fetchTrieSteps({
        algorithm: 'trie_prefix',
        ops: ops.map((op) => ({ ...op })),
        prefix
    }));

    // null means a newer prefix superseded this request.
    if (res === null) return;
    if (!res.ok) {
        setSuggestionStatus(`Autocomplete unavailable: ${res.error?.message || 'request failed'}`);
        return;
    }

    const steps = Array.isArray(res.data?.steps) ? res.data.steps : [];
    const last = steps[steps.length - 1];
    if (last?.snapshot) canvas?.render(last.snapshot, last);

    const completions = res.data?.metadata?.completions || [];
    const truncated = res.data?.metadata?.truncated === true;
    const shown = prefix === '' ? 'Stored words' : `Words starting with '${prefix}'`;
    renderSuggestions(
        prefix,
        completions,
        truncated,
        `${shown}: ${completions.length === 0 ? 'none' : `${completions.length}${truncated ? '+' : ''} found`}. Preview only — the stored words did not change.`
    );
    if (last) updateAnnotation(`Preview: ${last.annotation || ''}`);
}

function renderSuggestions(prefix, completions, truncated, statusText) {
    const list = document.getElementById('suggestion-list');
    const status = document.getElementById('suggestion-status');
    if (status) {
        status.textContent = statusText || (
            prefix === ''
                ? 'Type a prefix to see completions.'
                : `Completions for '${prefix}'.`
        );
    }
    if (!list) return;
    list.textContent = '';

    const words = Array.isArray(completions) ? completions : [];
    for (const word of words) {
        const item = document.createElement('li');
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = word;
        button.setAttribute('aria-label', `Load ${word} into the search box`);
        button.addEventListener('click', () => {
            const searchInput = document.getElementById('input-search');
            if (searchInput) {
                searchInput.value = word;
                searchInput.focus();
            }
            setSuggestionStatus(`Loaded '${word}' into the Search box. Press Search to trace it.`);
        });
        item.appendChild(button);
        list.appendChild(item);
    }

    if (truncated) {
        const note = document.createElement('li');
        note.textContent = 'List truncated to the first 10 completions.';
        note.style.fontSize = '0.75rem';
        note.style.color = '#94a3b8';
        list.appendChild(note);
    }
}

function setSuggestionStatus(text) {
    const status = document.getElementById('suggestion-status');
    if (status) status.textContent = text;
}

function renderChips() {
    const container = document.getElementById('word-chips');
    if (!container) return;
    container.textContent = '';

    if (ops.length === 0) {
        const empty = document.createElement('span');
        empty.className = 'control-hint';
        empty.style.margin = '0';
        empty.textContent = 'No words yet.';
        container.appendChild(empty);
        return;
    }

    ops.forEach((op) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.setAttribute('role', 'listitem');
        chip.setAttribute('aria-label', `Search for ${op.word}`);
        chip.textContent = op.word;
        chip.disabled = isBusy;
        chip.addEventListener('click', () => {
            const input = document.getElementById('input-search');
            if (input) input.value = op.word;
            onSearchClick();
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
        clearTree('Play mode. Insert a word to begin.');
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
 * Resolve anchorType/occurrence checkpoints to an absolute step index.
 * `anchorOffset` defaults to -1, which puts a prediction on the step before
 * the event the checkpoint is about.
 */
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
        console.warn('[Trie] checkpoint anchor not found', checkpoint);
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

async function trieRequestOrThrow(payload) {
    const res = await window.fetchTrieSteps(payload);
    if (!res.ok) {
        throw new Error(res.error?.message || 'Trie trace request failed');
    }
    return res.data;
}

async function buildLessonSteps(lesson) {
    const steps = [];
    const simOps = [];
    let lastData = null;

    for (const action of (Array.isArray(lesson.actions) ? lesson.actions : [])) {
        const start = steps.length;
        let payload;

        if (action.op === 'insert') {
            payload = { algorithm: 'trie_insert', ops: simOps.map((op) => ({ ...op })), word: action.word };
        } else if (action.op === 'search') {
            payload = { algorithm: 'trie_search', ops: simOps.map((op) => ({ ...op })), word: action.word };
        } else if (action.op === 'prefix') {
            payload = { algorithm: 'trie_prefix', ops: simOps.map((op) => ({ ...op })), prefix: action.prefix };
        } else {
            throw new Error(`Unknown trie lesson action: ${action.op}`);
        }

        const data = await trieRequestOrThrow(payload);
        if (Array.isArray(data.steps)) steps.push(...data.steps);
        lastData = data;

        if (action.op === 'insert') {
            simOps.push({ op: 'insert', word: action.word });
        }
    }

    if (lastData) {
        const metrics = lastData.metrics || {};
        lessonTotals.set(lesson.id, {
            nodes: Number(metrics.nodes) || 1,
            words: Number(metrics.words) || 0,
            created: Number(metrics.created) || 0,
            reused: Number(metrics.reused) || 0,
            letters: Number(metrics.compression?.letters_total) || 0
        });
        lastFinalTree = lastData.final_tree || lastFinalTree;
    }

    appendQuizSentinel(lesson, steps);
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
    for (const lesson of TRIE_LESSONS) {
        const option = document.createElement('option');
        option.value = lesson.id;
        option.textContent = lesson.title;
        select.appendChild(option);
    }
    select.value = currentLesson.id;

    select.addEventListener('change', () => {
        const next = TRIE_LESSONS.find((lesson) => lesson.id === select.value);
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
        lastSnapshot = null;
        lastFinalTree = null;
        clearError();
        hideCheckpoint();
        hideQuizPrompt();
        renderLearnPills(currentLesson);
        updateLessonDescription();
        renderChips();
        renderSuggestions('', [], false, 'Autocomplete is available in Play mode.');

        canvas?.render({ nodes: [], root_id: null });

        const state = await lessonRunner.loadLesson(currentLesson, { forceRebuild: true });
        if (state.status === 'error') return;

        const lessonTotalsForCurrent = lessonTotals.get(currentLesson.id);
        if (lessonTotalsForCurrent) setTraceMetrics(lessonTotalsForCurrent, lessonRunner.state.total);
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

    (Array.isArray(lesson?.actions) ? lesson.actions : []).forEach((action, index) => {
        const pill = document.createElement('span');
        pill.className = 'learn-pill' + (index === 0 ? ' pill-active' : '');
        if (action.op === 'insert') pill.textContent = String(action.word);
        else if (action.op === 'search') pill.textContent = `search ${action.word}`;
        else if (action.op === 'prefix') pill.textContent = `prefix ${action.prefix === '' ? '""' : action.prefix}`;
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

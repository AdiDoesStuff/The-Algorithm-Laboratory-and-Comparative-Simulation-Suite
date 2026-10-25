/**
 * bst.js — Controller logic for Unit 1: Binary Trees & BSTs
 * Uses op-log state, PlaybackController, busy gate, stale-response guards, and error banner.
 */

import { TreeCanvas } from './primitives/TreeCanvas.js';
import { PlaybackController } from './engine/PlaybackController.js';
import { LessonRunner } from './engine/LessonRunner.js';
import { BST_LESSONS } from './lessons/bstLessons.js';
import { render as renderQuiz } from './primitives/QuizEngine.js';
import { getQuiz } from './quizzes/index.js';
import { renderGlossaryText } from './shell/glossaryTooltip.js';

let treeCanvas = null;
let compareCanvasA = null;
let compareCanvasB = null;

// --- State Model ---
let ops = [];                // BST mode: list of { op: 'insert'|'delete', value: int }
let binaryArray = [];        // Binary mode: array of numbers and nulls
let currentMode = 'play';    // 'play' | 'learn'
let currentTreeType = 'bst'; // 'bst' | 'binary'
let selectedNodeVal = null;
let selectedNodeId = null;
let isBusy = false;

// Compare Section State
let compareMode = 'mirror';      // 'mirror' | 'identical'
let compareTreeAType = 'bst';    // 'bst' | 'binary'
let compareTreeBType = 'binary'; // 'bst' | 'binary'

// Stale-response sequence guards
const latestClassify = window.createLatest ? window.createLatest() : (fn => (typeof fn === 'function' ? fn() : fn));
const latestHeightDepth = window.createLatest ? window.createLatest() : (fn => (typeof fn === 'function' ? fn() : fn));
const latestCompare = window.createLatest ? window.createLatest() : (fn => (typeof fn === 'function' ? fn() : fn));

// Learn mode is driven by the Phase B2 lesson registry.
let currentLesson = BST_LESSONS[0];
let activeCheckpoint = null;
let pendingLearnReset = false;   // a lesson switch/reset arrived while the busy gate was closed
let checkpointHideTimer = null;  // hides resolved-checkpoint feedback without killing the next one

// Quiz state (B3). At most one quiz is mounted at a time.
let quizController = null;
let quizSource = null;           // 'lesson' | 'deep-link'

const lessonRunner = new LessonRunner({
    buildSteps: buildLessonSteps,
    onStep: (step) => {
        if (treeCanvas && step?.snapshot) {
            treeCanvas.render(step.snapshot, step);
        }
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
            feedback.innerText = correct === true
                ? 'Correct.'
                : (correct === false ? 'Not quite — read the reveal above.' : '');
        }
        // Hide the feedback after a beat, but never hide a newer checkpoint
        // that was opened in the meantime.
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

// Shared PlaybackController
const playback = new PlaybackController({
    onStep: (step) => {
        if (treeCanvas && step?.snapshot) {
            treeCanvas.render(step.snapshot, step);
        }
    },
    onDone: () => {
        updatePlayPauseButton();
        treeCanvas?.fitView(true);
    },
    onAnnotation: (text) => {
        updateAnnotation(text);
    },
    onStateChange: () => {
        updatePlayPauseButton();
        updateLearnControls();
    }
});

// Compare PlaybackController
const comparePlayback = new PlaybackController({
    onStep: (step) => {
        if (step?.snapshot_a && compareCanvasA) {
            compareCanvasA.render(step.snapshot_a, {
                comparing_a: step.comparing_a,
                matched_a: step.matched_a,
                mismatch_a: step.mismatch_a,
                payload: step.payload
            });
        }
        if (step?.snapshot_b && compareCanvasB) {
            compareCanvasB.render(step.snapshot_b, {
                comparing_b: step.comparing_b,
                matched_b: step.matched_b,
                mismatch_b: step.mismatch_b,
                payload: step.payload
            });
        }
    },
    onAnnotation: (text) => {
        const el = document.getElementById('compare-step-annotation');
        if (el) el.innerText = text || '';
    },
    onDone: () => {
        compareCanvasA?.fitView(true);
        compareCanvasB?.fitView(true);
    }
});

window.addEventListener('DOMContentLoaded', async () => {
    initTreeCanvases();
    bindEventListeners();
    initLessonSelector();
    updateUIForMode('play');
    setTreeModel('bst', false); // Avoid double-refresh
    refreshClassification();
    await initQuizDeepLink();
});

function initTreeCanvases() {
    const mainContainer = document.getElementById('tree-container');
    if (mainContainer) {
        treeCanvas = new TreeCanvas(mainContainer, {
            onNodeClick: (nodeId, label) => {
                handleNodeClick(label, nodeId);
            }
        });
    }
    const containerA = document.getElementById('compare-canvas-a');
    if (containerA) {
        compareCanvasA = new TreeCanvas(containerA);
    }
    const containerB = document.getElementById('compare-canvas-b');
    if (containerB) {
        compareCanvasB = new TreeCanvas(containerB);
    }
}

function handleNodeClick(labelStr, nodeId) {
    const val = parseInt(labelStr, 10);
    if (isNaN(val)) return;

    selectedNodeVal = val;
    selectedNodeId = nodeId;

    if (treeCanvas && nodeId !== undefined && nodeId !== null) {
        treeCanvas.highlightSelectedNode(nodeId);
    }

    fetchHeightDepth(val, nodeId);
}

function bindEventListeners() {
    // Mode Switcher
    document.getElementById('btn-mode-play')?.addEventListener('click', () => setMode('play'));
    document.getElementById('btn-mode-learn')?.addEventListener('click', () => setMode('learn'));

    // Tree Model Switcher
    document.getElementById('btn-model-bst')?.addEventListener('click', () => setTreeModel('bst'));
    document.getElementById('btn-model-binary')?.addEventListener('click', () => setTreeModel('binary'));

    // Play Mode Controls
    document.getElementById('btn-insert')?.addEventListener('click', onInsertClick);
    document.getElementById('btn-delete')?.addEventListener('click', onDeleteClick);
    document.getElementById('btn-traverse')?.addEventListener('click', onTraverseClick);
    document.getElementById('btn-clear')?.addEventListener('click', onClearClick);
    document.getElementById('btn-build-array')?.addEventListener('click', onBuildFromArrayClick);

    // Play/Pause Control (toggle)
    const playPauseBtn = document.getElementById('btn-play-pause') || document.getElementById('btn-pause');
    playPauseBtn?.addEventListener('click', togglePlayPause);

    // Speed Slider
    document.getElementById('speed-slider')?.addEventListener('input', (e) => {
        const speedVal = parseFloat(e.target.value) || 1;
        playback.setSpeed(600 / speedVal);
    });

    // Learn Mode Controls
    document.getElementById('btn-learn-prev')?.addEventListener('click', onLearnPrev);
    document.getElementById('btn-learn-next')?.addEventListener('click', onLearnNext);
    document.getElementById('btn-learn-reset')?.addEventListener('click', onLearnReset);
    document.getElementById('btn-lesson-quiz')?.addEventListener('click', onTakeLessonQuiz);
    document.getElementById('btn-checkpoint-reveal')?.addEventListener('click', () => lessonRunner.revealCheckpoint());

    // Compare Mode Controls
    document.getElementById('btn-compare-mode-mirror')?.addEventListener('click', () => setCompareMode('mirror'));
    document.getElementById('btn-compare-mode-identical')?.addEventListener('click', () => setCompareMode('identical'));
    document.getElementById('btn-tree-a-type-bst')?.addEventListener('click', () => setCompareTreeType('a', 'bst'));
    document.getElementById('btn-tree-a-type-binary')?.addEventListener('click', () => setCompareTreeType('a', 'binary'));
    document.getElementById('btn-tree-b-type-bst')?.addEventListener('click', () => setCompareTreeType('b', 'bst'));
    document.getElementById('btn-tree-b-type-binary')?.addEventListener('click', () => setCompareTreeType('b', 'binary'));
    document.getElementById('btn-compare-run')?.addEventListener('click', onCompareRunClick);

    // Enter Key Shortcuts
    document.getElementById('input-insert')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') onInsertClick();
    });
    document.getElementById('input-delete')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') onDeleteClick();
    });
    document.getElementById('input-array-build')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') onBuildFromArrayClick();
    });
}

// --- Busy Gate Wrapper ---

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
        'btn-traverse', 'select-traversal',
        'btn-build-array', 'input-array-build',
        'btn-clear',
        'btn-mode-play', 'btn-mode-learn',
        'btn-model-bst', 'btn-model-binary',
        'btn-compare-run', 'btn-compare-mode-mirror', 'btn-compare-mode-identical',
        'btn-tree-a-type-bst', 'btn-tree-a-type-binary',
        'btn-tree-b-type-bst', 'btn-tree-b-type-binary',
        'input-tree-a', 'input-tree-b',
        'lesson-select'
    ];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = disabled;
            if (disabled) el.classList.add('disabled-control');
            else el.classList.remove('disabled-control');
        }
    });
}

// --- Error Banner Helpers ---

function showError(errorObj) {
    const banner = document.getElementById('tree-error-banner');
    const text = document.getElementById('tree-error-text');
    if (!banner || !text) return;
    const msg = typeof errorObj === 'string' ? errorObj : (errorObj?.message || 'Request failed');
    const field = errorObj?.field ? `[${errorObj.field}] ` : '';
    text.innerText = `${field}${msg}`;
    banner.classList.remove('hidden');
}

function clearError() {
    const banner = document.getElementById('tree-error-banner');
    if (banner) banner.classList.add('hidden');
}

// --- Single Request Builder ---

function buildRequest(algorithm, extra = {}) {
    const req = {
        algorithm,
        tree_type: currentTreeType,
        ...extra
    };
    if (currentTreeType === 'binary') {
        req.array = [...binaryArray];
    } else {
        req.ops = [...ops];
    }
    return req;
}

// --- Lesson step building (Phase B2) ---

/**
 * Flatten a lesson's ops into one step list using the backend trace.
 * Returns { steps, checkpoints, blocks } so LessonRunner can resolve
 * beforeValue/afterValue anchors without re-requesting anything.
 */
async function buildLessonSteps(lesson) {
    const opsList = Array.isArray(lesson.ops)
        ? lesson.ops
        : (Array.isArray(lesson.values)
            ? lesson.values.map(value => ({ op: 'insert', value }))
            : []);

    const steps = [];
    const blocks = [];
    const simOps = [];

    for (const action of opsList) {
        const start = steps.length;

        if (action.op === 'traverse') {
            const order = action.order || 'inorder';
            const res = await window.fetchTreeSteps('bst_traverse', {
                algorithm: 'bst_traverse',
                tree_type: 'bst',
                ops: [...simOps],
                order
            });

            if (!res.ok) {
                throw new Error(
                    res.error?.message ||
                    `Could not build traversal steps for ${order}`
                );
            }

            if (Array.isArray(res.data?.steps)) {
                const visited = [];
                for (const step of res.data.steps) {
                    const node = (step.snapshot?.nodes || [])
                        .find(candidate => candidate.id === (step.highlighted || [])[0]);
                    if (node) visited.push(node.label);
                    steps.push({
                        ...step,
                        traversalOrder: order,
                        traversalSequence: [...visited]
                    });
                }
            }

            blocks.push({ action: { ...action }, start, end: steps.length - 1 });
            continue;
        }

        const algorithm = action.op === 'delete' ? 'bst_delete' : 'bst_insert';
        const extra = action.op === 'delete'
            ? { delete_value: action.value }
            : { new_value: action.value };

        const res = await window.fetchTreeSteps(algorithm, {
            algorithm,
            tree_type: 'bst',
            ops: [...simOps],
            ...extra
        });

        if (!res.ok) {
            throw new Error(
                res.error?.message ||
                `Could not build lesson step for ${action.op} ${action.value}`
            );
        }

        if (Array.isArray(res.data?.steps)) {
            steps.push(...res.data.steps);
        }
        blocks.push({ action: { ...action }, start, end: steps.length - 1 });
        simOps.push({ op: action.op, value: action.value });
    }

    if (lesson.emitQuizPrompt && lesson.quizId) {
        steps.push({
            type: 'quiz_prompt',
            quizId: lesson.quizId,
            annotation: 'Lesson complete. Test yourself to check what stuck.'
        });
    }

    return {
        steps,
        checkpoints: Array.isArray(lesson.checkpoints) ? lesson.checkpoints : [],
        blocks
    };
}

// --- Play / Pause Control ---

function togglePlayPause() {
    if (playback.state.playing) {
        playback.pause();
    } else {
        playback.play();
    }
}

function updatePlayPauseButton() {
    const btn = document.getElementById('btn-play-pause') || document.getElementById('btn-pause');
    if (btn) {
        btn.innerText = playback.state.playing ? 'Pause' : 'Play';
    }
}

// --- Mode & Tree Switchers ---

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
        onClearClick();
    }
}

function updateUIForMode(mode) {
    const playPanel = document.getElementById('play-controls-panel');
    const learnPanel = document.getElementById('learn-controls-panel');
    const playTab = document.getElementById('btn-mode-play');
    const learnTab = document.getElementById('btn-mode-learn');

    if (mode === 'play') {
        playPanel?.classList.remove('hidden');
        learnPanel?.classList.add('hidden');
        playTab?.classList.add('active-tab');
        learnTab?.classList.remove('active-tab');
    } else {
        playPanel?.classList.add('hidden');
        learnPanel?.classList.remove('hidden');
        playTab?.classList.remove('active-tab');
        learnTab?.classList.add('active-tab');
    }
}

function setTreeModel(type, shouldRefresh = true) {
    if (currentTreeType !== type) {
        currentTreeType = type;
        onClearClick();
    }

    const bstBtn = document.getElementById('btn-model-bst');
    const binaryBtn = document.getElementById('btn-model-binary');
    const bstInsertGroup = document.getElementById('bst-insert-group');
    const binaryArrayGroup = document.getElementById('binary-array-group');
    const bstDeleteGroup = document.getElementById('bst-delete-group');

    if (type === 'bst') {
        bstBtn?.classList.add('active-tab');
        binaryBtn?.classList.remove('active-tab');
        bstInsertGroup?.classList.remove('hidden');
        bstDeleteGroup?.classList.remove('hidden');
        binaryArrayGroup?.classList.add('hidden');
    } else {
        binaryBtn?.classList.add('active-tab');
        bstBtn?.classList.remove('active-tab');
        bstInsertGroup?.classList.add('hidden');
        bstDeleteGroup?.classList.add('hidden');
        binaryArrayGroup?.classList.remove('hidden');
    }

    if (shouldRefresh) {
        refreshClassification();
    }
}

// Helper to clean array/list inputs and strip brackets [ ], ( ), { }
function cleanNumberTokens(str) {
    if (!str) return [];
    const cleaned = String(str).replace(/[\[\]\(\)\{\}]/g, ' ');
    return cleaned.split(/[\s,]+/).map(t => t.trim()).filter(t => t.length > 0);
}

// --- Action Handlers ---

async function onInsertClick() {
    await runAction(async () => {
        setTreeModel('bst', false);
        const input = document.getElementById('input-insert');
        if (!input || !input.value.trim()) return;

        const rawStr = input.value.trim();
        const tokens = cleanNumberTokens(rawStr);
        const vals = tokens.map(v => parseInt(v, 10)).filter(v => !isNaN(v));

        if (vals.length === 0) {
            showError({ message: 'Please enter valid integer(s)', field: 'new_value' });
            return;
        }

        input.value = '';
        const allSteps = [];
        let addedCount = 0;

        for (let val of vals) {
            const req = buildRequest('bst_insert', { new_value: val });
            const res = await window.fetchTreeSteps('bst_insert', req);

            if (!res.ok) {
                showError(res.error);
                break; // Stop and do not commit this or subsequent values
            }

            clearError();
            // Commit only after 200 response
            ops.push({ op: 'insert', value: val });
            if (res.data?.steps) {
                allSteps.push(...res.data.steps);
            }
            addedCount++;
        }

        if (allSteps.length > 0) {
            treeCanvas?.fitView(true);
            playback.load(allSteps);
            treeCanvas?.fitView(true);
            playback.play();
            refreshClassification();
        }

        await verifyTreeSync();
    });
}

async function onDeleteClick() {
    await runAction(async () => {
        const input = document.getElementById('input-delete');
        if (!input || !input.value.trim()) return;

        const rawStr = input.value.trim().replace(/[\[\]\(\)\{\}]/g, '').trim();
        const val = parseInt(rawStr, 10);
        if (isNaN(val)) {
            showError({ message: 'Please enter a valid integer to delete', field: 'delete_value' });
            return;
        }

        const req = buildRequest('bst_delete', { delete_value: val });
        const res = await window.fetchTreeSteps('bst_delete', req);
        input.value = '';

        if (!res.ok) {
            showError(res.error);
            return;
        }

        clearError();
        // Commit only after 200 response
        ops.push({ op: 'delete', value: val });

        if (res.data?.steps) {
            treeCanvas?.fitView(true);
            playback.load(res.data.steps);
            treeCanvas?.fitView(true);
            playback.play();
            refreshClassification();

            // Requirement 2.7: Two-child delete sync verification with backend final_tree
            if (res.data.final_tree) {
                const finalNodes = res.data.final_tree.nodes || [];
                const hasDeletedVal = finalNodes.some(n => parseInt(n.label, 10) === val);
                if (hasDeletedVal) {
                    console.warn(`[TreeSync Warning] Deleted value ${val} still found in backend final_tree!`);
                } else {
                    console.debug(`[TreeSync] Verified deletion of ${val}; tree matches final_tree with ${finalNodes.length} nodes.`);
                }
            }

            if (selectedNodeVal === val) {
                selectedNodeVal = null;
                selectedNodeId = null;
                clearHeightDepthPanel();
            }
        }

        await verifyTreeSync();
    });
}

async function onBuildFromArrayClick() {
    await runAction(async () => {
        setTreeModel('binary', false);
        const input = document.getElementById('input-array-build');
        if (!input || !input.value.trim()) return;

        const rawStr = input.value.trim();
        const tokens = cleanNumberTokens(rawStr);
        const arr = tokens.map(t => {
            const clean = t.toLowerCase();
            if (clean === 'null' || clean === 'none' || clean === 'n' || clean === '-' || clean === '') return null;
            const num = parseInt(t, 10);
            return isNaN(num) ? null : num;
        });

        const validArr = arr.filter(v => v !== null);
        if (validArr.length === 0) {
            showError({ message: 'Please enter a valid array (e.g. 10, 5, 15, 2, 7)', field: 'array' });
            return;
        }

        const res = await window.fetchTreeSteps('array_to_tree', {
            algorithm: 'array_to_tree',
            tree_type: 'binary',
            array: arr
        });

        if (!res.ok) {
            showError(res.error);
            return;
        }

        clearError();
        binaryArray = arr;

        if (res.data?.warnings && res.data.warnings.length > 0) {
            updateAnnotation(`Warnings: ${res.data.warnings.join(' | ')}`);
        }

        if (res.data?.steps) {
            treeCanvas?.fitView(true);
            playback.load(res.data.steps);
            treeCanvas?.fitView(true);
            playback.play();
            refreshClassification();
        }
    });
}

async function onTraverseClick() {
    await runAction(async () => {
        const hasData = (currentTreeType === 'binary') ? binaryArray.length > 0 : ops.length > 0;
        if (!hasData) {
            showError({ message: 'Tree is empty! Insert some values first.', field: 'tree' });
            return;
        }

        const select = document.getElementById('select-traversal');
        const order = select ? select.value : 'inorder';

        const req = buildRequest('bst_traverse', { order });
        const res = await window.fetchTreeSteps('bst_traverse', req);

        if (!res.ok) {
            showError(res.error);
            return;
        }

        clearError();
        if (res.data?.steps) {
            // Collect traversal order labels
            const visitedLabels = [];
            res.data.steps.forEach(s => {
                if (s.highlighted && s.highlighted.length > 0) {
                    const nodeObj = s.snapshot?.nodes?.find(n => n.id === s.highlighted[0]);
                    if (nodeObj && nodeObj.label && !visitedLabels.includes(nodeObj.label)) {
                        visitedLabels.push(nodeObj.label);
                    }
                }
            });

            const outputEl = document.getElementById('traversal-output-box');
            if (outputEl) {
                outputEl.classList.remove('hidden');
                outputEl.innerText = `${order.toUpperCase()} Traversal: ${visitedLabels.join(' → ')}`;
            }

            playback.load(res.data.steps);
            playback.play();
        }
    });
}

function onClearClick() {
    playback.cancel();
    ops = [];
    binaryArray = [];
    selectedNodeVal = null;
    selectedNodeId = null;

    clearError();
    if (treeCanvas) {
        treeCanvas.render({ nodes: [], root_id: null });
    }
    const outputEl = document.getElementById('traversal-output-box');
    if (outputEl) outputEl.classList.add('hidden');
    hideCheckpoint();
    hideQuizPrompt();
    updateAnnotation('Tree cleared.');
    refreshClassification();
    clearHeightDepthPanel();
    verifyTreeSync();
}

// --- Classification & Height/Depth Updates with Stale Guard ---

async function refreshClassification() {
    const hasData = (currentTreeType === 'binary') ? binaryArray.length > 0 : ops.length > 0;
    if (!hasData) {
        renderBadges({
            is_full: true, is_complete: true, is_perfect: true, is_balanced: true,
            classification_label: 'Empty Tree', violation_note: null
        });
        return;
    }

    const req = buildRequest('bst_classify');
    const res = await latestClassify(() => window.fetchTreeSteps('bst_classify', req));

    if (res && res.ok && res.data) {
        renderBadges(res.data);
    }
}

function renderBadges(data) {
    const badgesContainer = document.getElementById('classification-badges');
    const noteEl = document.getElementById('violation-note');

    if (!badgesContainer) return;

    const makeBadge = (label, isPass) => `
        <span class="badge-chip ${isPass ? 'badge-pass' : 'badge-fail'}">
            ${isPass ? '✓' : '✗'} ${label}
        </span>
    `;

    badgesContainer.innerHTML = `
        ${makeBadge('Full', data.is_full)}
        ${makeBadge('Complete', data.is_complete)}
        ${makeBadge('Perfect', data.is_perfect)}
        ${makeBadge('Balanced', data.is_balanced)}
    `;

    if (noteEl) {
        noteEl.innerText = data.violation_note ? `Note: ${data.violation_note}` : (data.classification_label ? `Status: ${data.classification_label}` : '');
    }
}

async function fetchHeightDepth(targetVal, nodeId) {
    const extra = {};
    if (nodeId !== undefined && nodeId !== null) {
        extra.target_id = nodeId;
    } else if (targetVal !== undefined && targetVal !== null) {
        extra.target_value = targetVal;
    }

    const req = buildRequest('bst_height_depth', extra);
    const res = await latestHeightDepth(() => window.fetchTreeSteps('bst_height_depth', req));

    if (res && res.ok && res.data) {
        const valEl = document.getElementById('stat-selected-val');
        const heightEl = document.getElementById('stat-height-val');
        const depthEl = document.getElementById('stat-depth-val');

        if (valEl) valEl.innerText = targetVal;
        if (heightEl) heightEl.innerText = res.data.height;
        if (depthEl) depthEl.innerText = res.data.depth;

        // Render selected highlight on canvas using returned snapshot
        if (treeCanvas && res.data.tree) {
            treeCanvas.render(res.data.tree, { selected: [res.data.target_id] });
        }
    } else if (res && !res.ok) {
        clearHeightDepthPanel();
    }
}

function clearHeightDepthPanel() {
    const valEl = document.getElementById('stat-selected-val');
    const heightEl = document.getElementById('stat-height-val');
    const depthEl = document.getElementById('stat-depth-val');

    if (valEl) valEl.innerText = '-';
    if (heightEl) heightEl.innerText = '-';
    if (depthEl) depthEl.innerText = '-';
}

function updateAnnotation(text) {
    const el = document.getElementById('step-annotation');
    if (el) renderGlossaryText(el, text || '');
}

// --- Learn Mode (Phase B2 lesson runner) ---

function initLessonSelector() {
    const select = document.getElementById('lesson-select');
    if (!select) return;

    select.innerHTML = '';
    for (const lesson of BST_LESSONS) {
        const option = document.createElement('option');
        option.value = lesson.id;
        option.textContent = lesson.title;
        select.appendChild(option);
    }
    select.value = currentLesson.id;

    select.addEventListener('change', () => {
        const next = BST_LESSONS.find(lesson => lesson.id === select.value);
        if (!next || next.id === currentLesson.id) return;
        currentLesson = next;
        onLearnReset();
    });

    updateLessonDescription();
}

function updateLessonDescription() {
    const el = document.getElementById('lesson-description');
    if (el) el.innerText = currentLesson?.description || '';
}

async function onLearnReset() {
    // A lesson switch during an in-flight load would otherwise be dropped by the
    // busy gate. Queue it and let runAction drain the queue when the gate opens.
    if (isBusy) {
        pendingLearnReset = true;
        return;
    }

    await runAction(async () => {
        playback.cancel();
        lessonRunner.pause();
        ops = [];
        selectedNodeVal = null;
        selectedNodeId = null;
        activeCheckpoint = null;
        clearError();
        clearHeightDepthPanel();
        hideCheckpoint();
        hideQuizPrompt();
        renderLearnPills(currentLesson);
        updateLessonDescription();

        if (treeCanvas) {
            treeCanvas.render({ nodes: [], root_id: null });
        }

        const state = await lessonRunner.loadLesson(currentLesson);
        if (state.status === 'error') return;

        updateLearnControls();
        treeCanvas?.fitView(true);
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
        nextBtn.disabled = blockedForward ||
            state.total === 0 ||
            state.cursor >= state.total - 1;
    }
}

function renderLearnPills(lesson) {
    const container = document.getElementById('learn-pills-row');
    if (!container) return;

    const opsList = Array.isArray(lesson?.ops)
        ? lesson.ops
        : (Array.isArray(lesson?.values)
            ? lesson.values.map(value => ({ op: 'insert', value }))
            : []);

    const orderLabels = {
        inorder: 'IN',
        preorder: 'PRE',
        postorder: 'POST',
        level: 'LEVEL'
    };
    container.innerHTML = opsList.map((action, idx) => {
        const marker = action.op === 'delete' ? '−' : '';
        const label = action.op === 'traverse'
            ? (orderLabels[action.order] || 'TRAV')
            : `${marker}${action.value}`;
        return `<span class="learn-pill ${idx === 0 ? 'pill-active' : ''}">${label}</span>`;
    }).join('');
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
    if (feedback) feedback.innerText = '';

    if (!choices) return;
    choices.innerHTML = '';

    const hasChoices = Array.isArray(checkpoint.choices) && checkpoint.choices.length > 0;
    if (hasChoices) {
        checkpoint.choices.forEach((label, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.innerText = label;
            button.addEventListener('click', () => lessonRunner.answerCheckpoint(index));
            choices.appendChild(button);
        });
        if (revealBtn) revealBtn.classList.add('hidden');
    } else if (revealBtn) {
        revealBtn.classList.remove('hidden');
    }
}

function hideCheckpoint() {
    document.getElementById('checkpoint-panel')?.classList.add('hidden');
}

// --- Quiz wiring (Phase B3) ---

function readProgressStore() {
    const progress = window.AlgoLabProgress;
    return progress && typeof progress.recordAttempt === 'function' ? progress : null;
}

function onTakeLessonQuiz() {
    const quizId = lessonRunner.currentLesson?.quizId || currentLesson?.quizId;
    if (!quizId) return;
    openQuiz(quizId, 'lesson');
}

/**
 * Resolve a quiz through the registry and mount a fresh QuizEngine.
 * An unknown id surfaces in the page's error banner instead of breaking.
 */
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

/**
 * Leave a quiz without recording anything new.
 * Lesson quizzes step back off the sentinel; deep links return to the hub.
 */
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

/**
 * `bst.html?quiz=<id>` mounts that quiz directly, without playing the lesson.
 * Unknown ids show the banner error and leave a usable Learn panel behind.
 */
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


// --- Compare Section Controller & Tree-Sync Verification ---

function setCompareMode(mode) {
    if (compareMode === mode) return;
    compareMode = mode;
    document.getElementById('btn-compare-mode-mirror')?.classList.toggle('active-tab', mode === 'mirror');
    document.getElementById('btn-compare-mode-identical')?.classList.toggle('active-tab', mode === 'identical');
}

function setCompareTreeType(which, type) {
    if (which === 'a') {
        compareTreeAType = type;
        document.getElementById('btn-tree-a-type-bst')?.classList.toggle('active-tab', type === 'bst');
        document.getElementById('btn-tree-a-type-binary')?.classList.toggle('active-tab', type === 'binary');
    } else {
        compareTreeBType = type;
        document.getElementById('btn-tree-b-type-bst')?.classList.toggle('active-tab', type === 'bst');
        document.getElementById('btn-tree-b-type-binary')?.classList.toggle('active-tab', type === 'binary');
    }
}

function parseTreeSpecInput(rawText, treeType) {
    const rawTokens = cleanNumberTokens(rawText);
    if (treeType === 'binary') {
        const arr = rawTokens.map(t => {
            const lower = t.toLowerCase();
            if (lower === 'null' || lower === 'none' || lower === 'n' || lower === '-') {
                return null;
            }
            const n = parseInt(t, 10);
            return isNaN(n) ? null : n;
        });
        return { tree_type: 'binary', array: arr };
    } else {
        const vals = rawTokens.map(t => parseInt(t, 10)).filter(n => !isNaN(n));
        const treeOps = vals.map(v => ({ op: 'insert', value: v }));
        return { tree_type: 'bst', ops: treeOps };
    }
}

async function onCompareRunClick() {
    await runAction(async () => {
        const inputA = document.getElementById('input-tree-a');
        const inputB = document.getElementById('input-tree-b');
        const banner = document.getElementById('compare-verdict-banner');

        const specA = parseTreeSpecInput(inputA?.value || '', compareTreeAType);
        const specB = parseTreeSpecInput(inputB?.value || '', compareTreeBType);

        const payload = {
            algorithm: 'bst_mirror',
            mode: compareMode,
            tree_a: specA,
            tree_b: specB
        };

        const res = await latestCompare(() => window.fetchTreeSteps('bst_mirror', payload));
        if (!res) return;

        if (!res.ok) {
            showError(res.error);
            if (banner) banner.classList.add('hidden');
            return;
        }

        clearError();

        // Render final trees initially
        if (res.data?.final_tree_a && compareCanvasA) {
            compareCanvasA.render(res.data.final_tree_a);
            compareCanvasA.fitView(true);
        }
        if (res.data?.final_tree_b && compareCanvasB) {
            compareCanvasB.render(res.data.final_tree_b);
            compareCanvasB.fitView(true);
        }

        // Show verdict banner
        if (banner && res.data?.verdict) {
            banner.classList.remove('hidden');
            const verdict = res.data.verdict;
            if (verdict.is_match) {
                banner.style.background = 'rgba(16, 185, 129, 0.2)';
                banner.style.border = '1px solid #10b981';
                banner.style.color = '#6ee7b7';
                banner.innerText = `✓ Verdict: Trees are a valid ${compareMode} match!`;
            } else {
                banner.style.background = 'rgba(239, 68, 68, 0.2)';
                banner.style.border = '1px solid #ef4444';
                banner.style.color = '#fca5a5';
                const reason = verdict.first_mismatch?.reason ? `: ${verdict.first_mismatch.reason}` : '';
                banner.innerText = `✗ Verdict: Structural mismatch found${reason}`;
            }
        }

        // Step-by-step playback
        if (res.data?.steps && res.data.steps.length > 0) {
            comparePlayback.load(res.data.steps);
            comparePlayback.play();
        }
    });
}


// --- Dev-Only Tree-Sync Assertion (window.ALGOLAB_DEBUG, default false) ---
if (typeof window.ALGOLAB_DEBUG === 'undefined') {
    window.ALGOLAB_DEBUG = false;
}

async function verifyTreeSync() {
    if (!window.ALGOLAB_DEBUG) return;
    if (currentTreeType !== 'bst') return;

    try {
        const res = await window.fetchTreeSteps('bst_classify', {
            algorithm: 'bst_classify',
            tree_type: 'bst',
            ops: [...ops]
        });
        if (!res || !res.ok || !res.data?.tree) return;

        const replayedNodes = res.data.tree.nodes || [];
        const screenNodes = treeCanvas?.lastRawSnapshot?.nodes || [];

        const replayedMap = new Map(replayedNodes.map(n => [n.id, String(n.label)]));
        const screenMap = new Map(screenNodes.map(n => [n.id, String(n.label)]));

        const diffs = [];
        for (const [id, label] of replayedMap) {
            if (!screenMap.has(id)) {
                diffs.push(`Node id=${id} (label=${label}) is in replayed tree but missing from screen`);
            } else if (screenMap.get(id) !== label) {
                diffs.push(`Node id=${id} label mismatch: server=${label}, screen=${screenMap.get(id)}`);
            }
        }
        for (const [id, label] of screenMap) {
            if (!replayedMap.has(id)) {
                diffs.push(`Node id=${id} (label=${label}) on screen but missing from server replay`);
            }
        }

        if (diffs.length > 0) {
            console.warn('[TreeSync Mismatch Detected]', {
                diffs,
                serverNodes: replayedNodes,
                screenNodes: screenNodes,
                localOps: [...ops]
            });
        } else {
            console.debug(`[TreeSync OK] Screen matches replayed ops (${replayedNodes.length} nodes).`);
        }
    } catch (err) {
        console.warn('[TreeSync Check Error]', err);
    }
}

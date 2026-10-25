/**
 * bst.js — Controller logic for Unit 1: Binary Trees & BSTs
 */

import { TreeCanvas } from './primitives/TreeCanvas.js';

let treeCanvas = null;

let insertedValues = [];
let learnSequence = [50, 30, 70, 20, 40, 60, 80];
let learnStepIndex = 0;
let learnSteps = [];
let currentMode = 'play'; // 'play' | 'learn'
let currentTreeType = 'bst'; // 'bst' | 'binary'
let selectedNodeVal = null;

window.addEventListener('DOMContentLoaded', () => {
    initTreeCanvases();
    bindEventListeners();
    updateUIForMode('play');
    setTreeModel('bst');
    refreshClassification();
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
}

function handleNodeClick(labelStr, nodeId) {
    const val = parseInt(labelStr, 10);
    if (isNaN(val)) return;

    selectedNodeVal = val;

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

    // Learn Mode Step Controls
    document.getElementById('btn-learn-prev')?.addEventListener('click', onLearnPrev);
    document.getElementById('btn-learn-next')?.addEventListener('click', onLearnNext);
    document.getElementById('btn-learn-reset')?.addEventListener('click', onLearnReset);

    // Playback Controls
    document.getElementById('btn-pause')?.addEventListener('click', () => {
        if (!treeCanvas) return;
        treeCanvas.isPaused = !treeCanvas.isPaused;
        const btn = document.getElementById('btn-pause');
        if (btn) btn.innerText = treeCanvas.isPaused ? 'Resume' : 'Pause';
    });

    // Enter key shortcuts
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

function setMode(mode) {
    currentMode = mode;
    updateUIForMode(mode);
    if (mode === 'learn') {
        onLearnReset();
    } else {
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

function setTreeModel(type) {
    if (currentTreeType !== type) {
        currentTreeType = type;
        onClearClick();
    } else {
        currentTreeType = type;
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

    refreshClassification();
}

// --- Play Mode Actions ---

async function onInsertClick() {
    setTreeModel('bst');
    const input = document.getElementById('input-insert');
    if (!input || !input.value.trim()) return;

    const rawStr = input.value.trim();
    const vals = rawStr.split(/[\s,]+/).map(v => parseInt(v, 10)).filter(v => !isNaN(v));

    if (vals.length === 0) {
        showToast('Please enter valid integer(s)', 'error');
        return;
    }

    input.value = '';
    const allSteps = [];
    let currentHistory = [...insertedValues];
    let addedCount = 0;

    for (let val of vals) {
        if (currentHistory.includes(val)) {
            showToast(`Skipped duplicate value: ${val}`, 'warning');
            continue;
        }

        const payload = {
            algorithm: 'bst_insert',
            values: currentHistory,
            new_value: val
        };

        const res = await fetchTreeSteps('bst_insert', payload);
        if (res && res.steps) {
            allSteps.push(...res.steps);
            currentHistory.push(val);
            addedCount++;
        }
    }

    if (allSteps.length > 0) {
        insertedValues = currentHistory;
        updateAnnotation(allSteps[allSteps.length - 1]?.annotation || `Inserted ${addedCount} value(s)`);

        const speedVal = parseFloat(document.getElementById('speed-slider')?.value || 1);
        const delayMs = 600 / speedVal;

        await treeCanvas.animateSteps(allSteps, delayMs);
        refreshClassification();
    }
}

async function onBuildFromArrayClick() {
    setTreeModel('binary');
    const input = document.getElementById('input-array-build');
    if (!input || !input.value.trim()) return;

    const rawStr = input.value.trim();
    const tokens = rawStr.replace(/[\[\]]/g, '').split(/[\s,]+/);
    const arr = tokens.map(t => {
        const clean = t.trim().toLowerCase();
        if (clean === 'null' || clean === 'none' || clean === '') return null;
        const num = parseInt(t, 10);
        return isNaN(num) ? null : num;
    });

    const validArr = arr.filter(v => v !== null);
    if (validArr.length === 0) {
        showToast('Please enter a valid array (e.g. 10, 5, 15, 2, 7)', 'error');
        return;
    }

    const res = await fetchTreeSteps('array_to_tree', {
        algorithm: 'array_to_tree',
        array: arr
    });

    if (res && res.steps) {
        insertedValues = arr;
        updateAnnotation(res.steps[res.steps.length - 1]?.annotation || 'Built binary tree from array');

        const speedVal = parseFloat(document.getElementById('speed-slider')?.value || 1);
        const delayMs = 600 / speedVal;

        await treeCanvas.animateSteps(res.steps, delayMs);
        refreshClassification();
    }
}

async function onDeleteClick() {
    const input = document.getElementById('input-delete');
    if (!input || !input.value.trim()) return;

    const val = parseInt(input.value.trim(), 10);
    if (isNaN(val)) {
        showToast('Please enter a valid integer', 'error');
        return;
    }

    if (!insertedValues.includes(val)) {
        showToast(`Value ${val} not found in the BST`, 'error');
        return;
    }

    const payload = {
        algorithm: 'bst_delete',
        values: insertedValues,
        delete_value: val
    };

    const res = await fetchTreeSteps('bst_delete', payload);
    input.value = '';

    if (res && res.steps) {
        insertedValues = insertedValues.filter(v => v !== val);
        updateAnnotation(res.steps[res.steps.length - 1]?.annotation || `Deleted ${val}`);
        
        const speedVal = parseFloat(document.getElementById('speed-slider')?.value || 1);
        const delayMs = 600 / speedVal;
        
        await treeCanvas.animateSteps(res.steps, delayMs);
        refreshClassification();
        
        if (selectedNodeVal === val) {
            selectedNodeVal = null;
            clearHeightDepthPanel();
        }
    }
}

async function onTraverseClick() {
    if (insertedValues.length === 0 || !insertedValues.some(v => v !== null)) {
        showToast('Tree is empty! Insert some values first.', 'warning');
        return;
    }

    const select = document.getElementById('select-traversal');
    const order = select ? select.value : 'inorder';

    const payload = {
        algorithm: 'bst_traverse',
        values: insertedValues,
        order: order
    };

    const res = await fetchTreeSteps('bst_traverse', payload);

    if (res && res.steps) {
        const speedVal = parseFloat(document.getElementById('speed-slider')?.value || 1);
        const delayMs = 600 / speedVal;

        // Collect traversal order labels
        const visitedLabels = [];
        res.steps.forEach(s => {
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

        // Listen to step updates for narration
        for (let s of res.steps) {
            updateAnnotation(s.annotation);
        }
        await treeCanvas.animateSteps(res.steps, delayMs);
    }
}

function onClearClick() {
    insertedValues = [];
    selectedNodeVal = null;
    if (treeCanvas) {
        treeCanvas.render({ nodes: [], root_id: null });
    }
    const outputEl = document.getElementById('traversal-output-box');
    if (outputEl) outputEl.classList.add('hidden');
    updateAnnotation('Tree cleared.');
    refreshClassification();
    clearHeightDepthPanel();
}

// --- Classification & Height/Depth Updates ---

async function refreshClassification() {
    if (insertedValues.length === 0 || !insertedValues.some(v => v !== null)) {
        renderBadges({
            is_full: true, is_complete: true, is_perfect: true, is_balanced: true,
            classification_label: 'Empty Tree', violation_note: null
        });
        return;
    }

    const res = await fetchTreeSteps('bst_classify', {
        algorithm: 'bst_classify',
        values: insertedValues,
        tree_type: currentTreeType
    });

    if (res) {
        renderBadges(res);
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

function getCurrentTreeValues() {
    if (insertedValues && insertedValues.length > 0) {
        return insertedValues;
    }
    if (currentMode === 'learn') {
        const snap = treeCanvas?.lastRawSnapshot;
        if (snap && Array.isArray(snap.nodes)) {
            const vals = snap.nodes.map(n => parseInt(n.label, 10)).filter(v => !isNaN(v));
            if (vals.length > 0) return vals;
        }
        return learnSequence.slice(0, learnStepIndex + 1);
    }
    const snap = treeCanvas?.lastRawSnapshot;
    if (snap && Array.isArray(snap.nodes)) {
        const vals = snap.nodes.map(n => parseInt(n.label, 10)).filter(v => !isNaN(v));
        if (vals.length > 0) return vals;
    }
    return [];
}

async function fetchHeightDepth(targetVal, nodeId) {
    const treeVals = getCurrentTreeValues();
    const payload = {
        algorithm: 'bst_height_depth',
        values: treeVals,
        target_value: targetVal,
        tree_type: currentTreeType
    };
    if (nodeId !== undefined && nodeId !== null) {
        payload.target_id = nodeId;
    }

    const res = await fetchTreeSteps('bst_height_depth', payload);

    if (res && res.target_id !== null && res.target_id !== undefined) {
        const valEl = document.getElementById('stat-selected-val');
        const heightEl = document.getElementById('stat-height-val');
        const depthEl = document.getElementById('stat-depth-val');

        if (valEl) valEl.innerText = targetVal;
        if (heightEl) heightEl.innerText = res.height;
        if (depthEl) depthEl.innerText = res.depth;

        // Render selected highlight on canvas using returned snapshot
        const currentSnapshot = res.tree;
        if (treeCanvas && currentSnapshot) {
            treeCanvas.render(currentSnapshot, { selected: [res.target_id] });
        }
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
    if (el) el.innerText = text || '';
}

// --- Learn Mode Execution ---

async function onLearnReset() {
    insertedValues = [];
    learnStepIndex = 0;
    learnSteps = [];

    // Pre-generate all insertion steps for learnSequence
    let accum = [];
    for (let val of learnSequence) {
        const payload = {
            algorithm: 'bst_insert',
            values: accum,
            new_value: val
        };
        const res = await fetchTreeSteps('bst_insert', payload);
        if (res && res.steps) {
            learnSteps.push(...res.steps);
        }
        accum.push(val);
    }

    renderLearnPills();
    updateLearnControls();

    if (learnSteps.length > 0) {
        treeCanvas.currentSteps = learnSteps;
        treeCanvas.seek(0);
        updateAnnotation(learnSteps[0].annotation);
    } else {
        treeCanvas.render({ nodes: [], root_id: null });
        updateAnnotation('Learn mode ready. Click Next to begin.');
    }
}

function onLearnNext() {
    if (learnStepIndex < learnSteps.length - 1) {
        learnStepIndex++;
        treeCanvas.seek(learnStepIndex);
        updateAnnotation(learnSteps[learnStepIndex].annotation);
        updateLearnControls();
    }
}

function onLearnPrev() {
    if (learnStepIndex > 0) {
        learnStepIndex--;
        treeCanvas.seek(learnStepIndex);
        updateAnnotation(learnSteps[learnStepIndex].annotation);
        updateLearnControls();
    }
}

function updateLearnControls() {
    const prevBtn = document.getElementById('btn-learn-prev');
    const nextBtn = document.getElementById('btn-learn-next');

    if (prevBtn) prevBtn.disabled = (learnStepIndex <= 0);
    if (nextBtn) nextBtn.disabled = (learnStepIndex >= learnSteps.length - 1);
}

function renderLearnPills() {
    const container = document.getElementById('learn-pills-row');
    if (!container) return;

    container.innerHTML = learnSequence.map((val, idx) => `
        <span class="learn-pill ${idx === 0 ? 'pill-active' : ''}">${val}</span>
    `).join('');
}

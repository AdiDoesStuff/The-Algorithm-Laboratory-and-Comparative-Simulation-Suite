import { BucketGrid } from './primitives/BucketGrid.js';
import { PlaybackController } from './engine/PlaybackController.js';

let grid = null;
let controller = null;
let steps = [];

const algoSelect = document.getElementById('algo-select');
const itemsInput = document.getElementById('items-input');
const capacityInput = document.getElementById('capacity-input');
const btnRun = document.getElementById('btn-run');
const runStatus = document.getElementById('run-status');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnPlay = document.getElementById('btn-play');
const btnSkip = document.getElementById('btn-skip');
const stepCounter = document.getElementById('step-counter');
const annotationEl = document.getElementById('step-annotation');
const errorBanner = document.getElementById('ks-error-banner');
const errorText = document.getElementById('ks-error-text');
const resultReadout = document.getElementById('result-readout');

function showError(msg) {
    errorText.textContent = msg;
    errorBanner.classList.remove('hidden');
}
function clearError() { errorBanner.classList.add('hidden'); }

function parseItems(str) {
    return str.trim().split(/\s+/).map(pair => {
        const [w, v] = pair.split(',').map(Number);
        return { weight: w, value: v };
    }).filter(it => !isNaN(it.weight) && !isNaN(it.value));
}

async function run() {
    clearError();
    const algorithm = algoSelect.value;
    const items = parseItems(itemsInput.value);
    const capacity = parseInt(capacityInput.value, 10);

    if (items.length === 0) { showError('Enter at least one item as "weight,value".'); return; }
    if (isNaN(capacity) || capacity < 1) { showError('Capacity must be >= 1.'); return; }

    runStatus.textContent = 'Running…';
    btnRun.disabled = true;
    try {
        const res = await fetch('/knapsack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ algorithm, items, capacity })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        steps = data.steps || [];
        grid = new BucketGrid(document.getElementById('dp-table'), {});
        controller = new PlaybackController({
            onStep: (step, idx) => {
                const snap = step.snapshot || {};
                if (snap.rows && snap.cols) {
                    grid.render(snap, step);
                }
                stepCounter.textContent = `Step ${idx + 1} of ${steps.length}`;
                annotationEl.textContent = step.annotation || '';
                if (step.type === 'dp_done' || step.type === 'traceback_done') {
                    const fs = data.final_state || {};
                    if (fs.value !== undefined) {
                        resultReadout.textContent = `Value: ${fs.value}, Weight: ${fs.weight}, Items: [${(fs.items||[]).join(', ')}]`;
                    }
                }
            },
            onAnnotation: (a) => { annotationEl.textContent = a; }
        });
        controller.load(steps);
        runStatus.textContent = `Loaded ${steps.length} steps.`;
    } catch (e) {
        showError(e.message);
        runStatus.textContent = 'Failed.';
    } finally {
        btnRun.disabled = false;
    }
}

btnRun.addEventListener('click', run);
btnPrev.addEventListener('click', () => controller && controller.prev());
btnNext.addEventListener('click', () => controller && controller.next());
btnPlay.addEventListener('click', () => { if (!controller) return; if (controller.state.playing) { controller.pause(); btnPlay.textContent = 'Play'; } else { controller.play(); btnPlay.textContent = 'Pause'; } });
btnSkip.addEventListener('click', () => { if (controller && steps.length) controller.seek(steps.length - 1); });
import { BucketGrid } from './primitives/BucketGrid.js';
import { PlaybackController } from './engine/PlaybackController.js';

let n = 4;
let mode = 'first';
let grid = null;
let controller = null;
let steps = [];
let solutions = [];

const nSelect = document.getElementById('n-select');
const btnModeFirst = document.getElementById('btn-mode-first');
const btnModeAll = document.getElementById('btn-mode-all');
const btnRun = document.getElementById('btn-run');
const runStatus = document.getElementById('run-status');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnPlay = document.getElementById('btn-play');
const btnSkip = document.getElementById('btn-skip');
const stepCounter = document.getElementById('step-counter');
const countersEl = document.getElementById('counters');
const stackEl = document.getElementById('stack-readout');
const annotationEl = document.getElementById('step-annotation');
const errorBanner = document.getElementById('nq-error-banner');
const errorText = document.getElementById('nq-error-text');
const solutionsCard = document.getElementById('solutions-card');
const solutionsGallery = document.getElementById('solutions-gallery');

function showError(msg) {
    errorText.textContent = msg;
    errorBanner.classList.remove('hidden');
}
function clearError() { errorBanner.classList.add('hidden'); }

function updateCounters(step) {
    if (step && step.type === 'nqueens_done') {
        countersEl.textContent = `trials:${step.trials} placements:${step.placements} backtracks:${step.backtracks} solutions:${(step.solutions||[]).length}`;
        solutions = step.solutions || [];
        renderGallery();
    }
}

function updateStack(step) {
    const snap = step && step.snapshot;
    const queens = (snap && snap.queens) ? snap.queens : [];
    if (queens.length === 0) { stackEl.textContent = '—'; return; }
    stackEl.textContent = `rows 0–${queens.length - 1} filled: columns ${queens.join(', ')}`;
}

function renderGallery() {
    if (!solutions || solutions.length === 0) { solutionsCard.classList.add('hidden'); return; }
    solutionsCard.classList.remove('hidden');
    solutionsGallery.innerHTML = '';
    solutions.forEach((sol, i) => {
        const mini = document.createElement('div');
        mini.style.cssText = 'display:inline-block;margin:6px;padding:4px;border:1px solid #334155;border-radius:6px;cursor:pointer;';
        mini.textContent = `${i + 1}: [${sol.join(',')}]`;
        mini.addEventListener('click', () => {
            // show board for this solution
            const fake = { snapshot: { n: n, queens: sol, row: n }, type: 'solution' };
            grid.render(fake.snapshot, { queen: sol.map((c, r) => r * n + c) });
        });
        solutionsGallery.appendChild(mini);
    });
}

async function run() {
    clearError();
    n = parseInt(nSelect.value, 10);
    runStatus.textContent = mode === 'all' && n === 8 ? 'Building trace…' : 'Running…';
    btnRun.disabled = true;
    try {
        const res = await fetch('/nqueens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ n, mode })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        steps = data.steps || [];
        solutions = (data.final_state && data.final_state.solutions) || [];
        grid = new BucketGrid(document.getElementById('board'), {});
        controller = new PlaybackController({
            onStep: (step, idx) => {
                grid.render(step.snapshot, step);
                stepCounter.textContent = `Step ${idx + 1} of ${steps.length}`;
                annotationEl.textContent = step.annotation || '';
                updateCounters(step);
                updateStack(step);
            },
            onAnnotation: (a) => { annotationEl.textContent = a; }
        });
        controller.load(steps);
        runStatus.textContent = `Loaded ${steps.length} steps, ${solutions.length} solution(s).`;
    } catch (e) {
        showError(e.message);
        runStatus.textContent = 'Failed.';
    } finally {
        btnRun.disabled = false;
    }
}

btnRun.addEventListener('click', run);
nSelect.addEventListener('change', () => { n = parseInt(nSelect.value, 10); });
btnModeFirst.addEventListener('click', () => { mode = 'first'; btnModeFirst.classList.add('active-tab'); btnModeAll.classList.remove('active-tab'); });
btnModeAll.addEventListener('click', () => { mode = 'all'; btnModeAll.classList.add('active-tab'); btnModeFirst.classList.remove('active-tab'); });
btnPrev.addEventListener('click', () => controller && controller.prev());
btnNext.addEventListener('click', () => controller && controller.next());
btnPlay.addEventListener('click', () => { if (!controller) return; if (controller.state.playing) { controller.pause(); btnPlay.textContent = 'Play'; } else { controller.play(); btnPlay.textContent = 'Pause'; } });
btnSkip.addEventListener('click', () => { if (controller && steps.length) controller.seek(steps.length - 1); });

// deep link quiz
const params = new URLSearchParams(location.search);
if (params.get('quiz')) {
    // banner handled by QuizEngine if present; minimal: alert
    console.log('quiz deep link:', params.get('quiz'));
}

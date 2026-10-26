/* Legacy stub retained below for recovery context; the live controller follows.\nimport { BucketGrid } from './primitives/BucketGrid.js';
import { PlaybackController } from './engine/PlaybackController.js';

let algorithm = 'merge_sort';
let grid = null;
let controller = null;
let steps = [];

const btnMerge = document.getElementById('btn-merge');
const btnQuick = document.getElementById('btn-quick');
const btnFibonacci = document.getElementById('btn-fibonacci');
const inputSize = document.getElementById('input-size');
const inputType = document.getElementById('input-type');
const btnRun = document.getElementById('btn-run');
const runStatus = document.getElementById('run-status');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnPlay = document.getElementById('btn-play');
const btnSkip = document.getElementById('btn-skip');
const stepCounter = document.getElementById('step-counter');
const annotationEl = document.getElementById('step-annotation');
const errorBanner = document.getElementById('recursion-error-banner');
const errorText = document.getElementById('recursion-error-text');

function showError(msg) {
    errorText.textContent = msg;
    errorBanner.classList.remove('hidden');
}
function clearError() { errorBanner.classList.add('hidden'); }

async function run() {
    clearError();
    runStatus.textContent = 'Running recursion tree...';
    btnRun.disabled = true;

    const size = parseInt(inputSize.value, 10) || 8;
    const kind = inputType.value || 'random';
    let payload = { algorithm };

    if (algorithm === 'fib_naive' || algorithm === 'fib_memo') {
        payload.n = size > 10 ? 8 : size;
    } else {
        // generate array
        let arr = [];
        if (kind === 'sorted') {
            arr = Array.from({length: size}, (_, i) => i + 1);
        } else if (kind === 'reversed') {
            arr = Array.from({length: size}, (_, i) => size - i);
        } else {
            arr = Array.from({length: size}, () => Math.floor(Math.random() * 100));
        }
        payload.array = arr;
    }

    try {
        const res = await fetch('/recursion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        steps = data.steps || [];
        grid = new BucketGrid(document.getElementById('recursion-tree'), {});
        controller = new PlaybackController({
            onStep: (step, idx) => {
                const snap = step.snapshot || {};
                // render array or node info as matrix/grid format
                const arr = snap.array || (snap.n !== undefined ? [snap.n] : []);
                grid.render({ rows: 1, cols: Math.max(1, arr.length), cells: arr.map(v => ({ value: v, role: snap.role || 'filled' })) }, step);
                stepCounter.textContent = `Step ${idx + 1} of ${steps.length}`;
                annotationEl.textContent = step.annotation || '';
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

btnMerge.addEventListener('click', () => { algorithm = 'merge_sort'; btnMerge.classList.add('active-tab'); btnQuick.classList.remove('active-tab'); btnFibonacci.classList.remove('active-tab'); });
btnQuick.addEventListener('click', () => { algorithm = 'quick_sort'; btnQuick.classList.add('active-tab'); btnMerge.classList.remove('active-tab'); btnFibonacci.classList.remove('active-tab'); });
btnFibonacci.addEventListener('click', () => { algorithm = 'fib_naive'; btnFibonacci.classList.add('active-tab'); btnMerge.classList.remove('active-tab'); btnQuick.classList.remove('active-tab'); });

btnPrev.addEventListener('click', () => controller && controller.prev());
btnNext.addEventListener('click', () => controller && controller.next());
btnPlay.addEventListener('click', () => { if (!controller) return; if (controller.state.playing) { controller.pause(); btnPlay.textContent = 'Play'; } else { controller.play(); btnPlay.textContent = 'Pause'; } });
btnSkip.addEventListener('click', () => { if (controller && steps.length) controller.seek(steps.length - 1); });

// update units.js to mark growth unit as live
console.log("Growth page controller loaded.");
*/

import { TreeCanvas } from './primitives/TreeCanvas.js';
import { PlaybackController } from './engine/PlaybackController.js';
import { GrowthChart } from './primitives/GrowthChart.js';
import { getQuiz } from './quizzes/index.js';
import { render as renderQuiz } from './primitives/QuizEngine.js';

let mode = 'curves', trace = [], collapsed = new Set(), activeSnapshot = null;
const chart = new GrowthChart(document.getElementById('growth-chart'));
const canvas = new TreeCanvas(document.getElementById('growth-tree-canvas'), { onNodeClick: (id) => { collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); renderTree(activeSnapshot); } });
const player = new PlaybackController({
  onStep(step, index) { renderStep(step, index); },
  onAnnotation(text) { document.getElementById('growth-annotation').textContent = text || ''; },
  onStateChange(state) { document.getElementById('growth-step').textContent = state.total ? `Step ${state.cursor + 1} of ${state.total}` : 'No trace loaded.'; document.getElementById('growth-play').textContent = state.playing ? 'Pause' : 'Play'; }
});

function error(message = '') { const el = document.getElementById('growth-error'); el.textContent = message; el.classList.toggle('hidden', !message); }
function apiError(data, response) { return data?.error || `Request failed (${response.status})`; }
function selectMode(next) {
  mode = next;
  ['curves','tree','learn'].forEach((name) => document.getElementById(`growth-${name}`).classList.toggle('active-tab', name === next));
  document.getElementById('curve-controls').classList.toggle('hidden', next !== 'curves');
  document.getElementById('tree-controls').classList.toggle('hidden', next !== 'tree');
  document.getElementById('learn-controls').classList.toggle('hidden', next !== 'learn');
  document.getElementById('growth-chart-panel').classList.toggle('hidden', next === 'tree');
  document.getElementById('growth-tree-panel').classList.toggle('hidden', next !== 'tree');
}
function visibleSnapshot(snapshot) {
  if (!snapshot?.nodes?.length || !collapsed.size) return snapshot;
  const byParent = new Map(); snapshot.nodes.forEach(n => { if (n.parent_id != null) (byParent.get(n.parent_id) || byParent.set(n.parent_id, []).get(n.parent_id)).push(n.id); });
  const hidden = new Set(); const descendants = (id) => { for (const child of byParent.get(id) || []) { hidden.add(child); descendants(child); } };
  collapsed.forEach(descendants);
  return { ...snapshot, nodes: snapshot.nodes.filter(n => !hidden.has(n.id)).map(n => collapsed.has(n.id) ? { ...n, sublabel: `+${[...hidden].filter(id => { let cur = snapshot.nodes.find(x => x.id === id); while (cur?.parent_id != null) { if (cur.parent_id === n.id) return true; cur = snapshot.nodes.find(x => x.id === cur.parent_id); } return false; }).length}` } : n) };
}
function renderTree(snapshot) { if (!snapshot) return; canvas.render(visibleSnapshot(snapshot), { highlighted: trace[player.state.cursor]?.highlighted || [], reused: trace[player.state.cursor]?.reused || [], selected: trace[player.state.cursor]?.selected || [] }); }
function renderStep(step, index) {
  const metrics = step.metrics || {};
  if (mode === 'curves') chart.render(trace.slice(0, index + 1));
  if (mode === 'tree') { activeSnapshot = step.snapshot; renderTree(activeSnapshot); }
  ['calls','max_depth','cache_hits'].forEach((key, i) => { const ids = ['growth-calls','growth-depth','growth-hits']; if (metrics[key] != null) document.getElementById(ids[i]).textContent = metrics[key]; });
}
async function runBenchmark() {
  error(); const algorithms = [...document.querySelectorAll('#curve-controls input[type=checkbox]:checked')].map(i => i.value);
  if (!algorithms.length) return error('Choose at least one algorithm.');
  const sizes = document.getElementById('growth-sizes').value.split(',').map(Number);
  if (sizes.at(-1) > 1500 && algorithms.some(a => ['bubble','insertion','selection'].includes(a))) return error('Quadratic algorithms are limited to n ≤ 1500.');
  const button = document.getElementById('growth-run'); button.disabled = true; button.textContent = 'Running up to 8 s…';
  try { const response = await fetch('/bench', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ algorithms, sizes, repeats:Number(document.getElementById('growth-repeats').value), input_kind:document.getElementById('growth-input').value, seed:42 }) }); const data = await response.json(); if (!response.ok) throw new Error(apiError(data, response)); trace = data.steps || []; player.load(trace); if (data.metadata?.truncated) error('Benchmark stopped at its 8-second safety budget; partial points are shown.'); }
  catch (err) { error(err.message); } finally { button.disabled = false; button.textContent = 'Run benchmark'; }
}
async function runRecursion() {
  error(); const algorithm = document.getElementById('recursion-algorithm').value; const payload = { algorithm };
  if (algorithm.startsWith('fib_')) payload.n = Number(document.getElementById('recursion-n').value); else { const parts = document.getElementById('recursion-array').value.split(/[,\s]+/).filter(Boolean); if (!parts.every(x => /^-?\d+$/.test(x))) return error('Array must contain integers only.'); payload.array = parts.map(Number); }
  try { const response = await fetch('/recursion', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) }); const data = await response.json(); if (!response.ok) throw new Error(apiError(data,response)); trace = data.steps || []; collapsed.clear(); const m = data.metrics || {}; document.getElementById('growth-calls').textContent = m.calls ?? '—'; document.getElementById('growth-depth').textContent = m.max_depth ?? '—'; document.getElementById('growth-hits').textContent = m.cache_hits ?? '—'; player.load(trace); }
  catch (err) { error(err.message); }
}
const lessons = [{title:'Recursion tree of merge sort', copy:'Merge sort on 8 values has 15 calls and reaches depth 3.'},{title:'Quicksort: balanced and worst case',copy:'With a last-element pivot, sorted input forms a depth-n chain.'},{title:'Fibonacci: naive versus memoized',copy:'For n=5, naive has 15 calls; memoized has 9 calls with hits on fib(2) and fib(3).'}, {title:'Measuring growth',copy:'Use comparison counts for exact, repeatable evidence; wall-clock measurements are intentionally noisy.'}];
function initLessons() { const s=document.getElementById('growth-lesson-select'); s.innerHTML=lessons.map((l,i)=>`<option value="${i}">${l.title}</option>`).join(''); const update=()=>document.getElementById('growth-lesson-copy').textContent=lessons[Number(s.value)].copy; s.addEventListener('change',update); update(); }
document.getElementById('growth-curves').addEventListener('click',()=>selectMode('curves')); document.getElementById('growth-tree').addEventListener('click',()=>selectMode('tree')); document.getElementById('growth-learn').addEventListener('click',()=>selectMode('learn'));
document.getElementById('growth-run').addEventListener('click',runBenchmark); document.getElementById('recursion-run').addEventListener('click',runRecursion);
document.getElementById('growth-prev').addEventListener('click',()=>player.prev()); document.getElementById('growth-next').addEventListener('click',()=>player.next()); document.getElementById('growth-play').addEventListener('click',()=>player.state.playing ? player.pause() : player.play()); document.getElementById('growth-skip').addEventListener('click',()=>player.seek(trace.length - 1));
document.getElementById('tree-collapse').addEventListener('click',()=>{ const id=trace[player.state.cursor]?.highlighted?.[0]; if(id != null) { collapsed.add(id); renderTree(activeSnapshot); } }); document.getElementById('tree-expand').addEventListener('click',()=>{ collapsed.clear(); renderTree(activeSnapshot); });
document.querySelectorAll('input[name=metric],#growth-log').forEach(el=>el.addEventListener('change',()=>{ chart.options.metric=document.querySelector('input[name=metric]:checked').value === 'time' ? 'time' : 'comparisons'; chart.options.log=document.getElementById('growth-log').checked; chart.render(trace.slice(0, Math.max(0,player.state.cursor+1))); }));
document.getElementById('growth-quiz').addEventListener('click',()=>renderQuiz(document.getElementById('growth-quiz-host'), getQuiz('growthQuiz'), { onClose:()=>{} }));
initLessons();

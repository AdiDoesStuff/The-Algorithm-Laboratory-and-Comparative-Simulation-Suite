let currentLabArray = [];
let isPaused = false;
let isRunning = false;
let currentGeneration = 0;

window.onload = () => {
    generateNewArray();
    initAlgorithmInfo();
};

function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('pause-btn');
    btn.innerText = isPaused ? 'Resume' : 'Pause';
}

async function startComparison() {
    if (isRunning) return;

    const leftAlgo = document.getElementById('algo-left').value;
    const rightAlgo = document.getElementById('algo-right').value;

    isRunning = true;
    const startBtn = document.querySelector("button[onclick='startComparison()']");
    if (startBtn) startBtn.disabled = true;

    document.getElementById('count-left').innerText = '0';
    document.getElementById('count-right').innerText = '0';

    try {
        const [leftData, rightData] = await Promise.all([
            fetchSortSteps(leftAlgo, currentLabArray),
            fetchSortSteps(rightAlgo, currentLabArray)
        ]);

        if (!leftData || !rightData) {
            throw new Error("Backend returned null. Check your Python terminal for errors!");
        }

        if (!leftData.steps || !rightData.steps) {
            throw new Error("Data received, but '.steps' key is missing! Check your algs.py return statements.");
        }

        document.getElementById('time-left').innerText = leftData.execution_time.toFixed(4);
        document.getElementById('time-right').innerText = rightData.execution_time.toFixed(4);

        await Promise.all([
            animateSort('left', leftData.steps),
            animateSort('right', rightData.steps)
        ]);

        // Notify user if either bogo sort was cut short
        if (leftData.truncated) {
            showToast(`⚠️ ${algorithmDetails[leftAlgo].name} hit the step limit and was stopped early — it could run forever!`, 'warning');
        }
        if (rightData.truncated) {
            showToast(`⚠️ ${algorithmDetails[rightAlgo].name} hit the step limit and was stopped early — it could run forever!`, 'warning');
        }
    } catch (error) {
        console.error("CRITICAL RACE ERROR:", error);
        alert("The race crashed! Open the browser console (F12 -> Console) to see why.");
    } finally {
        isRunning = false;
        if (startBtn) startBtn.disabled = false;
    }
}

function resetLab() {
    isPaused = false;
    generateNewArray(); // bumps currentGeneration first — signals any in-flight animation to stop
    isRunning = false;  // safe to clear only after the generation has been incremented
    document.getElementById('pause-btn').innerText = 'Pause';
}

function generateNewArray() {
    currentGeneration++;
    const count = parseInt(document.getElementById('element-slider').value);
    currentLabArray = Array.from({ length: count }, () => Math.floor(Math.random() * 50) + 10);

    updateBars(document.getElementById('visualizer-left'), currentLabArray, [], '');
    updateBars(document.getElementById('visualizer-right'), currentLabArray, [], '');

    document.getElementById('count-left').innerText = '0';
    document.getElementById('count-right').innerText = '0';
}

function updateElementCount() {
    const val = document.getElementById('element-slider').value;
    document.getElementById('element-val').innerText = val;
    generateNewArray();
}

function updateSpeedDisplay() {
    const val = document.getElementById('speed-slider').value;
    document.getElementById('speed-val').innerText = `${val}x`;
}

// showToast is defined in utils.js and available globally on this page.

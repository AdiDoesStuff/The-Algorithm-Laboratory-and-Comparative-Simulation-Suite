let currentLabArray = [];
let isPaused = false;
let isRunning = false;
let currentGeneration = 0;

// 1. Initial Setup: Draw bars as soon as the page loads
window.onload = () => {
    generateNewArray();
};

function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('pause-btn');
    btn.innerText = isPaused ? 'Resume' : 'Pause';
}

// 2. Fetch Logic: Talk to your Flask Backend
async function fetchSortSteps(algorithm, array) {
    try {
        const response = await fetch('http://127.0.0.1:5000/sort', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ algorithm, array })
        });
        return await response.json();
    } catch (error) {
        console.error("Backend error:", error);
        alert("Is your Python server running? Check the terminal!");
    }
}

// 3. Animation Logic (What you wrote, but integrated)
async function animateSort(algoType, steps) {
    const container = document.getElementById(`visualizer-${algoType}`);
    const countSpan = document.getElementById(`count-${algoType}`);
    const myGeneration = currentGeneration;

    // Safety check: Ensure steps is an array
    if (!Array.isArray(steps)) {
        console.error("animateSort expected an array but got:", steps);
        return;
    }

    for (let step of steps) {
        // KILL SWITCH: Stops old animations if Reset is clicked
        if (myGeneration !== currentGeneration) return;

        // PAUSE LOGIC
        while (isPaused) {
            if (myGeneration !== currentGeneration) return;
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // 1. Update the bars with the 'current_state' from Python
        updateBars(container, step.current_state, step.indices, step.type);
        
        // 2. Increment the comparison counter
        if (step.type === 'compare' && countSpan) {
            countSpan.innerText = parseInt(countSpan.innerText) + 1;
        }

        // 3. Dynamic Delay based on speed slider
        const speedSlider = document.getElementById('speed-slider');
        const speedMultiplier = speedSlider ? parseFloat(speedSlider.value) : 1;
        const dynamicDelay = 50 / speedMultiplier;
        
        await new Promise(resolve => setTimeout(resolve, dynamicDelay)); 
    }

    // VICTORY LAP: All bars turn green
    const finalBars = container.getElementsByClassName('bar');
    for (let bar of finalBars) {
        if (myGeneration !== currentGeneration) return;
        bar.classList.add('sorted');
        await new Promise(resolve => setTimeout(resolve, 10)); 
    }
}
// 4. Update Bars (The visual part)
function updateBars(container, state, highlightIndices, type) {
    if (!container) return; // Safety check

    const newBars = state.map((val, idx) => {
        const bar = document.createElement('div');
        bar.className = 'bar';
        // Ensure val exists and is a number
        bar.style.height = `${(val || 0) * 4}px`; 
        
        if (highlightIndices && highlightIndices.includes(idx)) {
            bar.classList.add(type === 'compare' ? 'comparing' : 'swapping');
        }
        return bar;
    });

    // This updates the entire container in one go, preventing the "black void"
    container.replaceChildren(...newBars);

}

// 5. The Trigger: What happens when you click "Start Race"
async function startComparison() {
    if (isRunning) return;

    const leftAlgo = document.getElementById('algo-left').value;
    const rightAlgo = document.getElementById('algo-right').value;

    isRunning = true;
    const startBtn = document.querySelector("button[onclick='startComparison()']");
    if (startBtn) startBtn.disabled = true;
    
    // Reset Counters
    document.getElementById('count-left').innerText = '0';
    document.getElementById('count-right').innerText = '0';

    try {
        const [leftData, rightData] = await Promise.all([
            fetchSortSteps(leftAlgo, currentLabArray),
            fetchSortSteps(rightAlgo, currentLabArray)
        ]);

        // DEBUG 1: If Python crashed, these will be null
        if (!leftData || !rightData) {
            throw new Error("Backend returned null. Check your Python terminal for errors!");
        }

        // DEBUG 2: Ensure the dictionary keys exist
        if (!leftData.steps || !rightData.steps) {
            throw new Error("Data received, but '.steps' key is missing! Check your algs.py return statements.");
        }

        // Logic Time Update
        document.getElementById('time-left').innerText = leftData.execution_time.toFixed(4);
        document.getElementById('time-right').innerText = rightData.execution_time.toFixed(4);
        
        // Start visual race
        await Promise.all([
            animateSort('left', leftData.steps),
            animateSort('right', rightData.steps)
        ]);

    } catch (error) {
        console.error("CRITICAL RACE ERROR:", error);
        alert("The race crashed! Open the browser console (F12 -> Console) to see why.");
    } finally {
        isRunning = false;
        if (startBtn) startBtn.disabled = false;
    }
}

// 6. Reset function
function resetLab() {
    
    isPaused = false;
    isRunning = false;
    document.getElementById('pause-btn').innerText = 'Pause';
    generateNewArray();
}

function generateNewArray() {
    currentGeneration++;
    const count = parseInt(document.getElementById('element-slider').value);
    currentLabArray = Array.from({length: count}, () => Math.floor(Math.random() * 50) + 10);
    
    updateBars(document.getElementById('visualizer-left'), currentLabArray, [], '');
    updateBars(document.getElementById('visualizer-right'), currentLabArray, [], '');

    document.getElementById('count-left').innerText = '0';
    document.getElementById('count-right').innerText = '0';
}


function updateElementCount() {
    const val = document.getElementById('element-slider').value;
    document.getElementById('element-val').innerText = val;
    generateNewArray(); // Automatically regenerates the array when slider moves
}

function updateSpeedDisplay() {
    const val = document.getElementById('speed-slider').value;
    document.getElementById('speed-val').innerText = val + 'x';
}
let currentLabArray = [];
let isPaused = false;
let isRunning = false;
let currentGeneration = 0;

function togglePause() {
    isPaused = !isPaused;
    const btn = document.getElementById('pause-btn');
    btn.innerText = isPaused ? 'Resume' : 'Pause';
}

// 1. Initial Setup: Draw bars as soon as the page loads
window.onload = () => {
    generateNewArray();
};

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
    
    for (let step of steps) {


        while (isPaused) {
            if (myGeneration !== currentGeneration) return;
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        updateBars(container, step.current_state, step.indices, step.type);
        
        if (step.type === 'compare') {
            countSpan.innerText = parseInt(countSpan.innerText) + 1;
        }
        await new Promise(resolve => setTimeout(resolve, 50)); 
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
    if (isRunning) {
        alert("Race is already running!");
        return;
    }

    // 1. Get the algorithms chosen by the user from the <select> menus
    const leftAlgo = document.getElementById('algo-left').value;
    const rightAlgo = document.getElementById('algo-right').value;

    isRunning = true;
    
    // Select the button more reliably
    const startBtn = document.querySelector("button[onclick='startComparison()']");
    if (startBtn) startBtn.disabled = true;
    
    // Reset the counters to 0
    document.getElementById('count-left').innerText = '0';
    document.getElementById('count-right').innerText = '0';

    try {
        // 2. Fetch data based on user choices
        // We do these in parallel so the user doesn't wait twice as long
        const [leftSteps, rightSteps] = await Promise.all([
            fetchSortSteps(leftAlgo, currentLabArray),
            fetchSortSteps(rightAlgo, currentLabArray)
        ]);

        // If either fetch failed (returned undefined), we stop here
        if (!leftSteps || !rightSteps) {
            throw new Error("Failed to get steps from server.");
        }
        
        // 3. Start the race using generic IDs ('left' and 'right')
        await Promise.all([
            animateSort('left', leftSteps),
            animateSort('right', rightSteps)
        ]);

    } catch (error) {
        console.error("Race interrupted:", error);
    } finally {
        // This 'finally' block runs NO MATTER WHAT (even if there was an error)
        // It ensures the button is clickable again so you can try again
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
    currentLabArray = Array.from({length: 20}, () => Math.floor(Math.random() * 50) + 10);
    
    updateBars(document.getElementById('visualizer-left'), currentLabArray, [], '');
    updateBars(document.getElementById('visualizer-right'), currentLabArray, [], '');

    document.getElementById('count-left').innerText = '0';
    document.getElementById('count-right').innerText = '0';
}
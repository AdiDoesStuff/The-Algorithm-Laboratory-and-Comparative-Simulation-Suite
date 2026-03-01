let currentLabArray = [];


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
    
    for (let step of steps) {
        updateBars(container, step.current_state, step.indices, step.type);
        
        if (step.type === 'compare') {
            countSpan.innerText = parseInt(countSpan.innerText) + 1;
        }
        await new Promise(resolve => setTimeout(resolve, 50)); 
    }
}

// 4. Update Bars (The visual part)
function updateBars(container, state, highlightIndices, type) {
    container.innerHTML = ''; 
    state.forEach((val, idx) => {
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = `${val * 4}px`; // Increased scale so bars look bigger
        if (highlightIndices.includes(idx)) {
            bar.classList.add(type === 'compare' ? 'comparing' : 'swapping');
        }
        container.appendChild(bar);
    });
}

// 5. The Trigger: What happens when you click "Start Race"
async function startComparison() {
    // Generate ONE random array for both to ensure a fair race
    
    // Reset the counters on screen
    document.getElementById('count-bubble').innerText = '0';
    document.getElementById('count-selection').innerText = '0';

    // Get the data from Python
    const bubbleSteps = await fetchSortSteps('bubble', currentLabArray);
    const selectionSteps = await fetchSortSteps('selection', currentLabArray);
    
    // Start the race!
    animateSort('bubble', bubbleSteps);
    animateSort('selection', selectionSteps);
}

// 6. Reset function
function resetLab() {
    generateNewArray();
}

function generateNewArray() {
    currentLabArray = Array.from({length: 20}, () => Math.floor(Math.random() *  50) + 10);
    // now we update em and draw em on screen
    updateBars(document.getElementById('visualizer-bubble'), currentLabArray, [], '');
    updateBars(document.getElementById('visualizer-selection'), currentLabArray, [], '');

    document.getElementById('count-bubble').innerText = '0';
    document.getElementById('count-selection').innerText = '0';
}
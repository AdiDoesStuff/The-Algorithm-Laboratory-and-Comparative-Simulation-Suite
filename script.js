let currentLabArray = [];
let isPaused = false;
let isRunning = false;
let currentGeneration = 0;

// 1. Initial Setup: Draw bars as soon as the page loads
window.onload = () => {
    generateNewArray();
    initAlgorithmInfo();
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

// === ALGORITHM INFORMATION METADATA ===
const algorithmDetails = {
    bubble: {
        name: "Bubble Sort",
        desc: "A simple algorithm that repeatedly steps through the list, compares adjacent elements, and swaps them if they are in the wrong order.",
        codeSnippet: `def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr`,
        timeBest: "O(n)", timeAvg: "O(n²)", timeWorst: "O(n²)",
        space: "O(1)", type: "Brute Force",
        stability: "Stable", inplace: "In-place",
        observation: "Watch the red (comparing) indicators move pair by pair. You'll notice the largest unsorted element 'bubbles' all the way to the right end in each pass.",
        usecase: "Mostly used for educational purposes; can be fast if the array is already mostly sorted.",
        prosCons: "Pros: Very simple to understand. Cons: Extremely slow for large lists.",
        creator: "Unknown / Uncredited", date: "First published 1956 (Edward Friend)"
    },
    selection: {
        name: "Selection Sort",
        desc: "Divides the input list into two parts: a sorted sublist building up from left to right, and an unsorted sublist. It repeatedly finds the minimum element and puts it at the beginning.",
        codeSnippet: `def selection_sort(arr):
    for i in range(len(arr)):
        min_idx = i
        for j in range(i+1, len(arr)):
            if arr[j] < arr[min_idx]:
                min_idx = j
        arr[i], arr[min_idx] = arr[min_idx], arr[i]
    return arr`,
        timeBest: "O(n²)", timeAvg: "O(n²)", timeWorst: "O(n²)",
        space: "O(1)", type: "Brute Force",
        stability: "Unstable (usually)", inplace: "In-place",
        observation: "Look for how it scans through the entire unsorted region tracking the minimum, and then makes ONE yellow swap to place it exactly where it belongs.",
        usecase: "Useful when memory write (swap) operations are very costly, as it makes O(n) swaps.",
        prosCons: "Pros: Never makes more than O(n) swaps. Cons: Always scans everything remaining, making it rigidly O(n²).",
        creator: "Unknown", date: "Early computer science routines (1950s)"
    },
    insertion: {
        name: "Insertion Sort",
        desc: "Builds the final sorted array one item at a time. It takes one element from the input data, finds the location it belongs within the sorted list, and inserts it there.",
        codeSnippet: `def insertion_sort(arr):
    for i in range(1, len(arr)):
        key = arr[i]
        j = i-1
        while j >= 0 and key < arr[j]:
            arr[j + 1] = arr[j]
            j -= 1
        arr[j + 1] = key
    return arr`,
        timeBest: "O(n)", timeAvg: "O(n²)", timeWorst: "O(n²)",
        space: "O(1)", type: "Decrease and Conquer",
        stability: "Stable", inplace: "In-place",
        observation: "Notice the sorted region growing on the left. You will see a single element repeatedly swapped backwards into the green zone until it hits a smaller element.",
        usecase: "Used in real-world standard libraries (like Python's Timsort or C++'s std::sort) for small arrays (size < 16-64).",
        prosCons: "Pros: Highly efficient for small or nearly sorted arrays. Cons: Inefficient for large unsorted arrays.",
        creator: "John Mauchly / Various", date: "Reportedly 1946"
    },
    quick: {
        name: "Quick Sort",
        desc: "Selects a 'pivot' element and partitions the array into two sub-arrays, according to whether they are less than or greater than the pivot. The sub-arrays are then sorted recursively.",
        codeSnippet: `def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)`,
        timeBest: "O(n log n)", timeAvg: "O(n log n)", timeWorst: "O(n²)",
        space: "O(log n)", type: "Divide and Conquer",
        stability: "Unstable", inplace: "In-place (mostly)",
        observation: "Watch the chaotic scattering across the array based on a pivot value, slowly consolidating into sorted chunks. The logic time here is usually incredibly fast.",
        usecase: "The default sorting algorithm in many systems and standard libraries (e.g. C's qsort, Java for primitives) due to excellent cache hit rates.",
        prosCons: "Pros: Very fast on average. Cons: Worst case O(n²) if poorly implemented with bad pivots, unstable.",
        creator: "Tony Hoare", date: "1959 (Published 1961)"
    },
    merge: {
        name: "Merge Sort",
        desc: "Divides the unsorted list into n sublists, each containing one element. Then repeatedly merges sublists to produce new sorted sublists until there is only one left.",
        codeSnippet: `def merge_sort(arr):
    if len(arr) <= 1: return arr
    mid = len(arr) // 2
    L = merge_sort(arr[:mid])
    R = merge_sort(arr[mid:])
    res = []
    while L and R:
        res.append(L.pop(0) if L[0] <= R[0] else R.pop(0))
    return res + L + R`,
        timeBest: "O(n log n)", timeAvg: "O(n log n)", timeWorst: "O(n log n)",
        space: "O(n)", type: "Divide and Conquer",
        stability: "Stable", inplace: "Out-of-place",
        observation: "The array will break down conceptually into tiny sorted chunks, and you'll see those chunks zip together in order.",
        usecase: "Standard generic sorting routine in languages like Python (Timsort uses it) and Java (for objects). Essential for external sorting (large data sets on disk).",
        prosCons: "Pros: Guaranteed O(n log n) and stable. Cons: Requires O(n) auxiliary memory.",
        creator: "John von Neumann", date: "1945"
    },
    heap: {
        name: "Heap Sort",
        desc: "Imagine a binary tree where every parent is bigger than its children (a max-heap). The algorithm builds this heap, then repeatedly swaps the largest element to the end of the array.",
        codeSnippet: `import heapq
def heap_sort(arr):
    heapq.heapify(arr)
    return [heapq.heappop(arr) for _ in range(len(arr))]`,
        timeBest: "O(n log n)", timeAvg: "O(n log n)", timeWorst: "O(n log n)",
        space: "O(1)", type: "Selection Method",
        stability: "Unstable", inplace: "In-place",
        observation: "First, you will see it establishing the 'max-heap' property (bringing large elements to the left). Then, it swaps the largest item to the right edge and sifts down the displaced element.",
        usecase: "Embedded systems or contexts with strict memory constraints that still require guaranteed O(n log n) worst-case time.",
        prosCons: "Pros: No auxiliary memory needed, optimal worst-case bounds. Cons: Constant factors are slower than Quick Sort; terrible cache locality.",
        creator: "J. W. J. Williams", date: "1964"
    },
    bogo: {
        name: "Bogo Sort",
        desc: "A highly ineffective sorting algorithm based on the generate and test paradigm. It successively generates permutations of its input until it finds one that is sorted.",
        codeSnippet: `import random
def bogo_sort(arr):
    while arr != sorted(arr):
        random.shuffle(arr)
    return arr`,
        timeBest: "O(n)", timeAvg: "O(n × n!)", timeWorst: "Unbounded (∞)",
        space: "O(1)", type: "Las Vegas / Brute Force",
        stability: "Unstable", inplace: "In-place",
        observation: "Wait and watch as the entire array flashes randomly into total chaos. It checks the entire array left to right; if un-sorted, it detonates and tries again randomly.",
        usecase: "Absolutely none, other than as an inside joke among computer scientists or to benchmark quantum computers (Quantum Bogo Sort).",
        prosCons: "Pros: Can theoretically finish on the very first try. Cons: Heat death of the universe may occur before 15 elements are sorted.",
        creator: "H. G. Baker (Humorous)", date: "Mentioned ~1986"
    },
    optbogo: {
        name: "Optimized Bogo Sort",
        desc: "A slightly less disastrous approach to Bogo sort. It shuffles only the part of the array that remains unsorted, preserving the elements that happened to land in the correct final positions.",
        codeSnippet: `import random
def optimized_bogo(arr):
    n = len(arr)
    while arr != sorted(arr):
        idx = next((i for i in range(n-1) if arr[i] > arr[i+1]), 0)
        sub = arr[idx:]
        random.shuffle(sub)
        arr[idx:] = sub
    return arr`,
        timeBest: "O(n)", timeAvg: "O(n!) (Slightly better)", timeWorst: "Unbounded (∞)",
        space: "O(1)", type: "Las Vegas / Decrease",
        stability: "Unstable", inplace: "In-place",
        observation: "Look for 'locked in' elements on the left side that survive the random shuffles. The chaos zone shrinks slightly whenever it randomly gets lucky.",
        usecase: "When you want to demonstrate optimizations on exceptionally bad ideas.",
        prosCons: "Pros: Astronomically faster than standard bogo sort. Cons: Still comically useless for actual sorting.",
        creator: "Internet Culture", date: "Unknown"
    }
};

function initAlgorithmInfo() {
    const leftSelect = document.getElementById('algo-left');
    const rightSelect = document.getElementById('algo-right');

    leftSelect.addEventListener('change', () => renderAlgorithmInfo('left', leftSelect.value));
    rightSelect.addEventListener('change', () => renderAlgorithmInfo('right', rightSelect.value));

    // Initial render
    renderAlgorithmInfo('left', leftSelect.value);
    renderAlgorithmInfo('right', rightSelect.value);
}

function renderAlgorithmInfo(side, algoId) {
    const infoContainer = document.getElementById(`info-${side}`);
    const data = algorithmDetails[algoId];

    if (!data || !infoContainer) return;

    // Determine colors for time complexity
    const getSpeedClass = (val) => {
        if(val.includes('O(1)')) return 'good';
        if(val.includes('log') || val === 'O(n)') return 'good';
        if(val.includes('n²') || val.includes('n^2')) return 'warn';
        if(val.includes('!') || val.includes('∞')) return 'bad';
        return '';
    };

    // User-friendly dictionary explanations
    const getTypeExp = (t) => {
        if(t.includes("Brute Force")) return "Checks all possibilities or scans repeatedly until the whole array is ordered.";
        if(t.includes("Divide and Conquer")) return "Splits the array into smaller, simpler halves, sorts them, and merges them back together.";
        if(t.includes("Decrease and Conquer")) return "Reduces the problem to a smaller version (like sorting 1 less element at a time).";
        if(t.includes("Selection")) return "Repeatedly searches for the absolute best item (like the largest number) and moves it to its final position.";
        if(t.includes("Las Vegas")) return "Relies entirely on randomized shuffling. It might finish immediately, or it might take forever.";
        return "A specific mathematical approach to arranging these items.";
    };
    
    const stabilityExp = data.stability.includes("Unstable") 
        ? "<strong>Unstable</strong> means if you have two identical items (like two 5s), their original order might get scrambled."
        : "<strong>Stable</strong> means if you have two identical items, their original order is safely preserved.";
        
    const memoryExp = data.inplace.includes("Out-of-place")
        ? "<strong>Out-of-place</strong> implies the algorithm borrows extra computer memory (like creating a temporary array) to sort safely."
        : "<strong>In-place</strong> means it sorts the array solely by swapping elements within the original list, using almost zero extra memory.";

    infoContainer.innerHTML = `
        <h3>${data.name}</h3>
        <p class="info-desc">${data.desc}</p>
        
        <div class="code-container">
            <pre><code>${data.codeSnippet}</code></pre>
        </div>
        
        <div class="info-grid">
            <div class="info-box">
                <span class="label">Best Case</span>
                <span class="value ${getSpeedClass(data.timeBest)}">${data.timeBest}</span>
            </div>
            <div class="info-box">
                <span class="label">Average</span>
                <span class="value ${getSpeedClass(data.timeAvg)}">${data.timeAvg}</span>
            </div>
            <div class="info-box">
                <span class="label">Worst Case</span>
                <span class="value ${getSpeedClass(data.timeWorst)}">${data.timeWorst}</span>
            </div>
            <div class="info-box">
                <span class="label">Space Time</span>
                <span class="value ${getSpeedClass(data.space)}">${data.space}</span>
            </div>
        </div>

        <ul class="traits-list">
            <li><span>Type:</span> <strong>${data.type}</strong></li>
            <li><span>Stability:</span> <strong>${data.stability}</strong></li>
            <li><span>Memory:</span> <strong>${data.inplace}</strong></li>
        </ul>

        <details class="glossary-box">
            <summary>What do these terms mean?</summary>
            <div class="glossary-content">
                <p><strong>${data.type}:</strong> ${getTypeExp(data.type)}</p>
                <p>${stabilityExp}</p>
                <p>${memoryExp}</p>
            </div>
        </details>

        <div class="observation-box">
            <strong>Lab Observation</strong>
            ${data.observation}
        </div>

        <ul class="traits-list">
            <li><span>Use Case:</span> ${data.usecase}</li>
            <li style="margin-top: 12px;"><span>Pros / Cons:</span>
                <div style="margin-top: 4px;">
                    ${data.prosCons.replace(/Cons:/g, "<br/>Cons:")}
                </div>
            </li>
        </ul>

        <details class="creator-details">
            <summary>Origin Information</summary>
            <div class="creator-info">
                <strong>Creator:</strong> ${data.creator}<br/>
                <strong>First Appearance:</strong> ${data.date}
            </div>
        </details>
    `;

    // Trigger CSS animation for dynamic update effect
    infoContainer.classList.remove('content-enter');
    // Force a browser reflow so the animation restarts
    void infoContainer.offsetWidth;
    infoContainer.classList.add('content-enter');
}
let currentLabArray = [];
let isPaused = false;
let isRunning = false;
let currentGeneration = 0;
let bgMatrix = null;

// 1. Initial Setup: Draw bars as soon as the page loads
window.onload = () => {
    generateNewArray();
    initAlgorithmInfo();
    bgMatrix = new MatrixBackground('glitch-canvas');
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
    },
    counting: {
        name: "Counting Sort",
        desc: "An integer sorting algorithm that operates by counting the number of objects that possess distinct key values, and calculating the position of each key in the output sequence.",
        codeSnippet: `def counting_sort(arr):
    max_val = max(arr)
    count = [0] * (max_val + 1)
    for num in arr: count[num] += 1
    for i in range(1, len(count)): count[i] += count[i-1]
    res = [0] * len(arr)
    for num in reversed(arr):
        res[count[num] - 1] = num
        count[num] -= 1
    return res`,
        timeBest: "O(n + k)", timeAvg: "O(n + k)", timeWorst: "O(n + k)",
        space: "O(n + k)", type: "Non-Comparison / Distribution",
        stability: "Stable", inplace: "Out-of-place",
        observation: "You won't see pair-by-pair swaps. Instead, it scans the entire array to count occurrences, then mathematically calculates exactly where each item belongs, dropping them into place.",
        usecase: "Highly efficient for sorting integers when the range between the minimum and maximum value (k) is not significantly larger than the number of items (n).",
        prosCons: "Pros: Incredible linear O(n) performance for small ranges. Cons: Uses lots of memory; cannot be easily used for floats or long strings.",
        creator: "Harold H. Seward", date: "1954"
    },
    radix: {
        name: "Radix Sort",
        desc: "A non-comparative integer sorting algorithm that sorts data with integer keys by grouping keys by individual digits which share the same significant position and value.",
        codeSnippet: `def radix_sort(arr):
    max_val = max(arr)
    exp = 1
    while max_val // exp > 0:
        counting_sort_by_digit(arr, exp)
        exp *= 10
    return arr`,
        timeBest: "O(nk)", timeAvg: "O(nk)", timeWorst: "O(nk)",
        space: "O(n + k)", type: "Non-Comparison / Distribution",
        stability: "Stable", inplace: "Out-of-place",
        observation: "It sweeps through the array multiple times—first aligning elements by their ones digit, then their tens digit, and so on, progressively refining the order.",
        usecase: "Often used when O(n log n) is too slow and the data consists of integers or strings where the maximum number of digits (k) is small.",
        prosCons: "Pros: Linear time complexity if k is constant. Cons: Relies on an underlying stable sort (like Counting Sort) which takes extra memory.",
        creator: "Herman Hollerith", date: "1887"
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

// === HOMEPAGE TRANSITION & BACKGROUND EFFET ===

function enterApp() {
    const btn = document.querySelector('.btn-go');
    if (btn) btn.disabled = true; // Prevent multiple clicks
    
    // Add sorting animation class to the main title
    const title = document.querySelector('.landing-title');
    if (title) title.classList.add('title-sorted');

    if (bgMatrix) {
        // Run the background visual sort
        bgMatrix.startSorting(() => {
            // Once sorted, admire for a brief moment then fade out
            setTimeout(executeTransition, 400);
        });
    } else {
        // Fallback
        executeTransition();
    }
}

function executeTransition() {
    const landing = document.getElementById('landing-page');
    const app = document.getElementById('main-app');
    
    // Trigger CSS slide-up
    landing.classList.add('slide-up-fade');
    
    // Switch underlying containers
    setTimeout(() => {
        landing.style.display = 'none';
        app.classList.remove('app-hidden');
        app.classList.add('app-enter');
    }, 800); // Wait for css transition
}

class MatrixBackground {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        this.chars = '0123456789'.split('');
        // Darker blues and greys mapped loosely from glitchColors requirement
        this.colors = ['#1e293b', '#2b4539', '#61b3dc', '#38bdf8', '#475569'];
        this.sortedColor = '#34d399'; // The green from sorted bars
        
        this.glitchSpeed = 50;
        this.fontSize = 16;
        this.charWidth = 10;
        this.charHeight = 20;
        
        this.letters = [];
        this.columns = 0;
        this.rows = 0;
        
        this.lastGlitchTime = Date.now();
        this.animationId = null;
        
        this.isSorting = false;
        this.sortIndex = 0;
        this.onComplete = null;
        
        this.handleResize = this.handleResize.bind(this);
        this.animate = this.animate.bind(this);
        
        this.init();
    }
    
    getRandomChar() {
        return this.chars[Math.floor(Math.random() * this.chars.length)];
    }
    
    getRandomColor() {
        return this.colors[Math.floor(Math.random() * this.colors.length)];
    }
    
    init() {
        window.addEventListener('resize', this.handleResize);
        this.handleResize();
        this.animationId = requestAnimationFrame(this.animate);
    }
    
    handleResize() {
        if (!this.canvas) return;
        const parent = this.canvas.parentElement;
        if (!parent) return;
        
        const dpr = window.devicePixelRatio || 1;
        const rect = parent.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        
        this.columns = Math.ceil(rect.width / this.charWidth);
        this.rows = Math.ceil(rect.height / this.charHeight);
        
        const total = this.columns * this.rows;
        this.letters = Array.from({ length: total }, () => ({
            char: this.getRandomChar(),
            color: this.getRandomColor(),
            targetColor: this.getRandomColor(),
            colorProgress: 1,
            isSorted: false
        }));
        
        this.drawLetters();
    }
    
    hexToRgb(hex) {
        if (!hex) return {r:0, g:0, b:0};
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    }
    
    parseColor(colorStr) {
        if (colorStr.startsWith('#')) return this.hexToRgb(colorStr);
        if (colorStr.startsWith('rgb')) {
            const match = colorStr.match(/\d+/g);
            if (match) return { r: parseInt(match[0]), g: parseInt(match[1]), b: parseInt(match[2]) };
        }
        return {r:0, g:0, b:0};
    }
    
    interpolateColor(start, end, factor) {
        const r = Math.round(start.r + (end.r - start.r) * factor);
        const g = Math.round(start.g + (end.g - start.g) * factor);
        const b = Math.round(start.b + (end.b - start.b) * factor);
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    updateLetters() {
        if (!this.letters.length || this.isSorting) return;
        // Introduce chaos equivalent to 5% of letters changing per frame
        const updateCount = Math.max(1, Math.floor(this.letters.length * 0.05));
        
        for (let i = 0; i < updateCount; i++) {
            const index = Math.floor(Math.random() * this.letters.length);
            if (this.letters[index] && !this.letters[index].isSorted) {
                this.letters[index].char = this.getRandomChar();
                this.letters[index].targetColor = this.getRandomColor();
                this.letters[index].colorProgress = 0; // Trigger smooth interpolation
            }
        }
    }
    
    handleSmoothTransitions() {
        let needsRedraw = false;
        this.letters.forEach(letter => {
            if (letter.colorProgress < 1) {
                // If sorting, speed up the visual color interpolation
                letter.colorProgress += this.isSorting ? 0.3 : 0.05; 
                if (letter.colorProgress > 1) letter.colorProgress = 1;
                
                const start = this.parseColor(letter.color);
                const end = this.parseColor(letter.targetColor);
                
                letter.color = this.interpolateColor(start, end, this.isSorting ? 0.5 : 0.1);
                needsRedraw = true;
            }
        });
        if (needsRedraw) this.drawLetters();
    }
    
    drawLetters() {
        this.ctx.clearRect(0, 0, this.canvas.width / window.devicePixelRatio, this.canvas.height / window.devicePixelRatio);
        this.ctx.font = `${this.fontSize}px monospace`;
        this.ctx.textBaseline = 'top';
        
        this.letters.forEach((letter, index) => {
            const x = (index % this.columns) * this.charWidth;
            const y = Math.floor(index / this.columns) * this.charHeight;
            this.ctx.fillStyle = letter.color;
            this.ctx.fillText(letter.char, x, y);
        });
    }
    
    startSorting(onComplete) {
        this.isSorting = true;
        this.sortIndex = 0;
        this.onComplete = onComplete;
    }
    
    processSortingStep() {
        if (!this.isSorting) return;
        
        // Chunk sizes determine how fast the visual sweeping completes. 
        // Spanning across 40 frames (~600ms) guarantees a fast, satisfying visual
        const chunkSize = Math.max(30, Math.floor(this.letters.length / 40));
        
        for (let i = 0; i < chunkSize; i++) {
            if (this.sortIndex < this.letters.length) {
                const l = this.letters[this.sortIndex];
                l.char = (this.sortIndex % 10).toString(); // Sequence 0-9 repeatedly
                l.targetColor = this.sortedColor;
                l.colorProgress = 0; // trigger the transition quickly
                l.isSorted = true;
                this.sortIndex++;
            } else {
                this.isSorting = false;
                if (this.onComplete) this.onComplete();
                break;
            }
        }
        
        // Always redraw immediately when actively sorting so it feels snappy
        this.drawLetters(); 
    }
    
    animate() {
        const now = Date.now();
        
        if (this.isSorting) {
            this.processSortingStep();
        } else if (now - this.lastGlitchTime >= this.glitchSpeed) {
            this.updateLetters();
            this.lastGlitchTime = now;
        }
        
        this.handleSmoothTransitions();
        this.animationId = requestAnimationFrame(this.animate);
    }
}
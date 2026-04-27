async function animateSort(algoType, steps) {
    const container = document.getElementById(`visualizer-${algoType}`);
    const countSpan = document.getElementById(`count-${algoType}`);
    const myGeneration = currentGeneration;

    if (!Array.isArray(steps)) {
        console.error("animateSort expected an array but got:", steps);
        return;
    }

    for (let step of steps) {
        if (myGeneration !== currentGeneration) return;

        while (isPaused) {
            if (myGeneration !== currentGeneration) return;
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        updateBars(container, step.current_state, step.indices, step.type);

        if (step.type === 'compare' && countSpan) {
            countSpan.innerText = parseInt(countSpan.innerText) + 1;
        }

        const speedSlider = document.getElementById('speed-slider');
        const speedMultiplier = speedSlider ? parseFloat(speedSlider.value) : 1;
        const dynamicDelay = 50 / speedMultiplier;

        await new Promise(resolve => setTimeout(resolve, dynamicDelay));
    }

    const finalBars = container.getElementsByClassName('bar');
    for (let bar of finalBars) {
        if (myGeneration !== currentGeneration) return;
        bar.classList.add('sorted');
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

function updateBars(container, state, highlightIndices, type) {
    if (!container) return;

    const newBars = state.map((val, idx) => {
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.height = `${(val || 0) * 4}px`;

        if (highlightIndices && highlightIndices.includes(idx)) {
            bar.classList.add(type === 'compare' ? 'comparing' : 'swapping');
        }
        return bar;
    });

    container.replaceChildren(...newBars);
}

function initAlgorithmInfo() {
    const leftSelect = document.getElementById('algo-left');
    const rightSelect = document.getElementById('algo-right');

    leftSelect.addEventListener('change', () => renderAlgorithmInfo('left', leftSelect.value));
    rightSelect.addEventListener('change', () => renderAlgorithmInfo('right', rightSelect.value));

    renderAlgorithmInfo('left', leftSelect.value);
    renderAlgorithmInfo('right', rightSelect.value);
}

function renderComplexity(value, whyHtml, extraClasses = '') {
    const safeValue = value ?? '';
    const safeWhy = (typeof whyHtml === 'string' && whyHtml.trim().length > 0) ? whyHtml : '';
    const cls = `value ${extraClasses}`.trim();

    if (!safeWhy) {
        return `<span class="${cls}">${safeValue}</span>`;
    }

    return `
        <span class="${cls} complexity-tooltip">
            ${safeValue}
            <span class="complexity-tooltip-bubble" role="tooltip">${safeWhy}</span>
        </span>
    `;
}

function renderAlgorithmInfo(side, algoId) {
    const infoContainer = document.getElementById(`info-${side}`);
    const data = algorithmDetails[algoId];

    if (!data || !infoContainer) return;

    const getSpeedClass = (val) => {
        if (val.includes('O(1)')) return 'good';
        if (val.includes('log') || val === 'O(n)') return 'good';
        if (val.includes('n²') || val.includes('n^2')) return 'warn';
        if (val.includes('!') || val.includes('∞')) return 'bad';
        return '';
    };

    const getTypeExp = (t) => {
        if (t.includes("Brute Force")) return "Checks all possibilities or scans repeatedly until the whole array is ordered.";
        if (t.includes("Divide and Conquer")) return "Splits the array into smaller, simpler halves, sorts them, and merges them back together.";
        if (t.includes("Decrease and Conquer")) return "Reduces the problem to a smaller version (like sorting 1 less element at a time).";
        if (t.includes("Selection")) return "Repeatedly searches for the absolute best item (like the largest number) and moves it to its final position.";
        if (t.includes("Las Vegas")) return "Relies entirely on randomized shuffling. It might finish immediately, or it might take forever.";
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
                ${renderComplexity(data.timeBest, data.timeBestWhy, getSpeedClass(data.timeBest))}
            </div>
            <div class="info-box">
                <span class="label">Average</span>
                ${renderComplexity(data.timeAvg, data.timeAvgWhy, getSpeedClass(data.timeAvg))}
            </div>
            <div class="info-box">
                <span class="label">Worst Case</span>
                ${renderComplexity(data.timeWorst, data.timeWorstWhy, getSpeedClass(data.timeWorst))}
            </div>
            <div class="info-box">
                <span class="label">Space Time</span>
                ${renderComplexity(data.space, data.spaceWhy, getSpeedClass(data.space))}
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

    if (typeof autoPositionComplexityTooltips === 'function') {
        autoPositionComplexityTooltips(infoContainer);
    }

    infoContainer.classList.remove('content-enter');
    void infoContainer.offsetWidth;
    infoContainer.classList.add('content-enter');
}

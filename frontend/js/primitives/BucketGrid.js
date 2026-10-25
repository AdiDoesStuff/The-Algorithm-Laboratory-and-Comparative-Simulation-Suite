/**
 * BucketGrid.js — Generic Table & Grid Renderer
 * Reusable primitive for Hash Tables (open addressing & separate chaining)
 * and Dynamic Programming memoization grids.
 */

export class BucketGrid {
    /**
     * @param {HTMLElement} containerEl - DOM container element
     * @param {Object} [options]
     * @param {number} [options.rows=1]
     * @param {number} [options.cols=8]
     */
    constructor(containerEl, options = {}) {
        if (!containerEl) {
            throw new Error("BucketGrid requires a valid container element.");
        }
        this.container = containerEl;
        this.rows = options.rows || 1;
        this.cols = options.cols || 8;

        this.isPaused = false;
        this.currentGeneration = 0;
        this.currentSteps = [];
        this.currentStepIndex = 0;

        this._initDOM();
    }

    _initDOM() {
        this.container.classList.add('bucket-grid-container');
        this.container.innerHTML = `
            <div class="bucket-grid-main" style="--grid-cols: ${this.cols}"></div>
            <div class="bucket-grid-chains"></div>
        `;
        this.mainGridEl = this.container.querySelector('.bucket-grid-main');
        this.chainsEl = this.container.querySelector('.bucket-grid-chains');
    }

    resize(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.mainGridEl.style.setProperty('--grid-cols', this.cols);
    }

    /**
     * Render a single snapshot state.
     * Snapshot shape:
     * {
     *   rows: 1, cols: 8,
     *   cells: [ { row, col, value, role }, ... ],
     *   chains: [ { bucketIndex: 1, items: [{value, id}] } ],
     *   highlighted: [ {row, col} ]
     * }
     */
    render(snapshot = {}) {
        if (snapshot.rows && snapshot.cols) {
            this.resize(snapshot.rows, snapshot.cols);
        }

        const cellMap = new Map();
        if (Array.isArray(snapshot.cells)) {
            snapshot.cells.forEach(c => {
                cellMap.set(`${c.row},${c.col}`, c);
            });
        }

        const isHighlighted = (r, c) => {
            if (!Array.isArray(snapshot.highlighted)) return false;
            return snapshot.highlighted.some(h => h.row === r && h.col === c);
        };

        // Render main grid cells
        this.mainGridEl.innerHTML = '';
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const key = `${r},${c}`;
                const cellData = cellMap.get(key) || { value: null, role: 'empty' };
                
                const cellDiv = document.createElement('div');
                let classList = ['grid-cell'];

                if (cellData.role === 'filled') classList.push('cell-filled');
                if (cellData.role === 'probing' || isHighlighted(r, c)) classList.push('cell-probing');
                if (cellData.role === 'dp-filled') classList.push('dp-filled');
                if (cellData.role === 'dp-source') classList.push('dp-source');

                cellDiv.className = classList.join(' ');
                cellDiv.innerText = cellData.value !== null && cellData.value !== undefined ? String(cellData.value) : 'ø';
                
                this.mainGridEl.appendChild(cellDiv);
            }
        }

        // Render separate chaining lists if present
        this.chainsEl.innerHTML = '';
        if (Array.isArray(snapshot.chains) && snapshot.chains.length > 0) {
            snapshot.chains.forEach(chain => {
                if (!chain.items || chain.items.length === 0) return;
                
                const chainRow = document.createElement('div');
                chainRow.className = 'chain-container';
                chainRow.innerHTML = `<strong>Bucket [${chain.bucketIndex}]:</strong>`;

                chain.items.forEach(item => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'chain-item';
                    itemDiv.innerText = `↓ ${item.value}`;
                    chainRow.appendChild(itemDiv);
                });

                this.chainsEl.appendChild(chainRow);
            });
        }
    }

    /**
     * Animate a sequence of step snapshots.
     */
    async animateSteps(steps, delayMs = 500) {
        if (!Array.isArray(steps) || steps.length === 0) return;

        this.currentGeneration++;
        const generation = this.currentGeneration;
        this.currentSteps = steps;

        for (let i = 0; i < steps.length; i++) {
            if (generation !== this.currentGeneration) return;

            while (this.isPaused) {
                if (generation !== this.currentGeneration) return;
                await new Promise(r => setTimeout(r, 100));
            }

            this.currentStepIndex = i;
            const step = steps[i];
            this.render(step.snapshot || step);

            await new Promise(r => setTimeout(r, step.duration || delayMs));
        }
    }

    destroy() {
        this.currentGeneration++;
        this.container.innerHTML = '';
    }
}

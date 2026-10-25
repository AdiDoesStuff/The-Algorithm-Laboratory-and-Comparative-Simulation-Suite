/**
 * BucketGrid.js — Generic Table & Grid Renderer
 * Reusable primitive for Hash Tables (open addressing & separate chaining)
 * and Dynamic Programming memoization grids.
 *
 * Two rendering modes, picked from the snapshot shape:
 *
 *   1. Legacy cells/chains (DP grids and the original hash fixtures):
 *        { rows, cols, cells:[{row,col,value,role}], chains:[...] }
 *
 *   2. Hash-table snapshots (Phase D POST /hash):
 *        open addressing: { strategy:'open', size, slots:[null | {tombstone:true} | {id,key}], ... }
 *        separate chaining: { strategy:'chaining', size, buckets:[[{id,key}], ...], ... }
 *
 * Hash mode keeps one keyed DOM element per bucket/slot index, so a slot never
 * jumps position between steps and role badges update in place.
 */

const ROLE_GLYPH = {
    probing: '?',
    mismatch: '\u2260',
    created: '+',
    matched: '\u2713'
};

const ROLE_ORDER = ['probing', 'mismatch', 'created', 'matched'];

export class BucketGrid {
    /**
     * @param {HTMLElement} containerEl - DOM container element
     * @param {Object} [options]
     * @param {number} [options.rows=1]
     * @param {number} [options.cols=8]
     * @param {boolean} [options.showCaption=true] - render a small status line
     */
    constructor(containerEl, options = {}) {
        if (!containerEl) {
            throw new Error("BucketGrid requires a valid container element.");
        }
        this.container = containerEl;
        this.rows = options.rows || 1;
        this.cols = options.cols || 8;
        this.showCaption = options.showCaption !== false;

        this.isPaused = false;
        this.currentGeneration = 0;
        this.currentSteps = [];
        this.currentStepIndex = 0;

        this._slotEls = new Map();   // index -> cell element (hash mode)
        this._mode = null;

        this._initDOM();
    }

    _initDOM() {
        this.container.classList.add('bucket-grid-container');
        this.container.innerHTML = `
            <div class="bucket-grid-main" style="--grid-cols: ${this.cols}" role="list"></div>
            <div class="bucket-grid-chains"></div>
            <div class="bucket-grid-caption" aria-live="polite"></div>
        `;
        this.mainGridEl = this.container.querySelector('.bucket-grid-main');
        this.chainsEl = this.container.querySelector('.bucket-grid-chains');
        this.captionEl = this.container.querySelector('.bucket-grid-caption');
        if (!this.showCaption && this.captionEl) this.captionEl.classList.add('hidden');
    }

    resize(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.mainGridEl.style.setProperty('--grid-cols', Math.max(1, cols));
    }

    /**
     * Render a single snapshot state.
     * @param {Object} snapshot
     * @param {Object} [stepRoles] - the trace step; panel-suffixed role arrays
     *   such as `probing_open` / `created_chaining` are read for cell badges.
     */
    render(snapshot = {}, stepRoles = {}) {
        if (Array.isArray(snapshot.slots)) {
            this._renderOpen(snapshot, stepRoles);
            return;
        }
        if (Array.isArray(snapshot.buckets)) {
            this._renderChaining(snapshot, stepRoles);
            return;
        }
        if (snapshot.n && Array.isArray(snapshot.queens)) {
            this._renderNQueens(snapshot, stepRoles);
            return;
        }
        if (Array.isArray(snapshot.cells) && (snapshot.row_labels || snapshot.col_labels)) {
            this._renderMatrix(snapshot, stepRoles);
            return;
        }
        this._renderLegacy(snapshot);
    }

    // --- role helpers ------------------------------------------------------

    _roleIds(stepRoles, role, panel) {
        const out = new Set();
        const add = (value) => {
            if (Array.isArray(value)) value.forEach((entry) => out.add(Number(entry)));
        };
        add(stepRoles?.[role]);
        if (panel) {
            add(stepRoles?.[`${role}_${panel}`]);
            for (const key of Object.keys(stepRoles || {})) {
                if (key.startsWith(`${role}_${panel}_`)) add(stepRoles[key]);
            }
        }
        return out;
    }

    _cellRole(stepRoles, panel, index) {
        for (const role of ROLE_ORDER) {
            if (this._roleIds(stepRoles, role, panel).has(index)) return role;
        }
        return null;
    }

    // --- hash mode: open addressing ---------------------------------------

    _renderOpen(snapshot, stepRoles) {
        this._switchMode('open');
        const size = Number(snapshot.size) || snapshot.slots.length;
        this.resize(1, size);

        for (let index = 0; index < size; index += 1) {
            const cell = snapshot.slots[index];
            const el = this._ensureCellEl(index);
            const role = this._cellRole(stepRoles, 'open', index);
            const classes = ['grid-cell', 'slot-cell'];
            let value = '\u00b7';
            let suffix = '';
            let label;

            if (cell === null || cell === undefined) {
                classes.push('slot-empty');
                label = `Slot ${index}: empty`;
            } else if (cell.tombstone === true) {
                classes.push('slot-tombstone');
                value = '\u2020';
                suffix = 'tombstone';
                label = `Slot ${index}: tombstone (deleted key, probe continues)`;
            } else {
                classes.push('cell-filled', 'slot-filled');
                value = String(cell.key);
                suffix = `#${cell.id}`;
                label = `Slot ${index}: key ${cell.key}`;
            }

            if (role) {
                classes.push(`cell-${role}`);
                label += `, ${role}`;
            }

            el.className = classes.join(' ');
            el.setAttribute('role', 'listitem');
            el.setAttribute('aria-label', label);
            el.dataset.index = String(index);
            this._setCellContent(el, value, suffix, ROLE_GLYPH[role] || '', String(index));
        }

        this._trimCells(size);
        this.chainsEl.innerHTML = '';
        this._setCaption(
            `Open addressing: ${snapshot.count ?? 0} key${snapshot.count === 1 ? '' : 's'} in ` +
            `${size} slot${size === 1 ? '' : 's'} (load factor ${this._formatLoad(snapshot)}, ` +
            `${snapshot.tombstones ?? 0} tombstone${snapshot.tombstones === 1 ? '' : 's'}).`
        );
    }

    // --- hash mode: separate chaining -------------------------------------

    _renderChaining(snapshot, stepRoles) {
        this._switchMode('chaining');
        const buckets = snapshot.buckets || [];
        const size = Number(snapshot.size) || buckets.length;
        this.resize(1, size);

        for (let index = 0; index < size; index += 1) {
            const bucket = Array.isArray(buckets[index]) ? buckets[index] : [];
            const el = this._ensureCellEl(index);
            const role = this._cellRole(stepRoles, 'chaining', index);
            const classes = ['grid-cell', 'bucket-cell'];
            let value;
            let suffix = `${bucket.length}`;
            let label;

            if (bucket.length === 0) {
                classes.push('bucket-empty');
                value = '\u2205';
                label = `Bucket ${index}: empty`;
            } else {
                classes.push('cell-filled');
                value = String(bucket[0].key);
                if (bucket.length > 1) value += ' \u2192';
                label = `Bucket ${index}: ${bucket.map((entry) => entry.key).join(' then ')}`;
            }

            if (role) {
                classes.push(`cell-${role}`);
                label += `, ${role}`;
            }

            el.className = classes.join(' ');
            el.setAttribute('role', 'listitem');
            el.setAttribute('aria-label', label);
            el.dataset.index = String(index);
            this._setCellContent(el, value, suffix, ROLE_GLYPH[role] || '', String(index));
        }

        this._trimCells(size);

        // Full chains, one row per occupied bucket.
        this.chainsEl.innerHTML = '';
        for (let index = 0; index < size; index += 1) {
            const bucket = Array.isArray(buckets[index]) ? buckets[index] : [];
            if (bucket.length === 0) continue;
            const row = document.createElement('div');
            row.className = 'chain-container';

            const head = document.createElement('strong');
            head.textContent = `Bucket ${index}:`;
            row.appendChild(head);

            bucket.forEach((entry, position) => {
                const item = document.createElement('div');
                item.className = 'chain-item';
                item.textContent = `${position === 0 ? '\u2193' : '\u2192'} ${entry.key}`;
                row.appendChild(item);
            });
            this.chainsEl.appendChild(row);
        }

        this._setCaption(
            `Separate chaining: ${snapshot.count ?? 0} key${snapshot.count === 1 ? '' : 's'} in ` +
            `${size} bucket${size === 1 ? '' : 's'} (load factor ${this._formatLoad(snapshot)}).`
        );
    }

    // --- legacy mode -------------------------------------------------------

    _renderMatrix(snapshot, stepRoles) {
        const rows = Number(snapshot.rows) || 1;
        const cols = Number(snapshot.cols) || 1;
        this._switchMode('matrix');
        this.resize(rows, cols);
        const cells = Array.isArray(snapshot.cells) ? snapshot.cells : [];
        const rowLabels = snapshot.row_labels || [];
        const colLabels = snapshot.col_labels || [];
        // role sets from stepRoles (indices are flat cell indices)
        const newNodeIds = new Set((stepRoles?.new_node || []).map(Number));
        const dpSourceIds = new Set((stepRoles?.dp_source || []).map(Number));
        const tracebackIds = new Set((stepRoles?.traceback || []).map(Number));
        const reusedIds = new Set((stepRoles?.reused || []).map(Number));
        const highlightedIds = new Set((stepRoles?.highlighted || []).map(Number));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const idx = r * cols + c;
                const el = this._ensureCellEl(idx);
                const val = cells[idx];
                const classes = ['grid-cell', 'matrix-cell'];
                let display = (val === null || val === undefined) ? '\u00b7' : String(val);
                if (newNodeIds.has(idx)) classes.push('dp-filled', 'cell-created');
                if (dpSourceIds.has(idx)) classes.push('dp-source');
                if (tracebackIds.has(idx)) classes.push('traceback');
                if (reusedIds.has(idx)) classes.push('cell-reused');
                if (highlightedIds.has(idx)) classes.push('cell-highlighted');
                el.className = classes.join(' ');
                el.setAttribute('role', 'gridcell');
                const rl = rowLabels[r] || `r${r}`;
                const cl = colLabels[c] || `c${c}`;
                el.setAttribute('aria-label', `${rl}, ${cl}: ${display === '\u00b7' ? 'empty' : display}`);
                this._setCellContent(el, display, '', '');
            }
        }
        this._trimCells(rows * cols);
        // row/col labels: render as a caption line
        this.chainsEl.innerHTML = '';
        this._setCaption(
            (rowLabels.length ? rowLabels.join(' | ') : '') 
        );
    }

    _renderNQueens(snapshot, stepRoles) {
        const n = Number(snapshot.n) || 1;
        this._switchMode('matrix');
        this.resize(n, n);
        const queens = Array.isArray(snapshot.queens) ? snapshot.queens : [];
        const currentRow = Number(snapshot.row) || 0;
        // threatened cells set from stepRoles
        const threatenedIds = new Set((stepRoles?.threatened || []).map(Number));
        const conflictIds = new Set((stepRoles?.conflict || []).map(Number));
        const safeIds = new Set((stepRoles?.safe || []).map(Number));
        const backtrackIds = new Set((stepRoles?.backtrack || []).map(Number));
        const queenIds = new Set((stepRoles?.queen || []).map(Number));
        // fallback queen positions from queens array
        const queenSet = new Set();
        for (let r = 0; r < queens.length; r++) {
            queenSet.add(r * n + queens[r]);
        }
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                const idx = r * n + c;
                const el = this._ensureCellEl(idx);
                const classes = ['grid-cell', 'nq-cell'];
                let display = '';
                let role = '';
                if (queenSet.has(idx)) { classes.push('nq-queen'); display = '\u265b'; role = 'queen'; }
                else if (conflictIds.has(idx)) { classes.push('nq-conflict'); display = '\u2715'; role = 'conflict'; }
                else if (safeIds.has(idx)) { classes.push('nq-safe'); display = '\u2713'; role = 'safe'; }
                else if (backtrackIds.has(idx)) { classes.push('nq-backtrack'); display = '\u21b6'; role = 'backtrack'; }
                else if (threatenedIds.has(idx)) { classes.push('nq-threatened'); display = ''; role = 'threatened'; }
                el.className = classes.join(' ');
                el.setAttribute('role', 'gridcell');
                const label = role ? `Row ${r}, column ${c}: ${role}` : `Row ${r}, column ${c}`;
                el.setAttribute('aria-label', label);
                this._setCellContent(el, display, '', '');
            }
        }
        this._trimCells(n * n);
        this.chainsEl.innerHTML = '';
        this._setCaption('');
    }

    _renderLegacy(snapshot) {
        this._switchMode('legacy');
        const rows = Number(snapshot.rows) || this.rows;
        const cols = Number(snapshot.cols) || this.cols;
        this.resize(rows, cols);

        const cellMap = new Map();
        if (Array.isArray(snapshot.cells)) {
            snapshot.cells.forEach((cell) => {
                cellMap.set(`${cell.row},${cell.col}`, cell);
            });
        }

        const isHighlighted = (row, col) => {
            if (!Array.isArray(snapshot.highlighted)) return false;
            return snapshot.highlighted.some((entry) => entry.row === row && entry.col === col);
        };

        const total = rows * cols;
        for (let index = 0; index < total; index += 1) {
            const row = Math.floor(index / cols);
            const col = index % cols;
            const cellData = cellMap.get(`${row},${col}`) || { value: null, role: 'empty' };
            const el = this._ensureCellEl(index);
            const classes = ['grid-cell'];

            if (cellData.role === 'filled') classes.push('cell-filled');
            if (cellData.role === 'probing' || isHighlighted(row, col)) classes.push('cell-probing');
            if (cellData.role === 'dp-filled') classes.push('dp-filled');
            if (cellData.role === 'dp-source') classes.push('dp-source');

            el.className = classes.join(' ');
            el.setAttribute('role', 'listitem');
            el.setAttribute('aria-label', `Row ${row}, column ${col}`);
            el.dataset.index = String(index);
            const value = cellData.value !== null && cellData.value !== undefined
                ? String(cellData.value)
                : '\u00f8';
            this._setCellContent(el, value, '', '');
        }
        this._trimCells(total);

        this.chainsEl.innerHTML = '';
        if (Array.isArray(snapshot.chains) && snapshot.chains.length > 0) {
            snapshot.chains.forEach((chain) => {
                if (!chain.items || chain.items.length === 0) return;

                const chainRow = document.createElement('div');
                chainRow.className = 'chain-container';

                const head = document.createElement('strong');
                head.textContent = `Bucket [${chain.bucketIndex}]:`;
                chainRow.appendChild(head);

                chain.items.forEach((item) => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'chain-item';
                    itemDiv.textContent = `\u2193 ${item.value}`;
                    chainRow.appendChild(itemDiv);
                });

                this.chainsEl.appendChild(chainRow);
            });
        }
        this._setCaption('');
    }

    // --- shared DOM helpers ------------------------------------------------

    _switchMode(mode) {
        if (this._mode === mode) return;
        this._mode = mode;
        for (const el of this._slotEls.values()) el.remove();
        this._slotEls.clear();
        this.mainGridEl.textContent = '';
    }

    _ensureCellEl(index) {
        let el = this._slotEls.get(index);
        if (el) return el;
        el = document.createElement('div');
        el.className = 'grid-cell';
        el.dataset.index = String(index);
        this._slotEls.set(index, el);
        this.mainGridEl.appendChild(el);
        return el;
    }

    _trimCells(count) {
        for (const [index, el] of [...this._slotEls]) {
            if (index >= count) {
                el.remove();
                this._slotEls.delete(index);
            }
        }
    }

    _setCellContent(el, value, suffix, badge, indexLabel) {
        el.textContent = '';

        if (indexLabel !== undefined && indexLabel !== null) {
            const labelEl = document.createElement('span');
            labelEl.className = 'grid-cell-label';
            labelEl.textContent = indexLabel;
            labelEl.setAttribute('aria-hidden', 'true');
            el.appendChild(labelEl);
        }

        const valueEl = document.createElement('span');
        valueEl.className = 'grid-cell-value';
        valueEl.textContent = value;
        el.appendChild(valueEl);

        if (suffix) {
            const suffixEl = document.createElement('span');
            suffixEl.className = 'grid-cell-index';
            suffixEl.textContent = suffix;
            el.appendChild(suffixEl);
        }

        if (badge) {
            const badgeEl = document.createElement('span');
            badgeEl.className = 'grid-cell-badge';
            badgeEl.setAttribute('aria-hidden', 'true');
            badgeEl.textContent = badge;
            el.appendChild(badgeEl);
        }
    }

    _setCaption(text) {
        if (this.captionEl) this.captionEl.textContent = text;
    }

    _formatLoad(snapshot) {
        const direct = Number(snapshot.load_factor);
        if (Number.isFinite(direct)) return direct.toFixed(2);
        const size = Number(snapshot.size) || 0;
        if (!size) return '0.00';
        return (Number(snapshot.count || 0) / size).toFixed(2);
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
            this.render(step.snapshot || step, step);

            await new Promise(r => setTimeout(r, step.duration || delayMs));
        }
    }

    destroy() {
        this.currentGeneration++;
        this._slotEls.clear();
        this.container.innerHTML = '';
    }
}

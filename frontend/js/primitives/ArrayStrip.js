/**
 * ArrayStrip.js — generic array-of-cells renderer for heap / heapsort traces.
 *
 * Cells are keyed by element id so identity survives swaps. Swaps are animated
 * with a FLIP transform (instant when durationMs is 0 or reduced motion is on).
 *
 * Roles (arrays of element ids):
 *   comparing, swapping, sorted, selected, new_node, removed
 * Cells at index >= heapSize are inactive (rendered dimmed). A labelled
 * "heap | sorted" divider is drawn where the heap region ends.
 *
 * Accessibility: the container is role="list"; each cell is role="listitem"
 * with an aria-label that states its index and value (plus parent/child
 * indices when showParentChild is on). When an onSelect callback is supplied,
 * cells are focusable and respond to click, Enter and Space. All DOM is built
 * with createElement/textContent — no data-derived innerHTML.
 */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function prefersReducedMotion() {
    try {
        return typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia(REDUCED_MOTION_QUERY).matches;
    } catch (_) {
        return false;
    }
}

function asIdSet(list) {
    const set = new Set();
    if (Array.isArray(list)) {
        for (const id of list) set.add(id);
    }
    return set;
}

export class ArrayStrip {
    /**
     * @param {HTMLElement} containerEl
     * @param {Object} [options]
     * @param {(id: any, index: number) => void} [options.onSelect]
     */
    constructor(containerEl, options = {}) {
        if (!containerEl) {
            throw new Error('ArrayStrip requires a valid container element.');
        }
        this.container = containerEl;
        this.onSelect = typeof options.onSelect === 'function' ? options.onSelect : null;
        this.root = null;
        this.row = null;
        this.divider = null;
        this.cells = new Map(); // id -> element
        this.state = null;
    }

    _ensureDom(ariaLabel) {
        if (this.root) {
            if (ariaLabel && this.root.getAttribute('aria-label') !== ariaLabel) {
                this.root.setAttribute('aria-label', ariaLabel);
            }
            return;
        }
        this.container.classList.add('array-strip-container');
        const root = document.createElement('div');
        root.className = 'array-strip';
        root.setAttribute('role', 'list');
        root.setAttribute('aria-label', ariaLabel || 'Array of values');
        const row = document.createElement('div');
        row.className = 'array-strip-row';
        root.appendChild(row);
        this.container.replaceChildren(root);
        this.root = root;
        this.row = row;
    }

    _cellLabel(index, value, showParentChild) {
        const parts = [`index ${index}`, `value ${value}`];
        if (showParentChild) {
            const parent = index === 0 ? null : Math.floor((index - 1) / 2);
            parts.push(`parent ${parent === null ? 'none' : parent}`);
            parts.push(`left child ${2 * index + 1}`);
            parts.push(`right child ${2 * index + 2}`);
        }
        if (this.onSelect) parts.push('press Enter to select');
        return parts.join(', ');
    }

    _createCell(id) {
        const el = document.createElement('div');
        el.className = 'array-cell';
        el.setAttribute('role', 'listitem');
        el.dataset.id = String(id);

        const valueEl = document.createElement('span');
        valueEl.className = 'array-cell-value';
        const indexEl = document.createElement('span');
        indexEl.className = 'array-cell-index';
        el.appendChild(valueEl);
        el.appendChild(indexEl);

        if (this.onSelect) {
            el.tabIndex = 0;
            el.classList.add('array-cell-interactive');
            const activate = () => {
                const idx = Number.parseInt(el.dataset.index || '-1', 10);
                const parsedId = el.dataset.id;
                const numeric = Number(parsedId);
                const cellId = Number.isNaN(numeric) ? parsedId : numeric;
                this.onSelect(cellId, idx);
            };
            el.addEventListener('click', activate);
            el.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                    event.preventDefault();
                    activate();
                }
            });
        }

        this.cells.set(id, el);
        return el;
    }

    _makeDivider() {
        const divider = document.createElement('div');
        divider.className = 'array-strip-divider';
        divider.setAttribute('role', 'separator');
        divider.setAttribute('aria-label', 'heap | sorted boundary');
        const label = document.createElement('span');
        label.className = 'array-strip-divider-label';
        label.textContent = 'heap | sorted';
        divider.appendChild(label);
        return divider;
    }

    _apply(nextState, durationMs) {
        const state = nextState || {};
        const cells = Array.isArray(state.cells) ? state.cells : [];
        const roles = state.roles || {};
        const heapSize = Number.isFinite(state.heapSize) ? state.heapSize : cells.length;
        const showIndices = state.showIndices !== false;
        const showParentChild = state.showParentChild === true;

        this._ensureDom(state.ariaLabel);

        const comparing = asIdSet(roles.comparing);
        const swapping = asIdSet(roles.swapping);
        const sorted = asIdSet(roles.sorted);
        const selected = asIdSet(roles.selected);
        const newNode = asIdSet(roles.new_node || roles.newNode);
        const removed = asIdSet(roles.removed);

        const canAnimate = durationMs > 0 && !prefersReducedMotion();
        const before = new Map();
        if (canAnimate) {
            for (const [id, el] of this.cells) {
                before.set(id, el.getBoundingClientRect());
            }
        }

        const seen = new Set();
        const ordered = [];

        cells.forEach((cell, index) => {
            const id = cell && cell.id;
            if (id === undefined || id === null) return;
            seen.add(id);

            let el = this.cells.get(id);
            const isNew = !el;
            if (!el) el = this._createCell(id);

            const valueEl = el.querySelector('.array-cell-value');
            const indexEl = el.querySelector('.array-cell-index');
            const valueText = String(cell.value);
            if (valueEl.textContent !== valueText) valueEl.textContent = valueText;
            const indexText = showIndices ? String(index) : '';
            if (indexEl.textContent !== indexText) indexEl.textContent = indexText;

            el.dataset.index = String(index);

            const statuses = [];
            if (comparing.has(id)) statuses.push('comparing');
            if (swapping.has(id)) statuses.push('swapping');
            if (sorted.has(id)) statuses.push('in the sorted region');
            if (selected.has(id)) statuses.push('selected');
            if (newNode.has(id)) statuses.push('just added');
            if (removed.has(id)) statuses.push('removed from the heap');
            if (index >= heapSize) statuses.push('outside the heap');
            let label = this._cellLabel(index, valueText, showParentChild);
            if (statuses.length) label += `. ${statuses.join(', ')}`;
            el.setAttribute('aria-label', label);
            const classes = ['array-cell'];
            if (this.onSelect) classes.push('array-cell-interactive');
            if (comparing.has(id)) classes.push('role-comparing');
            if (swapping.has(id)) classes.push('role-swapping');
            if (sorted.has(id)) classes.push('role-sorted');
            if (selected.has(id)) classes.push('role-selected');
            if (newNode.has(id)) classes.push('role-new-node');
            if (removed.has(id)) classes.push('role-removed');
            // The sorted tail is frozen rather than disabled: dimming it would
            // make the final heapsort result look unavailable.
            if (index >= heapSize && !sorted.has(id)) classes.push('role-inactive');
            if (isNew) classes.push('array-cell-enter');
            el.className = classes.join(' ');
            if (isNew) {
                window.setTimeout(() => {
                    el.classList.remove('array-cell-enter');
                }, 500);
            }

            ordered.push(el);
        });

        // Drop cells whose elements are gone from the snapshot.
        for (const [id, el] of [...this.cells]) {
            if (!seen.has(id)) {
                el.remove();
                this.cells.delete(id);
            }
        }

        // Rebuild the row in snapshot order, inserting the boundary divider
        // exactly once at the start of the sorted region.
        const dividerAt = (heapSize > 0 && heapSize < ordered.length) ? heapSize : -1;
        if (this.divider) {
            this.divider.remove();
            this.divider = null;
        }
        const fragment = document.createDocumentFragment();
        ordered.forEach((el, index) => {
            if (index === dividerAt) {
                this.divider = this._makeDivider();
                fragment.appendChild(this.divider);
            }
            fragment.appendChild(el);
        });
        if (dividerAt === ordered.length) {
            this.divider = this._makeDivider();
            fragment.appendChild(this.divider);
        }
        this.row.replaceChildren(fragment);

        this.state = state;

        if (canAnimate && before.size > 0) {
            this._playFlip(before, durationMs);
        }
    }

    _playFlip(before, durationMs) {
        // Measure after the DOM update, then invert and animate back to zero.
        const after = new Map();
        for (const [id, el] of this.cells) {
            after.set(id, el.getBoundingClientRect());
        }
        for (const [id, el] of this.cells) {
            const prev = before.get(id);
            const next = after.get(id);
            if (!prev || !next) continue;
            const dx = prev.left - next.left;
            const dy = prev.top - next.top;
            if (!dx && !dy) continue;
            el.style.transition = 'none';
            el.style.transform = `translate(${dx}px, ${dy}px)`;
            void el.offsetWidth; // force style flush before animating
            el.style.transition = `transform ${durationMs}ms ease`;
            el.style.transform = '';
        }
        window.setTimeout(() => {
            for (const el of this.cells.values()) {
                el.style.transition = '';
                el.style.transform = '';
            }
        }, durationMs + 50);
    }

    render(container, state) {
        if (container && container !== this.container) {
            this.destroy();
            this.container = container;
        }
        this._apply(state, 0);
        return this;
    }

    update(nextState, options = {}) {
        this._apply(nextState, Number.isFinite(options.durationMs) ? options.durationMs : 0);
    }

    destroy() {
        for (const el of this.cells.values()) el.remove();
        this.cells.clear();
        if (this.root) this.root.remove();
        this.root = null;
        this.row = null;
        this.divider = null;
        this.container.classList.remove('array-strip-container');
    }
}

/**
 * Convenience factory matching the pattern used by other primitives.
 */
export function renderArrayStrip(container, state, options = {}) {
    const strip = new ArrayStrip(container, { onSelect: options.onSelect });
    strip._apply(state, Number.isFinite(options.durationMs) ? options.durationMs : 0);
    return strip;
}

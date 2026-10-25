/**
 * TreeCanvas.js — Generic SVG Tree Renderer
 * Reusable primitive for rendering node-link tree structures with auto-layout,
 * smooth transitions, role highlighting, pan/zoom, and step animations.
 */

import { toTreeCanvasSnapshot } from './treeAdapter.js';

export class TreeCanvas {
    /**
     * @param {HTMLElement} containerEl - DOM container element
     * @param {Object} [options]
     * @param {number} [options.nodeRadius=20]
     * @param {number} [options.levelHeight=70]
     */
    constructor(containerEl, options = {}) {
        if (!containerEl) {
            throw new Error("TreeCanvas requires a valid container element.");
        }
        this.container = containerEl;
        this.options = Object.assign({
            nodeRadius: 20,
            levelHeight: 70
        }, options);

        this.isPaused = false;
        this.currentGeneration = 0;
        this.currentSteps = [];
        this.currentStepIndex = 0;

        // Viewport transform (pan / zoom)
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };

        this._initDOM();
        this._bindEvents();
    }

    _initDOM() {
        this.container.classList.add('tree-canvas-container');
        this.container.innerHTML = `
            <svg class="tree-canvas-svg" width="100%" height="100%">
                <g class="tree-viewport">
                    <g class="edges-layer"></g>
                    <g class="nodes-layer"></g>
                </g>
            </svg>
            <div class="tree-controls-overlay">
                <button class="btn-fit-view" title="Reset View">Fit View</button>
            </div>
        `;

        this.svgEl = this.container.querySelector('svg');
        this.viewportG = this.container.querySelector('.tree-viewport');
        this.edgesLayer = this.container.querySelector('.edges-layer');
        this.nodesLayer = this.container.querySelector('.nodes-layer');

        this.container.querySelector('.btn-fit-view').addEventListener('click', () => this.fitView());
    }

    _bindEvents() {
        let startPos = { x: 0, y: 0 };

        this.wasDragging = false;

        // Pan
        this.svgEl.addEventListener('pointerdown', (e) => {
            if (e.target.tagName === 'button') return;
            startPos = { x: e.clientX, y: e.clientY };
            this.dragStart = { x: e.clientX - this.panX, y: e.clientY - this.panY };
        });

        this.svgEl.addEventListener('pointermove', (e) => {
            if (!startPos.x && !startPos.y) return;
            const dist = Math.hypot(e.clientX - startPos.x, e.clientY - startPos.y);
            if (dist > 4) {
                if (!this.isDragging) {
                    this.isDragging = true;
                    this.wasDragging = true;
                    try { this.svgEl.setPointerCapture(e.pointerId); } catch (_) {}
                }
                this.panX = e.clientX - this.dragStart.x;
                this.panY = e.clientY - this.dragStart.y;
                this._updateTransform();
            }
        });

        const stopDrag = (e) => {
            if (this.isDragging) {
                this.isDragging = false;
                try { this.svgEl.releasePointerCapture(e.pointerId); } catch (_) {}
            }
            startPos = { x: 0, y: 0 };
            setTimeout(() => { this.wasDragging = false; }, 50);
        };
        this.svgEl.addEventListener('pointerup', stopDrag);
        this.svgEl.addEventListener('pointercancel', stopDrag);

        // Zoom
        this.svgEl.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
            const newZoom = Math.min(Math.max(this.zoom * zoomFactor, 0.3), 3.0);
            
            // Zoom towards cursor
            const rect = this.svgEl.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
            this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
            this.zoom = newZoom;

            this._updateTransform();
        }, { passive: false });

        // Resize
        this.resizeObserver = new ResizeObserver(() => this.fitView());
        this.resizeObserver.observe(this.container);
    }

    _updateTransform() {
        this.viewportG.setAttribute('transform', `translate(${this.panX}, ${this.panY}) scale(${this.zoom})`);
    }

    /**
     * Compute positions for a tree snapshot using hierarchical layout.
     */
    _computeLayout(treeSnapshot) {
        const { nodes, edges, rootId } = treeSnapshot;
        if (!nodes || nodes.length === 0) return new Map();

        const nodeMap = new Map();
        const childrenMap = new Map();
        const leftMap = new Map();
        const rightMap = new Map();
        let hasSideEdges = false;

        nodes.forEach(n => {
            nodeMap.set(n.id, n);
            childrenMap.set(n.id, []);
        });

        edges.forEach(e => {
            if (childrenMap.has(e.from)) {
                childrenMap.get(e.from).push(e.to);
            }
            if (e.side === 'left') {
                leftMap.set(e.from, e.to);
                hasSideEdges = true;
            } else if (e.side === 'right') {
                rightMap.set(e.from, e.to);
                hasSideEdges = true;
            }
        });

        // Determine root if not explicitly provided
        let actualRootId = rootId;
        if (actualRootId === null || actualRootId === undefined) {
            if (nodes.length > 0) {
                const hasParent = new Set(edges.map(e => e.to));
                const rootCandidate = nodes.find(n => !hasParent.has(n.id));
                actualRootId = rootCandidate ? rootCandidate.id : nodes[0].id;
            }
        }

        const positions = new Map();
        let nextX = 0;

        if (hasSideEdges) {
            // Calculate max depth of tree
            const getDepth = (id) => {
                const left = leftMap.get(id);
                const right = rightMap.get(id);
                let ld = left !== undefined ? getDepth(left) : 0;
                let rd = right !== undefined ? getDepth(right) : 0;
                return 1 + Math.max(ld, rd);
            };

            const maxTreeDepth = (actualRootId !== null && actualRootId !== undefined) ? getDepth(actualRootId) : 1;
            const baseUnit = Math.max(40, Math.min(70, 260 / Math.pow(2, Math.max(0, maxTreeDepth - 2))));

            const layoutBinaryNode = (id, x, depth) => {
                if (id === null || id === undefined || !childrenMap.has(id)) return;
                positions.set(id, { x: x, y: depth * this.options.levelHeight });

                const offset = baseUnit * Math.pow(2, Math.max(0, maxTreeDepth - depth - 2));

                const leftChild = leftMap.get(id);
                if (leftChild !== undefined) {
                    layoutBinaryNode(leftChild, x - offset, depth + 1);
                }

                const rightChild = rightMap.get(id);
                if (rightChild !== undefined) {
                    layoutBinaryNode(rightChild, x + offset, depth + 1);
                }
            };

            if (actualRootId !== null && actualRootId !== undefined) {
                layoutBinaryNode(actualRootId, 0, 0);
            }
        } else {
            // Generic tree hierarchical layout
            const setupX = (id, depth = 0) => {
                const children = childrenMap.get(id) || [];
                if (children.length === 0) {
                    positions.set(id, { x: nextX * 65, y: depth * this.options.levelHeight });
                    nextX += 1;
                } else {
                    children.forEach(childId => setupX(childId, depth + 1));
                    const firstChildX = positions.get(children[0]).x;
                    const lastChildX = positions.get(children[children.length - 1]).x;
                    const midX = (firstChildX + lastChildX) / 2;
                    positions.set(id, { x: midX, y: depth * this.options.levelHeight });
                }
            };

            if (actualRootId !== null && actualRootId !== undefined && childrenMap.has(actualRootId)) {
                setupX(actualRootId, 0);
            }
        }

        // Fallback for any unpositioned or disconnected nodes
        nodes.forEach(n => {
            if (!positions.has(n.id)) {
                positions.set(n.id, { x: nextX * 65, y: 0 });
                nextX += 1;
            }
        });

        return positions;
    }

    /**
     * Render a single snapshot with layout and role highlighting.
     */
    render(snapshot, stepRoles = {}) {
        this.lastRawSnapshot = snapshot;
        this.lastStepRoles = stepRoles;

        const treeSnap = toTreeCanvasSnapshot(snapshot);
        const positions = this._computeLayout(treeSnap);
        this.lastPositions = positions;

        // Render Edges
        this.edgesLayer.innerHTML = '';
        treeSnap.edges.forEach(e => {
            const fromPos = positions.get(e.from);
            const toPos = positions.get(e.to);
            if (fromPos && toPos) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('class', 'tree-edge');
                line.setAttribute('x1', fromPos.x);
                line.setAttribute('y1', fromPos.y);
                line.setAttribute('x2', toPos.x);
                line.setAttribute('y2', toPos.y);
                this.edgesLayer.appendChild(line);
            }
        });

        // Render Nodes
        this.nodesLayer.innerHTML = '';
        treeSnap.nodes.forEach(n => {
            const pos = positions.get(n.id) || { x: 0, y: 0 };
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            
            let classList = ['tree-node'];
            if (stepRoles.highlighted?.includes(n.id)) classList.push('node-highlight');
            if (stepRoles.comparing?.includes(n.id)) classList.push('node-compare');
            if (stepRoles.rotating?.includes(n.id)) classList.push('node-rotate');
            if (stepRoles.pruned?.includes(n.id)) classList.push('node-pruned');
            if (stepRoles.new_node?.includes(n.id)) classList.push('node-new');
            if (stepRoles.selected?.includes(n.id)) classList.push('node-selected');

            g.setAttribute('class', classList.join(' '));
            g.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
            g.setAttribute('data-id', n.id);

            if (this.options.onNodeClick) {
                g.style.cursor = 'pointer';
                g.addEventListener('click', (evt) => {
                    evt.stopPropagation();
                    if (this.wasDragging) return;
                    this.options.onNodeClick(n.id, n.label);
                });
            }

            const labelStr = String(n.label ?? '');
            const len = labelStr.length;

            // Scale circle radius based on label length at fixed font size (~5.2px radius per character + 6px padding)
            const dynamicRadius = Math.max(this.options.nodeRadius, Math.floor(len * 5.2) + 6);

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('r', dynamicRadius);

            const textLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textLabel.setAttribute('class', 'node-label');
            textLabel.setAttribute('dy', n.sublabel ? '-4' : '0');
            textLabel.textContent = labelStr;

            g.appendChild(circle);
            g.appendChild(textLabel);

            if (n.sublabel) {
                const textSub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                textSub.setAttribute('class', 'node-sublabel');
                textSub.setAttribute('dy', '12');
                textSub.textContent = n.sublabel;
                g.appendChild(textSub);
            }

            this.nodesLayer.appendChild(g);
        });
    }

    /**
     * Auto-fits the viewport transform to center and contain the full tree layout.
     */
    fitView() {
        if (!this.lastPositions || this.lastPositions.size === 0) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        this.lastPositions.forEach(pos => {
            if (pos.x < minX) minX = pos.x;
            if (pos.x > maxX) maxX = pos.x;
            if (pos.y < minY) minY = pos.y;
            if (pos.y > maxY) maxY = pos.y;
        });

        const padding = 60;
        const width = (maxX - minX) + padding * 2;
        const height = (maxY - minY) + padding * 2;

        const rect = this.container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const scaleX = rect.width / width;
        const scaleY = rect.height / height;
        this.zoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.4), 1.5);

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        this.panX = (rect.width / 2) - (centerX * this.zoom);
        this.panY = (rect.height / 2) - (centerY * this.zoom) + 20;

        this._updateTransform();
    }

    /**
     * Animate a sequence of backend steps step-by-step.
     * Handles rotation tweening when step includes snapshot_before & snapshot_after.
     */
    async animateSteps(steps, delayMs = 600) {
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

            // Rotation step tweening
            if (step.snapshot_before && step.snapshot_after) {
                this.render(step.snapshot_before, step);
                this.fitView();
                await new Promise(r => setTimeout(r, delayMs / 2));
                if (generation !== this.currentGeneration) return;
                this.render(step.snapshot_after, step);
            } else {
                this.render(step.snapshot, step);
                if (i === 0) this.fitView();
            }

            await new Promise(r => setTimeout(r, step.duration || delayMs));
        }
    }

    seek(stepIndex) {
        if (!this.currentSteps || stepIndex < 0 || stepIndex >= this.currentSteps.length) return;
        this.currentStepIndex = stepIndex;
        const step = this.currentSteps[stepIndex];
        const snapshot = step.snapshot || step.snapshot_after || step.snapshot_before;
        this.render(snapshot, step);
    }

    highlightSelectedNode(nodeId) {
        if (!this.lastRawSnapshot) return;
        const newRoles = Object.assign({}, this.lastStepRoles, { selected: [nodeId] });
        this.render(this.lastRawSnapshot, newRoles);
    }

    destroy() {
        this.currentGeneration++;
        if (this.resizeObserver) this.resizeObserver.disconnect();
        this.container.innerHTML = '';
    }
}

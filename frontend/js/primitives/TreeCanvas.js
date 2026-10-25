/**
 * TreeCanvas.js — Generic SVG Tree Renderer
 * Reusable primitive for rendering node-link tree structures with auto-layout,
 * smooth transitions, role highlighting, pan/zoom, and step animations.
 */

import { toTreeCanvasSnapshot } from './treeAdapter.js';

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

function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}


function roleBadgeText(stepRoles, id) {
    if (!stepRoles) return null;
    const has = (role) => {
        if (Array.isArray(stepRoles[role]) && stepRoles[role].includes(id)) return true;
        for (const k of Object.keys(stepRoles)) {
            if (k === role || k.startsWith(role + '_')) {
                if (Array.isArray(stepRoles[k]) && stepRoles[k].includes(id)) return true;
            }
        }
        return false;
    };
    if (has('probing')) return '?';
    if (has('mismatch')) return '\u2260';
    if (has('created')) return '+';
    if (has('matched')) return '\u2713';
    return null;
}

export class TreeCanvas {
    /**
     * @param {HTMLElement} containerEl - DOM container element
     * @param {Object} [options]
     * @param {number} [options.nodeRadius=20]
     * @param {number} [options.levelHeight=70]
     * @param {number} [options.tweenMs=0] - opt-in position tween duration.
     *   Defaults to 0, which keeps the original instant redraw behaviour.
     */
    constructor(containerEl, options = {}) {
        if (!containerEl) {
            throw new Error("TreeCanvas requires a valid container element.");
        }
        this.container = containerEl;
        this.options = Object.assign({
            nodeRadius: 20,
            levelHeight: 70,
            tweenMs: 0,
            layout: 'auto'
        }, options);

        this.isPaused = false;
        this.currentGeneration = 0;
        this.currentSteps = [];
        this.currentStepIndex = 0;

        // Keyed DOM so node/edge identity survives re-renders (tweening).
        this._nodeEls = new Map();     // node id -> <g>
        this._edgeEls = new Map();     // "from->to" -> <line>
        this._nodeData = new Map();    // node id -> latest {label, sublabel}
        this._renderedPositions = new Map();
        this._tweenRaf = 0;

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
        const forceNary = this.options.layout === 'nary';
        const forceBinary = this.options.layout === 'binary';

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

        if (!forceNary && (forceBinary || hasSideEdges)) {
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

    _tweenDuration() {
        const ms = Number(this.options.tweenMs);
        if (!Number.isFinite(ms) || ms <= 0) return 0;
        if (prefersReducedMotion()) return 0;
        return Math.min(ms, 600);
    }

    _createNodeEl(id) {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'tree-node');
        g.setAttribute('data-id', String(id));

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', 'node-shape');
        const textLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textLabel.setAttribute('class', 'node-label');
        g.appendChild(circle);
        g.appendChild(textLabel);

        if (this.options.onNodeClick) {
            g.style.cursor = 'pointer';
            g.setAttribute('tabindex', '0');
            g.setAttribute('role', 'button');
            const activate = () => {
                if (this.wasDragging) return;
                const data = this._nodeData.get(id) || {};
                this.options.onNodeClick(id, data.label);
            };
            g.addEventListener('click', (evt) => {
                evt.stopPropagation();
                activate();
            });
            g.addEventListener('keydown', (evt) => {
                if (evt.key === 'Enter' || evt.key === ' ' || evt.key === 'Spacebar') {
                    evt.preventDefault();
                    activate();
                }
            });
        }
        return g;
    }

    _applyNodeClasses(g, n, stepRoles, pathIds) {
        const id = n.id;
        const classList = ['tree-node'];
        if (pathIds.includes(id)) classList.push('path');
        if (stepRoles.highlighted?.includes(id)) classList.push('node-highlight');
        if (stepRoles.comparing?.includes(id) || stepRoles.comparing_a?.includes(id) || stepRoles.comparing_b?.includes(id)) classList.push('node-compare');
        if (stepRoles.matched_a?.includes(id) || stepRoles.matched_b?.includes(id)) classList.push('node-matched');
        if (stepRoles.mismatch_a?.includes(id) || stepRoles.mismatch_b?.includes(id)) classList.push('node-mismatch');
        const hasRole = (role) => {
            if (Array.isArray(stepRoles[role]) && stepRoles[role].includes(id)) return true;
            for (const k of Object.keys(stepRoles || {})) {
                if (k === role || k.startsWith(role + '_')) {
                    if (Array.isArray(stepRoles[k]) && stepRoles[k].includes(id)) return true;
                }
            }
            return false;
        };
        if (hasRole('created')) classList.push('node-created');
        if (hasRole('reused')) classList.push('node-reused');
        if (hasRole('matched')) classList.push('node-matched');
        if (hasRole('probing')) classList.push('node-probing');
        if (hasRole('mismatch')) classList.push('node-mismatch');
        if (n.terminal) classList.push('node-terminal');
        if (n.duplicate_of !== null && n.duplicate_of !== undefined) classList.push('node-dup');
        if (stepRoles.rotating?.includes(id)) classList.push('node-rotate');
        if (stepRoles.unbalanced?.includes(id)) classList.push('node-unbalanced');
        if (stepRoles.pruned?.includes(id)) classList.push('node-pruned');
        if (stepRoles.new_node?.includes(id)) classList.push('node-new');
        if (stepRoles.selected?.includes(id)) classList.push('node-selected');
        g.setAttribute('class', classList.join(' '));
    }

    _edgeClasses(e, stepRoles, pathIds) {
        const edgeClasses = ['tree-edge'];
        const fromIdx = pathIds.indexOf(e.from);
        const toIdx = pathIds.indexOf(e.to);
        const isConsecutivePath = fromIdx !== -1 && toIdx !== -1 && toIdx === fromIdx + 1;
        const isFinalInsertEdge = stepRoles.type === 'insert' &&
            pathIds.length > 0 &&
            e.from === pathIds[pathIds.length - 1] &&
            (stepRoles.new_node?.includes(e.to) || stepRoles.node_ids?.includes(e.to));
        if (isConsecutivePath || isFinalInsertEdge) edgeClasses.push('path');
        return edgeClasses.join(' ');
    }

    _updateNodeEl(g, n, stepRoles, pathIds) {
        const labelStr = String(n.label ?? '');
        const subStr = n.sublabel ? String(n.sublabel) : '';
        this._nodeData.set(n.id, { label: labelStr, sublabel: subStr });

        this._applyNodeClasses(g, n, stepRoles, pathIds);

        const circle = g.querySelector('circle.node-shape');
        const textLabel = g.querySelector('.node-label');
        const len = Math.max(labelStr.length, Math.ceil(subStr.length * 0.75));
        // Scale circle radius by label length (~5.2px per character + 6px padding).
        const dynamicRadius = Math.max(this.options.nodeRadius, Math.floor(len * 5.2) + 6);
        circle.setAttribute('r', dynamicRadius);

        // Terminal double ring (tries). Drawn behind the main circle.
        let termRing = g.querySelector('.node-terminal-ring');
        if (n.terminal) {
            if (!termRing) {
                termRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                termRing.setAttribute('class', 'node-terminal-ring');
                g.insertBefore(termRing, g.firstChild);
            }
            termRing.setAttribute('r', String(dynamicRadius + 6));
            termRing.setAttribute('cx', '0');
            termRing.setAttribute('cy', '0');
        } else if (termRing) {
            termRing.remove();
        }

        // Duplicate badge (Merkle duplicate-last policy).
        let dupBadge = g.querySelector('.node-dup-badge');
        if (n.duplicate_of !== null && n.duplicate_of !== undefined) {
            if (!dupBadge) {
                dupBadge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                dupBadge.setAttribute('class', 'node-dup-badge');
                dupBadge.setAttribute('dy', '-18');
                g.appendChild(dupBadge);
            }
            if (dupBadge.textContent !== 'dup') dupBadge.textContent = 'dup';
        } else if (dupBadge) {
            dupBadge.remove();
        }

        // Role cue badge. Terminal / duplicate nodes keep their own marker so
        // the two cues never overwrite each other.
        let roleBadge = g.querySelector('.node-role-badge');
        const isSpecial = !!n.terminal || (n.duplicate_of !== null && n.duplicate_of !== undefined);
        const rbText = isSpecial ? null : roleBadgeText(stepRoles, n.id);
        if (rbText) {
            if (!roleBadge) {
                roleBadge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                roleBadge.setAttribute('class', 'node-role-badge');
                roleBadge.setAttribute('dy', '-18');
                g.appendChild(roleBadge);
            }
            if (roleBadge.textContent !== rbText) roleBadge.textContent = rbText;
        } else if (roleBadge) {
            roleBadge.remove();
        }

        if (textLabel.textContent !== labelStr) textLabel.textContent = labelStr;
        textLabel.setAttribute('dy', subStr ? '-4' : '0');

        let textSub = g.querySelector('.node-sublabel');
        if (subStr) {
            if (!textSub) {
                textSub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                textSub.setAttribute('class', 'node-sublabel');
                textSub.setAttribute('dy', '12');
                g.appendChild(textSub);
            }
            if (textSub.textContent !== subStr) textSub.textContent = subStr;
        } else if (textSub) {
            textSub.remove();
        }

        // Accessible name: every node is reachable even without onNodeClick.
        const ariaParts = [`Node ${labelStr}`];
        if (subStr) ariaParts.push(subStr);
        if (n.terminal) ariaParts.push('end of word');
        if (n.duplicate_of !== null && n.duplicate_of !== undefined) ariaParts.push('duplicate');
        g.setAttribute('aria-label', ariaParts.join(', '));
    }

    _renderNodes(treeSnap, stepRoles, positions, pathIds, duration) {
        const seen = new Set();
        treeSnap.nodes.forEach(n => {
            seen.add(n.id);
            let g = this._nodeEls.get(n.id);
            const isNew = !g;
            if (!g) {
                g = this._createNodeEl(n.id);
                this._nodeEls.set(n.id, g);
                this.nodesLayer.appendChild(g);
                if (duration > 0) {
                    g.classList.add('node-entering');
                    window.setTimeout(() => g.classList.remove('node-entering'), duration);
                }
            }
            this._updateNodeEl(g, n, stepRoles, pathIds);
        });

        for (const [id, g] of [...this._nodeEls]) {
            if (seen.has(id)) continue;
            this._nodeEls.delete(id);
            this._nodeData.delete(id);
            if (duration > 0) {
                g.classList.add('node-leaving');
                window.setTimeout(() => g.remove(), duration);
            } else {
                g.remove();
            }
        }
    }

    _renderEdges(treeSnap, stepRoles, pathIds) {
        const seen = new Set();
        treeSnap.edges.forEach(e => {
            const key = `${e.from}->${e.to}`;
            seen.add(key);
            let rec = this._edgeEls.get(key);
            if (!rec) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                rec = { el: line, from: e.from, to: e.to };
                this._edgeEls.set(key, rec);
                this.edgesLayer.appendChild(line);
            }
            rec.el.setAttribute('class', this._edgeClasses(e, stepRoles, pathIds));
        });

        for (const [key, rec] of [...this._edgeEls]) {
            if (seen.has(key)) continue;
            rec.el.remove();
            this._edgeEls.delete(key);
        }
    }

    /**
     * Write positions into the keyed DOM. `frame` is the interpolated map and
     * `targets` is the final map (used as a fallback for nodes in flight).
     */
    _applyPositions(frame, targets) {
        for (const [id, g] of this._nodeEls) {
            const p = frame.get(id) || targets.get(id);
            if (!p) continue;
            g.setAttribute('transform', `translate(${p.x}, ${p.y})`);
        }
        for (const rec of this._edgeEls.values()) {
            const a = frame.get(rec.from) || targets.get(rec.from);
            const b = frame.get(rec.to) || targets.get(rec.to);
            if (!a || !b) continue;
            rec.el.setAttribute('x1', a.x);
            rec.el.setAttribute('y1', a.y);
            rec.el.setAttribute('x2', b.x);
            rec.el.setAttribute('y2', b.y);
        }
    }

    _startTween(targetPositions, duration) {
        const start = new Map();
        for (const [id, target] of targetPositions) {
            const prev = this._renderedPositions.get(id);
            start.set(id, prev ? { x: prev.x, y: prev.y } : { x: target.x, y: target.y });
        }
        const startedAt = (typeof performance !== 'undefined' && performance.now)
            ? performance.now()
            : Date.now();

        const tick = () => {
            const now = (typeof performance !== 'undefined' && performance.now)
                ? performance.now()
                : Date.now();
            const t = Math.min(1, Math.max(0, (now - startedAt) / duration));
            const k = easeOutCubic(t);
            const frame = new Map();
            for (const [id, target] of targetPositions) {
                const s = start.get(id) || target;
                frame.set(id, {
                    x: s.x + (target.x - s.x) * k,
                    y: s.y + (target.y - s.y) * k
                });
            }
            this._applyPositions(frame, targetPositions);
            this._renderedPositions = frame;
            if (t < 1) {
                this._tweenRaf = requestAnimationFrame(tick);
            } else {
                this._tweenRaf = 0;
                this._renderedPositions = new Map(targetPositions);
                this._applyPositions(targetPositions, targetPositions);
            }
        };
        this._tweenRaf = requestAnimationFrame(tick);
    }

    /**
     * Render a single snapshot with layout and role highlighting.
     *
     * With the default `tweenMs: 0` this is the original instant redraw, except
     * that DOM elements are keyed by node id instead of being rebuilt. With
     * `tweenMs > 0` positions interpolate from the previous frame, while node
     * and edge elements keep their identity (so focus and handlers survive).
     */
    render(snapshot, stepRoles = {}) {
        this.lastRawSnapshot = snapshot;
        this.lastStepRoles = stepRoles;

        const treeSnap = toTreeCanvasSnapshot(snapshot);
        const positions = this._computeLayout(treeSnap);
        this.lastPositions = positions;

        const duration = this._tweenDuration();
        if (this._tweenRaf) {
            cancelAnimationFrame(this._tweenRaf);
            this._tweenRaf = 0;
        }

        // Path IDs visited so far (root first)
        const pathIds = Array.isArray(stepRoles.payload?.path) ? stepRoles.payload.path : [];

        this._renderNodes(treeSnap, stepRoles, positions, pathIds, duration);
        this._renderEdges(treeSnap, stepRoles, pathIds);

        if (duration > 0) {
            this._startTween(positions, duration);
        } else {
            this._renderedPositions = new Map(positions);
            this._applyPositions(positions, positions);
        }
    }

    /**
     * Auto-fits the viewport transform to center and contain the full tree layout.
     */
    fitView(animate = false) {
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

        if (animate && this.viewportG) {
            this.viewportG.style.transition = 'transform 0.4s ease';
            this._updateTransform();
            setTimeout(() => {
                if (this.viewportG) this.viewportG.style.transition = '';
            }, 450);
        } else {
            if (this.viewportG) this.viewportG.style.transition = '';
            this._updateTransform();
        }
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
        if (this._tweenRaf) {
            cancelAnimationFrame(this._tweenRaf);
            this._tweenRaf = 0;
        }
        this._nodeEls.clear();
        this._edgeEls.clear();
        this._nodeData.clear();
        this._renderedPositions.clear();
        if (this.resizeObserver) this.resizeObserver.disconnect();
        this.container.innerHTML = '';
    }
}

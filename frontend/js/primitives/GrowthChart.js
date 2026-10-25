/**
 * GrowthChart.js — Generic Empirical Big-O Line & Scatter Chart Primitive
 * Wraps Chart.js to plot empirical execution times against theoretical Big-O curves.
 */

export class GrowthChart {
    /**
     * @param {HTMLElement} containerEl - Container element
     * @param {Object} [options]
     */
    constructor(containerEl, options = {}) {
        if (!containerEl) {
            throw new Error("GrowthChart requires a valid container element.");
        }
        this.container = containerEl;
        this.options = options;
        this.chart = null;

        this._initDOM();
    }

    _initDOM() {
        this.container.classList.add('growth-chart-container');
        this.container.innerHTML = `<canvas class="growth-chart-canvas"></canvas>`;
        this.canvasEl = this.container.querySelector('canvas');
    }

    /**
     * Render series data.
     * seriesArray shape:
     * [
     *   { id: 'bubble', label: 'Bubble Sort (measured)', type: 'scatter', color: '#f97316', points: [{x:10, y:0.5}] },
     *   { id: 'n2', label: 'O(n²)', type: 'line', color: '#f97316', dashed: true, points: [...] }
     * ]
     */
    render(seriesArray = []) {
        if (typeof window.Chart === 'undefined') {
            console.warn("Chart.js is not loaded on this page. Load Chart.js CDN first.");
            return;
        }

        if (this.chart) {
            this.chart.destroy();
        }

        const datasets = seriesArray.map(s => {
            return {
                label: s.label,
                data: s.points || [],
                borderColor: s.color || '#38bdf8',
                backgroundColor: s.color || '#38bdf8',
                borderDash: s.dashed ? [6, 6] : [],
                showLine: s.type === 'line' || s.type === 'scatter',
                pointRadius: s.type === 'scatter' ? 5 : 0,
                tension: 0.3
            };
        });

        const ctx = this.canvasEl.getContext('2d');
        this.chart = new window.Chart(ctx, {
            type: 'scatter',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: 'Input Size (n)', color: '#94a3b8' },
                        grid: { color: '#334155' },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        title: { display: true, text: 'Time (ms)', color: '#94a3b8' },
                        grid: { color: '#334155' },
                        ticks: { color: '#94a3b8' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#f8fafc' }
                    }
                }
            }
        });
    }

    appendPoint(seriesId, x, y) {
        if (!this.chart) return;
        const dataset = this.chart.data.datasets.find(d => d.label.includes(seriesId));
        if (dataset) {
            dataset.data.push({ x, y });
            this.chart.update();
        }
    }

    highlight(seriesId) {
        if (!this.chart) return;
        this.chart.data.datasets.forEach(d => {
            if (d.label.includes(seriesId)) {
                d.borderWidth = 3;
            } else {
                d.borderWidth = 1;
            }
        });
        this.chart.update();
    }

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        this.container.innerHTML = '';
    }
}

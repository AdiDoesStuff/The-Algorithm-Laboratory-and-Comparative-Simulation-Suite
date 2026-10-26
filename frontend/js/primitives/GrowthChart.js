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
        this.container.innerHTML = `
            <canvas class="growth-chart-canvas"></canvas>
            <p class="growth-chart-empty" hidden>Run a benchmark to plot growth curves.</p>
        `;
        this.canvasEl = this.container.querySelector('canvas');
        this.emptyEl = this.container.querySelector('.growth-chart-empty');
    }

    _showEmpty(show, message) {
        if (!this.emptyEl) return;
        this.emptyEl.hidden = !show;
        if (message) this.emptyEl.textContent = message;
        this.canvasEl.hidden = show;
    }

    /**
     * Render series data.
     * seriesArray shape:
     * [
     *   { id: 'bubble', label: 'Bubble Sort (measured)', type: 'scatter', color: '#f97316', points: [{x:10, y:0.5}] },
     *   { id: 'n2', label: 'O(n²)', type: 'line', color: '#f97316', dashed: true, points: [...] }
     * ]
     *
     * renderOptions (optional, overrides this.options for this render):
     *   { metric: 'comparisons' | 'time', log: boolean }
     */
    render(seriesArray = [], renderOptions = {}) {
        if (typeof window.Chart === 'undefined') {
            console.warn("Chart.js is not loaded on this page. Load Chart.js CDN first.");
            this._showEmpty(true, 'Chart.js failed to load, so the chart cannot be drawn.');
            return;
        }

        const opts = { ...this.options, ...renderOptions };
        const metric = opts.metric === 'time' ? 'time' : 'comparisons';
        const useLog = !!opts.log;
        const valueTitle = metric === 'time' ? 'Median time (ms)' : 'Comparisons';

        const safeSeries = (Array.isArray(seriesArray) ? seriesArray : [])
            .filter(s => s && s.label != null && Array.isArray(s.points) && s.points.length);

        const datasets = safeSeries.map(s => {
            const data = s.points
                .map(p => ({ x: Number(p?.x), y: Number(p?.y) }))
                .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y))
                // A log axis cannot plot zero or negative values.
                .filter(p => !useLog || (p.x > 0 && p.y > 0));

            return {
                label: String(s.label),
                data,
                borderColor: s.color || '#38bdf8',
                backgroundColor: s.color || '#38bdf8',
                borderDash: s.dashed ? [6, 6] : [],
                borderWidth: 2,
                showLine: s.type === 'line' || s.type === 'scatter',
                pointRadius: s.type === 'scatter' ? 4 : 0,
                pointHoverRadius: 6,
                tension: 0.3
            };
        }).filter(d => d.data.length);

        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }

        if (!datasets.length) {
            this._showEmpty(true, 'Run a benchmark to plot growth curves.');
            return;
        }
        this._showEmpty(false);

        const axis = (title) => ({
            type: useLog ? 'logarithmic' : 'linear',
            title: { display: true, text: title, color: '#94a3b8' },
            grid: { color: '#334155' },
            ticks: { color: '#94a3b8' }
        });

        const ctx = this.canvasEl.getContext('2d');
        this.chart = new window.Chart(ctx, {
            type: 'scatter',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 200 },
                interaction: { mode: 'nearest', intersect: false },
                scales: {
                    x: { ...axis(useLog ? 'Input Size n (log)' : 'Input Size (n)'), beginAtZero: !useLog },
                    y: { ...axis(useLog ? `${valueTitle} (log)` : valueTitle), beginAtZero: !useLog }
                },
                plugins: {
                    legend: {
                        labels: { color: '#f8fafc' }
                    },
                    tooltip: {
                        callbacks: {
                            label: (item) => {
                                const y = metric === 'time'
                                    ? `${item.parsed.y.toFixed(3)} ms`
                                    : `${Math.round(item.parsed.y).toLocaleString()} comparisons`;
                                return `${item.dataset.label} · n=${item.parsed.x}: ${y}`;
                            }
                        }
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

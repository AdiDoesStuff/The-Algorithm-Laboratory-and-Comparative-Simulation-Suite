let currentLabArray = [];
let isPaused = false;
let isRunning = false;
let currentGeneration = 0;
let bgMatrix = null;

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

async function startComparison() {
    if (isRunning) return;

    const leftAlgo = document.getElementById('algo-left').value;
    const rightAlgo = document.getElementById('algo-right').value;

    isRunning = true;
    const startBtn = document.querySelector("button[onclick='startComparison()']");
    if (startBtn) startBtn.disabled = true;

    document.getElementById('count-left').innerText = '0';
    document.getElementById('count-right').innerText = '0';

    try {
        const [leftData, rightData] = await Promise.all([
            fetchSortSteps(leftAlgo, currentLabArray),
            fetchSortSteps(rightAlgo, currentLabArray)
        ]);

        if (!leftData || !rightData) {
            throw new Error("Backend returned null. Check your Python terminal for errors!");
        }

        if (!leftData.steps || !rightData.steps) {
            throw new Error("Data received, but '.steps' key is missing! Check your algs.py return statements.");
        }

        document.getElementById('time-left').innerText = leftData.execution_time.toFixed(4);
        document.getElementById('time-right').innerText = rightData.execution_time.toFixed(4);

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

function resetLab() {
    isPaused = false;
    isRunning = false;
    document.getElementById('pause-btn').innerText = 'Pause';
    generateNewArray();
}

function generateNewArray() {
    currentGeneration++;
    const count = parseInt(document.getElementById('element-slider').value);
    currentLabArray = Array.from({ length: count }, () => Math.floor(Math.random() * 50) + 10);

    updateBars(document.getElementById('visualizer-left'), currentLabArray, [], '');
    updateBars(document.getElementById('visualizer-right'), currentLabArray, [], '');

    document.getElementById('count-left').innerText = '0';
    document.getElementById('count-right').innerText = '0';
}

function updateElementCount() {
    const val = document.getElementById('element-slider').value;
    document.getElementById('element-val').innerText = val;
    generateNewArray();
}

function updateSpeedDisplay() {
    const val = document.getElementById('speed-slider').value;
    document.getElementById('speed-val').innerText = `${val}x`;
}

function enterApp() {
    const btn = document.querySelector('.btn-go');
    if (btn) btn.disabled = true;

    const title = document.querySelector('.landing-title');
    if (title) title.classList.add('title-sorted');

    if (bgMatrix) {
        bgMatrix.startSorting(() => {
            setTimeout(executeTransition, 400);
        });
    } else {
        executeTransition();
    }
}

function executeTransition() {
    const landing = document.getElementById('landing-page');
    const app = document.getElementById('main-app');

    landing.classList.add('slide-up-fade');

    setTimeout(() => {
        landing.style.display = 'none';
        app.classList.remove('app-hidden');
        app.classList.add('app-enter');
    }, 800);
}

class MatrixBackground {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        this.chars = '0123456789'.split('');
        this.colors = ['#1e293b', '#2b4539', '#61b3dc', '#38bdf8', '#475569'];
        this.sortedColor = '#34d399';

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
        if (!hex) return { r: 0, g: 0, b: 0 };
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
        return { r: 0, g: 0, b: 0 };
    }

    interpolateColor(start, end, factor) {
        const r = Math.round(start.r + (end.r - start.r) * factor);
        const g = Math.round(start.g + (end.g - start.g) * factor);
        const b = Math.round(start.b + (end.b - start.b) * factor);
        return `rgb(${r}, ${g}, ${b})`;
    }

    updateLetters() {
        if (!this.letters.length || this.isSorting) return;
        const updateCount = Math.max(1, Math.floor(this.letters.length * 0.05));

        for (let i = 0; i < updateCount; i++) {
            const index = Math.floor(Math.random() * this.letters.length);
            if (this.letters[index] && !this.letters[index].isSorted) {
                this.letters[index].char = this.getRandomChar();
                this.letters[index].targetColor = this.getRandomColor();
                this.letters[index].colorProgress = 0;
            }
        }
    }

    handleSmoothTransitions() {
        let needsRedraw = false;
        this.letters.forEach(letter => {
            if (letter.colorProgress < 1) {
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

        const chunkSize = Math.max(30, Math.floor(this.letters.length / 40));

        for (let i = 0; i < chunkSize; i++) {
            if (this.sortIndex < this.letters.length) {
                const l = this.letters[this.sortIndex];
                l.char = (this.sortIndex % 10).toString();
                l.targetColor = this.sortedColor;
                l.colorProgress = 0;
                l.isSorted = true;
                this.sortIndex++;
            } else {
                this.isSorting = false;
                if (this.onComplete) this.onComplete();
                break;
            }
        }

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

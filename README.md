<div align="center">

# 🧪 The Algorithm Laboratory & Comparative Simulation Suite

**An advanced, full-stack educational platform for real-time visualization and comparative analysis of sorting algorithms.**

[![Python Badge](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=fff&style=for-the-badge)](https://www.python.org/)
[![Flask Badge](https://img.shields.io/badge/Flask-000000?logo=flask&logoColor=fff&style=for-the-badge)](https://flask.palletsprojects.com/)
[![HTML5 Badge](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=fff&style=for-the-badge)](https://en.wikipedia.org/wiki/HTML5)
[![CSS3 Badge](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=fff&style=for-the-badge)](https://en.wikipedia.org/wiki/CSS)
[![JavaScript Badge](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000&style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

<br/>

*Watch algorithms battle side-by-side, analyze their microsecond execution times, and explore their underlying mathematical complexities.*

</div>

---

## ⚡ Executive Summary

**The Algorithm Laboratory** transcends traditional sorting visualizers by providing a highly interactive, dual-arena "duel" environment. Built with a decoupled architecture (Python/Flask backend computing step-states mapping to a responsive Vanilla JS frontend), the suite allows developers, students, and educators to benchmark algorithms synchronously on identical datasets. 

It's not just about watching bars swap—it's about understanding *why* $O(n \log n)$ dominates $O(n^2)$, observing the memory implications of Out-Of-Place merges, and tracking microsecond logic execution dynamically.

---

## ✨ Core Features

- 🌑 **Immersive Glitch Entry:** A custom `<canvas>` based "Matrix-style" digital rain that smoothly transitions into an ordered state upon entering the lab, setting a premium user experience from the first click.
- ⚔️ **Synchronous Dueling Arenas:** Launch two completely different algorithms simultaneously on a cloned numerical array. Watch Divide-and-Conquer strategies race against Brute-Force methodologies in real-time.
- ⏱️ **Precision Analytics:** Native backend logic tracking. The suite records exact algorithmic **Comparisons** and total internal **Logic Time (ms)** entirely disconnected from the frontend animation speed.
- 📚 **Interactive Codex (Glossary):** A dedicated definitions hub featuring a custom-built 3D Parallax Tilt engine for browsing algorithm methodologies, stability concepts, and spatial complexities.
- 🎛️ **Granular Control:** Dynamically manipulate standard variables through intuitive sliders: increase the element count (array size) to stress test performance, or slow down the rendering speed to $0.5x$ to observe step-by-step memory swaps.

---

## 🧠 Supported Algorithm Library

The laboratory natively supports 10 distinct sorting architectures, ranging from optimal production-grade systems to stochastic anomalies:

| Algorithm | Category | Average Time | Space | Stability |
| :--- | :--- | :--- | :--- | :--- |
| **Quick Sort** | Divide & Conquer | $\mathcal{O}(n \log n)$ | $\mathcal{O}(\log n)$ | ❌ Unstable |
| **Merge Sort** | Divide & Conquer | $\mathcal{O}(n \log n)$ | $\mathcal{O}(n)$ | ✅ Stable |
| **Heap Sort** | Selection-based | $\mathcal{O}(n \log n)$ | $\mathcal{O}(1)$ | ❌ Unstable |
| **Radix Sort** | Non-Comparison | $\mathcal{O}(nk)$ | $\mathcal{O}(n + k)$ | ✅ Stable |
| **Counting Sort**| Non-Comparison | $\mathcal{O}(n + k)$ | $\mathcal{O}(n + k)$ | ✅ Stable |
| **Insertion Sort**| Decrease/Conquer | $\mathcal{O}(n^2)$ | $\mathcal{O}(1)$ | ✅ Stable |
| **Selection Sort**| Selection-based | $\mathcal{O}(n^2)$ | $\mathcal{O}(1)$ | ❌ Unstable |
| **Bubble Sort** | Brute Force | $\mathcal{O}(n^2)$ | $\mathcal{O}(1)$ | ✅ Stable |
| **Optimized Bogo**| Hybrid/Stochastic| $\mathcal{O}(n!)$ | $\mathcal{O}(1)$ | ❌ Unstable |
| **Bogo Sort** | Las Vegas | $\mathcal{O}(n \times n!)$ | $\mathcal{O}(1)$ | ❌ Unstable |

> **Note on Implementations:** All computational logic resides purely in `algs.py`. The frontend visually interpolates the chronological `swap` and `compare` steps emitted by the Python engine.

---

## 🛠️ Technical Architecture

The project leverages a robust, lightweight Full-Stack model to ensure visualization rendering doesn't corrupt logic timing benchmarks.

1. **The Computing Engine (Flask / Python 3):**
   - Receives target algorithm requirements via REST API.
   - Executes recursive or iterative sorts via the `time.perf_counter()` environment to ensure sub-millisecond accuracy.
   - Compiles an execution roadmap mapping array states (`current_state`), active indices (`indices`), and operation events (`type: swap | compare`).

2. **The Render Engine (Vanilla JS / CSS3):**
   - Consumes the `JSON` roadmap and initializes the dual concurrent animations.
   - Utilizes CSS transform state changes and `replaceChildren` DOM techniques to prevent memory-leak lag when rendering high element counts.

3. **Motion & UX (Glassmorphism & Canvas):**
   - Avoids heavyweight component libraries (No React/Tailwind) in favor of deeply optimized vanilla CSS Grid/Flexbox layouts.
   - Implements GPU-accelerated fading transitions and 3D card tilt transformations natively.

---

## 🚀 Installation & Deployment

Deploying the suite locally requires minimal dependencies.

### 1. System Requirements
- [Python 3.8+](https://www.python.org/downloads/)
- Modern Web Browser (Chrome, Edge, Firefox, Safari)

### 2. Environment Setup
Clone the repository:
```bash
# Clone the project (Replace with your repository URL)
git clone https://github.com/yourusername/Algorithm-Laboratory.git
cd Algorithm-Laboratory
```

#### Installing Dependencies (Windows)
We provide a convenient installation script for Windows users. Simply double-click the `install_dependencies.bat` file located in the root directory. It will automatically verify your Python installation and install the required packages.

Alternatively, you can manually install the lightweight HTTP server requirements:
```bash
pip install flask flask-cors
```

### 3. Ignition
Launch the Python computation backend:
```bash
python app.py
```
*The Flask core will spin up locally on `http://127.0.0.1:5000`.*

Finally, launch the UI by opening `index.html` directly in your browser. No Webpack or Node server required.

---

---

<div align="center">
  <p>Designed and structured to democratize the understanding of data structures.</p>
</div>

<div align="center">

# 🧪 The Algorithm Laboratory & Comparative Simulation Suite

**An interactive, visual platform for comparing the performance and mechanics of various sorting algorithms side-by-side.**

[![Python Badge](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=fff&style=for-the-badge)](https://www.python.org/)
[![Flask Badge](https://img.shields.io/badge/Flask-000?logo=flask&logoColor=fff&style=for-the-badge)](https://flask.palletsprojects.com/)
[![HTML5 Badge](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=fff&style=for-the-badge)](https://en.wikipedia.org/wiki/HTML5)
[![CSS Badge](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=fff&style=for-the-badge)](https://en.wikipedia.org/wiki/CSS)
[![JavaScript Badge](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=000&style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

</div>

## 📖 Overview

The **Algorithm Laboratory: Sorting Duel** is a full-stack educational tool designed to help developers and computer science students visualize how different sorting algorithms operate under the hood. By utilizing a side-by-side "duel" interface, users can launch two algorithms simultaneously on the same randomized dataset to visually and quantitatively compare their efficiency, execution time, and total array operations.

## ✨ Features

- **⚔️ Side-by-Side Duel Interface:** Compare any two sorting algorithms at the exact same time.
- **📊 Live Visualization:** Watch the arrays swap, highlight, and sort in real-time.
- **⏱️ Deep Analytics:** Tracks the exact number of **Comparisons** and backend **Logic Time (ms)** natively.
- **🎛️ Interactive Controls:** Dynamically adjust the number of elements (array size) and the playback speed.
- **🌐 Full-Stack Architecture:** Python/Flask backend seamlessly processes the heavy algorithmic logic, tracking step-by-step state changes, and sends it to the dynamic JavaScript frontend.

## 🧠 Supported Algorithms

1. **Bubble Sort** - Simple but inefficient $O(n^2)$ sorting.
2. **Selection Sort** - In-place comparison sort, $O(n^2)$.
3. **Insertion Sort** - Builds the final sorted list one item at a time, $O(n^2)$.
4. **Quick Sort** - Efficient, divide-and-conquer strategy, $O(n \log n)$.
5. **Merge Sort** - Stable, divide-and-conquer list sorting, $O(n \log n)$.
6. **Heap Sort** - Optimization of selection sort using a priority queue, $O(n \log n)$.
7. **Bogo Sort** - Highly inefficient, random permutations until sorted. $O((n+1)!)$. *(Use with small array sizes!)*
8. **Optimized Bogo** - A slightly smarter variant of Bogo Sort that locks correctly sorted initial segments.

## 🛠️ Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Backend:** Python 3, Flask framework
- **API:** RESTful API using Flask-CORS for cross-origin requests

## 🚀 Getting Started

Follow these steps to run the Algorithm Laboratory locally.

### 1. Prerequisites
Ensure you have [Python](https://www.python.org/downloads/) installed on your machine.

### 2. Install Dependencies
Open your terminal and install the required Python packages for the web server:

```bash
pip install flask flask-cors
```

### 3. Start the Backend Server
Run the Flask application backend:

```bash
python app.py
```
*The server will start running on `http://127.0.0.1:5000`.*

### 4. Launch the Frontend
Simply open the `index.html` file in your preferred web browser (e.g., double click it) to access the Laboratory interface.

## 🎮 How to Use

1. **Select Algorithms:** Use the dropdown menus on the *Left* and *Right* arenas to pick which algorithms to battle against each other.
2. **Adjust Parameters:** Use the interactive sliders to change the **Elements** (number of bars) and **Speed** of the visualization.
3. **Start Race:** Click `Start Race` to generate a random array and begin the sorting duel!
4. **Pause/Reset:** You can pause the visualization mid-way using the `Pause` button, or completely clear the board using `Reset`.

## 📸 Screenshots

*(To make your README look even better on GitHub, add screenshots of the duel interface here! You can take a screenshot of your app, save it as `screenshot.png` in the project folder, and replace this text with: `![Dashboard Screenshot](screenshot.png)`)*

## 🤝 Contributing

Feel free to fork this project, submit pull requests, or send suggestions to add more algorithms (e.g., Radix Sort, Tim Sort) or improve the visual feedback!

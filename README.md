# The Algorithm Laboratory and Comparative Simulation Suite

A full-stack educational visualization platform for exploring how classic algorithms behave in practice.

The project combines a Python Flask backend with a lightweight HTML, CSS, and JavaScript frontend to animate algorithm execution step by step. It currently includes:

- a dual-arena sorting visualizer
- a grid-based pathfinding visualizer
- an interactive glossary of core algorithm terms

The suite is designed for students, educators, and anyone who wants to move beyond static pseudocode and see algorithm behavior unfold visually.

## Highlights

- Side-by-side sorting comparison on identical input data
- Real-time pathfinding visualization on an editable grid
- Dynamic algorithm info panels for both sorting and pathfinding
- Backend-generated execution steps for consistent animation logic
- Adjustable speed and problem size controls
- Standalone frontend pages with no Node.js build step
- Basic backend test coverage with `pytest`

## Current Modules

### 1. Sorting Duel

The sorting experience is built around two synchronized arenas so users can compare two algorithms on the same randomly generated array.

Features:

- Start, pause, and reset controls
- Adjustable element count and animation speed
- Comparison counters and backend execution timing
- Dynamic educational cards describing each algorithm

Supported sorting algorithms:

| Algorithm | ID | Category |
| --- | --- | --- |
| Bubble Sort | `bubble` | Brute Force |
| Selection Sort | `selection` | Brute Force |
| Insertion Sort | `insertion` | Decrease and Conquer |
| Quick Sort | `quick` | Divide and Conquer |
| Merge Sort | `merge` | Divide and Conquer |
| Heap Sort | `heap` | Selection Method |
| Bogo Sort | `bogo` | Randomized / Brute Force |
| Optimized Bogo Sort | `optbogo` | Randomized / Decrease |
| Counting Sort | `counting` | Non-Comparison / Distribution |
| Radix Sort | `radix` | Non-Comparison / Distribution |

### 2. Pathfinding Visualizer

The pathfinding experience uses a square grid where users can place walls, move the start and target nodes, generate mazes, and watch the search process animate in real time.

Features:

- Editable obstacle grid
- Draggable start and target nodes
- Maze generation presets
- Adjustable grid size and animation speed
- Dynamic educational panel for the selected pathfinding algorithm

Supported pathfinding algorithms:

| Algorithm | ID | Notes |
| --- | --- | --- |
| Dijkstra's Algorithm | `dijkstra` | Uniform-cost shortest path on the current grid |
| A* Search | `astar` | Heuristic-guided shortest path with Manhattan-style heuristic |
| Bellman-Ford | `bellmanford` | Simplified queue-based grid variant |

Note: the current pathfinding grid uses uniform movement cost. Terrain-weighted paths are not implemented in the present visualizer.

### 3. Glossary and Definitions

The glossary page provides searchable explanations for common algorithmic vocabulary used throughout the project, such as:

- Big O notation
- auxiliary space
- stable sort
- pivot
- partition
- time complexity

## Architecture

The project is intentionally simple and direct:

- `backend/`
  - Flask API
  - sorting step generators
  - pathfinding logic
- `frontend/`
  - standalone HTML pages
  - styling and animation logic
  - client-side algorithm metadata for educational panels
- `tests/`
  - backend tests using `pytest`

### Backend

The Flask application exposes two JSON endpoints:

- `POST /sort`
  - accepts an algorithm id and input array
  - returns a sequence of sorting steps plus execution time
- `POST /pathfind`
  - accepts an algorithm id, grid dimensions, start node, end node, and walls
  - returns visited nodes and final path

The backend is responsible for generating the authoritative execution data. The frontend only renders what the backend returns.

### Frontend

The frontend is built with plain HTML, CSS, and JavaScript. There is no bundler, framework, or compile step.

Key frontend responsibilities:

- rendering bars and grid nodes
- animating backend step data
- exposing controls for array and grid configuration
- displaying algorithm descriptions, complexity, glossary content, and curated code snippets

## Project Structure

```text
The Algorithm Laboratory and Comparative Simulation Suite/
|-- backend/
|   |-- algs.py
|   |-- app.py
|   `-- pathfinding.py
|-- frontend/
|   |-- index.html
|   |-- pathfinding.html
|   |-- definitions.html
|   |-- css/
|   |   |-- style.css
|   |   `-- definitions.css
|   `-- js/
|       |-- algorithmData.js
|       |-- api.js
|       |-- controls.js
|       |-- definitions.js
|       |-- pathfinding.js
|       |-- pathfindingData.js
|       `-- renderer.js
|-- tests/
|   `-- test_backend.py
|-- install_dependencies.bat
|-- README.md
`-- venv/
```

## Requirements

- Python 3.8 or newer
- A modern web browser
- Windows PowerShell or Command Prompt for the setup steps below

## Setup

This project should be run inside a virtual environment. A `venv` directory already exists in the repository, but you can recreate it if needed.

### Option A: Use the provided Windows installer

Run:

```bat
install_dependencies.bat
```

That script:

- creates `venv`
- installs `flask`
- installs `flask-cors`
- installs `pytest`

### Option B: Manual setup

From the project root:

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install flask flask-cors pytest
```

If you are using Command Prompt instead of PowerShell:

```bat
venv\Scripts\activate.bat
```

## Running the Project

### 1. Start the backend

From the project root, with the virtual environment activated:

```powershell
venv\Scripts\python backend\app.py
```

The Flask server runs at:

```text
http://127.0.0.1:5000
```

### 2. Open the frontend

Open the main frontend page:

```text
frontend/index.html
```

From there you can navigate to:

- the Sorting Duel
- the Pathfinding visualizer
- the Glossary page

## Testing

Run the backend tests from the project root with the virtual environment activated:

```powershell
venv\Scripts\python -m pytest
```

The existing test suite covers:

- several sorting implementations reaching a sorted final state
- validation behavior on `/sort`
- validation behavior on `/pathfind`

## Educational Design

One of the strengths of this project is that it is not just an animation layer. The interface is also built to teach.

The current UI includes:

- algorithm descriptions
- complexity summaries
- implementation snippets
- conceptual glossary items
- visual observations tied directly to what the user sees on screen

This makes the suite useful in classrooms, demonstrations, self-study, and project presentations.

## Known Characteristics

- The sorting visualizer measures backend logic time independently from animation speed.
- The pathfinding visualizer currently assumes uniform movement cost.
- Frontend pages are static files and do not require a JavaScript toolchain.
- The project is optimized for local execution and learning, not production deployment.

## Future Improvement Ideas

- add weighted pathfinding terrain
- add more graph algorithms and maze generators
- expand automated test coverage
- improve mobile-specific layout tuning
- add exportable experiment summaries

## License

No license file is currently included in the repository. If you plan to distribute or publish the project, add an explicit license.

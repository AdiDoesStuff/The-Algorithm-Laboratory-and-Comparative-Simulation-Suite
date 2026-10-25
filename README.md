<div align="center">

# The Algorithm Laboratory and Comparative Simulation Suite

**An interactive full-stack playground for watching algorithms think.**

## Recent Updates

- **Learn Mode, Quizzes, and Progress**: BST Learn Mode now has checkpoints, glossary term tooltips, and an end-of-lesson quiz. Best scores persist locally behind an 80% pass mark and surface as hub badges and Guided Path state.
- **Font Improvements**: Switched the body font to **Inter** for a clean, professional look and set numeric displays to **Roboto Mono** for better readability. The title font remains unchanged.
- **Navigation Icon Fixes**: Restored missing SVG logos on the BST & Trees page. Added correct icons for Sorting, Pathfinding, BST & Trees, and Definitions. The Pathfinding button now uses the proper compass/locator icon, matching the home page.


Compare sorting algorithms side by side, explore shortest-path search on an editable grid, and learn the vocabulary behind the visuals through a searchable glossary.

![Python](https://img.shields.io/badge/Python-3.8%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-API-000000?style=for-the-badge&logo=flask&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-Frontend-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-Static_UI-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-Animated_UI-1572B6?style=for-the-badge&logo=css3&logoColor=white)

<br>

[`Sorting Duel`](#sorting-duel) |
[`Pathfinding Lab`](#pathfinding-lab) |
[`Glossary`](#glossary-and-definitions) |
[`API`](#api-reference) |
[`Setup`](#quick-start)

</div>

---

## What Is This?

The Algorithm Laboratory is an educational visualization suite built for students, teachers, and curious developers who want to see classic algorithms move instead of only reading pseudocode.

The project uses a **Python Flask backend** to generate authoritative algorithm execution data and a **lightweight HTML/CSS/JavaScript frontend** to render those steps as animations. There is no frontend build system, no heavyweight framework, and no mystery layer between the algorithm and what appears on screen.

```mermaid
flowchart LR
    User["User controls"] --> Frontend["Static frontend<br>HTML + CSS + JS"]
    Frontend --> API["Flask API"]
    API --> Sorting["Sorting step generators"]
    API --> Pathfinding["Pathfinding search engines"]
    Sorting --> API
    Pathfinding --> API
    API --> Frontend
    Frontend --> Visuals["Animated bars, grids,<br>metrics, and explanations"]
```

## Why It Stands Out

| Experience | What It Does | Why It Matters |
| --- | --- | --- |
| **Sorting Duel** | Runs two sorting algorithms on the same input array | Makes performance differences visible, not abstract |
| **Pathfinding Lab** | Animates graph search over an editable grid | Shows how search strategies expand, hesitate, and commit |
| **Glossary and Definitions** | Explains core algorithm terms in searchable cards | Connects visuals to the language used in DSA classes |
| **Backend-generated steps** | Produces execution traces in Python | Keeps animation logic consistent and testable |
| **No Node required** | Frontend runs as static files | Simple setup for classrooms, demos, and college projects |

## Feature Snapshot

- Side-by-side sorting races on identical randomized data
- Start, pause, reset, speed, and element-count controls
- Comparison counters and backend logic-time measurements
- Interactive pathfinding grid with movable start and target nodes
- Wall drawing, path clearing, full grid reset, and maze presets
- Dijkstra, A*, and Bellman-Ford/SPFA-style pathfinding modes
- Dynamic algorithm information cards with complexity notes
- Searchable glossary for algorithm vocabulary
- Inline glossary tooltips in lesson narration, with deep links into the glossary page
- Lesson-driven BST walkthroughs with checkpoints
- Ten-question BST quiz with a topic breakdown, missed-answer review, and retakes
- Optional local progress (best score per unit, 80% pass mark) and hub badges
- Guided Path order with a dismissible, non-blocking quiz nudge
- Flask JSON API with validation

## Sorting Duel

The sorting lab gives each algorithm its own arena while keeping the input identical. That means Bubble Sort, Quick Sort, Merge Sort, Heap Sort, Bogo Sort, and the rest are not just displayed; they are compared under the same conditions.

| Algorithm | ID | Family | Visualization Notes |
| --- | --- | --- | --- |
| Bubble Sort | `bubble` | Brute Force | Adjacent comparisons and swaps |
| Selection Sort | `selection` | Brute Force | Full scans with targeted minimum placement |
| Insertion Sort | `insertion` | Decrease and Conquer | Growing sorted prefix |
| Quick Sort | `quick` | Divide and Conquer | Pivot-based partition movement |
| Merge Sort | `merge` | Divide and Conquer | Recursive split and merge behavior |
| Heap Sort | `heap` | Selection Method | Heap construction and extraction |
| Bogo Sort | `bogo` | Randomized Brute Force | Chaotic shuffles with a safety cap |
| Optimized Bogo Sort | `optbogo` | Randomized Decrease | Shuffles only the unresolved region |
| Counting Sort | `counting` | Distribution Sort | Count-based placement, no pairwise sorting |
| Radix Sort | `radix` | Distribution Sort | Digit-by-digit stable passes |

The backend returns a sequence of `compare` and `swap` steps. The frontend uses those steps to animate bars, update counters, and display the final sorted state.

## Pathfinding Lab

The pathfinding page turns a grid into a searchable graph. Users can draw walls, drag the start and target nodes, generate maze patterns, and watch each algorithm decide where to search next.

| Algorithm | ID | Search Style | Current Grid Behavior |
| --- | --- | --- | --- |
| Dijkstra's Algorithm | `dijkstra` | Uniform-cost shortest path | Expands outward by cheapest known distance |
| A* Search | `astar` | Heuristic-guided shortest path | Uses Manhattan-style direction toward the target |
| Bellman-Ford/SPFA Variant | `bellmanford` | Queue-based relaxation | Revisits improved paths using a queue approach |

The current grid uses **uniform movement cost**. Weighted terrain is not implemented yet, which keeps the visualization focused on the search pattern rather than cost modeling.

## Glossary And Definitions

The glossary page is a searchable companion to the labs. It explains the terms students repeatedly meet while studying algorithms, including:

- Big O notation
- auxiliary space
- stable sort
- pivot
- partition
- time complexity
- relaxation
- heuristic
- priority queue

The glossary is the single source for 94 terms (`frontend/js/shell/glossaryData.js`). Lessons reuse it: narration and checkpoint text can mark a term with `{{term:Height|height}}`, which renders an inline `?` button and a keyboard-operable popover with the plain-text definition and an “Open in glossary” link. Glossary cards are focusable, and `definitions.html#term-<slug>` opens and highlights a specific term.

## Binary Trees & BSTs

This module provides interactive visualization for hierarchical data structures. Users can toggle between two separate visualizer environments:

- **BST Mode**: Inserts unique values sequentially into a Binary Search Tree (with trace animations for node inserts, tree traversals, BST deletions, and step-by-step Learn Mode playback).
- **Play Mode**: Interactive controls for inserting, deleting, and traversing nodes with speed adjustment, pause, and clear functionality, allowing users to experiment with BST operations in real time.
- **Learn Mode**: Step-by-step guided insertion and deletion tutorials with checkpoints, narration, and Prev/Next/Reset controls. Finishing a lesson offers its quiz without leaving the panel.
- **Quiz and progress**: A ten-question BST quiz runs from the end of a lesson or from “Test yourself” on the hub (`bst.html?quiz=bstQuiz`). Results show a topic breakdown and every missed answer. Best scores are stored locally (80% passes); the hub shows a text-and-icon badge and the Guided Path marks the unit passed. Nothing is sent to the backend, and the app still works when storage is blocked.
- **General Binary Tree Mode**: Maps arrays directly into binary trees using the $2i+1$ indexing rule, supporting gaps and `null` values dynamically.
- **Interactive Node Inspector**: Click on any tree node inside the SVG canvas to view its live statistics (calculated Height and Depth) generated directly by the Flask API.
- **Live Classification badges**: Evaluates whether the current tree structure is Full, Complete, Perfect, or Balanced, showing violation warnings if any properties are broken.

## Project Structure

```text
The Algorithm Laboratory and Comparative Simulation Suite/
|-- backend/
|   |-- algs.py              # Sorting step generators
|   |-- app.py               # Flask API routes, height/depth queries, validation
|   |-- pathfinding.py       # Dijkstra, A*, and Bellman-Ford/SPFA logic
|   |-- tracing.py           # make_step and DEFAULT_ROLES tracing support
|   |-- trees.py             # Binary Tree & BST step engines and calculators
|   |-- validation.py        # Centralized payload validators
|   `-- tests/               # Pytest suite (87 tests)
|-- frontend/
|   |-- index.html           # Hub: unit cards and shared navigation
|   |-- sorting.html         # Sorting Duel page
|   |-- pathfinding.html     # Pathfinding visualizer page
|   |-- bst.html             # Binary Trees & BSTs page
|   |-- definitions.html     # Glossary page
|   |-- test.html            # Dev-only QuizEngine fixture
|   |-- css/
|   |   |-- style.css
|   |   |-- hub.css           # Hub card grid, Guided Path, progress badges
|   |   |-- primitives.css
|   |   |-- quiz.css          # Quiz engine and results
|   |   |-- glossary.css      # Inline term markers/popover, glossary page focus
|   |   `-- definitions.css
|   `-- js/
|       |-- shell/
|       |   |-- units.js      # Unit registry (single source of truth)
|       |   |-- nav.js        # Shared Primary navigation
|       |   |-- hub.js        # Hub cards, badges, Guided Path nudge
|       |   |-- progress.js   # localStorage progress with safe fallback
|       |   |-- glossaryData.js    # Glossary source of truth (94 terms)
|       |   |-- glossaryTooltip.js # Inline {{term:...}} markers + popover
|       |   `-- landing.js    # Splash screen + digit-sort transition
|       |-- engine/
|       |   |-- LessonRunner.js    # Generic lesson state machine
|       |   `-- PlaybackController.js
|       |-- lessons/
|       |   `-- bstLessons.js # BST lesson data (insert + deletion)
|       |-- quizzes/
|       |   |-- index.js      # Quiz registry
|       |   `-- bstQuiz.js    # BST quiz data
|       |-- primitives/
|       |   |-- TreeCanvas.js# Generic SVG Tree Renderer
|       |   |-- QuizEngine.js# Generic quiz renderer
|       |   |-- BucketGrid.js# DP / Hash visualizer
|       |   |-- GrowthChart.js# Growth visualizer
|       |   `-- treeAdapter.js# Tree canvas adapter
|       |-- algorithmData.js
|       |-- api.js
|       |-- bst.js           # BST and Binary Tree page controller
|       |-- controls.js
|       |-- definitions.js
|       |-- pathfinding.js
|       |-- pathfindingData.js
|       |-- renderer.js
|       `-- utils.js
|-- dev/
|   `-- validate_content.mjs # Dev-only lesson/quiz/glossary validator
|-- docs/
|   |-- LESSON_SPEC.md
|   `-- QUIZ_SPEC.md
|-- install_dependencies.bat
|-- README.md
`-- .gitignore
```

## Tech Stack

| Layer | Tools |
| --- | --- |
| Backend | Python, Flask, Flask-CORS |
| Algorithms | Pure Python step generators |
| Frontend | HTML, CSS, vanilla JavaScript |
| Setup | Windows batch installer plus manual virtual environment option |

## Quick Start

### One-click local launch

After installing dependencies once, double-click:

```text
start_app.bat
```

This starts the Flask server and opens the app at:

```text
http://127.0.0.1:5000
```

Close the command window to stop the app.

### 1. Install dependencies

The simplest Windows setup path is:

```bat
install_dependencies.bat
```

That script creates a virtual environment and installs:

- `flask`
- `flask-cors`

Manual setup also works:

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install flask flask-cors
```

If you are using Command Prompt:

```bat
venv\Scripts\activate.bat
```

### 2. Start the backend

From the project root:

```powershell
venv\Scripts\python backend\app.py
```

The web app and API run at:

```text
http://127.0.0.1:5000
```

From there, use the in-app navigation to move between:

- Sorting Duel
- Pathfinding
- Definitions

## API Reference

### `POST /sort`

Generates animation steps for a sorting algorithm.

Request:

```json
{
  "algorithm": "quick",
  "array": [42, 7, 19, 3, 25]
}
```

Response:

```json
{
  "steps": [
    {
      "type": "compare",
      "indices": [0, 4],
      "current_state": [42, 7, 19, 3, 25]
    }
  ],
  "execution_time": 0.123
}
```

Supported algorithm IDs:

```text
bubble, selection, insertion, quick, merge, heap, bogo, optbogo, counting, radix
```

### `POST /pathfind`

Generates visited nodes and shortest-path output for a grid search.

Request:

```json
{
  "algorithm": "astar",
  "rows": 10,
  "cols": 10,
  "startNode": { "row": 0, "col": 0 },
  "endNode": { "row": 9, "col": 9 },
  "walls": [
    { "row": 1, "col": 2 },
    { "row": 2, "col": 2 }
  ]
}
```

Response:

```json
{
  "visited_nodes": [
    { "row": 0, "col": 0 },
    { "row": 0, "col": 1 }
  ],
  "path": [
    { "row": 0, "col": 0 },
    { "row": 0, "col": 1 },
    { "row": 1, "col": 1 }
  ]
}
```

Supported pathfinding IDs:

```text
dijkstra, astar, bellmanford
```

### `POST /tree`

Generates tree steps for BST and binary-tree algorithms (`bst_insert`, `bst_delete`, `bst_traverse`, `bst_classify`, `bst_height_depth`, `array_to_tree`, `bst_mirror`, `heap_insert`, `avl_insert`).

Request:

```json
{
  "algorithm": "bst_traverse",
  "tree_type": "bst",
  "order": "inorder",
  "ops": [
    { "op": "insert", "value": 50 },
    { "op": "insert", "value": 30 }
  ]
}
```

Response:

```json
{
  "steps": [
    {
      "type": "visit",
      "annotation": "Visiting node 30 (Visit #1)",
      "highlighted": [1],
      "snapshot": {
        "nodes": [
          { "id": 0, "label": "50", "parent_id": null, "side": null },
          { "id": 1, "label": "30", "parent_id": 0, "side": "left" }
        ],
        "root_id": 0
      }
    }
  ],
  "final_tree": { "nodes": [], "root_id": 0 }
}
```

`ops` is the only accepted input shape for BST mode. The deprecated `values` alias was removed: sending `values` (or `values` inside a `bst_mirror` tree spec) returns `400` with `{"error": "...", "field": "values"}`. Use `{"op": "insert", "value": n}` entries instead.

## Educational Design

This project is built as a learning tool, not just a visual effect. The important design idea is that every animation should connect to a concept:

| Concept | How The Lab Shows It |
| --- | --- |
| Comparisons | Highlighted bar pairs during sorting |
| Swaps and writes | Animated state changes in the bar array |
| Runtime behavior | Side-by-side comparison and logic-time metrics |
| Search frontier | Visited grid nodes expanding over time |
| Shortest path | Reconstructed final route from start to target |
| Complexity language | Info cards and glossary definitions |

## Known Characteristics

- The sorting visualizer measures backend logic time separately from animation speed.
- Bogo-style algorithms are intentionally capped to prevent browser lockups.
- Counting Sort and Radix Sort only support non-negative integers in the backend.
- The pathfinding grid currently uses uniform-cost movement.
- Quiz attempts and progress stay in `localStorage`; they are never sent to the backend, and a blocked or full storage falls back to session memory.
- The legacy `values` input for `POST /tree` has been removed in favour of `ops`.
- The frontend is optimized for local use and project demos rather than production deployment.

## Roadmap Ideas

- Weighted terrain for pathfinding
- More graph algorithms such as BFS, DFS, Greedy Best-First Search, and Floyd-Warshall
- More maze generators and obstacle presets
- Exportable experiment summaries
- Mobile layout polish for smaller screens
- A hosted demo build

## Author Notes

This repository is a strong fit for:

- DSA coursework
- algorithm visualization demos
- classroom explanations
- project presentations
- interview-prep experiments
- comparing textbook complexity with visual behavior

<div align="center">

**Built to make algorithms feel less like static notes and more like systems you can inspect, compare, and understand.**

</div>

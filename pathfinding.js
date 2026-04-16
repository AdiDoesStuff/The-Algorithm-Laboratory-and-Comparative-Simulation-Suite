let rows = 25;
let cols = 25;
let startNode = { row: 12, col: 5 };
let endNode = { row: 12, col: 19 };
let grid = [];
let isDrawingWalls = false;
let isMovingStart = false;
let isMovingEnd = false;
let currentGeneration = 0;
let isRunning = false;

window.onload = () => {
    initializeGrid();
    drawGrid();
};

function initializeGrid() {
    grid = [];
    for (let r = 0; r < rows; r++) {
        let currentRow = [];
        for (let c = 0; c < cols; c++) {
            currentRow.push({
                row: r,
                col: c,
                isStart: r === startNode.row && c === startNode.col,
                isEnd: r === endNode.row && c === endNode.col,
                isWall: false,
                isVisited: false,
                isPath: false
            });
        }
        grid.push(currentRow);
    }
}

function drawGrid() {
    const container = document.getElementById('grid-container');
    container.innerHTML = '';

    // Forces exact fraction grids mapping tightly within the CSS max-bounds guaranteeing perfect scaling
    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const node = grid[r][c];
            const nodeEl = document.createElement('div');
            nodeEl.id = `node-${r}-${c}`;
            nodeEl.className = 'node';

            if (node.isStart) nodeEl.classList.add('node-start');
            if (node.isEnd) nodeEl.classList.add('node-end');
            if (node.isWall) nodeEl.classList.add('node-wall');
            if (node.isVisited) nodeEl.classList.add('node-visited');
            if (node.isPath) nodeEl.classList.add('node-path');

            // Event listeners for dragging
            nodeEl.onmousedown = (e) => handleMouseDown(e, r, c);
            nodeEl.onmouseenter = (e) => handleMouseEnter(e, r, c);
            nodeEl.onmouseup = () => handleMouseUp();
            nodeEl.ondragstart = (e) => e.preventDefault(); // prevent native dragging ghost

            container.appendChild(nodeEl);
        }
    }
}

function handleMouseDown(e, r, c) {
    if (isRunning) return;

    if (grid[r][c].isStart) {
        isMovingStart = true;
    } else if (grid[r][c].isEnd) {
        isMovingEnd = true;
    } else {
        isDrawingWalls = true;
        toggleWall(r, c);
    }
}

function handleMouseEnter(e, r, c) {
    if (isRunning) return;

    if (e.buttons === 1) { // Left click is held down
        if (isMovingStart && !grid[r][c].isEnd) {
            moveStartNode(r, c);
        } else if (isMovingEnd && !grid[r][c].isStart) {
            moveEndNode(r, c);
        } else if (isDrawingWalls && !grid[r][c].isStart && !grid[r][c].isEnd) {
            toggleWall(r, c);
        }
    }
}

function handleMouseUp() {
    isDrawingWalls = false;
    isMovingStart = false;
    isMovingEnd = false;
}

// Add global mouseup to catch releases outside the grid
document.addEventListener('mouseup', handleMouseUp);

function toggleWall(r, c) {
    if (grid[r][c].isStart || grid[r][c].isEnd) return;
    grid[r][c].isWall = !grid[r][c].isWall;
    const nodeEl = document.getElementById(`node-${r}-${c}`);
    if (grid[r][c].isWall) {
        nodeEl.classList.add('node-wall');
        nodeEl.classList.remove('node-visited'); // Clear paths if overriding
        nodeEl.classList.remove('node-path');
    } else {
        nodeEl.classList.remove('node-wall');
    }
}

function moveStartNode(r, c) {
    grid[startNode.row][startNode.col].isStart = false;
    document.getElementById(`node-${startNode.row}-${startNode.col}`).classList.remove('node-start');

    startNode = { row: r, col: c };
    grid[r][c].isStart = true;
    grid[r][c].isWall = false; // Overwrite wall
    const el = document.getElementById(`node-${r}-${c}`);
    el.classList.add('node-start');
    el.classList.remove('node-wall');
}

function moveEndNode(r, c) {
    grid[endNode.row][endNode.col].isEnd = false;
    document.getElementById(`node-${endNode.row}-${endNode.col}`).classList.remove('node-end');

    endNode = { row: r, col: c };
    grid[r][c].isEnd = true;
    grid[r][c].isWall = false; // Overwrite wall
    const el = document.getElementById(`node-${r}-${c}`);
    el.classList.add('node-end');
    el.classList.remove('node-wall');
}

function generateMaze() {
    if (isRunning) return;
    clearGrid();

    const mazeType = document.getElementById('maze-selector').value;

    if (mazeType === 'random') {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!grid[r][c].isStart && !grid[r][c].isEnd) {
                    if (Math.random() < 0.3) {
                        grid[r][c].isWall = true;
                        document.getElementById(`node-${r}-${c}`).classList.add('node-wall');
                    }
                }
            }
        }
    } else if (mazeType === 'stair') {
        let r = rows - 2;
        let c = 1;
        let dRow = -1;
        let dCol = 1;

        while (c < cols - 1) {
            if (r >= 0 && r < rows) {
                if (!grid[r][c].isStart && !grid[r][c].isEnd) {
                    grid[r][c].isWall = true;
                    document.getElementById(`node-${r}-${c}`).classList.add('node-wall');
                }
            }
            r += dRow;
            c += dCol;
            if (r < 1 || r >= rows - 1) {
                dRow = -dRow;
                r += dRow * 2;
            }
        }
    } else if (mazeType === 'recursive') {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
                    if (!grid[r][c].isStart && !grid[r][c].isEnd) {
                        grid[r][c].isWall = true;
                        document.getElementById(`node-${r}-${c}`).classList.add('node-wall');
                    }
                }
            }
        }
        recursiveDivision(1, rows - 2, 1, cols - 2, rows > cols);
    }
}

function recursiveDivision(rowStart, rowEnd, colStart, colEnd, isHorizontal) {
    if (rowEnd < rowStart || colEnd < colStart) return;

    if (isHorizontal) {
        let possibleRows = [];
        // Walls should be placed on EVEN indices
        for (let r = rowStart; r <= rowEnd; r++) {
            if (r % 2 === 0) possibleRows.push(r);
        }
        let possibleCols = [];
        // Gaps (passages) should be placed on ODD indices
        for (let c = colStart; c <= colEnd; c++) {
            if (c % 2 === 1) possibleCols.push(c);
        }

        if (possibleRows.length === 0 || possibleCols.length === 0) return;

        let randomRowIndex = Math.floor(Math.random() * possibleRows.length);
        let randomColIndex = Math.floor(Math.random() * possibleCols.length);

        let currentRow = possibleRows[randomRowIndex];
        let randomCol = possibleCols[randomColIndex];

        // Draw wall
        for (let c = colStart - 1; c <= colEnd + 1; c++) {
            if (c !== randomCol && c >= 0 && c < cols && currentRow >= 0 && currentRow < rows) {
                if (!grid[currentRow][c].isStart && !grid[currentRow][c].isEnd) {
                    grid[currentRow][c].isWall = true;
                    document.getElementById(`node-${currentRow}-${c}`).classList.add('node-wall');
                }
            }
        }

        recursiveDivision(rowStart, currentRow - 1, colStart, colEnd, (currentRow - 1 - rowStart) > (colEnd - colStart));
        recursiveDivision(currentRow + 1, rowEnd, colStart, colEnd, (rowEnd - (currentRow + 1)) > (colEnd - colStart));
    } else {
        let possibleCols = [];
        // Walls should be placed on EVEN indices
        for (let c = colStart; c <= colEnd; c++) {
            if (c % 2 === 0) possibleCols.push(c);
        }
        let possibleRows = [];
        // Gaps (passages) should be placed on ODD indices
        for (let r = rowStart; r <= rowEnd; r++) {
            if (r % 2 === 1) possibleRows.push(r);
        }

        if (possibleCols.length === 0 || possibleRows.length === 0) return;

        let randomColIndex = Math.floor(Math.random() * possibleCols.length);
        let randomRowIndex = Math.floor(Math.random() * possibleRows.length);

        let currentCol = possibleCols[randomColIndex];
        let randomRow = possibleRows[randomRowIndex];

        // Draw wall
        for (let r = rowStart - 1; r <= rowEnd + 1; r++) {
            if (r !== randomRow && r >= 0 && r < rows && currentCol >= 0 && currentCol < cols) {
                if (!grid[r][currentCol].isStart && !grid[r][currentCol].isEnd) {
                    grid[r][currentCol].isWall = true;
                    document.getElementById(`node-${r}-${currentCol}`).classList.add('node-wall');
                }
            }
        }

        recursiveDivision(rowStart, rowEnd, colStart, currentCol - 1, (rowEnd - rowStart) > (currentCol - 1 - colStart));
        recursiveDivision(rowStart, rowEnd, currentCol + 1, colEnd, (rowEnd - rowStart) > (colEnd - (currentCol + 1)));
    }
}

function clearGrid() {
    if (isRunning) return;
    currentGeneration++;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            grid[r][c].isWall = false;
            grid[r][c].isVisited = false;
            grid[r][c].isPath = false;
            const el = document.getElementById(`node-${r}-${c}`);
            el.className = 'node';
            if (grid[r][c].isStart) el.classList.add('node-start');
            if (grid[r][c].isEnd) el.classList.add('node-end');
        }
    }
}

function clearPath() {
    if (isRunning) return;
    currentGeneration++;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            grid[r][c].isVisited = false;
            grid[r][c].isPath = false;
            const el = document.getElementById(`node-${r}-${c}`);
            el.classList.remove('node-visited', 'node-visited-animated', 'node-path');
        }
    }
}

function updateGridSize() {
    if (isRunning) return;
    const val = parseInt(document.getElementById('grid-slider').value);
    document.getElementById('grid-val').innerText = `${val}x${val}`;
    rows = val;
    cols = val;

    // Ensure start and end nodes are within bounds
    if (startNode.row >= rows) startNode.row = rows - 1;
    if (startNode.col >= cols) startNode.col = cols - 1;
    if (endNode.row >= rows) endNode.row = rows - 1;
    if (endNode.col >= cols) endNode.col = cols - 1;

    // Separate start and end to avoid overlap if resized too small
    if (startNode.row === endNode.row && startNode.col === endNode.col) {
        if (startNode.col > 0) startNode.col--;
        else startNode.col++;
    }

    currentGeneration++;
    initializeGrid();
    drawGrid();
}

function updateSpeedDisplay() {
    const val = document.getElementById('speed-slider').value;
    document.getElementById('speed-val').innerText = val + 'x';
}

async function fetchPathfindingSteps(algorithm, wallsData) {
    try {
        const response = await fetch('http://127.0.0.1:5000/pathfind', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                algorithm: algorithm,
                rows: rows,
                cols: cols,
                startNode: startNode,
                endNode: endNode,
                walls: wallsData
            })
        });
        return await response.json();
    } catch (error) {
        console.error("Backend error:", error);
        alert("Is your Python server running? Check the terminal!");
    }
}

async function startPathfinding() {
    if (isRunning) return;

    clearPath();
    isRunning = true;
    currentGeneration++;
    const myGen = currentGeneration;

    const algorithm = document.getElementById('algo-selector').value;

    // Collect walls
    const wallsData = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c].isWall) {
                wallsData.push({ row: r, col: c });
            }
        }
    }

    try {
        const data = await fetchPathfindingSteps(algorithm, wallsData);
        if (data && data.error) {
            throw new Error(`Backend Error: ${data.error}`);
        }
        if (!data || !data.visited_nodes) {
            throw new Error("No data returned from backend");
        }

        const speedSlider = document.getElementById('speed-slider');
        const speedMultiplier = speedSlider ? parseFloat(speedSlider.value) : 1;

        // 1. Animate visited nodes
        for (let i = 0; i < data.visited_nodes.length; i++) {
            if (myGen !== currentGeneration) { isRunning = false; return; }

            const node = data.visited_nodes[i];
            const isStartOrEnd = (node.row === startNode.row && node.col === startNode.col) ||
                (node.row === endNode.row && node.col === endNode.col);

            if (!isStartOrEnd) {
                const el = document.getElementById(`node-${node.row}-${node.col}`);
                grid[node.row][node.col].isVisited = true;
                el.classList.add('node-visited-animated');
            }

            // Adjust delay for smoother large-grid animations
            let delay = 15 / speedMultiplier;
            // if queue is large, do batching
            if (i % 2 === 0) {
                await new Promise(r => setTimeout(r, delay));
            }
        }

        // 2. Animate shortest path
        for (let i = 0; i < data.path.length; i++) {
            if (myGen !== currentGeneration) { isRunning = false; return; }

            const node = data.path[i];
            const isStartOrEnd = (node.row === startNode.row && node.col === startNode.col) ||
                (node.row === endNode.row && node.col === endNode.col);

            if (!isStartOrEnd) {
                const el = document.getElementById(`node-${node.row}-${node.col}`);
                grid[node.row][node.col].isPath = true;
                el.classList.remove('node-visited-animated');
                el.classList.add('node-path');
            }

            await new Promise(r => setTimeout(r, 40 / speedMultiplier));
        }

    } catch (err) {
        console.error(err);
        alert("Pathfinding encountered an error.");
    } finally {
        isRunning = false;
    }
}

// definitions.js

const definitions = [
    { term: "Algorithm", def: "A step-by-step set of instructions designed to perform a specific task or solve a particular problem." },
    { term: "Asymptotic Notation", def: "Mathematical tools (like <strong>Big O</strong>) used to describe the limiting behavior of a function when the argument tends towards a particular value or infinity." },
    { term: "Auxiliary Space", def: "The extra space or temporary space used by an algorithm, typically excluding the space used to store the input." },
    { term: "Amortized Analysis", def: "A way to analyze an algorithm over a <em>sequence</em> of operations, averaging expensive steps out over many cheap steps. Some algorithms have rare costly operations but good amortized performance overall." },
    { term: "Average Case", def: "The expected amount of time or space an algorithm requires to execute on a typical input of size n, representing standard real-world conditions." },
    { term: "Best Case", def: "The scenario where the algorithm requires the minimum amount of time or space to execute (e.g., sorting an already sorted array)." },
    { term: "Big O Notation (O)", def: "Describes the upper bound of the time or space complexity of an algorithm. It gives the worst-case scenario." },
    { term: "n (Input Size)", def: "The size of the input. For sorting, <strong>n</strong> is usually the number of elements in the array. Many complexities are expressed as a function of <strong>n</strong>." },
    { term: "V (Vertices)", def: "In graph algorithms, <strong>V</strong> is the number of vertices (nodes) in the graph. On a grid, V is roughly the number of squares (rows × columns) that are considered nodes." },
    { term: "E (Edges)", def: "In graph algorithms, <strong>E</strong> is the number of edges (connections). On a 4-neighbor grid, E is on the order of V because each node has only a few neighbors." },
    { term: "Comparisons", def: "The operation of checking if one element in a data structure is greater than, less than, or equal to another. Minimizing this is often a key goal in sorting algorithms." },
    { term: "Data Structure", def: "A specialized format for organizing, processing, retrieving and storing data." },
    { term: "Divide and Conquer", def: "An algorithm design paradigm based on recursively breaking down a problem into two or more sub-problems of the same or related type, until these become simple enough to be solved directly." },
    { term: "Element", def: "A single piece of data stored within a data structure, like a number in an array that needs to be sorted." },
    { term: "In-place Algorithm", def: "An algorithm that transforms input using no auxiliary data structure. However, a small amount of extra storage space is allowed for auxiliary variables." },
    { term: "Partition", def: "The process of dividing a data structure into two or more parts based on a specific condition, commonly used in Quick Sort." },
    { term: "Pivot", def: "A specifically chosen element in an array used to partition the data in algorithms like Quick Sort." },
    { term: "Space Complexity", def: "The total amount of memory space an algorithm requires to run as a function of the length of the input." },
    { term: "Stable Sort", def: "A sorting algorithm that preserves the relative order of equal elements in the sorted output." },
    { term: "Swaps", def: "The operation of exchanging the positions of two elements within a data structure. A high amount of swaps can drastically affect performance." },
    { term: "Time Complexity", def: "The total amount of time an algorithm takes to run to completion, often expressed in Big O notation." },
    { term: "Worst Case", def: "The scenario where the algorithm requires the maximum amount of time or space to execute." },
    { term: "Tentative Distance", def: "The best distance to a node discovered so far. It can still improve until that node is finalized." },
    { term: "Priority Queue", def: "A structure that always pulls out the node with the smallest currently known distance first." },
    { term: "g-score", def: "The real cost from the start node to the current node." },
    { term: "h-score", def: "The heuristic estimate of how far the current node still is from the target." },
    { term: "f = g + h", def: "The combined score A* uses to decide what to explore next: real cost so far plus estimated cost remaining." },
    { term: "Relaxation", def: "Testing whether a newly discovered route to a node is better than the best one known so far, and updating it if it is." },
    { term: "Previous Node", def: "The node recorded before another node so the final shortest path can be reconstructed backward from the target." },
    { term: "Heuristic", def: "An educated guess or estimate used to rank alternatives in search algorithms. In A*, it estimates the cost from the current node to the target." },
    { term: "Pathfinding", def: "The algorithmic process of finding a route between two points, typically aiming to find the shortest or optimal path while avoiding obstacles." },
    { term: "Graph", def: "A mathematical structure used to model pairwise relations between objects. Grids in pathfinding are a type of graph where nodes are connected to their neighbors." },
    { term: "Node (or Vertex)", def: "A fundamental unit of a graph. In the visualizer, each square on the grid represents a node." },
    { term: "Edge", def: "A connection between two nodes in a graph. In a standard grid, edges connect a node to its direct adjacent neighbors." },
    { term: "Manhattan Distance", def: "A common heuristic for grid-based pathfinding where movement is restricted to horizontal and vertical steps. It is the sum of the absolute differences of their Cartesian coordinates." },
    { term: "Uniform Cost", def: "A property of a graph where moving from one node to any adjacent node incurs the exact same cost or weight." },
    { term: "Recursive Division", def: "A maze generation algorithm that works by dividing a space into two, adding a wall with a single passage, and repeating the process recursively." },
    { term: "Heap", def: "A specialized tree-based data structure that satisfies the heap property. Used extensively in Heap Sort and Priority Queues." },
    { term: "Radix", def: "The base of a system of numeration. Radix Sort uses this concept to sort elements by processing individual digits." },
    { term: "Recursion", def: "A programming technique where a function calls itself to solve smaller instances of the same problem, foundational to algorithms like Quick Sort and Merge Sort." },
    { term: "Greedy Algorithm", def: "An algorithmic paradigm that makes the locally optimal choice at each stage with the hope of finding a global optimum. Dijkstra's algorithm is a greedy algorithm." },
    { term: "Dynamic Programming", def: "A method for solving complex problems by breaking them down into simpler overlapping subproblems and storing the results. Bellman-Ford utilizes this approach." },
    { term: "Admissible Heuristic", def: "A heuristic that never overestimates the cost of reaching the goal. This is a strict requirement for A* to guarantee finding the optimal shortest path." },
    { term: "Depth-First Search (DFS)", def: "An algorithm for traversing or searching tree or graph data structures that goes as deep as possible along each branch before backtracking. Often used in maze generation." },
    { term: "Breadth-First Search (BFS)", def: "An algorithm for traversing a graph that explores all neighbor nodes at the present depth prior to moving on to the nodes at the next depth level." },
    { term: "Permutation", def: "An arrangement of all elements of a set in a particular order. Bogo Sort works by randomly generating permutations until a sorted one is found." },
    { term: "Cache Locality", def: "The tendency of a processor to access memory locations near recently accessed ones. Algorithms with good cache locality (like Quick Sort) run faster in practice due to fewer cache misses." },
    { term: "Timsort", def: "A hybrid sorting algorithm derived from Merge Sort and Insertion Sort. It is the standard sorting algorithm in Python and Java for objects, highly optimized for real-world data." },
    { term: "Subarray", def: "A contiguous portion of an array. Merge Sort and Quick Sort recursively operate on subarrays until each is sorted." },
    { term: "Heapify", def: "The process of converting an arbitrary array into a valid heap structure. Heap Sort begins by heapifying the input before extracting elements in order." },
    { term: "Las Vegas Algorithm", def: "A randomized algorithm that always produces a correct result, but whose running time is non-deterministic. Bogo Sort is the most famous (and absurd) example." },
    { term: "Out-of-place Algorithm", def: "An algorithm that requires additional memory proportional to the input size to operate. Merge Sort and Counting Sort are out-of-place because they build new arrays during sorting." },
    { term: "Non-Comparison Sort", def: "A category of sorting algorithm that does not compare elements directly against each other. Instead it exploits structural properties of the data. Counting Sort and Radix Sort are examples." },
    { term: "k (range)", def: "In Counting Sort and Radix Sort, k represents the range of possible key values. The time complexity O(n + k) means performance degrades if k is very large." },
    { term: "Significant Digit", def: "A digit that contributes meaningfully to the value of a number. Radix Sort processes numbers one significant digit at a time, starting from the rightmost." },
    { term: "Closed Set", def: "In pathfinding, the set of nodes that have already been fully processed and finalized. A node in the closed set will not be revisited." },
    { term: "Open Set", def: "In pathfinding, the set of nodes discovered but not yet fully evaluated — the frontier of the search waiting to be explored." },
    { term: "Wall / Obstacle", def: "A node in the pathfinding grid that is impassable. The algorithm must route around all wall nodes to find a valid path." },
    { term: "Shortest Path", def: "The path between two nodes in a graph such that the total sum of edge weights is minimized. Dijkstra, A*, and Bellman-Ford all compute this." },
    { term: "Weighted Graph", def: "A graph where each edge has a numerical value (weight) representing a cost, distance, or time. Many real-world pathfinding problems use weighted graphs." },
    { term: "Negative Edge", def: "An edge in a graph with a negative weight, representing situations where taking a path yields a gain rather than a cost. Bellman-Ford can handle these; Dijkstra cannot." },
    { term: "Iteration", def: "The repetition of a block of code using loops. Most sorting algorithms heavily rely on iteration to scan and rearrange elements." },
    { term: "Array", def: "An ordered collection of elements stored at contiguous memory locations. All sorting algorithms in this lab operate on arrays." },
    { term: "Complexity Class", def: "A set of computational problems that require similar amounts of resources to solve. Examples include P, NP, and the sorting lower bound of O(n log n)." },
    { term: "Big Omega (Ω)", def: "Describes the lower bound of an algorithm's complexity — the best it can possibly do. An algorithm is Ω(f(n)) if it always takes at least f(n) time." },
    { term: "Big Theta (Θ)", def: "Describes the tight bound of an algorithm's complexity — when the best and worst case grow at the same rate. Merge Sort is Θ(n log n) because all cases are equal." },
    { term: "O(1) — Constant Time", def: "An operation whose execution time does not change regardless of input size. Accessing a specific array index by position is an O(1) operation." },
    { term: "O(log n)", def: "Logarithmic time. The work grows very slowly as n grows. This often appears when a problem size is repeatedly halved (e.g., binary search or recursion depth in balanced divide-and-conquer)." },
    { term: "O(n) — Linear Time", def: "Linear time. The work grows proportionally with n. A single full scan through an array is typically O(n)." },
    { term: "O(n log n)", def: "The holy grail complexity for comparison-based sorting. It means the time grows proportionally to n times the logarithm of n — efficient for large datasets." },
    { term: "O(n²)", def: "Quadratic time. Often caused by two nested loops over the same n elements, leading to about n × n operations." },
    { term: "O(n!)", def: "Factorial time. Growth is extremely fast. Algorithms that brute-force all permutations (like Bogo Sort’s expected behavior) can involve factorial-scale complexity." },
    { term: "O(V) — Linear in Nodes", def: "Linear in the number of vertices. Common for space usage in pathfinding when storing distance/visited/previous information per node." },
    { term: "O((V + E) log V)", def: "Typical for Dijkstra/A* with a binary heap priority queue: you may push/pop nodes (log V each) while processing V nodes and relaxing E edges." },
    { term: "O(VE)", def: "Appears in Bellman-Ford worst-case analysis: repeatedly relaxing edges across up to V−1 rounds gives on the order of V × E work." },
    { term: "Comparison-Based Sort", def: "A sorting algorithm that determines order solely by comparing pairs of elements. All comparison-based sorts have a theoretical lower bound of O(n log n)." }
];

// Sort alphabetically
definitions.sort((a, b) => a.term.localeCompare(b.term));

const definitionsGrid = document.getElementById('definitions-grid');
const searchInput = document.getElementById('search-input');

// Modal Elements
const overlay = document.getElementById('definition-modal');
const modalTitle = document.getElementById('modal-title');
const modalDef = document.getElementById('modal-def');

// Initialize and Render Pages
function renderCards(filterText = "") {
    // Clear container
    definitionsGrid.innerHTML = "";

    const filtered = definitions.filter(item => 
        item.term.toLowerCase().includes(filterText.toLowerCase()) || 
        item.def.toLowerCase().includes(filterText.toLowerCase())
    );

    filtered.forEach((item, index) => {
        // Create card element
        const card = document.createElement('div');
        card.className = `glossary-card ${filterText ? 'search-match' : ''}`;
        
        // Use custom dataset for ease of extracting data on click without stringifying
        card.dataset.term = item.term;
        card.dataset.def = item.def;
        
        card.innerHTML = `<h3 class="card-title">${item.term}</h3>`;
        
        // Add click listener to trigger modal
        card.addEventListener('click', () => {
            openModal(item.term, item.def);
        });

        definitionsGrid.appendChild(card);
    });
}

// Modal Logic
function openModal(term, def) {
    modalTitle.textContent = term;
    modalDef.innerHTML = def; // Render HTML like <strong> for definitions
    
    // Prevent body bounce/scrolling when modal is open
    document.body.style.overflow = "hidden";
    
    // Show modal
    overlay.classList.remove('hidden');
}

function closeModal() {
    overlay.classList.add('hidden');
    
    // Restore body scrolling
    document.body.style.overflow = "";
}

function closeModalOnOutsideClick(event) {
    if (event.target === overlay) {
        closeModal();
    }
}

// Keyboard accessible modal closing
window.addEventListener('keydown', (e) => {
    if (e.key === "Escape" && !overlay.classList.contains('hidden')) {
        closeModal();
    }
});

// Search Logic
searchInput.addEventListener('input', (e) => {
    renderCards(e.target.value);
});

// Transition specific
function goBack() {
    const pageTransition = document.getElementById('page-transition');
    if (pageTransition) {
        pageTransition.classList.remove('fade-out');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500); // Wait for transition
    } else {
        window.location.href = 'index.html';
    }
}

// Window init
window.onload = () => {
    // Initial Render
    renderCards();
    
    // Fade in overlay removal
    const pageTransition = document.getElementById('page-transition');
    if (pageTransition) {
        setTimeout(() => {
            pageTransition.classList.add('fade-out');
        }, 50);
    }
}

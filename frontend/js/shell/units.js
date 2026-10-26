/*
 * AlgoLab unit registry.
 *
 * This is the single source of truth for the hub cards, the Guided Path, and
 * the shared navigation. It is a classic script (no build step) so every page
 * can load it with a plain <script> tag:
 *
 *     <script src="js/shell/units.js"></script>
 *
 * Fields: id, title, page, status ("live" | "soon"), blurb, glossaryTerms,
 * guidedOrder (1-based position in the Guided Path), and quizId (optional; the
 * quiz registry key. "Test yourself" is only enabled when this is present).
 *
 * Exposes: window.ALGOLAB_UNITS
 */
(function (window) {
    "use strict";

    var UNITS = [
        {
            id: "sorting",
            title: "Sorting Duel",
            page: "sorting.html",
            status: "live",
            guidedOrder: 1,
            blurb: "Race ten sorting algorithms on identical data and compare their comparisons, swaps, and logic time side by side.",
            glossaryTerms: [
                "Comparisons",
                "Swaps",
                "In-place Algorithm",
                "Stable Sort",
                "Time Complexity",
                "Space Complexity",
                "Divide and Conquer",
                "Pivot"
            ]
        },
        {
            id: "pathfinding",
            title: "Pathfinding",
            page: "pathfinding.html",
            status: "live",
            guidedOrder: 2,
            blurb: "Trace Dijkstra, A*, and Bellman-Ford across an editable grid and watch the shortest path unfold step by step.",
            glossaryTerms: [
                "Heuristic",
                "Manhattan Distance",
                "Priority Queue",
                "Relaxation",
                "Graph",
                "Uniform Cost",
                "Pathfinding"
            ]
        },
        {
            id: "bst",
            title: "BST & Trees",
            page: "bst.html",
            status: "live",
            guidedOrder: 3,
            quizId: "bstQuiz",
            blurb: "Insert, delete, traverse, classify, and compare binary search trees with stable node identities and live path highlights.",
            glossaryTerms: [
                "Binary Search Tree",
                "Node (or Vertex)",
                "Height",
                "Depth",
                "Successor",
                "Balanced Tree",
                "Traversal"
            ]
        },
        {
            id: "heaps",
            title: "Heaps & Heapsort",
            page: "heaps.html",
            status: "live",
            guidedOrder: 4,
            quizId: "heapQuiz",
            blurb: "See one heap twice at once: the array with its index formulas and the complete tree it encodes, through insert, extract, build, and heapsort.",
            glossaryTerms: [
                "Heap",
                "Heap Property",
                "Heapify",
                "Priority Queue",
                "Amortized Analysis"
            ]
        },
        {
            id: "avl",
            title: "AVL Trees",
            page: "avl.html",
            status: "live",
            guidedOrder: 5,
            quizId: "avlQuiz",
            blurb: "Balance factors, the four rotation cases, rotation replay with stable node ids, and a side-by-side comparison with an unbalanced BST.",
            glossaryTerms: [
                "Balance Factor",
                "Rotation",
                "Binary Search Tree",
                "Height",
                "Balanced Tree"
            ]
        },
        {
            id: "trie",
            title: "Tries",
            page: "trie.html",
            status: "live",
            guidedOrder: 6,
            quizId: "trieQuiz",
            blurb: "Build a prefix tree one character at a time, see which nodes words share, search stored words, and run prefix autocomplete.",
            glossaryTerms: [
                "Trie",
                "Prefix",
                "Autocomplete",
                "End-of-Word Marker",
                "String Key"
            ]
        },
        {
            id: "hash",
            title: "Hashing",
            page: "hashing.html",
            status: "live",
            guidedOrder: 7,
            quizId: "hashQuiz",
            blurb: "Compare separate chaining with open addressing on the same keys: collisions, tombstones, load factors, and independent resizing.",
            glossaryTerms: [
                "Hash Function",
                "Hash Table",
                "Collision",
                "Separate Chaining",
                "Open Addressing",
                "Linear Probing",
                "Probe",
                "Clustering",
                "Load Factor",
                "Tombstone",
                "Rehash"
            ]
        },
        {
            id: "merkle",
            title: "Merkle Trees",
            page: "merkle.html",
            status: "live",
            guidedOrder: 8,
            quizId: "merkleQuiz",
            blurb: "Hash blocks with SHA-256, pair them bottom-up, duplicate odd nodes, and watch one tampered block change only its path to the root.",
            glossaryTerms: [
                "Merkle Tree",
                "Merkle Root",
                "SHA-256",
                "Digest",
                "Leaf Hash",
                "Odd-Node Duplication"
            ]
        },
        {
            id: "growth",
            title: "Growth & Recursion",
            page: "growth.html",
            status: "live",
            guidedOrder: 9,
            quizId: "growthQuiz",
            blurb: "Growth curves against Big-O, recursion trees, and Fibonacci: naive vs memoized vs iterative.",
            glossaryTerms: [
                "Asymptotic Notation",
                "Big O Notation (O)",
                "Recursion",
                "Memoization",
                "Dynamic Programming"
            ]
        },
        {
            id: "knapsack",
            title: "0/1 Knapsack",
            page: "knapsack.html",
            status: "live",
            guidedOrder: 10,
            quizId: "knapsackQuiz",
            blurb: "0/1 Knapsack solved three ways: greedy, dynamic programming, and branch and bound.",
            glossaryTerms: [
                "Dynamic Programming",
                "Greedy Algorithm",
                "Branch and Bound",
                "Memoization",
                "0/1 Knapsack"
            ]
        },
        {
            id: "nqueens",
            title: "N-Queens & Backtracking",
            page: "nqueens.html",
            status: "live",
            guidedOrder: 11,
            quizId: "nqueensQuiz",
            blurb: "Backtracking search on the N-Queens board with conflict detection and pruning.",
            glossaryTerms: [
                "Backtracking",
                "N-Queens",
                "Partial Solution"
            ]
        }
    ];

    window.ALGOLAB_UNITS = UNITS;
})(window);

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
            id: "heaps-avl",
            title: "Heaps & AVL",
            page: null,
            status: "soon",
            guidedOrder: 4,
            blurb: "Dual array-and-tree heap traces, heapsort, balance factors, and all four AVL rotation cases.",
            glossaryTerms: [
                "Heap",
                "Heap Property",
                "Balance Factor",
                "Rotation",
                "Amortized Analysis"
            ]
        },
        {
            id: "tries-hashing-merkle",
            title: "Tries, Hashing & Merkle",
            page: null,
            status: "soon",
            guidedOrder: 5,
            blurb: "Prefix trees, hash tables with chaining and open addressing, and Merkle trees with tamper detection.",
            glossaryTerms: [
                "Trie",
                "Hash Function",
                "Collision",
                "Load Factor",
                "Probe",
                "Merkle Root"
            ]
        },
        {
            id: "design-analysis",
            title: "Design & Analysis",
            page: null,
            status: "soon",
            guidedOrder: 6,
            blurb: "Growth curves against Big-O, recursion trees, 0/1 Knapsack solved three ways, N-Queens, and branch and bound.",
            glossaryTerms: [
                "Asymptotic Notation",
                "Big O Notation (O)",
                "Dynamic Programming",
                "Greedy Algorithm",
                "Backtracking",
                "Branch and Bound",
                "Memoization"
            ]
        }
    ];

    window.ALGOLAB_UNITS = UNITS;
})(window);

/*
 * AlgoLab glossary data — the single source of truth for glossary terms.
 *
 * Classic script (no build step) so both the glossary page and module pages
 * can load it with a plain <script> tag:
 *
 *     <script src="js/shell/glossaryData.js"></script>
 *
 * Each entry is { term, def, slug }. `def` may contain a little presentation
 * HTML (<strong>, <em>) for the glossary page; the tooltip renderer strips
 * tags and shows plain text. `slug` is stable and is used for
 * definitions.html#term-<slug> deep links.
 *
 * Exposes: window.ALGOLAB_GLOSSARY = { terms, lookup(term), getBySlug(slug), slugify(term) }
 */
(function (window) {
    "use strict";

    var TERMS = [
        { term: "Admissible Heuristic", def: "A heuristic that never overestimates the cost of reaching the goal. This is a strict requirement for A* to guarantee finding the optimal shortest path.", slug: "admissible-heuristic" },
        { term: "Algorithm", def: "A step-by-step set of instructions designed to perform a specific task or solve a particular problem.", slug: "algorithm" },
        { term: "Amortized Analysis", def: "A way to analyze an algorithm over a <em>sequence</em> of operations, averaging expensive steps out over many cheap steps. Some algorithms have rare costly operations but good amortized performance overall.", slug: "amortized-analysis" },
        { term: "Array", def: "An ordered collection of elements stored at contiguous memory locations. All sorting algorithms in this lab operate on arrays.", slug: "array" },
        { term: "Asymptotic Notation", def: "Mathematical tools (like <strong>Big O</strong>) used to describe the limiting behavior of a function when the argument tends towards a particular value or infinity.", slug: "asymptotic-notation" },
        { term: "Autocomplete", def: "Suggesting every stored key that starts with what the user has typed so far. A trie answers this by walking to the prefix node and listing every word marker in its subtree.", slug: "autocomplete" },
        { term: "Auxiliary Space", def: "The extra space or temporary space used by an algorithm, typically excluding the space used to store the input.", slug: "auxiliary-space" },
        { term: "Average Case", def: "The expected amount of time or space an algorithm requires to execute on a typical input of size n, representing standard real-world conditions.", slug: "average-case" },
        { term: "Backtracking", def: "A search that builds a solution incrementally and abandons a partial solution as soon as it cannot succeed, then tries the next alternative. N-Queens is the classic example.", slug: "backtracking" },
        { term: "Balance Factor", def: "In an AVL tree, the height of a node's left subtree minus the height of its right subtree. A value outside -1, 0, 1 triggers a rotation.", slug: "balance-factor" },
        { term: "Balanced Tree", def: "A tree whose left and right subtrees stay similar in height at every node. Keeping the tree balanced holds search, insert, and delete near O(log n) instead of degrading to O(n).", slug: "balanced-tree" },
        { term: "Best Case", def: "The scenario where the algorithm requires the minimum amount of time or space to execute (e.g., sorting an already sorted array).", slug: "best-case" },
        { term: "Big O Notation (O)", def: "Describes the upper bound of the time or space complexity of an algorithm. It gives the worst-case scenario.", slug: "big-o-notation-o" },
        { term: "Big Omega (Ω)", def: "Describes the lower bound of an algorithm's complexity — the best it can possibly do. An algorithm is Ω(f(n)) if it always takes at least f(n) time.", slug: "big-omega" },
        { term: "Big Theta (Θ)", def: "Describes the tight bound of an algorithm's complexity — when the best and worst case grow at the same rate. Merge Sort is Θ(n log n) because all cases are equal.", slug: "big-theta" },
        { term: "Binary Search Tree", def: "A binary tree where every value in the left subtree is smaller than the node and every value in the right subtree is larger. That ordering lets search, insert, and delete follow a single root-to-leaf path.", slug: "binary-search-tree" },
        { term: "Branch and Bound", def: "A search that prunes whole regions of the solution space once a bound proves they cannot beat the best answer found so far. Used for optimisation problems such as 0/1 Knapsack.", slug: "branch-and-bound" },
        { term: "Breadth-First Search (BFS)", def: "An algorithm for traversing a graph that explores all neighbor nodes at the present depth prior to moving on to the nodes at the next depth level.", slug: "breadth-first-search-bfs" },
        { term: "Cache Locality", def: "The tendency of a processor to access memory locations near recently accessed ones. Algorithms with good cache locality (like Quick Sort) run faster in practice due to fewer cache misses.", slug: "cache-locality" },
        { term: "Closed Set", def: "In pathfinding, the set of nodes that have already been fully processed and finalized. A node in the closed set will not be revisited.", slug: "closed-set" },
        { term: "Clustering", def: "Runs of adjacent occupied slots that build up under linear probing. Colliding keys all walk forward, so probe lengths grow faster than a random model predicts.", slug: "clustering" },
        { term: "Collision", def: "Two different keys hashing to the same bucket. Hash tables resolve collisions by chaining (a list per bucket) or by probing for another slot.", slug: "collision" },
        { term: "Comparison-Based Sort", def: "A sorting algorithm that determines order solely by comparing pairs of elements. All comparison-based sorts have a theoretical lower bound of O(n log n).", slug: "comparison-based-sort" },
        { term: "Comparisons", def: "The operation of checking if one element in a data structure is greater than, less than, or equal to another. Minimizing this is often a key goal in sorting algorithms.", slug: "comparisons" },
        { term: "Complexity Class", def: "A set of computational problems that require similar amounts of resources to solve. Examples include P, NP, and the sorting lower bound of O(n log n).", slug: "complexity-class" },
        { term: "Data Structure", def: "A specialized format for organizing, processing, retrieving and storing data.", slug: "data-structure" },
        { term: "Depth", def: "The number of edges from the root down to a node. The root sits at depth 0. This lab counts edges, so depth is a path length measured from the top.", slug: "depth" },
        { term: "Depth-First Search (DFS)", def: "An algorithm for traversing or searching tree or graph data structures that goes as deep as possible along each branch before backtracking. Often used in maze generation.", slug: "depth-first-search-dfs" },
        { term: "Digest", def: "The fixed-length output of a cryptographic hash function. A SHA-256 digest is 256 bits, written as 64 hex characters, no matter how long the input was.", slug: "digest" },
        { term: "Divide and Conquer", def: "An algorithm design paradigm based on recursively breaking down a problem into two or more sub-problems of the same or related type, until these become simple enough to be solved directly.", slug: "divide-and-conquer" },
        { term: "Dynamic Programming", def: "A method for solving complex problems by breaking them down into simpler overlapping subproblems and storing the results. Bellman-Ford utilizes this approach.", slug: "dynamic-programming" },
        { term: "E (Edges)", def: "In graph algorithms, <strong>E</strong> is the number of edges (connections). On a 4-neighbor grid, E is on the order of V because each node has only a few neighbors.", slug: "e-edges" },
        { term: "Edge", def: "A connection between two nodes in a graph. In a standard grid, edges connect a node to its direct adjacent neighbors.", slug: "edge" },
        { term: "Element", def: "A single piece of data stored within a data structure, like a number in an array that needs to be sorted.", slug: "element" },
        { term: "End-of-Word Marker", def: "A flag on a trie node meaning the path to it spells a complete stored key rather than just a prefix. Without it, car and card would look identical as words.", slug: "end-of-word-marker" },
        { term: "f = g + h", def: "The combined score A* uses to decide what to explore next: real cost so far plus estimated cost remaining.", slug: "f-g-h" },
        { term: "g-score", def: "The real cost from the start node to the current node.", slug: "g-score" },
        { term: "Graph", def: "A mathematical structure used to model pairwise relations between objects. Grids in pathfinding are a type of graph where nodes are connected to their neighbors.", slug: "graph" },
        { term: "Greedy Algorithm", def: "An algorithmic paradigm that makes the locally optimal choice at each stage with the hope of finding a global optimum. Dijkstra's algorithm is a greedy algorithm.", slug: "greedy-algorithm" },
        { term: "h-score", def: "The heuristic estimate of how far the current node still is from the target.", slug: "h-score" },
        { term: "Hash Function", def: "A deterministic function that maps a key to a bucket index. A good hash spreads keys evenly so that lookups do not pile up in one bucket.", slug: "hash-function" },
        { term: "Hash Table", def: "An array of buckets that stores keys by their hash index, trading a little wasted space for average O(1) insert, search, and delete. Collisions are resolved by chaining or open addressing.", slug: "hash-table" },
        { term: "Heap", def: "A specialized tree-based data structure that satisfies the heap property. Used extensively in Heap Sort and Priority Queues.", slug: "heap" },
        { term: "Heap Property", def: "The rule that every parent compares the right way against its children: a max-heap keeps parents greater than or equal to their children, a min-heap keeps them smaller or equal. Heapsort and priority queues depend on it.", slug: "heap-property" },
        { term: "Heapify", def: "The process of converting an arbitrary array into a valid heap structure. Heap Sort begins by heapifying the input before extracting elements in order.", slug: "heapify" },
        { term: "Height", def: "The number of edges on the longest path from a node down to a leaf. This lab counts edges, so a leaf has height 0 and an empty tree has height -1.", slug: "height" },
        { term: "Heuristic", def: "An educated guess or estimate used to rank alternatives in search algorithms. In A*, it estimates the cost from the current node to the target.", slug: "heuristic" },
        { term: "In-place Algorithm", def: "An algorithm that transforms input using no auxiliary data structure. However, a small amount of extra storage space is allowed for auxiliary variables.", slug: "in-place-algorithm" },
        { term: "Iteration", def: "The repetition of a block of code using loops. Most sorting algorithms heavily rely on iteration to scan and rearrange elements.", slug: "iteration" },
        { term: "k (range)", def: "In Counting Sort and Radix Sort, k represents the range of possible key values. The time complexity O(n + k) means performance degrades if k is very large.", slug: "k-range" },
        { term: "Las Vegas Algorithm", def: "A randomized algorithm that always produces a correct result, but whose running time is non-deterministic. Bogo Sort is the most famous (and absurd) example.", slug: "las-vegas-algorithm" },
        { term: "Leaf Hash", def: "The hash of one block's data, before any pairing. In a Merkle tree the leaves commit to the original data; every internal node above them commits only to other hashes.", slug: "leaf-hash" },
        { term: "Linear Probing", def: "Open addressing that checks the next slot, then the next, wrapping at the end. Simple and cache-friendly, but collisions clump into increasingly long runs.", slug: "linear-probing" },
        { term: "Load Factor", def: "The ratio of stored entries to buckets in a hash table. As it approaches 1, collisions and probe lengths grow, which is why the table resizes and rehashes.", slug: "load-factor" },
        { term: "Manhattan Distance", def: "A common heuristic for grid-based pathfinding where movement is restricted to horizontal and vertical steps. It is the sum of the absolute differences of their Cartesian coordinates.", slug: "manhattan-distance" },
        { term: "Memoization", def: "Caching a function's result for a given set of arguments so a repeated subproblem is answered from the cache instead of recomputed. Dynamic programming uses it to turn exponential recursion into polynomial work.", slug: "memoization" },
        { term: "Merkle Root", def: "The single hash at the top of a Merkle tree, computed upward from the hashes of its children. Changing any leaf changes the root, which makes tampering detectable.", slug: "merkle-root" },
        { term: "Merkle Tree", def: "A tree of hashes: leaves hash blocks of data and each parent hashes its two children. One root commits to every block, and a verifier needs only a logarithmic sibling path to check one block.", slug: "merkle-tree" },
        { term: "n (Input Size)", def: "The size of the input. For sorting, <strong>n</strong> is usually the number of elements in the array. Many complexities are expressed as a function of <strong>n</strong>.", slug: "n-input-size" },
        { term: "Negative Edge", def: "An edge in a graph with a negative weight, representing situations where taking a path yields a gain rather than a cost. Bellman-Ford can handle these; Dijkstra cannot.", slug: "negative-edge" },
        { term: "Node (or Vertex)", def: "A fundamental unit of a graph. In the visualizer, each square on the grid represents a node.", slug: "node-or-vertex" },
        { term: "Non-Comparison Sort", def: "A category of sorting algorithm that does not compare elements directly against each other. Instead it exploits structural properties of the data. Counting Sort and Radix Sort are examples.", slug: "non-comparison-sort" },
        { term: "O((V + E) log V)", def: "Typical for Dijkstra/A* with a binary heap priority queue: you may push/pop nodes (log V each) while processing V nodes and relaxing E edges.", slug: "o-v-e-log-v" },
        { term: "O(1) — Constant Time", def: "An operation whose execution time does not change regardless of input size. Accessing a specific array index by position is an O(1) operation.", slug: "o-1-constant-time" },
        { term: "O(log n)", def: "Logarithmic time. The work grows very slowly as n grows. This often appears when a problem size is repeatedly halved (e.g., binary search or recursion depth in balanced divide-and-conquer).", slug: "o-log-n" },
        { term: "O(n log n)", def: "The holy grail complexity for comparison-based sorting. It means the time grows proportionally to n times the logarithm of n — efficient for large datasets.", slug: "o-n-log-n" },
        { term: "O(n!)", def: "Factorial time. Growth is extremely fast. Algorithms that brute-force all permutations (like Bogo Sort’s expected behavior) can involve factorial-scale complexity.", slug: "o-n" },
        { term: "O(n) — Linear Time", def: "Linear time. The work grows proportionally with n. A single full scan through an array is typically O(n).", slug: "o-n-linear-time" },
        { term: "O(n²)", def: "Quadratic time. Often caused by two nested loops over the same n elements, leading to about n × n operations.", slug: "o-n-2" },
        { term: "O(V) — Linear in Nodes", def: "Linear in the number of vertices. Common for space usage in pathfinding when storing distance/visited/previous information per node.", slug: "o-v-linear-in-nodes" },
        { term: "O(VE)", def: "Appears in Bellman-Ford worst-case analysis: repeatedly relaxing edges across up to V−1 rounds gives on the order of V × E work.", slug: "o-ve" },
        { term: "Odd-Node Duplication", def: "The duplicate-last policy for odd levels in a Merkle tree: copy the final node, give the copy its own id, and pair the copy with the original so the level can be combined.", slug: "odd-node-duplication" },
        { term: "Open Addressing", def: "Collision handling that keeps one key per slot and probes for another free slot inside the same table. No chains are allocated, but deletes must leave tombstones and the table resizes sooner.", slug: "open-addressing" },
        { term: "Open Set", def: "In pathfinding, the set of nodes discovered but not yet fully evaluated — the frontier of the search waiting to be explored.", slug: "open-set" },
        { term: "Out-of-place Algorithm", def: "An algorithm that requires additional memory proportional to the input size to operate. Merge Sort and Counting Sort are out-of-place because they build new arrays during sorting.", slug: "out-of-place-algorithm" },
        { term: "Partition", def: "The process of dividing a data structure into two or more parts based on a specific condition, commonly used in Quick Sort.", slug: "partition" },
        { term: "Pathfinding", def: "The algorithmic process of finding a route between two points, typically aiming to find the shortest or optimal path while avoiding obstacles.", slug: "pathfinding" },
        { term: "Permutation", def: "An arrangement of all elements of a set in a particular order. Bogo Sort works by randomly generating permutations until a sorted one is found.", slug: "permutation" },
        { term: "Pivot", def: "A specifically chosen element in an array used to partition the data in algorithms like Quick Sort.", slug: "pivot" },
        { term: "Prefix", def: "The leading part of a string. In a trie, every node on the path from the root spells a prefix, which is exactly why shared prefixes share the same nodes.", slug: "prefix" },
        { term: "Previous Node", def: "The node recorded before another node so the final shortest path can be reconstructed backward from the target.", slug: "previous-node" },
        { term: "Priority Queue", def: "A structure that always pulls out the node with the smallest currently known distance first.", slug: "priority-queue" },
        { term: "Probe", def: "One attempt to find a free or matching slot during open addressing. Linear, quadratic, and double hashing differ only in the sequence of probe positions.", slug: "probe" },
        { term: "Radix", def: "The base of a system of numeration. Radix Sort uses this concept to sort elements by processing individual digits.", slug: "radix" },
        { term: "Recursion", def: "A programming technique where a function calls itself to solve smaller instances of the same problem, foundational to algorithms like Quick Sort and Merge Sort.", slug: "recursion" },
        { term: "Recursive Division", def: "A maze generation algorithm that works by dividing a space into two, adding a wall with a single passage, and repeating the process recursively.", slug: "recursive-division" },
        { term: "Rehash", def: "Recomputing every key's index after the table size changes. A rehash rebuilds from live keys, so tombstones are dropped and every probe path is recalculated.", slug: "rehash" },
        { term: "Relaxation", def: "Testing whether a newly discovered route to a node is better than the best one known so far, and updating it if it is.", slug: "relaxation" },
        { term: "Rotation", def: "A local restructuring of a tree that changes which node is the parent while preserving inorder order. AVL trees use single and double rotations to restore balance after an insert or delete.", slug: "rotation" },
        { term: "Separate Chaining", def: "Collision handling that keeps a list per bucket and appends colliding keys to it. Deletes simply unlink, so there are no tombstones, but chains can grow long at high load.", slug: "separate-chaining" },
        { term: "SHA-256", def: "The SHA-2 hash with a 256-bit output. Merkle trees here use it twice: SHA-256(block bytes) for leaves and SHA-256(left digest || right digest) for parents.", slug: "sha-256" },
        { term: "Shortest Path", def: "The path between two nodes in a graph such that the total sum of edge weights is minimized. Dijkstra, A*, and Bellman-Ford all compute this.", slug: "shortest-path" },
        { term: "Significant Digit", def: "A digit that contributes meaningfully to the value of a number. Radix Sort processes numbers one significant digit at a time, starting from the rightmost.", slug: "significant-digit" },
        { term: "Space Complexity", def: "The total amount of memory space an algorithm requires to run as a function of the length of the input.", slug: "space-complexity" },
        { term: "Stable Sort", def: "A sorting algorithm that preserves the relative order of equal elements in the sorted output.", slug: "stable-sort" },
        { term: "String Key", def: "A key made of characters. String keys are hashed character by character and stored one character per edge in a trie, so both structures depend on the key's length.", slug: "string-key" },
        { term: "Subarray", def: "A contiguous portion of an array. Merge Sort and Quick Sort recursively operate on subarrays until each is sorted.", slug: "subarray" },
        { term: "Successor", def: "The next node in inorder sequence. In a BST, the inorder successor of a node is the smallest value in its right subtree, which is why a two-child deletion uses it as the replacement.", slug: "successor" },
        { term: "Swaps", def: "The operation of exchanging the positions of two elements within a data structure. A high amount of swaps can drastically affect performance.", slug: "swaps" },
        { term: "Tentative Distance", def: "The best distance to a node discovered so far. It can still improve until that node is finalized.", slug: "tentative-distance" },
        { term: "Time Complexity", def: "The total amount of time an algorithm takes to run to completion, often expressed in Big O notation.", slug: "time-complexity" },
        { term: "Timsort", def: "A hybrid sorting algorithm derived from Merge Sort and Insertion Sort. It is the standard sorting algorithm in Python and Java for objects, highly optimized for real-world data.", slug: "timsort" },
        { term: "Tombstone", def: "A deleted-slot marker in open addressing. It is not a live key, yet a probe must keep walking past it so keys placed after it stay reachable; a rehash clears it.", slug: "tombstone" },
        { term: "Traversal", def: "A systematic way of visiting every node in a tree exactly once. Inorder (left, node, right), preorder (node, left, right), postorder (left, right, node), and level order (breadth-first by depth) are the four used here.", slug: "traversal" },
        { term: "Trie", def: "A tree keyed by characters rather than whole values, where each root-to-node path spells a prefix. Shared prefixes share nodes, so lookup time depends on key length rather than the number of keys.", slug: "trie" },
        { term: "Uniform Cost", def: "A property of a graph where moving from one node to any adjacent node incurs the exact same cost or weight.", slug: "uniform-cost" },
        { term: "V (Vertices)", def: "In graph algorithms, <strong>V</strong> is the number of vertices (nodes) in the graph. On a grid, V is roughly the number of squares (rows × columns) that are considered nodes.", slug: "v-vertices" },
        { term: "Wall / Obstacle", def: "A node in the pathfinding grid that is impassable. The algorithm must route around all wall nodes to find a valid path.", slug: "wall-obstacle" },
        { term: "Weighted Graph", def: "A graph where each edge has a numerical value (weight) representing a cost, distance, or time. Many real-world pathfinding problems use weighted graphs.", slug: "weighted-graph" },
        { term: "0/1 Knapsack", def: "A problem where each item is either taken whole or left behind; the goal is to maximize value without exceeding capacity.", slug: "zero-one-knapsack" },
        { term: "N-Queens", def: "The problem of placing N queens on an NxN board so that no two queens attack each other.", slug: "n-queens" },
        { term: "Partial Solution", def: "An incomplete assignment during search that may still be extended into a full solution.", slug: "partial-solution" }
    ];

    // Alphabetical, for the glossary page's default order.
    TERMS.sort(function (a, b) {
        return a.term.localeCompare(b.term);
    });

    var BY_TERM = Object.create(null);
    var BY_SLUG = Object.create(null);
    TERMS.forEach(function (entry) {
        BY_TERM[entry.term.toLowerCase()] = entry;
        BY_SLUG[entry.slug] = entry;
    });

    function slugify(term) {
        return String(term)
            .toLowerCase()
            .replace(/&/g, " and ")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    /** Case-insensitive exact term lookup. Returns null when absent. */
    function lookup(term) {
        if (typeof term !== "string") return null;
        return BY_TERM[term.trim().toLowerCase()] || null;
    }

    /** Slug lookup, for definitions.html#term-<slug>. Returns null when absent. */
    function getBySlug(slug) {
        if (typeof slug !== "string") return null;
        return BY_SLUG[slug] || null;
    }

    window.ALGOLAB_GLOSSARY = {
        terms: TERMS,
        lookup: lookup,
        getBySlug: getBySlug,
        slugify: slugify
    };
})(window);

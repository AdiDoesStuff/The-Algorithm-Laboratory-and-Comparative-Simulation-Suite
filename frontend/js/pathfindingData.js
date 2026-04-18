const pathfindingDetails = {
    dijkstra: {
        name: "Dijkstra's Algorithm",
        vibe: "A slow, disciplined wave. It expands outward evenly, refusing to guess and checking every promising route in order.",
        codeSnippet: `import heapq

def dijkstra(rows, cols, start, end, walls):
    visited_nodes_in_order = []
    distances = {start: 0}
    previous_nodes = {}
    pq = [(0, start)]
    visited = set()

    while pq:
        dist, current = heapq.heappop(pq)

        if current in visited:
            continue

        visited.add(current)
        visited_nodes_in_order.append(current)

        if current == end:
            break

        for neighbor in get_neighbors(current, rows, cols, walls):
            if neighbor in visited:
                continue

            new_dist = dist + 1
            if new_dist < distances.get(neighbor, float('inf')):
                distances[neighbor] = new_dist
                previous_nodes[neighbor] = current
                heapq.heappush(pq, (new_dist, neighbor))`,
        timeWorst: "O((V + E) log V)",
        space: "O(V)",
        type: "Uninformed Search / Shortest Path",
        weightedSupport: "Not in the current visualizer; current grid uses uniform cost.",
        shortestPathGuarantee: "Yes, for the current non-negative uniform-cost grid.",
        glossary: [
            {
                term: "Tentative Distance",
                definition: "The best distance to a node discovered so far. It can still improve until that node is finalized."
            },
            {
                term: "Priority Queue",
                definition: "A structure that always pulls out the node with the smallest currently known distance first."
            }
        ],
        labObservation: "Watch the visited nodes spread almost like a ripple in a pond. Dijkstra does not lean toward the goal early; it explores every equally cheap direction before committing.",
        prosCons: {
            pro: "Guarantees the best route on non-negative graphs.",
            con: "It can waste time exploring large areas that are nowhere near the target."
        },
        useCase: "Used in routing systems, network analysis, and any setting where guaranteed shortest paths matter more than directional speed.",
        creator: "Edsger W. Dijkstra",
        date: "1956"
    },
    astar: {
        name: "A* Search",
        vibe: "A smart, targeted sniper. It still measures real path cost, but it aims its search toward the target instead of expanding blindly.",
        codeSnippet: `import heapq
import itertools

def a_star(rows, cols, start, end, walls):
    visited_nodes_in_order = []
    g_scores = {start: 0}
    previous_nodes = {}
    counter = itertools.count()
    pq = [(heuristic(start, end), 0, next(counter), start)]
    closed_set = set()

    while pq:
        _, _, _, current = heapq.heappop(pq)

        if current in closed_set:
            continue

        visited_nodes_in_order.append(current)
        closed_set.add(current)

        if current == end:
            break

        for neighbor in get_neighbors(current, rows, cols, walls):
            if neighbor in closed_set:
                continue

            tentative_g_score = g_scores[current] + 1
            if tentative_g_score < g_scores.get(neighbor, float('inf')):
                previous_nodes[neighbor] = current
                g_scores[neighbor] = tentative_g_score
                f_score = tentative_g_score + heuristic(neighbor, end)
                heapq.heappush(
                    pq,
                    (f_score, -tentative_g_score, next(counter), neighbor)
                )`,
        timeWorst: "O((V + E) log V)",
        space: "O(V)",
        type: "Informed Search / Heuristic Search",
        weightedSupport: "Not in the current visualizer; current grid uses uniform cost.",
        shortestPathGuarantee: "Yes, with the current admissible Manhattan-style setup on this grid.",
        glossary: [
            {
                term: "g-score",
                definition: "The real cost from the start node to the current node."
            },
            {
                term: "h-score",
                definition: "The heuristic estimate of how far the current node still is from the target."
            },
            {
                term: "f = g + h",
                definition: "The combined score A* uses to decide what to explore next: real cost so far plus estimated cost remaining."
            }
        ],
        labObservation: "Notice how the search reaches toward the target instead of expanding in a neat circle. A* ignores many nodes behind or far away from the goal because its heuristic keeps it focused.",
        prosCons: {
            pro: "Usually much faster than Dijkstra when the heuristic is good.",
            con: "Its quality and efficiency depend heavily on that heuristic being appropriate."
        },
        useCase: "Used in video games, robot navigation, interactive maps, and any system that needs fast pathfinding toward a known destination.",
        creator: "Peter Hart, Nils Nilsson, and Bertram Raphael",
        date: "1968"
    },
    bellmanford: {
        name: "Bellman-Ford",
        vibe: "A patient rule-checker. It keeps relaxing paths over and over, willing to revisit earlier assumptions until no better route appears.",
        codeSnippet: `from collections import deque

def bellman_ford(rows, cols, start, end, walls):
    visited_nodes_in_order = []
    distances = {start: 0}
    previous_nodes = {}
    queue = deque([start])
    in_queue = {start}

    while queue:
        current = queue.popleft()
        in_queue.remove(current)
        visited_nodes_in_order.append(current)

        if current == end:
            break

        for neighbor in get_neighbors(current, rows, cols, walls):
            new_dist = distances[current] + 1
            if new_dist < distances.get(neighbor, float('inf')):
                distances[neighbor] = new_dist
                previous_nodes[neighbor] = current

                if neighbor not in in_queue:
                    queue.append(neighbor)
                    in_queue.add(neighbor)`,
        timeWorst: "O(VE)",
        space: "O(V)",
        type: "Dynamic Programming / Relaxation-Based Shortest Path",
        weightedSupport: "Not in the current visualizer; current grid uses uniform cost.",
        shortestPathGuarantee: "Yes, in theory; current visualizer uses a simplified queue-based grid variant.",
        glossary: [
            {
                term: "Relaxation",
                definition: "Testing whether a newly discovered route to a node is better than the best one known so far, and updating it if it is."
            },
            {
                term: "Previous Node",
                definition: "The node recorded before another node so the final shortest path can be reconstructed backward from the target."
            }
        ],
        labObservation: "Look for repeated corrections. Bellman-Ford is comfortable revisiting assumptions, so it can feel less direct than A* and less tidy than Dijkstra's outward wave.",
        prosCons: {
            pro: "Famous for handling more general shortest-path situations, including negative edges in theory.",
            con: "It is usually slower than Dijkstra or A* on a simple grid like this."
        },
        useCase: "Useful in networking theory and graph analysis when edge weights may vary in ways that break greedier approaches.",
        creator: "Richard Bellman and Lester Ford Jr.",
        date: "1958"
    }
};

import heapq
import itertools

def get_neighbors(node, rows, cols, walls):
    r, c = node
    directions = [(0, 1), (1, 0), (0, -1), (-1, 0)]
    neighbors = []
    for dr, dc in directions:
        nr, nc = r + dr, c + dc
        if 0 <= nr < rows and 0 <= nc < cols and (nr, nc) not in walls:
            neighbors.append((nr, nc))
    return neighbors

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
                heapq.heappush(pq, (new_dist, neighbor))
                
    path = []
    curr = end
    if curr in previous_nodes or curr == start:
        while curr in previous_nodes:
            path.insert(0, curr)
            curr = previous_nodes[curr]
        path.insert(0, start)
        
    return {
        "visited_nodes": [{"row": r, "col": c} for r, c in visited_nodes_in_order],
        "path": [{"row": r, "col": c} for r, c in path]
    }

def heuristic(node_a, node_b):
    return abs(node_a[0] - node_b[0]) + abs(node_a[1] - node_b[1])

def a_star(rows, cols, start, end, walls):
    visited_nodes_in_order = []
    g_scores = {start: 0}
    f_scores = {start: heuristic(start, end)}
    previous_nodes = {}
    
    counter = itertools.count()
    pq = [(f_scores[start], 0, next(counter), start)]
    open_set_hash = {start}
    closed_set = set()
    
    while pq:
        _, _, _, current = heapq.heappop(pq)
        
        if current in open_set_hash:
            open_set_hash.remove(current)
        
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
                f_scores[neighbor] = f_score
                heapq.heappush(pq, (f_score, -tentative_g_score, next(counter), neighbor))
                open_set_hash.add(neighbor)
                    
    path = []
    curr = end
    if curr in previous_nodes or curr == start:
        while curr in previous_nodes:
            path.insert(0, curr)
            curr = previous_nodes[curr]
        path.insert(0, start)
        
    return {
        "visited_nodes": [{"row": r, "col": c} for r, c in visited_nodes_in_order],
        "path": [{"row": r, "col": c} for r, c in path]
    }

def bellman_ford(rows, cols, start, end, walls):
    from collections import deque
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
                    in_queue.add(neighbor)
                    
    path = []
    curr = end
    if curr in previous_nodes or curr == start:
        while curr in previous_nodes:
            path.insert(0, curr)
            curr = previous_nodes[curr]
        path.insert(0, start)
        
    return {
        "visited_nodes": [{"row": r, "col": c} for r, c in visited_nodes_in_order],
        "path": [{"row": r, "col": c} for r, c in path]
    }

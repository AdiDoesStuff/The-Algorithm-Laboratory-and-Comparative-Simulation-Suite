from flask import Flask, jsonify , request
from flask_cors import CORS
import algs
import pathfinding

app = Flask(__name__)
CORS(app)

@app.route('/sort', methods=['POST'])
def sort_handler():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON payload"}), 400

    if 'array' not in data or 'algorithm' not in data:
        return jsonify({"error": "Missing required fields: 'array' and 'algorithm'"}), 400

    array = data.get('array')
    algo = data.get('algorithm')

    if not isinstance(array, list) or len(array) == 0:
        return jsonify({"error": "'array' must be a non-empty list"}), 400

    if not isinstance(algo, str):
        return jsonify({"error": "'algorithm' must be a string"}), 400

    if algo == 'bubble':
        result = algs.bubble_sort_steps(array)
    elif algo == 'selection':
        result = algs.selection_sort_steps(array)
    elif algo == 'quick':
        result = algs.quick_sort_steps(array)
    elif algo == 'insertion':
        result = algs.insertion_sort_steps(array)
    elif algo == 'bogo':
        result = algs.bogo_sort_steps(array)
    elif algo == 'merge':
        result = algs.merge_sort_steps(array)
    elif algo == 'heap':
        result = algs.heap_sort_steps(array)
    elif algo == "optbogo":
        result = algs.optimized_bogo_sort_steps(array)
    elif algo == "counting":
        result = algs.counting_sort_steps(array)
    elif algo == "radix":
        result = algs.radix_sort_steps(array)
    else:
        return jsonify({"error": "Invalid algorithm"}), 400
    
    
    return jsonify(result)

@app.route('/pathfind', methods=['POST'])
def pathfind_handler():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON payload"}), 400

    algorithm = data.get('algorithm')
    rows = data.get('rows')
    cols = data.get('cols')
    start_node = data.get('startNode')
    end_node = data.get('endNode')
    walls_list = data.get('walls', [])

    if not isinstance(algorithm, str):
        return jsonify({"error": "Missing or invalid 'algorithm'"}), 400

    if not isinstance(rows, int) or not isinstance(cols, int):
        return jsonify({"error": "'rows' and 'cols' must be integers"}), 400

    if not isinstance(start_node, dict) or not isinstance(end_node, dict):
        return jsonify({"error": "'startNode' and 'endNode' are required objects"}), 400

    if not isinstance(walls_list, list):
        return jsonify({"error": "'walls' must be a list"}), 400

    required_node_keys = {'row', 'col'}
    if not required_node_keys.issubset(start_node.keys()) or not required_node_keys.issubset(end_node.keys()):
        return jsonify({"error": "'startNode' and 'endNode' must include 'row' and 'col'"}), 400

    if not all(isinstance(start_node[k], int) for k in required_node_keys) or not all(isinstance(end_node[k], int) for k in required_node_keys):
        return jsonify({"error": "'row' and 'col' must be integers"}), 400

    for wall in walls_list:
        if not isinstance(wall, dict) or not required_node_keys.issubset(wall.keys()):
            return jsonify({"error": "Each wall must include 'row' and 'col'"}), 400
        if not isinstance(wall['row'], int) or not isinstance(wall['col'], int):
            return jsonify({"error": "Wall coordinates must be integers"}), 400

    # Convert walls to set of tuples for O(1) lookup
    walls = {(w['row'], w['col']) for w in walls_list}
    start = (start_node['row'], start_node['col'])
    end = (end_node['row'], end_node['col'])

    if algorithm == 'dijkstra':
        result = pathfinding.dijkstra(rows, cols, start, end, walls)
    elif algorithm == 'astar':
        result = pathfinding.a_star(rows, cols, start, end, walls)
    elif algorithm == 'bellmanford':
        result = pathfinding.bellman_ford(rows, cols, start, end, walls)
    else:
        return jsonify({"error": "Invalid pathfinding algorithm"}), 400

    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True)

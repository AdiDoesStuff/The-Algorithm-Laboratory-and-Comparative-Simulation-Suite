from flask import Flask, jsonify , request
from flask_cors import CORS
import algs
import pathfinding

app = Flask(__name__)
CORS(app)

@app.route('/sort', methods=['POST'])
def sort_handler():
    data = request.json
    array = data.get('array')
    algo = data.get('algorithm')

    if not array:
        return jsonify({"error": "No array provided"}), 400

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
    data = request.json
    algorithm = data.get('algorithm')
    rows = data.get('rows')
    cols = data.get('cols')
    start_node = data.get('startNode')
    end_node = data.get('endNode')
    walls_list = data.get('walls', [])

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

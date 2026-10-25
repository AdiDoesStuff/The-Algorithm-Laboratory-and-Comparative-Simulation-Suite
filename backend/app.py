import logging
from pathlib import Path
from werkzeug.exceptions import HTTPException

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import algs
import pathfinding
import trees
import validation
from validation import ValidationError

app = Flask(__name__)
CORS(app)
logger = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


# --- Global Flask Error Handlers (Every error returns {"error": "...", "field": "..."}) ---

@app.errorhandler(ValidationError)
def handle_validation_error(e):
    return jsonify({"error": e.message, "field": e.field}), e.status_code


@app.errorhandler(HTTPException)
def handle_http_exception(e):
    # Preserves HTTPException status code (e.g. 405 Method Not Allowed, 404, 415)
    return jsonify({"error": e.description, "field": "request"}), e.code


@app.errorhandler(Exception)
def handle_unexpected_exception(e):
    logger.exception("Unhandled server exception: %s", e)
    return jsonify({"error": "Internal server error", "field": "server"}), 500


@app.route('/', methods=['GET'])
def index_page():
    return send_from_directory(FRONTEND_DIR, 'index.html')


@app.route('/<path:filename>', methods=['GET'])
def frontend_file(filename):
    return send_from_directory(FRONTEND_DIR, filename)


@app.route('/sort', methods=['POST'])
def sort_handler():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValidationError("Invalid JSON payload", field="body")

    if 'array' not in data or 'algorithm' not in data:
        raise ValidationError("Missing required fields: 'array' and 'algorithm'", field="body")

    array = data.get('array')
    algo = data.get('algorithm')

    if not isinstance(array, list) or len(array) == 0:
        raise ValidationError("'array' must be a non-empty list", field="array")

    if not isinstance(algo, str):
        raise ValidationError("'algorithm' must be a string", field="algorithm")

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
        raise ValidationError(f"Invalid sorting algorithm: {algo}", field="algorithm")

    return jsonify(result)


@app.route('/pathfind', methods=['POST'])
def pathfind_handler():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValidationError("Invalid JSON payload", field="body")

    algorithm = data.get('algorithm')
    rows = data.get('rows')
    cols = data.get('cols')
    start_node = data.get('startNode')
    end_node = data.get('endNode')
    walls_list = data.get('walls', [])

    if not isinstance(algorithm, str):
        raise ValidationError("Missing or invalid 'algorithm'", field="algorithm")

    if not isinstance(rows, int) or not isinstance(cols, int):
        raise ValidationError("'rows' and 'cols' must be integers", field="rows")

    if not isinstance(start_node, dict) or not isinstance(end_node, dict):
        raise ValidationError("'startNode' and 'endNode' are required objects", field="startNode")

    if not isinstance(walls_list, list):
        raise ValidationError("'walls' must be a list", field="walls")

    required_node_keys = {'row', 'col'}
    if not required_node_keys.issubset(start_node.keys()) or not required_node_keys.issubset(end_node.keys()):
        raise ValidationError("'startNode' and 'endNode' must include 'row' and 'col'", field="startNode")

    if not all(isinstance(start_node[k], int) for k in required_node_keys) or not all(isinstance(end_node[k], int) for k in required_node_keys):
        raise ValidationError("'row' and 'col' must be integers", field="startNode")

    for wall in walls_list:
        if not isinstance(wall, dict) or not required_node_keys.issubset(wall.keys()):
            raise ValidationError("Each wall must include 'row' and 'col'", field="walls")
        if not isinstance(wall['row'], int) or not isinstance(wall['col'], int):
            raise ValidationError("Wall coordinates must be integers", field="walls")

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
        raise ValidationError(f"Invalid pathfinding algorithm: {algorithm}", field="algorithm")

    return jsonify(result)


from werkzeug.exceptions import HTTPException, MethodNotAllowed

@app.route('/tree', methods=['GET', 'POST'])
def tree_handler():
    if request.method != 'POST':
        raise MethodNotAllowed()

    data = request.get_json(silent=True)
    if data is None:
        raise ValidationError("Request body must be a JSON object", field="body")

    validated, err_tuple = validation.validate_tree_payload(data)
    if err_tuple:
        err_msg, err_field = err_tuple
        raise ValidationError(err_msg, field=err_field, status_code=400)

    algo = validated['algorithm']
    tree_type = validated.get('tree_type', 'bst')
    input_data = validated.get('array') if tree_type == 'binary' else validated.get('ops', [])

    if algo == 'bst_insert':
        return jsonify(trees.bst_insert_steps(input_data, validated['new_value']))
    elif algo == 'bst_delete':
        return jsonify(trees.bst_delete_steps(input_data, validated['delete_value']))
    elif algo == 'bst_traverse':
        return jsonify(trees.bst_traversal_steps(input_data, validated['order'], tree_type))
    elif algo == 'bst_classify':
        return jsonify(trees.bst_classify(input_data, tree_type))
    elif algo == 'bst_height_depth':
        return jsonify(trees.bst_height_depth(input_data, validated.get('target_value'), tree_type, validated.get('target_id')))
    elif algo == 'array_to_tree':
        return jsonify(trees.array_to_binary_tree_steps(validated['array']))
    elif algo == 'heap_insert':
        return jsonify(trees.heap_insert_steps(input_data))
    elif algo == 'avl_insert':
        return jsonify(trees.avl_insert_steps(input_data))

    raise ValidationError(f"Unknown tree algorithm: {algo}", field="algorithm")


@app.route('/hash', methods=['POST'])
def hash_handler():
    data = request.get_json(silent=True) or {}
    method = data.get('method', 'chaining')
    keys = data.get('keys', [])
    table_size = data.get('tableSize', 8)
    return jsonify(trees.hash_insert_steps(keys, method, table_size))


@app.route('/dp', methods=['POST'])
def dp_handler():
    return jsonify({"steps": [], "metadata": {"problem": "dp"}})


@app.route('/bench', methods=['POST'])
def bench_handler():
    return jsonify({"series": [], "metadata": {"benchmark": "growth"}})


if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)

from flask import Flask, jsonify , request
from flask_cors import CORS
import algs

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
    else:
        return jsonify({"error": "Invalid algorithm"}), 400
    
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True)

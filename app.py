from flask import Flask, jsonify , request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

def bubble_sort_steps(arr):
    steps = [] 
    n = len(arr)
    temp_arr = arr.copy()
    for i in range(n):
        for j in range(0, n-i-1):
            steps.append({'type' : 'compare' , 'indices' : [j , j+1], 'current_state' : temp_arr.copy()})
            if temp_arr[j] > temp_arr[j+1]:
                temp_arr[j], temp_arr[j+1] = temp_arr[j+1], temp_arr[j]
                steps.append({'type': 'swap', 'indices': [j, j+1], 'current_state': temp_arr.copy()})
    return steps

def selection_sort_steps(arr):
    steps = []
    n = len(arr)
    temp_arr = arr.copy()
    for i in range(n):
        min_idx = i
        for j in range(i+1, n):
            # Record comparison
            steps.append({'type': 'compare', 'indices': [min_idx, j], 'current_state': temp_arr.copy()})
            if temp_arr[j] < temp_arr[min_idx]:
                min_idx = j
        # Record swap
        temp_arr[i], temp_arr[min_idx] = temp_arr[min_idx], temp_arr[i]
        steps.append({'type': 'swap', 'indices': [i, min_idx], 'current_state': temp_arr.copy()})
    return steps


@app.route('/sort', methods=['POST'])

def sort_handler():
    data = request.json
    array = data.get('array')
    algo = data.get('algorithm')

    if algo == 'bubble':
        result = bubble_sort_steps(array)
    else:
        result = selection_sort_steps(array)
    
    return jsonify(result)

if __name__ == '__main__':
    app.run(debug=True)

import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import algs
import app as flask_app


def _final_state(result, original):
    steps = result.get("steps", [])
    if not steps:
        return original
    return steps[-1]["current_state"]


def test_bubble_sort_reaches_sorted_state():
    arr = [5, 1, 4, 2, 3]
    result = algs.bubble_sort_steps(arr)
    assert _final_state(result, arr) == sorted(arr)


def test_selection_sort_reaches_sorted_state():
    arr = [9, 3, 7, 1, 5]
    result = algs.selection_sort_steps(arr)
    assert _final_state(result, arr) == sorted(arr)


def test_insertion_sort_reaches_sorted_state():
    arr = [8, 4, 6, 2]
    result = algs.insertion_sort_steps(arr)
    assert _final_state(result, arr) == sorted(arr)


def test_merge_sort_reaches_sorted_state():
    arr = [10, 7, 8, 9, 1, 5]
    result = algs.merge_sort_steps(arr)
    assert _final_state(result, arr) == sorted(arr)


def test_counting_sort_handles_empty_array():
    result = algs.counting_sort_steps([])
    assert result["steps"] == []
    assert result["execution_time"] == 0


def test_radix_sort_reaches_sorted_state():
    arr = [170, 45, 75, 90, 802, 24, 2, 66]
    result = algs.radix_sort_steps(arr)
    assert _final_state(result, arr) == sorted(arr)


def test_sort_endpoint_rejects_missing_fields():
    client = flask_app.app.test_client()
    response = client.post("/sort", json={"algorithm": "bubble"})
    assert response.status_code == 400


def test_sort_endpoint_rejects_empty_array():
    client = flask_app.app.test_client()
    response = client.post("/sort", json={"algorithm": "bubble", "array": []})
    assert response.status_code == 400


def test_sort_endpoint_accepts_valid_payload():
    client = flask_app.app.test_client()
    response = client.post("/sort", json={"algorithm": "bubble", "array": [3, 2, 1]})
    data = response.get_json()
    assert response.status_code == 200
    assert "steps" in data
    assert "execution_time" in data


def test_pathfind_endpoint_rejects_missing_node_coordinates():
    client = flask_app.app.test_client()
    payload = {
        "algorithm": "dijkstra",
        "rows": 10,
        "cols": 10,
        "startNode": {"row": 0},
        "endNode": {"row": 9, "col": 9},
        "walls": [],
    }
    response = client.post("/pathfind", json=payload)
    assert response.status_code == 400

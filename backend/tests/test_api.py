import json
import pytest
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import app


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


# --- 1. Op-log shape & Deprecated values shim ---

def test_api_bst_insert_op_log(client):
    payload = {
        "algorithm": "bst_insert",
        "ops": [
            {"op": "insert", "value": 50},
            {"op": "insert", "value": 30}
        ],
        "new_value": 70
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert "steps" in data
    assert "final_tree" in data
    nodes = {n['label']: n for n in data['final_tree']['nodes']}
    assert nodes['70']['id'] == 2


def test_api_bst_insert_values_shim(client):
    payload = {
        "algorithm": "bst_insert",
        "values": [50, 30],
        "new_value": 70
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert "steps" in data
    assert "final_tree" in data
    nodes = {n['label']: n for n in data['final_tree']['nodes']}
    assert nodes['70']['id'] == 2


# --- 2. Duplicate handling (HTTP 400 + field) ---

def test_api_duplicate_new_value_rejected_with_400(client):
    payload = {
        "algorithm": "bst_insert",
        "ops": [{"op": "insert", "value": 50}],
        "new_value": 50
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert "error" in data and "field" in data
    assert data["field"] == "new_value"
    assert "Duplicate value" in data['error']


def test_api_duplicate_in_ops_rejected_with_400(client):
    payload = {
        "algorithm": "bst_traverse",
        "ops": [
            {"op": "insert", "value": 20},
            {"op": "insert", "value": 20}
        ]
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert "error" in data and "field" in data
    assert data["field"] == "ops"
    assert "Duplicate insert value" in data['error']


def test_api_duplicate_in_values_shim_rejected_with_400(client):
    payload = {
        "algorithm": "bst_classify",
        "values": [10, 20, 10]
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert "error" in data and "field" in data
    assert data["field"] == "values"
    assert "Duplicate insert value" in data['error']


# --- 3. Absent Delete Rejection (HTTP 400 + field="delete_value") ---

def test_api_delete_absent_value_rejected_with_400(client):
    payload = {
        "algorithm": "bst_delete",
        "ops": [{"op": "insert", "value": 50}],
        "delete_value": 999
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert "error" in data and "field" in data
    assert data["field"] == "delete_value"
    assert "not found in tree" in data["error"]


# --- 4. Binary Mode: Rejects ops, Requires array ---

def test_api_binary_mode_rejects_ops(client):
    payload = {
        "algorithm": "bst_traverse",
        "tree_type": "binary",
        "ops": [{"op": "insert", "value": 10}]
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data["field"] == "ops"
    assert "Binary mode does not accept 'ops'" in data["error"]


def test_api_binary_mode_requires_array(client):
    payload = {
        "algorithm": "bst_classify",
        "tree_type": "binary"
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data["field"] == "array"
    assert "Missing or invalid 'array' field" in data["error"]


# --- 5. Bad-payload Test for Each /tree Algorithm (Confirming 400 + field) ---

@pytest.mark.parametrize("payload,expected_field", [
    ({"algorithm": "bst_insert"}, "new_value"),
    ({"algorithm": "bst_delete"}, "delete_value"),
    ({"algorithm": "bst_traverse", "order": "bad_order"}, "order"),
    ({"algorithm": "bst_classify", "tree_type": "invalid_mode"}, "tree_type"),
    ({"algorithm": "bst_height_depth"}, "target_value"),
    ({"algorithm": "array_to_tree"}, "array"),
    ({"algorithm": "heap_insert", "ops": "not_a_list"}, "ops"),
    ({"algorithm": "avl_insert", "ops": [{"op": "invalid"}]}, "ops"),
])
def test_api_bad_payload_for_each_algorithm(client, payload, expected_field):
    res = client.post('/tree', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert "error" in data
    assert "field" in data
    assert data["field"] == expected_field


def test_api_missing_or_bad_algorithm(client):
    res_missing = client.post('/tree', json={})
    assert res_missing.status_code == 400
    assert res_missing.get_json()["field"] == "algorithm"

    res_unknown = client.post('/tree', json={"algorithm": "magic_tree"})
    assert res_unknown.status_code == 400
    assert res_unknown.get_json()["field"] == "algorithm"


def test_api_non_json_body(client):
    res = client.post('/tree', data="not_json", content_type="application/json")
    assert res.status_code == 400
    data = res.get_json()
    assert data["field"] == "body"


# --- 6. Binary Mode Requests & Responses (bst_traverse, bst_classify, bst_height_depth) ---

def test_api_binary_mode_traverse(client):
    payload = {
        "algorithm": "bst_traverse",
        "tree_type": "binary",
        "array": [10, 20, 30, None, 40],
        "order": "level"
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert "steps" in data
    assert "final_tree" in data
    assert "warnings" in data
    # 4 visited nodes
    assert len(data["steps"]) == 4


def test_api_binary_mode_classify(client):
    payload = {
        "algorithm": "bst_classify",
        "tree_type": "binary",
        "array": [10, 20, 30, 40, 50, 60, 70]
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert data["is_perfect"] is True
    assert data["node_count"] == 7
    assert "warnings" in data


def test_api_binary_mode_height_depth(client):
    payload = {
        "algorithm": "bst_height_depth",
        "tree_type": "binary",
        "array": [10, 20, 30, 40],
        "target_value": 40
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert data["depth"] == 2
    assert data["height"] == 0
    assert "warnings" in data


# --- 7. Hole Policy Warnings in array_to_tree ---

def test_api_array_to_tree_hole_policy_warnings(client):
    payload = {
        "algorithm": "array_to_tree",
        "array": [10, None, 20, 30, 40]
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert "warnings" in data
    assert len(data["warnings"]) == 2
    assert "array[3] = 30 dropped" in data["warnings"][0]
    assert "array[4] = 40 dropped" in data["warnings"][1]


# --- 8. BST Delete Flow & delete_done Step ---

def test_api_bst_delete_steps(client):
    payload = {
        "algorithm": "bst_delete",
        "ops": [
            {"op": "insert", "value": 50},
            {"op": "insert", "value": 30},
            {"op": "insert", "value": 70}
        ],
        "delete_value": 30
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert data["steps"][-1]["type"] == "delete_done"
    labels = [n['label'] for n in data['final_tree']['nodes']]
    assert "30" not in labels

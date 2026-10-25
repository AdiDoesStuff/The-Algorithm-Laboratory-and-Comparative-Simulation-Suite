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


def test_api_bst_values_shim_rejected_with_400(client):
    payload = {
        "algorithm": "bst_insert",
        "values": [50, 30],
        "new_value": 70
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert "error" in data and "field" in data
    assert data["field"] == "values"
    assert "no longer supported" in data['error']


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


def test_api_values_with_duplicates_rejected_as_shim(client):
    payload = {
        "algorithm": "bst_classify",
        "values": [10, 20, 10]
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert "error" in data and "field" in data
    assert data["field"] == "values"
    assert "no longer supported" in data['error']


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
    ({"algorithm": "bst_insert", "ops": [{"op": "invalid"}]}, "ops"),
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


# --- 9. HTTP Error Handling & Precedence Tests ---

def test_api_get_tree_returns_405_json(client):
    res = client.get('/tree')
    assert res.status_code == 405
    data = res.get_json()
    assert data["field"] == "request"
    assert "method is not allowed" in data["error"].lower()


def test_api_height_depth_target_id_exclusive(client):
    # Tree with 50 (id 0) and 20 (id 1)
    payload_valid = {
        "algorithm": "bst_height_depth",
        "ops": [
            {"op": "insert", "value": 50},
            {"op": "insert", "value": 20}
        ],
        "target_id": 1
    }
    res_valid = client.post('/tree', json=payload_valid)
    assert res_valid.status_code == 200
    assert res_valid.get_json()["target_id"] == 1

    # Absent target_id: must return 400 with field="target_id", NOT fall back to target_value
    payload_absent_id = {
        "algorithm": "bst_height_depth",
        "ops": [
            {"op": "insert", "value": 50},
            {"op": "insert", "value": 20}
        ],
        "target_id": 999,
        "target_value": 20
    }
    res_absent = client.post('/tree', json=payload_absent_id)
    assert res_absent.status_code == 400
    data = res_absent.get_json()
    assert data["field"] == "target_id"
    assert "not found in tree" in data["error"]


def test_api_generic_500_handler(client, monkeypatch):
    import trees
    def broken_insert(*args, **kwargs):
        raise RuntimeError("Unexpected internal crash")

    monkeypatch.setattr(trees, "bst_insert_steps", broken_insert)
    payload = {
        "algorithm": "bst_insert",
        "ops": [],
        "new_value": 10
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 500
    data = res.get_json()
    assert data == {"error": "Internal server error", "field": "server"}


# --- 10. bst_mirror API Tests ---

def _ops(values):
    return [{"op": "insert", "value": v} for v in values]


def test_api_mirror_happy_path(client):
    # A = BST [10, 5, 20]: root=10, left=5, right=20
    # B = binary array [10, 20, 5]: root=10, left=20, right=5  (genuine mirror)
    payload = {
        "algorithm": "bst_mirror",
        "mode": "mirror",
        "tree_a": {"tree_type": "bst", "ops": _ops([10, 5, 20])},
        "tree_b": {"tree_type": "binary", "array": [10, 20, 5]},
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert "verdict" in data
    assert "steps" in data
    assert "final_tree_a" in data
    assert "final_tree_b" in data
    assert "warnings" in data
    assert data["verdict"]["is_match"] is True


def test_api_mirror_identical_mode(client):
    payload = {
        "algorithm": "bst_mirror",
        "mode": "identical",
        "tree_a": {"tree_type": "bst", "ops": _ops([10, 5, 20])},
        "tree_b": {"tree_type": "bst", "ops": _ops([10, 5, 20])},
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert data["verdict"]["is_match"] is True


def test_api_mirror_mismatch_returns_first_mismatch(client):
    payload = {
        "algorithm": "bst_mirror",
        "mode": "mirror",
        "tree_a": {"tree_type": "bst", "ops": _ops([10, 5, 20])},
        "tree_b": {"tree_type": "bst", "ops": _ops([10, 5])},
    }
    res = client.post('/tree', json=payload)
    assert res.status_code == 200
    data = res.get_json()
    assert data["verdict"]["is_match"] is False
    assert data["verdict"]["first_mismatch"] is not None


def test_api_mirror_steps_have_snapshot_a_b(client):
    payload = {
        "algorithm": "bst_mirror",
        "mode": "mirror",
        "tree_a": {"tree_type": "bst", "ops": _ops([10])},
        "tree_b": {"tree_type": "bst", "ops": _ops([10])},
    }
    res = client.post('/tree', json=payload)
    data = res.get_json()
    for step in data["steps"]:
        assert "snapshot_a" in step
        assert "snapshot_b" in step
        assert "snapshot" not in step


@pytest.mark.parametrize("payload,expected_field", [
    ({"algorithm": "bst_mirror", "tree_b": {"tree_type": "bst", "ops": []}}, "tree_a"),
    ({"algorithm": "bst_mirror", "tree_a": {"tree_type": "bst", "ops": []}}, "tree_b"),
    ({"algorithm": "bst_mirror", "tree_a": "not_a_dict",
      "tree_b": {"tree_type": "bst", "ops": []}}, "tree_a"),
    ({"algorithm": "bst_mirror", "mode": "bad_mode",
      "tree_a": {"tree_type": "bst", "ops": []},
      "tree_b": {"tree_type": "bst", "ops": []}}, "mode"),
    ({"algorithm": "bst_mirror",
      "tree_a": {"tree_type": "binary"},
      "tree_b": {"tree_type": "bst", "ops": []}}, "tree_a"),
    ({"algorithm": "bst_mirror",
      "tree_a": {"tree_type": "bst", "values": [10]},
      "tree_b": {"tree_type": "bst", "ops": []}}, "tree_a.values"),
])
def test_api_mirror_bad_payload(client, payload, expected_field):
    res = client.post('/tree', json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert "error" in data
    assert "field" in data
    assert data["field"] == expected_field

# --- Static shell routes (Phase B1) ---

def test_index_route_serves_hub(client):
    res = client.get('/')
    assert res.status_code == 200
    assert b'id="algo-hub"' in res.data


def test_sorting_route_serves_sorting_page(client):
    res = client.get('/sorting.html')
    assert res.status_code == 200
    assert b'Sorting Duel' in res.data


def test_missing_static_file_returns_json_404(client):
    res = client.get('/nonexistent-file.html')
    assert res.status_code == 404
    data = res.get_json()
    assert data is not None
    assert data.get('error')
    assert data.get('field') == 'request'


# --- Static quiz assets (Phase B3) ---

@pytest.mark.parametrize("path,expected_type", [
    ("/js/shell/progress.js", "javascript"),
    ("/js/shell/glossaryData.js", "javascript"),
    ("/js/shell/glossaryTooltip.js", "javascript"),
    ("/js/primitives/QuizEngine.js", "javascript"),
    ("/js/quizzes/index.js", "javascript"),
    ("/js/quizzes/bstQuiz.js", "javascript"),
    ("/css/quiz.css", "text/css"),
    ("/css/glossary.css", "text/css"),
])
def test_static_quiz_assets(client, path, expected_type):
    res = client.get(path)
    assert res.status_code == 200
    assert expected_type in res.content_type
    assert len(res.data) > 0


# --- Phase D: Unit 3 pages and trace routes ---------------------------------

@pytest.mark.parametrize("path,marker", [
    ("/trie.html", b"Algorithm Laboratory: Tries"),
    ("/hashing.html", b"Algorithm Laboratory: Hashing"),
    ("/merkle.html", b"Algorithm Laboratory: Merkle Trees"),
])
def test_phase_d_static_routes(client, path, marker):
    res = client.get(path)
    assert res.status_code == 200
    assert marker in res.data
    assert b'data-current-id="' in res.data


@pytest.mark.parametrize("route", ["/trie", "/hash", "/merkle"])
def test_phase_d_get_returns_405_json(client, route):
    res = client.get(route)
    assert res.status_code == 405
    data = res.get_json()
    assert data is not None
    assert data["field"] == "request"
    assert "method is not allowed" in data["error"].lower()


@pytest.mark.parametrize("route,payload,expected_field", [
    ("/trie", {"algorithm": "trie_insert", "ops": [{"op": "insert", "word": ""}]}, "ops[0].word"),
    ("/hash", {"algorithm": "hash_insert", "table_size": 3}, "table_size"),
    ("/merkle", {"algorithm": "merkle_build", "leaves": []}, "leaves"),
])
def test_phase_d_bad_payload_returns_400_json(client, route, payload, expected_field):
    res = client.post(route, json=payload)
    assert res.status_code == 400
    data = res.get_json()
    assert data is not None
    assert "error" in data and "field" in data
    assert data["field"] == expected_field


def test_phase_d_trie_route_round_trip(client):
    res = client.post('/trie', json={
        "algorithm": "trie_insert",
        "ops": [],
        "word": "car"
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["steps"]
    assert data["final_tree"]["nodes"]


def test_phase_d_hash_route_round_trip(client):
    res = client.post('/hash', json={
        "algorithm": "hash_insert",
        "hash_fn": "sum_mod",
        "table_size": 7,
        "probing": "linear",
        "ops": [],
        "action": {"key": "ab"}
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["steps"]
    assert data["final_state"]["chaining"]["size"] == 7
    assert data["final_state"]["open"]["size"] == 7


def test_phase_d_merkle_route_round_trip(client):
    res = client.post('/merkle', json={
        "algorithm": "merkle_build",
        "leaves": ["a", "b", "c", "d"]
    })
    assert res.status_code == 200
    data = res.get_json()
    assert data["steps"]
    assert data["final_tree"]["root_id"] is not None
    assert data["metrics"]["nodes"] == 7


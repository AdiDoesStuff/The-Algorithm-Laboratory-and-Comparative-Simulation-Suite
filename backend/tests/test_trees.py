import random
import pytest
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import trees
from trees import (
    Node,
    _replay_ops,
    _insert_node,
    _delete_node_relink,
    normalize_ops,
    bst_insert_steps,
    bst_delete_steps,
    bst_traversal_steps,
    bst_classify,
    bst_height_depth,
    array_to_binary_tree_steps,
    _parse_binary_array,
    bst_mirror_steps,
    _preorder_with_nulls,
    _mirror_preorder_with_nulls,
    _build_tree_from_spec,
)
from tracing import DEFAULT_ROLES


# --- 1. Delete Cases Tests ---

def test_delete_leaf_left_and_right():
    ops = [
        {"op": "insert", "value": 20},
        {"op": "insert", "value": 10},
        {"op": "insert", "value": 30}
    ]
    # Delete left leaf (10)
    res_left = bst_delete_steps(ops, 10)
    nodes = {n['id']: n for n in res_left['final_tree']['nodes']}
    assert 1 not in nodes
    assert 0 in nodes and 2 in nodes
    assert nodes[0]['label'] == '20'
    assert nodes[2]['label'] == '30'

    # Check delete_done step and first compare step
    assert res_left['steps'][0]['type'] == 'compare'
    assert res_left['steps'][0]['comparing'] == [0]
    assert res_left['steps'][-1]['type'] == 'delete_done'
    assert 'delete_done' in DEFAULT_ROLES

    # Delete right leaf (30)
    res_right = bst_delete_steps(ops, 30)
    nodes_r = {n['id']: n for n in res_right['final_tree']['nodes']}
    assert 2 not in nodes_r
    assert 0 in nodes_r and 1 in nodes_r
    assert res_right['steps'][-1]['type'] == 'delete_done'


def test_delete_leaf_root_only():
    ops = [{"op": "insert", "value": 42}]
    res = bst_delete_steps(ops, 42)
    assert res['final_tree']['nodes'] == []
    assert res['final_tree']['root_id'] is None
    assert res['steps'][0]['type'] == 'compare'
    assert res['steps'][0]['comparing'] == [0]  # Root is compared first
    assert res['steps'][-1]['type'] == 'delete_done'


def test_delete_single_child_left_and_right():
    # Tree with left-only child: 20 -> 10
    ops_left = [
        {"op": "insert", "value": 20},
        {"op": "insert", "value": 10}
    ]
    res = bst_delete_steps(ops_left, 20)
    assert res['final_tree']['root_id'] == 1
    assert len(res['final_tree']['nodes']) == 1
    assert res['final_tree']['nodes'][0]['label'] == '10'
    assert res['steps'][-1]['type'] == 'delete_done'

    # Tree with right-only child: 20 -> 30
    ops_right = [
        {"op": "insert", "value": 20},
        {"op": "insert", "value": 30}
    ]
    res_r = bst_delete_steps(ops_right, 20)
    assert res_r['final_tree']['root_id'] == 1
    assert len(res_r['final_tree']['nodes']) == 1
    assert res_r['final_tree']['nodes'][0]['label'] == '30'
    assert res_r['steps'][-1]['type'] == 'delete_done'


def test_delete_two_children_immediate_successor_relinking():
    # Tree:
    #       50 (id 0)
    #      /  \
    # 20 (id 1) 70 (id 2)
    #             \
    #             80 (id 3)
    ops = [
        {"op": "insert", "value": 50},
        {"op": "insert", "value": 20},
        {"op": "insert", "value": 70},
        {"op": "insert", "value": 80}
    ]
    res = bst_delete_steps(ops, 50)
    final = res['final_tree']
    assert final['root_id'] == 2  # Node 70 (id 2) is the new root, preserving its id!

    nodes = {n['id']: n for n in final['nodes']}
    assert 0 not in nodes  # Node 50 (id 0) unlinked
    assert nodes[2]['label'] == '70'
    assert nodes[1]['label'] == '20'
    assert nodes[1]['parent_id'] == 2
    assert nodes[3]['label'] == '80'
    assert nodes[3]['parent_id'] == 2

    # Verify first compare step puts root in comparing
    assert res['steps'][0]['type'] == 'compare'
    assert res['steps'][0]['comparing'] == [0]
    # Verify final step type is delete_done
    assert res['steps'][-1]['type'] == 'delete_done'
    assert res['steps'][-1]['highlighted'] == [2]


def test_delete_two_children_deep_successor_relinking():
    ops = [
        {"op": "insert", "value": 50},
        {"op": "insert", "value": 20},
        {"op": "insert", "value": 80},
        {"op": "insert", "value": 60},
        {"op": "insert", "value": 90},
        {"op": "insert", "value": 65}
    ]
    res = bst_delete_steps(ops, 50)
    final = res['final_tree']

    assert final['root_id'] == 3  # Node 60 (id 3) relinked as root!
    nodes = {n['id']: n for n in final['nodes']}
    assert 0 not in nodes
    assert nodes[3]['label'] == '60'
    assert nodes[1]['label'] == '20'
    assert nodes[1]['parent_id'] == 3
    assert nodes[2]['label'] == '80'
    assert nodes[2]['parent_id'] == 3
    assert nodes[5]['label'] == '65'
    assert nodes[5]['parent_id'] == 2
    assert nodes[4]['label'] == '90'
    assert nodes[4]['parent_id'] == 2
    assert res['steps'][-1]['type'] == 'delete_done'


def test_delete_absent_value_raises_validation_error():
    ops = [{"op": "insert", "value": 10}, {"op": "insert", "value": 5}]
    with pytest.raises(trees.ValidationError) as exc_info:
        bst_delete_steps(ops, 999)
    assert exc_info.value.field == "delete_value"
    assert "not found in tree" in str(exc_info.value)

    with pytest.raises(trees.ValidationError) as exc_info2:
        bst_delete_steps([], 10)
    assert exc_info2.value.field == "delete_value"


# --- 2. Traversals Tests ---

def test_bst_traversals():
    ops = [
        {"op": "insert", "value": 50},
        {"op": "insert", "value": 30},
        {"op": "insert", "value": 70},
        {"op": "insert", "value": 20},
        {"op": "insert", "value": 40}
    ]

    # Inorder: 20, 30, 40, 50, 70
    res_in = bst_traversal_steps(ops, 'inorder', 'bst')
    inorder_vals = [int(s['annotation'].split('node ')[1].split(' ')[0]) for s in res_in['steps']]
    assert inorder_vals == [20, 30, 40, 50, 70]

    # Preorder: 50, 30, 20, 40, 70
    res_pre = bst_traversal_steps(ops, 'preorder', 'bst')
    pre_vals = [int(s['annotation'].split('node ')[1].split(' ')[0]) for s in res_pre['steps']]
    assert pre_vals == [50, 30, 20, 40, 70]

    # Postorder: 20, 40, 30, 70, 50
    res_post = bst_traversal_steps(ops, 'postorder', 'bst')
    post_vals = [int(s['annotation'].split('node ')[1].split(' ')[0]) for s in res_post['steps']]
    assert post_vals == [20, 40, 30, 70, 50]

    # Level order: 50, 30, 70, 20, 40
    res_level = bst_traversal_steps(ops, 'level', 'bst')
    level_vals = [int(s['annotation'].split('node ')[1].split(' ')[0]) for s in res_level['steps']]
    assert level_vals == [50, 30, 70, 20, 40]


def test_traversal_empty_tree():
    res = bst_traversal_steps([], 'inorder', 'bst')
    assert res['steps'] == []
    assert res['final_tree']['nodes'] == []


def test_traversal_binary_tree_with_array():
    # Array level order representation: [1, 2, 3, 4, 5]
    #       1
    #      / \
    #     2   3
    #    / \
    #   4   5
    arr = [1, 2, 3, 4, 5]
    res_in = bst_traversal_steps(arr, 'inorder', 'binary')
    inorder_vals = [int(s['annotation'].split('node ')[1].split(' ')[0]) for s in res_in['steps']]
    assert inorder_vals == [4, 2, 5, 1, 3]

    res_level = bst_traversal_steps(arr, 'level', 'binary')
    level_vals = [int(s['annotation'].split('node ')[1].split(' ')[0]) for s in res_level['steps']]
    assert level_vals == [1, 2, 3, 4, 5]


# --- 3. Classify Edge Cases Tests ---

def test_classify_empty_tree():
    res = bst_classify([], 'bst')
    assert res['height'] == -1
    assert res['node_count'] == 0
    assert res['is_full'] is True
    assert res['is_complete'] is True
    assert res['is_perfect'] is True
    assert res['is_balanced'] is True
    assert res['classification_label'] == "Empty Tree"


def test_classify_single_node():
    res = bst_classify([{"op": "insert", "value": 10}], 'bst')
    assert res['height'] == 0
    assert res['node_count'] == 1
    assert res['is_full'] is True
    assert res['is_complete'] is True
    assert res['is_perfect'] is True
    assert res['is_balanced'] is True


def test_classify_perfect_tree():
    ops = [
        {"op": "insert", "value": 40},
        {"op": "insert", "value": 20},
        {"op": "insert", "value": 60},
        {"op": "insert", "value": 10},
        {"op": "insert", "value": 30},
        {"op": "insert", "value": 50},
        {"op": "insert", "value": 70}
    ]
    res = bst_classify(ops, 'bst')
    assert res['height'] == 2
    assert res['node_count'] == 7
    assert res['is_full'] is True
    assert res['is_complete'] is True
    assert res['is_perfect'] is True
    assert res['is_balanced'] is True
    assert "Perfect" in res['classification_label']


def test_classify_skewed_unbalanced_tree():
    ops = [
        {"op": "insert", "value": 10},
        {"op": "insert", "value": 20},
        {"op": "insert", "value": 30},
        {"op": "insert", "value": 40}
    ]
    res = bst_classify(ops, 'bst')
    assert res['is_full'] is False
    assert res['is_complete'] is False
    assert res['is_perfect'] is False
    assert res['is_balanced'] is False


def test_classify_complete_not_full():
    ops = [
        {"op": "insert", "value": 10},
        {"op": "insert", "value": 5},
        {"op": "insert", "value": 15},
        {"op": "insert", "value": 2}
    ]
    res = bst_classify(ops, 'bst')
    assert res['is_complete'] is True
    assert res['is_full'] is False
    assert res['is_perfect'] is False
    assert res['is_balanced'] is True


# --- 4. Duplicates Tests ---

def test_duplicate_insert_in_ops_raises_validation_error():
    ops = [
        {"op": "insert", "value": 10},
        {"op": "insert", "value": 10}
    ]
    with pytest.raises(trees.ValidationError) as exc_info:
        _replay_ops(ops)
    assert exc_info.value.field == "new_value"


def test_duplicate_insert_via_new_value_raises_validation_error():
    ops = [{"op": "insert", "value": 25}]
    with pytest.raises(trees.ValidationError) as exc_info:
        bst_insert_steps(ops, 25)
    assert exc_info.value.field == "new_value"


def test_reinsert_after_delete_allowed():
    ops = [
        {"op": "insert", "value": 10},
        {"op": "delete", "value": 10},
        {"op": "insert", "value": 10}
    ]
    root = _replay_ops(ops)
    assert root is not None
    assert root.value == 10
    assert root.id == 2  # Inserting op was index 2


# --- 5. Hole Policy & Array-to-Tree Tests ---

def test_array_to_tree_hole_policy_orphaned_descendants():
    # Array: [10, null, 20, 30, 40, null, 50]
    # Index 0: 10 (root)
    # Index 1: null (left child of 0)
    # Index 2: 20 (right child of 0)
    # Index 3: 30 (left child of 1 -> orphaned!)
    # Index 4: 40 (right child of 1 -> orphaned!)
    # Index 5: null (left child of 2)
    # Index 6: 50 (right child of 2 -> valid!)
    arr = [10, None, 20, 30, 40, None, 50]
    res = array_to_binary_tree_steps(arr)

    assert "warnings" in res
    assert len(res['warnings']) == 2
    assert "array[3] = 30 dropped" in res['warnings'][0]
    assert "array[4] = 40 dropped" in res['warnings'][1]

    # Verify only nodes 10, 20, 50 were created
    labels = [n['label'] for n in res['final_tree']['nodes']]
    assert labels == ['10', '20', '50']


def test_binary_mode_classify_and_height_depth_with_array():
    arr = [10, 5, 20, 2, 7]
    cls_res = bst_classify(arr, 'binary')
    assert cls_res['node_count'] == 5
    assert "warnings" in cls_res

    hd_res = bst_height_depth(arr, target_val=7, tree_type='binary')
    assert hd_res['depth'] == 2
    assert hd_res['height'] == 0


# --- 6. Stability Test ---

def test_node_id_stability_across_random_unrelated_ops():
    """
    Verifies that the ID of any surviving node is strictly preserved and
    invariant to unrelated inserts, deletes, and successor relinkings.
    """
    random.seed(1337)
    ops = []
    # Map value -> original inserting op index
    expected_ids = {}
    available_values = list(range(1, 200))
    random.shuffle(available_values)

    for step_idx in range(50):
        # Insert or delete
        if len(expected_ids) > 4 and random.random() < 0.4:
            # Delete an existing node
            del_val = random.choice(list(expected_ids.keys()))
            ops.append({"op": "delete", "value": del_val})
            del expected_ids[del_val]
        else:
            # Insert a new node
            new_val = available_values.pop()
            op_idx = len(ops)
            ops.append({"op": "insert", "value": new_val})
            expected_ids[new_val] = op_idx

        # Replay ops up to this step
        root = _replay_ops(ops)
        serialized = trees.serialize_tree(root)

        # Verify stability: every surviving node must have its ID equal to its original op_idx
        found_nodes = {int(n['label']): n['id'] for n in serialized['nodes']}
        assert set(found_nodes.keys()) == set(expected_ids.keys())
        for val, original_id in expected_ids.items():
            assert found_nodes[val] == original_id, (
                f"Node {val} ID mutated from {original_id} to {found_nodes[val]} at step {step_idx}!"
            )


def test_stateless_replay_matches_step_by_step():
    values = [45, 20, 60, 15, 30, 55, 75]
    ops = []
    current_tree = None

    for v in values:
        step_res = bst_insert_steps(ops, v)
        current_tree = step_res['final_tree']
        ops.append({"op": "insert", "value": v})

    stateless_root = _replay_ops(ops)
    stateless_tree = trees.serialize_tree(stateless_root)
    assert current_tree == stateless_tree


def test_replay_property_tree_equals_final_step_snapshot():
    """
    Property test: for random op sequences, the tree after replaying ops
    strictly equals the final snapshot of the last step of the next action.
    """
    random.seed(2026)
    ops = []
    active_values = set()
    val_pool = list(range(1, 150))
    random.shuffle(val_pool)

    # Initial seed
    for _ in range(5):
        v = val_pool.pop()
        ops.append({"op": "insert", "value": v})
        active_values.add(v)

    for action_idx in range(30):
        if len(active_values) > 3 and random.random() < 0.4:
            # Next action is delete
            del_val = random.choice(list(active_values))
            step_res = bst_delete_steps(ops, del_val)
            ops.append({"op": "delete", "value": del_val})
            active_values.remove(del_val)
        else:
            # Next action is insert
            new_val = val_pool.pop()
            step_res = bst_insert_steps(ops, new_val)
            ops.append({"op": "insert", "value": new_val})
            active_values.add(new_val)

        # Replay ops up to and including this action
        replayed_root = _replay_ops(ops)
        replayed_tree = trees.serialize_tree(replayed_root)

        # Check equality with final_tree and the snapshot of the last step
        assert step_res["final_tree"] == replayed_tree
        assert step_res["steps"][-1]["snapshot"] == replayed_tree


def test_height_depth_target_id_exclusive_search():
    ops = [
        {"op": "insert", "value": 50},
        {"op": "insert", "value": 20},
        {"op": "insert", "value": 80}
    ]
    # Search by valid target_id
    res = bst_height_depth(ops, target_id=1)
    assert res['target_id'] == 1
    assert res['depth'] == 1

    # Absent target_id raises ValidationError with field="target_id", not falling back to target_value
    with pytest.raises(trees.ValidationError) as exc_info:
        bst_height_depth(ops, target_val=20, target_id=999)
    assert exc_info.value.field == "target_id"

    # Absent target_id falls back to target_value
    res_val = bst_height_depth(ops, target_val=80, target_id=None)
    assert res_val['target_id'] == 2

    # Absent target_value raises ValidationError with field="target_value"
    with pytest.raises(trees.ValidationError) as exc_info2:
        bst_height_depth(ops, target_val=999, target_id=None)
    assert exc_info2.value.field == "target_value"


# --- 7. Insertion Path Tests ---

def test_insert_path_grows_with_depth():
    """Each compare step's path has exactly one more id than the previous compare step."""
    ops = [
        {"op": "insert", "value": 50},
        {"op": "insert", "value": 30},
        {"op": "insert", "value": 70},
    ]
    res = bst_insert_steps(ops, 20)  # goes 50 → 30 → left of 30
    compare_steps = [s for s in res['steps'] if s['type'] == 'compare']
    insert_steps  = [s for s in res['steps'] if s['type'] == 'insert']

    # path grows by one at each compare step
    for i, s in enumerate(compare_steps):
        assert 'payload' in s
        assert 'path' in s['payload'], f"compare step {i} missing payload.path"
        assert len(s['payload']['path']) == i + 1, (
            f"step {i}: expected path len {i+1}, got {len(s['payload']['path'])}"
        )

    # Final insert step carries the full path
    assert 'payload' in insert_steps[-1]
    assert len(insert_steps[-1]['payload']['path']) == len(compare_steps)


def test_insert_path_is_ancestor_chain():
    """Each id in the path has the previous id as its parent in final_tree."""
    ops = [
        {"op": "insert", "value": 50},
        {"op": "insert", "value": 30},
        {"op": "insert", "value": 70},
        {"op": "insert", "value": 20},
    ]
    res = bst_insert_steps(ops, 10)  # path: 50(0) → 30(1) → 20(3) → insert 10
    insert_steps = [s for s in res['steps'] if s['type'] == 'insert']
    full_path = insert_steps[-1]['payload']['path']  # [0, 1, 3]

    nodes = {n['id']: n for n in res['final_tree']['nodes']}
    # Verify each path[j] has parent_id == path[j-1]
    for j in range(1, len(full_path)):
        child_id = full_path[j]
        expected_parent_id = full_path[j - 1]
        actual_parent_id = nodes[child_id]['parent_id']
        assert actual_parent_id == expected_parent_id, (
            f"path[{j}]={child_id} has parent_id={actual_parent_id}, expected {expected_parent_id}"
        )

    # The newly inserted node's parent must be the last element in the path
    new_node_id = 4  # 5th op, idx 4
    assert nodes[new_node_id]['parent_id'] == full_path[-1]


def test_insert_root_path_is_empty():
    """When tree is empty, root insertion has payload.path = []."""
    res = bst_insert_steps([], 42)
    assert res['steps'][0]['payload']['path'] == []


def test_delete_search_path_payload():
    """Delete compare steps in the search phase include payload.path."""
    ops = [
        {"op": "insert", "value": 50},
        {"op": "insert", "value": 30},
        {"op": "insert", "value": 70},
    ]
    res = bst_delete_steps(ops, 30)
    search_compares = [s for s in res['steps'] if s['type'] == 'compare']
    # All search compare steps must carry path
    for i, s in enumerate(search_compares):
        assert 'payload' in s
        assert 'path' in s['payload']
        assert len(s['payload']['path']) == i + 1


# --- 8. Mirror / Structural Comparison Tests ---

def _make_bst_spec(values):
    return {'tree_type': 'bst', 'ops': [{"op": "insert", "value": v} for v in values]}


def test_mirror_two_empty_trees():
    """Two empty trees are a mirror."""
    res = bst_mirror_steps({'tree_type': 'bst', 'ops': []}, {'tree_type': 'bst', 'ops': []})
    assert res['verdict']['is_match'] is True
    assert res['verdict']['first_mismatch'] is None


def test_mirror_one_empty_vs_non_empty():
    """One empty, one non-empty is never a mirror."""
    res = bst_mirror_steps({'tree_type': 'bst', 'ops': []}, _make_bst_spec([10]))
    assert res['verdict']['is_match'] is False
    assert res['verdict']['first_mismatch'] is not None


def test_mirror_perfect_tree_is_mirror_of_itself():
    """A symmetric perfect tree is its own mirror."""
    #       4
    #      / \
    #     2   6
    #    / \ / \
    #   1  3 5  7
    spec_a = _make_bst_spec([4, 2, 6, 1, 3, 5, 7])
    # Mirror tree: root 4, left 6 (7, 5), right 2 (3, 1)
    # Level-order array: [4, 6, 2, 7, 5, 3, 1]
    spec_b = {'tree_type': 'binary', 'array': [4, 6, 2, 7, 5, 3, 1]}
    res = bst_mirror_steps(spec_a, spec_b)
    assert res['verdict']['is_match'] is True


def test_mirror_one_child_mirror():
    """Left-only tree mirrors right-only tree."""
    # A: 10 -> left 5   B: 10 -> right 5
    spec_a = {'tree_type': 'bst', 'ops': [{"op": "insert", "value": 10}, {"op": "insert", "value": 5}]}
    spec_b = {'tree_type': 'binary', 'array': [10, None, 5]}
    res = bst_mirror_steps(spec_a, spec_b)
    assert res['verdict']['is_match'] is True


def test_mirror_not_mirror_due_to_label():
    """Same shape, different label — not a mirror."""
    # A: 10 / 5 / 20. Mirror shape has root 10, left 20, right 5.
    spec_a = _make_bst_spec([10, 5, 20])
    # Give B the mirror shape, but wrong label (99 instead of 5 on the right)
    spec_b = {'tree_type': 'binary', 'array': [10, 20, 99]}
    res = bst_mirror_steps(spec_a, spec_b)
    assert res['verdict']['is_match'] is False
    assert res['verdict']['first_mismatch'] is not None
    assert 'mismatch' in res['verdict']['first_mismatch']['reason'].lower()


def test_mirror_not_mirror_due_to_shape():
    """Different shape — not a mirror."""
    spec_a = _make_bst_spec([10, 5, 20])      # balanced
    spec_b = _make_bst_spec([10, 20])          # right-only, no left
    res = bst_mirror_steps(spec_a, spec_b)
    assert res['verdict']['is_match'] is False


def test_identical_same_trees():
    """identical mode: same tree is identical to itself."""
    spec = _make_bst_spec([10, 5, 20])
    res = bst_mirror_steps(spec, _make_bst_spec([10, 5, 20]), mode='identical')
    assert res['verdict']['is_match'] is True


def test_identical_different_trees():
    """identical mode: a mirror pair is NOT identical."""
    spec_a = _make_bst_spec([10, 5, 20])
    # Tree B is a mirror of A (left=20, right=5), so it is not identical to A
    spec_b = {'tree_type': 'binary', 'array': [10, 20, 5]}
    res = bst_mirror_steps(spec_a, spec_b, mode='identical')
    # They are mirror-compatible but not identical (left/right swapped)
    assert res['verdict']['is_match'] is False


def test_mirror_brute_force_oracle():
    """
    Oracle: A mirrors B iff _preorder_with_nulls(A) == _mirror_preorder_with_nulls(B).
    Test on random small op sequences.
    """
    random.seed(42)
    values_pool = list(range(1, 30))

    for _ in range(40):
        # Build two random small BSTs (3–8 nodes each)
        k = random.randint(3, 8)
        vals_a = random.sample(values_pool, k)
        vals_b = random.sample(values_pool, k)
        spec_a = _make_bst_spec(vals_a)
        spec_b = _make_bst_spec(vals_b)

        root_a, _ = _build_tree_from_spec(spec_a)
        root_b, _ = _build_tree_from_spec(spec_b)

        # Oracle ground truth
        oracle_match = (_preorder_with_nulls(root_a) == _mirror_preorder_with_nulls(root_b))

        # Function under test
        res = bst_mirror_steps(spec_a, spec_b)
        assert res['verdict']['is_match'] == oracle_match, (
            f"Oracle mismatch for A={vals_a} B={vals_b}: "
            f"oracle={oracle_match}, got={res['verdict']['is_match']}"
        )


def test_mirror_step_types_in_default_roles():
    """All mirror step types must be registered in DEFAULT_ROLES."""
    for t in ('mirror_compare', 'struct_compare', 'mirror_match', 'mirror_mismatch'):
        assert t in DEFAULT_ROLES, f"Step type '{t}' missing from DEFAULT_ROLES"


def test_mirror_steps_have_dual_snapshots():
    """Every mirror step must have snapshot_a and snapshot_b (not snapshot)."""
    spec_a = _make_bst_spec([10, 5, 20])
    spec_b = {'tree_type': 'bst', 'ops': [
        {"op": "insert", "value": 10},
        {"op": "insert", "value": 20},
        {"op": "insert", "value": 5},
    ]}
    res = bst_mirror_steps(spec_a, spec_b)
    for step in res['steps']:
        assert 'snapshot_a' in step, f"step type={step['type']} missing snapshot_a"
        assert 'snapshot_b' in step, f"step type={step['type']} missing snapshot_b"
        assert 'snapshot' not in step, f"step type={step['type']} should not have 'snapshot'"

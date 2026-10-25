"""
Tests for the AVL trace generator (POST /avl).

The AVL tree is checked against an independent plain-BST oracle plus a
snapshot-local re-derivation of heights and balance factors. Per plan D9 the
balance invariant is relaxed while an operation is in flight: a node may be
unbalanced only if it is the operation's current focus or one of that focus's
ancestors. Every operation's last step must have zero violations.
"""

import math
import random
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import app
import trees
from validation import ValidationError, validate_avl_payload


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


# --- independent oracle ----------------------------------------------------
# A plain recursive BST with no balancing. Only used to decide which values
# must be live and in what order; it never touches AVLNode.

def oracle_insert(root, value):
    if root is None:
        return (value, None, None)
    node, left, right = root
    if value < node:
        return (node, oracle_insert(left, value), right)
    if value > node:
        return (node, left, oracle_insert(right, value))
    raise ValueError(f'duplicate value {value}')


def oracle_delete(root, value):
    if root is None:
        raise ValueError(f'missing value {value}')
    node, left, right = root
    if value < node:
        return (node, oracle_delete(left, value), right)
    if value > node:
        return (node, left, oracle_delete(right, value))
    if left is None:
        return right
    if right is None:
        return left
    # In-order successor: leftmost node of the right subtree.
    succ = right
    while succ[1] is not None:
        succ = succ[1]
    return (succ[0], left, oracle_delete(right, succ[0]))


def oracle_inorder(root):
    if root is None:
        return []
    node, left, right = root
    return oracle_inorder(left) + [node] + oracle_inorder(right)


# --- snapshot helpers ------------------------------------------------------

def index_snapshot(snapshot):
    """Returns (by_id, children, parent_of, root_id) from a tree snapshot."""
    nodes = snapshot['nodes']
    by_id = {}
    children = {}
    parent_of = {}
    for node in nodes:
        assert node['id'] not in by_id, 'duplicate node id in snapshot'
        by_id[node['id']] = node
        children[node['id']] = {'left': None, 'right': None}
        parent_of[node['id']] = node['parent_id']

    root_id = snapshot['root_id']
    roots = [nid for nid, parent in parent_of.items() if parent is None]
    if root_id is None:
        assert roots == [], 'empty tree must not report a root'
        assert nodes == []
    else:
        assert roots == [root_id], f'expected one root {root_id}, links give {roots}'

    for node in nodes:
        parent = node['parent_id']
        if parent is None:
            continue
        assert parent in by_id, f"node {node['id']} has unknown parent {parent}"
        side = node['side']
        assert side in ('left', 'right'), f"node {node['id']} has side {side!r}"
        assert children[parent][side] is None, (
            f"two children claim {parent}'s {side} slot"
        )
        children[parent][side] = node['id']
    return by_id, children, parent_of, root_id


def heights(children, root_id):
    memo = {None: -1}

    def visit(node_id):
        if node_id is None:
            return -1
        if node_id in memo:
            return memo[node_id]
        value = 1 + max(
            visit(children[node_id]['left']),
            visit(children[node_id]['right'])
        )
        memo[node_id] = value
        return value

    visit(root_id)
    return memo


def inorder(by_id, children, root_id):
    out = []

    def walk(node_id):
        if node_id is None:
            return
        walk(children[node_id]['left'])
        out.append(int(by_id[node_id]['label']))
        walk(children[node_id]['right'])

    walk(root_id)
    return out


def balance_violations(by_id, children, root_id):
    memo = heights(children, root_id)
    bad = []
    for node_id in by_id:
        left = children[node_id]['left']
        right = children[node_id]['right']
        if abs(memo[left] - memo[right]) > 1:
            bad.append(node_id)
    return bad


def declared_bf_matches(by_id, children, root_id):
    """Every sublabel must equal the balance factor recomputed from links."""
    memo = heights(children, root_id)
    for node_id, node in by_id.items():
        left = children[node_id]['left']
        right = children[node_id]['right']
        expected = f'bf:{memo[left] - memo[right]:+d}'
        assert node['sublabel'] == expected, (
            f"node {node_id} sublabel {node['sublabel']!r} != {expected!r}"
        )


def reachable_count(children, root_id):
    if root_id is None:
        return 0
    return (1 + reachable_count(children, children[root_id]['left'])
            + reachable_count(children, children[root_id]['right']))


def ancestors(node_id, parent_of):
    out = []
    seen = set()
    current = node_id
    while current is not None:
        assert current not in seen, 'cycle in parent links'
        seen.add(current)
        out.append(current)
        current = parent_of.get(current)
    return out


def focus_ids(step):
    payload = step.get('payload') or {}
    ids = []
    for key in ('node_id', 'new_root', 'successor', 'replacement',
                'unbalanced', 'pivot'):
        value = payload.get(key)
        if isinstance(value, int) and not isinstance(value, bool):
            ids.append(value)
    path = payload.get('path')
    if isinstance(path, list):
        ids.extend(i for i in path if isinstance(i, int))
    if not ids:
        for role in ('new_node', 'highlighted', 'rotating'):
            ids.extend(step.get(role) or [])
    return ids


def check_snapshot(snapshot, where='snapshot'):
    """Structural, ordering and sublabel checks that hold in every snapshot."""
    by_id, children, parent_of, root_id = index_snapshot(snapshot)
    assert reachable_count(children, root_id) == len(by_id), (
        f'{where}: unreachable nodes'
    )
    values = inorder(by_id, children, root_id)
    assert values == sorted(values), f'{where}: in-order walk is not sorted'
    assert len(values) == len(set(values)), f'{where}: duplicate value in tree'
    declared_bf_matches(by_id, children, root_id)
    return by_id, children, parent_of, root_id


# --- trace checker ---------------------------------------------------------

def check_trace(result, step_cap=None):
    """Validates one avl_op_steps response end to end."""
    steps = result['steps']
    algorithm = result['metadata']['algorithm']
    metrics = result['metrics']
    assert metrics['steps'] == len(steps)

    if not steps:
        # Only a replay is allowed to be silent.
        assert algorithm == 'avl_replay'
        assert metrics['rotations'] == 0
        by_id, children, _, root_id = check_snapshot(
            result['final_tree'], 'final_tree'
        )
        assert balance_violations(by_id, children, root_id) == []
        return []

    if step_cap is not None:
        assert len(steps) <= step_cap

    seen_labels = {}
    for step in steps:
        assert step['kind'] == 'tree'
        assert isinstance(step['annotation'], str) and step['annotation']
        by_id, children, parent_of, root_id = check_snapshot(
            step['snapshot'], step['type']
        )

        # A node id keeps its value for the whole call.
        for node_id, node in by_id.items():
            if node_id in seen_labels:
                assert seen_labels[node_id] == node['label'], (
                    f'id {node_id} changed value '
                    f'{seen_labels[node_id]!r} -> {node["label"]!r}'
                )
            else:
                seen_labels[node_id] = node['label']

        # Relaxed balance: violations may only sit on the focus path.
        violations = balance_violations(by_id, children, root_id)
        allowed = set()
        for node_id in focus_ids(step):
            if node_id in parent_of:
                allowed.update(ancestors(node_id, parent_of))
        if step['type'] == 'delete_two_children':
            # The removed node is no longer linkable; its path still names the
            # ancestors that are allowed to be temporarily unbalanced.
            allowed.update(
                i for i in (step.get('payload') or {}).get('path', [])
                if i in parent_of
            )
        assert set(violations) <= allowed, (
            f"step {step['type']} unbalanced off-path nodes "
            f"{sorted(set(violations) - allowed)}"
        )

        if step['type'] in ('insert_done', 'delete_done'):
            assert violations == [], (
                f'operation ended with unbalanced nodes {violations}'
            )

    last = steps[-1]
    assert last['type'] in ('insert_done', 'delete_done')
    assert result['final_tree'] == last['snapshot'], (
        'final_tree must equal the last step snapshot'
    )
    by_id, children, _, root_id = index_snapshot(result['final_tree'])
    assert balance_violations(by_id, children, root_id) == []

    rotation_steps = [s for s in steps if s['type'].startswith('rotate_')]
    assert metrics['rotations'] == len(rotation_steps)
    assert result['metrics']['height'] == heights(children, root_id).get(root_id, -1)
    assert algorithm in ('avl_insert', 'avl_delete')
    return steps


def assert_live_values(result, expected):
    by_id, children, _, root_id = index_snapshot(result['final_tree'])
    assert inorder(by_id, children, root_id) == sorted(expected)
    assert len(by_id) == len(expected)


def assert_avl_height_bound(result):
    count = len(result['final_tree']['nodes'])
    if count == 0:
        assert result['metrics']['height'] == -1
        return
    bound = 1.4405 * math.log2(count + 2) - 0.3277
    assert result['metrics']['height'] <= bound + 1e-9


# --- empty tree and replay -------------------------------------------------

def test_avl_empty_replay_returns_no_steps():
    result = trees.avl_op_steps('avl_replay', [], None)
    assert result['steps'] == []
    assert result['final_tree'] == {'nodes': [], 'root_id': None}
    assert result['metrics'] == {
        'comparisons': 0, 'rotations': 0, 'steps': 0, 'height': -1
    }
    check_trace(result)


def test_avl_insert_into_empty_tree():
    result = trees.avl_op_steps('avl_insert', [], 42)
    steps = check_trace(result)
    assert [s['type'] for s in steps] == ['insert', 'insert_done']
    assert steps[-1]['payload']['node_id'] == 0
    node = result['final_tree']['nodes'][0]
    assert (node['id'], node['label'], node['sublabel']) == (0, '42', 'bf:+0')
    assert node['parent_id'] is None and node['side'] is None
    assert_live_values(result, [42])


def test_avl_replay_of_inserts_and_deletes_matches_oracle():
    ops = [
        {'op': 'insert', 'value': 50},
        {'op': 'insert', 'value': 30},
        {'op': 'insert', 'value': 70},
        {'op': 'insert', 'value': 60},
        {'op': 'insert', 'value': 80},
        {'op': 'delete', 'value': 30},
        {'op': 'insert', 'value': 20},
        {'op': 'delete', 'value': 50},
    ]
    result = trees.avl_op_steps('avl_replay', ops, None)
    check_trace(result)
    assert result['steps'] == []
    assert_live_values(result, [70, 60, 80, 20])
    assert_avl_height_bound(result)

    again = trees.avl_op_steps('avl_replay', ops, None)
    assert again['final_tree'] == result['final_tree']


def test_avl_delete_last_node_empties_the_tree():
    result = trees.avl_op_steps(
        'avl_delete', [{'op': 'insert', 'value': 7}], 7
    )
    steps = check_trace(result)
    assert [s['type'] for s in steps] == ['delete_leaf', 'delete_done']
    assert result['final_tree'] == {'nodes': [], 'root_id': None}
    assert result['metrics']['height'] == -1


# --- the four rotation cases ----------------------------------------------

@pytest.mark.parametrize('pre,value,case,rotation_types,phases', [
    ([10, 20], 30, 'RR', ['rotate_RR'], [1]),
    ([30, 20], 10, 'LL', ['rotate_LL'], [1]),
    ([30, 10], 20, 'LR', ['rotate_LR', 'rotate_LR'], [1, 2]),
    ([10, 30], 20, 'RL', ['rotate_RL', 'rotate_RL'], [1, 2]),
])
def test_avl_minimal_rotation_cases(pre, value, case, rotation_types, phases):
    ops = [{'op': 'insert', 'value': v} for v in pre]
    result = trees.avl_op_steps('avl_insert', ops, value)
    steps = check_trace(result)

    types = [s['type'] for s in steps]
    unbalanced = steps[types.index('unbalanced')]
    assert unbalanced['payload']['case'] == case
    assert case.lower() in unbalanced['annotation'].lower()
    assert abs(unbalanced['payload']['balance_factor']) == 2

    rotate_steps = [s for s in steps if s['type'].startswith('rotate_')]
    assert [s['type'] for s in rotate_steps] == rotation_types
    assert [s['payload']['phase'] for s in rotate_steps] == phases
    assert all(s['payload']['case'] == case for s in rotate_steps)
    assert all(s['payload']['unbalanced'] == unbalanced['payload']['node_id']
               for s in rotate_steps)

    done_index = types.index('rotation_done')
    assert done_index > max(types.index(t) for t in rotation_types)
    assert types.index('unbalanced') < min(types.index(t) for t in rotation_types)

    # Identity survives: each value keeps the id from its inserting op.
    by_id, _, _, root_id = index_snapshot(result['final_tree'])
    id_by_value = {int(node['label']): node['id'] for node in by_id.values()}
    assert id_by_value == {v: i for i, v in enumerate(pre + [value])}
    assert root_id == id_by_value[20]
    assert result['metrics']['rotations'] == len(rotation_types)

    # The rotated subtree is fully balanced at rotation_done, even though
    # ancestors may still need attention after a delete.
    rotation_done = steps[done_index]
    subtree_root = rotation_done['payload']['new_root']
    sub_by_id, sub_children, _, _ = index_snapshot(rotation_done['snapshot'])
    assert balance_violations(sub_by_id, sub_children, subtree_root) == []


def test_avl_four_case_shapes_all_land_on_the_middle_value():
    for pre, value in [
        ([10, 20], 30), ([30, 20], 10), ([30, 10], 20), ([10, 30], 20)
    ]:
        result = trees.avl_op_steps(
            'avl_insert',
            [{'op': 'insert', 'value': v} for v in pre],
            value
        )
        by_id, children, _, root_id = index_snapshot(result['final_tree'])
        assert by_id[root_id]['label'] == '20'
        assert result['metrics']['height'] == 1
        assert {int(n['label']) for n in by_id.values()} == set(pre + [value])


# --- cascading insert path -------------------------------------------------

def test_avl_ascending_inserts_stay_balanced():
    values = [10, 20, 30, 40, 50, 25]
    ops = []
    live = []
    for expected_id, value in enumerate(values):
        result = trees.avl_op_steps('avl_insert', ops, value)
        check_trace(result)
        assert_live_values(result, live + [value])
        assert_avl_height_bound(result)
        id_by_value = {
            int(n['label']): n['id'] for n in result['final_tree']['nodes']
        }
        assert id_by_value[value] == expected_id
        assert result['steps'][-1]['payload']['node_id'] == expected_id
        ops.append({'op': 'insert', 'value': value})
        live.append(value)

    final = trees.avl_op_steps('avl_replay', ops, None)
    assert_live_values(final, values)
    assert final['metrics']['height'] == 2


# --- randomized comparison against the oracle ------------------------------

def test_avl_random_insert_sequences_match_oracle():
    rng = random.Random(20251025)
    for _ in range(25):
        values = rng.sample(range(-50, 51), rng.randint(1, 14))
        ops = []
        oracle = None
        for expected_id, value in enumerate(values):
            result = trees.avl_op_steps('avl_insert', ops, value)
            check_trace(result)
            oracle = oracle_insert(oracle, value)
            assert_live_values(result, oracle_inorder(oracle))
            assert_avl_height_bound(result)
            id_by_value = {
                int(n['label']): n['id'] for n in result['final_tree']['nodes']
            }
            assert id_by_value[value] == expected_id
            ops.append({'op': 'insert', 'value': value})


def test_avl_random_insert_delete_matches_oracle():
    rng = random.Random(777)
    for _ in range(15):
        pool = list(range(1, 41))
        rng.shuffle(pool)
        next_value = iter(pool)
        ops = []
        oracle = None
        live = []
        inserted_ids = {}

        for _step in range(30):
            can_insert = len(live) < 18
            do_insert = not live or (can_insert and rng.random() < 0.6)
            if do_insert:
                value = next(next_value)
                result = trees.avl_op_steps('avl_insert', ops, value)
                inserted_ids[value] = len(ops)
                ops.append({'op': 'insert', 'value': value})
                oracle = oracle_insert(oracle, value)
                live.append(value)
            else:
                value = rng.choice(live)
                result = trees.avl_op_steps('avl_delete', ops, value)
                ops.append({'op': 'delete', 'value': value})
                oracle = oracle_delete(oracle, value)
                live.remove(value)

            check_trace(result)
            assert_live_values(result, oracle_inorder(oracle))
            assert_avl_height_bound(result)
            by_id = {n['id']: n for n in result['final_tree']['nodes']}
            for v in live:
                assert by_id[inserted_ids[v]]['label'] == str(v), (
                    f'id {inserted_ids[v]} no longer holds {v}'
                )


# --- delete specifics ------------------------------------------------------

def test_avl_delete_leaf_single_and_two_children_keep_ids():
    values = [50, 30, 70, 20, 40, 60, 80, 10, 25, 35, 45, 55]
    ops = [{'op': 'insert', 'value': v} for v in values]
    expected = list(values)

    # 10 is a leaf, 60 has only the left child 55, 50 has two children.
    for value in (10, 60, 50):
        result = trees.avl_op_steps('avl_delete', ops, value)
        steps = check_trace(result)
        types = [s['type'] for s in steps]
        assert types[-1] == 'delete_done'
        assert any(t.startswith('delete_') for t in types)

        expected.remove(value)
        assert_live_values(result, expected)
        assert_avl_height_bound(result)
        by_id = {n['id']: n for n in result['final_tree']['nodes']}
        for other in expected:
            assert by_id[values.index(other)]['label'] == str(other)

        ops.append({'op': 'delete', 'value': value})


def test_avl_delete_then_reinsert_gets_a_new_id():
    ops = [{'op': 'insert', 'value': 10}, {'op': 'insert', 'value': 20},
           {'op': 'insert', 'value': 30}, {'op': 'delete', 'value': 20}]
    result = trees.avl_op_steps('avl_insert', ops, 20)
    check_trace(result)
    id_by_value = {
        int(n['label']): n['id'] for n in result['final_tree']['nodes']
    }
    assert id_by_value == {10: 0, 30: 2, 20: 4}


def test_avl_two_child_delete_triggers_a_rotation():
    # Deleting the root leaves the promoted successor left-heavy with bf +2.
    values = [40, 20, 60, 10, 30]
    ops = [{'op': 'insert', 'value': v} for v in values]
    result = trees.avl_op_steps('avl_delete', ops, 40)
    steps = check_trace(result)
    types = [s['type'] for s in steps]
    assert 'delete_two_children' in types, types
    assert any(t.startswith('rotate_') for t in types), types
    assert_live_values(result, [20, 60, 10, 30])
    assert result['final_tree']['nodes'][0]['id'] == 1  # 20 keeps its id
    assert_avl_height_bound(result)


def test_avl_delete_rebalances_ancestors_up_the_path():
    # Leaf delete that makes the root left-heavy; only one rotation is needed.
    values = [30, 20, 40, 10]
    ops = [{'op': 'insert', 'value': v} for v in values]
    result = trees.avl_op_steps('avl_delete', ops, 40)
    steps = check_trace(result)
    assert [s['type'] for s in steps].count('rotate_LL') == 1
    assert_live_values(result, [30, 20, 10])
    assert result['metrics']['height'] == 1


# --- caps and validation ---------------------------------------------------

def test_avl_step_cap_guard_raises_validation_error(monkeypatch):
    monkeypatch.setattr(trees.validation, 'MAX_AVL_STEPS', 3)
    with pytest.raises(ValidationError) as excinfo:
        trees.avl_op_steps(
            'avl_insert',
            [{'op': 'insert', 'value': 10}, {'op': 'insert', 'value': 20}],
            30
        )
    assert excinfo.value.field == 'ops'
    assert excinfo.value.status_code == 400
    assert '3' in excinfo.value.message


def test_avl_op_cap_rejects_65_ops(client):
    ops = [{'op': 'insert', 'value': v} for v in range(1, 66)]
    validated, error = validate_avl_payload({'algorithm': 'avl_replay', 'ops': ops})
    assert validated is None
    assert error is not None and error[1] == 'ops'

    res = client.post('/avl', json={'algorithm': 'avl_replay', 'ops': ops})
    assert res.status_code == 400
    assert res.get_json()['field'] == 'ops'


def test_avl_max_size_log_is_accepted(client):
    ops = [{'op': 'insert', 'value': v} for v in range(1, 65)]
    res = client.post('/avl', json={'algorithm': 'avl_insert', 'ops': ops, 'value': 100})
    assert res.status_code == 200, res.get_data(as_text=True)
    body = res.get_json()
    assert body['steps'][-1]['type'] == 'insert_done'
    assert len(body['final_tree']['nodes']) == 65


@pytest.mark.parametrize('payload,field', [
    ({'ops': []}, 'algorithm'),
    ({'algorithm': 'avl_rotate'}, 'algorithm'),
    ({'algorithm': 'avl_insert', 'ops': 'nope', 'value': 1}, 'ops'),
    ({'algorithm': 'avl_insert', 'ops': [None], 'value': 1}, 'ops'),
    ({'algorithm': 'avl_insert', 'ops': [{'op': 'remove', 'value': 1}], 'value': 1}, 'ops'),
    ({'algorithm': 'avl_insert', 'ops': [{'op': 'insert', 'value': True}], 'value': 1}, 'ops'),
    ({'algorithm': 'avl_insert', 'ops': [{'op': 'insert', 'value': '1'}], 'value': 1}, 'ops'),
    ({'algorithm': 'avl_insert', 'ops': [{'op': 'insert', 'value': 5},
                                         {'op': 'insert', 'value': 5}],
      'value': 1}, 'ops'),
    ({'algorithm': 'avl_insert', 'ops': [{'op': 'delete', 'value': 5}], 'value': 1}, 'ops'),
    ({'algorithm': 'avl_insert', 'ops': []}, 'value'),
    ({'algorithm': 'avl_insert', 'ops': [{'op': 'insert', 'value': 5}], 'value': 5}, 'value'),
    ({'algorithm': 'avl_delete', 'ops': [], 'value': 5}, 'value'),
    ({'algorithm': 'avl_insert', 'ops': [], 'value': 1.5}, 'value'),
    ({'algorithm': 'avl_insert', 'ops': [], 'value': False}, 'value'),
])
def test_avl_invalid_payloads_never_500(client, payload, field):
    res = client.post('/avl', json=payload)
    assert res.status_code == 400, res.get_data(as_text=True)
    body = res.get_json()
    assert body['field'] == field
    assert isinstance(body['error'], str) and body['error']


def test_avl_non_object_body_is_a_400(client):
    res = client.post('/avl', json=[1, 2, 3])
    assert res.status_code == 400
    assert res.get_json()['field'] == 'body'


def test_avl_get_returns_405_json(client):
    res = client.get('/avl')
    assert res.status_code == 405
    body = res.get_json()
    assert body['field'] == 'request'
    assert body['error']


# --- HTTP happy paths ------------------------------------------------------

def test_api_avl_insert_and_delete(client):
    res = client.post('/avl', json={
        'algorithm': 'avl_insert',
        'ops': [{'op': 'insert', 'value': 10}, {'op': 'insert', 'value': 20}],
        'value': 30
    })
    assert res.status_code == 200
    body = res.get_json()
    assert body['steps'][-1]['type'] == 'insert_done'
    assert body['final_tree']['root_id'] == 1
    assert body['metrics']['rotations'] == 1

    res = client.post('/avl', json={
        'algorithm': 'avl_delete',
        'ops': [{'op': 'insert', 'value': v} for v in (10, 20, 30)],
        'value': 20
    })
    assert res.status_code == 200
    body = res.get_json()
    assert body['steps'][-1]['type'] == 'delete_done'
    assert sorted(n['label'] for n in body['final_tree']['nodes']) == ['10', '30']

    res = client.post('/avl', json={
        'algorithm': 'avl_replay',
        'ops': [{'op': 'insert', 'value': 5}]
    })
    assert res.status_code == 200
    body = res.get_json()
    assert body['steps'] == []
    assert body['final_tree']['root_id'] == 0

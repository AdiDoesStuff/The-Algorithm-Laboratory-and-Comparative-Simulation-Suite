"""
Tests for the heap and heapsort trace generators (POST /heap).

Invariants are checked per step, but relaxed while an operation is in progress
(plan D9): the only edge allowed to violate heap order is the one touching the
step's payload.focus_index. Every operation's final step must have zero
violations.
"""

import heapq
import random
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import app
import trees


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


# --- helpers ---------------------------------------------------------------

def values_of(snapshot):
    return [cell['value'] for cell in snapshot['array']['cells']]


def heap_values(snapshot):
    return values_of(snapshot)[:snapshot['array']['heap_size']]


def better(heap_type, a, b):
    return a < b if heap_type == 'min' else a > b


def invariant_violations(snapshot):
    """Returns [(parent_index, child_index), ...] for heap-order violations."""
    cells = snapshot['array']['cells']
    size = snapshot['array']['heap_size']
    heap_type = snapshot['array']['heap_type']
    bad = []
    for parent in range(size):
        for child in (2 * parent + 1, 2 * parent + 2):
            if child < size and better(heap_type, cells[child]['value'], cells[parent]['value']):
                bad.append((parent, child))
    return bad


def allowed_focus_edges(step):
    """Indices whose edges this step is allowed to leave temporarily violated."""
    payload = step.get('payload') or {}
    indices = {
        payload.get('from_index'), payload.get('to_index'),
        payload.get('chosen_index'), payload.get('index'),
        payload.get('parent_index'), payload.get('left_index'), payload.get('right_index'),
        payload.get('child_index'), payload.get('focus_index'),
    }
    indices.discard(None)
    return indices


def assert_tree_matches_array(snapshot):
    array = snapshot['array']
    tree = snapshot['tree']
    cells = array['cells']
    size = array['heap_size']

    assert len(tree['nodes']) == size
    assert tree['root_id'] == (cells[0]['id'] if size else None)

    by_id = {}
    for node in tree['nodes']:
        assert node['id'] not in by_id, 'duplicate tree node id'
        by_id[node['id']] = node

    for index in range(size):
        cell = cells[index]
        node = by_id[cell['id']]
        assert node['label'] == str(cell['value'])
        assert node['sublabel'] == f'i={index}'
        if index == 0:
            assert node['parent_id'] is None
            assert node['side'] is None
        else:
            parent_index = (index - 1) // 2
            assert node['parent_id'] == cells[parent_index]['id']
            assert node['side'] == ('left' if index % 2 == 1 else 'right')

    ids = [cell['id'] for cell in cells]
    assert len(ids) == len(set(ids)), 'duplicate array cell id'


def check_steps(heap_type, steps):
    in_build = False
    for step in steps:
        assert step['kind'] == 'dual'
        assert step['snapshot']['array']['heap_type'] == heap_type
        assert_tree_matches_array(step['snapshot'])

        step_type = step['type']
        if step_type == 'build_start':
            in_build = True
            continue
        if step_type == 'build_done':
            in_build = False
            assert invariant_violations(step['snapshot']) == [], 'build must end valid'
            continue
        if in_build:
            continue

        violations = invariant_violations(step['snapshot'])
        if step_type in ('insert_done', 'extract_done', 'heapsort_done'):
            assert violations == [], f'{step_type} must end with a valid heap: {violations}'
        else:
            touched = allowed_focus_edges(step)
            if step_type in ('remove_last', 'mark_sorted'):
                touched.add(0)
            for parent, child in violations:
                assert parent in touched or child in touched, (
                    f'{step_type} left an unexplained violation at edge {parent}->{child}: {step}'
                )

        # Sorted tail is always fully ordered and fully separated from the heap.
        size = step['snapshot']['array']['heap_size']
        cells = step['snapshot']['array']['cells']
        tail = [cell['value'] for cell in cells[size:]]
        if tail:
            assert tail == sorted(tail, reverse=(heap_type == 'min')), 'sorted tail out of order'
            heap_vals = [cell['value'] for cell in cells[:size]]
            if heap_vals:
                if heap_type == 'max':
                    assert min(tail) >= max(heap_vals), 'sorted tail not above the heap'
                else:
                    assert max(tail) <= min(heap_vals), 'sorted tail not below the heap'


def replay_oracle(heap_type, ops):
    """Independent reference using heapq; returns the array after all ops."""
    heap = []
    for op in ops:
        if op['op'] == 'build':
            if heap_type == 'min':
                heap = list(op['values'])
                heapq.heapify(heap)
            else:
                heap = [-v for v in op['values']]
                heapq.heapify(heap)
        elif op['op'] == 'insert':
            heapq.heappush(heap, op['value'] if heap_type == 'min' else -op['value'])
        elif op['op'] == 'extract':
            heapq.heappop(heap)
    return [v if heap_type == 'min' else -v for v in heap]


# --- correctness ------------------------------------------------------------

def test_min_heap_insert_matches_heapq():
    ops = []
    for value in [5, 9, 2, 7, 1, 8, 3, 3]:
        result = trees.heap_op_steps('min', ops, {'op': 'insert', 'value': value})
        ops.append({'op': 'insert', 'value': value})
        expected = sorted(replay_oracle('min', ops))
        assert sorted(heap_values(result['final_state'])) == expected
        assert heap_values(result['final_state'])[0] == min(expected)
        check_steps('min', result['steps'])


def test_max_heap_insert_matches_oracle():
    ops = []
    for value in [5, 9, 2, 7, 1, 8, 3]:
        result = trees.heap_op_steps('max', ops, {'op': 'insert', 'value': value})
        ops.append({'op': 'insert', 'value': value})
        expected = sorted(replay_oracle('max', ops), reverse=True)
        assert sorted(heap_values(result['final_state']), reverse=True) == expected
        assert heap_values(result['final_state'])[0] == max(expected)
        check_steps('max', result['steps'])


def test_extract_sequence_is_sorted_order():
    """Repeated extracts replay correctly because each extract is appended to ops."""
    source = [4, 8, 1, 9, 2, 7]
    for heap_type in ('min', 'max'):
        ops = [{'op': 'insert', 'value': v} for v in source]
        extracted = []
        for _ in range(len(source)):
            result = trees.heap_op_steps(heap_type, ops, {'op': 'extract'})
            check_steps(heap_type, result['steps'])

            root_step = next(step for step in result['steps'] if step['type'] == 'extract_root')
            extracted.append(root_step['payload']['value'])

            ops.append({'op': 'extract'})
            remaining = sorted(
                replay_oracle(heap_type, ops),
                reverse=(heap_type == 'max')
            )
            assert sorted(heap_values(result['final_state']), reverse=(heap_type == 'max')) == remaining

        # Heapsort semantics: a max-heap extracts descending, a min-heap ascending.
        assert extracted == sorted(source, reverse=(heap_type == 'max'))


def test_build_produces_valid_heap_for_many_inputs():
    random.seed(7)
    for heap_type in ('min', 'max'):
        for size in (0, 1, 2, 3, 5, 10, 31):
            values = [random.randint(-20, 20) for _ in range(size)]
            result = trees.heap_op_steps(heap_type, [], {'op': 'build', 'values': values})
            # The starting snapshot keeps the requested order; the end state is a
            # permutation because build-heap reorders in place.
            start_step = result['steps'][0] if result['steps'] else None
            if start_step:
                assert values_of(start_step['snapshot']) == values
            assert sorted(values_of(result['final_state'])) == sorted(values)
            check_steps(heap_type, result['steps'])
            assert invariant_violations(result['final_state']) == []


def test_build_of_already_valid_heap_emits_no_swaps():
    values = [1, 3, 2, 7, 4, 5, 6]
    result = trees.heap_op_steps('min', [], {'op': 'build', 'values': values})
    assert not any(step['type'] == 'swap' for step in result['steps'])


def test_duplicates_never_swap_with_equal_values():
    result = trees.heap_op_steps('min', [], {'op': 'build', 'values': [4, 4, 4, 4]})
    assert not any(step['type'] == 'swap' for step in result['steps'])
    check_steps('min', result['steps'])


# --- heapsort ---------------------------------------------------------------

def test_heapsort_orders():
    arrays = [[], [1], [2, 1], [1, 2, 3, 4, 5], [5, 4, 3, 2, 1], [3, 3, 3], [9, 1, 8, 2, 7, 3]]
    for heap_type in ('min', 'max'):
        for array in arrays:
            result = trees.heapsort_steps(heap_type, list(array))
            expected = sorted(array, reverse=(heap_type == 'min'))
            assert values_of(result['final_state']) == expected
            check_steps(heap_type, result['steps'])
            assert result['final_state']['array']['heap_size'] == 0


def test_heapsort_random_against_sorted():
    random.seed(11)
    for heap_type in ('min', 'max'):
        for _ in range(40):
            array = [random.randint(-30, 30) for _ in range(random.randint(0, 31))]
            result = trees.heapsort_steps(heap_type, array)
            assert values_of(result['final_state']) == sorted(array, reverse=(heap_type == 'min'))
            check_steps(heap_type, result['steps'])


# --- replay / identity ------------------------------------------------------

def test_replay_matches_reference_for_random_sequences():
    random.seed(13)
    for heap_type in ('min', 'max'):
        for _ in range(25):
            ops = []
            size = 0
            for _ in range(random.randint(1, 25)):
                choice = random.random()
                if size and choice < 0.35:
                    ops.append({'op': 'extract'})
                    size -= 1
                else:
                    ops.append({'op': 'insert', 'value': random.randint(-10, 10)})
                    size += 1
            result = trees.heap_op_steps(heap_type, ops, {'op': 'insert', 'value': 0})
            expected = sorted(replay_oracle(heap_type, ops + [{'op': 'insert', 'value': 0}]),
                              reverse=(heap_type == 'max'))
            assert sorted(heap_values(result['final_state']), reverse=(heap_type == 'max')) == expected
            check_steps(heap_type, result['steps'])
            assert result['final_state'] == result['steps'][-1]['snapshot']


def test_ids_are_creation_order_and_stable_across_swaps():
    ops = [{'op': 'insert', 'value': 5}, {'op': 'insert', 'value': 9}, {'op': 'insert', 'value': 2}]
    result = trees.heap_op_steps('min', ops, {'op': 'insert', 'value': 7})
    final = result['final_state']['array']['cells']
    ids = sorted(cell['id'] for cell in final)
    assert ids == [0, 1, 2, 3]
    values_by_id = {0: 5, 1: 9, 2: 2, 3: 7}
    for cell in final:
        assert cell['value'] == values_by_id[cell['id']]

    # Every swap moves whole cells; no id/value pair changes.
    for step in result['steps']:
        for cell in step['snapshot']['array']['cells']:
            assert values_by_id[cell['id']] == cell['value']


def test_build_assigns_ids_in_array_order_then_insert_continues():
    built = trees.heap_op_steps('max', [], {'op': 'build', 'values': [4, 1, 3]})
    ids = [cell['id'] for cell in built['final_state']['array']['cells']]
    assert ids == [0, 1, 2]
    ops = [{'op': 'build', 'values': [4, 1, 3]}]
    nxt = trees.heap_op_steps('max', ops, {'op': 'insert', 'value': 9})
    assert any(cell['id'] == 3 for cell in nxt['final_state']['array']['cells'])


# --- metrics ----------------------------------------------------------------

def test_metrics_match_step_counts():
    result = trees.heap_op_steps('min', [{'op': 'insert', 'value': 5}], {'op': 'insert', 'value': 1})
    types = [step['type'] for step in result['steps']]
    assert result['metrics']['comparisons'] == types.count('compare')
    assert result['metrics']['swaps'] == types.count('swap')
    assert result['metrics']['steps'] == len(types)


# --- API + validation -------------------------------------------------------

def test_api_heap_insert_and_heapsort(client):
    res = client.post('/heap', json={
        'algorithm': 'heap_op', 'heap_type': 'min', 'ops': [], 'action': {'op': 'insert', 'value': 4}
    })
    assert res.status_code == 200
    data = res.get_json()
    assert set(data) == {'steps', 'final_state', 'metrics', 'metadata'}
    assert data['metadata']['heap_type'] == 'min'

    res = client.post('/heap', json={
        'algorithm': 'heapsort', 'heap_type': 'max', 'array': [4, 1, 3, 2]
    })
    assert res.status_code == 200
    assert values_of(res.get_json()['final_state']) == [1, 2, 3, 4]


def test_api_heap_get_is_json_405(client):
    res = client.get('/heap')
    assert res.status_code == 405
    body = res.get_json()
    assert set(body) == {'error', 'field'}
    assert body['field'] == 'request'


@pytest.mark.parametrize('payload,field', [
    ({'algorithm': 'nope'}, 'algorithm'),
    ({'algorithm': 'heap_op', 'heap_type': 'median'}, 'heap_type'),
    ({'algorithm': 'heap_op', 'ops': 'x'}, 'ops'),
    ({'algorithm': 'heap_op', 'ops': [{'op': 'explode', 'value': 1}]}, 'ops'),
    ({'algorithm': 'heap_op', 'ops': [{'op': 'insert', 'value': True}]}, 'ops'),
    ({'algorithm': 'heap_op', 'ops': [{'op': 'insert', 'value': '5'}]}, 'ops'),
    ({'algorithm': 'heap_op', 'ops': [{'op': 'insert'}]}, 'ops'),
    ({'algorithm': 'heap_op', 'ops': [{'op': 'extract'}]}, 'ops'),
    ({'algorithm': 'heap_op', 'ops': [{'op': 'build', 'values': [1]}, {'op': 'build', 'values': [2]}]}, 'ops'),
    ({'algorithm': 'heap_op', 'action': {'op': 'extract'}}, 'action'),
    ({'algorithm': 'heap_op', 'action': {'op': 'insert', 'value': False}}, 'action'),
    ({'algorithm': 'heap_op', 'ops': [{'op': 'insert', 'value': 1}], 'action': {'op': 'build', 'values': [1, 2]}}, 'action'),
    ({'algorithm': 'heapsort', 'heap_type': 'max', 'array': [1, True]}, 'array'),
    ({'algorithm': 'heapsort', 'heap_type': 'max', 'array': [1] * 32}, 'array'),
    ({'algorithm': 'heapsort', 'heap_type': 'max'}, 'array'),
    ({'algorithm': 'heapsort', 'heap_type': 'max', 'array': [1], 'ops': []}, 'ops'),
    ({'algorithm': 'heap_op', 'action': {'op': 'build', 'values': list(range(32))}}, 'action'),
])
def test_api_heap_rejects_bad_payloads(client, payload, field):
    res = client.post('/heap', json=payload)
    assert res.status_code == 400, res.get_data(as_text=True)
    body = res.get_json()
    assert set(body) == {'error', 'field'}
    assert body['field'] == field
    assert 'Internal server error' not in body['error']


def test_api_heap_cap_is_31(client):
    ops = [{'op': 'insert', 'value': i} for i in range(31)]
    res = client.post('/heap', json={
        'algorithm': 'heap_op', 'heap_type': 'max', 'ops': ops,
        'action': {'op': 'insert', 'value': 99}
    })
    assert res.status_code == 400
    assert res.get_json()['field'] == 'action'


def test_api_heap_non_object_body(client):
    res = client.post('/heap', json=[1, 2, 3])
    assert res.status_code == 400
    assert res.get_json()['field'] == 'body'

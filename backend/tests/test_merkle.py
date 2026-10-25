"""
Tests for the Merkle trace generator (POST /merkle).

The oracle is a standalone SHA-256 reference implementation with the same
duplicate-last policy. Build order, node ids, duplicate nodes, pending hashes,
tamper path-only recomputation and validation errors are all checked.
"""

import hashlib
import math
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import app
import merkle
import validation


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


# --- independent reference ------------------------------------------------

def sha(data: str) -> str:
    return hashlib.sha256(data.encode('utf-8')).hexdigest()


def sha_bytes(left_hex: str, right_hex: str) -> str:
    return hashlib.sha256(bytes.fromhex(left_hex) + bytes.fromhex(right_hex)).hexdigest()


def reference_root(leaves):
    level = [sha(leaf) for leaf in leaves]
    while len(level) > 1:
        nxt = []
        for i in range(0, len(level), 2):
            right = level[i + 1] if i + 1 < len(level) else level[i]
            nxt.append(sha_bytes(level[i], right))
        level = nxt
    return level[0]


def reference_node_count(n):
    total = n
    current = n
    while current > 1:
        duplicate = 1 if current % 2 else 0
        parents = math.ceil(current / 2)
        total += duplicate + parents
        current = parents
    return total


def reference_levels(n):
    levels = 1
    current = n
    while current > 1:
        levels += 1
        current = math.ceil(current / 2)
    return levels


def build(client, leaves):
    res = client.post('/merkle', json={'algorithm': 'merkle_build', 'leaves': leaves})
    assert res.status_code == 200, res.get_json()
    return res.get_json()


def tamper(client, leaves, index, new_data):
    res = client.post('/merkle', json={
        'algorithm': 'merkle_tamper', 'leaves': leaves,
        'index': index, 'new_data': new_data})
    assert res.status_code == 200, res.get_json()
    return res.get_json()


def nodes_by_id(tree):
    return {node['id']: node for node in tree['nodes']}


def path_ids(tree, leaf_index):
    by_id = nodes_by_id(tree)
    path = [leaf_index]
    while by_id[path[-1]]['parent_id'] is not None:
        path.append(by_id[path[-1]]['parent_id'])
    return path


def check_build_structure(data, leaves):
    tree = data['final_tree']
    n = len(leaves)
    assert tree['root_id'] == len(tree['nodes']) - 1
    assert len(tree['nodes']) == reference_node_count(n)
    assert data['metrics']['nodes'] == len(tree['nodes'])
    assert data['metrics']['leaves'] == n
    assert data['metrics']['levels'] == reference_levels(n)
    assert data['metrics']['root'] == reference_root(leaves)
    assert data['metrics']['root_short'] == data['metrics']['root'][:8]

    by_id = nodes_by_id(tree)
    # leaves first, then internal nodes bottom-up left-to-right
    for index, leaf in enumerate(leaves):
        node = by_id[index]
        assert node['label'] == (leaf if leaf != '' else '""')
        assert node['full_hash'] == sha(leaf)
        assert node['sublabel'] == sha(leaf)[:8]
        assert node['parent_id'] is not None or n == 1
        assert node['duplicate_of'] is None
    for node in tree['nodes']:
        if node['id'] < n:
            continue
        if node['duplicate_of'] is None:
            assert node['label'].startswith('H')
        if node['duplicate_of'] is not None:
            original = by_id[node['duplicate_of']]
            assert node['duplicate_of'] < node['id']
            assert node['full_hash'] == original['full_hash']
            assert node['label'] == original['label']
            assert node['side'] == 'right'
    # every non-root node is a left/right child and every parent has two kids
    children = {}
    for node in tree['nodes']:
        if node['parent_id'] is not None:
            assert node['side'] in ('left', 'right')
            children.setdefault(node['parent_id'], []).append(node['side'])
    for node in tree['nodes']:
        if node['id'] < n:
            continue
        if node['duplicate_of'] is None:
            assert sorted(children.get(node['id'], [])) == ['left', 'right']
    # duplicate count matches odd levels
    odd_levels = 0
    current = n
    while current > 1:
        if current % 2:
            odd_levels += 1
        current = math.ceil(current / 2)
    duplicates = [node for node in tree['nodes'] if node['duplicate_of'] is not None]
    assert len(duplicates) == odd_levels
    # root side is null
    assert by_id[tree['root_id']]['side'] is None


def check_steps(data):
    steps = data['steps']
    assert steps
    assert data['final_tree'] == steps[-1]['snapshot']
    first = steps[0]['snapshot']
    assert len(first['nodes']) == len(data['final_tree']['nodes'])
    for step in steps:
        assert step['kind'] == 'tree'
        assert set(step['snapshot']) == {'nodes', 'root_id'}
        # structure never moves during a build or tamper
        assert [(n['id'], n['parent_id'], n['side'], n['duplicate_of'])
                for n in step['snapshot']['nodes']] == \
               [(n['id'], n['parent_id'], n['side'], n['duplicate_of'])
                for n in first['nodes']]
    return steps


# --- hashing vectors -------------------------------------------------------

def test_sha256_vector_abc():
    assert sha('abc') == 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'


def test_sha256_vector_empty():
    assert sha('') == 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'


def test_single_leaf_root_is_leaf_hash(client):
    data = build(client, ['abc'])
    assert data['metrics']['root'] == sha('abc')
    assert data['metrics']['nodes'] == 1
    assert data['metrics']['levels'] == 1
    assert [s['type'] for s in data['steps']] == ['build_start', 'leaf_hash', 'root_ready', 'build_done']


# --- build -----------------------------------------------------------------

@pytest.mark.parametrize('n', list(range(1, 17)))
def test_build_matches_reference(client, n):
    leaves = ['block %d' % i for i in range(n)]
    data = build(client, leaves)
    check_build_structure(data, leaves)
    check_steps(data)
    assert data['steps'][-1]['type'] == 'build_done'


@pytest.mark.parametrize('n', [2, 3, 5, 6, 8, 9, 16])
def test_build_step_types(client, n):
    leaves = ['L%d' % i for i in range(n)]
    data = build(client, leaves)
    types = [s['type'] for s in data['steps']]
    assert types.count('leaf_hash') == n
    assert types[-2:] == ['root_ready', 'build_done']
    expected_pairs = reference_node_count(n) - n - sum(
        1 for node in data['final_tree']['nodes'] if node['duplicate_of'] is not None)
    assert types.count('pair_hash') == expected_pairs
    assert types.count('duplicate_last') == sum(
        1 for node in data['final_tree']['nodes'] if node['duplicate_of'] is not None)


def test_structure_present_from_first_step(client):
    leaves = ['a', 'b', 'c', 'd', 'e', 'f', 'g']
    data = build(client, leaves)
    first = data['steps'][0]['snapshot']
    assert len(first['nodes']) == data['metrics']['nodes']
    assert all(node['sublabel'] == '\u2026' for node in first['nodes'])
    assert all(node['full_hash'] is None for node in first['nodes'])
    assert data['steps'][0]['type'] == 'build_start'


def test_ids_are_pure_function_of_leaf_count(client):
    first = build(client, ['a', 'b', 'c', 'd', 'e'])
    second = build(client, ['one', 'two', 'three', 'four', 'five'])
    shape_one = [(n['id'], n['parent_id'], n['side'], n['duplicate_of'])
                 for n in first['final_tree']['nodes']]
    shape_two = [(n['id'], n['parent_id'], n['side'], n['duplicate_of'])
                 for n in second['final_tree']['nodes']]
    assert shape_one == shape_two


def test_empty_leaf_is_hashed(client):
    data = build(client, ['', 'x'])
    leaf = data['final_tree']['nodes'][0]
    assert leaf['full_hash'] == sha('')
    assert leaf['label'] == '""'


def test_duplicate_last_for_odd_levels(client):
    data = build(client, ['0', '1', '2', '3', '4'])
    duplicates = [node for node in data['final_tree']['nodes']
                  if node['duplicate_of'] is not None]
    # one duplicate at the leaf level, one at the next odd level
    assert len(duplicates) == 2
    dup_leaf = duplicates[0]
    assert dup_leaf['duplicate_of'] == 4
    assert dup_leaf['full_hash'] == data['final_tree']['nodes'][4]['full_hash']


def test_parent_hash_feeds_from_raw_digests(client):
    leaves = ['a', 'b']
    data = build(client, leaves)
    root = data['metrics']['root']
    assert root == sha_bytes(sha('a'), sha('b'))
    assert root != sha(sha('a') + sha('b'))


# --- tamper ----------------------------------------------------------------

@pytest.mark.parametrize('n', list(range(1, 17)))
def test_tamper_every_index_matches_full_rebuild(client, n):
    leaves = ['L%d' % i for i in range(n)]
    original = build(client, leaves)
    for index in range(n):
        data = tamper(client, leaves, index, 'changed %d' % index)
        edited = list(leaves)
        edited[index] = 'changed %d' % index
        fresh = build(client, edited)
        assert data['metrics']['root_changed'] is True
        assert data['metrics']['matches_full_rebuild'] is True
        assert data['metrics']['new_root'] == reference_root(edited)
        assert data['metrics']['original_root'] == original['metrics']['root']
        assert data['final_tree'] == fresh['final_tree']
        check_steps(data)


@pytest.mark.parametrize('n', list(range(1, 17)))
def test_tamper_recomputes_only_the_path(client, n):
    leaves = ['L%d' % i for i in range(n)]
    original = build(client, leaves)
    for index in range(n):
        data = tamper(client, leaves, index, 'X%d' % index)
        path = path_ids(data['final_tree'], index)
        recomputes = [s for s in data['steps'] if s['type'] == 'recompute']
        assert len(recomputes) == len(path) - 1
        assert data['metrics']['recomputed'] == len(path) - 1
        assert data['metrics']['total_internal'] == len(data['final_tree']['nodes']) - n
        if n >= 4:
            assert data['metrics']['recomputed'] < data['metrics']['total_internal']

        # Only path nodes and their duplicates may change.
        before = nodes_by_id(original['final_tree'])
        after = nodes_by_id(data['final_tree'])
        allowed = set(path) | {
            node_id for node_id, node in after.items()
            if node['duplicate_of'] in set(path)
        }
        changed = {
            node_id for node_id in after
            if before[node_id]['full_hash'] != after[node_id]['full_hash']
        }
        assert changed <= allowed


def test_tamper_persists_mismatch_marks(client):
    leaves = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    data = tamper(client, leaves, 3, 'HACKED')
    seen = set()
    for step in data['steps']:
        roles = step.get('mismatch', [])
        if 'mismatch' in step['type'] or step['type'] == 'tamper_edit':
            seen |= set(roles)
        if step['type'] in ('mismatch', 'recompute'):
            assert seen.issubset(set(roles))


def test_tamper_duplicate_updates_with_original(client):
    leaves = ['a', 'b', 'c', 'd', 'e']
    original = build(client, leaves)
    duplicate = [n for n in original['final_tree']['nodes'] if n['duplicate_of'] == 4][0]
    data = tamper(client, leaves, 4, 'NEW')
    after = nodes_by_id(data['final_tree'])[duplicate['id']]
    assert after['full_hash'] == sha('NEW')
    mismatches = set()
    for step in data['steps']:
        mismatches |= set(step.get('mismatch', []))
    assert duplicate['id'] in mismatches


def test_tamper_same_data_is_not_detected(client):
    leaves = ['a', 'b', 'c', 'd']
    data = tamper(client, leaves, 2, 'c')
    assert data['metrics']['root_changed'] is False
    assert data['metrics']['matches_full_rebuild'] is True
    assert data['steps'][0]['type'] == 'tamper_edit'
    assert data['steps'][0]['payload']['changed'] is False
    assert not any(step['type'] == 'mismatch' for step in data['steps'])
    assert any(step['type'] == 'match' for step in data['steps'])
    assert data['final_tree'] == build(client, leaves)['final_tree']


def test_tamper_payload_details(client):
    leaves = ['a', 'b', 'c']
    data = tamper(client, leaves, 1, 'B')
    edit = data['steps'][0]
    assert edit['payload']['index'] == 1
    assert edit['payload']['old_data'] == 'b'
    assert edit['payload']['new_data'] == 'B'
    assert edit['payload']['old_digest'] == sha('b')
    assert edit['payload']['new_digest'] == sha('B')
    root_compare = [s for s in data['steps'] if s['type'] == 'root_compare'][0]
    assert root_compare['payload']['changed'] is True
    done = data['steps'][-1]
    assert done['type'] == 'tamper_done'
    for key in ('recomputed', 'total_internal', 'root_changed', 'original_root',
                'new_root', 'matches_full_rebuild'):
        assert key in done['payload']


# --- validation ------------------------------------------------------------

@pytest.mark.parametrize('payload,field', [
    ({'algorithm': 'nope', 'leaves': ['a']}, 'algorithm'),
    ({'algorithm': 'merkle_build'}, 'leaves'),
    ({'algorithm': 'merkle_build', 'leaves': 'a'}, 'leaves'),
    ({'algorithm': 'merkle_build', 'leaves': []}, 'leaves'),
    ({'algorithm': 'merkle_build', 'leaves': ['a'] * 17}, 'leaves'),
    ({'algorithm': 'merkle_build', 'leaves': ['a', 1]}, 'leaves'),
    ({'algorithm': 'merkle_build', 'leaves': ['a' * 41]}, 'leaves'),
    ({'algorithm': 'merkle_tamper', 'leaves': ['a', 'b'], 'index': -1, 'new_data': 'x'}, 'index'),
    ({'algorithm': 'merkle_tamper', 'leaves': ['a', 'b'], 'index': 2, 'new_data': 'x'}, 'index'),
    ({'algorithm': 'merkle_tamper', 'leaves': ['a', 'b'], 'index': True, 'new_data': 'x'}, 'index'),
    ({'algorithm': 'merkle_tamper', 'leaves': ['a', 'b'], 'index': '0', 'new_data': 'x'}, 'index'),
    ({'algorithm': 'merkle_tamper', 'leaves': ['a', 'b'], 'index': 0}, 'new_data'),
    ({'algorithm': 'merkle_tamper', 'leaves': ['a', 'b'], 'index': 0, 'new_data': 5}, 'new_data'),
    ({'algorithm': 'merkle_tamper', 'leaves': ['a', 'b'], 'index': 0, 'new_data': 'x' * 41}, 'new_data'),
])
def test_validation_matrix(client, payload, field):
    res = client.post('/merkle', json=payload)
    assert res.status_code == 400
    assert res.get_json()['field'] == field


def test_non_json_rejected(client):
    res = client.post('/merkle', data='not json', content_type='text/plain')
    assert res.status_code == 400
    assert res.get_json()['field'] == 'body'


def test_get_returns_405_json(client):
    res = client.get('/merkle')
    assert res.status_code == 405
    assert res.get_json()['field'] == 'request'


def test_step_cap_enforced(client, monkeypatch):
    monkeypatch.setattr(validation, 'MAX_MERKLE_STEPS', 3)
    res = client.post('/merkle', json={
        'algorithm': 'merkle_build', 'leaves': ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']})
    assert res.status_code == 400
    assert res.get_json()['field'] == 'leaves'


def test_deterministic(client):
    payload = {'algorithm': 'merkle_build', 'leaves': ['a', 'b', 'c']}
    assert client.post('/merkle', json=payload).get_json() == \
        client.post('/merkle', json=payload).get_json()


def test_build_generator_direct():
    data = merkle.merkle_build_steps(['a', 'b'])
    assert data['metrics']['root'] == reference_root(['a', 'b'])
    assert data['steps'][-1]['type'] == 'build_done'

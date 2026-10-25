"""
Tests for the trie trace generator (POST /trie).

The independent oracle is a pair of plain Python sets: the inserted words and
every proper non-empty prefix of every word. Snapshot node ids, parent links,
terminal markers and the reported metrics are checked against that oracle.
During an insert the tree legitimately grows letter by letter; every
`insert_done`/`search_done`/`prefix_done` step must satisfy the full oracle.
"""

import itertools
import random
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import app
import tries
import validation
from validation import validate_trie_payload


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


# --- helpers ---------------------------------------------------------------

def oracle(words):
    prefixes = set()
    for w in words:
        for i in range(1, len(w) + 1):
            prefixes.add(w[:i])
    return set(words), prefixes


def node_paths(snapshot):
    """Map node id -> string spelled by the path from the root."""
    by_id = {n['id']: n for n in snapshot['nodes']}
    paths = {}

    def walk(node_id):
        if node_id in paths:
            return paths[node_id]
        if node_id == 0:
            paths[node_id] = ''
            return ''
        node = by_id[node_id]
        paths[node_id] = walk(node['parent_id']) + node['label']
        return paths[node_id]

    for n in snapshot['nodes']:
        walk(n['id'])
    return paths


def assert_tree_shape(snapshot):
    nodes = snapshot['nodes']
    ids = [n['id'] for n in nodes]
    assert len(ids) == len(set(ids))
    assert snapshot['root_id'] == 0
    roots = [n for n in nodes if n['parent_id'] is None]
    assert len(roots) == 1 and roots[0]['id'] == 0
    assert roots[0]['label'] == 'root'
    by_id = {n['id']: n for n in nodes}
    for n in nodes:
        if n['id'] == 0:
            continue
        assert n['parent_id'] in by_id
        assert n['side'] is None
        assert len(n['label']) == 1 and n['label'].islower()
    # sibling labels are unique and sorted alphabetically in snapshot order
    children = {}
    for n in nodes:
        if n['parent_id'] is not None:
            children.setdefault(n['parent_id'], []).append(n['label'])
    for labels in children.values():
        assert len(labels) == len(set(labels))
        assert labels == sorted(labels)


def assert_word_oracle(result, expected_words, final=True):
    nodes = result['final_tree']['nodes']
    paths = node_paths(result['final_tree'])
    expected_words, prefixes = oracle(expected_words)
    if final:
        assert {paths[n['id']] for n in nodes if n['terminal']} == expected_words
    assert {paths[n['id']] for n in nodes if n['id'] != 0} == prefixes
    assert len(nodes) == 1 + len(prefixes)


def done_type(algorithm):
    return {
        'trie_insert': 'insert_done',
        'trie_search': 'search_done',
        'trie_prefix': 'prefix_done',
    }[algorithm]


def check_steps(result, algorithm, expected_words):
    """Walk every step and enforce the trace contract."""
    expected_words, prefixes = oracle(expected_words)
    steps = result['steps']
    assert steps
    assert steps[-1]['type'] == done_type(algorithm)
    assert result['final_tree'] == steps[-1]['snapshot']

    seen_ids = {}
    previous_ids = set()
    previous_count = 0
    for index, step in enumerate(steps):
        assert step['kind'] == 'tree'
        assert isinstance(step['annotation'], str) and step['annotation']
        snap = step['snapshot']
        assert_tree_shape(snap)
        paths = node_paths(snap)
        ids = {n['id'] for n in snap['nodes']}
        assert previous_ids.issubset(ids)  # append-only within an operation
        assert len(ids) >= previous_count
        previous_ids, previous_count = ids, len(ids)

        for n in snap['nodes']:
            if n['id'] == 0:
                continue
            assert paths[n['id']] in prefixes
            if n['terminal']:
                assert paths[n['id']] in expected_words

        for prefix in ('created', 'reused', 'matched', 'selected', 'highlighted'):
            for node_id in step.get(prefix, []):
                assert node_id in ids

        # payload.path is a root-to-parent ancestor chain where provided
        payload = step.get('payload') or {}
        if 'path' in payload:
            path = payload['path']
            assert path and path[0] == 0
            for parent, child in zip(path, path[1:]):
                assert child in ids and parent in ids

        if step['type'] == done_type(algorithm):
            terminals = {paths[n['id']] for n in snap['nodes'] if n['terminal']}
            assert terminals == expected_words
            assert len(snap['nodes']) == 1 + len(prefixes)

    # ids are globally stable and never reused for a different path
    for n in result['final_tree']['nodes']:
        if n['id'] in seen_ids:
            assert seen_ids[n['id']] == node_paths(result['final_tree'])[n['id']]
    return steps


def payload(algorithm, ops=None, word=None, prefix=None):
    body = {'algorithm': algorithm, 'ops': ops or []}
    if word is not None:
        body['word'] = word
    if prefix is not None:
        body['prefix'] = prefix
    return body


# --- insert ----------------------------------------------------------------

def test_insert_creates_three_nodes_for_car(client):
    res = client.post('/trie', json=payload('trie_insert', word='car'))
    assert res.status_code == 200
    data = res.get_json()
    types = [s['type'] for s in data['steps']]
    assert types == ['node_created', 'node_created', 'node_created', 'mark_end', 'insert_done']
    assert data['metrics']['nodes'] == 4
    assert data['metrics']['words'] == 1
    assert data['metrics']['created'] == 3
    assert data['metrics']['reused'] == 0
    assert data['metadata']['normalized_word'] == 'car'
    assert_word_oracle(data, ['car'])


def test_insert_reuses_shared_prefix(client):
    res = client.post('/trie', json=payload(
        'trie_insert', ops=[{'op': 'insert', 'word': 'car'}], word='card'))
    assert res.status_code == 200
    data = res.get_json()
    reused = sum(1 for s in data['steps'] if s['type'] == 'node_reused')
    created = sum(1 for s in data['steps'] if s['type'] == 'node_created')
    assert (reused, created) == (3, 1)
    assert data['metrics']['nodes'] == 5
    assert data['metrics']['created'] == 1
    assert data['metrics']['reused'] == 3
    assert_word_oracle(data, ['car', 'card'])


def test_insert_word_that_is_prefix_of_existing(client):
    res = client.post('/trie', json=payload(
        'trie_insert', ops=[{'op': 'insert', 'word': 'card'}], word='car'))
    assert res.status_code == 200
    data = res.get_json()
    assert data['metrics']['created'] == 0
    assert data['metrics']['reused'] == 3
    assert data['metrics']['nodes'] == 5
    mark_end = [s for s in data['steps'] if s['type'] == 'mark_end'][0]
    assert mark_end['payload']['was_new_node'] is False
    assert_word_oracle(data, ['card', 'car'])


def test_insert_car_card_care_cat_sequence(client):
    ops = []
    for word in ('car', 'card', 'care', 'cat'):
        res = client.post('/trie', json=payload('trie_insert', ops=ops, word=word))
        assert res.status_code == 200
        data = res.get_json()
        check_steps(data, 'trie_insert', [o['word'] for o in ops] + [word])
        ops.append({'op': 'insert', 'word': word})

    # root + c,a,r,d,e,t
    assert data['metrics']['nodes'] == 7
    terminals = {node_paths(data['final_tree'])[n['id']]
                 for n in data['final_tree']['nodes'] if n['terminal']}
    assert terminals == {'car', 'card', 'care', 'cat'}


def test_insert_normalises_case(client):
    res = client.post('/trie', json=payload('trie_insert', word='CaR'))
    assert res.status_code == 200
    data = res.get_json()
    assert data['metadata']['normalized_word'] == 'car'
    assert data['final_tree']['nodes'][1]['label'] == 'c'


def test_insert_duplicate_rejected(client):
    res = client.post('/trie', json=payload(
        'trie_insert', ops=[{'op': 'insert', 'word': 'car'}], word='car'))
    assert res.status_code == 400
    assert res.get_json()['field'] == 'word'


@pytest.mark.parametrize('word', ['', '   ', 'ca r', 'c4r', 'c-ar', 'caf\u00e9'])
def test_insert_invalid_word_rejected(client, word):
    res = client.post('/trie', json=payload('trie_insert', word=word))
    assert res.status_code == 400
    assert res.get_json()['field'] == 'word'


def test_insert_too_long_rejected(client):
    res = client.post('/trie', json=payload('trie_insert', word='a' * 13))
    assert res.status_code == 400
    assert res.get_json()['field'] == 'word'


def test_insert_missing_word_rejected(client):
    res = client.post('/trie', json={'algorithm': 'trie_insert', 'ops': []})
    assert res.status_code == 400
    assert res.get_json()['field'] == 'word'


# --- search ----------------------------------------------------------------

def test_search_found(client):
    res = client.post('/trie', json=payload(
        'trie_search', ops=[{'op': 'insert', 'word': 'car'},
                            {'op': 'insert', 'word': 'card'}], word='card'))
    assert res.status_code == 200
    data = res.get_json()
    assert [s['type'] for s in data['steps']][:5] == ['match'] * 4 + ['found']
    assert data['steps'][-1]['payload']['found'] is True
    assert data['steps'][-1]['type'] == 'search_done'
    assert data['final_tree']['nodes'][4]['terminal'] is True
    assert_word_oracle(data, ['car', 'card'])


def test_search_prefix_is_not_a_word(client):
    res = client.post('/trie', json=payload(
        'trie_search', ops=[{'op': 'insert', 'word': 'card'}], word='car'))
    assert res.status_code == 200
    data = res.get_json()
    not_found = [s for s in data['steps'] if s['type'] == 'not_found']
    assert len(not_found) == 1
    assert not_found[0]['payload']['reason'] == 'not_a_word'


def test_search_missing_edge(client):
    res = client.post('/trie', json=payload(
        'trie_search', ops=[{'op': 'insert', 'word': 'card'}], word='zoo'))
    assert res.status_code == 200
    data = res.get_json()
    no_match = [s for s in data['steps'] if s['type'] == 'no_match']
    assert len(no_match) == 1
    assert no_match[0]['payload']['failed_at'] == 0
    assert [s for s in data['steps'] if s['type'] == 'not_found'][0]['payload']['reason'] == 'missing_edge'
    assert data['steps'][-1]['payload']['found'] is False


def test_search_empty_word_rejected(client):
    res = client.post('/trie', json=payload('trie_search', word=''))
    assert res.status_code == 400
    assert res.get_json()['field'] == 'word'


def test_search_normalises_case(client):
    res = client.post('/trie', json=payload(
        'trie_search', ops=[{'op': 'insert', 'word': 'car'}], word='CAR'))
    assert res.status_code == 200
    assert res.get_json()['metadata']['normalized_word'] == 'car'


def test_search_does_not_mutate_tree(client):
    ops = [{'op': 'insert', 'word': 'car'}, {'op': 'insert', 'word': 'card'}]
    res = client.post('/trie', json=payload('trie_search', ops=ops, word='ca'))
    data = res.get_json()
    built = client.post('/trie', json=payload('trie_insert', ops=ops, word='care')).get_json()
    assert len(data['final_tree']['nodes']) == len(built['final_tree']['nodes']) - 1
    assert_word_oracle(data, ['car', 'card'])


# --- prefix / autocomplete -------------------------------------------------

def test_prefix_completions(client):
    words = ['car', 'card', 'care', 'cat', 'dog']
    ops = [{'op': 'insert', 'word': w} for w in words]
    res = client.post('/trie', json=payload('trie_prefix', ops=ops, prefix='ca'))
    assert res.status_code == 200
    data = res.get_json()
    assert data['metadata']['completions'] == ['car', 'card', 'care', 'cat']
    assert data['steps'][-1]['type'] == 'prefix_done'
    assert_word_oracle(data, words)


def alpha_words(count, prefix=''):
    """Unique lowercase words of the form prefix + two letters."""
    letters = 'abcdefghijklmnopqrstuvwxyz'
    out = []
    for i in range(count):
        out.append(prefix + letters[i // 26] + letters[i % 26])
    return out


def test_prefix_empty_returns_first_ten_alphabetically(client):
    words = alpha_words(12)
    ops = [{'op': 'insert', 'word': w} for w in words]
    res = client.post('/trie', json=payload('trie_prefix', ops=ops, prefix=''))
    data = res.get_json()
    assert data['metadata']['completions'] == sorted(words)[:10]
    assert data['metadata']['truncated'] is True


def test_prefix_truncated_flag(client):
    words = alpha_words(11, prefix='ab')
    ops = [{'op': 'insert', 'word': w} for w in words]
    data = client.post('/trie', json=payload('trie_prefix', ops=ops, prefix='ab')).get_json()
    assert len(data['metadata']['completions']) == 10
    assert data['metadata']['truncated'] is True


def test_prefix_missing(client):
    ops = [{'op': 'insert', 'word': 'car'}]
    data = client.post('/trie', json=payload('trie_prefix', ops=ops, prefix='zz')).get_json()
    types = [s['type'] for s in data['steps']]
    assert types[-2:] == ['prefix_missing', 'prefix_done']
    assert data['metadata']['completions'] == []
    assert data['metadata']['truncated'] is False


def test_prefix_matches_word_itself(client):
    ops = [{'op': 'insert', 'word': 'car'}]
    data = client.post('/trie', json=payload('trie_prefix', ops=ops, prefix='car')).get_json()
    assert data['metadata']['completions'] == ['car']


def test_prefix_does_not_require_word_field(client):
    data = client.post('/trie', json=payload('trie_prefix', prefix='a')).get_json()
    assert data['metadata']['completions'] == []
    assert data['steps'][-1]['type'] == 'prefix_done'


# --- request validation ----------------------------------------------------

@pytest.mark.parametrize('ops', ['nope', 3, {'a': 1}])
def test_ops_must_be_list(client, ops):
    res = client.post('/trie', json={'algorithm': 'trie_insert', 'ops': ops, 'word': 'car'})
    assert res.status_code == 400
    assert res.get_json()['field'] == 'ops'


@pytest.mark.parametrize('item', [
    {},
    {'op': 'delete', 'word': 'car'},
    {'op': 'insert', 'word': 12},
    {'op': 'insert', 'word': ''},
])
def test_bad_op_rejected(client, item):
    res = client.post('/trie', json={'algorithm': 'trie_insert', 'ops': [item], 'word': 'cat'})
    assert res.status_code == 400
    field = res.get_json()['field']
    assert field == 'ops' or field.startswith('ops[')


def test_duplicate_op_word_rejected(client):
    ops = [{'op': 'insert', 'word': 'car'}, {'op': 'insert', 'word': 'car'}]
    res = client.post('/trie', json={'algorithm': 'trie_insert', 'ops': ops, 'word': 'cat'})
    assert res.status_code == 400
    assert res.get_json()['field'] == 'ops'


def test_too_many_words_rejected(client):
    ops = [{'op': 'insert', 'word': 'w%02d' % i} for i in range(validation.MAX_TRIE_WORDS + 1)]
    res = client.post('/trie', json={'algorithm': 'trie_insert', 'ops': ops, 'word': 'zzz'})
    assert res.status_code == 400
    assert res.get_json()['field'] == 'ops'


def test_node_cap_rejected(client):
    letters = 'abcdefghijklmnopqrstuvwxyz'
    words = []
    for i in range(30):
        words.append(letters[i % 26] + letters[i // 26] + 'x' * 10)
    assert len(set(words)) == 30
    ops = [{'op': 'insert', 'word': w} for w in words]
    res = client.post('/trie', json={'algorithm': 'trie_search', 'ops': ops, 'word': 'zz'})
    assert res.status_code == 400
    assert res.get_json()['field'] == 'word'


def test_node_cap_checked_for_insert_action(client, monkeypatch):
    monkeypatch.setattr(validation, 'MAX_TRIE_NODES', 3)
    res = client.post('/trie', json={'algorithm': 'trie_insert', 'ops': [], 'word': 'car'})
    assert res.status_code == 400
    assert res.get_json()['field'] == 'word'


@pytest.mark.parametrize('algorithm', ['trie_insert', 'trie_search', 'trie_prefix'])
def test_missing_action_rejected(client, algorithm):
    res = client.post('/trie', json={'algorithm': algorithm, 'ops': []})
    assert res.status_code == 400
    assert res.get_json()['field'] == ('prefix' if algorithm == 'trie_prefix' else 'word')


def test_unknown_algorithm_rejected(client):
    res = client.post('/trie', json={'algorithm': 'nope', 'ops': []})
    assert res.status_code == 400
    assert res.get_json()['field'] == 'algorithm'


def test_non_json_body_rejected(client):
    res = client.post('/trie', data='not json', content_type='text/plain')
    assert res.status_code == 400
    assert res.get_json()['field'] == 'body'


def test_get_returns_405_json(client):
    res = client.get('/trie')
    assert res.status_code == 405
    data = res.get_json()
    assert data['field'] == 'request'
    assert data['error']


def test_validate_helper_returns_validated_payload():
    validated, err = validate_trie_payload({
        'algorithm': 'trie_insert', 'ops': [{'op': 'insert', 'word': 'Car'}], 'word': 'CARD'})
    assert err is None
    assert validated['ops'] == [{'op': 'insert', 'word': 'car'}]
    assert validated['word'] == 'card'


# --- ids, replay, caps, invariants ----------------------------------------

def test_ids_stable_across_requests(client):
    first = client.post('/trie', json={'algorithm': 'trie_insert', 'ops': [], 'word': 'car'}).get_json()
    second = client.post('/trie', json={'algorithm': 'trie_insert',
                                        'ops': [{'op': 'insert', 'word': 'car'}],
                                        'word': 'card'}).get_json()
    first_paths = node_paths(first['final_tree'])
    first_ids = {first_paths[n['id']]: n['id'] for n in first['final_tree']['nodes']}
    second_paths = node_paths(second['final_tree'])
    second_ids = {second_paths[n['id']]: n['id'] for n in second['final_tree']['nodes']}
    for path, node_id in first_ids.items():
        assert second_ids[path] == node_id


def test_stateless_replay_matches_stepwise(client):
    words = ['car', 'card', 'care', 'cat', 'dog', 'do', 'd']
    ops = []
    last = None
    for word in words:
        last = client.post('/trie', json={'algorithm': 'trie_insert',
                                          'ops': list(ops), 'word': word}).get_json()
        ops.append({'op': 'insert', 'word': word})
    replay = client.post('/trie', json={'algorithm': 'trie_search',
                                       'ops': list(ops), 'word': 'cat'}).get_json()
    assert replay['final_tree'] == last['final_tree']


def test_compression_metrics(client):
    data = client.post('/trie', json={
        'algorithm': 'trie_insert', 'ops': [],
        'word': 'abc'}).get_json()
    # Three letters but one shared path: 3 nodes without the root for 3 letters.
    assert data['metrics']['letters_total'] == 3
    assert data['metrics']['compression']['nodes_without_root'] == 3
    assert data['metrics']['compression']['letters_total'] == 3


def test_step_cap_enforced(client, monkeypatch):
    monkeypatch.setattr(validation, 'MAX_TRIE_STEPS', 2)
    res = client.post('/trie', json={'algorithm': 'trie_insert', 'ops': [], 'word': 'car'})
    assert res.status_code == 400
    assert res.get_json()['field'] == 'word'


@pytest.mark.parametrize('algorithm,payload_extra', [
    ('trie_insert', {'word': 'care'}),
    ('trie_search', {'word': 'car'}),
    ('trie_prefix', {'prefix': 'ca'}),
])
def test_step_contract(client, algorithm, payload_extra):
    ops = [{'op': 'insert', 'word': 'car'}, {'op': 'insert', 'word': 'card'}]
    body = {'algorithm': algorithm, 'ops': ops}
    body.update(payload_extra)
    data = client.post('/trie', json=body).get_json()
    expected = ['car', 'card'] + ([payload_extra['word']] if algorithm == 'trie_insert' else [])
    check_steps(data, algorithm, expected)


def test_random_insert_invariants(client):
    rng = random.Random(20261025)
    alphabet = 'abcdefghij'
    seen = set()
    words = []
    while len(words) < 12:
        word = ''.join(rng.choice(alphabet) for _ in range(rng.randint(1, 6)))
        if word not in seen:
            seen.add(word)
            words.append(word)
    ops = []
    for word in words:
        data = client.post('/trie', json={'algorithm': 'trie_insert',
                                          'ops': list(ops), 'word': word}).get_json()
        check_steps(data, 'trie_insert', [o['word'] for o in ops] + [word])
        ops.append({'op': 'insert', 'word': word})
    assert data['metrics']['words'] == len(words)


def test_every_step_is_tree_kind_and_final_snapshot(client):
    data = client.post('/trie', json={
        'algorithm': 'trie_insert', 'ops': [],
        'word': 'hello'}).get_json()
    assert all(s['kind'] == 'tree' for s in data['steps'])
    assert data['final_tree'] == data['steps'][-1]['snapshot']

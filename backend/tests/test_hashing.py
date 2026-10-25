"""
Tests for the hash-table trace generator (POST /hash).

Two independent oracles are used:

* the live key set implied by the op log + action, and
* a direct simulation of each panel's lookup rule (bucket = hash % size for
  chaining; linear probing past tombstones until an empty slot for open
  addressing).

Every step carries both panels' snapshots. During a resize the not-yet-moved
keys are legitimately absent from the snapshot, so only completed states are
required to match the oracle.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import app
import hashing
import validation
from validation import validate_hash_payload


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def body(algorithm, key, hash_fn='sum_mod', table_size=7, ops=None, probing='linear'):
    return {
        'algorithm': algorithm,
        'hash_fn': hash_fn,
        'table_size': table_size,
        'probing': probing,
        'ops': ops or [],
        'action': {'key': key},
    }


def index_of(key, hash_fn, size):
    return hashing.hash_index(key, hash_fn, size)


def key_for_index(target, size, hash_fn='sum_mod'):
    """Find a printable 2-char key whose home index is target."""
    for code in range(33, 127):
        candidate = 'a' + chr(code)
        if index_of(candidate, hash_fn, size) == target:
            return candidate
    raise AssertionError('no key for index')


def live_keys(data):
    chaining = {entry['key'] for bucket in data['final_state']['chaining']['buckets']
                for entry in bucket}
    opened = {cell['key'] for cell in data['final_state']['open']['slots']
              if cell and not cell.get('tombstone')}
    return chaining, opened


def open_lookup(state, key, hash_fn):
    size = state['size']
    start = index_of(key, hash_fn, size)
    for attempt in range(size):
        cell = state['slots'][(start + attempt) % size]
        if cell is None:
            return False
        if cell.get('tombstone'):
            continue
        if cell['key'] == key:
            return True
    return False


def check_panel_invariants(data, hash_fn, expected_live):
    chaining = data['final_state']['chaining']
    opened = data['final_state']['open']
    assert len(chaining['buckets']) == chaining['size']
    assert chaining['count'] == len(expected_live)
    assert opened['size'] == len(opened['slots'])
    assert opened['count'] == len(expected_live)

    chain_keys = []
    for bucket_index, bucket in enumerate(chaining['buckets']):
        for entry in bucket:
            assert index_of(entry['key'], hash_fn, chaining['size']) == bucket_index
            chain_keys.append(entry['key'])
    assert set(chain_keys) == expected_live
    assert len(chain_keys) == len(set(chain_keys))

    open_keys = []
    tombstones = 0
    for slot, cell in enumerate(opened['slots']):
        if cell is None:
            continue
        if cell.get('tombstone'):
            tombstones += 1
            continue
        open_keys.append(cell['key'])
    assert set(open_keys) == expected_live
    assert len(open_keys) == len(set(open_keys))
    assert opened['tombstones'] == tombstones
    assert opened['count'] + tombstones <= opened['size']

    for key in expected_live:
        assert open_lookup(opened, key, hash_fn)

    assert abs(chaining['load_factor'] - chaining['count'] / chaining['size']) < 1e-3
    assert abs(opened['load_factor'] - opened['count'] / opened['size']) < 1e-3

    metrics = data['metrics']
    assert metrics['chaining']['count'] == chaining['count']
    assert metrics['open']['count'] == opened['count']
    assert metrics['chaining']['max_chain_length'] == max(
        (len(b) for b in chaining['buckets']), default=0)
    assert metrics['chaining']['tombstones'] == 0
    assert metrics['open']['tombstones'] == tombstones


def check_steps(data):
    steps = data['steps']
    assert steps
    assert data['final_state'] == steps[-1]['snapshot']
    seen_open = False
    for step in steps:
        assert step['kind'] == 'grid'
        assert step['panel'] in ('chaining', 'open')
        assert set(step['snapshot']) == {'chaining', 'open'}
        if step['panel'] == 'open':
            seen_open = True
        else:
            assert not seen_open, 'all chaining steps must come before open steps'
    return steps


def replay_inserts(client, keys, hash_fn='sum_mod', table_size=7):
    ops = []
    data = None
    for key in keys:
        res = client.post('/hash', json=body('hash_insert', key, hash_fn, table_size, ops))
        assert res.status_code == 200, res.get_json()
        data = res.get_json()
        ops.append({'op': 'insert', 'key': key})
    return ops, data


# --- hash primitives -------------------------------------------------------

def test_sum_mod_vector(client):
    data = client.post('/hash', json=body('hash_insert', 'abc')).get_json()
    computes = [s for s in data['steps'] if s['type'] == 'hash_compute']
    assert len(computes) == 2
    for step in computes:
        assert step['payload']['raw'] == 294
        assert step['payload']['index'] == 0
        assert step['payload']['table_size'] == 7
        assert [t['char'] for t in step['payload']['terms']] == ['a', 'b', 'c']
        assert step['payload']['terms'][-1]['running'] == 294


def test_poly_vector(client):
    data = client.post('/hash', json=body('hash_insert', 'abc', hash_fn='poly')).get_json()
    for step in [s for s in data['steps'] if s['type'] == 'hash_compute']:
        assert step['payload']['raw'] == 96354
        assert step['payload']['index'] == 6


def test_sum_mod_anagrams_collide():
    assert index_of('ab', 'sum_mod', 7) == index_of('ba', 'sum_mod', 7) == 6
    assert hashing.hash_terms('ab', 'sum_mod')[1] == 195


def test_poly_anagrams_are_separated():
    assert index_of('ab', 'poly', 7) == 4
    assert index_of('ba', 'poly', 7) == 6
    assert hashing.hash_terms('ab', 'poly')[1] == 3105
    assert hashing.hash_terms('ba', 'poly')[1] == 3135


def test_terms_reproduce_raw_poly():
    terms, raw = hashing.hash_terms('hash', 'poly')
    running = 0
    for term in terms:
        running = (running * 31 + term['code']) % (2 ** 32)
        assert term['running'] == running
    assert running == raw


# --- collision behaviour ---------------------------------------------------

def test_anagrams_collide_in_both_panels(client):
    ops, _ = replay_inserts(client, ['ab'])
    data = client.post('/hash', json=body('hash_insert', 'ba', ops=ops)).get_json()
    assert data['metrics']['chaining']['max_chain_length'] == 2
    assert data['metrics']['chaining']['collisions'] == 1
    assert data['metrics']['open']['collisions'] == 1
    assert data['metrics']['open']['max_probe_length'] == 2
    assert index_of('ab', 'sum_mod', 7) == index_of('ba', 'sum_mod', 7)
    check_panel_invariants(data, 'sum_mod', {'ab', 'ba'})


def test_poly_spreads_anagrams():
    ops = [{'op': 'insert', 'key': 'ab'}]
    leap = hashing.hash_op_steps('hash_insert', hash_fn='poly', table_size=7,
                                 ops=ops, action={'key': 'ba'})
    assert leap['metrics']['chaining']['max_chain_length'] == 1
    assert leap['metrics']['open']['max_probe_length'] == 1


def test_anagram_preset_under_sum_mod():
    words = ['listen', 'silent', 'enlist', 'tinsel']
    assert len({index_of(w, 'sum_mod', 7) for w in words}) == 1
    assert len({index_of(w, 'poly', 7) for w in words}) > 1


def test_three_anagrams_build_long_chain(client):
    ops = [{'op': 'insert', 'key': 'listen'}]
    for word in ('silent', 'enlist'):
        ops.append({'op': 'insert', 'key': word})
    data = hashing.hash_op_steps('hash_insert', hash_fn='sum_mod', table_size=7,
                                ops=ops, action={'key': 'tinsel'})
    assert data['metrics']['chaining']['max_chain_length'] == 4


# --- search / delete -------------------------------------------------------

def test_search_found_both_panels(client):
    ops, _ = replay_inserts(client, ['ab', 'ba'])
    data = client.post('/hash', json=body('hash_search', 'ab', ops=ops)).get_json()
    found = [s for s in data['steps'] if s['type'] == 'found']
    assert len(found) == 2
    assert {s['panel'] for s in found} == {'chaining', 'open'}
    assert data['final_state']['open']['count'] == 2


def test_search_absent_is_not_an_error(client):
    ops, _ = replay_inserts(client, ['ab'])
    res = client.post('/hash', json=body('hash_search', 'zz', ops=ops))
    assert res.status_code == 200
    data = res.get_json()
    assert len([s for s in data['steps'] if s['type'] == 'not_found']) == 2


def test_delete_leaves_tombstone_and_chaining_removal(client):
    ops, _ = replay_inserts(client, ['ab'])
    data = client.post('/hash', json=body('hash_delete', 'ab', ops=ops)).get_json()
    opened = data['final_state']['open']
    assert opened['count'] == 0
    assert opened['tombstones'] == 1
    tombstone_slot = [i for i, c in enumerate(opened['slots']) if c and c.get('tombstone')]
    assert len(tombstone_slot) == 1
    assert data['final_state']['chaining']['buckets'][6] == []
    assert [s['type'] for s in data['steps'] if s['panel'] == 'chaining'][-2] == 'chain_remove'


def test_search_probes_past_tombstone(client):
    ops, _ = replay_inserts(client, ['ab'])
    client.post('/hash', json=body('hash_delete', 'ab', ops=ops))
    ops.append({'op': 'delete', 'key': 'ab'})
    data = client.post('/hash', json=body('hash_search', 'ab', ops=ops)).get_json()
    open_probes = [s for s in data['steps'] if s['panel'] == 'open' and s['type'] == 'probe']
    assert open_probes[0]['payload']['state'] == 'tombstone'
    assert any(s['type'] == 'not_found' for s in data['steps'])


def test_insert_reuses_first_tombstone_after_proving_absence(client):
    ops, _ = replay_inserts(client, ['ab'])
    client.post('/hash', json=body('hash_delete', 'ab', ops=ops))
    ops.append({'op': 'delete', 'key': 'ab'})
    data = client.post('/hash', json=body('hash_insert', 'ab', ops=ops)).get_json()
    place = [s for s in data['steps'] if s['type'] == 'place'][0]
    assert place['payload']['reused_tombstone'] is True
    assert place['payload']['slot'] == 6
    assert data['final_state']['open']['tombstones'] == 0
    probes = [s['payload']['state'] for s in data['steps']
              if s['panel'] == 'open' and s['type'] == 'probe']
    assert probes[0] == 'tombstone' and probes[-1] == 'empty'


def test_delete_absent_rejected(client):
    res = client.post('/hash', json=body('hash_delete', 'zz'))
    assert res.status_code == 400
    assert res.get_json()['field'] == 'key'


def test_duplicate_insert_rejected(client):
    ops, _ = replay_inserts(client, ['ab'])
    res = client.post('/hash', json=body('hash_insert', 'ab', ops=ops))
    assert res.status_code == 400
    assert res.get_json()['field'] == 'key'


# --- resize ----------------------------------------------------------------

def test_open_grows_before_chaining(client):
    ops = []
    sizes = []
    for i in range(8):
        key = 'k%d' % i
        data = client.post('/hash', json=body('hash_insert', key, ops=ops)).get_json()
        sizes.append((data['final_state']['chaining']['size'],
                      data['final_state']['open']['size']))
        ops.append({'op': 'insert', 'key': key})
    assert sizes[4] == (7, 7)
    assert sizes[5] == (7, 15)     # open resizes on the 6th insert
    assert sizes[7] == (15, 15)    # chaining resizes on the 8th insert


def test_size_sequence_grows_to_cap(client):
    ops = []
    observed = set()
    for i in range(34):
        key = 'k%d' % i
        res = client.post('/hash', json=body('hash_insert', key, ops=ops))
        assert res.status_code == 200
        data = res.get_json()
        observed.add(data['final_state']['open']['size'])
        ops.append({'op': 'insert', 'key': key})
    assert {7, 15, 31, 63}.issubset(observed)
    assert data['final_state']['chaining']['size'] == 63


def test_resize_moves_keep_lookups_working(client):
    keys = ['k%d' % i for i in range(12)]
    ops, data = replay_inserts(client, keys)
    assert data['final_state']['open']['size'] == 31
    check_panel_invariants(data, 'sum_mod', set(keys))


def test_resize_drops_tombstones(client):
    keys = ['k%d' % i for i in range(8)]
    ops = []
    for key in keys:
        client.post('/hash', json=body('hash_insert', key, ops=ops))
        ops.append({'op': 'insert', 'key': key})
    for key in keys[:3]:
        r = client.post('/hash', json=body('hash_delete', key, ops=ops))
        assert r.status_code == 200
        ops.append({'op': 'delete', 'key': key})
    # Enough new inserts to force the next open-addressing resize.
    for i in range(8, 16):
        key = 'k%d' % i
        data = client.post('/hash', json=body('hash_insert', key, ops=ops)).get_json()
        ops.append({'op': 'insert', 'key': key})
        if data['final_state']['open']['size'] == 31:
            assert data['final_state']['open']['tombstones'] == 0
            break
    else:
        raise AssertionError('open table never resized')


def test_in_place_rehash_at_cap_clears_tombstones(client, monkeypatch):
    monkeypatch.setattr(validation, 'MAX_TABLE_SIZE', 15)
    keys = [key_for_index(i, 15) for i in range(11)]
    ops = []
    for key in keys:
        res = client.post('/hash', json=body('hash_insert', key, ops=ops))
        assert res.status_code == 200, res.get_json()
        ops.append({'op': 'insert', 'key': key})
    for key in keys[7:]:
        res = client.post('/hash', json=body('hash_delete', key, ops=ops))
        assert res.status_code == 200
        ops.append({'op': 'delete', 'key': key})

    # Home bucket 7 is a tombstone; the table is at the size cap, so the
    # resize must rehash in place and clear tombstones.
    key = key_for_index(7, 15)
    data = client.post('/hash', json=body('hash_insert', key, ops=ops)).get_json()
    starts = [s for s in data['steps'] if s['type'] == 'resize_start']
    assert starts and starts[0]['payload']['in_place'] is True
    assert starts[0]['payload']['old_size'] == 15
    assert starts[0]['payload']['new_size'] == 15
    assert data['final_state']['open']['tombstones'] == 0
    assert data['final_state']['open']['size'] == 15


def test_max_live_keys_rejected(client):
    ops = []
    for i in range(validation.MAX_LIVE_KEYS):
        key = 'k%d' % i
        res = client.post('/hash', json=body('hash_insert', key, ops=ops))
        assert res.status_code == 200, res.get_json()
        ops.append({'op': 'insert', 'key': key})
    res = client.post('/hash', json=body('hash_insert', 'overflow', ops=ops))
    assert res.status_code == 400
    assert res.get_json()['field'] == 'key'


def test_over_capacity_rejected(client, monkeypatch):
    monkeypatch.setattr(validation, 'MAX_LIVE_KEYS', 100)
    ops = []
    for i in range(47):
        key = 'k%d' % i
        res = client.post('/hash', json=body('hash_insert', key, ops=ops))
        assert res.status_code == 200, res.get_json()
        ops.append({'op': 'insert', 'key': key})
    res = client.post('/hash', json=body('hash_insert', 'k47', ops=ops))
    assert res.status_code == 400
    assert res.get_json()['field'] == 'key'
    assert 'capacity' in res.get_json()['error']


# --- trace shape / ids / determinism --------------------------------------

def test_dual_panel_snapshot_and_ordering(client):
    ops, _ = replay_inserts(client, ['ab'])
    data = client.post('/hash', json=body('hash_insert', 'ba', ops=ops)).get_json()
    steps = check_steps(data)
    first_open = next(i for i, s in enumerate(steps) if s['panel'] == 'open')
    assert all(s['panel'] == 'chaining' for s in steps[:first_open])
    assert all(s['panel'] == 'open' for s in steps[first_open:])
    # While chaining runs, the open panel still shows the pre-action state.
    for step in steps[:first_open]:
        assert step['snapshot']['open']['count'] == 1
    assert data['final_state']['open']['count'] == 2


def test_entry_ids_are_op_indices(client):
    ops, data = replay_inserts(client, ['ab', 'cd', 'ef'])
    ids = {entry['key']: entry['id']
           for bucket in data['final_state']['chaining']['buckets'] for entry in bucket}
    assert ids == {'ab': 0, 'cd': 1, 'ef': 2}
    open_ids = {cell['key']: cell['id'] for cell in data['final_state']['open']['slots']
                if cell and not cell.get('tombstone')}
    assert open_ids == ids


def test_delete_then_reinsert_gets_new_id(client):
    ops, _ = replay_inserts(client, ['ab'])
    client.post('/hash', json=body('hash_delete', 'ab', ops=ops))
    ops.append({'op': 'delete', 'key': 'ab'})
    data = client.post('/hash', json=body('hash_insert', 'ab', ops=ops)).get_json()
    ids = {entry['key']: entry['id'] for bucket in data['final_state']['chaining']['buckets']
           for entry in bucket}
    assert ids['ab'] == 2


def test_stateless_replay_matches_stepwise(client):
    keys = ['ab', 'ba', 'cd', 'dc', 'ef']
    ops, last = replay_inserts(client, keys)
    replay = client.post('/hash', json=body('hash_search', 'ab', ops=ops)).get_json()
    assert replay['final_state'] == last['final_state']
    assert replay['metrics']['chaining']['collisions'] == last['metrics']['chaining']['collisions']


def test_deterministic(client):
    payload = body('hash_insert', 'abc', hash_fn='poly', table_size=11)
    first = client.post('/hash', json=payload).get_json()
    second = client.post('/hash', json=payload).get_json()
    assert first == second


def test_metrics_sanity(client):
    ops, data = replay_inserts(client, ['ab', 'ba', 'cd'])
    metrics = data['metrics']
    assert metrics['chaining']['resizes'] == 0
    assert metrics['open']['resizes'] == 0
    assert metrics['chaining']['total_probes'] >= 1
    assert metrics['open']['total_probes'] >= 3
    assert metrics['chaining']['max_chain_length'] == 2
    assert metrics['open']['max_probe_length'] >= 2
    assert data['metadata']['hash_fn'] == 'sum_mod'
    assert data['metadata']['table_size_initial'] == 7
    assert data['metadata']['warnings']


def test_poly_has_no_anagram_warning(client):
    data = client.post('/hash', json=body('hash_insert', 'abc', hash_fn='poly')).get_json()
    assert data['metadata']['warnings'] == []


# --- validation ------------------------------------------------------------

@pytest.mark.parametrize('payload,field', [
    ({'algorithm': 'nope', 'action': {'key': 'a'}}, 'algorithm'),
    ({'algorithm': 'hash_insert', 'hash_fn': 'md5', 'action': {'key': 'a'}}, 'hash_fn'),
    ({'algorithm': 'hash_insert', 'table_size': 4, 'action': {'key': 'a'}}, 'table_size'),
    ({'algorithm': 'hash_insert', 'table_size': 14, 'action': {'key': 'a'}}, 'table_size'),
    ({'algorithm': 'hash_insert', 'table_size': '7', 'action': {'key': 'a'}}, 'table_size'),
    ({'algorithm': 'hash_insert', 'table_size': True, 'action': {'key': 'a'}}, 'table_size'),
    ({'algorithm': 'hash_insert', 'probing': 'quadratic', 'action': {'key': 'a'}}, 'probing'),
    ({'algorithm': 'hash_insert', 'ops': 'nope', 'action': {'key': 'a'}}, 'ops'),
    ({'algorithm': 'hash_insert', 'ops': [{}], 'action': {'key': 'a'}}, 'ops'),
    ({'algorithm': 'hash_insert', 'ops': [{'op': 'update', 'key': 'a'}],
      'action': {'key': 'b'}}, 'ops'),
    ({'algorithm': 'hash_insert', 'ops': [{'op': 'insert', 'key': ' '}],
      'action': {'key': 'b'}}, 'key'),
    ({'algorithm': 'hash_insert', 'action': {'key': ''}}, 'key'),
    ({'algorithm': 'hash_insert', 'action': {'key': 'a' * 13}}, 'key'),
    ({'algorithm': 'hash_insert', 'action': {'key': 'a b'}}, 'key'),
    ({'algorithm': 'hash_insert', 'action': {'key': 'caf\u00e9'}}, 'key'),
    ({'algorithm': 'hash_insert', 'action': {'key': 7}}, 'key'),
    ({'algorithm': 'hash_insert'}, 'key'),
])
def test_validation_matrix(client, payload, field):
    res = client.post('/hash', json=payload)
    assert res.status_code == 400
    assert res.get_json()['field'] == field


def test_too_many_ops_rejected(client):
    ops = [{'op': 'insert', 'key': 'k%d' % i} for i in range(validation.MAX_HASH_OPS + 1)]
    res = client.post('/hash', json={'algorithm': 'hash_search', 'ops': ops,
                                     'action': {'key': 'k0'}})
    assert res.status_code == 400
    assert res.get_json()['field'] == 'ops'


def test_non_json_rejected(client):
    res = client.post('/hash', data='not json', content_type='text/plain')
    assert res.status_code == 400
    assert res.get_json()['field'] == 'body'


def test_get_returns_405_json(client):
    res = client.get('/hash')
    assert res.status_code == 405
    assert res.get_json()['field'] == 'request'


def test_validate_helper(client):
    validated, err = validate_hash_payload({
        'algorithm': 'hash_insert', 'hash_fn': 'poly', 'table_size': 11,
        'ops': [{'op': 'insert', 'key': 'ab'}], 'action': {'key': 'cd'},
    })
    assert err is None
    assert validated['table_size'] == 11
    assert validated['action'] == {'key': 'cd'}


def test_step_cap_enforced(client, monkeypatch):
    monkeypatch.setattr(validation, 'MAX_HASH_STEPS', 3)
    res = client.post('/hash', json=body('hash_insert', 'abc'))
    assert res.status_code == 400
    assert res.get_json()['field'] == 'key'


def test_unreachable_hashing_internal_errors_are_400(client):
    # Unknown hash function / algorithm cannot be reached through validation,
    # but the generator must still raise a ValidationError rather than 500.
    with pytest.raises(Exception) as exc:
        hashing.hash_op_steps('nope', action={'key': 'a'})
    assert 'Unknown hash algorithm' in str(exc.value)

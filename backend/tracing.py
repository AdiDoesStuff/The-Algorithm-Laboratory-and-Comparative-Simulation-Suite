"""
tracing.py — Visual trace event generator and role mapping for simulation algorithms.
"""

from typing import Any, Dict, List

DEFAULT_ROLES = {
    'compare':              {'comparing': lambda ids: ids},
    'visit':                {'highlighted': lambda ids: ids},
    'insert':               {'new_node': lambda ids: ids},
    'delete_leaf':          {'highlighted': lambda ids: ids},
    'delete_single_child':  {'highlighted': lambda ids: ids},
    'delete_two_children':  {'highlighted': lambda ids: ids},
    'delete_done':          {'highlighted': lambda ids: ids},
    'create_node':          {'new_node': lambda ids: ids},
    'reuse_node':           {'highlighted': lambda ids: ids},
    'hash_compute':         {'highlighted': lambda ids: ids},
    'mismatch':             {'mismatch': lambda ids: ids},
    'expand':               {'highlighted': lambda ids: ids},
    'prune':                {'pruned': lambda ids: ids},
    'call':                 {'new_node': lambda ids: ids},
    'probe':                {'comparing': lambda ids: ids},
    'dp_fill':              {'new_node': lambda ids: ids},
    'select':               {'selected': lambda ids: ids},
    # Heap steps (Phase C)
    'append':               {'new_node': lambda ids: ids},
    'swap':                 {'swapping': lambda ids: ids},
    'insert_done':          {'highlighted': lambda ids: ids},
    'extract_root':         {'selected': lambda ids: ids},
    'remove_last':          {'highlighted': lambda ids: ids},
    'extract_done':         {'highlighted': lambda ids: ids},
    'build_start':          {'highlighted': lambda ids: ids},
    'heapify_node_done':    {'selected': lambda ids: ids},
    'build_done':           {'highlighted': lambda ids: ids},
    'mark_sorted':          {'sorted': lambda ids: ids},
    'heapsort_done':        {'sorted': lambda ids: ids},
    # AVL steps (Phase C)
    'balance_update':       {'highlighted': lambda ids: ids},
    'unbalanced':           {'unbalanced': lambda ids: ids},
    'rotate_LL':            {'rotating': lambda ids: ids},
    'rotate_RR':            {'rotating': lambda ids: ids},
    'rotate_LR':            {'rotating': lambda ids: ids},
    'rotate_RL':            {'rotating': lambda ids: ids},
    'rotation_done':        {'highlighted': lambda ids: ids},
    # Mirror / structural comparison steps (dual-snapshot; roles are _a/_b suffixed)
    'mirror_compare':       {},   # roles in comparing_a / comparing_b
    'struct_compare':       {},   # same shape, identical mode
    'mirror_match':         {},   # roles in matched_a / matched_b
    'mirror_mismatch':      {},   # roles in mismatch_a / mismatch_b
    # Trie steps (Phase D)
    'node_created':         {'created': lambda ids: ids},
    'node_reused':          {'reused': lambda ids: ids},
    'mark_end':             {'selected': lambda ids: ids},
    'match':                {'matched': lambda ids: ids},
    'no_match':             {},
    'found':                {'selected': lambda ids: ids},
    'not_found':            {},
    'search_done':          {},
    'prefix_matched':       {'selected': lambda ids: ids},
    'prefix_done':          {},
    'prefix_missing':       {},
    # Hashing steps (Phase D; panel-suffixed roles arrive via **extra)
    'chain_compare':        {'probing': lambda ids: ids},
    'chain_append':         {'created': lambda ids: ids},
    'chain_remove':         {},
    'place':                {'created': lambda ids: ids},
    'tombstone':            {},
    'resize_start':         {},
    'rehash_move':          {'highlighted': lambda ids: ids},
    'resize_done':          {},
    'hash_insert_done':     {},
    'hash_delete_done':     {},
    'hash_search_done':     {},
    # Merkle steps (Phase D)
    'leaf_hash':            {'highlighted': lambda ids: ids},
    'pair_hash':            {'highlighted': lambda ids: ids},
    'duplicate_last':       {'created': lambda ids: ids},
    'level_done':           {},
    'root_ready':           {'selected': lambda ids: ids},
    'tamper_edit':          {'mismatch': lambda ids: ids},
    'recompute':            {'highlighted': lambda ids: ids},
    'root_compare':         {},
    'tamper_done':          {},
}


def make_step(step_type: str, node_ids: List[Any], snapshot: Dict[str, Any], note: str, **extra) -> Dict[str, Any]:
    """
    Standard step generator mapping semantic event types to visual role arrays.
    """
    roles = {
        'highlighted': [],
        'comparing': [],
        'rotating': [],
        'pruned': [],
        'new_node': [],
        'selected': [],
        'created': [],
        'reused': [],
        'matched': [],
        'probing': [],
        'mismatch': []
    }
    rule = DEFAULT_ROLES.get(step_type)
    if rule:
        for role_name, fn in rule.items():
            roles[role_name] = fn(node_ids)

    step = {
        'type': step_type,
        'snapshot': snapshot,
        'annotation': note,
        **roles,
        **extra
    }
    return step

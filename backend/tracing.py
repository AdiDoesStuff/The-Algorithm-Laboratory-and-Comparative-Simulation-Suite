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
    'mismatch':             {'pruned': lambda ids: ids},
    'expand':               {'highlighted': lambda ids: ids},
    'prune':                {'pruned': lambda ids: ids},
    'call':                 {'new_node': lambda ids: ids},
    'probe':                {'comparing': lambda ids: ids},
    'dp_fill':              {'new_node': lambda ids: ids},
    'select':               {'selected': lambda ids: ids},
    # Mirror / structural comparison steps (dual-snapshot; roles are _a/_b suffixed)
    'mirror_compare':       {},   # roles in comparing_a / comparing_b
    'struct_compare':       {},   # same shape, identical mode
    'mirror_match':         {},   # roles in matched_a / matched_b
    'mirror_mismatch':      {},   # roles in mismatch_a / mismatch_b
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
        'selected': []
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

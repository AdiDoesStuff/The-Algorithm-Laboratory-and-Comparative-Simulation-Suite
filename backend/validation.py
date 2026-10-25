"""
validation.py — Request validation helpers for tree and simulation endpoints.
"""

from typing import Any, Dict, List, Optional, Tuple

VALID_TREE_ALGORITHMS = {
    'bst_insert',
    'bst_delete',
    'bst_traverse',
    'bst_classify',
    'bst_height_depth',
    'array_to_tree',
    'heap_insert',
    'avl_insert',
}

VALID_TRAVERSAL_ORDERS = {'inorder', 'preorder', 'postorder', 'level'}
VALID_TREE_TYPES = {'bst', 'binary'}


class ValidationError(Exception):
    def __init__(self, message: str, field: str = "body", status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.field = field
        self.status_code = status_code


def validate_tree_payload(data: Any) -> Tuple[Optional[Dict[str, Any]], Optional[Tuple[str, str]]]:
    """
    Validates request payload for /tree endpoint.
    Returns (validated_data_dict, (error_message, field_name)).
    Guarantees no invalid input can cause an internal 500 error.
    """
    if not isinstance(data, dict):
        return None, ("Request body must be a JSON object", "body")

    algo = data.get('algorithm')
    if not algo or not isinstance(algo, str):
        return None, ("Missing or invalid 'algorithm' field", "algorithm")

    if algo not in VALID_TREE_ALGORITHMS:
        return None, (f"Unknown tree algorithm: {algo}", "algorithm")

    tree_type = data.get('tree_type', 'bst')
    if not isinstance(tree_type, str) or tree_type not in VALID_TREE_TYPES:
        return None, (f"Invalid 'tree_type': {tree_type}, must be 'bst' or 'binary'", "tree_type")

    validated: Dict[str, Any] = {
        'algorithm': algo,
        'tree_type': tree_type
    }

    # Binary mode rule:
    # "The op log cannot represent null holes, so binary mode must take an `array` field, not `ops`.
    # Make the validator reject ops with tree_type='binary'."
    if tree_type == 'binary':
        if 'ops' in data and data['ops'] is not None:
            return None, ("Binary mode does not accept 'ops'; provide 'array' instead", "ops")
        if 'values' in data and data['values'] is not None:
            return None, ("Binary mode does not accept 'values'; provide 'array' instead", "values")

        if algo != 'array_to_tree':
            if 'array' not in data or not isinstance(data['array'], list):
                return None, ("Missing or invalid 'array' field for binary mode", "array")
            validated['array'] = data['array']

    if algo == 'array_to_tree':
        if 'array' not in data or not isinstance(data['array'], list):
            return None, ("Missing or invalid 'array' field", "array")
        validated['array'] = data['array']

    # BST / Heap / AVL mode: normalize ops or legacy values shim
    current_tree_vals = set()
    if tree_type == 'bst' and algo != 'array_to_tree':
        if 'ops' in data and data['ops'] is not None:
            if not isinstance(data['ops'], list):
                return None, ("'ops' field must be a list", "ops")
            ops = []
            for i, item in enumerate(data['ops']):
                if not isinstance(item, dict):
                    return None, (f"'ops[{i}]' must be an object with 'op' and 'value'", "ops")
                op_name = item.get('op')
                if op_name not in ('insert', 'delete'):
                    return None, (f"Invalid op '{op_name}' in ops[{i}]: expected 'insert' or 'delete'", "ops")
                val = item.get('value')
                if val is None or isinstance(val, bool):
                    return None, (f"Missing or invalid integer 'value' in ops[{i}]", "ops")
                try:
                    int_v = int(val)
                except (ValueError, TypeError):
                    return None, (f"Non-integer value in ops[{i}]: {val}", "ops")
                ops.append({'op': op_name, 'value': int_v})
            validated['ops'] = ops

            # Check duplicate inserts in ops
            for i, op in enumerate(validated['ops']):
                if op['op'] == 'insert':
                    if op['value'] in current_tree_vals:
                        return None, (f"Duplicate insert value {op['value']} in ops at index {i}", "ops")
                    current_tree_vals.add(op['value'])
                elif op['op'] == 'delete':
                    current_tree_vals.discard(op['value'])

        elif 'values' in data and data['values'] is not None:
            if not isinstance(data['values'], list):
                return None, ("'values' field must be a list", "values")
            ops = []
            for i, v in enumerate(data['values']):
                if v is None or isinstance(v, bool):
                    return None, (f"Invalid value in values[{i}]: expected integer", "values")
                try:
                    int_v = int(v)
                except (ValueError, TypeError):
                    return None, (f"Invalid non-integer in values[{i}]: {v}", "values")
                if int_v in current_tree_vals:
                    return None, (f"Duplicate insert value {int_v} in values at index {i}", "values")
                current_tree_vals.add(int_v)
                ops.append({'op': 'insert', 'value': int_v})
            validated['ops'] = ops
        else:
            validated['ops'] = []

    # Algorithm-specific parameter validation
    if algo == 'bst_insert':
        new_val = data.get('new_value')
        if new_val is None or isinstance(new_val, bool):
            return None, ("Missing or invalid 'new_value': integer required", "new_value")
        try:
            int_val = int(new_val)
        except (ValueError, TypeError):
            return None, (f"Invalid 'new_value': {new_val} is not an integer", "new_value")
        if int_val in current_tree_vals:
            return None, (f"Duplicate value: {int_val} already exists in the tree", "new_value")
        validated['new_value'] = int_val

    elif algo == 'bst_delete':
        del_val = data.get('delete_value')
        if del_val is None or isinstance(del_val, bool):
            return None, ("Missing or invalid 'delete_value': integer required", "delete_value")
        try:
            int_del = int(del_val)
        except (ValueError, TypeError):
            return None, (f"Invalid 'delete_value': {del_val} is not an integer", "delete_value")

        if int_del not in current_tree_vals:
            return None, (f"Value {int_del} not found in tree to delete", "delete_value")
        validated['delete_value'] = int_del

    elif algo == 'bst_traverse':
        order = data.get('order', 'inorder')
        if not isinstance(order, str) or order not in VALID_TRAVERSAL_ORDERS:
            return None, (f"Invalid traversal order: {order}", "order")
        validated['order'] = order

    elif algo == 'bst_height_depth':
        t_id = data.get('target_id')
        t_val = data.get('target_value')

        if t_id is not None:
            if isinstance(t_id, bool):
                return None, ("Invalid 'target_id': integer required", "target_id")
            try:
                validated['target_id'] = int(t_id)
            except (ValueError, TypeError):
                return None, (f"Invalid 'target_id': {t_id} is not an integer", "target_id")
            if t_val is not None and not isinstance(t_val, bool):
                try:
                    validated['target_value'] = int(t_val)
                except (ValueError, TypeError):
                    validated['target_value'] = None
            else:
                validated['target_value'] = None
        else:
            if t_val is None or isinstance(t_val, bool):
                return None, ("Missing or invalid 'target_value': integer required", "target_value")
            try:
                validated['target_value'] = int(t_val)
            except (ValueError, TypeError):
                return None, (f"Invalid 'target_value': {t_val} is not an integer", "target_value")
            validated['target_id'] = None

    return validated, None

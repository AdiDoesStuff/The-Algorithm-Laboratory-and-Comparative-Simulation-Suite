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
    'bst_mirror',
    'heap_insert',
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

    # --- bst_mirror: completely different payload shape, handled up-front ---
    if algo == 'bst_mirror':
        mode = data.get('mode', 'mirror')
        if mode not in ('mirror', 'identical'):
            return None, (f"Invalid 'mode': '{mode}'; must be 'mirror' or 'identical'", "mode")
        validated['mode'] = mode

        for key in ('tree_a', 'tree_b'):
            spec = data.get(key)
            if not isinstance(spec, dict):
                return None, (f"Missing or invalid '{key}': must be an object with tree_type and ops/array", key)
            tt = spec.get('tree_type', 'bst')
            if tt not in ('bst', 'binary'):
                return None, (f"Invalid tree_type in {key}: must be 'bst' or 'binary'", key)
            if tt == 'binary':
                if 'array' not in spec or not isinstance(spec['array'], list):
                    return None, (f"{key} with tree_type='binary' requires an 'array' list", key)
            else:
                if 'values' in spec and spec['values'] is not None:
                    return None, (f"{key}.values is no longer supported; pass ops instead", f"{key}.values")
                ops_field = spec.get('ops', [])
                if not isinstance(ops_field, list):
                    return None, (f"{key}.ops must be a list", key)
            validated[key] = spec
        return validated, None

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

    # BST / Heap / AVL mode: normalize ops
    current_tree_vals = set()
    if tree_type == 'bst' and algo != 'array_to_tree':
        if 'values' in data and data['values'] is not None:
            return None, ("'values' is no longer supported; pass 'ops' with insert entries instead", "values")
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


# --- Heap endpoint validation (/heap) ---

VALID_HEAP_ALGORITHMS = {'heap_op', 'heapsort'}
VALID_HEAP_TYPES = {'min', 'max'}
MAX_HEAP_SIZE = 31
MAX_HEAP_STEPS = 1000


def _parse_heap_op(item: Any, where: str, field: str):
    """Parses one heap op. Returns (op_dict, None) or (None, (message, field))."""
    if not isinstance(item, dict):
        return None, (f"{where} must be an object with an 'op' field", field)

    name = item.get('op')
    if name == 'insert':
        value = item.get('value')
        if isinstance(value, bool) or not isinstance(value, int):
            return None, (f"{where}.value must be an integer", field)
        return {'op': 'insert', 'value': value}, None

    if name == 'extract':
        return {'op': 'extract'}, None

    if name == 'build':
        values = item.get('values')
        if not isinstance(values, list):
            return None, (f"{where}.values must be a list of integers", field)
        if len(values) > MAX_HEAP_SIZE:
            return None, (f"{where}.values supports at most {MAX_HEAP_SIZE} values", field)
        cleaned = []
        for i, value in enumerate(values):
            if isinstance(value, bool) or not isinstance(value, int):
                return None, (f"{where}.values[{i}] must be an integer", field)
            cleaned.append(value)
        return {'op': 'build', 'values': cleaned}, None

    return None, (f"Invalid heap op '{name}' in {where}: expected 'insert', 'extract', or 'build'", field)


def validate_heap_payload(data: Any) -> Tuple[Optional[Dict[str, Any]], Optional[Tuple[str, str]]]:
    """
    Validates a POST /heap payload.
    Returns (validated_data_dict, (error_message, field_name)).
    Never raises, so no invalid input can reach a 500.
    """
    if not isinstance(data, dict):
        return None, ("Request body must be a JSON object", "body")

    algo = data.get('algorithm')
    if not isinstance(algo, str) or algo not in VALID_HEAP_ALGORITHMS:
        return None, (f"Unknown heap algorithm: {algo}", "algorithm")

    heap_type = data.get('heap_type', 'min')
    if not isinstance(heap_type, str) or heap_type not in VALID_HEAP_TYPES:
        return None, (f"Invalid 'heap_type': {heap_type}; must be 'min' or 'max'", "heap_type")

    validated: Dict[str, Any] = {'algorithm': algo, 'heap_type': heap_type}

    if algo == 'heapsort':
        if 'ops' in data or 'action' in data:
            return None, ("heapsort takes an 'array', not 'ops' or 'action'", "ops")
        array = data.get('array')
        if not isinstance(array, list):
            return None, ("Missing or invalid 'array': a list of integers is required", "array")
        if len(array) > MAX_HEAP_SIZE:
            return None, (f"'array' supports at most {MAX_HEAP_SIZE} values", "array")
        cleaned = []
        for i, value in enumerate(array):
            if isinstance(value, bool) or not isinstance(value, int):
                return None, (f"'array'[{i}] must be an integer", "array")
            cleaned.append(value)
        validated['array'] = cleaned
        return validated, None

    raw_ops = data.get('ops', [])
    if raw_ops is None:
        raw_ops = []
    if not isinstance(raw_ops, list):
        return None, ("'ops' must be a list", "ops")
    if len(raw_ops) > MAX_HEAP_SIZE * 4:
        return None, (f"'ops' supports at most {MAX_HEAP_SIZE * 4} entries", "ops")

    ops = []
    size = 0
    for i, item in enumerate(raw_ops):
        parsed, err = _parse_heap_op(item, f"ops[{i}]", "ops")
        if err:
            return None, err
        if parsed['op'] == 'build':
            if i != 0:
                return None, ("'build' is only allowed as the first op", "ops")
            size = len(parsed['values'])
        elif parsed['op'] == 'insert':
            size += 1
        elif parsed['op'] == 'extract':
            if size == 0:
                return None, (f"ops[{i}] extracts from an empty heap", "ops")
            size -= 1
        if size > MAX_HEAP_SIZE:
            return None, (f"Heap supports at most {MAX_HEAP_SIZE} elements", "ops")
        ops.append(parsed)
    validated['ops'] = ops

    action = data.get('action')
    if action is not None:
        parsed, err = _parse_heap_op(action, 'action', 'action')
        if err:
            return None, err
        if parsed['op'] == 'build':
            if ops:
                return None, ("'build' is only allowed on an empty heap", "action")
            if len(parsed['values']) > MAX_HEAP_SIZE:
                return None, (f"Heap supports at most {MAX_HEAP_SIZE} elements", "action")
        elif parsed['op'] == 'insert':
            if size + 1 > MAX_HEAP_SIZE:
                return None, (f"Heap supports at most {MAX_HEAP_SIZE} elements", "action")
        elif parsed['op'] == 'extract':
            if size == 0:
                return None, ("Cannot extract from an empty heap", "action")
        validated['action'] = parsed

    return validated, None


# --- AVL endpoint validation (/avl) ---

VALID_AVL_ALGORITHMS = {'avl_insert', 'avl_delete', 'avl_replay'}
MAX_AVL_OPS = 64
MAX_AVL_STEPS = 1000


def validate_avl_payload(data: Any) -> Tuple[Optional[Dict[str, Any]], Optional[Tuple[str, str]]]:
    """
    Validates a POST /avl payload. The op log must be internally consistent:
    an insert cannot duplicate a live value and a delete must target one.
    Never raises, so no invalid input can reach a 500.
    """
    if not isinstance(data, dict):
        return None, ("Request body must be a JSON object", "body")

    algo = data.get('algorithm')
    if not isinstance(algo, str) or algo not in VALID_AVL_ALGORITHMS:
        return None, (f"Unknown AVL algorithm: {algo}", "algorithm")

    raw_ops = data.get('ops', [])
    if raw_ops is None:
        raw_ops = []
    if not isinstance(raw_ops, list):
        return None, ("'ops' must be a list", "ops")
    if len(raw_ops) > MAX_AVL_OPS:
        return None, (f"'ops' supports at most {MAX_AVL_OPS} entries", "ops")

    ops = []
    present = set()
    for i, item in enumerate(raw_ops):
        if not isinstance(item, dict):
            return None, (f"'ops[{i}]' must be an object with 'op' and 'value'", "ops")
        name = item.get('op')
        value = item.get('value')
        if name not in ('insert', 'delete'):
            return None, (
                f"Invalid op '{name}' in ops[{i}]: expected 'insert' or 'delete'",
                "ops"
            )
        if isinstance(value, bool) or not isinstance(value, int):
            return None, (f"Missing or invalid integer 'value' in ops[{i}]", "ops")
        if name == 'insert':
            if value in present:
                return None, (f"Duplicate insert value {value} in ops at index {i}", "ops")
            present.add(value)
        else:
            if value not in present:
                return None, (
                    f"ops[{i}] deletes {value}, which is not in the tree at that point",
                    "ops"
                )
            present.remove(value)
        ops.append({'op': name, 'value': value})

    validated: Dict[str, Any] = {'algorithm': algo, 'ops': ops}

    if algo != 'avl_replay':
        value = data.get('value')
        if isinstance(value, bool) or not isinstance(value, int):
            return None, ("Missing or invalid 'value': integer required", "value")
        if algo == 'avl_insert' and value in present:
            return None, (f"Duplicate value: {value} already exists in the tree", "value")
        if algo == 'avl_delete' and value not in present:
            return None, (f"Value {value} not found in tree to delete", "value")
        validated['value'] = value

    return validated, None


# --- Trie endpoint validation (/trie) ---

VALID_TRIE_ALGORITHMS = {"trie_insert", "trie_search", "trie_prefix"}
MAX_TRIE_WORDS = 30
MAX_TRIE_NODES = 200
MAX_TRIE_WORD_LEN = 12
MAX_TRIE_STEPS = 500
TRIE_WORD_RE = __import__("re").compile(r"^[a-z]+$")


def _normalize_trie_text(raw, field, allow_empty=False):
    if not isinstance(raw, str):
        return None, (f"'{field}' must be a string", field)
    text = raw.lower()
    if text == "":
        if allow_empty:
            return "", None
        return None, (f"'{field}' must not be empty", field)
    if len(text) > MAX_TRIE_WORD_LEN:
        return None, (f"'{field}' supports at most {MAX_TRIE_WORD_LEN} letters", field)
    if not TRIE_WORD_RE.match(text):
        return None, (f"'{field}' must contain only a-z letters", field)
    return text, None


def validate_trie_payload(data):
    if not isinstance(data, dict):
        return None, ("Request body must be a JSON object", "body")

    algo = data.get("algorithm")
    if not isinstance(algo, str) or algo not in VALID_TRIE_ALGORITHMS:
        return None, (f"Unknown trie algorithm: {algo}", "algorithm")

    raw_ops = data.get("ops", [])
    if raw_ops is None:
        raw_ops = []
    if not isinstance(raw_ops, list):
        return None, ("'ops' must be a list", "ops")
    if len(raw_ops) > MAX_TRIE_WORDS:
        return None, (f"'ops' supports at most {MAX_TRIE_WORDS} words", "ops")

    ops = []
    words = set()
    prefixes = set()
    for i, item in enumerate(raw_ops):
        if not isinstance(item, dict):
            return None, (f"'ops[{i}]' must be an object with 'op' and 'word'", "ops")
        if item.get("op") != "insert":
            return None, (f"Invalid op '{item.get('op')}' in ops[{i}]: expected 'insert'", "ops")
        word, err = _normalize_trie_text(item.get("word"), f"ops[{i}].word")
        if err:
            return None, err
        if word in words:
            return None, (f"Duplicate insert word '{word}' in ops at index {i}", "ops")
        words.add(word)
        for j in range(1, len(word) + 1):
            prefixes.add(word[:j])
        ops.append({"op": "insert", "word": word})

    if len(prefixes) + 1 > MAX_TRIE_NODES:
        return None, (f"Trie would exceed {MAX_TRIE_NODES} nodes", "word")

    validated = {"algorithm": algo, "ops": ops}

    if algo == "trie_prefix":
        prefix, err = _normalize_trie_text(data.get("prefix"), "prefix", allow_empty=True)
        if err:
            return None, err
        validated["prefix"] = prefix
    else:
        word, err = _normalize_trie_text(data.get("word"), "word")
        if err:
            return None, err
        if algo == "trie_insert" and word in words:
            return None, (f"Duplicate word: {word} already exists", "word")
        validated["word"] = word

    return validated, None


# --- Hash endpoint validation (/hash) ---

VALID_HASH_ALGORITHMS = {"hash_insert", "hash_delete", "hash_search"}
VALID_HASH_FUNCTIONS = {"sum_mod", "poly"}
VALID_HASH_PROBING = {"linear"}
MIN_INITIAL_TABLE_SIZE = 5
MAX_INITIAL_TABLE_SIZE = 13
MAX_TABLE_SIZE = 63
MAX_HASH_OPS = 100
MAX_LIVE_KEYS = 40
MAX_HASH_STEPS = 2000
MAX_HASH_KEY_LEN = 12


def _validate_hash_key(raw: Any):
    if not isinstance(raw, str):
        return None, "'key' must be a string"
    if not 1 <= len(raw) <= MAX_HASH_KEY_LEN:
        return None, f"'key' must be 1-{MAX_HASH_KEY_LEN} characters"
    for ch in raw:
        code = ord(ch)
        if code < 33 or code > 126:
            return None, "'key' must use printable ASCII without whitespace"
    return raw, None


def validate_hash_payload(data: Any) -> Tuple[Optional[Dict[str, Any]], Optional[Tuple[str, str]]]:
    if not isinstance(data, dict):
        return None, ("Request body must be a JSON object", "body")

    algo = data.get("algorithm")
    if not isinstance(algo, str) or algo not in VALID_HASH_ALGORITHMS:
        return None, (f"Unknown hash algorithm: {algo}", "algorithm")

    hash_fn = data.get("hash_fn", "sum_mod")
    if not isinstance(hash_fn, str) or hash_fn not in VALID_HASH_FUNCTIONS:
        return None, (f"Unknown hash function: {hash_fn}", "hash_fn")

    table_size = data.get("table_size", 7)
    if (not isinstance(table_size, int) or isinstance(table_size, bool)
            or not MIN_INITIAL_TABLE_SIZE <= table_size <= MAX_INITIAL_TABLE_SIZE):
        return None, (
            f"'table_size' must be an integer from {MIN_INITIAL_TABLE_SIZE} to "
            f"{MAX_INITIAL_TABLE_SIZE}", "table_size")

    probing = data.get("probing", "linear")
    if not isinstance(probing, str) or probing not in VALID_HASH_PROBING:
        return None, (f"Unknown probing strategy: {probing}", "probing")

    raw_ops = data.get("ops", [])
    if raw_ops is None:
        raw_ops = []
    if not isinstance(raw_ops, list):
        return None, ("'ops' must be a list", "ops")
    if len(raw_ops) > MAX_HASH_OPS:
        return None, (f"'ops' supports at most {MAX_HASH_OPS} operations", "ops")

    ops = []
    for i, item in enumerate(raw_ops):
        if not isinstance(item, dict):
            return None, (f"'ops[{i}]' must be an object with 'op' and 'key'", "ops")
        op_name = item.get("op")
        if op_name not in ("insert", "delete"):
            return None, (f"Invalid op '{op_name}' in ops[{i}]", "ops")
        key, err = _validate_hash_key(item.get("key"))
        if err:
            return None, (err, "key")
        ops.append({"op": op_name, "key": key})

    key, err = _validate_hash_key(_hash_action_key(data.get("action")))
    if err:
        return None, (err, "key")

    return {
        "algorithm": algo,
        "hash_fn": hash_fn,
        "table_size": table_size,
        "probing": probing,
        "ops": ops,
        "action": {"key": key},
    }, None


def _hash_action_key(action: Any) -> Any:
    if isinstance(action, dict):
        return action.get("key")
    return action


# --- Merkle endpoint validation (/merkle) ---

VALID_MERKLE_ALGORITHMS = {"merkle_build", "merkle_tamper"}
MAX_MERKLE_LEAVES = 16
MAX_MERKLE_DATA_LEN = 40
MAX_MERKLE_STEPS = 2000


def validate_merkle_payload(data: Any) -> Tuple[Optional[Dict[str, Any]], Optional[Tuple[str, str]]]:
    if not isinstance(data, dict):
        return None, ("Request body must be a JSON object", "body")

    algo = data.get("algorithm")
    if not isinstance(algo, str) or algo not in VALID_MERKLE_ALGORITHMS:
        return None, (f"Unknown Merkle algorithm: {algo}", "algorithm")

    leaves = data.get("leaves")
    if not isinstance(leaves, list):
        return None, ("'leaves' must be a list", "leaves")
    if not 1 <= len(leaves) <= MAX_MERKLE_LEAVES:
        return None, (f"'leaves' must contain 1-{MAX_MERKLE_LEAVES} blocks", "leaves")
    clean_leaves = []
    for i, leaf in enumerate(leaves):
        if not isinstance(leaf, str):
            return None, (f"'leaves[{i}]' must be a string", "leaves")
        if len(leaf) > MAX_MERKLE_DATA_LEN:
            return None, (
                f"'leaves[{i}]' supports at most {MAX_MERKLE_DATA_LEN} characters", "leaves")
        clean_leaves.append(leaf)

    validated = {"algorithm": algo, "leaves": clean_leaves}

    if algo == "merkle_tamper":
        index = data.get("index")
        if (not isinstance(index, int) or isinstance(index, bool)
                or not 0 <= index < len(clean_leaves)):
            return None, (
                f"'index' must be an integer from 0 to {len(clean_leaves) - 1}", "index")
        new_data = data.get("new_data")
        if not isinstance(new_data, str):
            return None, ("'new_data' must be a string", "new_data")
        if len(new_data) > MAX_MERKLE_DATA_LEN:
            return None, (
                f"'new_data' supports at most {MAX_MERKLE_DATA_LEN} characters", "new_data")
        validated["index"] = index
        validated["new_data"] = new_data

    return validated, None

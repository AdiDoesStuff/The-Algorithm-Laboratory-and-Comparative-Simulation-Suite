"""
trees.py — Backend execution trace generators for tree, trie, hash, and algorithmic design structures.
"""

from typing import Any, Dict, List, Optional, Tuple
from collections import deque

from tracing import make_step, DEFAULT_ROLES
import validation
from validation import validate_tree_payload, ValidationError


# --- Unit 1: BST Data Structure & Helpers ---

class Node:
    def __init__(self, value: int, node_id: Optional[int] = None):
        self.id = node_id if node_id is not None else 0
        self.value = value
        self.left: Optional['Node'] = None
        self.right: Optional['Node'] = None


def serialize_tree(root: Optional[Node]) -> Dict[str, Any]:
    nodes = []

    def walk(node: Optional[Node], parent_id: Optional[int] = None, side: Optional[str] = None):
        if node is None:
            return
        nodes.append({
            'id': node.id,
            'label': str(node.value),
            'sublabel': None,
            'parent_id': parent_id,
            'side': side
        })
        walk(node.left, node.id, 'left')
        walk(node.right, node.id, 'right')

    walk(root)
    return {'nodes': nodes, 'root_id': root.id if root else None}


def normalize_ops(ops: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    """
    Normalizes input to standard op-log shape: [{'op': 'insert'|'delete', 'value': int}].
    """
    if ops is None:
        return []

    normalized = []
    for op in ops:
        if not isinstance(op, dict) or 'op' not in op or 'value' not in op:
            raise ValueError("Each op must be a dict with 'op' and 'value'")
        if op['op'] not in ('insert', 'delete'):
            raise ValueError(f"Unknown op type: {op['op']}")
        normalized.append({'op': op['op'], 'value': int(op['value'])})
    return normalized


def _insert_node(root: Optional[Node], value: int, node_id: int) -> Node:
    """Inserts a new node with explicit node_id; raises ValidationError on duplicates."""
    if root is None:
        return Node(value, node_id=node_id)
    if value == root.value:
        raise ValidationError(f"Duplicate value: {value} already exists in the tree", field="new_value", status_code=400)
    if value < root.value:
        root.left = _insert_node(root.left, value, node_id)
    else:
        root.right = _insert_node(root.right, value, node_id)
    return root


def _delete_node_relink(root: Optional[Node], delete_val: int) -> Optional[Node]:
    """
    Deletes node with delete_val from tree.
    For two-child deletion, relinks the in-order successor node directly into the target position,
    preserving the successor's original node ID.
    Raises ValidationError if delete_val is not found in tree.
    """
    if root is None:
        raise ValidationError(f"Value {delete_val} not found in tree to delete", field="delete_value", status_code=400)

    parent = None
    side = None
    current = root

    while current and current.value != delete_val:
        parent = current
        if delete_val < current.value:
            side = 'left'
            current = current.left
        else:
            side = 'right'
            current = current.right

    if current is None:
        raise ValidationError(f"Value {delete_val} not found in tree to delete", field="delete_value", status_code=400)

    # Case 1: Leaf
    if current.left is None and current.right is None:
        if parent is None:
            return None
        if side == 'left':
            parent.left = None
        else:
            parent.right = None
        return root

    # Case 2: Single child
    if current.left is None or current.right is None:
        child = current.left if current.left is not None else current.right
        if parent is None:
            return child
        if side == 'left':
            parent.left = child
        else:
            parent.right = child
        return root

    # Case 3: Two children — in-order successor relinking
    succ_parent = current
    successor = current.right
    while successor.left is not None:
        succ_parent = successor
        successor = successor.left

    if succ_parent != current:
        succ_parent.left = successor.right
        successor.right = current.right
    successor.left = current.left

    if parent is None:
        root = successor
    elif side == 'left':
        parent.left = successor
    else:
        parent.right = successor

    return root


def _replay_ops(ops: List[Dict[str, Any]]) -> Optional[Node]:
    """
    Statelessly replays an op-log.
    Node IDs are assigned strictly as the index of the inserting op.
    """
    root = None
    for idx, op in enumerate(ops):
        op_name = op.get('op')
        val = op.get('value')
        if op_name == 'insert':
            root = _insert_node(root, val, node_id=idx)
        elif op_name == 'delete':
            root = _delete_node_relink(root, val)
    return root


def _parse_binary_array(arr: List[Any]) -> Tuple[List[Optional[int]], List[str]]:
    """
    Enforces the hole policy for binary arrays:
    For node at index i: left child = 2i + 1, right child = 2i + 2.
    Orphaned descendants of a null slot are dropped and noted in warnings.
    """
    warnings = []
    if not arr:
        return [], warnings

    parsed: List[Optional[int]] = []
    for item in arr:
        if item is None or str(item).strip().lower() in ('null', 'none', 'n/a', ''):
            parsed.append(None)
        else:
            try:
                parsed.append(int(item))
            except (ValueError, TypeError):
                parsed.append(None)

    valid_indices = set()
    cleaned: List[Optional[int]] = [None] * len(parsed)

    for i in range(len(parsed)):
        val = parsed[i]
        if val is None:
            continue
        if i == 0:
            valid_indices.add(0)
            cleaned[0] = val
        else:
            parent_i = (i - 1) // 2
            if parent_i in valid_indices:
                valid_indices.add(i)
                cleaned[i] = val
            else:
                warnings.append(
                    f"Orphaned descendant array[{i}] = {val} dropped because ancestor at array[{parent_i}] is null"
                )

    return cleaned, warnings


def _build_binary_tree_from_cleaned(cleaned: List[Optional[int]]) -> Optional[Node]:
    if not cleaned or cleaned[0] is None:
        return None

    nodes = [Node(val, node_id=i) if val is not None else None for i, val in enumerate(cleaned)]
    for i in range(len(cleaned)):
        curr = nodes[i]
        if curr is None:
            continue
        left_i = 2 * i + 1
        right_i = 2 * i + 2
        if left_i < len(cleaned) and nodes[left_i] is not None:
            curr.left = nodes[left_i]
        if right_i < len(cleaned) and nodes[right_i] is not None:
            curr.right = nodes[right_i]

    return nodes[0]


def _build_tree(ops_or_array: Any, tree_type: str = 'bst') -> Tuple[Optional[Node], List[str]]:
    """
    Builds tree from either ops (for bst) or array (for binary).
    Returns (root_node, warnings_list).
    """
    warnings = []
    if tree_type == 'binary':
        if isinstance(ops_or_array, list):
            cleaned, warnings = _parse_binary_array(ops_or_array)
            return _build_binary_tree_from_cleaned(cleaned), warnings
        return None, warnings

    # BST mode
    if isinstance(ops_or_array, list):
        ops = normalize_ops(ops=ops_or_array)
    else:
        ops = []

    return _replay_ops(ops), warnings


# --- BST Operations Step Generators ---

def bst_insert_steps(ops_or_array: Any, new_value: int) -> Dict[str, Any]:
    """Generates execution steps for inserting new_value into a BST built from ops_or_array.
    Each compare step carries payload['path']: list of ancestor node ids visited so far (root first).
    The final insert step carries the full ancestor path so the canvas keeps the route highlighted.
    """
    if isinstance(ops_or_array, list):
        ops = normalize_ops(ops=ops_or_array)
    else:
        ops = []

    root = _replay_ops(ops)
    steps = []

    # Check for duplicate value
    curr_check = root
    while curr_check:
        if curr_check.value == new_value:
            raise ValidationError(f"Duplicate value: {new_value} already exists in the tree", field="new_value", status_code=400)
        curr_check = curr_check.left if new_value < curr_check.value else curr_check.right

    new_node_id = len(ops)
    new_node = Node(new_value, node_id=new_node_id)

    if root is None:
        root = new_node
        steps.append(make_step('insert', [new_node.id], serialize_tree(root),
                               f"Inserted {new_value} as root node",
                               payload={'path': []}))
        return {"steps": steps, "final_tree": serialize_tree(root)}

    current = root
    parent = None
    side = None
    path_ids: List[int] = []  # ancestor node IDs visited so far, root first

    while current is not None:
        path_ids.append(current.id)
        direction = "left" if new_value < current.value else "right"
        steps.append(make_step(
            'compare', [current.id], serialize_tree(root),
            f"Comparing {new_value} with node {current.value}: {new_value} {'<' if new_value < current.value else '>'} {current.value} → go {direction}",
            payload={'path': list(path_ids)}
        ))
        parent = current
        if new_value < current.value:
            side = 'left'
            current = current.left
        else:
            side = 'right'
            current = current.right

    if side == 'left':
        parent.left = new_node
    else:
        parent.right = new_node

    # Final insert step: full ancestor path highlighted; new node in new_node role
    steps.append(make_step('insert', [new_node.id], serialize_tree(root),
                           f"Inserted {new_value} as {side} child of {parent.value}",
                           payload={'path': list(path_ids)}))
    return {"steps": steps, "final_tree": serialize_tree(root)}


def array_to_binary_tree_steps(arr: List[Any]) -> Dict[str, Any]:
    """
    Converts an array representation into a Binary Tree using the standard binary tree array rule:
    For node at index i: left child = 2i + 1, right child = 2i + 2.
    Enforces hole policy: orphaned descendants of a null slot are dropped with warnings.
    """
    cleaned, warnings = _parse_binary_array(arr)
    if not cleaned or cleaned[0] is None:
        return {"steps": [], "final_tree": serialize_tree(None), "warnings": warnings}

    nodes = [Node(val, node_id=idx) if val is not None else None for idx, val in enumerate(cleaned)]
    root = nodes[0]
    steps = []

    steps.append(make_step('create_node', [root.id], serialize_tree(root), f"Created root node {root.value} from array[0]"))

    for i in range(len(cleaned)):
        curr = nodes[i]
        if curr is None:
            continue

        left_idx = 2 * i + 1
        right_idx = 2 * i + 2

        if left_idx < len(cleaned) and nodes[left_idx] is not None:
            curr.left = nodes[left_idx]
            steps.append(make_step(
                'insert', [nodes[left_idx].id], serialize_tree(root),
                f"array[{left_idx}] = {nodes[left_idx].value} → attached as left child of array[{i}] = {curr.value} (rule: 2*{i}+1 = {left_idx})"
            ))

        if right_idx < len(cleaned) and nodes[right_idx] is not None:
            curr.right = nodes[right_idx]
            steps.append(make_step(
                'insert', [nodes[right_idx].id], serialize_tree(root),
                f"array[{right_idx}] = {nodes[right_idx].value} → attached as right child of array[{i}] = {curr.value} (rule: 2*{i}+2 = {right_idx})"
            ))

    return {"steps": steps, "final_tree": serialize_tree(root), "warnings": warnings}


def bst_traversal_steps(ops_or_array: Any, order: str = 'inorder', tree_type: str = 'bst') -> Dict[str, Any]:
    """Generates execution steps for traversing the tree in specified order, supporting tree_type."""
    root, warnings = _build_tree(ops_or_array, tree_type=tree_type)
    steps = []
    visited_count = 0

    if not root:
        res = {"steps": steps, "final_tree": serialize_tree(None)}
        if tree_type == 'binary':
            res["warnings"] = warnings
        return res

    def visit(node: Node):
        nonlocal visited_count
        visited_count += 1
        steps.append(make_step(
            'visit', [node.id], serialize_tree(root),
            f"Visiting node {node.value} (Visit #{visited_count})",
            visit_order=visited_count
        ))

    def inorder(node: Optional[Node]):
        if not node: return
        inorder(node.left)
        visit(node)
        inorder(node.right)

    def preorder(node: Optional[Node]):
        if not node: return
        visit(node)
        preorder(node.left)
        preorder(node.right)

    def postorder(node: Optional[Node]):
        if not node: return
        postorder(node.left)
        postorder(node.right)
        visit(node)

    if order == 'level':
        q = deque([root])
        while q:
            curr = q.popleft()
            visit(curr)
            if curr.left: q.append(curr.left)
            if curr.right: q.append(curr.right)
    elif order == 'preorder':
        preorder(root)
    elif order == 'postorder':
        postorder(root)
    else: # default inorder
        inorder(root)

    res = {"steps": steps, "final_tree": serialize_tree(root)}
    if tree_type == 'binary':
        res["warnings"] = warnings
    return res


def bst_delete_steps(ops_or_array: Any, delete_val: int) -> Dict[str, Any]:
    """
    Generates execution steps for deleting a node from BST using in-order successor relinking.
    First compare step puts the compared node in `comparing`.
    Final step type is `delete_done`.
    Raises ValueError if delete_val is absent.
    """
    if isinstance(ops_or_array, list):
        ops = normalize_ops(ops=ops_or_array)
    else:
        ops = []

    root = _replay_ops(ops)
    steps = []

    if not root:
        raise ValidationError(f"Value {delete_val} not found in tree to delete", field="delete_value", status_code=400)

    current = root
    parent = None
    side = None
    path_ids: List[int] = []  # ancestor IDs visited in search phase, root first

    while current:
        path_ids.append(current.id)
        direction = "match" if current.value == delete_val else ("left" if delete_val < current.value else "right")
        steps.append(make_step(
            'compare', [current.id], serialize_tree(root),
            f"Searching for {delete_val}: compare with node {current.value} → {'found target' if direction == 'match' else 'go ' + direction}",
            payload={'path': list(path_ids)}
        ))

        if current.value == delete_val:
            break

        parent = current
        if delete_val < current.value:
            side = 'left'
            current = current.left
        else:
            side = 'right'
            current = current.right

    if not current:
        raise ValidationError(f"Value {delete_val} not found in tree to delete", field="delete_value", status_code=400)

    # Case 1: Leaf node (no children)
    if current.left is None and current.right is None:
        steps.append(make_step(
            'delete_leaf', [current.id], serialize_tree(root),
            f"Node {delete_val} is a leaf node — removing directly"
        ))
        if parent is None:
            root = None
        elif side == 'left':
            parent.left = None
        else:
            parent.right = None
        steps.append(make_step('delete_done', [], serialize_tree(root), f"Leaf node {delete_val} removed"))

    # Case 2: Single child
    elif current.left is None or current.right is None:
        child = current.left if current.left else current.right
        steps.append(make_step(
            'delete_single_child', [current.id, child.id], serialize_tree(root),
            f"Node {delete_val} has one child ({child.value}) — promoting child to take its place"
        ))
        if parent is None:
            root = child
        elif side == 'left':
            parent.left = child
        else:
            parent.right = child
        steps.append(make_step('delete_done', [child.id], serialize_tree(root), f"Node {delete_val} replaced by child {child.value}"))

    # Case 3: Two children — relink successor node
    else:
        steps.append(make_step(
            'compare', [current.id], serialize_tree(root),
            f"Node {delete_val} has two children — finding in-order successor (leftmost node in right subtree)"
        ))

        succ_parent = current
        successor = current.right
        steps.append(make_step(
            'compare', [successor.id], serialize_tree(root),
            f"Step into right subtree: node {successor.value}"
        ))

        while successor.left:
            succ_parent = successor
            successor = successor.left
            steps.append(make_step(
                'compare', [successor.id], serialize_tree(root),
                f"Traversing left: node {successor.value}"
            ))

        succ_val = successor.value
        succ_id = successor.id
        steps.append(make_step(
            'delete_two_children', [current.id, successor.id], serialize_tree(root),
            f"Found in-order successor {succ_val} (id {succ_id}) — relinking into position of node {delete_val}"
        ))

        # Physical relinking
        if succ_parent != current:
            succ_parent.left = successor.right
            successor.right = current.right
        successor.left = current.left

        if parent is None:
            root = successor
        elif side == 'left':
            parent.left = successor
        else:
            parent.right = successor

        steps.append(make_step(
            'delete_done', [successor.id], serialize_tree(root),
            f"Relinked successor node {succ_val} (id {succ_id}) into deleted node position"
        ))

    return {"steps": steps, "final_tree": serialize_tree(root)}


# --- Classifications & Utility Calculations ---

def bst_classify(ops_or_array: Any, tree_type: str = 'bst') -> Dict[str, Any]:
    """Analyzes the tree structure for Full, Complete, Perfect, and Balanced properties."""
    root, warnings = _build_tree(ops_or_array, tree_type=tree_type)
    if not root:
        res = {
            'tree': serialize_tree(None),
            'height': -1,
            'node_count': 0,
            'is_full': True,
            'is_complete': True,
            'is_perfect': True,
            'is_balanced': True,
            'classification_label': "Empty Tree",
            'violation_note': None
        }
        if tree_type == 'binary':
            res['warnings'] = warnings
        return res

    def get_height(node: Optional[Node]) -> int:
        if not node: return -1
        return 1 + max(get_height(node.left), get_height(node.right))

    height = get_height(root)

    def get_size(node: Optional[Node]) -> int:
        if not node: return 0
        return 1 + get_size(node.left) + get_size(node.right)

    node_count = get_size(root)

    is_full = True
    full_violation = None

    def check_full(node: Optional[Node]):
        nonlocal is_full, full_violation
        if not node or not is_full: return
        has_left = node.left is not None
        has_right = node.right is not None
        if has_left != has_right:
            is_full = False
            missing_child = "right" if has_left else "left"
            full_violation = f"Node {node.value} has a {('left' if has_left else 'right')} child but no {missing_child} child (not full)"
            return
        check_full(node.left)
        check_full(node.right)

    check_full(root)

    is_complete = True
    complete_violation = None
    q = deque([root])
    seen_null = False

    while q:
        curr = q.popleft()
        if curr is None:
            seen_null = True
        else:
            if seen_null:
                is_complete = False
                complete_violation = f"Node {curr.value} appears after a missing position in level-order traversal (not complete)"
                break
            q.append(curr.left)
            q.append(curr.right)

    is_perfect = (node_count == (2 ** (height + 1) - 1))
    perfect_violation = None if is_perfect else f"Tree size is {node_count}, but perfect tree of height {height} requires {2 ** (height + 1) - 1} nodes"

    is_balanced = True
    balanced_violation = None

    def check_balanced(node: Optional[Node]) -> int:
        nonlocal is_balanced, balanced_violation
        if not node or not is_balanced: return -1
        lh = check_balanced(node.left)
        rh = check_balanced(node.right)
        if abs(lh - rh) > 1:
            is_balanced = False
            balanced_violation = f"Node {node.value} left height ({lh}) and right height ({rh}) differ by {abs(lh - rh)} > 1 (unbalanced)"
        return 1 + max(lh, rh)

    check_balanced(root)

    satisfied = []
    if is_full: satisfied.append("Full")
    if is_complete: satisfied.append("Complete")
    if is_perfect: satisfied.append("Perfect")
    if is_balanced: satisfied.append("Balanced")

    label = ", ".join(satisfied) if satisfied else "General Binary Tree"
    violation_note = full_violation or complete_violation or balanced_violation or perfect_violation

    res = {
        'tree': serialize_tree(root),
        'height': height,
        'node_count': node_count,
        'is_full': is_full,
        'is_complete': is_complete,
        'is_perfect': is_perfect,
        'is_balanced': is_balanced,
        'classification_label': label,
        'violation_note': violation_note
    }
    if tree_type == 'binary':
        res['warnings'] = warnings
    return res


def bst_height_depth(ops_or_array: Any, target_val: Optional[int] = None, tree_type: str = 'bst', target_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Calculates height and depth of a specific node in the tree.
    If target_id is provided, searches ONLY by target_id; raises ValidationError(field="target_id") if absent.
    Falls back to target_val only when target_id is absent; raises ValidationError(field="target_value") if absent.
    """
    root, warnings = _build_tree(ops_or_array, tree_type=tree_type)
    if not root:
        missing_field = "target_id" if target_id is not None else "target_value"
        ident = target_id if target_id is not None else target_val
        raise ValidationError(f"Tree is empty; node {ident} not found", field=missing_field, status_code=400)

    target_node = None
    target_depth = 0

    if target_id is not None:
        q = deque([(root, 0)])
        while q:
            curr, d = q.popleft()
            if curr.id == target_id:
                target_node = curr
                target_depth = d
                break
            if curr.left: q.append((curr.left, d + 1))
            if curr.right: q.append((curr.right, d + 1))

        if not target_node:
            raise ValidationError(f"Node with id {target_id} not found in tree", field="target_id", status_code=400)
    else:
        q = deque([(root, 0)])
        while q:
            curr, d = q.popleft()
            if curr.value == target_val:
                target_node = curr
                target_depth = d
                break
            if curr.left: q.append((curr.left, d + 1))
            if curr.right: q.append((curr.right, d + 1))

        if not target_node:
            raise ValidationError(f"Node with value {target_val} not found in tree", field="target_value", status_code=400)

    def get_height(node: Optional[Node]) -> int:
        if not node: return -1
        return 1 + max(get_height(node.left), get_height(node.right))

    target_height = get_height(target_node)

    res = {
        'tree': serialize_tree(root),
        'target_id': target_node.id,
        'height': target_height,
        'depth': target_depth
    }
    if tree_type == 'binary':
        res['warnings'] = warnings
    return res


# --- A4: Tree Mirroring / Structural Comparison ---

def _build_tree_from_spec(spec: Dict[str, Any]) -> Tuple[Optional[Node], List[str]]:
    """Build a tree from a validated mirror-spec dict: {tree_type, ops} or {tree_type, array}."""
    tree_type = spec.get('tree_type', 'bst')
    if tree_type == 'binary':
        arr = spec.get('array', [])
        cleaned, warnings = _parse_binary_array(arr)
        return _build_binary_tree_from_cleaned(cleaned), warnings
    ops_raw = spec.get('ops', [])
    ops_norm = normalize_ops(ops=ops_raw) if isinstance(ops_raw, list) else []
    return _replay_ops(ops_norm), []


def _preorder_with_nulls(node: Optional[Node]) -> List[str]:
    """Preorder traversal with 'N' markers for null positions."""
    if node is None:
        return ['N']
    return [str(node.value)] + _preorder_with_nulls(node.left) + _preorder_with_nulls(node.right)


def _mirror_preorder_with_nulls(node: Optional[Node]) -> List[str]:
    """Preorder traversal visiting right before left (mirror-reflected order)."""
    if node is None:
        return ['N']
    return [str(node.value)] + _mirror_preorder_with_nulls(node.right) + _mirror_preorder_with_nulls(node.left)


def _make_mirror_step(step_type: str, a_ids: List[int], b_ids: List[int],
                     snapshot_a: Dict, snapshot_b: Dict, note: str, **extra) -> Dict[str, Any]:
    """Creates a mirror comparison step with dual snapshots and suffixed role arrays."""
    step: Dict[str, Any] = {
        'type': step_type,
        'snapshot_a': snapshot_a,
        'snapshot_b': snapshot_b,
        'annotation': note,
        'comparing_a': a_ids if step_type in ('mirror_compare', 'struct_compare') else [],
        'comparing_b': b_ids if step_type in ('mirror_compare', 'struct_compare') else [],
        'matched_a': a_ids if step_type == 'mirror_match' else [],
        'matched_b': b_ids if step_type == 'mirror_match' else [],
        'mismatch_a': a_ids if step_type == 'mirror_mismatch' else [],
        'mismatch_b': b_ids if step_type == 'mirror_mismatch' else [],
    }
    step.update(extra)
    return step


def bst_mirror_steps(tree_a_spec: Dict, tree_b_spec: Dict, mode: str = 'mirror') -> Dict[str, Any]:
    """
    Compares two trees recursively:
      mode='mirror'    — A mirrors B iff A.left mirrors B.right and A.right mirrors B.left (values equal).
      mode='identical' — A equals B iff A.left identical B.left and A.right identical B.right.

    Oracle invariant:
      A mirrors B  ⟺  _preorder_with_nulls(A) == _mirror_preorder_with_nulls(B)
      A identical B ⟺  _preorder_with_nulls(A) == _preorder_with_nulls(B)

    Step types: 'mirror_compare' / 'struct_compare', 'mirror_match', 'mirror_mismatch'.
    Each step carries snapshot_a, snapshot_b and suffixed role arrays (_a / _b).
    """
    root_a, warnings_a = _build_tree_from_spec(tree_a_spec)
    root_b, warnings_b = _build_tree_from_spec(tree_b_spec)

    snap_a = serialize_tree(root_a)
    snap_b = serialize_tree(root_b)
    steps: List[Dict[str, Any]] = []
    first_mismatch: Optional[Dict[str, Any]] = None
    compare_type = 'struct_compare' if mode == 'identical' else 'mirror_compare'

    def recurse(node_a: Optional[Node], node_b: Optional[Node]) -> bool:
        nonlocal first_mismatch
        a_ids = [node_a.id] if node_a else []
        b_ids = [node_b.id] if node_b else []

        # Both null — structural match
        if node_a is None and node_b is None:
            steps.append(_make_mirror_step(
                'mirror_match', [], [], snap_a, snap_b,
                f"Both positions are null — match"
            ))
            return True

        # One null — structural mismatch
        if node_a is None or node_b is None:
            reason = "Tree A has a node where Tree B is null" if node_a else "Tree B has a node where Tree A is null"
            steps.append(_make_mirror_step(
                'mirror_mismatch', a_ids, b_ids, snap_a, snap_b,
                f"{reason} — mismatch"
            ))
            if first_mismatch is None:
                first_mismatch = {
                    'a_id': node_a.id if node_a else None,
                    'b_id': node_b.id if node_b else None,
                    'reason': reason
                }
            return False

        # Both non-null: emit a compare step
        labels_match = (node_a.value == node_b.value)
        compare_note = (
            f"Comparing A:{node_a.value}(id={node_a.id}) with B:{node_b.value}(id={node_b.id}) "
            f"— {'values equal' if labels_match else 'values differ'}"
        )
        steps.append(_make_mirror_step(
            compare_type, a_ids, b_ids, snap_a, snap_b, compare_note
        ))

        # Recurse based on mode
        if mode == 'mirror':
            left_ok = recurse(node_a.left, node_b.right)
            right_ok = recurse(node_a.right, node_b.left)
        else:
            left_ok = recurse(node_a.left, node_b.left)
            right_ok = recurse(node_a.right, node_b.right)

        result = labels_match and left_ok and right_ok

        if not result and first_mismatch is None and not labels_match:
            reason = f"Value mismatch: A={node_a.value} vs B={node_b.value}"
            steps.append(_make_mirror_step(
                'mirror_mismatch', a_ids, b_ids, snap_a, snap_b, reason
            ))
            first_mismatch = {'a_id': node_a.id, 'b_id': node_b.id, 'reason': reason}

        return result

    is_match = recurse(root_a, root_b)

    return {
        'steps': steps,
        'final_tree_a': snap_a,
        'final_tree_b': snap_b,
        'verdict': {
            'is_match': is_match,
            'first_mismatch': first_mismatch
        },
        'warnings': warnings_a + warnings_b
    }


# --- Unit 2: Heaps (array + tree dual-panel traces) ---

HEAP_MAX_SIZE = 31
HEAP_MAX_STEPS = 1000


def _heap_better(heap_type: str, candidate: int, current: int) -> bool:
    """Strict improvement only, so equal values never swap (documented tie-break)."""
    return candidate < current if heap_type == 'min' else candidate > current


class _HeapState:
    def __init__(self, heap_type: str):
        self.heap_type = heap_type
        self.cells: List[Dict[str, Any]] = []   # [{'id': int, 'value': int}]
        self.heap_size = 0
        self.next_id = 0


def _heap_tree_snapshot(cells: List[Dict[str, Any]], heap_size: int) -> Dict[str, Any]:
    """Derives the complete-binary-tree snapshot from cells[0:heap_size]."""
    nodes = []
    for index in range(heap_size):
        cell = cells[index]
        if index == 0:
            parent_id = None
            side = None
        else:
            parent_index = (index - 1) // 2
            parent_id = cells[parent_index]['id']
            side = 'left' if index % 2 == 1 else 'right'
        nodes.append({
            'id': cell['id'],
            'label': str(cell['value']),
            'sublabel': f'i={index}',
            'parent_id': parent_id,
            'side': side,
        })
    return {'nodes': nodes, 'root_id': cells[0]['id'] if heap_size > 0 else None}


def _heap_dual_snapshot(state: _HeapState) -> Dict[str, Any]:
    return {
        'array': {
            'cells': [{'id': c['id'], 'value': c['value']} for c in state.cells],
            'heap_size': state.heap_size,
            'heap_type': state.heap_type,
        },
        'tree': _heap_tree_snapshot(state.cells, state.heap_size),
    }


class _HeapTracer:
    def __init__(self, state: _HeapState, field: str = 'action'):
        self.state = state
        self.field = field
        self.steps: List[Dict[str, Any]] = []
        self.comparisons = 0
        self.swaps = 0

    def add(self, step_type: str, ids: List[Any], note: str, **extra) -> Dict[str, Any]:
        if len(self.steps) >= HEAP_MAX_STEPS:
            raise ValidationError(
                f"Trace exceeded {HEAP_MAX_STEPS} steps; reduce the input size",
                field=self.field, status_code=400
            )
        step = make_step(step_type, ids, _heap_dual_snapshot(self.state), note, kind='dual', **extra)
        self.steps.append(step)
        if step_type == 'compare':
            self.comparisons += 1
        elif step_type == 'swap':
            self.swaps += 1
        return step


def _heap_swap(state: _HeapState, tracer: _HeapTracer, i: int, j: int, note: Optional[str] = None) -> None:
    first = state.cells[i]
    second = state.cells[j]
    state.cells[i], state.cells[j] = second, first
    if note is None:
        note = (
            f"Swap index {i} ({first['value']}) with index {j} ({second['value']}) "
            f"to restore the {state.heap_type}-heap property."
        )
    tracer.add('swap', [first['id'], second['id']], note, payload={
        'from_index': i,
        'to_index': j,
        'from_value': first['value'],
        'to_value': second['value'],
    })


def _heap_bubble_up(state: _HeapState, tracer: _HeapTracer, index: int) -> int:
    while index > 0:
        parent_index = (index - 1) // 2
        child = state.cells[index]
        parent = state.cells[parent_index]
        swap_needed = _heap_better(state.heap_type, child['value'], parent['value'])
        relation = 'smaller' if state.heap_type == 'min' else 'larger'
        tracer.add(
            'compare',
            [child['id'], parent['id']],
            (
                f"Compare child index {index} ({child['value']}) with parent index {parent_index} "
                f"({parent['value']}) using (i-1)//2 = ({index}-1)//2 = {parent_index}. "
                + (
                    f"Swap because the child is {relation} than the parent."
                    if swap_needed else
                    "No swap: the parent is correctly ordered (equal values never swap)."
                )
            ),
            payload={
                'child_index': index,
                'parent_index': parent_index,
                'child_id': child['id'],
                'parent_id': parent['id'],
                'swap_needed': swap_needed,
                'focus_index': index,
            }
        )
        if not swap_needed:
            break
        _heap_swap(state, tracer, index, parent_index)
        index = parent_index
    return index


def _heap_sift_down(state: _HeapState, tracer: _HeapTracer, index: int,
                    heap_size: Optional[int] = None, sift_root: Optional[int] = None) -> int:
    size = state.heap_size if heap_size is None else heap_size
    root_index = sift_root if sift_root is not None else index
    relation = 'smallest' if state.heap_type == 'min' else 'largest'

    while True:
        left = 2 * index + 1
        right = 2 * index + 2
        if left >= size:
            break

        best = index
        if _heap_better(state.heap_type, state.cells[left]['value'], state.cells[best]['value']):
            best = left
        if right < size and _heap_better(state.heap_type, state.cells[right]['value'], state.cells[best]['value']):
            best = right

        right_text = f"{state.cells[right]['value']}" if right < size else 'none'
        chosen = best if best != index else None
        tracer.add(
            'compare',
            [state.cells[index]['id'], state.cells[left]['id']]
            + ([state.cells[right]['id']] if right < size else []),
            (
                f"Compare parent index {index} ({state.cells[index]['value']}) with left child "
                f"{left} ({state.cells[left]['value']}) and right child {right} ({right_text}). "
                + (
                    f"Swap with index {best} because it is the {relation} child and outranks the parent."
                    if chosen is not None else "Heap order already holds for this subtree."
                )
            ),
            payload={
                'parent_index': index,
                'left_index': left,
                'right_index': right,
                'chosen_index': chosen,
                'sift_root': root_index,
                'focus_index': chosen if chosen is not None else index,
            }
        )
        if chosen is None:
            break
        _heap_swap(state, tracer, index, chosen)
        index = chosen

    return index


def _heap_apply_insert(state: _HeapState, value: int, tracer: _HeapTracer) -> None:
    if state.heap_size >= HEAP_MAX_SIZE:
        raise ValidationError(
            f"Heap supports at most {HEAP_MAX_SIZE} elements",
            field=tracer.field, status_code=400
        )
    cell = {'id': state.next_id, 'value': value}
    state.next_id += 1
    state.cells.append(cell)
    state.heap_size += 1
    index = state.heap_size - 1
    tracer.add(
        'append',
        [cell['id']],
        f"Append {value} at index {index}, the next free slot in the array.",
        payload={'index': index, 'value': value, 'heap_size': state.heap_size}
    )
    final_index = _heap_bubble_up(state, tracer, index)
    tracer.add(
        'insert_done',
        [cell['id']],
        f"{value} settled at index {final_index} and the {state.heap_type}-heap property holds.",
        payload={'index': final_index, 'value': value}
    )


def _heap_apply_extract(state: _HeapState, tracer: _HeapTracer) -> None:
    if state.heap_size == 0:
        raise ValidationError(
            "Cannot extract from an empty heap",
            field=tracer.field, status_code=400
        )
    root_cell = state.cells[0]
    tracer.add(
        'extract_root',
        [root_cell['id']],
        f"Extract the root: index 0 holds {root_cell['value']}, the heap {state.heap_type}imum.",
        payload={'index': 0, 'value': root_cell['value']}
    )

    last = state.heap_size - 1
    if last > 0:
        last_value = state.cells[last]['value']
        _heap_swap(
            state, tracer, 0, last,
            note=f"Move the last element ({last_value}) to the root before removing the old root."
        )
    removed = state.cells.pop()
    state.heap_size -= 1
    tracer.add(
        'remove_last',
        [],
        (
            f"Remove {removed['value']} (id {removed['id']}) from index {last}. "
            f"Heap size is now {state.heap_size}."
        ),
        payload={
            'index': last,
            'extracted_value': removed['value'],
            'extracted_id': removed['id'],
            'heap_size': state.heap_size,
        }
    )

    if state.heap_size > 0:
        _heap_sift_down(state, tracer, 0)

    new_root = state.cells[0] if state.heap_size > 0 else None
    tracer.add(
        'extract_done',
        [new_root['id']] if new_root else [],
        (
            f"Extracted {root_cell['value']}. "
            + (f"New root is {new_root['value']}." if new_root else "The heap is empty.")
        ),
        payload={'extracted_value': root_cell['value'], 'extracted_id': root_cell['id']}
    )


def _heap_build(state: _HeapState, values: List[int], tracer: _HeapTracer) -> None:
    state.cells = [{'id': i, 'value': value} for i, value in enumerate(values)]
    state.heap_size = len(values)
    state.next_id = len(values)

    n = len(values)
    last_parent = n // 2 - 1

    tracer.add(
        'build_start',
        [state.cells[0]['id']] if n else [],
        (
            f"Build-heap from {n} values. Start at the last parent, "
            f"index n//2-1 = {n}//2-1 = {last_parent}."
            if n else "Build-heap from an empty array — nothing to heapify."
        ),
        payload={'n': n, 'last_parent': last_parent}
    )
    for i in range(last_parent, -1, -1):
        _heap_sift_down(state, tracer, i, heap_size=n, sift_root=i)
        tracer.add(
            'heapify_node_done',
            [state.cells[i]['id']],
            f"Subtree rooted at index {i} satisfies the {state.heap_type}-heap property.",
            payload={'index': i}
        )
    tracer.add(
        'build_done',
        [],
        f"Build-heap complete: {n} element(s) form a valid {state.heap_type}-heap.",
        payload={'heap_size': n}
    )


class _NullHeapTracer:
    """Silent tracer used while replaying ops; applies mutations without recording."""
    def __init__(self, state: _HeapState):
        self.state = state
        self.field = 'ops'

    def add(self, step_type: str, ids: List[Any], note: str, **extra) -> None:
        return None


def _heap_heapsort_rounds(state: _HeapState, tracer: _HeapTracer) -> None:
    n = len(state.cells)
    for end in range(n - 1, 0, -1):
        top = state.cells[0]
        _heap_swap(
            state, tracer, 0, end,
            note=(
                f"Swap the heap {'minimum' if state.heap_type == 'min' else 'maximum'} "
                f"({top['value']}) at index 0 with index {end}."
            )
        )
        state.heap_size = end
        sorted_ids = [state.cells[k]['id'] for k in range(end, n)]
        tracer.add(
            'mark_sorted',
            sorted_ids,
            (
                f"Index {end} is final ({state.cells[end]['value']}); the sorted region is "
                f"indices {end}..{n - 1} and the heap is indices 0..{end - 1}."
            ),
            payload={'sorted_from': end, 'heap_size': end}
        )
        if end > 1:
            _heap_sift_down(state, tracer, 0, heap_size=end)

    state.heap_size = 0
    all_ids = [cell['id'] for cell in state.cells]
    tracer.add(
        'heapsort_done',
        all_ids,
        (
            f"Heapsort complete: the array is sorted in "
            f"{'ascending' if state.heap_type == 'max' else 'descending'} order."
        ),
        payload={'sorted': True}
    )


def _apply_heap_action(state: _HeapState, action: Dict[str, Any], tracer: _HeapTracer) -> None:
    name = action.get('op')
    if name == 'build':
        if state.cells:
            raise ValidationError(
                "'build' is only allowed on an empty heap",
                field='action', status_code=400
            )
        _heap_build(state, action['values'], tracer)
    elif name == 'insert':
        _heap_apply_insert(state, action['value'], tracer)
    elif name == 'extract':
        _heap_apply_extract(state, tracer)
    else:
        raise ValidationError(f"Unknown heap op: {name}", field='action', status_code=400)


def _replay_heap_ops(state: _HeapState, ops: List[Dict[str, Any]]) -> None:
    silent = _NullHeapTracer(state)
    for index, op in enumerate(ops):
        name = op.get('op')
        if name == 'build':
            if index != 0:
                raise ValidationError(
                    "'build' is only allowed as the first op",
                    field='ops', status_code=400
                )
            _heap_build(state, op['values'], silent)
        elif name == 'insert':
            _heap_apply_insert(state, op['value'], silent)
        elif name == 'extract':
            _heap_apply_extract(state, silent)
        else:
            raise ValidationError(f"Unknown heap op: {name}", field='ops', status_code=400)


def heap_op_steps(heap_type: str, ops: Optional[List[Dict[str, Any]]] = None,
                  action: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Statelessly replays ops, then emits dual-panel steps for the requested action."""
    state = _HeapState(heap_type)
    _replay_heap_ops(state, ops or [])

    tracer = _HeapTracer(state, field='action')
    if action:
        _apply_heap_action(state, action, tracer)

    steps = tracer.steps
    final_state = steps[-1]['snapshot'] if steps else _heap_dual_snapshot(state)
    return {
        'steps': steps,
        'final_state': final_state,
        'metrics': {
            'comparisons': tracer.comparisons,
            'swaps': tracer.swaps,
            'steps': len(steps),
        },
        'metadata': {
            'algorithm': 'heap_op',
            'heap_type': heap_type,
            'heap_size': state.heap_size,
        },
    }


def heapsort_steps(heap_type: str, array: List[int]) -> Dict[str, Any]:
    """Builds a heap from `array`, then sorts it in place, retaining the sorted tail."""
    state = _HeapState(heap_type)
    tracer = _HeapTracer(state, field='array')
    _heap_build(state, list(array), tracer)
    _heap_heapsort_rounds(state, tracer)

    steps = tracer.steps
    final_state = steps[-1]['snapshot'] if steps else _heap_dual_snapshot(state)
    return {
        'steps': steps,
        'final_state': final_state,
        'metrics': {
            'comparisons': tracer.comparisons,
            'swaps': tracer.swaps,
            'steps': len(steps),
        },
        'metadata': {
            'algorithm': 'heapsort',
            'heap_type': heap_type,
            'heap_size': 0,
            'array_size': len(array),
        },
    }


# Stub functions for remaining units (unchanged)

def heap_insert_steps(values: Any) -> Dict[str, Any]:
    return {"steps": [], "metadata": {"algorithm": "heap_insert"}}

def heap_extract_steps(values: Any) -> Dict[str, Any]:
    return {"steps": [], "metadata": {"algorithm": "heap_extract"}}

def avl_insert_steps(values: Any) -> Dict[str, Any]:
    return {"steps": [], "metadata": {"algorithm": "avl_insert"}}

def trie_insert_steps(words: List[str]) -> Dict[str, Any]:
    return {"steps": [], "metadata": {"algorithm": "trie_insert"}}

def hash_insert_steps(keys: List[Any], method: str, table_size: int) -> Dict[str, Any]:
    return {"steps": [], "metadata": {"algorithm": "hash_insert", "method": method}}

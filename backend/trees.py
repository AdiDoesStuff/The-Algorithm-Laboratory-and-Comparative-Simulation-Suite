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


def normalize_ops(ops: Optional[List[Dict[str, Any]]] = None, values: Optional[List[int]] = None) -> List[Dict[str, Any]]:
    """
    Normalizes input to standard op-log shape: [{'op': 'insert'|'delete', 'value': int}].
    Keeps legacy `values` shape as a deprecated shim.
    """
    if ops is not None:
        normalized = []
        for op in ops:
            if not isinstance(op, dict) or 'op' not in op or 'value' not in op:
                raise ValueError("Each op must be a dict with 'op' and 'value'")
            if op['op'] not in ('insert', 'delete'):
                raise ValueError(f"Unknown op type: {op['op']}")
            normalized.append({'op': op['op'], 'value': int(op['value'])})
        return normalized

    if values is not None:
        normalized = []
        for v in values:
            if v is not None:
                normalized.append({'op': 'insert', 'value': int(v)})
        return normalized

    return []


def _insert_node(root: Optional[Node], value: int, node_id: int) -> Node:
    """Inserts a new node with explicit node_id; raises ValueError on duplicates."""
    if root is None:
        return Node(value, node_id=node_id)
    if value == root.value:
        raise ValueError(f"Duplicate value: {value} already exists in the tree")
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
    Raises ValueError if delete_val is not found in tree.
    """
    if root is None:
        raise ValueError(f"Value {delete_val} not found in tree to delete")

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
        raise ValueError(f"Value {delete_val} not found in tree to delete")

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
    if isinstance(ops_or_array, list) and (not ops_or_array or not isinstance(ops_or_array[0], dict)):
        ops = normalize_ops(values=ops_or_array)
    elif isinstance(ops_or_array, list):
        ops = normalize_ops(ops=ops_or_array)
    else:
        ops = []

    return _replay_ops(ops), warnings


# --- BST Operations Step Generators ---

def bst_insert_steps(ops_or_values: Any, new_value: int) -> Dict[str, Any]:
    """Generates execution steps for inserting new_value into a BST built from ops_or_values."""
    if isinstance(ops_or_values, list) and (not ops_or_values or not isinstance(ops_or_values[0], dict)):
        ops = normalize_ops(values=ops_or_values)
    elif isinstance(ops_or_values, list):
        ops = normalize_ops(ops=ops_or_values)
    else:
        ops = []

    root = _replay_ops(ops)
    steps = []

    # Check for duplicate value
    curr_check = root
    while curr_check:
        if curr_check.value == new_value:
            raise ValueError(f"Duplicate value: {new_value} already exists in the tree")
        curr_check = curr_check.left if new_value < curr_check.value else curr_check.right

    new_node_id = len(ops)
    new_node = Node(new_value, node_id=new_node_id)

    if root is None:
        root = new_node
        steps.append(make_step('insert', [new_node.id], serialize_tree(root), f"Inserted {new_value} as root node"))
        return {"steps": steps, "final_tree": serialize_tree(root)}

    current = root
    parent = None
    side = None

    while current is not None:
        direction = "left" if new_value < current.value else "right"
        steps.append(make_step(
            'compare', [current.id], serialize_tree(root),
            f"Comparing {new_value} with node {current.value}: {new_value} {'<' if new_value < current.value else '>'} {current.value} → go {direction}"
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

    steps.append(make_step('insert', [new_node.id], serialize_tree(root), f"Inserted {new_value} as {side} child of {parent.value}"))
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


def bst_delete_steps(ops_or_values: Any, delete_val: int) -> Dict[str, Any]:
    """
    Generates execution steps for deleting a node from BST using in-order successor relinking.
    First compare step puts the compared node in `comparing`.
    Final step type is `delete_done`.
    Raises ValueError if delete_val is absent.
    """
    if isinstance(ops_or_values, list) and (not ops_or_values or not isinstance(ops_or_values[0], dict)):
        ops = normalize_ops(values=ops_or_values)
    elif isinstance(ops_or_values, list):
        ops = normalize_ops(ops=ops_or_values)
    else:
        ops = []

    root = _replay_ops(ops)
    steps = []

    if not root:
        raise ValueError(f"Value {delete_val} not found in tree to delete")

    current = root
    parent = None
    side = None

    while current:
        direction = "match" if current.value == delete_val else ("left" if delete_val < current.value else "right")
        steps.append(make_step(
            'compare', [current.id], serialize_tree(root),
            f"Searching for {delete_val}: compare with node {current.value} → {'found target' if direction == 'match' else 'go ' + direction}"
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
        raise ValueError(f"Value {delete_val} not found in tree to delete")

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


def bst_height_depth(ops_or_array: Any, target_val: int, tree_type: str = 'bst', target_id: Optional[int] = None) -> Dict[str, Any]:
    """Calculates height and depth of a specific node in the tree."""
    root, warnings = _build_tree(ops_or_array, tree_type=tree_type)
    if not root:
        res = {'tree': serialize_tree(None), 'target_id': None, 'height': 0, 'depth': 0, 'error': "Tree is empty"}
        if tree_type == 'binary':
            res['warnings'] = warnings
        return res

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
        res = {'tree': serialize_tree(root), 'target_id': None, 'height': 0, 'depth': 0, 'error': f"Node {target_val} not found"}
        if tree_type == 'binary':
            res['warnings'] = warnings
        return res

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

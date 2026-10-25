"""
trees.py — Backend execution trace generators for tree, trie, hash, and algorithmic design structures.
"""

from typing import Any, Dict, List, Optional
from collections import deque

DEFAULT_ROLES = {
    'compare':              {'comparing': lambda ids: ids},
    'visit':                {'highlighted': lambda ids: ids},
    'insert':               {'new_node': lambda ids: ids},
    'delete_leaf':          {'highlighted': lambda ids: ids},
    'delete_single_child':  {'highlighted': lambda ids: ids},
    'delete_two_children':  {'highlighted': lambda ids: ids},
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


# --- Unit 1: BST Data Structure & Helpers ---

class Node:
    _next_id = 0

    def __init__(self, value: int):
        self.id = Node._next_id
        Node._next_id += 1
        self.value = value
        self.left: Optional['Node'] = None
        self.right: Optional['Node'] = None

    @classmethod
    def reset_id(cls):
        cls._next_id = 0


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


def _silent_insert(root: Optional[Node], value: int) -> Node:
    if root is None:
        return Node(value)
    if value < root.value:
        root.left = _silent_insert(root.left, value)
    elif value > root.value:
        root.right = _silent_insert(root.right, value)
    return root


def _build_binary_tree(values: List[int]) -> Optional[Node]:
    Node.reset_id()
    if not values:
        return None
    nodes = [Node(v) if v is not None else None for v in values]
    for i in range(len(values)):
        if nodes[i] is None:
            continue
        left_i = 2 * i + 1
        right_i = 2 * i + 2
        if left_i < len(values):
            nodes[i].left = nodes[left_i]
        if right_i < len(values):
            nodes[i].right = nodes[right_i]
    return nodes[0] if nodes else None


def _build_tree(values: List[int], tree_type: str = 'bst') -> Optional[Node]:
    if tree_type == 'binary':
        return _build_binary_tree(values)
    Node.reset_id()
    root = None
    for v in values:
        root = _silent_insert(root, v)
    return root


# --- BST Operations Step Generators ---

def bst_insert_steps(existing_values: List[int], new_value: int) -> Dict[str, Any]:
    """Generates execution steps for inserting new_value into a BST built from existing_values."""
    root = _build_tree(existing_values)
    steps = []

    if root is None:
        new_node = Node(new_value)
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

    new_node = Node(new_value)
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
    """
    Node.reset_id()
    if not arr:
        return {"steps": [], "final_tree": serialize_tree(None)}

    parsed = []
    for item in arr:
        if item is None or str(item).strip().lower() in ('null', 'none', 'n/a'):
            parsed.append(None)
        else:
            try:
                parsed.append(int(item))
            except ValueError:
                parsed.append(None)

    if not parsed or parsed[0] is None:
        return {"steps": [], "final_tree": serialize_tree(None)}

    nodes = [Node(val) if val is not None else None for val in parsed]
    root = nodes[0]
    steps = []

    steps.append(make_step('create_node', [root.id], serialize_tree(root), f"Created root node {root.value} from array[0]"))

    for i in range(len(parsed)):
        curr = nodes[i]
        if curr is None:
            continue

        left_idx = 2 * i + 1
        right_idx = 2 * i + 2

        if left_idx < len(parsed) and nodes[left_idx] is not None:
            curr.left = nodes[left_idx]
            steps.append(make_step(
                'insert', [nodes[left_idx].id], serialize_tree(root),
                f"array[{left_idx}] = {nodes[left_idx].value} → attached as left child of array[{i}] = {curr.value} (rule: 2*{i}+1 = {left_idx})"
            ))

        if right_idx < len(parsed) and nodes[right_idx] is not None:
            curr.right = nodes[right_idx]
            steps.append(make_step(
                'insert', [nodes[right_idx].id], serialize_tree(root),
                f"array[{right_idx}] = {nodes[right_idx].value} → attached as right child of array[{i}] = {curr.value} (rule: 2*{i}+2 = {right_idx})"
            ))

    return {"steps": steps, "final_tree": serialize_tree(root)}


def bst_traversal_steps(values: List[int], order: str) -> Dict[str, Any]:
    """Generates execution steps for traversing the BST in specified order."""
    root = _build_tree(values)
    steps = []
    visited_count = 0

    if not root:
        return {"steps": steps, "final_tree": serialize_tree(None)}

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

    return {"steps": steps, "final_tree": serialize_tree(root)}


def bst_delete_steps(values: List[int], delete_val: int) -> Dict[str, Any]:
    """Generates execution steps for deleting a node from BST, covering leaf, single-child, and two-children cases."""
    root = _build_tree(values)
    steps = []

    if not root:
        return {"steps": steps, "final_tree": serialize_tree(None)}

    # Find target node and record comparison steps
    current = root
    parent = None
    side = None

    while current and current.value != delete_val:
        direction = "left" if delete_val < current.value else "right"
        steps.append(make_step(
            'compare', [current.id], serialize_tree(root),
            f"Searching for {delete_val}: compare with {current.value} → go {direction}"
        ))
        parent = current
        if delete_val < current.value:
            side = 'left'
            current = current.left
        else:
            side = 'right'
            current = current.right

    if not current:
        steps.append(make_step('compare', [], serialize_tree(root), f"Value {delete_val} not found in tree"))
        return {"steps": steps, "final_tree": serialize_tree(root)}

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
        steps.append(make_step('visit', [], serialize_tree(root), f"Leaf node {delete_val} removed"))

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
        steps.append(make_step('visit', [child.id], serialize_tree(root), f"Node {delete_val} replaced by child {child.value}"))

    # Case 3: Two children
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
        steps.append(make_step(
            'delete_two_children', [current.id, successor.id], serialize_tree(root),
            f"Found in-order successor {succ_val} — swapping value with node {delete_val}"
        ))

        # Copy successor value to target
        current.value = succ_val

        # Unlink successor (which has at most a right child)
        if succ_parent.left == successor:
            succ_parent.left = successor.right
        else:
            succ_parent.right = successor.right

        steps.append(make_step(
            'visit', [current.id], serialize_tree(root),
            f"Successfully replaced node with successor {succ_val} and removed duplicate node"
        ))

    return {"steps": steps, "final_tree": serialize_tree(root)}


# --- Classifications & Utility Calculations ---

def bst_classify(values: List[int], tree_type: str = 'bst') -> Dict[str, Any]:
    """Analyzes the current tree structure for Full, Complete, Perfect, and Balanced properties."""
    root = _build_tree(values, tree_type)
    if not root:
        return {
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

    # 1. Height calculation
    def get_height(node: Optional[Node]) -> int:
        if not node: return -1
        return 1 + max(get_height(node.left), get_height(node.right))

    height = get_height(root)

    # 2. Node count
    def get_size(node: Optional[Node]) -> int:
        if not node: return 0
        return 1 + get_size(node.left) + get_size(node.right)

    node_count = get_size(root)

    # 3. Full Check: every node has 0 or 2 children
    is_full = True
    full_violation = None

    def check_full(node: Node):
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

    # 4. Complete Check: all levels filled except possibly last, filled left to right
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

    # 5. Perfect Check: all leaves at same depth AND all internal nodes have 2 children
    is_perfect = (node_count == (2 ** (height + 1) - 1))
    perfect_violation = None if is_perfect else f"Tree size is {node_count}, but perfect tree of height {height} requires {2 ** (height + 1) - 1} nodes"

    # 6. Balanced Check: |height(left) - height(right)| <= 1 at every node
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

    # Compile properties satisfied
    satisfied = []
    if is_full: satisfied.append("Full")
    if is_complete: satisfied.append("Complete")
    if is_perfect: satisfied.append("Perfect")
    if is_balanced: satisfied.append("Balanced")

    label = ", ".join(satisfied) if satisfied else "General Binary Tree"

    # Pick the most prominent violation note if any property fails
    violation_note = full_violation or complete_violation or balanced_violation or perfect_violation

    return {
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


def bst_height_depth(values: List[int], target_val: int, tree_type: str = 'bst', target_id: Optional[int] = None) -> Dict[str, Any]:
    """Calculates height and depth of a specific node in the tree."""
    root = _build_tree(values, tree_type)
    if not root:
        return {'tree': serialize_tree(None), 'target_id': None, 'height': 0, 'depth': 0, 'error': "Tree is empty"}

    target_node = None
    target_depth = 0

    # Search by target_id first if provided
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

    # General BFS search by value if target_id is not provided or not found
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
        return {'tree': serialize_tree(root), 'target_id': None, 'height': 0, 'depth': 0, 'error': f"Node {target_val} not found"}

    def get_height(node: Optional[Node]) -> int:
        if not node: return -1
        return 1 + max(get_height(node.left), get_height(node.right))

    target_height = get_height(target_node)

    return {
        'tree': serialize_tree(root),
        'target_id': target_node.id,
        'height': target_height,
        'depth': target_depth
    }


# Stub functions for remaining units (unchanged)

def heap_insert_steps(values: List[int]) -> Dict[str, Any]:
    return {"steps": [], "metadata": {"algorithm": "heap_insert"}}

def heap_extract_steps(values: List[int]) -> Dict[str, Any]:
    return {"steps": [], "metadata": {"algorithm": "heap_extract"}}

def avl_insert_steps(values: List[int]) -> Dict[str, Any]:
    return {"steps": [], "metadata": {"algorithm": "avl_insert"}}

def trie_insert_steps(words: List[str]) -> Dict[str, Any]:
    return {"steps": [], "metadata": {"algorithm": "trie_insert"}}

def hash_insert_steps(keys: List[Any], method: str, table_size: int) -> Dict[str, Any]:
    return {"steps": [], "metadata": {"algorithm": "hash_insert", "method": method}}

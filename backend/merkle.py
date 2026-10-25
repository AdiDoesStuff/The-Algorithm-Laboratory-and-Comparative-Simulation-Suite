"""Merkle tree trace generator (Phase D, POST /merkle).

Uses real SHA-256. A leaf digest is SHA256(utf-8 data); a parent digest is
SHA256(left_digest_bytes || right_digest_bytes) over the raw 32-byte digests.
Odd levels use the duplicate-last policy: the last node is copied to a real
tree node with its own id and ``duplicate_of`` pointing at the original.
"""

import hashlib
from typing import Any, Dict, List, Optional, Tuple

import validation
from tracing import make_step
from validation import ValidationError

PENDING = "\u2026"


def sha256_hex(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def combine_hex(left_hex: str, right_hex: str) -> str:
    return hashlib.sha256(bytes.fromhex(left_hex) + bytes.fromhex(right_hex)).hexdigest()


class _Node:
    __slots__ = ("id", "label", "level", "parent_id", "side", "left", "right",
                 "digest", "duplicate_of", "data")

    def __init__(self, node_id: int, label: str, level: int, data: Optional[str] = None):
        self.id = node_id
        self.label = label
        self.level = level
        self.parent_id: Optional[int] = None
        self.side: Optional[str] = None
        self.left: Optional[int] = None
        self.right: Optional[int] = None
        self.digest: Optional[str] = None
        self.duplicate_of: Optional[int] = None
        self.data = data


class _Tree:
    def __init__(self, leaves: List[str]):
        self.leaves = list(leaves)
        self.nodes: Dict[int, _Node] = {}
        self.leaf_ids: List[int] = []
        self.levels: List[List[int]] = []   # node ids per real level
        self.duplicate_ids: List[int] = []
        self.root_id = 0
        self._build_structure()

    def _new(self, label: str, level: int, data: Optional[str] = None) -> _Node:
        node_id = len(self.nodes)
        node = _Node(node_id, label, level, data)
        self.nodes[node_id] = node
        return node

    def _build_structure(self) -> None:
        current: List[int] = []
        for index, data in enumerate(self.leaves):
            node = self._new(data if data != "" else '""', 0, data)
            self.leaf_ids.append(node.id)
            current.append(node.id)
        self.levels.append(list(current))
        level = 0
        while len(current) > 1:
            level += 1
            next_level: List[int] = []
            i = 0
            while i < len(current):
                left = self.nodes[current[i]]
                if i + 1 < len(current):
                    right = self.nodes[current[i + 1]]
                    i += 2
                else:
                    right = self._new(left.label, left.level, left.data)
                    right.duplicate_of = left.id
                    self.duplicate_ids.append(right.id)
                    i += 1
                parent = self._new(f"H{level}", level)
                parent.left = left.id
                parent.right = right.id
                left.parent_id = parent.id
                left.side = "left"
                right.parent_id = parent.id
                right.side = "right"
                next_level.append(parent.id)
            self.levels.append(list(next_level))
            current = next_level
        # Duplicate nodes live at the depth of the node they copy, so re-group
        # the recorded levels to include them for snapshot/traversal purposes.
        self.root_id = current[0]

    def hash_all(self) -> None:
        """Fill every digest silently (used for oracles and tamper baselines)."""
        for node in self.nodes.values():
            node.digest = None
        for node_id in self.leaf_ids:
            node = self.nodes[node_id]
            node.digest = sha256_hex(node.data or "")
        # Every child and every duplicate points at a node with a lower id, so
        # creation order is a valid bottom-up evaluation order.
        for node_id in sorted(self.nodes):
            if node_id < len(self.leaves):
                continue
            node = self.nodes[node_id]
            if node.duplicate_of is not None:
                node.digest = self.nodes[node.duplicate_of].digest
            else:
                left = self.nodes[node.left]
                right = self.nodes[node.right]
                node.digest = combine_hex(left.digest, right.digest)

    def snapshot(self) -> Dict[str, Any]:
        nodes = []
        for node_id in sorted(self.nodes):
            node = self.nodes[node_id]
            nodes.append({
                "id": node.id,
                "label": node.label,
                "parent_id": node.parent_id,
                "side": node.side,
                "sublabel": node.digest[:8] if node.digest else PENDING,
                "full_hash": node.digest,
                "duplicate_of": node.duplicate_of,
            })
        return {"nodes": nodes, "root_id": self.root_id}

    def metrics(self) -> Dict[str, Any]:
        height = 0
        if self.leaf_ids:
            height = 1
            node = self.nodes[self.leaf_ids[0]]
            while node.parent_id is not None:
                height += 1
                node = self.nodes[node.parent_id]
        root = self.nodes[self.root_id].digest
        return {
            "leaves": len(self.leaves),
            "nodes": len(self.nodes),
            "levels": height,
            "root": root,
            "root_short": root[:8] if root else PENDING,
        }

    def path_to_root(self, leaf_index: int) -> List[int]:
        path = [self.leaf_ids[leaf_index]]
        while self.nodes[path[-1]].parent_id is not None:
            path.append(self.nodes[path[-1]].parent_id)
        return path


class _Tracer:
    def __init__(self, tree: _Tree):
        self.tree = tree
        self.steps: List[Dict[str, Any]] = []
        self.mismatch_ids: List[int] = []

    def add(self, step_type: str, note: str,
            payload: Optional[Dict[str, Any]] = None,
            roles: Optional[Dict[str, List[int]]] = None) -> None:
        merged = dict(roles or {})
        if self.mismatch_ids:
            merged["mismatch"] = sorted(
                set(merged.get("mismatch", [])) | set(self.mismatch_ids))
        step = make_step(
            step_type,
            [],
            self.tree.snapshot(),
            note,
            kind="tree",
            payload=payload or {},
            **merged,
        )
        self.steps.append(step)
        if len(self.steps) > validation.MAX_MERKLE_STEPS:
            raise ValidationError(
                f"Operation produces too many steps (limit {validation.MAX_MERKLE_STEPS})",
                field="leaves",
            )


def _build_tree(leaves: List[str], tracer: Optional[_Tracer] = None) -> _Tree:
    tree = tracer.tree if tracer is not None else _Tree(leaves)
    if tracer is None:
        tree.hash_all()
        return tree

    tracer.add(
        "build_start",
        f"Build a Merkle tree over {len(leaves)} block(s).",
        payload={"leaves": len(leaves), "nodes": len(tree.nodes)},
    )

    for index, node_id in enumerate(tree.leaf_ids):
        node = tree.nodes[node_id]
        node.digest = sha256_hex(node.data or "")
        tracer.add(
            "leaf_hash",
            f"Leaf {index}: SHA-256(\"{node.data}\") = {node.digest[:8]}...",
            payload={"index": index, "data": node.data, "digest": node.digest},
            roles={"highlighted": [node_id]},
        )

    # Process parents level by level, bottom-up. Duplicates are created during
    # structure construction; their copy step is emitted where they occur.
    for level_index in range(1, len(tree.levels)):
        parent_ids = tree.levels[level_index]
        # level 0 duplicates belong to the leaf level and are handled with the
        # level-1 parents below; use creation order to interleave correctly.
        for parent_id in parent_ids:
            parent = tree.nodes[parent_id]
            for child_id in (parent.left, parent.right):
                child = tree.nodes[child_id]
                if (child.duplicate_of is not None
                        and child.digest is None):
                    original = tree.nodes[child.duplicate_of]
                    child.digest = original.digest
                    tracer.add(
                        "duplicate_last",
                        f"Odd node count: duplicate {original.label} to pair with itself.",
                        payload={
                            "original": original.id,
                            "duplicate": child.id,
                            "digest": child.digest,
                            "level": child.level,
                        },
                        roles={"created": [child.id]},
                    )
            left = tree.nodes[parent.left]
            right = tree.nodes[parent.right]
            parent.digest = combine_hex(left.digest, right.digest)
            tracer.add(
                "pair_hash",
                f"{parent.label}: SHA-256({left.label} hash || {right.label} hash) = "
                f"{parent.digest[:8]}...",
                payload={
                    "level": level_index,
                    "left": left.id,
                    "right": right.id,
                    "digest": parent.digest,
                },
                roles={"highlighted": [parent_id], "matched": [left.id, right.id]},
            )
        tracer.add(
            "level_done",
            f"Level {level_index} complete.",
            payload={"level": level_index, "nodes": len(parent_ids)},
        )

    tracer.add(
        "root_ready",
        f"Merkle root: {tree.nodes[tree.root_id].digest[:8]}...",
        payload={"root": tree.nodes[tree.root_id].digest,
                 "root_short": tree.nodes[tree.root_id].digest[:8]},
        roles={"selected": [tree.root_id]},
    )
    tracer.add("build_done", "Merkle tree built.", payload=tree.metrics())
    return tree


def merkle_build_steps(leaves: List[str]) -> Dict[str, Any]:
    tree = _Tree(leaves)
    tracer = _Tracer(tree)
    _build_tree(leaves, tracer)
    return {
        "steps": tracer.steps,
        "final_tree": tree.snapshot(),
        "metrics": tree.metrics(),
        "metadata": {"hash_algorithm": "SHA-256", "display_hex": 8},
    }


def merkle_tamper_steps(leaves: List[str], index: int, new_data: str) -> Dict[str, Any]:
    original = _Tree(leaves)
    original.hash_all()

    tree = _Tree(leaves)
    tree.hash_all()
    tracer = _Tracer(tree)

    node_path = tree.path_to_root(index)
    leaf = tree.nodes[node_path[0]]
    old_data = leaf.data
    old_digest = leaf.digest
    new_digest = sha256_hex(new_data)
    changed = (new_data != old_data)

    leaf.data = new_data
    leaf.label = new_data if new_data != "" else '""'
    leaf.digest = new_digest
    if changed:
        tracer.mismatch_ids.append(leaf.id)
    leaf_roles = {"mismatch": [leaf.id]} if changed else {"matched": [leaf.id]}
    tracer.add(
        "tamper_edit",
        (f"Edit block {index}: \"{old_data}\" -> \"{new_data}\"."
         if changed else f"Block {index} is unchanged."),
        payload={
            "index": index,
            "old_data": old_data,
            "new_data": new_data,
            "old_digest": old_digest,
            "new_digest": new_digest,
            "changed": changed,
        },
        roles=leaf_roles,
    )

    # If the edited leaf is the last node of an odd level, its sibling is its
    # own duplicate and must change with it.
    parent_id = leaf.parent_id
    if parent_id is not None:
        parent = tree.nodes[parent_id]
        sibling_id = parent.right if parent.left == leaf.id else parent.left
        sibling = tree.nodes[sibling_id]
        if sibling.duplicate_of == leaf.id and changed:
            sibling.digest = leaf.digest
            sibling.data = new_data
            sibling.label = leaf.label
            tracer.mismatch_ids.append(sibling.id)

    recomputed = 0
    for node_id in node_path[1:]:
        node = tree.nodes[node_id]
        left = tree.nodes[node.left]
        right = tree.nodes[node.right]

        before = node.digest
        after = combine_hex(left.digest, right.digest)

        tracer.add(
            "recompute",
            f"Recompute {node.label} from its two children.",
            payload={
                "node": node.id,
                "left": left.id,
                "right": right.id,
                "sibling_reused": True,
            },
            roles={"highlighted": [node.id], "reused": [left.id, right.id]},
        )

        node.digest = after
        recomputed += 1
        if changed:
            # If this node is the last node of an odd level, its duplicate is
            # a sibling in the next parent and changes with it.
            if node.parent_id is not None:
                parent = tree.nodes[node.parent_id]
                sibling_id = parent.right if parent.left == node.id else parent.left
                sibling = tree.nodes[sibling_id]
                if sibling.duplicate_of == node.id:
                    sibling.digest = after
                    if sibling.id not in tracer.mismatch_ids:
                        tracer.mismatch_ids.append(sibling.id)
            if node.id not in tracer.mismatch_ids:
                tracer.mismatch_ids.append(node.id)
            tracer.add(
                "mismatch",
                f"{node.label} hash changed: {before[:8]}... -> {after[:8]}...",
                payload={"node": node.id, "old_digest": before, "new_digest": after},
                roles={"mismatch": [node.id]},
            )
        else:
            tracer.add(
                "match",
                f"{node.label} hash is unchanged.",
                payload={"node": node.id, "digest": after},
                roles={"matched": [node.id]},
            )

    original_root = original.nodes[original.root_id].digest
    new_root = tree.nodes[tree.root_id].digest
    root_changed = original_root != new_root
    tracer.add(
        "root_compare",
        ("Merkle roots differ: the tamper was detected."
         if root_changed else "Merkle roots match: no change detected."),
        payload={
            "original_root": original_root,
            "new_root": new_root,
            "changed": root_changed,
        },
        roles={"mismatch": [tree.root_id]} if root_changed else {"matched": [tree.root_id]},
    )

    edited = list(leaves)
    edited[index] = new_data
    fresh = _Tree(edited)
    fresh.hash_all()
    matches_full_rebuild = fresh.nodes[fresh.root_id].digest == new_root

    metrics = tree.metrics()
    metrics.update({
        "recomputed": recomputed,
        "total_internal": len(tree.nodes) - len(tree.leaves),
        "root_changed": root_changed,
        "original_root": original_root,
        "new_root": new_root,
        "matches_full_rebuild": matches_full_rebuild,
    })
    tracer.add("tamper_done", "Tamper walk complete.", payload=dict(metrics))

    return {
        "steps": tracer.steps,
        "final_tree": tree.snapshot(),
        "metrics": metrics,
        "metadata": {
            "hash_algorithm": "SHA-256",
            "display_hex": 8,
            "index": index,
            "changed": changed,
        },
    }

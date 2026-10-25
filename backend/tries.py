"""Trie trace generator (Phase D, POST /trie)."""

from typing import Any, Dict, List, Optional

import validation
from tracing import make_step
from validation import ValidationError


class TrieNode:
    __slots__ = ("id", "letter", "children", "terminal")

    def __init__(self, node_id: int, letter: str = ""):
        self.id = node_id
        self.letter = letter
        self.children: Dict[str, "TrieNode"] = {}
        self.terminal = False


def _snapshot(root: TrieNode) -> Dict[str, Any]:
    nodes: List[Dict[str, Any]] = []

    def walk(node: TrieNode, parent_id: Optional[int]):
        nodes.append({
            "id": node.id,
            "label": "root" if node.id == 0 else node.letter,
            "parent_id": parent_id,
            "side": None,
            "sublabel": None,
            "terminal": bool(node.terminal),
        })
        for letter in sorted(node.children):
            walk(node.children[letter], node.id)

    walk(root, None)
    return {"nodes": nodes, "root_id": root.id}


def _collect_words(node: TrieNode, prefix: str, out: List[str]) -> None:
    if node.terminal:
        out.append(prefix)
    for letter in sorted(node.children):
        _collect_words(node.children[letter], prefix + letter, out)


def _all_words(root: TrieNode) -> List[str]:
    out: List[str] = []
    _collect_words(root, "", out)
    return out


def _build_trie(ops: List[Dict[str, Any]]):
    root = TrieNode(0)
    next_id = 1
    words = set()
    for op in ops:
        word = op["word"]
        if word in words:
            raise ValidationError(f"Duplicate word: {word} already exists", field="word")
        words.add(word)
        node = root
        for letter in word:
            child = node.children.get(letter)
            if child is None:
                child = TrieNode(next_id, letter)
                next_id += 1
                node.children[letter] = child
            node = child
        node.terminal = True
    return root, next_id


def _tracer_step(step_type: str, root: TrieNode, note: str, **extra) -> Dict[str, Any]:
    return make_step(step_type, [], _snapshot(root), note, kind="tree", **extra)


def _cap_steps(steps: List[Dict[str, Any]], field: str = "word") -> None:
    if len(steps) > validation.MAX_TRIE_STEPS:
        raise ValidationError(
            f"Operation produces too many steps (limit {validation.MAX_TRIE_STEPS})",
            field=field,
        )


def _metrics(root: TrieNode, words: List[str], created: int, reused: int) -> Dict[str, Any]:
    nodes = _snapshot(root)["nodes"]
    letters_total = sum(len(w) for w in words)
    node_count = len(nodes)
    return {
        "nodes": node_count,
        "words": len(words),
        "created": created,
        "reused": reused,
        "letters_total": letters_total,
        "compression": {
            "letters_total": letters_total,
            "nodes_without_root": max(0, node_count - 1),
        },
    }


def trie_op_steps(algorithm: str, ops: Optional[List[Dict[str, Any]]] = None,
                  word: Optional[str] = None, prefix: Optional[str] = None) -> Dict[str, Any]:
    ops = ops or []
    root, next_id = _build_trie(ops)
    words = _all_words(root)
    steps: List[Dict[str, Any]] = []

    if algorithm == "trie_insert":
        if word is None:
            raise ValidationError("Missing 'word' for trie_insert", field="word")
        if word in words:
            raise ValidationError(f"Duplicate word: {word} already exists", field="word")

        node = root
        path: List[int] = [root.id]
        created = 0
        reused = 0
        last_is_new = False
        for depth, letter in enumerate(word):
            child = node.children.get(letter)
            if child is None:
                child = TrieNode(next_id, letter)
                next_id += 1
                node.children[letter] = child
                created += 1
                last_is_new = True
                steps.append(_tracer_step(
                    "node_created", root,
                    f"Create node '{letter}' at depth {depth + 1}.",
                    created=[child.id],
                    payload={"letter": letter, "depth": depth + 1, "path": list(path), "word": word},
                ))
            else:
                reused += 1
                last_is_new = False
                steps.append(_tracer_step(
                    "node_reused", root,
                    f"Reuse node '{letter}' at depth {depth + 1}.",
                    reused=[child.id],
                    payload={"letter": letter, "depth": depth + 1, "path": list(path), "word": word},
                ))
            path.append(child.id)
            node = child

        node.terminal = True
        steps.append(_tracer_step(
            "mark_end", root,
            f"Mark the end of '{word}' (terminal node {node.id}).",
            selected=[node.id],
            payload={"word": word, "was_new_node": last_is_new},
        ))
        steps.append(_tracer_step(
            "insert_done", root,
            f"Inserted '{word}': {created} created, {reused} reused.",
            payload={"created_count": created, "reused_count": reused},
        ))
        final_words = sorted(set(words) | {word})
        if len(_snapshot(root)["nodes"]) > validation.MAX_TRIE_NODES:
            raise ValidationError(
                f"Trie would exceed {validation.MAX_TRIE_NODES} nodes", field="word"
            )
        _cap_steps(steps)
        metrics = _metrics(root, final_words, created, reused)
        metadata = {"normalized_word": word}
        return {"steps": steps, "final_tree": _snapshot(root), "metrics": metrics, "metadata": metadata}

    if algorithm == "trie_search":
        if word is None:
            raise ValidationError("Missing 'word' for trie_search", field="word")
        node = root
        path = [root.id]
        found = True
        for depth, letter in enumerate(word):
            child = node.children.get(letter)
            if child is None:
                steps.append(_tracer_step(
                    "no_match", root,
                    f"No edge for '{letter}' at depth {depth + 1}; '{word}' is not stored.",
                    payload={"letter": letter, "depth": depth + 1, "failed_at": node.id},
                ))
                found = False
                steps.append(_tracer_step(
                    "not_found", root,
                    f"'{word}' not found: the path is missing.",
                    payload={"reason": "missing_edge"},
                ))
                break
            node = child
            path.append(node.id)
            steps.append(_tracer_step(
                "match", root,
                f"Follow edge '{letter}' to node {node.id}.",
                matched=[node.id],
                payload={"letter": letter, "depth": depth + 1, "path": list(path), "word": word},
            ))
        if found:
            if node.terminal:
                steps.append(_tracer_step(
                    "found", root,
                    f"'{word}' is a stored word (terminal node {node.id}).",
                    selected=[node.id],
                    payload={"word": word, "node_id": node.id},
                ))
            else:
                steps.append(_tracer_step(
                    "not_found", root,
                    f"'{word}' is a path but not a marked word.",
                    payload={"reason": "not_a_word"},
                ))
        steps.append(_tracer_step(
            "search_done", root,
            f"Search for '{word}' complete.",
            payload={"word": word, "found": bool(found and node.terminal)},
        ))
        metrics = _metrics(root, words, 0, 0)
        _cap_steps(steps)
        return {"steps": steps, "final_tree": _snapshot(root), "metrics": metrics,
                "metadata": {"normalized_word": word}}

    if algorithm == "trie_prefix":
        if prefix is None:
            raise ValidationError("Missing 'prefix' for trie_prefix", field="prefix")
        node = root
        path = [root.id]
        missing = False
        for depth, letter in enumerate(prefix):
            child = node.children.get(letter)
            if child is None:
                steps.append(_tracer_step(
                    "no_match", root,
                    f"No edge for '{letter}' at depth {depth + 1}.",
                    payload={"letter": letter, "depth": depth + 1, "failed_at": node.id},
                ))
                missing = True
                break
            node = child
            path.append(node.id)
            steps.append(_tracer_step(
                "match", root,
                f"Follow edge '{letter}' to node {node.id}.",
                matched=[node.id],
                payload={"letter": letter, "depth": depth + 1, "path": list(path), "prefix": prefix},
            ))
        if missing:
            steps.append(_tracer_step(
                "prefix_missing", root,
                f"No stored word starts with '{prefix}'.",
                payload={"prefix": prefix},
            ))
            steps.append(_tracer_step(
                "prefix_done", root,
                f"0 completions for '{prefix}'.",
                payload={"prefix": prefix, "completions": [], "truncated": False},
            ))
            _cap_steps(steps)
            return {"steps": steps, "final_tree": _snapshot(root),
                    "metrics": _metrics(root, words, 0, 0),
                    "metadata": {"normalized_prefix": prefix, "completions": [], "truncated": False}}

        steps.append(_tracer_step(
            "prefix_matched", root,
            f"Prefix '{prefix}' ends at node {node.id}.",
            selected=[node.id],
            payload={"prefix": prefix, "node_id": node.id},
        ))
        completions: List[str] = []
        _collect_words(node, prefix, completions)
        completions.sort()
        truncated = len(completions) > 10
        completions = completions[:10]
        terminal_ids = []
        for completion in completions:
            n = root
            for letter in completion:
                n = n.children[letter]
            if n.terminal:
                terminal_ids.append(n.id)
        steps.append(_tracer_step(
            "prefix_done", root,
            f"{len(completions)} completion(s) for '{prefix}'" + (" (truncated)." if truncated else "."),
            selected=terminal_ids,
            matched=path,
            payload={"prefix": prefix, "completions": completions, "truncated": truncated},
        ))
        _cap_steps(steps)
        return {"steps": steps, "final_tree": _snapshot(root),
                "metrics": _metrics(root, words, 0, 0),
                "metadata": {"normalized_prefix": prefix, "completions": completions,
                             "truncated": truncated}}

    raise ValidationError(f"Unknown trie algorithm: {algorithm}", field="algorithm")

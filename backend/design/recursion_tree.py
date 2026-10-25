"""
design/recursion_tree.py - Recursion tree traces: merge sort, quicksort, fib naive/memo.
"""
import sys
sys.setrecursionlimit(100000)

try:
    from validation import ValidationError
except Exception:
    class ValidationError(Exception):
        def __init__(self, message, field="step", status_code=400):
            super().__init__(message)
            self.message = message
            self.field = field
            self.status_code = status_code

# ---------- helpers ----------

MAX_RECURSION_STEPS = 5000

def _call_node(counter, label, sublabel=None):
    return {"id": counter[0], "label": label, "sublabel": sublabel,
            "parent_id": None, "side": None, "pruned": False}


def _build_tree_nodes(node_map):
    # node_map: id -> dict with parent_id, side, etc. Already stored.
    return list(node_map.values())


def merge_sort_trace(arr):
    steps = []
    nodes = {}   # id -> node dict
    counter = [0]
    children = {}  # id -> list of child ids
    max_depth = [0]
    calls = [0]
    base_cases = [0]

    # We'll track node state for snapshot: nodes created so far.
    def snapshot(active_id=None):
        ns = []
        for nid, nd in nodes.items():
            role_highlighted = [nid] if nid == active_id else []
            n = dict(nd)
            n["_active"] = (nid == active_id)
            ns.append(n)
        # build tree snapshot nodes with parent links
        out_nodes = []
        for nid, nd in nodes.items():
            out_nodes.append({
                "id": nd["id"],
                "label": nd["label"],
                "sublabel": nd.get("sublabel"),
                "parent_id": nd.get("parent_id"),
                "side": nd.get("side"),
                "pruned": False,
            })
        return {"kind": "tree", "nodes": out_nodes, "root_id": 0 if nodes else None}

    def make_step(stype, node_ids, snap, note, **extra):
        roles = {"highlighted": [], "comparing": [], "rotating": [], "pruned": [],
                 "new_node": [], "selected": [], "created": [], "reused": [],
                 "matched": [], "probing": [], "mismatch": []}
        # type-based default
        if stype == "call":
            roles["new_node"] = list(node_ids)
            roles["highlighted"] = list(node_ids)
        elif stype in ("base_case",):
            roles["highlighted"] = list(node_ids)
        elif stype == "return":
            roles["highlighted"] = list(node_ids)
        elif stype == "merge":
            roles["highlighted"] = list(node_ids)
        extra_roles = extra.pop("_roles", None)
        if extra_roles:
            for k, v in extra_roles.items():
                roles[k] = v
        step = {"type": stype, "snapshot": snap, "annotation": note}
        step.update(roles)
        step.update(extra)
        return step

    result_value = None

    def ms(lo, hi, depth, parent_id, side):
        nonlocal result_value
        nid = counter[0]
        counter[0] += 1
        calls[0] += 1
        if depth > max_depth[0]:
            max_depth[0] = depth
        sl = f"{lo}–{hi}"
        node = {"id": nid, "label": sl, "sublabel": None,
                "parent_id": parent_id, "side": side, "pruned": False,
                "_lo": lo, "_hi": hi, "_depth": depth}
        nodes[nid] = node
        children[nid] = []
        if parent_id is not None:
            children[parent_id].append(nid)
        # call step
        slc = arr[lo:hi]
        snap = snapshot(nid)
        steps.append(make_step("call", [nid], snap, f"call merge_sort({lo}, {hi})",
                               lo=lo, hi=hi, slice=list(slc), depth=depth))
        if len(steps) >= MAX_RECURSION_STEPS:
                raise ValidationError("Trace exceeds maximum step count", field="array", status_code=400)
        if hi - lo <= 1:
            base_cases[0] += 1
            # base_case step
            snap = snapshot(nid)
            steps.append(make_step("base_case", [nid], snap, f"base case: size {hi-lo}",
                                   lo=lo, hi=hi))
            # return
            node["sublabel"] = str(arr[lo:hi])
            snap = snapshot(nid)
            steps.append(make_step("return", [nid], snap, f"return {arr[lo:hi]}",
                                   slice=list(arr[lo:hi])))
            return list(arr[lo:hi])
        mid = (lo + hi) // 2
        left = ms(lo, mid, depth + 1, nid, "left")
        if left is None and len(steps) >= MAX_RECURSION_STEPS:
            return None
        # if truncated guard
        right = ms(mid, hi, depth + 1, nid, "right")
        if right is None and len(steps) >= MAX_RECURSION_STEPS:
            return None
        # merge
        merged = sorted(arr[lo:hi])  # merge of two sorted halves
        # actual merge
        l = list(left) if left else []
        r = list(right) if right else []
        out = []
        i = j = 0
        while i < len(l) and j < len(r):
            if l[i] <= r[j]:
                out.append(l[i]); i += 1
            else:
                out.append(r[j]); j += 1
        out.extend(l[i:]); out.extend(r[j:])
        # write back
        for k, v in enumerate(out):
            arr[lo + k] = v
        snap = snapshot(nid)
        steps.append(make_step("merge", [nid], snap, f"merge {left} + {right} -> {out}",
                               left=list(left) if left else [], right=list(right) if right else [],
                               merged=list(out)))
        node["sublabel"] = str(out)
        snap = snapshot(nid)
        steps.append(make_step("return", [nid], snap, f"return {out}", slice=list(out)))
        return out

    arr_copy = list(arr)
    result_value = ms(0, len(arr_copy), 0, None, None)
    # recursion_done
    snap = snapshot()
    steps.append({
        "type": "recursion_done",
        "snapshot": snap,
        "annotation": "Recursion complete",
        "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
        "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
        "metrics": {"calls": calls[0], "max_depth": max_depth[0], "base_cases": base_cases[0],
                    "cache_hits": 0, "result": result_value},
    })
    # final tree nodes already in snapshot; final_tree = last snapshot nodes
    final_tree = snap
    return {"steps": steps, "final_tree": final_tree,
            "metrics": {"calls": calls[0], "max_depth": max_depth[0], "base_cases": base_cases[0],
                        "cache_hits": 0, "result": result_value},
            "metadata": {}}


def quick_sort_trace(arr):
    steps = []
    nodes = {}
    counter = [0]
    max_depth = [0]
    calls = [0]
    base_cases = [0]

    def snapshot(active_id=None):
        out_nodes = []
        for nid, nd in nodes.items():
            out_nodes.append({"id": nd["id"], "label": nd["label"], "sublabel": nd.get("sublabel"),
                              "parent_id": nd.get("parent_id"), "side": nd.get("side"), "pruned": False})
        return {"kind": "tree", "nodes": out_nodes, "root_id": 0 if nodes else None}

    def make_step(stype, node_ids, snap, note, **extra):
        roles = {"highlighted": [], "comparing": [], "rotating": [], "pruned": [],
                 "new_node": [], "selected": [], "created": [], "reused": [],
                 "matched": [], "probing": [], "mismatch": []}
        if stype == "call":
            roles["new_node"] = list(node_ids); roles["highlighted"] = list(node_ids)
        elif stype in ("base_case", "return", "partition"):
            roles["highlighted"] = list(node_ids)
        if stype == "partition":
            # selected role for pivot display handled via extra? node selected
            roles["selected"] = extra.get("pivot_node", [])
        step = {"type": stype, "snapshot": snap, "annotation": note}
        step.update(roles)
        step.update(extra)
        return step

    arr = list(arr)

    def partition(lo, hi, nid):
        pivot = arr[hi]
        i = lo - 1
        for j in range(lo, hi):
            pass
        # Lomuto
        i = lo - 1
        for j in range(lo, hi):
            if arr[j] <= pivot:
                i += 1
                arr[i], arr[j] = arr[j], arr[i]
        arr[i + 1], arr[hi] = arr[hi], arr[i + 1]
        return i + 1

    def qs(lo, hi, depth, parent_id, side):
        nid = counter[0]
        counter[0] += 1
        calls[0] += 1
        if depth > max_depth[0]:
            max_depth[0] = depth
        label = f"{lo}–{hi}"
        node = {"id": nid, "label": label, "sublabel": None,
                "parent_id": parent_id, "side": side, "pruned": False}
        nodes[nid] = node
        snap = snapshot(nid)
        steps.append(make_step("call", [nid], snap, f"call quick_sort({lo}, {hi})",
                               lo=lo, hi=hi, slice=list(arr[lo:hi+1]), depth=depth))
        if len(steps) >= MAX_RECURSION_STEPS:
            return
        if lo >= hi:
            base_cases[0] += 1
            snap = snapshot(nid)
            steps.append(make_step("base_case", [nid], snap, f"base case: size {hi-lo+1}"))
            node["sublabel"] = str(arr[lo:hi+1]) if lo <= hi else "[]"
            snap = snapshot(nid)
            steps.append(make_step("return", [nid], snap, f"return {arr[lo:hi+1]}",
                                   slice=list(arr[lo:hi+1]) if lo <= hi else []))
            return
        pi = partition(lo, hi, nid)
        # partition step
        node["sublabel"] = f"p={arr[pi]}"
        snap = snapshot(nid)
        steps.append(make_step("partition", [nid], snap,
                               f"partition: pivot {arr[pi]} at index {pi}",
                               pivot=arr[pi], pivot_index=pi,
                               left_range=[lo, pi-1], right_range=[pi+1, hi],
                               slice_after=list(arr[lo:hi+1]),
                               pivot_node=[nid]))
        # roles: selected on pivot display node? we put selected via pivot_node->selected? make_step partition didn't set selected. Fix: set selected role.
        # Rebuild last step roles selected
        steps[-1]["selected"] = [nid]
        qs(lo, pi - 1, depth + 1, nid, "left")
        if len(steps) >= MAX_RECURSION_STEPS:
            return
        qs(pi + 1, hi, depth + 1, nid, "right")
        if len(steps) >= MAX_RECURSION_STEPS:
            return
        node["sublabel"] = str(arr[lo:hi+1])
        snap = snapshot(nid)
        steps.append(make_step("return", [nid], snap, f"return {arr[lo:hi+1]}",
                               slice=list(arr[lo:hi+1])))

    qs(0, len(arr) - 1, 0, None, None)
    snap = snapshot()
    steps.append({
        "type": "recursion_done",
        "snapshot": snap,
        "annotation": "Recursion complete",
        "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
        "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
        "metrics": {"calls": calls[0], "max_depth": max_depth[0], "base_cases": base_cases[0],
                    "cache_hits": 0, "result": sorted(arr)},
    })
    final_tree = snap
    return {"steps": steps, "final_tree": final_tree,
            "metrics": {"calls": calls[0], "max_depth": max_depth[0], "base_cases": base_cases[0],
                        "cache_hits": 0, "result": sorted(arr)},
            "metadata": {}}


def _fib(n):
    # returns F(n)
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a


def fib_naive_trace(n):
    steps = []
    nodes = {}
    counter = [0]
    max_depth = [0]
    calls = [0]
    base_cases = [0]

    def snapshot(active_id=None):
        out_nodes = []
        for nid, nd in nodes.items():
            out_nodes.append({"id": nd["id"], "label": nd["label"], "sublabel": nd.get("sublabel"),
                              "parent_id": nd.get("parent_id"), "side": nd.get("side"), "pruned": False})
        return {"kind": "tree", "nodes": out_nodes, "root_id": 0 if nodes else None}

    def make_step(stype, node_ids, snap, note, **extra):
        roles = {"highlighted": [], "comparing": [], "rotating": [], "pruned": [],
                 "new_node": [], "selected": [], "created": [], "reused": [],
                 "matched": [], "probing": [], "mismatch": []}
        if stype == "call":
            roles["new_node"] = list(node_ids); roles["highlighted"] = list(node_ids)
        elif stype in ("base_case", "return", "cache_hit"):
            roles["highlighted"] = list(node_ids)
        if stype == "cache_hit":
            roles["reused"] = list(node_ids)
            roles["new_node"] = []
        step = {"type": stype, "snapshot": snap, "annotation": note}
        step.update(roles)
        step.update(extra)
        return step

    cache = {}
    # We need call counter in call order. fib_naive: F(n) calls fib(n-1)+fib(n-2).
    def fib(k, depth, parent_id, side):
        nid = counter[0]
        counter[0] += 1
        calls[0] += 1
        if depth > max_depth[0]:
            max_depth[0] = depth
        label = f"fib({k})"
        node = {"id": nid, "label": label, "sublabel": None,
                "parent_id": parent_id, "side": side, "pruned": False}
        nodes[nid] = node
        snap = snapshot(nid)
        steps.append(make_step("call", [nid], snap, f"call fib({k})", n=k, depth=depth))
        if len(steps) >= MAX_RECURSION_STEPS:
                raise ValidationError("Trace exceeds maximum step count", field="array", status_code=400)
        if k <= 1:
            base_cases[0] += 1
            val = k
            node["sublabel"] = str(val)
            snap = snapshot(nid)
            steps.append(make_step("base_case", [nid], snap, f"base case fib({k})={val}", n=k, value=val))
            snap = snapshot(nid)
            steps.append(make_step("return", [nid], snap, f"return {val}", n=k, value=val))
            return val
        a = fib(k - 1, depth + 1, nid, "left")
        if a is None and len(steps) >= MAX_RECURSION_STEPS:
            return None
        b = fib(k - 2, depth + 1, nid, "right")
        if b is None and len(steps) >= MAX_RECURSION_STEPS:
            return None
        val = a + b
        node["sublabel"] = str(val)
        snap = snapshot(nid)
        steps.append(make_step("return", [nid], snap, f"return {val}", n=k, value=val))
        return val

    result = fib(n, 0, None, None)
    snap = snapshot()
    steps.append({
        "type": "recursion_done",
        "snapshot": snap,
        "annotation": "Recursion complete",
        "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
        "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
        "metrics": {"calls": calls[0], "max_depth": max_depth[0], "base_cases": base_cases[0],
                    "cache_hits": 0, "result": result},
    })
    return {"steps": steps, "final_tree": snap,
            "metrics": {"calls": calls[0], "max_depth": max_depth[0], "base_cases": base_cases[0],
                        "cache_hits": 0, "result": result},
            "metadata": {}}


def fib_memo_trace(n):
    steps = []
    nodes = {}
    counter = [0]
    max_depth = [0]
    calls = [0]
    base_cases = [0]
    cache_hits = [0]
    memo = {}

    def snapshot(active_id=None):
        out_nodes = []
        for nid, nd in nodes.items():
            out_nodes.append({"id": nd["id"], "label": nd["label"], "sublabel": nd.get("sublabel"),
                              "parent_id": nd.get("parent_id"), "side": nd.get("side"), "pruned": False})
        return {"kind": "tree", "nodes": out_nodes, "root_id": 0 if nodes else None}

    def make_step(stype, node_ids, snap, note, **extra):
        roles = {"highlighted": [], "comparing": [], "rotating": [], "pruned": [],
                 "new_node": [], "selected": [], "created": [], "reused": [],
                 "matched": [], "probing": [], "mismatch": []}
        if stype == "call":
            roles["new_node"] = list(node_ids); roles["highlighted"] = list(node_ids)
        elif stype in ("base_case", "return", "cache_hit", "store"):
            roles["highlighted"] = list(node_ids)
        if stype == "cache_hit":
            roles["reused"] = list(node_ids)
        if stype == "store":
            roles["new_node"] = list(node_ids)
        step = {"type": stype, "snapshot": snap, "annotation": note}
        step.update(roles)
        step.update(extra)
        return step

    def fib(k, depth, parent_id, side):
        nid = counter[0]
        counter[0] += 1
        calls[0] += 1
        if depth > max_depth[0]:
            max_depth[0] = depth
        label = f"fib({k})"
        node = {"id": nid, "label": label, "sublabel": None,
                "parent_id": parent_id, "side": side, "pruned": False}
        nodes[nid] = node
        snap = snapshot(nid)
        steps.append(make_step("call", [nid], snap, f"call fib({k})", n=k, depth=depth))
        if len(steps) >= MAX_RECURSION_STEPS:
                raise ValidationError("Trace exceeds maximum step count", field="array", status_code=400)
        if k <= 1:
            base_cases[0] += 1
            val = k
            node["sublabel"] = str(val)
            snap = snapshot(nid)
            steps.append(make_step("base_case", [nid], snap, f"base case fib({k})={val}", n=k, value=val))
            snap = snapshot(nid)
            steps.append(make_step("return", [nid], snap, f"return {val}", n=k, value=val))
            return val
        # Base cases are deliberately not memoized.  A cache hit therefore
        # always represents a reused non-base result, matching the lesson and
        # metric definition rather than the implementation convenience.
        if k in memo:
            cache_hits[0] += 1
            val = memo[k]
            node["sublabel"] = "hit"
            snap = snapshot(nid)
            steps.append(make_step("cache_hit", [nid], snap, f"cache hit fib({k})={val}", n=k, value=val))
            snap = snapshot(nid)
            steps.append(make_step("return", [nid], snap, f"return {val}", n=k, value=val))
            return val
        a = fib(k - 1, depth + 1, nid, "left")
        if a is None and len(steps) >= MAX_RECURSION_STEPS:
            return None
        b = fib(k - 2, depth + 1, nid, "right")
        if b is None and len(steps) >= MAX_RECURSION_STEPS:
            return None
        val = a + b
        memo[k] = val
        node["sublabel"] = str(val)
        snap = snapshot(nid)
        steps.append(make_step("store", [nid], snap, f"store fib({k})={val}", n=k, value=val))
        snap = snapshot(nid)
        steps.append(make_step("return", [nid], snap, f"return {val}", n=k, value=val))
        return val

    result = fib(n, 0, None, None)
    snap = snapshot()
    steps.append({
        "type": "recursion_done",
        "snapshot": snap,
        "annotation": "Recursion complete",
        "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
        "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
        "metrics": {"calls": calls[0], "max_depth": max_depth[0], "base_cases": base_cases[0],
                    "cache_hits": cache_hits[0], "stores": len(memo), "result": result},
    })
    return {"steps": steps, "final_tree": snap,
            "metrics": {"calls": calls[0], "max_depth": max_depth[0], "base_cases": base_cases[0],
                        "cache_hits": cache_hits[0], "stores": len(memo), "result": result},
            "metadata": {}}


def run_recursion(algorithm, array=None, n=None):
    if algorithm == "merge_sort":
        arr = list(array)
        out = merge_sort_trace(arr)
        return out
    if algorithm == "quick_sort":
        arr = list(array)
        out = quick_sort_trace(arr)
        return out
    if algorithm == "fib_naive":
        return fib_naive_trace(n)
    if algorithm == "fib_memo":
        return fib_memo_trace(n)
    raise ValueError(algorithm)

"""
design/knapsack.py - 0/1 Knapsack: greedy, DP bottom-up, DP top-down, branch and bound.
"""
import sys
from fractions import Fraction

try:
    from validation import ValidationError
except Exception:
    class ValidationError(Exception):
        def __init__(self, message, field="step", status_code=400):
            super().__init__(message)
            self.message = message
            self.field = field
            self.status_code = status_code


MAX_KNAPSACK_STEPS = 50000

def _optimal_value(items, capacity):
    n = len(items)
    # independent DP
    dp = [0] * (capacity + 1)
    for i in range(n):
        w = items[i]["weight"]
        v = items[i]["value"]
        for c in range(capacity, w - 1, -1):
            if dp[c - w] + v > dp[c]:
                dp[c] = dp[c - w] + v
    return dp[capacity]


def _ratio_key(item, idx):
    # descending value/weight ratio; ties lower original index
    # return sort key for descending: (-ratio as Fraction, idx)
    return (Fraction(item["value"], item["weight"]), idx)


def greedy_trace(items, capacity):
    items = list(items)
    n = len(items)
    # sort by ratio desc, ties lower index
    order = sorted(range(n), key=lambda i: (-Fraction(items[i]["value"], items[i]["weight"]), i))
    # state
    states = [{"item": i, "weight": items[i]["weight"], "value": items[i]["value"],
               "ratio": float(Fraction(items[i]["value"], items[i]["weight"])),
               "state": "pending"} for i in order]
    steps = []
    remaining = capacity
    value = 0
    taken = []
    # greedy_sort step
    steps.append({
        "type": "greedy_sort",
        "snapshot": {"kind": "array", "order": [dict(s) for s in states], "remaining": remaining, "value": value},
        "annotation": "Sorted items by value/weight ratio",
        "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
        "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
    })
    for pos, idx in enumerate(order):
        # mark current pending -> decide
        if items[idx]["weight"] <= remaining:
            states[pos]["state"] = "taken"
            remaining -= items[idx]["weight"]
            value += items[idx]["value"]
            taken.append(idx)
            steps.append({
                "type": "greedy_take",
                "snapshot": {"kind": "array", "order": [dict(s) for s in states], "remaining": remaining, "value": value},
                "annotation": f"Take item {idx + 1} (fits)",
                "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
                "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
                "item": idx, "reason": None,
            })
        else:
            states[pos]["state"] = "skipped"
            steps.append({
                "type": "greedy_skip",
                "snapshot": {"kind": "array", "order": [dict(s) for s in states], "remaining": remaining, "value": value},
                "annotation": f"Skip item {idx + 1} (too heavy)",
                "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
                "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
                "item": idx, "reason": "too_heavy",
            })
    optimal = _optimal_value(items, capacity)
    steps.append({
        "type": "greedy_done",
        "snapshot": {"kind": "array", "order": [dict(s) for s in states], "remaining": remaining, "value": value},
        "annotation": "Greedy complete",
        "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
        "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
        "value": value, "items": taken, "optimal_value": optimal, "gap": optimal - value,
    })
    return {"steps": steps,
            "final_state": {"value": value, "items": taken, "weight": capacity - remaining},
            "metrics": {"value": value, "items": taken, "weight": capacity - remaining},
            "metadata": {"optimal_value": optimal}}


def dp_bottom_up_trace(items, capacity):
    items = list(items)
    n = len(items)
    cols = capacity + 1
    # dp table (n+1) x (cols), None = not filled
    dp = [[None] * cols for _ in range(n + 1)]
    for w in range(cols):
        dp[0][w] = 0
    steps = []
    # dp_init step
    flat0 = [dp[0][w] for w in range(cols)]
    # full flat with row0 filled, rest null
    flat = [0] * cols + [None] * (n * cols)
    steps.append({
        "type": "dp_init",
        "snapshot": {"kind": "grid", "rows": n + 1, "cols": cols,
                     "cells": list(flat), "row_labels": [f"i={i}" for i in range(n + 1)],
                     "col_labels": [str(w) for w in range(cols)]},
        "annotation": "Row 0 (no items) initialized to 0",
        "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
        "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
        "dp_source": [], "traceback": [],
    })
    # fill row by row
    for i in range(1, n + 1):
        wi = items[i - 1]["weight"]
        vi = items[i - 1]["value"]
        for w in range(cols):
            # candidate skip
            cand_skip = dp[i - 1][w]
            cand_take = None
            if wi <= w and dp[i - 1][w - wi] is not None:
                cand_take = vi + dp[i - 1][w - wi]
            if cand_take is not None and cand_take > cand_skip:
                chose = "take"
                val = cand_take
            else:
                chose = "skip"
                val = cand_skip
            dp[i][w] = val
            # cell index
            cell_idx = i * cols + w
            skip_src = (i - 1) * cols + w
            take_src = (i - 1) * cols + (w - wi) if (wi <= w) else None
            dp_source = [skip_src]
            if take_src is not None:
                dp_source.append(take_src)
            # snapshot flat
            flat = []
            for r in range(n + 1):
                for c in range(cols):
                    flat.append(dp[r][c])
            steps.append({
                "type": "dp_fill",
                "snapshot": {"kind": "grid", "rows": n + 1, "cols": cols,
                             "cells": list(flat), "row_labels": [f"i={r}" for r in range(n + 1)],
                             "col_labels": [str(c) for c in range(cols)]},
                "annotation": f"dp[{i}][{w}] = {val} ({chose})",
                "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [cell_idx],
                "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
                "dp_source": dp_source, "traceback": [],
                "i": i, "w": w, "item": i - 1,
                "candidate_skip": cand_skip, "candidate_take": cand_take, "chose": chose, "value": val,
            })
        steps.append({
            "type": "dp_row_done",
            "snapshot": {"kind": "grid", "rows": n + 1, "cols": cols,
                         "cells": [dp[r][c] for r in range(n + 1) for c in range(cols)],
                         "row_labels": [f"i={r}" for r in range(n + 1)],
                         "col_labels": [str(c) for c in range(cols)]},
            "annotation": f"Row {i} complete",
            "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
            "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
            "dp_source": [], "traceback": [],
            "row": i,
        })
    # traceback
    i = n
    w = capacity
    chosen = []
    steps.append({
        "type": "traceback_start",
        "snapshot": {"kind": "grid", "rows": n + 1, "cols": cols,
                     "cells": [dp[r][c] for r in range(n + 1) for c in range(cols)],
                     "row_labels": [f"i={r}" for r in range(n + 1)],
                     "col_labels": [str(c) for c in range(cols)]},
        "annotation": f"Start traceback at ({n}, {capacity})",
        "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
        "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
        "dp_source": [], "traceback": [i * cols + w],
        "i": i, "w": w,
    })
    while i > 0:
        took = (dp[i][w] != dp[i - 1][w])
        cell_idx = i * cols + w
        if took:
            chosen.append(i - 1)
        steps.append({
            "type": "traceback_step",
            "snapshot": {"kind": "grid", "rows": n + 1, "cols": cols,
                         "cells": [dp[r][c] for r in range(n + 1) for c in range(cols)],
                         "row_labels": [f"i={r}" for r in range(n + 1)],
                         "col_labels": [str(c) for c in range(cols)]},
            "annotation": f"i={i}, w={w}: {'take' if took else 'skip'} item {i}",
            "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
            "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
            "dp_source": [], "traceback": [cell_idx],
            "i": i, "w": w, "took": took, "item": i - 1,
        })
        if took:
            w -= items[i - 1]["weight"]
        i -= 1
    steps.append({
        "type": "traceback_done",
        "snapshot": {"kind": "grid", "rows": n + 1, "cols": cols,
                     "cells": [dp[r][c] for r in range(n + 1) for c in range(cols)],
                     "row_labels": [f"i={r}" for r in range(n + 1)],
                     "col_labels": [str(c) for c in range(cols)]},
        "annotation": "Traceback complete",
        "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
        "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
        "dp_source": [], "traceback": [],
        "items": list(reversed(chosen)),
    })
    chosen_items = list(reversed(chosen))
    total_value = sum(items[i]["value"] for i in chosen_items)
    total_weight = sum(items[i]["weight"] for i in chosen_items)
    steps.append({
        "type": "dp_done",
        "snapshot": {"kind": "grid", "rows": n + 1, "cols": cols,
                     "cells": [dp[r][c] for r in range(n + 1) for c in range(cols)],
                     "row_labels": [f"i={r}" for r in range(n + 1)],
                     "col_labels": [str(c) for c in range(cols)]},
        "annotation": "DP complete",
        "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
        "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
        "dp_source": [], "traceback": [],
    })
    return {"steps": steps,
            "final_state": {"value": dp[n][capacity], "items": chosen_items, "weight": total_weight,
                            "table": [dp[r][c] for r in range(n + 1) for c in range(cols)],
                            "rows": n + 1, "cols": cols},
            "metrics": {"value": dp[n][capacity], "items": chosen_items, "weight": total_weight,
                        "cells_computed": n * (capacity + 1)},
            "metadata": {"optimal_value": _optimal_value(items, capacity)}}


def dp_top_down_trace(items, capacity):
    items = list(items)
    n = len(items)
    cols = capacity + 1
    memo = {}  # (i,w) -> value
    # table grid (n+1)x(cols), None for uncomputed
    table = [[None] * cols for _ in range(n + 1)]
    for w in range(cols):
        table[0][w] = 0  # base row shown but not counted

    steps = []
    calls = [0]
    cache_hits = [0]
    stored = [0]

    def snap():
        return {"kind": "grid", "rows": n + 1, "cols": cols,
                "cells": [table[r][c] for r in range(n + 1) for c in range(cols)],
                "row_labels": [f"i={r}" for r in range(n + 1)],
                "col_labels": [str(c) for c in range(cols)]}

    def dp(i, w, depth, stack):
        calls[0] += 1
        # call step
        steps.append({
            "type": "call",
            "snapshot": snap(),
            "annotation": f"call dp({i}, {w})",
            "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
            "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
            "dp_source": [], "traceback": [],
            "i": i, "w": w, "depth": depth, "stack": list(stack),
        })
        if (i, w) in memo:
            cache_hits[0] += 1
            # cache_hit step: cell gets reused
            cell_idx = i * cols + w
            steps.append({
                "type": "cache_hit",
                "snapshot": snap(),
                "annotation": f"cache hit dp({i},{w})={memo[(i,w)]}",
                "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
                "selected": [], "created": [], "reused": [cell_idx], "matched": [], "probing": [], "mismatch": [],
                "dp_source": [], "traceback": [],
                "i": i, "w": w, "value": memo[(i, w)],
            })
            return memo[(i, w)]
        if i == 0:
            # base case
            steps.append({
                "type": "base_case",
                "snapshot": snap(),
                "annotation": f"base case dp(0,{w})=0",
                "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
                "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
                "dp_source": [], "traceback": [],
                "i": i, "w": w, "value": 0,
            })
            memo[(i, w)] = 0
            # not counted as stored cell (base row not counted)
            return 0
        wi = items[i - 1]["weight"]
        vi = items[i - 1]["value"]
        # skip source
        skip_val = dp(i - 1, w, depth + 1, stack + [(i, w)])
        if wi <= w:
            take_val = vi + dp(i - 1, w - wi, depth + 1, stack + [(i, w)])
        else:
            take_val = None
        if take_val is not None and take_val > skip_val:
            val = take_val
        else:
            val = skip_val
        memo[(i, w)] = val
        table[i][w] = val
        stored[0] += 1
        cell_idx = i * cols + w
        skip_src = (i - 1) * cols + w
        take_src = (i - 1) * cols + (w - wi) if (wi <= w) else None
        dp_source = [skip_src]
        if take_src is not None:
            dp_source.append(take_src)
        steps.append({
            "type": "memo_store",
            "snapshot": snap(),
            "annotation": f"store dp({i},{w})={val}",
            "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [cell_idx],
            "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
            "dp_source": dp_source, "traceback": [],
            "i": i, "w": w, "value": val, "candidate_skip": skip_val,
            "candidate_take": take_val,
        })
        # return
        steps.append({
            "type": "return",
            "snapshot": snap(),
            "annotation": f"return {val}",
            "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
            "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
            "dp_source": [], "traceback": [],
            "i": i, "w": w, "value": val,
        })
        return val

    result = dp(n, capacity, 0, [])
    # traceback over memo table (only cells that exist)
    i = n
    w = capacity
    chosen = []
    # traceback_start
    steps.append({
        "type": "traceback_start",
        "snapshot": snap(),
        "annotation": f"Start traceback at ({n}, {capacity})",
        "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
        "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
        "dp_source": [], "traceback": [i * cols + w],
        "i": i, "w": w,
    })
    while i > 0:
        took = (table[i][w] is not None and table[i][w] != table[i - 1][w]) if table[i-1][w] is not None else (table[i][w] is not None)
        # more correct: take iff dp[i][w] != dp[i-1][w]
        if table[i][w] is None:
            took = False
        else:
            prev = table[i-1][w] if table[i-1][w] is not None else 0
            took = (table[i][w] != prev)
        cell_idx = i * cols + w
        if took:
            chosen.append(i - 1)
        steps.append({
            "type": "traceback_step",
            "snapshot": snap(),
            "annotation": f"i={i}, w={w}: {'take' if took else 'skip'} item {i}",
            "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
            "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
            "dp_source": [], "traceback": [cell_idx],
            "i": i, "w": w, "took": took, "item": i - 1,
        })
        if took:
            w -= items[i - 1]["weight"]
        i -= 1
    steps.append({
        "type": "traceback_done",
        "snapshot": snap(),
        "annotation": "Traceback complete",
        "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
        "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
        "dp_source": [], "traceback": [],
        "items": list(reversed(chosen)),
    })
    steps.append({
        "type": "dp_done",
        "snapshot": snap(),
        "annotation": "DP complete",
        "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
        "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
        "dp_source": [], "traceback": [],
    })
    chosen_items = list(reversed(chosen))
    total_value = sum(items[i]["value"] for i in chosen_items)
    total_weight = sum(items[i]["weight"] for i in chosen_items)
    return {"steps": steps,
            "final_state": {"value": result, "items": chosen_items, "weight": total_weight,
                            "table": [table[r][c] for r in range(n + 1) for c in range(cols)],
                            "rows": n + 1, "cols": cols},
            "metrics": {"value": result, "items": chosen_items, "weight": total_weight,
                        "calls": calls[0], "cache_hits": cache_hits[0],
                        "cells_computed": stored[0], "table_size": n * (capacity + 1)},
            "metadata": {"optimal_value": _optimal_value(items, capacity)}}


def branch_and_bound_trace(items, capacity):
    items = list(items)
    n = len(items)
    # sort by ratio desc, ties lower index; metadata.order maps level -> original index
    order = sorted(range(n), key=lambda i: (-Fraction(items[i]["value"], items[i]["weight"]), i))
    sorted_items = [items[i] for i in order]
    # map level -> original index
    level_to_orig = {lvl: order[lvl] for lvl in range(n)}

    steps = []
    # node storage
    nodes = {}  # id -> node dict
    counter = [0]
    best_value = [0]
    best_items_sorted = [[]]  # indices in sorted order? we track original indices
    best_original = [[]]
    nodes_expanded = [0]
    pruned_capacity = [0]
    pruned_bound = [0]
    best_updates = [0]

    # We'll do DFS iterative/recursive. take branch first.
    # Node: level, weight, value, bound, decision, item (sorted index at this level), parent_id, side
    def compute_bound(level, weight, value):
        # remaining capacity
        rem = capacity - weight
        if rem < 0:
            return None
        # greedy fill of items after level (level..n-1 in sorted order) 
        # items from `level` onward are the remaining (since node at level has decided first `level` items)
        b = value
        w = weight
        for j in range(level, n):
            it = sorted_items[j]
            if it["weight"] <= capacity - w:
                b += it["value"]
                w += it["weight"]
            else:
                # fractional part
                rem_cap = capacity - w
                if rem_cap > 0 and it["weight"] > 0:
                    frac = Fraction(rem_cap, it["weight"])
                    b += it["value"] * frac
                break
        return b

    # recursive DFS
    sys.setrecursionlimit(100000)
    def dfs(level, weight, value, parent_id, side, decision, item_sorted_idx):
        nid = counter[0]
        counter[0] += 1
        bound = compute_bound(level, weight, value)
        # expand step
        nodes[nid] = {
            "id": nid, "label": ("root" if level == 0 else ("take " if decision == "take" else "skip ") + str(item_sorted_idx + 1)) if level > 0 else "root",
            "sublabel": (f"b:{float(bound):.4f}" if bound is not None else "—"),
            "parent_id": parent_id, "side": side, "pruned": False,
            "_bound": bound, "_level": level, "_weight": weight, "_value": value,
        }
        # fix label for non-root
        if level > 0:
            nodes[nid]["label"] = ("take " if decision == "take" else "skip ") + str(item_sorted_idx + 1)
        else:
            nodes[nid]["label"] = "root"
        item_orig = level_to_orig[level - 1] if level > 0 else None
        # Actually item reference for node: the item decided at parent level? 
        # Per spec node at level L has decided first L sorted items. The edge decision corresponds to item at level-1.
        # We'll store item as the sorted index decided to reach this node (level-1).
        item_ref = (level - 1) if level > 0 else None
        # fix sublabel bound format: "b:76" not float? spec example "b:76". Serialize bounds as floats rounded to 4 dp but display maybe "b:76.0"? 
        # We'll keep sublabel "b:{round(bound,4)}" trimming. Use float.
        if bound is not None:
            # trim trailing zeros
            s = f"{float(bound):.4f}".rstrip("0").rstrip(".")
            nodes[nid]["sublabel"] = f"b:{s}"
        else:
            nodes[nid]["sublabel"] = "—"
        snap_nodes = []
        for k, nd in nodes.items():
            snap_nodes.append({"id": nd["id"], "label": nd["label"], "sublabel": nd["sublabel"],
                               "parent_id": nd["parent_id"], "side": nd["side"], "pruned": nd["pruned"]})
        snap = {"kind": "tree", "nodes": snap_nodes, "root_id": 0}
        item_payload = item_ref  # sorted index? spec says item reference. Use original index? 
        # spec: item reference. Use original 0-based item index. level_to_orig[level-1].
        item_orig_idx = level_to_orig[level - 1] if level > 0 else None
        steps.append({
            "type": "expand",
            "snapshot": snap,
            "annotation": f"Expand node {nid}",
            "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [nid],
            "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
            "node_id": nid, "parent_id": parent_id, "level": level,
            "weight": weight, "value": value,
            "bound": (float(round(bound, 4)) if bound is not None else None),
            "decision": decision, "item": item_orig_idx,
            "best_value": best_value[0],
        })
        if len(steps) >= MAX_KNAPSACK_STEPS:
                raise ValidationError("Trace exceeds maximum step count", field="items", status_code=400)
        nodes_expanded[0] += 1
        # (2) over capacity
        if weight > capacity:
            nodes[nid]["pruned"] = True
            pruned_capacity[0] += 1
            # prune step
            snap2 = {"kind": "tree", "nodes": [{"id": nd["id"], "label": nd["label"], "sublabel": nd["sublabel"],
                       "parent_id": nd["parent_id"], "side": nd["side"], "pruned": nd["pruned"]} for nd in nodes.values()],
                     "root_id": 0}
            steps.append({
                "type": "prune",
                "snapshot": snap2,
                "annotation": f"Prune node {nid}: over capacity",
                "highlighted": [], "comparing": [], "rotating": [], "pruned": [nid],
                "new_node": [], "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
                "reason": "over_capacity",
            })
            return
        # (3) update best
        if value > best_value[0]:
            best_value[0] = value
            best_original[0] = [level_to_orig[j] for j in range(level) if ... ]  # need track taken
            # track taken items: sorted indices 0..level-1 where decision take
            # We'll recompute from path? Instead pass taken list.
            best_updates[0] += 1
            # items in original indices: those sorted positions < level with take
            # We need taken list; pass as param. We'll refactor: dfs carries taken_sorted list.
            # For now store taken from closure variable? We'll change signature.
            snap2 = {"kind": "tree", "nodes": [{"id": nd["id"], "label": nd["label"], "sublabel": nd["sublabel"],
                       "parent_id": nd["parent_id"], "side": nd["side"], "pruned": nd["pruned"]} for nd in nodes.values()],
                     "root_id": 0}
            steps.append({
                "type": "update_best",
                "snapshot": snap2,
                "annotation": f"New best value {value}",
                "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
                "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
                "value": value, "items": [],  # filled below
            })
        # We'll handle taken items properly by changing dfs signature. For now, redo.

    # The above is getting messy with taken tracking. Let me rewrite dfs with taken param.
    # Reset
    nodes.clear()
    counter[0] = 0
    best_value[0] = 0
    best_original[0] = []
    nodes_expanded[0] = 0
    pruned_capacity[0] = 0
    pruned_bound[0] = 0
    best_updates[0] = 0
    steps.clear()

    best_taken_sorted = [[]]  # current best taken sorted indices

    def dfs2(level, weight, value, taken_sorted, parent_id, side, decision, item_sorted_idx):
        nid = counter[0]
        counter[0] += 1
        bound = compute_bound(level, weight, value)
        # label
        if level == 0:
            label = "root"
        else:
            label = ("take " if decision == "take" else "skip ") + str(item_sorted_idx + 1)
        if bound is not None:
            s = f"{float(bound):.4f}".rstrip("0").rstrip(".")
            sublabel = f"b:{s}"
        else:
            sublabel = "—"
        nodes[nid] = {"id": nid, "label": label, "sublabel": sublabel,
                      "parent_id": parent_id, "side": side, "pruned": False}
        snap_nodes = [{"id": nd["id"], "label": nd["label"], "sublabel": nd["sublabel"],
                       "parent_id": nd["parent_id"], "side": nd["side"], "pruned": nd["pruned"]} for nd in nodes.values()]
        snap = {"kind": "tree", "nodes": snap_nodes, "root_id": 0}
        item_orig_idx = level_to_orig[level - 1] if level > 0 else None
        steps.append({
            "type": "expand",
            "snapshot": snap,
            "annotation": f"Expand node {nid}",
            "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [nid],
            "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
            "node_id": nid, "parent_id": parent_id, "level": level,
            "weight": weight, "value": value,
            "bound": (float(round(bound, 4)) if bound is not None else None),
            "decision": decision, "item": item_orig_idx,
            "best_value": best_value[0],
        })
        if len(steps) >= MAX_KNAPSACK_STEPS:
                raise ValidationError("Trace exceeds maximum step count", field="items", status_code=400)
        nodes_expanded[0] += 1
        # over capacity
        if weight > capacity:
            nodes[nid]["pruned"] = True
            pruned_capacity[0] += 1
            snap2 = {"kind": "tree", "nodes": [{"id": nd["id"], "label": nd["label"], "sublabel": nd["sublabel"],
                       "parent_id": nd["parent_id"], "side": nd["side"], "pruned": nd["pruned"]} for nd in nodes.values()],
                     "root_id": 0}
            steps.append({
                "type": "prune",
                "snapshot": snap2,
                "annotation": f"Prune node {nid}: over capacity",
                "highlighted": [], "comparing": [], "rotating": [], "pruned": [nid],
                "new_node": [], "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
                "reason": "over_capacity",
            })
            return
        # update best
        if value > best_value[0]:
            best_value[0] = value
            best_taken_sorted[0] = list(taken_sorted)
            best_updates[0] += 1
            # original items
            best_items = [level_to_orig[si] for si in taken_sorted]
            snap2 = {"kind": "tree", "nodes": [{"id": nd["id"], "label": nd["label"], "sublabel": nd["sublabel"],
                       "parent_id": nd["parent_id"], "side": nd["side"], "pruned": nd["pruned"]} for nd in nodes.values()],
                     "root_id": 0}
            steps.append({
                "type": "update_best",
                "snapshot": snap2,
                "annotation": f"New best value {value}",
                "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
                "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
                "value": value, "items": best_items,
            })
        # leaf
        if level == n:
            return
        # bound prune
        if bound is not None and bound <= best_value[0]:
            # prune bound<=best
            nodes[nid]["pruned"] = True
            pruned_bound[0] += 1
            snap2 = {"kind": "tree", "nodes": [{"id": nd["id"], "label": nd["label"], "sublabel": nd["sublabel"],
                       "parent_id": nd["parent_id"], "side": nd["side"], "pruned": nd["pruned"]} for nd in nodes.values()],
                     "root_id": 0}
            steps.append({
                "type": "prune",
                "snapshot": snap2,
                "annotation": f"Prune node {nid}: bound <= best",
                "highlighted": [], "comparing": [], "rotating": [], "pruned": [nid],
                "new_node": [], "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
                "reason": "bound<=best",
            })
            return
        # otherwise visit take-child then skip-child
        # take branch: item at sorted index `level`
        it = sorted_items[level]
        # take child only if fits? We still expand even if over capacity (pruned later). 
        dfs2(level + 1, weight + it["weight"], value + it["value"],
             taken_sorted + [level], nid, "left", "take", level)
        if len(steps) >= MAX_KNAPSACK_STEPS:
                raise ValidationError("Trace exceeds maximum step count", field="items", status_code=400)
        dfs2(level + 1, weight, value, taken_sorted, nid, "right", "skip", level)
        if len(steps) >= MAX_KNAPSACK_STEPS:
                raise ValidationError("Trace exceeds maximum step count", field="items", status_code=400)

    dfs2(0, 0, 0, [], None, None, None, None)

    # best items original
    best_items_orig = [level_to_orig[si] for si in best_taken_sorted[0]]
    max_nodes = 2 ** (n + 1) - 1
    nodes_saved = max_nodes - len(nodes)
    steps.append({
        "type": "bb_done",
        "snapshot": {"kind": "tree", "nodes": [{"id": nd["id"], "label": nd["label"], "sublabel": nd["sublabel"],
                   "parent_id": nd["parent_id"], "side": nd["side"], "pruned": nd["pruned"]} for nd in nodes.values()],
                   "root_id": 0},
        "annotation": "Branch and bound complete",
        "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
        "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
        "value": best_value[0], "items": best_items_orig,
        "nodes_expanded": nodes_expanded[0],
        "pruned_capacity": pruned_capacity[0],
        "pruned_bound": pruned_bound[0],
        "best_updates": best_updates[0],
        "max_nodes": max_nodes,
        "nodes_saved": nodes_saved,
    })
    return {"steps": steps,
            "final_state": {"value": best_value[0], "items": best_items_orig,
                            "weight": sum(items[i]["weight"] for i in best_items_orig)},
            "metrics": {"value": best_value[0], "items": best_items_orig,
                        "weight": sum(items[i]["weight"] for i in best_items_orig),
                        "nodes_expanded": nodes_expanded[0],
                        "pruned_capacity": pruned_capacity[0],
                        "pruned_bound": pruned_bound[0],
                        "best_updates": best_updates[0],
                        "max_nodes": max_nodes,
                        "nodes_saved": nodes_saved},
            "metadata": {"optimal_value": _optimal_value(items, capacity),
                         "order": level_to_orig}}


def run_knapsack(algorithm, items, capacity):
    if algorithm == "knapsack_greedy":
        return greedy_trace(items, capacity)
    if algorithm == "knapsack_dp_bottom_up":
        return dp_bottom_up_trace(items, capacity)
    if algorithm == "knapsack_dp_top_down":
        return dp_top_down_trace(items, capacity)
    if algorithm == "knapsack_branch_bound":
        return branch_and_bound_trace(items, capacity)
    raise ValueError(algorithm)

"""
design/nqueens.py - N-Queens backtracking trace.
"""
try:
    from validation import ValidationError
except Exception:
    class ValidationError(Exception):
        def __init__(self, message, field="step", status_code=400):
            super().__init__(message)
            self.message = message
            self.field = field
            self.status_code = status_code


MAX_NQUEENS_STEPS = 22000

def _attacks(qr, qc, r, c):
    # returns list of attacker dicts if (r,c) is attacked by queen at (qr,qc)
    res = []
    if qc == c:
        res.append({"row": qr, "col": qc, "kind": "column"})
    if (qr - qc) == (r - c):
        res.append({"row": qr, "col": qc, "kind": "diagonal"})
    if (qr + qc) == (r + c):
        res.append({"row": qr, "col": qc, "kind": "anti_diagonal"})
    return res


def _is_safe(queens, r, c):
    attackers = []
    for qr, qc in enumerate(queens):
        ats = _attacks(qr, qc, r, c)
        attackers.extend(ats)
    return (len(attackers) == 0), attackers


def _threatened_cells(queens, n, from_row):
    # cells in rows >= from_row attacked by any placed queen
    cols = set()
    diags = set()
    anti = set()
    for qr, qc in enumerate(queens):
        cols.add(qc)
        diags.add(qr - qc)
        anti.add(qr + qc)
    threatened = {"columns": sorted(cols), "diagonals": sorted(diags), "anti_diagonals": sorted(anti)}
    return threatened


def run_nqueens(n, mode):
    queens = []  # column per filled row
    steps = []
    trials = [0]
    placements = [0]
    backtracks = [0]
    solutions = []
    max_depth = [0]

    def snapshot(row):
        return {"kind": "grid", "n": n, "queens": list(queens), "row": row}

    def make_step(stype, row, col, snap, note, **extra):
        roles = {"highlighted": [], "comparing": [], "rotating": [], "pruned": [],
                 "new_node": [], "selected": [], "created": [], "reused": [],
                 "matched": [], "probing": [], "mismatch": [],
                 "queen": [], "safe": [], "conflict": [], "threatened": [], "backtrack": []}
        cell_idx = row * n + col
        if stype == "conflict":
            roles["conflict"] = [cell_idx]
            roles["highlighted"] = [cell_idx]
        elif stype == "safe":
            roles["safe"] = [cell_idx]
            roles["highlighted"] = [cell_idx]
        elif stype == "place":
            roles["queen"] = [r * n + queens[r] for r in range(len(queens))]
            roles["highlighted"] = [cell_idx]
        elif stype == "backtrack":
            roles["backtrack"] = [cell_idx]
        thr_cells = []
        if queens:
            for rr in range(row, n):
                for cc in range(n):
                    attacked = False
                    for qr, qc in enumerate(queens):
                        if _attacks(qr, qc, rr, cc):
                            attacked = True
                            break
                    if attacked:
                        thr_cells.append(rr * n + cc)
        roles["threatened"] = thr_cells
        if stype not in ("conflict", "safe"):
            roles["queen"] = [r * n + queens[r] for r in range(len(queens))]
        step = {"type": stype, "snapshot": snap, "annotation": note}
        step.update(roles)
        step["row"] = row
        step["col"] = col
        step.update(extra)
        return step

    # recursive search
    def search(row):
        if row == n:
            sol_idx = len(solutions)
            solutions.append(list(queens))
            steps.append({
                "type": "solution",
                "snapshot": snapshot(row),
                "annotation": f"Solution {sol_idx + 1} found",
                "highlighted": [], "comparing": [], "rotating": [], "pruned": [],
                "new_node": [], "selected": [], "created": [], "reused": [], "matched": [],
                "probing": [], "mismatch": [], "queen": [r * n + queens[r] for r in range(n)],
                "safe": [], "conflict": [], "threatened": [], "backtrack": [],
                "solution_index": sol_idx, "columns": list(queens),
            })
            if max_depth[0] < row:
                max_depth[0] = row
            if mode == "first":
                return True  # stop
            return False
        if row > max_depth[0]:
            max_depth[0] = row
        for col in range(n):
            trials[0] += 1
            safe, attackers = _is_safe(queens, row, col)
            if not safe:
                steps.append(make_step("conflict", row, col, snapshot(row),
                                      f"Row {row}, column {col}: conflict",
                                      attackers=attackers))
            else:
                steps.append(make_step("safe", row, col, snapshot(row),
                                      f"Row {row}, column {col}: safe"))
                # place
                queens.append(col)
                placements[0] += 1
                steps.append(make_step("place", row, col, snapshot(row),
                                      f"Place queen at row {row}, column {col}"))
                # recurse
                stop = search(row + 1)
                if stop:
                    return True
                # backtrack
                removed_row = len(queens) - 1
                removed_col = queens.pop()
                backtracks[0] += 1
                steps.append(make_step("backtrack", removed_row, removed_col, snapshot(removed_row),
                                      f"Backtrack: remove queen from row {removed_row}, column {removed_col}"))
            if len(steps) >= MAX_NQUEENS_STEPS:
                raise ValidationError("Trace exceeds maximum step count", field="n", status_code=400)
        return False

    search(0)
    steps.append({
        "type": "nqueens_done",
        "snapshot": snapshot(0),
        "annotation": "N-Queens complete",
        "highlighted": [], "comparing": [], "rotating": [], "pruned": [],
        "new_node": [], "selected": [], "created": [], "reused": [], "matched": [],
        "probing": [], "mismatch": [], "queen": [], "safe": [], "conflict": [],
        "threatened": [], "backtrack": [],
        "solutions": solutions if mode == "all" else (solutions[:1] if solutions else []),
        "trials": trials[0],
        "placements": placements[0],
        "backtracks": backtracks[0],
        "max_depth": max_depth[0],
    })
    # cap solutions to first 100 for all mode
    sols = solutions if len(solutions) <= 100 else solutions[:100]
    return {"steps": steps,
            "final_state": {"solutions": sols, "count": len(solutions)},
            "metrics": {"solutions": len(solutions), "trials": trials[0],
                        "placements": placements[0], "backtracks": backtracks[0],
                        "max_depth": max_depth[0]},
            "metadata": {}}

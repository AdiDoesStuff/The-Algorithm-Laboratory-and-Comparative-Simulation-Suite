import itertools
import random

from app import app


def _post(path, body):
    c = app.test_client()
    r = c.post(path, json=body)
    assert r.status_code == 200, (path, r.status_code, r.get_data(as_text=True))
    return r.get_json()


def _brute_opt(items, cap):
    n = len(items)
    best = 0
    for mask in range(1 << n):
        w = sum(items[i]["weight"] for i in range(n) if mask & (1 << i))
        v = sum(items[i]["value"] for i in range(n) if mask & (1 << i))
        if w <= cap and v > best:
            best = v
    return best


def test_dp_optimal_random():
    rng = random.Random(123)
    for _ in range(200):
        n = rng.randint(1, 8)
        cap = rng.randint(1, 25)
        items = [{"weight": rng.randint(1, 50), "value": rng.randint(1, 999)} for _ in range(n)]
        # dp bottom-up
        d = _post("/knapsack", {"algorithm": "knapsack_dp_bottom_up", "items": items, "capacity": cap})
        assert d["metrics"]["value"] == _brute_opt(items, cap)
        # top-down
        d2 = _post("/knapsack", {"algorithm": "knapsack_dp_top_down", "items": items, "capacity": cap})
        assert d2["metrics"]["value"] == _brute_opt(items, cap)
        # bb
        d3 = _post("/knapsack", {"algorithm": "knapsack_branch_bound", "items": items, "capacity": cap})
        assert d3["metrics"]["value"] == _brute_opt(items, cap)
        # bottom-up table == top-down memo table at non-null
        t1 = d["final_state"]["table"]
        t2 = d2["final_state"]["table"]
        for a, b in zip(t1, t2):
            if a is not None and b is not None:
                assert a == b


def test_bb_hand_table():
    items = [{"weight": 4, "value": 40}, {"weight": 7, "value": 42},
             {"weight": 5, "value": 25}, {"weight": 3, "value": 12}]
    d = _post("/knapsack", {"algorithm": "knapsack_branch_bound", "items": items, "capacity": 10})
    assert d["metrics"]["value"] == 65
    assert d["metrics"]["nodes_expanded"] == 9
    assert d["metrics"]["pruned_capacity"] == 2
    assert d["metrics"]["pruned_bound"] == 2
    assert d["metrics"]["best_updates"] == 2
    assert d["metrics"]["max_nodes"] == 31
    assert d["metrics"]["nodes_saved"] == 22


def test_greedy_counterexample():
    items = [{"weight": 10, "value": 60}, {"weight": 20, "value": 100}, {"weight": 30, "value": 120}]
    d = _post("/knapsack", {"algorithm": "knapsack_greedy", "items": items, "capacity": 50})
    assert d["metrics"]["value"] == 160
    assert d["metadata"]["optimal_value"] == 220


def test_greedy_leq_optimal_random():
    rng = random.Random(99)
    for _ in range(100):
        n = rng.randint(1, 8)
        cap = rng.randint(1, 25)
        items = [{"weight": rng.randint(1, 50), "value": rng.randint(1, 999)} for _ in range(n)]
        d = _post("/knapsack", {"algorithm": "knapsack_greedy", "items": items, "capacity": cap})
        opt = _brute_opt(items, cap)
        assert d["metrics"]["value"] <= opt


def test_dp_traceback_sums():
    items = [{"weight": 4, "value": 40}, {"weight": 7, "value": 42},
             {"weight": 5, "value": 25}, {"weight": 3, "value": 12}]
    d = _post("/knapsack", {"algorithm": "knapsack_dp_bottom_up", "items": items, "capacity": 10})
    chosen = d["metrics"]["items"]
    assert sum(items[i]["value"] for i in chosen) == d["metrics"]["value"]
    assert sum(items[i]["weight"] for i in chosen) <= 10


def test_validation():
    c = app.test_client()
    assert c.post("/knapsack", json={"algorithm": "knapsack_greedy", "items": [], "capacity": 5}).status_code == 400
    assert c.post("/knapsack", json={"algorithm": "knapsack_greedy", "items": [{"weight": 1, "value": 1}], "capacity": 0}).status_code == 400
    assert c.post("/knapsack", json={"algorithm": "nope", "items": [{"weight": 1, "value": 1}], "capacity": 5}).status_code == 400
    assert c.get("/knapsack").status_code == 405


def test_step_cap(monkeypatch):
    import design.knapsack as kn
    monkeypatch.setattr(kn, "MAX_KNAPSACK_STEPS", 5)
    c = app.test_client()
    items = [{"weight": 1, "value": 1} for _ in range(8)]
    r = c.post("/knapsack", json={"algorithm": "knapsack_branch_bound", "items": items, "capacity": 25})
    assert r.status_code == 400

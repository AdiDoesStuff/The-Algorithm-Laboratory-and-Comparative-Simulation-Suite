import math

from app import app


def _post(path, body):
    c = app.test_client()
    r = c.post(path, json=body)
    assert r.status_code == 200, (path, r.status_code, r.get_data(as_text=True))
    return r.get_json()


def test_merge_sort_facts():
    arr = [5, 3, 8, 1, 9, 2, 7, 4]
    d = _post("/recursion", {"algorithm": "merge_sort", "array": arr})
    n = len(arr)
    assert d["metrics"]["calls"] == 2 * n - 1
    assert d["metrics"]["max_depth"] == math.ceil(math.log2(n))
    assert d["metrics"]["result"] == sorted(arr)


def test_quick_sort_sorted_chain():
    arr = list(range(1, 9))
    d = _post("/recursion", {"algorithm": "quick_sort", "array": arr})
    assert d["metrics"]["result"] == sorted(arr)
    # depth at least n-1 on sorted input
    assert d["metrics"]["max_depth"] >= len(arr) - 1


def test_fib_facts():
    for n in range(0, 11):
        d = _post("/recursion", {"algorithm": "fib_naive", "n": n})
        # F(n)
        def fib(x):
            a, b = 0, 1
            for _ in range(x):
                a, b = b, a + b
            return a
        assert d["metrics"]["result"] == fib(n)
    # call counts
    d = _post("/recursion", {"algorithm": "fib_naive", "n": 5})
    assert d["metrics"]["calls"] == 2 * (2 ** 5) - 1 or True  # placeholder
    # actual formula 2*F(n+1)-1
    def F(x):
        a, b = 0, 1
        for _ in range(x):
            a, b = b, a + b
        return a
    assert d["metrics"]["calls"] == 2 * F(6) - 1
    d = _post("/recursion", {"algorithm": "fib_naive", "n": 10})
    assert d["metrics"]["calls"] == 2 * F(11) - 1

    d = _post("/recursion", {"algorithm": "fib_memo", "n": 5})
    assert d["metrics"]["calls"] == 2 * 5 - 1
    d = _post("/recursion", {"algorithm": "fib_memo", "n": 10})
    assert d["metrics"]["calls"] == 2 * 10 - 1


def test_fib_memo_cache_hits():
    d = _post("/recursion", {"algorithm": "fib_memo", "n": 5})
    assert d["metrics"]["calls"] == 9
    assert d["metrics"]["base_cases"] == 3
    assert d["metrics"]["cache_hits"] == 2
    assert d["metrics"]["stores"] == 4


def test_fib_memo_metric_identity_for_trace_range():
    for n in range(2, 11):
        d = _post("/recursion", {"algorithm": "fib_memo", "n": n})
        metrics = d["metrics"]
        assert metrics["calls"] == metrics["stores"] + metrics["base_cases"] + metrics["cache_hits"]
        assert metrics["stores"] == n - 1
        if n >= 3:
            assert metrics["calls"] == 2 * n - 1
            assert metrics["base_cases"] == 3
            assert metrics["cache_hits"] == n - 3


def test_validation():
    c = app.test_client()
    assert c.post("/recursion", json={"algorithm": "merge_sort", "array": [1]}).status_code == 400
    assert c.post("/recursion", json={"algorithm": "merge_sort", "array": list(range(17))}).status_code == 400
    assert c.post("/recursion", json={"algorithm": "fib_naive", "n": 11}).status_code == 400
    assert c.post("/recursion", json={"algorithm": "fib_naive", "n": -1}).status_code == 400
    assert c.post("/recursion", json={"algorithm": "nope"}).status_code == 400
    assert c.get("/recursion").status_code == 405


def test_step_cap(monkeypatch):
    import design.recursion_tree as r
    monkeypatch.setattr(r, "MAX_RECURSION_STEPS", 5)
    c = app.test_client()
    r2 = c.post("/recursion", json={"algorithm": "fib_naive", "n": 10})
    assert r2.status_code == 400

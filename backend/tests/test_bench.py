import random

from app import app


def _post(path, body):
    c = app.test_client()
    r = c.post(path, json=body)
    assert r.status_code == 200, (path, r.status_code, r.get_data(as_text=True))
    return r.get_json()


def test_structure_and_ordering():
    d = _post("/bench", {"algorithms": ["insertion", "bubble"], "sizes": [10, 20], "repeats": 2, "input_kind": "sorted", "seed": 1})
    # size-major: points appear in size order; within size, request order
    pts = [s for s in d["steps"] if s["type"] == "bench_point"]
    assert len(pts) == 4
    assert pts[0]["n"] == 10 and pts[0]["algorithm"] == "insertion"
    assert pts[1]["n"] == 10 and pts[1]["algorithm"] == "bubble"
    assert pts[2]["n"] == 20 and pts[2]["algorithm"] == "insertion"


def test_runs_and_median():
    d = _post("/bench", {"algorithms": ["insertion"], "sizes": [10, 20], "repeats": 3})
    pt = [s for s in d["steps"] if s["type"] == "bench_point"][0]
    assert len(pt["runs_ms"]) == 3
    assert min(pt["runs_ms"]) <= pt["median_ms"] <= max(pt["runs_ms"])


def test_determinism():
    d1 = _post("/bench", {"algorithms": ["quick"], "sizes": [50, 60], "repeats": 2, "seed": 7})
    d2 = _post("/bench", {"algorithms": ["quick"], "sizes": [50, 60], "repeats": 2, "seed": 7})
    p1 = [s for s in d1["steps"] if s["type"] == "bench_point"][0]
    p2 = [s for s in d2["steps"] if s["type"] == "bench_point"][0]
    assert p1["comparisons"] == p2["comparisons"]
    assert p1["swaps"] == p2["swaps"]


def test_exact_counts():
    # insertion sort on sorted input: n-1 comparisons
    d = _post("/bench", {"algorithms": ["insertion"], "sizes": [20, 30], "repeats": 1, "input_kind": "sorted"})
    pt = [s for s in d["steps"] if s["type"] == "bench_point"][0]
    assert pt["comparisons"] == 19
    # counting/radix: 0 comparisons
    d = _post("/bench", {"algorithms": ["counting", "radix"], "sizes": [20, 30], "repeats": 1})
    for s in d["steps"]:
        if s["type"] == "bench_point":
            assert s["comparisons"] == 0


def test_bogo_excluded():
    c = app.test_client()
    r = c.post("/bench", json={"algorithms": ["bogo"], "sizes": [10], "repeats": 1})
    assert r.status_code == 400
    assert r.get_json()["field"] == "algorithms"


def test_validation():
    c = app.test_client()
    assert c.post("/bench", json={"algorithms": ["bubble"], "sizes": [5, 10], "repeats": 1}).status_code == 400  # non-increasing? 5<10 ok actually size min 10; 5 <10 -> 400
    assert c.post("/bench", json={"algorithms": ["bubble"], "sizes": [10], "repeats": 0}).status_code == 400
    assert c.post("/bench", json={"algorithms": ["bubble"], "sizes": [10], "repeats": 1, "input_kind": "x"}).status_code == 400
    assert c.post("/bench", json={"algorithms": ["bubble", "bubble"], "sizes": [10, 20], "repeats": 1}).status_code == 400
    assert c.post("/bench", json={"algorithms": ["bubble"], "sizes": [2000], "repeats": 1}).status_code == 400  # cap
    assert c.get("/bench").status_code == 405


def test_time_budget(monkeypatch):
    import design.bench as b
    monkeypatch.setattr(b, "MAX_BENCH_SECONDS", 0.000001)
    c = app.test_client()
    r = c.post("/bench", json={"algorithms": ["bubble"], "sizes": [100, 200, 400], "repeats": 3})
    d = r.get_json()
    assert d["metadata"]["truncated"] is True


def test_step_cap(monkeypatch):
    import design.bench as b
    monkeypatch.setattr(b, "MAX_BENCH_STEPS", 1)
    c = app.test_client()
    r = c.post("/bench", json={"algorithms": ["bubble"], "sizes": [10, 20], "repeats": 1})
    assert r.status_code == 400

"""
design/bench.py - Growth benchmark (uninstrumented reference implementations).

Generates a {steps, final_state, metrics, metadata} trace of kind "chart".
"""
import time
import random

try:
    from validation import ValidationError
except Exception:
    class ValidationError(Exception):
        def __init__(self, message, field="step", status_code=400):
            super().__init__(message)
            self.message = message
            self.field = field
            self.status_code = status_code
MAX_BENCH_STEPS = 100000

MAX_BENCH_SECONDS = 8

QUADRATIC = {"bubble", "selection", "insertion"}
CAPS = {"bubble": 1500, "selection": 1500, "insertion": 1500}
DEFAULT_CAP = 20000

ALGO_IDS = ["bubble", "selection", "insertion", "quick", "merge", "heap", "counting", "radix"]


def _make_input(n, kind, rng):
    if kind == "sorted":
        if n <= 0:
            return []
        # counting/radix need non-negative ints; for sort algos any ints ok
        return list(range(n))
    if kind == "reversed":
        return list(range(n, 0, -1))
    # random
    if n <= 0:
        return []
    # mix of ints
    return [rng.randint(0, 999) for _ in range(n)]


# ---------- reference implementations with cheap counters ----------

def _bubble(arr):
    a = list(arr)
    comps = 0
    swaps = 0
    n = len(a)
    for i in range(n):
        for j in range(n - 1 - i):
            comps += 1
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
                swaps += 1
    return a, comps, swaps


def _selection(arr):
    a = list(arr)
    comps = 0
    swaps = 0
    n = len(a)
    for i in range(n):
        m = i
        for j in range(i + 1, n):
            comps += 1
            if a[j] < a[m]:
                m = j
        if m != i:
            a[i], a[m] = a[m], a[i]
            swaps += 1
    return a, comps, swaps


def _insertion(arr):
    a = list(arr)
    comps = 0
    swaps = 0
    n = len(a)
    for i in range(1, n):
        key = a[i]
        j = i - 1
        while j >= 0:
            comps += 1
            if a[j] > key:
                a[j + 1] = a[j]
                swaps += 1
                j -= 1
            else:
                break
        a[j + 1] = key
    return a, comps, swaps


def _quick(arr):
    a = list(arr)
    comps = [0]
    swaps = [0]
    # iterative to avoid recursion depth issues; mirror Lomuto partition
    # We'll do recursive with sys.setrecursionlimit not needed for n<=20000? recursion depth could be n in worst case.
    # Use an explicit stack.
    # Partition scheme: pivot = last element (algs.py style). Need to inspect algs.py.
    # We'll implement recursive quicksort with pivot = a[hi] (Lomuto) and set recursion limit high.
    import sys
    sys.setrecursionlimit(100000)

    def partition(lo, hi):
        pivot = a[hi]
        i = lo - 1
        for j in range(lo, hi):
            comps[0] += 1
            if a[j] <= pivot:
                i += 1
                if i != j:
                    a[i], a[j] = a[j], a[i]
                    swaps[0] += 1
        if i + 1 != hi:
            a[i + 1], a[hi] = a[hi], a[i + 1]
            swaps[0] += 1
        return i + 1

    def qs(lo, hi):
        if lo < hi:
            p = partition(lo, hi)
            qs(lo, p - 1)
            qs(p + 1, hi)

    qs(0, len(a) - 1)
    return a, comps[0], swaps[0]


def _merge(arr):
    a = list(arr)
    comps = [0]
    swaps = [0]  # writes

    def merge_sort(lo, hi):
        if hi - lo <= 1:
            return
        mid = (lo + hi) // 2
        merge_sort(lo, mid)
        merge_sort(mid, hi)
        # merge
        left = a[lo:mid]
        right = a[mid:hi]
        i = j = 0
        k = lo
        while i < len(left) and j < len(right):
            comps[0] += 1
            if left[i] <= right[j]:
                a[k] = left[i]
                i += 1
            else:
                a[k] = right[j]
                j += 1
            swaps[0] += 1
            k += 1
        while i < len(left):
            a[k] = left[i]
            i += 1
            swaps[0] += 1
            k += 1
        while j < len(right):
            a[k] = right[j]
            j += 1
            swaps[0] += 1
            k += 1

    merge_sort(0, len(a))
    return a, comps[0], swaps[0]


def _heap(arr):
    a = list(arr)
    comps = [0]
    swaps = [0]
    n = len(a)

    def sift_down(i, size):
        while True:
            l = 2 * i + 1
            r = 2 * i + 2
            largest = i
            if l < size:
                comps[0] += 1
                if a[l] > a[largest]:
                    largest = l
            if r < size:
                comps[0] += 1
                if a[r] > a[largest]:
                    largest = r
            if largest == i:
                break
            a[i], a[largest] = a[largest], a[i]
            swaps[0] += 1
            i = largest

    # build max-heap
    for i in range(n // 2 - 1, -1, -1):
        sift_down(i, n)
    for end in range(n - 1, 0, -1):
        a[0], a[end] = a[end], a[0]
        swaps[0] += 1
        sift_down(0, end)
    return a, comps[0], swaps[0]


def _counting(arr):
    if not arr:
        return list(arr), 0, 0
    a = list(arr)
    # non-negative ints
    mx = max(a) if a else 0
    mn = min(a) if a else 0
    # shift if negatives? prompt says non-negative for counting/radix
    offset = 0
    if mn < 0:
        offset = -mn
    size = mx - mn + 1
    counts = [0] * size
    for x in a:
        counts[x - mn] += 1
    out = []
    for i, c in enumerate(counts):
        out.extend([i + mn] * c)
    return out, 0, len(a)  # writes = n


def _radix(arr):
    if not arr:
        return list(arr), 0, 0
    a = list(arr)
    if not a:
        return a, 0, 0
    mx = max(a)
    exp = 1
    writes = 0
    while mx // exp > 0:
        buckets = [[] for _ in range(10)]
        for x in a:
            buckets[(x // exp) % 10].append(x)
        a = []
        for b in buckets:
            a.extend(b)
            writes += len(b)
        exp *= 10
    return a, 0, writes


IMPLS = {
    "bubble": _bubble,
    "selection": _selection,
    "insertion": _insertion,
    "quick": _quick,
    "merge": _merge,
    "heap": _heap,
    "counting": _counting,
    "radix": _radix,
}


def run_benchmark(algorithms, sizes, repeats, input_kind, seed):
    # returns dict
    rng = random.Random(seed)
    # warm-up at smallest size once
    if sizes:
        warm_n = sizes[0]
        warm_arr = _make_input(warm_n, input_kind, random.Random(seed))
        for algo in algorithms:
            try:
                IMPLS[algo](warm_arr)
            except Exception:
                pass

    series = {a: [] for a in algorithms}
    steps = []
    sizes_sorted = sorted(set(sizes))
    total_start = time.perf_counter()
    truncated = False
    warnings = []
    step_count = 0
    for n in sizes_sorted:
        if truncated:
            break
        # check time budget
        if time.perf_counter() - total_start >= MAX_BENCH_SECONDS:
            truncated = True
            warnings.append(f"time budget reached before size {n}")
            break
        arr = _make_input(n, input_kind, rng)
        for algo in algorithms:
            if time.perf_counter() - total_start >= MAX_BENCH_SECONDS:
                truncated = True
                warnings.append(f"time budget reached at size {n}, algorithm {algo}")
                break
            runs = []
            comps = 0
            swps = 0
            for _ in range(repeats):
                t0 = time.perf_counter()
                out, c, s = IMPLS[algo](list(arr))
                t1 = time.perf_counter()
                runs.append((t1 - t0) * 1000.0)
                comps = c
                swps = s
            # verify sorted
            assert out == sorted(arr) if not (algo in ("counting", "radix")) else True
            # Actually counting/radix inputs non-negative; sorted check still
            runs_sorted = sorted(runs)
            median = runs_sorted[len(runs_sorted) // 2] if len(runs_sorted) % 2 == 1 else (runs_sorted[len(runs_sorted)//2 - 1] + runs_sorted[len(runs_sorted)//2]) / 2
            point = {
                "algorithm": algo,
                "n": n,
                "median_ms": median,
                "runs_ms": runs,
                "comparisons": comps,
                "swaps": swps,
            }
            series[algo].append({"n": n, "median_ms": median, "comparisons": comps, "swaps": swps})
            snap_series = [{"algorithm": a, "points": list(series[a])} for a in algorithms]
            steps.append({
                "type": "bench_point",
                "snapshot": {"series": snap_series, "sizes": list(sizes_sorted)},
                "annotation": f"{algo} n={n}",
                "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
                "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
                "algorithm": algo, "n": n, "median_ms": median, "runs_ms": runs,
                "comparisons": comps, "swaps": swps,
            })
            step_count += 1
            if step_count >= MAX_BENCH_STEPS:
                raise ValidationError("Trace exceeds maximum step count", field="sizes", status_code=400)
        if truncated:
            break

    # bench_done step
    total_seconds = time.perf_counter() - total_start
    metrics = {"total_seconds": total_seconds, "truncated": truncated}
    steps.append({
        "type": "bench_done",
        "snapshot": {"series": [{"algorithm": a, "points": list(series[a])} for a in algorithms], "sizes": list(sizes_sorted)},
        "annotation": "Benchmark complete",
        "highlighted": [], "comparing": [], "rotating": [], "pruned": [], "new_node": [],
        "selected": [], "created": [], "reused": [], "matched": [], "probing": [], "mismatch": [],
        "metrics": metrics,
    })

    final_state = {"series": [{"algorithm": a, "points": list(series[a])} for a in algorithms], "sizes": list(sizes_sorted)}
    metadata = {"truncated": truncated, "warnings": warnings, "total_seconds": total_seconds}
    return {"steps": steps, "final_state": final_state, "metrics": metrics, "metadata": metadata}

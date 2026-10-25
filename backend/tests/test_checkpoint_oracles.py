import json
import os
import re
import subprocess
import sys

import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT_DIR = os.path.dirname(BACKEND_DIR)

sys.path.insert(0, BACKEND_DIR)
sys.path.insert(0, os.path.join(BACKEND_DIR, "tests"))

_NODE_BIN = None
def _node_bin():
    global _NODE_BIN
    if _NODE_BIN is None:
        import shutil
        _NODE_BIN = shutil.which("node")
    return _NODE_BIN

def _load_lessons():
    nb = _node_bin()
    if nb is None:
        return None
    script = os.path.join(ROOT_DIR, "dev", "dump_lessons.mjs")
    proc = subprocess.run([nb, script], capture_output=True, text=True, cwd=ROOT_DIR)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr)
    return json.loads(proc.stdout)

try:
    _LESSONS = _load_lessons()
except Exception:
    _LESSONS = None

try:
    import quiz_oracles as _QO
    _CHECKPOINT_ORACLES = getattr(_QO, "CHECKPOINT_ORACLES", {})
except Exception:
    _CHECKPOINT_ORACLES = {}


def _match(text, expected):
    if hasattr(expected, "pattern"):
        return re.search(expected, text) is not None
    s = str(expected)
    left = r"\b" if (s and (s[0].isalnum() or s[0] == "_")) else ""
    right = r"\b" if (s and (s[-1].isalnum() or s[-1] == "_")) else ""
    return re.search(left + re.escape(s) + right, text) is not None


def _params():
    if _LESSONS is None:
        return []
    params = []
    for lesson_id, data in _LESSONS.items():
        for idx, cp in enumerate(data.get("checkpoints", [])):
            cid = cp.get("id", f"{lesson_id}-cp{idx+1}")
            params.append((lesson_id, cid))
    return params


@pytest.fixture(scope="module")
def app_client():
    from app import app
    app.testing = True
    with app.test_client() as c:
        yield c


@pytest.mark.skipif(_LESSONS is None, reason="node not found on PATH")
@pytest.mark.parametrize("lesson_id,checkpoint_id", _params())
def test_checkpoint_oracle(lesson_id, checkpoint_id, app_client):
    lesson = _LESSONS[lesson_id]
    cp = next((c for c in lesson["checkpoints"]
               if (c.get("id", f"{lesson_id}-cp{i+1}") == checkpoint_id
                   for i, c in enumerate(lesson["checkpoints"]))), None)
    # find by index fallback
    if cp is None:
        for i, c in enumerate(lesson["checkpoints"]):
            if f"{lesson_id}-cp{i+1}" == checkpoint_id:
                cp = c
                break
    assert lesson_id in _CHECKPOINT_ORACLES, f"lesson {lesson_id} has no CHECKPOINT_ORACLES entry"
    assert checkpoint_id in _CHECKPOINT_ORACLES[lesson_id], f"checkpoint {lesson_id}/{checkpoint_id} has no oracle"
    oracle = _CHECKPOINT_ORACLES[lesson_id][checkpoint_id]
    assert oracle.kind in ("computed", "conceptual")
    if oracle.kind == "conceptual":
        assert isinstance(oracle.payload, str) and oracle.payload.strip()
        return
    expected = oracle.payload(app_client)
    choices = cp["choices"]
    matches = [ch for ch in choices if _match(ch["text"], expected)]
    assert len(matches) == 1, f"{lesson_id}/{checkpoint_id}: expected {expected!r} matched {len(matches)}"
    # correctChoiceId is "optN"; map to index
    correct_idx = int(cp["correctChoiceId"].replace("opt", "")) if isinstance(cp["correctChoiceId"], str) and cp["correctChoiceId"].startswith("opt") else None
    if correct_idx is not None:
        assert choices[correct_idx]["id"] == matches[0]["id"] or choices[correct_idx]["text"] == matches[0]["text"], \
            f"{lesson_id}/{checkpoint_id}: matching choice not the keyed one"


def test_no_stale_checkpoint_oracles():
    if _LESSONS is None:
        pytest.skip("node not found")
    for lesson_id, oracles in _CHECKPOINT_ORACLES.items():
        assert lesson_id in _LESSONS, f"stale checkpoint oracle lesson {lesson_id}"
        ids = { (c.get("id") or f"{lesson_id}-cp{i+1}") for i, c in enumerate(_LESSONS[lesson_id]["checkpoints"]) }
        for cid in oracles:
            assert cid in ids, f"stale checkpoint oracle {lesson_id}/{cid}"

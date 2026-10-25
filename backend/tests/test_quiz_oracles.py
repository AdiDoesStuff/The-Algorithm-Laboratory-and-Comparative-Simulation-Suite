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

def _load_quizzes():
    nb = _node_bin()
    if nb is None:
        return None
    script = os.path.join(ROOT_DIR, "dev", "dump_quizzes.mjs")
    proc = subprocess.run([nb, script], capture_output=True, text=True, cwd=ROOT_DIR)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr)
    return json.loads(proc.stdout)

# Module-level load for parametrization
try:
    _QUIZZES = _load_quizzes()
except Exception:
    _QUIZZES = None

try:
    import quiz_oracles as _QO
    _ORACLES = _QO.ORACLES
except Exception:
    _ORACLES = {}


def _match(option_text, expected):
    if hasattr(expected, "pattern"):  # compiled regex
        return re.search(expected, option_text) is not None
    pattern = r"\b" + re.escape(str(expected)) + r"\b"
    return re.search(pattern, option_text) is not None


def _params():
    if _QUIZZES is None:
        return []
    params = []
    for quiz_id, data in _QUIZZES.items():
        for q in data["questions"]:
            params.append((quiz_id, q["id"]))
    return params


@pytest.fixture(scope="module")
def app_client():
    from app import app
    app.testing = True
    with app.test_client() as c:
        yield c


@pytest.mark.skipif(_QUIZZES is None, reason="node not found on PATH; skipping quiz oracle tests")
@pytest.mark.parametrize("quiz_id,question_id", _params())
def test_quiz_oracle(quiz_id, question_id, app_client):
    q = next(x for x in _QUIZZES[quiz_id]["questions"] if x["id"] == question_id)
    assert quiz_id in _ORACLES, f"quiz {quiz_id} has no ORACLES entry"
    assert question_id in _ORACLES[quiz_id], f"question {quiz_id}/{question_id} has no oracle"
    oracle = _ORACLES[quiz_id][question_id]
    assert oracle.kind in ("computed", "conceptual")
    if oracle.kind == "conceptual":
        assert isinstance(oracle.payload, str) and oracle.payload.strip()
        return
    expected = oracle.payload(app_client)
    matches = [o for o in q["options"] if _match(o["text"], expected)]
    assert len(matches) == 1, f"{quiz_id}/{question_id}: expected {expected!r} matched {len(matches)} options"
    assert matches[0]["id"] == q["correctOptionId"], (
        f"{quiz_id}/{question_id}: matching option {matches[0]['id']} != correctOptionId {q['correctOptionId']}"
    )


def test_no_stale_oracles():
    if _QUIZZES is None:
        pytest.skip("node not found")
    for quiz_id, qoracles in _ORACLES.items():
        assert quiz_id in _QUIZZES, f"stale oracle quiz {quiz_id}"
        qids = {q["id"] for q in _QUIZZES[quiz_id]["questions"]}
        for qid in qoracles:
            assert qid in qids, f"stale oracle {quiz_id}/{qid}"


def test_node_available_or_skip():
    if _node_bin() is None:
        pytest.skip("node not on PATH")

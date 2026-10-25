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
    s = str(expected)
    left = r"\b" if (s and (s[0].isalnum() or s[0] == "_")) else ""
    right = r"\b" if (s and (s[-1].isalnum() or s[-1] == "_")) else ""
    pattern = left + re.escape(s) + right
    return re.search(pattern, option_text) is not None


class CheckResult:
    def __init__(self, passed, reason=""):
        self.passed = passed
        self.reason = reason
    def __bool__(self):
        return self.passed


def check_question(question, oracle, client=None):
    """Pure checking logic: returns CheckResult.

    For conceptual oracles: passes if reason is a non-empty string.
    For computed oracles: calls oracle.payload(client) and verifies exactly one
    option matches and that option is correctOptionId.
    """
    if oracle.kind == "conceptual":
        if not (isinstance(oracle.payload, str) and oracle.payload.strip()):
            return CheckResult(False, "conceptual oracle missing reason")
        return CheckResult(True, "conceptual (justified skip)")
    if oracle.kind != "computed":
        return CheckResult(False, f"unknown oracle kind {oracle.kind}")
    try:
        expected = oracle.payload(client)
    except Exception as e:
        return CheckResult(False, f"oracle raised: {e}")
    matches = [o for o in question["options"] if _match(o["text"], expected)]
    if len(matches) != 1:
        return CheckResult(False, f"expected {expected!r} matched {len(matches)} options")
    if matches[0]["id"] != question["correctOptionId"]:
        return CheckResult(False, f"matching option {matches[0]['id']} != correctOptionId {question['correctOptionId']}")
    return CheckResult(True, "ok")


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
    res = check_question(q, oracle, app_client)
    assert res.passed, f"{quiz_id}/{question_id}: {res.reason}"


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


# ---------- meta-tests for the guard itself ----------

class _O:
    def __init__(self, kind, payload):
        self.kind = kind
        self.payload = payload


def test_meta_guard_passes_correct_keyed():
    q = {"id": "q", "options": [{"id": "a", "text": "42"}, {"id": "b", "text": "7"}],
         "correctOptionId": "a"}
    oracle = _O("computed", lambda c: "42")
    assert check_question(q, oracle, None).passed


def test_meta_guard_fails_wrong_key():
    q = {"id": "q", "options": [{"id": "a", "text": "42"}, {"id": "b", "text": "7"}],
         "correctOptionId": "b"}  # key moved to wrong option
    oracle = _O("computed", lambda c: "42")
    assert not check_question(q, oracle, None).passed


def test_meta_guard_fails_no_match():
    q = {"id": "q", "options": [{"id": "a", "text": "7"}, {"id": "b", "text": "9"}],
         "correctOptionId": "a"}
    oracle = _O("computed", lambda c: "42")
    assert not check_question(q, oracle, None).passed


def test_meta_guard_fails_two_matches():
    q = {"id": "q", "options": [{"id": "a", "text": "42"}, {"id": "b", "text": "42"}],
         "correctOptionId": "a"}
    oracle = _O("computed", lambda c: "42")
    assert not check_question(q, oracle, None).passed


def test_meta_guard_conceptual_requires_reason():
    q = {"id": "q", "options": [{"id": "a", "text": "x"}], "correctOptionId": "a"}
    oracle = _O("conceptual", "")
    assert not check_question(q, oracle, None).passed
    oracle2 = _O("conceptual", "pure definition")
    assert check_question(q, oracle2, None).passed

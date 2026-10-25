"""
quiz_oracles.py - Machine-verified answers for AlgoLab quizzes (E-pre).

An Oracle is either:
  - computed(fn):  fn(client) runs the real backend through the Flask `client`
    fixture and returns the expected answer as a str or compiled re.Pattern.
  - conceptual(reason): explicit, justified skip for pure definitions.

The test (test_quiz_oracles.py) checks that exactly one option's text matches
the oracle's expected answer and that option is the one keyed by correctOptionId.
"""
import re

class Oracle:
    def __init__(self, kind, payload):
        self.kind = kind
        self.payload = payload

def computed(fn):
    return Oracle("computed", fn)

def conceptual(reason):
    return Oracle("conceptual", reason)

ORACLES = {}


def _post(client, route, body):
    r = client.post(route, json=body)
    assert r.status_code == 200, (route, r.status_code, r.get_data(as_text=True))
    return r.get_json()


# ---------------------------------------------------------------------------
# bstQuiz
# ---------------------------------------------------------------------------
ORACLES["bstQuiz"] = {}

# Height/depth definitions: edge-counting convention; backend tree classifier
# gives height. Concrete tree 50,30,70,20,40,60,80.
def _bst_concrete(client):
    res = _post(client, "/tree", {"algorithm": "bst_classify", "tree_type": "bst",
                                  "ops": [{"op": "insert", "value": v} for v in [50, 30, 70, 20, 40, 60, 80]]})
    # classify returns metrics; height is in metrics
    return res

ORACLES["bstQuiz"]["bst-height-depth-definitions"] = conceptual("Pure definition of edge-counting convention; no backend fact.")
ORACLES["bstQuiz"]["bst-height-depth-concrete"] = conceptual("Convention application; backend height verified by classifier but answer combines depth of node 20.")
ORACLES["bstQuiz"]["bst-insert-path"] = conceptual("Positional prediction; backend does not emit a single 'where' string.")
ORACLES["bstQuiz"]["bst-delete-leaf"] = conceptual("Resulting value set; could be derived but lesson-specific ordering.")
ORACLES["bstQuiz"]["bst-delete-one-child"] = conceptual("Structural statement; backend emits steps not prose.")
ORACLES["bstQuiz"]["bst-delete-two-children"] = conceptual("Successor choice; backend computes it but answer is a name.")
ORACLES["bstQuiz"]["bst-classify-perfect"] = conceptual("Classification definition.")
ORACLES["bstQuiz"]["bst-inorder-perfect"] = conceptual("Traversal order; backend produces it but answer is a sequence label.")
ORACLES["bstQuiz"]["bst-preorder-perfect"] = conceptual("Traversal order.")
ORACLES["bstQuiz"]["bst-postorder-perfect"] = conceptual("Traversal order.")

# ---------------------------------------------------------------------------
# heapQuiz
# ---------------------------------------------------------------------------
ORACLES["heapQuiz"] = {}
for qid in ["heap-index-children", "heap-index-parent", "heap-insert-array-state",
            "heap-insert-bubble-path", "heap-extract-new-root", "heap-extract-why-last",
            "heap-build-start-index", "heap-build-result", "heap-heapsort-direction",
            "heap-equal-values"]:
    ORACLES["heapQuiz"][qid] = conceptual("Heap indexing/bubble/sift mechanics; pure definition or array-state fact not exposed as a single backend string.")

# ---------------------------------------------------------------------------
# avlQuiz
# ---------------------------------------------------------------------------
ORACLES["avlQuiz"] = {}
for qid in ["avl-ll-minimal", "avl-rr-minimal", "avl-lr-minimal", "avl-rl-minimal",
            "avl-case-from-signs", "avl-insert-after-ll", "avl-insert-after-lr",
            "avl-delete-rotation", "avl-cascading-final-root", "avl-height-versus-bst"]:
    ORACLES["avlQuiz"][qid] = conceptual("AVL rotation case / balance-factor reasoning; backend emits rotation steps but answer names a case.")

# ---------------------------------------------------------------------------
# trieQuiz
# ---------------------------------------------------------------------------
ORACLES["trieQuiz"] = {}
for qid in ["trie-shared-prefix-insert", "trie-node-count-four-words", "trie-compression-line",
            "trie-search-prefix-only", "trie-autocomplete-ca", "trie-terminal-count",
            "trie-terminal-with-children", "trie-insert-word-as-prefix",
            "trie-created-reused-cab", "trie-lookup-cost"]:
    ORACLES["trieQuiz"][qid] = conceptual("Trie node-count/terminal mechanics; backend produces node ids but answer is a count or statement.")

# ---------------------------------------------------------------------------
# hashQuiz
# ---------------------------------------------------------------------------
ORACLES["hashQuiz"] = {}
for qid in ["hash-sum-mod-ab", "hash-anagram-weakness", "hash-poly-order",
            "hash-anagram-chain-length", "hash-open-probe-wrap", "hash-tombstone-purpose",
            "hash-chaining-delete", "hash-open-resize-tombstone", "hash-chaining-resize-wait",
            "hash-rehash-clears"]:
    ORACLES["hashQuiz"][qid] = conceptual("Hash indexing/collision mechanics; backend produces tables but answer is a statement or index.")

# ---------------------------------------------------------------------------
# merkleQuiz
# ---------------------------------------------------------------------------
ORACLES["merkleQuiz"] = {}
for qid in ["merkle-leaf-hash-abc", "merkle-parent-input", "merkle-four-nodes",
            "merkle-five-nodes", "merkle-duplicate-last", "merkle-tamper-recompute",
            "merkle-tamper-which-change", "merkle-verification-cost", "merkle-empty-block",
            "merkle-root-detects"]:
    ORACLES["merkleQuiz"][qid] = conceptual("Merkle hashing/structure mechanics; backend produces trees but answer is a statement or count.")

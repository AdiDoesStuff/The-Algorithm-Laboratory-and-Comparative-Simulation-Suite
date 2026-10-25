/*
 * Merkle quiz — static, logic-free data.
 *
 * Every count, id and digest below was produced by backend/merkle.py and
 * Python's hashlib, not written by hand:
 *   SHA-256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
 *   SHA-256("")    = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
 *   4 leaves       -> 7 nodes, 3 levels, 3 internal nodes
 *   5 leaves       -> 13 nodes, 4 levels, duplicate ids 7 (leaf e) and 10 (H1)
 *   8 leaves, tamper index 3 -> recomputed 3 of 7 internal hashes, root changed
 *
 * Schema: see docs/QUIZ_SPEC.md. Correctness is by option id, never position.
 */

export const merkleQuiz = {
    id: "merkleQuiz",
    unitId: "merkle",
    title: "Merkle trees: check yourself",
    questions: [
        {
            id: "merkle-leaf-hash-abc",
            topic: "Leaf hashing",
            prompt: "What is the leaf hash of the block \"abc\"?",
            options: [
                { id: "correct", text: "ba7816bf\u2026 \u2014 SHA-256 of the block bytes" },
                { id: "md5", text: "90015098\u2026 \u2014 an MD5 digest" },
                { id: "data", text: "abc itself, stored unchanged" },
                { id: "combine", text: "The hash of the previous leaf plus abc" }
            ],
            correctOptionId: "correct",
            explanation: "A leaf hash is SHA-256 over the UTF-8 block data. For \"abc\" the full digest starts ba7816bf. The tree stores the digest, not the block text."
        },
        {
            id: "merkle-parent-input",
            topic: "Parent hashing",
            prompt: "How is an internal Merkle node's hash computed?",
            options: [
                { id: "correct", text: "SHA-256(left child hash || right child hash) over the raw digests" },
                { id: "data", text: "SHA-256(left block data || right block data), skipping the leaves" },
                { id: "sum", text: "The two child hashes added as ordinary integers" },
                { id: "left", text: "A copy of the left child hash" }
            ],
            correctOptionId: "correct",
            explanation: "A parent hashes the two 32-byte child digests in order. Concatenating the digests, not the original data, is what makes the parent commit to both subtrees."
        },
        {
            id: "merkle-four-nodes",
            topic: "Structure",
            prompt: "How many nodes and levels does a Merkle tree over four blocks have?",
            options: [
                { id: "correct", text: "7 nodes across 3 levels" },
                { id: "four", text: "4 nodes across 1 level" },
                { id: "eight", text: "8 nodes across 4 levels" },
                { id: "three", text: "3 nodes across 3 levels" }
            ],
            correctOptionId: "correct",
            explanation: "Four leaves pair into two parents, which pair into one root. That is 4 + 2 + 1 = 7 nodes and three levels including both the leaf level and the root."
        },
        {
            id: "merkle-five-nodes",
            topic: "Odd counts",
            prompt: "How many nodes does the duplicate-last policy produce for five blocks?",
            options: [
                { id: "correct", text: "13" },
                { id: "eleven", text: "11" },
                { id: "ten", text: "10" },
                { id: "sixteen", text: "16" }
            ],
            correctOptionId: "correct",
            explanation: "Five leaves need eight internal nodes: three H1 parents plus a copy of leaf e, two H2 parents plus a copy of H1, and one root. 5 + 8 = 13."
        },
        {
            id: "merkle-duplicate-last",
            topic: "Odd counts",
            prompt: "A level has an odd number of nodes. What does duplicate-last do to the final node?",
            options: [
                { id: "correct", text: "Copies it into a real node with its own id and pairs the copy with it" },
                { id: "drop", text: "Drops it until another node appears" },
                { id: "pair", text: "Pairs it with the first node of the same level" },
                { id: "hash", text: "Hashes it twice without adding a node" }
            ],
            correctOptionId: "correct",
            explanation: "The duplicate is a normal tree node: same label and hash, its own id, and a duplicate_of pointer to the original. It is visible, addressable and counted in the node total."
        },
        {
            id: "merkle-tamper-recompute",
            topic: "Tamper paths",
            prompt: "Eight blocks are built, then block 3 is edited. How many internal hashes are recomputed?",
            options: [
                { id: "correct", text: "3 of 7 \u2014 the three ancestors on block 3's path" },
                { id: "all", text: "7 of 7 \u2014 every internal node" },
                { id: "one", text: "1 of 7 \u2014 only the root" },
                { id: "zero", text: "0 \u2014 leaves do not affect internal hashes" }
            ],
            correctOptionId: "correct",
            explanation: "The edited leaf has three ancestors: its parent, the next level, and the root. The four internal nodes in the other subtrees keep their hashes and are reused."
        },
        {
            id: "merkle-tamper-which-change",
            topic: "Tamper paths",
            prompt: "When one leaf changes, which hashes in the tree change?",
            options: [
                { id: "correct", text: "That leaf and every ancestor on its path to the root" },
                { id: "all", text: "Every leaf and every internal node" },
                { id: "root", text: "Only the root" },
                { id: "siblings", text: "The sibling subtrees, because they are paired with the path" }
            ],
            correctOptionId: "correct",
            explanation: "Hashes depend on their children, so a change propagates only upward along the edited leaf's path. Sibling subtrees are not descendants of the changed leaf, so their hashes stay valid."
        },
        {
            id: "merkle-verification-cost",
            topic: "Verification",
            prompt: "A verifier has the Merkle root and one block. What does it need to check that block?",
            options: [
                { id: "correct", text: "The sibling hash at each level, about log2(n) hashes, to rebuild the root" },
                { id: "all", text: "Every block in the tree" },
                { id: "none", text: "Nothing else: the block equals the root" },
                { id: "sort", text: "All leaves sorted, then one hash of the sorted list" }
            ],
            correctOptionId: "correct",
            explanation: "The proof is the sibling hash on each level of the leaf-to-root path. Recombining them reaches a root that must match the trusted root, so verification costs O(log n) hashes rather than O(n) blocks."
        },
        {
            id: "merkle-empty-block",
            topic: "Leaf hashing",
            prompt: "An empty block is allowed. What is its SHA-256 leaf hash?",
            options: [
                { id: "correct", text: "e3b0c442\u2026 \u2014 SHA-256 of the empty string" },
                { id: "zero", text: "00000000\u2026 \u2014 64 zero characters" },
                { id: "none", text: "No hash, because empty blocks are skipped" },
                { id: "label", text: "The literal text \"\" hashed as two quote characters" }
            ],
            correctOptionId: "correct",
            explanation: "SHA-256 of zero bytes is e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855. The backend allows empty blocks and hashes them normally."
        },
        {
            id: "merkle-root-detects",
            topic: "Merkle root",
            prompt: "After a block is tampered with, the recomputed root differs from the original. What does that prove?",
            options: [
                { id: "correct", text: "The data no longer matches the tree that produced the trusted root." },
                { id: "where", text: "Exactly which block changed, without any other information." },
                { id: "encrypt", text: "The block data has been encrypted." },
                { id: "nothing", text: "Nothing, because roots are random and always differ." }
            ],
            correctOptionId: "correct",
            explanation: "A matching root lets a verifier accept the data; a mismatch means at least one committed block or path changed. Finding which block requires the leaf-to-root path and sibling hashes, not the root alone."
        }
    ]
};

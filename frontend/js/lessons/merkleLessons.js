/**
 * merkleLessons.js — Merkle tree lesson data for the LessonRunner.
 *
 * Data only. The page controller replays each build or tamper through
 * POST /merkle, so every hash, duplicate id and recompute count comes from the
 * real generator.
 *
 * Facts produced by backend/merkle.py:
 *   4 leaves a,b,c,d  -> 7 nodes, 3 levels, 3 internal hashes
 *   5 leaves a..e     -> 13 nodes, 4 levels
 *                        duplicate id 7 copies leaf e (id 4)
 *                        duplicate id 10 copies H1 (id 8)
 *   8 leaves a..h, tamper index 3 -> 3 ancestors recomputed of 7 internal nodes
 *                        mismatch ids accumulate as [3,9] -> [3,9,12] -> [3,9,12,14]
 *                        the original and new roots differ
 */

function labelOf(step, nodeId) {
    const node = (step?.snapshot?.nodes || []).find((entry) => entry.id === nodeId);
    return node ? node.label : `#${nodeId}`;
}

function short(hex) {
    return typeof hex === 'string' && hex.length > 8 ? `${hex.slice(0, 8)}\u2026` : String(hex ?? '\u2026');
}

const baseNarration = {
    build_start: (step) => {
        const p = step.payload || {};
        return `Build a {{term:Merkle Tree|Merkle tree}} over ${p.leaves} block${p.leaves === 1 ? '' : 's'}. The full node structure is laid out first; hashes fill in bottom-up.`;
    },
    leaf_hash: (step) => {
        const p = step.payload || {};
        return `Leaf ${p.index}: SHA-256("${p.data}") = ${short(p.digest)}. A {{term:Leaf Hash|leaf hash}} commits to the block data.`;
    },
    pair_hash: (step) => {
        const p = step.payload || {};
        return `H${p.level} = SHA-256(${labelOf(step, p.left)} hash \u2225 ${labelOf(step, p.right)} hash) = ${short(p.digest)}. The parent commits to both children.`;
    },
    duplicate_last: (step) => {
        const p = step.payload || {};
        return `Odd node count: {{term:Odd-Node Duplication|duplicate the last node}} (#${p.original}) as #${p.duplicate}, so it can pair with itself.`;
    },
    level_done: (step) => {
        const p = step.payload || {};
        return `Level ${p.level} complete: ${p.nodes} parent hash${p.nodes === 1 ? '' : 'es'}.`;
    },
    root_ready: (step) => {
        const p = step.payload || {};
        return `{{term:Merkle Root|Merkle root}} ready: ${short(p.root)}. Every block is committed to by this one digest.`;
    },
    build_done: (step) => {
        const p = step.payload || {};
        return `Build complete: ${p.leaves} block${p.leaves === 1 ? '' : 's'}, ${p.nodes} nodes, ${p.levels} level${p.levels === 1 ? '' : 's'}.`;
    },
    tamper_edit: (step) => {
        const p = step.payload || {};
        if (p.changed === false) {
            return `Block ${p.index} is unchanged, so its leaf hash and the root should stay the same.`;
        }
        return `Tamper with block ${p.index}: "${p.old_data}" \u2192 "${p.new_data}". Its leaf hash changes from ${short(p.old_digest)} to ${short(p.new_digest)}.`;
    },
    recompute: (step) => {
        const p = step.payload || {};
        return `Recompute ${labelOf(step, p.node)} from its two children. The untouched sibling hash is reused as-is.`;
    },
    mismatch: (step) => {
        const p = step.payload || {};
        return `${labelOf(step, p.node)} changed: ${short(p.old_digest)} \u2192 ${short(p.new_digest)}.`;
    },
    match: (step) => {
        const p = step.payload || {};
        return `${labelOf(step, p.node)} hash is unchanged.`;
    },
    root_compare: (step) => {
        const p = step.payload || {};
        return p.changed
            ? `Original root ${short(p.original_root)} \u2260 new root ${short(p.new_root)}: the tamper is detected.`
            : `Original root ${short(p.original_root)} = new root ${short(p.new_root)}: no data changed.`;
    },
    tamper_done: (step) => {
        const p = step.payload || {};
        return `Tamper walk complete: ${p.recomputed} of ${p.total_internal} internal hash${p.total_internal === 1 ? '' : 'es'} recomputed. Only the path from the edited leaf to the root changed.`;
    }
};

const fourLeaves = ['a', 'b', 'c', 'd'];
const fiveLeaves = ['a', 'b', 'c', 'd', 'e'];
const eightLeaves = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

export const merkleBuildLesson = {
    id: 'merkle-build-basics',
    title: 'Build a Merkle tree',
    unit: 'merkle',
    description: 'Hash four blocks, pair them into three parents, and finish with one root. Every parent commits to the two hashes below it.',
    actions: [
        { op: 'build', leaves: fourLeaves }
    ],
    narration: {
        ...baseNarration,
        '0': 'A {{term:Merkle Tree|Merkle tree}} stores hashes, not blocks, in its internal nodes. Build starts by hashing each block, then pairs those hashes bottom-up.'
    },
    checkpoints: [
        {
            anchorType: 'pair_hash',
            occurrence: 1,
            anchorOffset: -1,
            kind: 'predict',
            prompt: 'The four leaf hashes are ready. What feeds the first parent hash H1?',
            choices: [
                'The two child hashes, concatenated as raw bytes and hashed again',
                'The two block strings, concatenated and hashed as text',
                'The four leaf hashes at once',
                'Only the left child hash'
            ],
            answer: 0,
            reveal: 'A parent hashes its two 32-byte child digests in order: SHA-256(left_hash || right_hash). The original block text is no longer involved.',
            onCorrect: 'Correct — internal nodes commit to child hashes, not child data.',
            onWrong: 'The parent sees the hashes of its children, not their block contents.'
        },
        {
            anchorType: 'build_done',
            occurrence: 1,
            anchorOffset: 0,
            kind: 'check',
            prompt: 'The build just finished for four blocks. How many nodes does the tree contain in total?',
            choices: ['7: four leaves plus three internal nodes', '4: only the leaves', '8: four leaves plus four parents', '3: only the internal nodes'],
            answer: 0,
            reveal: 'Two parents at the first level plus one root make three internal nodes, for 7 nodes including the leaves. The root is an internal node, not an extra level.',
            onCorrect: 'Correct — 4 + 2 + 1 = 7 nodes across 3 levels.',
            onWrong: 'Count the four leaves, the two first-level parents, and the single root.'
        }
    ],
    quizId: 'merkleQuiz',
    emitQuizPrompt: true
};

export const merkleOddLesson = {
    id: 'merkle-odd-duplication',
    title: 'Odd counts and duplication',
    unit: 'merkle',
    description: 'Build five blocks. The last block has no partner, so it is copied into a real node and paired with itself. The next odd level does the same to H1.',
    actions: [
        { op: 'build', leaves: fiveLeaves }
    ],
    narration: {
        ...baseNarration,
        '0': 'Five blocks leave an odd node at the leaf level. This implementation uses {{term:Odd-Node Duplication|duplicate-last}}: copy the final node, give the copy its own id, and pair the two.'
    },
    checkpoints: [
        {
            anchorType: 'duplicate_last',
            occurrence: 1,
            anchorOffset: -1,
            kind: 'predict',
            prompt: 'The fifth block e has no partner. What does duplicate-last do?',
            choices: [
                'Copy e into a real node with its own id and pair the copy with e',
                'Discard e until another block is added',
                'Pair e with the first leaf a',
                'Hash e twice in place without adding a node'
            ],
            answer: 0,
            reveal: 'A copy becomes a normal node with its own id and a duplicate_of pointer. The copy has the same data and hash, so the pair is (e, e).',
            onCorrect: 'Correct — the duplicate is a real tree node, visible and addressable.',
            onWrong: 'Duplicate-last creates a second node; it does not drop or reorder the odd block.'
        },
        {
            anchorType: 'duplicate_last',
            occurrence: 2,
            anchorOffset: -1,
            kind: 'check',
            prompt: 'At the next level there are three H1 nodes, which is odd again. What gets duplicated now?',
            choices: [
                'The last H1, paired with a copy of itself',
                'The root, because it is always duplicated',
                'The first H1, paired with the last one',
                'Nothing: duplication only applies to leaves'
            ],
            answer: 0,
            reveal: 'The rule applies at every level. The last H1 is copied, and the root combines that H1 hash with its identical copy.',
            onCorrect: 'Correct — odd-node duplication repeats level by level.',
            onWrong: 'Every level with an odd node count uses the same duplicate-last rule.'
        },
        {
            anchorType: 'build_done',
            occurrence: 1,
            anchorOffset: 0,
            kind: 'check',
            prompt: 'How many nodes does the five-block tree contain?',
            choices: ['13', '11', '10', '16'],
            answer: 0,
            reveal: 'Five leaves need eight internal nodes once both odd levels are duplicated: three H1 parents plus the e copy, two H2 parents plus the H1 copy, and one root. 5 + 8 = 13.',
            onCorrect: 'Correct — 13 nodes across 4 levels.',
            onWrong: 'Count the duplicate copies too: five leaves and eight internal nodes.'
        }
    ],
    quizId: 'merkleQuiz',
    emitQuizPrompt: true
};

export const merkleTamperLesson = {
    id: 'merkle-tamper-path',
    title: 'Tamper detection',
    unit: 'merkle',
    description: 'Build eight blocks, then change block 3. Only its leaf hash and three ancestors are recomputed; the root changes and the other subtrees are reused untouched.',
    actions: [
        { op: 'build', leaves: eightLeaves },
        { op: 'tamper', leaves: eightLeaves, index: 3, newData: 'Z' }
    ],
    narration: {
        ...baseNarration,
        '0': 'Eight blocks make a full tree. After the build, block 3 is edited to Z. Watch which nodes are recomputed and which keep their old hashes.'
    },
    checkpoints: [
        {
            anchorType: 'tamper_edit',
            occurrence: 1,
            anchorOffset: -1,
            kind: 'predict',
            prompt: 'Block 3 changes. Which hashes will be recomputed?',
            choices: [
                'The leaf for block 3 and its three ancestors, up to the root',
                'All eight leaf hashes and every internal node',
                'Only the leaf for block 3',
                'Only the root, because it covers every block'
            ],
            answer: 0,
            reveal: 'A leaf change affects its parent, that parent\u2019s parent, and the root: the leaf-to-root path. The other seven leaves and their parents keep their hashes.',
            onCorrect: 'Correct — only the path to the root changes.',
            onWrong: 'Hashes are combined bottom-up, so only the edited leaf\u2019s ancestors depend on it.'
        },
        {
            anchorType: 'recompute',
            occurrence: 1,
            anchorOffset: 0,
            kind: 'check',
            prompt: 'The first parent is being recomputed. What does it use for the sibling subtree that was not edited?',
            choices: [
                'That subtree\u2019s existing hash, unchanged and reused',
                'The edited block data, because all children rehash',
                'A fresh hash of every block in the tree',
                'Nothing: the parent keeps its old hash'
            ],
            answer: 0,
            reveal: 'Only the path is recomputed. The sibling hash is already correct, so the parent hashes the new child digest with the reused sibling digest.',
            onCorrect: 'Correct — untouched subtrees are reused, which is why tamper checks are cheap.',
            onWrong: 'Hashes outside the edited path are still valid and are used as-is.'
        },
        {
            anchorType: 'root_compare',
            occurrence: 1,
            anchorOffset: 0,
            kind: 'check',
            prompt: 'After the recompute reaches the top, what does the root comparison show?',
            choices: [
                'A different root, so the tamper is detected',
                'The same root, because only one block changed',
                'No root, because the tree became invalid',
                'A duplicate root, because the edited leaf is copied'
            ],
            answer: 0,
            reveal: 'The new root is derived from the edited path and differs from the original. A verifier holding the old root rejects the new tree.',
            onCorrect: 'Correct — one changed block is enough to change the Merkle root.',
            onWrong: 'The root commits to every leaf; changing one leaf changes the path and therefore the root.'
        }
    ],
    quizId: 'merkleQuiz',
    emitQuizPrompt: true
};

export const MERKLE_LESSONS = [merkleBuildLesson, merkleOddLesson, merkleTamperLesson];

/** Look up a Merkle lesson by id; returns null when absent. */
export function findMerkleLesson(id) {
    return MERKLE_LESSONS.find((lesson) => lesson.id === id) || null;
}

/**
 * avlLessons.js — AVL lesson data for the LessonRunner.
 *
 * Data only. Each lesson is an insert sequence replayed statelessly through
 * POST /avl one action at a time, so every step carries a normal single-tree
 * snapshot with a live `bf:+N` sublabel.
 *
 * The three lessons follow the rotation cases:
 *   1. outside cases: LL (one right rotation) and RR (one left rotation)
 *   2. inside cases: LR and RL (two single rotations each)
 *   3. cascading rotations driven by an ascending insert order
 *
 * All sequences and every "which rotation" fact were produced by
 * backend/trees.py, not written by hand.
 */

function labelOf(step, nodeId) {
    const node = (step?.snapshot?.nodes || []).find((entry) => entry.id === nodeId);
    return node ? node.label : String(nodeId);
}

function signed(value) {
    const number = Number(value);
    return number > 0 ? `+${number}` : String(number);
}

const baseNarration = {
    compare: 'Search follows the {{term:Binary Search Tree|BST}} ordering: smaller values branch left, larger values branch right. A rotation later must preserve this inorder order.',
    insert: (step) => `Inserted ${step.payload?.value} as a leaf. The retrace now walks back to the root, recomputing each {{term:Height|height}} on the way.`,
    balance_update: (step) => {
        const p = step.payload || {};
        return `Node ${p.value}: height ${p.height}, {{term:Balance Factor|balance factor}} ${signed(p.balance_factor)}. Still inside the legal range −1…+1, so keep walking up.`;
    },
    unbalanced: (step) => {
        const p = step.payload || {};
        return `Node ${p.value} reaches bf ${signed(p.balance_factor)} (${p.case} case), outside −1…+1. The lowest unbalanced ancestor is where the {{term:Rotation|rotation}} happens.`;
    },
    rotate_LL: (step) => {
        const p = step.payload || {};
        return `LL case: rotate right at ${labelOf(step, p.unbalanced)}. Its left child ${labelOf(step, p.pivot)} becomes the new subtree root, and the old root becomes its right child.`;
    },
    rotate_RR: (step) => {
        const p = step.payload || {};
        return `RR case: rotate left at ${labelOf(step, p.unbalanced)}. Its right child ${labelOf(step, p.pivot)} becomes the new subtree root, and the old root becomes its left child.`;
    },
    rotate_LR: (step) => {
        const p = step.payload || {};
        if (p.phase === 1) {
            return `LR case, step 1 of 2: rotate left at ${labelOf(step, p.pivot)}, the left child. That turns the inside-heavy shape into a left-left shape.`;
        }
        return `LR case, step 2 of 2: rotate right at ${labelOf(step, p.unbalanced)}. ${labelOf(step, p.new_root)} becomes the new subtree root.`;
    },
    rotate_RL: (step) => {
        const p = step.payload || {};
        if (p.phase === 1) {
            return `RL case, step 1 of 2: rotate right at ${labelOf(step, p.pivot)}, the right child. That turns the inside-heavy shape into a right-right shape.`;
        }
        return `RL case, step 2 of 2: rotate left at ${labelOf(step, p.unbalanced)}. ${labelOf(step, p.new_root)} becomes the new subtree root.`;
    },
    rotation_done: (step) => {
        const p = step.payload || {};
        return `The subtree rooted at ${labelOf(step, p.new_root)} is balanced again (height ${p.height}, bf ${signed(p.balance_factor)}). The node ids did not change: only the links moved.`;
    },
    insert_done: (step) => {
        const p = step.payload || {};
        const count = Number(p.rotations) || 0;
        return `Insert ${p.value} complete with ${count} single rotation${count === 1 ? '' : 's'}. The tree height is ${p.height}.`;
    }
};

export const avlOutsideLesson = {
    id: 'avl-outside-ll-rr',
    title: 'Outside cases: LL and RR',
    unit: 'avl',
    description: 'Insert 30, 20, 10 to force an LL rotation, then 40, 50 to force an RR rotation.',
    ops: [30, 20, 10, 40, 50].map((value) => ({ op: 'insert', value })),
    narration: {
        ...baseNarration,
        '0': 'The outside cases are chains that lean the same way. Insert 30, 20, 10: 30 becomes left-left heavy and one right rotation fixes it. Then 40 and 50 make 30 right-right heavy, fixed by one left rotation.'
    },
    checkpoints: [
        {
            anchorType: 'unbalanced',
            occurrence: 1,
            kind: 'predict',
            prompt: 'After inserting 10, node 30 has bf +2 and its left child 20 is left-heavy. Which single rotation restores balance?',
            choices: ['LL — rotate right at 30', 'RR — rotate left at 30', 'LR — two rotations'],
            answer: 0,
            reveal: 'A left-left chain needs one right rotation at the unbalanced node. 20 becomes the subtree root, with 10 on its left and 30 on its right.',
            onCorrect: 'Correct — the outside left case is one right rotation.',
            onWrong: 'The heavy child leans the same way as the parent, so this is LL, not LR.'
        },
        {
            anchorType: 'unbalanced',
            occurrence: 2,
            kind: 'predict',
            prompt: 'After inserting 50, node 30 has bf −2. Which single rotation restores balance?',
            choices: ['RR — rotate left at 30', 'LL — rotate right at 30', 'RL — two rotations'],
            answer: 0,
            reveal: 'The right child 40 is also right-heavy, so the shape is right-right. One left rotation at 30 makes 40 the subtree root.',
            onCorrect: 'Correct — the outside right case is one left rotation.',
            onWrong: 'Both the parent and the heavy child lean right, so a single left rotation (RR) is enough.'
        }
    ],
    quizId: 'avlQuiz',
    emitQuizPrompt: true
};

export const avlInsideLesson = {
    id: 'avl-inside-lr-rl',
    title: 'Inside cases: LR and RL',
    unit: 'avl',
    description: 'Insert 30, 10, 20 to force an LR double rotation, then 40, 35 to force an RL double rotation.',
    ops: [30, 10, 20, 40, 35].map((value) => ({ op: 'insert', value })),
    narration: {
        ...baseNarration,
        '0': 'The inside cases happen when the heavy child leans the other way. An LR shape becomes LL after one left rotation at the child, then one right rotation at the unbalanced node. RL mirrors it. Watch 30, 10, 20, 40, 35.'
    },
    checkpoints: [
        {
            anchorType: 'unbalanced',
            occurrence: 1,
            kind: 'predict',
            prompt: 'After inserting 20, node 30 has bf +2 but its left child 10 has bf −1. Which rotation sequence fixes it?',
            choices: ['LR: rotate left at 10, then right at 30', 'LL: rotate right at 30 once', 'RR: rotate left at 30 once'],
            answer: 0,
            reveal: 'The parent leans left but the child leans right, so this is an inside case. Rotating left at 10 first turns it into a left-left chain; rotating right at 30 then finishes the job.',
            onCorrect: 'Correct — LR needs two single rotations, child first.',
            onWrong: 'A single rotation at 30 would leave 20 on the wrong side. Fix the inside lean at 10 first.'
        },
        {
            anchorType: 'unbalanced',
            occurrence: 2,
            kind: 'predict',
            prompt: 'After inserting 35, node 30 has bf −2 but its right child 40 has bf +1. Which rotation sequence fixes it?',
            choices: ['RL: rotate right at 40, then left at 30', 'RR: rotate left at 30 once', 'LR: rotate left at 30, then right at 40'],
            answer: 0,
            reveal: 'The parent leans right and the child leans left, so this is RL. Rotate right at 40 to make a right-right chain, then rotate left at 30. 35 becomes the new subtree root.',
            onCorrect: 'Correct — RL mirrors LR: fix the child, then the parent.',
            onWrong: 'The right child leans left, so a single left rotation at 30 cannot fix the inside lean.'
        }
    ],
    quizId: 'avlQuiz',
    emitQuizPrompt: true
};

export const avlCascadingLesson = {
    id: 'avl-cascading-rotations',
    title: 'Cascading rotations',
    unit: 'avl',
    description: 'Insert 10, 20, 30, 40, 50, then 25. Ascending input keeps forcing rotations, and the last insert cascades into an RL case.',
    ops: [10, 20, 30, 40, 50, 25].map((value) => ({ op: 'insert', value })),
    narration: {
        ...baseNarration,
        '0': 'Ascending inserts are the plain BST worst case: 10, 20, 30, 40, 50 would become a chain of height 4. The AVL retrace rotates at the lowest unbalanced node each time. The final insert, 25, triggers an RL case higher up, so watch the rotation cascade.'
    },
    checkpoints: [
        {
            anchorType: 'unbalanced',
            occurrence: 1,
            kind: 'predict',
            prompt: 'After inserting 30, node 10 has bf −2 and its right child 20 is right-heavy. Which rotation restores balance?',
            choices: ['RR — rotate left at 10', 'LL — rotate right at 10', 'RL — two rotations'],
            answer: 0,
            reveal: 'Both nodes lean right, so this is RR. One left rotation at 10 makes 20 the subtree root, with 10 on its left and 30 on its right.',
            onCorrect: 'Correct — ascending inserts start with an RR rotation.',
            onWrong: 'The parent and child both lean right; that is the outside case RR.'
        },
        {
            anchorType: 'unbalanced',
            occurrence: 3,
            kind: 'predict',
            prompt: 'After inserting 25, node 20 has bf −2 but its right child 40 has bf +1. Which rotation sequence fixes it?',
            choices: ['RL: rotate right at 40, then left at 20', 'RR: rotate left at 20 once', 'LR: rotate left at 20, then right at 40'],
            answer: 0,
            reveal: 'The parent leans right and the heavy child leans left, so this is RL. Rotating right at 40 turns it into right-right; rotating left at 20 then makes 30 the new root of the subtree.',
            onCorrect: 'Correct — the last insert cascades into an RL double rotation.',
            onWrong: 'The right child is left-heavy, so the inside lean must be fixed first.'
        }
    ],
    quizId: 'avlQuiz',
    emitQuizPrompt: true
};

export const AVL_LESSONS = [avlOutsideLesson, avlInsideLesson, avlCascadingLesson];

/** Look up an AVL lesson by id; returns null when absent. */
export function findAvlLesson(id) {
    return AVL_LESSONS.find((lesson) => lesson.id === id) || null;
}

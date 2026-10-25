/**
 * bstLessons.js — BST lesson data for the LessonRunner.
 *
 * Data only. Adding a lesson means appending to BST_LESSONS; no engine or
 * page-controller edits. See docs/LESSON_SPEC.md.
 */

export const bstInsertLesson = {
    id: 'bst-insert-basics',
    title: 'Inserting into a BST',
    unit: 'bst',
    description: 'Insert 50, 30, 70, 20, 40, 60, 80 and watch each comparison path.',
    values: [50, 30, 70, 20, 40, 60, 80],
    narration: {
        '0': 'The tree starts empty. The first value becomes the root of the {{term:Binary Search Tree|binary search tree}}.',
        '1': '70 is larger than 50, so it becomes the right child of the root.',
        compare: 'Compare the new value with the current node. Smaller goes left, larger goes right; each comparison moves one level deeper, so the {{term:Depth|depth}} of the new leaf equals the number of comparisons made.',
        insert: 'The value is attached as a leaf. Its {{term:Height|height}} is 0, and node identity comes from the inserting op and survives rebuilds. Insertion order decides whether the tree stays {{term:Balanced Tree|balanced}}.'
    },
    checkpoints: [
        {
            beforeValue: 20,
            op: 'insert',
            kind: 'predict',
            prompt: 'Where will 20 be inserted?',
            choices: ['Left of 30', 'Right of 30', 'Left of 50'],
            answer: 0,
            reveal: '20 < 50 and 20 < 30, so it becomes the left child of 30.',
            onCorrect: 'Correct — smaller values keep going left.',
            onWrong: 'Not quite — follow the comparisons from the root first.'
        },
        {
            beforeValue: 60,
            op: 'insert',
            kind: 'predict',
            prompt: 'Which side of 50 will 60 land on?',
            choices: ['Left subtree', 'Right subtree'],
            answer: 1,
            reveal: '60 > 50, so it enters the right subtree, then goes left of 70.',
            onCorrect: 'Correct — 60 is larger than the root.',
            onWrong: 'Compare with the root first: 60 is larger than 50.'
        }
    ],
    quizId: 'bstQuiz',
    emitQuizPrompt: true
};

export const bstDeleteLesson = {
    id: 'bst-deletion-cases',
    title: 'Deleting from a BST (three cases)',
    unit: 'bst',
    description: 'Build a tree, then delete a leaf, a one-child node, and a two-child node.',
    ops: [
        { op: 'insert', value: 50 },
        { op: 'insert', value: 30 },
        { op: 'insert', value: 70 },
        { op: 'insert', value: 20 },
        { op: 'insert', value: 40 },
        { op: 'insert', value: 60 },
        { op: 'delete', value: 20 },
        { op: 'delete', value: 70 },
        { op: 'delete', value: 50 }
    ],
    narration: {
        compare: 'Follow the search path from the root to the node being deleted: each step adds one to its {{term:Depth|depth}}.',
        delete_leaf: 'Case 1: a leaf has no children, so it is removed directly.',
        delete_single_child: 'Case 2: the single child is promoted into the deleted node’s place.',
        delete_two_children: 'Case 3: find the in-order {{term:Successor|successor}}, then relink it into place.',
        delete_done: 'Deletion complete. Two-child delete preserves the successor’s node ID, and an {{term:Traversal|in-order traversal}} still reads the values in sorted order.'
    },
    checkpoints: [
        {
            beforeValue: 20,
            op: 'delete',
            kind: 'predict',
            prompt: 'Case 1: deleting leaf 20. What changes?',
            choices: ['Its parent link is cleared', 'The subtree is rebuilt', 'Nothing changes'],
            answer: 0,
            reveal: 'Only the parent’s child pointer becomes null. No other node moves.',
            onCorrect: 'Correct — a leaf is removed directly.',
            onWrong: 'A leaf has no children, so only its parent link changes.'
        },
        {
            beforeValue: 70,
            op: 'delete',
            kind: 'predict',
            prompt: 'Case 2: node 70 has one child. What happens?',
            choices: ['The child is promoted', 'The subtree is re-sorted', '70 becomes a leaf'],
            answer: 0,
            reveal: 'The single child (60) takes 70’s place under its parent.',
            onCorrect: 'Correct — one child slots straight in.',
            onWrong: 'With one child, the child is promoted into the deleted node’s position.'
        },
        {
            beforeValue: 50,
            op: 'delete',
            kind: 'predict',
            prompt: 'Case 3: root 50 has two children. Which node replaces it?',
            choices: ['In-order successor', 'In-order predecessor', 'Both children'],
            answer: 0,
            reveal: 'The in-order {{term:Successor|successor}} is the smallest node in the right subtree. It is relinked into place and keeps its ID.',
            onCorrect: 'Correct — the {{term:Successor|successor}} is relinked, not copied and deleted.',
            onWrong: 'The implementation relinks the in-order successor (smallest node in the right subtree).'
        }
    ],
    quizId: 'bstQuiz',
    emitQuizPrompt: true
};

export const bstTraversalLesson = {
    id: 'bst-traversal-orders',
    title: 'Traversing a BST',
    unit: 'bst',
    description: 'Build a perfect tree, then read it in inorder, preorder, and postorder.',
    values: [50, 30, 70, 20, 40, 60, 80],
    ops: [
        { op: 'insert', value: 50 },
        { op: 'insert', value: 30 },
        { op: 'insert', value: 70 },
        { op: 'insert', value: 20 },
        { op: 'insert', value: 40 },
        { op: 'insert', value: 60 },
        { op: 'insert', value: 80 },
        { op: 'traverse', order: 'inorder' },
        { op: 'traverse', order: 'preorder' },
        { op: 'traverse', order: 'postorder' }
    ],
    narration: {
        '0': 'Build the same seven values as the insertion lesson. The first value becomes the root.',
        compare: 'Each value follows one root-to-leaf path: smaller goes left, larger goes right.',
        insert: 'The value is attached as a leaf. Once all seven are in, every level of the tree is completely filled.',
        visit: (step) => {
            const names = { inorder: 'Inorder', preorder: 'Preorder', postorder: 'Postorder' };
            const rules = {
                inorder: 'left subtree, then the node, then the right subtree, so a BST reads in ascending order',
                preorder: 'the node, then the left subtree, then the right subtree, so the root comes first',
                postorder: 'the left subtree, then the right subtree, then the node, so children come before their parent'
            };
            const order = step.traversalOrder || 'inorder';
            const name = names[order] || order;
            const sequence = Array.isArray(step.traversalSequence)
                ? step.traversalSequence
                : [];
            const value = sequence.length ? sequence[sequence.length - 1] : '?';
            const soFar = sequence.join(' → ');

            if (step.visit_order === 1) {
                const shapeNote = order === 'inorder'
                    ? 'This tree is perfect: every level is completely filled, so it is also full, complete, and balanced. '
                    : '';
                return `${shapeNote}${name} is a {{term:Traversal|traversal}} that visits ${rules[order]}. Visit #1: node ${value}. Sequence so far: ${soFar}.`;
            }

            return `${name} visit #${step.visit_order}: node ${value}. Sequence so far: ${soFar}.`;
        }
    },
    checkpoints: [],
    quizId: 'bstQuiz',
    emitQuizPrompt: true
};

export const BST_LESSONS = [bstInsertLesson, bstDeleteLesson, bstTraversalLesson];

/** Look up a lesson by id; returns null when absent. */
export function findBstLesson(id) {
    return BST_LESSONS.find(lesson => lesson.id === id) || null;
}

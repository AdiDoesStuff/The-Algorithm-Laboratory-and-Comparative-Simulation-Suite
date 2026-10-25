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
        '0': 'The tree starts empty. The first value becomes the root.',
        '1': '70 is larger than 50, so it becomes the right child of the root.',
        compare: 'Compare the new value with the current node. Smaller goes left, larger goes right.',
        insert: 'The value is attached as a leaf. Node identity comes from the inserting op and survives rebuilds.'
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
        compare: 'Follow the search path from the root to the node being deleted.',
        delete_leaf: 'Case 1: a leaf has no children, so it is removed directly.',
        delete_single_child: 'Case 2: the single child is promoted into the deleted node’s place.',
        delete_two_children: 'Case 3: find the in-order successor, then relink it into place.',
        delete_done: 'Deletion complete. Two-child delete preserves the successor’s node ID.'
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
            reveal: 'The in-order successor is the smallest node in the right subtree. It is relinked into place and keeps its ID.',
            onCorrect: 'Correct — the successor is relinked, not copied and deleted.',
            onWrong: 'The implementation relinks the in-order successor (smallest node in the right subtree).'
        }
    ],
    quizId: 'bstQuiz',
    emitQuizPrompt: true
};

export const BST_LESSONS = [bstInsertLesson, bstDeleteLesson];

/** Look up a lesson by id; returns null when absent. */
export function findBstLesson(id) {
    return BST_LESSONS.find(lesson => lesson.id === id) || null;
}

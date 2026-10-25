/**
 * heapLessons.js — heap lesson data for the LessonRunner.
 *
 * Data only. Each lesson names its heap type; `ops` are replayed statelessly
 * through POST /heap one action at a time so every step carries the normal
 * dual-panel snapshot. Heapsort lessons pass a whole `array` instead.
 *
 * Indexing used throughout: 0-based, children 2i+1 / 2i+2, parent (i−1)//2.
 */

const indexFormula = 'children at 2i+1 and 2i+2, parent at (i−1)//2';

export const heapInsertLesson = {
    id: 'heap-insert-bubble-up',
    title: 'Inserting into a heap (bubble up)',
    unit: 'heaps',
    heapType: 'min',
    description: 'Insert 5, 9, 2, 7, 1 into a min-heap and watch each value append, then bubble up.',
    values: [5, 9, 2, 7, 1],
    ops: [
        { op: 'insert', value: 5 },
        { op: 'insert', value: 9 },
        { op: 'insert', value: 2 },
        { op: 'insert', value: 7 },
        { op: 'insert', value: 1 }
    ],
    narration: {
        '0': 'A {{term:Heap|heap}} is a complete binary tree stored in an array. Index 0 is the root; ' + indexFormula + '. The first value becomes the root.',
        append: 'Append the new value at the next free index. Filling left to right keeps the tree complete, so the array indices always describe the shape.',
        compare: (step) => {
            const p = step.payload || {};
            if (p.child_index === undefined) return 'Sift-down compares the parent with its children.';
            return `Bubble up: append puts the value at index ${p.child_index}, so it compares with its parent at (${p.child_index}−1)//2 = ${p.parent_index}. A min-heap swaps only when the child is strictly smaller.`;
        },
        swap: (step) => {
            const p = step.payload || {};
            return `Swap indices ${p.from_index} and ${p.to_index}: ${p.from_value} moves up, ${p.to_value} moves down. The {{term:Heap Property|heap property}} now holds on that edge.`;
        },
        insert_done: 'The value has settled. Every parent is now ≤ its children, so the array is a valid min-heap (it is not sorted — a heap only promises the root is the minimum).'
    },
    checkpoints: [
        {
            beforeValue: 2,
            op: 'insert',
            kind: 'predict',
            prompt: '2 is appended at index 2. Which parent does bubble-up compare it with first?',
            choices: ['Index 0 (value 5)', 'Index 1 (value 9)', 'Index 3 (value 7)'],
            answer: 0,
            reveal: '(2−1)//2 = 0, so 2 compares with 5 at the root and swaps up.',
            onCorrect: 'Correct — the parent of index 2 is index 0.',
            onWrong: 'Use (i−1)//2 with integer division: (2−1)//2 = 0.'
        },
        {
            beforeValue: 1,
            op: 'insert',
            kind: 'predict',
            prompt: '1 is appended at index 4. Which value does it compare with first?',
            choices: ['7 at index 1', '2 at index 0', '9 at index 3'],
            answer: 0,
            reveal: '(4−1)//2 = 1, so 1 compares with the value at index 1 (7) before reaching the root.',
            onCorrect: 'Correct — bubble-up walks one parent at a time.',
            onWrong: 'The parent of index 4 is (4−1)//2 = 1, not the root.'
        }
    ],
    quizId: 'heapQuiz',
    emitQuizPrompt: true
};

export const heapExtractLesson = {
    id: 'heap-extract-bubble-down',
    title: 'Extracting the minimum (sift down)',
    unit: 'heaps',
    heapType: 'min',
    description: 'Build a min-heap from 5, 9, 2, 7, 1, then extract the root twice and watch sift-down repair it.',
    ops: [
        { op: 'build', values: [5, 9, 2, 7, 1] },
        { op: 'extract' },
        { op: 'extract' }
    ],
    narration: {
        '0': 'Build-heap turns an arbitrary array into a {{term:Heap|heap}} in O(n) by calling {{term:Heapify|heapify}} on every parent from the bottom up. Leaves are already valid heaps, so the work starts at n//2−1.',
        build_start: 'Bottom-up build: start at the last parent, index n//2−1 = 2 for these five values.',
        heapify_node_done: (step) => `The subtree rooted at index ${step.payload?.index} now satisfies the {{term:Heap Property|heap property}}. Later parents may still move values through this subtree.`,
        build_done: 'The whole array is a valid min-heap. The root is the minimum, but the rest is only partially ordered.',
        extract_root: (step) => `Extract the root (${step.payload?.value}), the heap minimum. A {{term:Priority Queue|priority queue}} is built on exactly this operation.`,
        remove_last: 'The last cell is removed, so the heap stays a complete tree with no hole in the array.',
        compare: (step) => {
            const p = step.payload || {};
            if (p.chosen_index === null || p.chosen_index === undefined) {
                return `Sift-down at index ${p.parent_index}: it already outranks both children, so the walk stops.`;
            }
            return `Sift-down: compare index ${p.parent_index} with children ${p.left_index} and ${p.right_index}, then swap with the smaller child at index ${p.chosen_index}.`;
        },
        swap: (step) => {
            const p = step.payload || {};
            return `Swap ${p.from_value} down and ${p.to_value} up (indices ${p.from_index} ↔ ${p.to_index}).`;
        },
        extract_done: (step) => `Extracted ${step.payload?.extracted_value}. The new root is the next minimum, and the heap property is restored.`
    },
    checkpoints: [
        {
            beforeValue: 1,
            op: 'extract',
            kind: 'predict',
            prompt: 'After build, the heap is [1, 5, 2, 7, 9]. When 1 is extracted, which element moves to the root before sift-down?',
            choices: ['The last element, 9', 'The smaller child, 2', 'The larger child, 5'],
            answer: 0,
            reveal: 'Extract always moves the last array cell to index 0 first, then sift-down repairs the order. Shifting the whole array would cost O(n).',
            onCorrect: 'Correct — last-to-root keeps the array complete.',
            onWrong: 'The children are not promoted; the last cell fills the hole so the array stays contiguous.'
        },
        {
            beforeValue: 2,
            op: 'extract',
            kind: 'predict',
            prompt: 'After the first extract the array is [2, 7, 5, 9]. Extracting again moves which element to index 0 first?',
            choices: ['The last element, 9', '7, the left child', '5, the right child'],
            answer: 0,
            reveal: 'Again the last cell (9) moves to the root; sift-down then swaps it with the smaller child 2.',
            onCorrect: 'Correct — the last-position rule is the same every round.',
            onWrong: 'The rule never changes: the last element fills the root before sift-down.'
        }
    ],
    quizId: 'heapQuiz',
    emitQuizPrompt: true
};

export const heapHeapsortLesson = {
    id: 'heap-heapsort',
    title: 'Heapsort: build, then extract',
    unit: 'heaps',
    heapType: 'max',
    mode: 'heapsort',
    description: 'Heapsort 5, 1, 9, 3, 7 with a max-heap: build the heap, then move the maximum to the shrinking tail.',
    array: [5, 1, 9, 3, 7],
    narration: {
        '0': 'Heapsort has two phases: build a max-heap, then repeatedly swap the root (the maximum) into the last heap slot and shrink the heap.',
        build_start: 'Phase 1: build a max-heap from the array.',
        heapify_node_done: (step) => `Subtree ${step.payload?.index} is now a valid max-heap.`,
        build_done: 'Phase 1 done: index 0 holds the largest value, 9.',
        swap: (step) => {
            const p = step.payload || {};
            return `Swap indices ${p.from_index} and ${p.to_index}: ${p.from_value} and ${p.to_value} change places.`;
        },
        mark_sorted: (step) => `Index ${step.payload?.sorted_from} is final (${step.snapshot?.array?.cells?.[step.payload?.sorted_from]?.value}). The sorted tail grows from the right while the heap region shrinks.`,
        heapsort_done: 'Phase 2 done. A max-heap produced an ascending array, so the {{term:Heapify|heapify}} work was O(n) and each of the n extractions cost O(log n): O(n log n) overall.'
    },
    checkpoints: [
        {
            anchorType: 'mark_sorted',
            occurrence: 1,
            kind: 'predict',
            prompt: 'The max-heap root is 9. Where does it go in the first round?',
            choices: ['Index 4, the last heap slot', 'Index 1, the left child', 'It stays at index 0'],
            answer: 0,
            reveal: 'Heapsort swaps the root with the last heap slot, then shrinks the heap by one. 9 is final at index 4.',
            onCorrect: 'Correct — the maximum is parked at the end of the shrinking heap.',
            onWrong: 'The root is swapped with the last array slot, not with a child.'
        },
        {
            anchorType: 'mark_sorted',
            occurrence: 2,
            kind: 'predict',
            prompt: 'Which value becomes final at index 3 in the second round?',
            choices: ['7', '9', '5'],
            answer: 0,
            reveal: 'After the first round the heap re-heapifies to put 7 at the root; 7 then moves to index 3.',
            onCorrect: 'Correct — each round parks the current maximum one slot earlier.',
            onWrong: '9 was already final at index 4. The next maximum of the remaining heap is 7.'
        }
    ],
    quizId: 'heapQuiz',
    emitQuizPrompt: true
};

export const HEAP_LESSONS = [heapInsertLesson, heapExtractLesson, heapHeapsortLesson];

/** Look up a heap lesson by id; returns null when absent. */
export function findHeapLesson(id) {
    return HEAP_LESSONS.find(lesson => lesson.id === id) || null;
}

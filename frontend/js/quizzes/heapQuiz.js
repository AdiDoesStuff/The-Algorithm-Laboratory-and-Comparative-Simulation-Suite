/*
 * Heap quiz — static, logic-free data.
 *
 * Every array state below was produced by backend/trees.py (heap_op_steps and
 * heapsort_steps), not by hand:
 *   insert 5, 9, 2, 7 into a min-heap  -> [2, 7, 5, 9]
 *   then insert 1                      -> [1, 2, 5, 9, 7]
 *   extract from [1, 2, 5, 9, 7]       -> [2, 7, 5, 9]
 *   bottom-up build [5, 9, 2, 7, 1]    -> [1, 5, 2, 7, 9]
 *   heapsort max [5, 1, 9, 3, 7]       -> [1, 3, 5, 7, 9]
 *   heapsort min [5, 1, 9, 3, 7]       -> [9, 7, 5, 3, 1]
 *
 * Question order follows the three Learn Mode lessons: insert/bubble-up,
 * extract/build, then heapsort and the tie rule. Indexing is 0-based
 * throughout (children 2i+1 and 2i+2, parent (i-1)//2).
 *
 * Schema: see docs/QUIZ_SPEC.md. Correctness is by option id, never position.
 */

export const heapQuiz = {
    id: "heapQuiz",
    unitId: "heaps",
    title: "Heaps & Heapsort: check yourself",
    questions: [
        {
            id: "heap-index-children",
            topic: "Array indexing",
            prompt: "AlgoLab stores a heap in a 0-based array. For the element at index 1, which indices hold its left and right children?",
            options: [
                { id: "correct", text: "Left child at 3, right child at 4" },
                { id: "one-based", text: "Left child at 2, right child at 3" },
                { id: "double", text: "Left child at 2, right child at 4" },
                { id: "siblings", text: "Left child at 0, right child at 2" }
            ],
            correctOptionId: "correct",
            explanation: "In a 0-based array the children of index i are 2i+1 and 2i+2. For i=1 that is 3 and 4."
        },
        {
            id: "heap-index-parent",
            topic: "Array indexing",
            prompt: "In the same 0-based array heap, what is the parent index of the element at index 6?",
            options: [
                { id: "correct", text: "2, because (6−1)//2 = 2" },
                { id: "three", text: "3, because 6//2 = 3" },
                { id: "five", text: "5, because 6−1 = 5" },
                { id: "twelve", text: "12, because 2×6 = 12" }
            ],
            correctOptionId: "correct",
            explanation: "The parent of index i is (i−1)//2. With integer division, (6−1)//2 = 5//2 = 2."
        },
        {
            id: "heap-insert-array-state",
            topic: "Insertion",
            prompt: "Start with an empty min-heap and insert 5, then 9, then 2, then 7. What does the backing array look like?",
            options: [
                { id: "correct", text: "[2, 7, 5, 9]" },
                { id: "unsorted", text: "[5, 9, 2, 7]" },
                { id: "sorted", text: "[2, 5, 7, 9]" },
                { id: "wrong-child", text: "[2, 9, 5, 7]" }
            ],
            correctOptionId: "correct",
            explanation: "5 becomes the root; 9 stays as its left child; 2 is appended at index 2 and bubbles up past 5 to the root; 7 is appended at index 3, bubbles up past 9, and stops under 2. The result is [2, 7, 5, 9], which is a valid min-heap but not fully sorted."
        },
        {
            id: "heap-insert-bubble-path",
            topic: "Insertion",
            prompt: "The min-heap array is [2, 7, 5, 9]. Insert 1. Which comparisons happen as it bubbles up?",
            options: [
                { id: "correct", text: "First against 7 at index 1 (swap), then against 2 at index 0 (swap)." },
                { id: "left-child", text: "First against 9 at index 3, then against 7 at index 1." },
                { id: "root-only", text: "Only against the root 2, then it stops." },
                { id: "none", text: "No comparisons; 1 stays at index 4 because it is appended last." }
            ],
            correctOptionId: "correct",
            explanation: "1 is appended at index 4, so its parent is (4−1)//2 = 1, the value 7. It swaps up to index 1, then compares with index 0 (value 2) and swaps again. The final array is [1, 2, 5, 9, 7]."
        },
        {
            id: "heap-extract-new-root",
            topic: "Extraction",
            prompt: "Extract the minimum from the min-heap [1, 2, 5, 9, 7]. After the last element is moved to the root and sift-down finishes, what is the array?",
            options: [
                { id: "correct", text: "[2, 7, 5, 9]" },
                { id: "shift", text: "[2, 5, 7, 9]" },
                { id: "unchanged", text: "[1, 2, 5, 9, 7]" },
                { id: "last-first", text: "[7, 2, 5, 9]" }
            ],
            correctOptionId: "correct",
            explanation: "The last element 7 moves to index 0, then sift-down compares 7 with children 2 and 5 and swaps with the smaller child 2. At index 1, 7 compares with 9 and stops. The array becomes [2, 7, 5, 9]."
        },
        {
            id: "heap-extract-why-last",
            topic: "Extraction",
            prompt: "Why does extract move the last array element to the root instead of shifting every element left?",
            options: [
                { id: "correct", text: "It keeps the tree complete and the array free of holes; shifting would cost O(n)." },
                { id: "sorting", text: "It immediately sorts the remaining elements." },
                { id: "smallest", text: "The last element is always the second smallest value." },
                { id: "root-copy", text: "It copies the removed root value into the last slot." }
            ],
            correctOptionId: "correct",
            explanation: "Popping the last cell keeps the array contiguous, so the complete-tree index formulas still describe the shape. Sift-down then restores the heap property in O(log n), while shifting every element would be O(n)."
        },
        {
            id: "heap-build-start-index",
            topic: "Build-heap",
            prompt: "Build-heap runs bottom-up. For an array of 6 values, which index is the last parent it starts from?",
            options: [
                { id: "correct", text: "Index 2, because n//2−1 = 6//2−1 = 2" },
                { id: "index-three", text: "Index 3, because n//2 = 3" },
                { id: "index-five", text: "Index 5, the last element" },
                { id: "index-zero", text: "Index 0, the root" }
            ],
            correctOptionId: "correct",
            explanation: "Leaves occupy indices n//2 through n−1, so the last parent is n//2−1. For n=6 that is 3−1 = 2. Heapify processes indices 2, 1, 0 in that order."
        },
        {
            id: "heap-build-result",
            topic: "Build-heap",
            prompt: "Run bottom-up build-heap on [5, 9, 2, 7, 1] as a min-heap. What is the resulting array?",
            options: [
                { id: "correct", text: "[1, 5, 2, 7, 9]" },
                { id: "sorted", text: "[1, 2, 5, 7, 9]" },
                { id: "unchanged", text: "[5, 9, 2, 7, 1]" },
                { id: "swapped-root", text: "[1, 9, 2, 7, 5]" }
            ],
            correctOptionId: "correct",
            explanation: "Index 1 (9) swaps with its smaller child 1, then index 0 (5) swaps with the smaller child 1, and finally the moved 5 is checked against 7 and 9. The result is [1, 5, 2, 7, 9], a valid min-heap but not a sorted array."
        },
        {
            id: "heap-heapsort-direction",
            topic: "Heapsort",
            prompt: "Heapsort on [5, 1, 9, 3, 7] uses a max-heap. In what order does the final array end up?",
            options: [
                { id: "correct", text: "Ascending: [1, 3, 5, 7, 9]" },
                { id: "descending", text: "Descending: [9, 7, 5, 3, 1]" },
                { id: "same", text: "The original order: [5, 1, 9, 3, 7]" },
                { id: "heap-order", text: "Heap order only: [9, 5, 7, 3, 1]" }
            ],
            correctOptionId: "correct",
            explanation: "A max-heap puts the largest value at index 0 each round; swapping it to the shrinking tail places the largest values at the end, so the array finishes ascending. A min-heap finishes descending."
        },
        {
            id: "heap-equal-values",
            topic: "Tie rule",
            prompt: "A min-heap contains a parent 4 and a child 4. Does bubble-up or sift-down swap them?",
            options: [
                { id: "correct", text: "No. The comparison is strict, so equal values never swap and the trace stays stable." },
                { id: "always", text: "Yes. Any child that is not larger than its parent is swapped." },
                { id: "random", text: "It depends on the insertion order, so duplicates are not allowed." },
                { id: "error", text: "It raises an error, because a heap cannot hold duplicates." }
            ],
            correctOptionId: "correct",
            explanation: "AlgoLab swaps only when the child is strictly smaller (min) or strictly larger (max). Equal children stop the walk, which keeps duplicate-heavy traces deterministic. Duplicates are allowed."
        }
    ]
};

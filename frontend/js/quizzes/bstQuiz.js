/*
 * BST quiz — static, logic-free data.
 *
 * Every correct answer here was verified against backend/trees.py by script
 * (traversals, deletion shapes, classification flags, and height/depth), not
 * by reasoning. The convention used by the app and stated in the questions:
 * height and depth are counted in edges, so a leaf has height 0, an empty
 * tree has height -1, and the root is at depth 0.
 *
 * Schema: see docs/QUIZ_SPEC.md. Correctness is by option id, never position.
 */

export const bstQuiz = {
    id: "bstQuiz",
    unitId: "bst",
    title: "BST & Trees: check yourself",
    questions: [
        {
            id: "bst-inorder-balanced",
            topic: "Traversal",
            prompt: "Insert 50, 30, 70, 20, 40, 60, 80 into an empty BST in that order. What is the inorder traversal?",
            options: [
                { id: "inorder", text: "20, 30, 40, 50, 60, 70, 80" },
                { id: "preorder", text: "50, 30, 20, 40, 70, 60, 80" },
                { id: "postorder", text: "20, 40, 30, 60, 80, 70, 50" },
                { id: "level", text: "50, 30, 70, 20, 40, 60, 80" }
            ],
            correctOptionId: "inorder",
            explanation: "Inorder visits the left subtree, then the node, then the right subtree. For a BST that always produces the values in ascending order: 20, 30, 40, 50, 60, 70, 80."
        },
        {
            id: "bst-preorder-unbalanced",
            topic: "Traversal",
            prompt: "Insert 50, 30, 70, 60, 80, 65 into an empty BST. What is the preorder traversal?",
            options: [
                { id: "preorder", text: "50, 30, 70, 60, 65, 80" },
                { id: "inorder", text: "30, 50, 60, 65, 70, 80" },
                { id: "postorder", text: "30, 65, 60, 80, 70, 50" },
                { id: "level", text: "50, 30, 70, 60, 80, 65" }
            ],
            correctOptionId: "preorder",
            explanation: "Preorder records a node before its children: 50, then its left subtree (30), then its right subtree (70, 60, 65, 80)."
        },
        {
            id: "bst-postorder-complete",
            topic: "Traversal",
            prompt: "Insert 50, 30, 70, 20, 40, 60 into an empty BST. What is the postorder traversal?",
            options: [
                { id: "postorder", text: "20, 40, 30, 60, 70, 50" },
                { id: "inorder", text: "20, 30, 40, 50, 60, 70" },
                { id: "preorder", text: "50, 30, 20, 40, 70, 60" },
                { id: "level", text: "50, 30, 70, 20, 40, 60" }
            ],
            correctOptionId: "postorder",
            explanation: "Postorder finishes both subtrees before the node: left subtree (20, 40, 30), right subtree (60, 70), then the root 50."
        },
        {
            id: "bst-delete-leaf",
            topic: "Deletion",
            prompt: "A BST holds the insertions 50, 30, 70, 20, 40, 60. Delete 20, which is a leaf. What is the inorder traversal afterwards?",
            options: [
                { id: "correct", text: "30, 40, 50, 60, 70" },
                { id: "unchanged", text: "20, 30, 40, 50, 60, 70" },
                { id: "dropped", text: "30, 50, 60, 70" },
                { id: "extra", text: "30, 40, 50, 60, 70, 80" }
            ],
            correctOptionId: "correct",
            explanation: "Deleting a leaf only unlinks that node, so 20 disappears and the remaining values stay in order: 30, 40, 50, 60, 70."
        },
        {
            id: "bst-delete-one-child",
            topic: "Deletion",
            prompt: "In the BST built from 50, 30, 70, 20, 40, 60, node 70 has one child (60). After deleting 70, which statement is true?",
            options: [
                { id: "correct", text: "60 moves up to become the right child of 50." },
                { id: "root", text: "60 becomes the new root of the whole tree." },
                { id: "drop-subtree", text: "The entire right subtree of 50 is removed." },
                { id: "null-pointer", text: "70's left child pointer is set to null, dropping 60." }
            ],
            correctOptionId: "correct",
            explanation: "A node with one child is replaced by that child. 60 takes 70's place as the right child of 50, and nothing else moves."
        },
        {
            id: "bst-delete-two-children",
            topic: "Deletion",
            prompt: "Insert 50, 30, 70, 60, 80, 65 into an empty BST, then delete 50. Which value replaces 50 at the root, and why?",
            options: [
                { id: "successor", text: "60, the smallest value in 50's right subtree (the inorder successor)." },
                { id: "predecessor", text: "30, the largest value in 50's left subtree (the inorder predecessor)." },
                { id: "deepest", text: "65, the deepest node in the right subtree." },
                { id: "direct-child", text: "70, because it is 50's direct right child." }
            ],
            correctOptionId: "successor",
            explanation: "A two-child deletion is repaired with the inorder successor: the leftmost node of the right subtree, here 60. The successor's right child (65) is reattached under 70."
        },
        {
            id: "bst-classify-perfect",
            topic: "Classification",
            prompt: "Insert 50, 30, 70, 20, 40, 60, 80 into an empty BST. How is this tree classified?",
            options: [
                { id: "perfect", text: "Perfect — and therefore also full, complete, and balanced." },
                { id: "full-only", text: "Full but not complete." },
                { id: "complete-only", text: "Complete but not perfect." },
                { id: "balanced-only", text: "Balanced only; it is neither full nor complete." }
            ],
            correctOptionId: "perfect",
            explanation: "Every level is completely filled, so the tree is perfect. Perfect trees are always full, complete, and balanced."
        },
        {
            id: "bst-classify-mixed",
            topic: "Classification",
            prompt: "Insert 50, 30, 70, 60, 80, 65 into an empty BST. Which classification is correct?",
            options: [
                { id: "none", text: "Not full, not complete, and not balanced." },
                { id: "full-complete", text: "Full and complete, but unbalanced." },
                { id: "complete-balanced", text: "Complete and balanced, but not full." },
                { id: "full-complete-2", text: "Full, unbalanced, and complete." }
            ],
            correctOptionId: "none",
            explanation: "Node 60 has only a right child (65), so the tree is not full. The level holding 60 and 80 has a gap on the left, so it is not complete. And 50's left subtree has height 0 while its right subtree has height 2, so it is unbalanced."
        },
        {
            id: "bst-height-depth-definitions",
            topic: "Height vs depth",
            prompt: "AlgoLab counts height and depth in edges: a leaf has height 0, an empty tree has height -1, and the root sits at depth 0. For the BST built from 50, 30, 70, 20, 40, 60, 80, what are the height of the tree and the depth of node 20?",
            options: [
                { id: "correct", text: "Height 2, depth 2" },
                { id: "height-nodes", text: "Height 3, depth 2" },
                { id: "depth-root-one", text: "Height 2, depth 3" },
                { id: "both-nodes", text: "Height 3, depth 3" }
            ],
            correctOptionId: "correct",
            explanation: "The longest root-to-leaf path (50 → 30 → 20) has 2 edges, so the tree height is 2. Node 20 is reached in the same 2 edges from the root, so its depth is 2."
        },
        {
            id: "bst-height-depth-concrete",
            topic: "Height vs depth",
            prompt: "Insert 50, 30, 70, 60, 80, 65 into an empty BST. Using AlgoLab's edge-counting convention, what are the depth of node 65 and the height of node 60?",
            options: [
                { id: "correct", text: "Depth 3, height 1" },
                { id: "depth-nodes", text: "Depth 4, height 2" },
                { id: "height-nodes", text: "Depth 3, height 2" },
                { id: "depth-wrong", text: "Depth 2, height 1" }
            ],
            correctOptionId: "correct",
            explanation: "65 sits on the path 50 → 70 → 60 → 65, which is 3 edges from the root. Node 60 has one child (65), so its height is 1 edge."
        }
    ]
};

/*
 * BST quiz — static, logic-free data.
 *
 * Every correct answer here was verified against backend/trees.py by script
 * (traversals, deletion shapes, classification flags, and height/depth), not
 * by reasoning. The convention used by the app and stated in the questions:
 * height and depth are counted in edges, so a leaf has height 0, an empty
 * tree has height -1, and the root is at depth 0.
 *
 * The question order follows the three Learn Mode lessons:
 *   1. insertion, height/depth   (tree: 50, 30, 70, 20, 40, 60, 80)
 *   2. deletion, three cases     (tree: 50, 30, 70, 20, 40, 60)
 *   3. classification/traversal  (tree: 50, 30, 70, 20, 40, 60, 80)
 * Each question names the same tree its lesson builds, so nothing is asked
 * that the lessons did not show. Concepts whose lesson wording may be brief
 * still state their definition in the prompt.
 *
 * Schema: see docs/QUIZ_SPEC.md. Correctness is by option id, never position.
 */

export const bstQuiz = {
    id: "bstQuiz",
    unitId: "bst",
    title: "BST & Trees: check yourself",
    questions: [
        {
            id: "bst-height-depth-definitions",
            topic: "Height vs depth",
            prompt: "AlgoLab counts height and depth in edges: a leaf has height 0, an empty tree has height -1, and the root sits at depth 0. For the tree built in the insertion lesson from 50, 30, 70, 20, 40, 60, 80, what are the height of the tree and the depth of node 20?",
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
            prompt: "Using the same edge-counting convention on the insertion lesson's tree (50, 30, 70, 20, 40, 60, 80), what are the depth of node 40 and the height of node 30?",
            options: [
                { id: "correct", text: "Depth 2, height 1" },
                { id: "depth-nodes", text: "Depth 3, height 2" },
                { id: "height-nodes", text: "Depth 2, height 2" },
                { id: "depth-wrong", text: "Depth 1, height 1" }
            ],
            correctOptionId: "correct",
            explanation: "Node 40 sits on the path 50 → 30 → 40, which is 2 edges from the root. Node 30 has two children (20 and 40), so its height is 1 edge."
        },
        {
            id: "bst-insert-path",
            topic: "Insertion",
            prompt: "The insertion lesson builds 50, 30, 70, 20, 40, 60, 80. Following the comparisons from the root, where does a new value 45 attach?",
            options: [
                { id: "right-40", text: "As the right child of 40" },
                { id: "right-30", text: "As the right child of 30" },
                { id: "left-50", text: "As the left child of 50" },
                { id: "right-50", text: "As the right child of 50" }
            ],
            correctOptionId: "right-40",
            explanation: "45 < 50, so go left to 30. 45 > 30, so go right to 40. 45 > 40 and 40 has no right child, so 45 attaches as the right child of 40."
        },
        {
            id: "bst-delete-leaf",
            topic: "Deletion",
            prompt: "The deletion lesson builds 50, 30, 70, 20, 40, 60. Delete 20, which is a leaf. Which values remain in the tree, in ascending order?",
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
            prompt: "In the same deletion lesson tree (50, 30, 70, 20, 40, 60), node 70 has one child, 60. After deleting 70, which statement is true?",
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
            prompt: "The deletion lesson tree is 50, 30, 70, 20, 40, 60. Delete 50, which has two children. Which value replaces 50 at the root, and why?",
            options: [
                { id: "successor", text: "60, the smallest value in 50's right subtree (the inorder successor)." },
                { id: "predecessor", text: "30, the largest value in 50's left subtree (the inorder predecessor)." },
                { id: "direct-child", text: "70, because it is 50's direct right child." },
                { id: "leftmost-leaf", text: "20, the leftmost leaf in the whole tree." }
            ],
            correctOptionId: "successor",
            explanation: "The inorder successor is the leftmost node of the right subtree: 60. It moves into 50's place, so 60 becomes the root with 30 on the left and 70 on the right."
        },
        {
            id: "bst-classify-perfect",
            topic: "Classification",
            prompt: "The traversal lesson builds the tree 50, 30, 70, 20, 40, 60, 80. A full tree has nodes with either 0 or 2 children, a complete tree fills every level left to right, a balanced tree keeps subtree heights within 1, and a perfect tree has every level completely filled. How is this tree classified?",
            options: [
                { id: "perfect", text: "Perfect — and therefore also full, complete, and balanced." },
                { id: "full-only", text: "Full but not complete." },
                { id: "complete-only", text: "Complete but not perfect." },
                { id: "balanced-only", text: "Balanced only; it is neither full nor complete." }
            ],
            correctOptionId: "perfect",
            explanation: "Every level is completely filled: 50; then 30 and 70; then 20, 40, 60, 80. The tree is perfect, and perfect trees are always full, complete, and balanced."
        },
        {
            id: "bst-inorder-perfect",
            topic: "Traversal",
            prompt: "The traversal lesson builds 50, 30, 70, 20, 40, 60, 80. Inorder visits the left subtree, then the node, then the right subtree. What is the inorder traversal?",
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
            id: "bst-preorder-perfect",
            topic: "Traversal",
            prompt: "Using the same tree (50, 30, 70, 20, 40, 60, 80), preorder visits the node, then its left subtree, then its right subtree. What is the preorder traversal?",
            options: [
                { id: "preorder", text: "50, 30, 20, 40, 70, 60, 80" },
                { id: "inorder", text: "20, 30, 40, 50, 60, 70, 80" },
                { id: "postorder", text: "20, 40, 30, 60, 80, 70, 50" },
                { id: "level", text: "50, 30, 70, 20, 40, 60, 80" }
            ],
            correctOptionId: "preorder",
            explanation: "Preorder records a node before its children: 50, then its left subtree (30, 20, 40), then its right subtree (70, 60, 80)."
        },
        {
            id: "bst-postorder-perfect",
            topic: "Traversal",
            prompt: "Using the same tree (50, 30, 70, 20, 40, 60, 80), postorder visits the left subtree, the right subtree, then the node. What is the postorder traversal?",
            options: [
                { id: "postorder", text: "20, 40, 30, 60, 80, 70, 50" },
                { id: "inorder", text: "20, 30, 40, 50, 60, 70, 80" },
                { id: "preorder", text: "50, 30, 20, 40, 70, 60, 80" },
                { id: "level", text: "50, 30, 70, 20, 40, 60, 80" }
            ],
            correctOptionId: "postorder",
            explanation: "Postorder finishes both subtrees before the node: left subtree (20, 40, 30), right subtree (60, 80, 70), then the root 50."
        }
    ]
};

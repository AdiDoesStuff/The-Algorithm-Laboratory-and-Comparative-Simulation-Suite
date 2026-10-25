/*
 * AVL quiz — static, logic-free data.
 *
 * Every sequence and answer below was produced by backend/trees.py
 * (avl_op_steps and bst_insert_steps), not by hand:
 *   30, 20, 10              -> LL at 30; 20 becomes the root, height 1
 *   10, 20, 30              -> RR at 10; 20 becomes the root, height 1
 *   30, 10, 20              -> LR at 30; 20 becomes the root, height 1
 *   10, 30, 20              -> RL at 10; 20 becomes the root, height 1
 *   30, 20, 10, 40 + 50     -> RR at 30; 40 becomes the subtree root
 *   30, 10, 20, 40 + 35     -> RL at 30; 35 becomes the subtree root
 *   30, 20, 40, 10 - 40     -> LL at 30; 20 becomes the root
 *   10, 20, 30, 40, 50, 25  -> final root 30, height 2
 *   10, 20, 30, 40, 50      -> plain BST height 4, AVL height 2
 *
 * Balance factor is height(left) - height(right); height is counted in edges.
 * Schema: see docs/QUIZ_SPEC.md. Correctness is by option id, never position.
 */

export const avlQuiz = {
    id: "avlQuiz",
    unitId: "avl",
    title: "AVL Trees: check yourself",
    questions: [
        {
            id: "avl-ll-minimal",
            topic: "LL case",
            prompt: "Insert 30, then 20, then 10. The first two inserts are balanced. Which rotation does inserting 10 trigger?",
            options: [
                { id: "correct", text: "LL — rotate right at 30; 20 becomes the root." },
                { id: "rr", text: "RR — rotate left at 30; 20 becomes the root." },
                { id: "lr", text: "LR — rotate left at 20, then right at 30." },
                { id: "none", text: "No rotation: a right-leaning chain is already balanced." }
            ],
            correctOptionId: "correct",
            explanation: "After 30 and 20 the root is 20. Inserting 10 makes 30 left-heavy with bf +2, and the heavy child 20 is also left-heavy. That is left-left, fixed by one right rotation at 30."
        },
        {
            id: "avl-rr-minimal",
            topic: "RR case",
            prompt: "Insert 10, then 20, then 30. Which rotation restores balance?",
            options: [
                { id: "correct", text: "RR — rotate left at 10; 20 becomes the root." },
                { id: "ll", text: "LL — rotate right at 10; 20 becomes the root." },
                { id: "rl", text: "RL — rotate right at 20, then left at 10." },
                { id: "none", text: "No rotation: ascending values do not unbalance a tree." }
            ],
            correctOptionId: "correct",
            explanation: "10 now has bf −2 and its right child 20 is right-heavy, so the shape is right-right. One left rotation at 10 makes 20 the root."
        },
        {
            id: "avl-lr-minimal",
            topic: "LR case",
            prompt: "Insert 30, then 10, then 20. Which sequence of single rotations restores balance?",
            options: [
                { id: "correct", text: "LR — rotate left at 10, then rotate right at 30." },
                { id: "ll", text: "LL — rotate right at 30 once." },
                { id: "rr", text: "RR — rotate left at 30 once." },
                { id: "child-only", text: "Rotate right at 10 only." }
            ],
            correctOptionId: "correct",
            explanation: "30 is left-heavy (bf +2) but its left child 10 is right-heavy (bf −1). That inside lean is LR: rotate left at 10 to make a left-left chain, then rotate right at 30. 20 ends up as the root."
        },
        {
            id: "avl-rl-minimal",
            topic: "RL case",
            prompt: "Insert 10, then 30, then 20. Which sequence of single rotations restores balance?",
            options: [
                { id: "correct", text: "RL — rotate right at 30, then rotate left at 10." },
                { id: "rr", text: "RR — rotate left at 10 once." },
                { id: "ll", text: "LL — rotate right at 10 once." },
                { id: "child-only", text: "Rotate left at 30 only." }
            ],
            correctOptionId: "correct",
            explanation: "10 is right-heavy (bf −2) and its right child 30 is left-heavy (bf +1). That is RL: rotate right at 30 to make a right-right chain, then rotate left at 10. 20 becomes the root."
        },
        {
            id: "avl-case-from-signs",
            topic: "Reading balance factors",
            prompt: "A node has bf −2 and its right child has bf +1. Which case is this?",
            options: [
                { id: "correct", text: "RL — right-left, fixed by two rotations." },
                { id: "rr", text: "RR — right-right, fixed by one left rotation." },
                { id: "lr", text: "LR — left-right, fixed by two rotations." },
                { id: "ll", text: "LL — left-left, fixed by one right rotation." }
            ],
            correctOptionId: "correct",
            explanation: "The parent is right-heavy (negative bf) and the heavy child is left-heavy (positive bf), so the heavy path bends from right to left: RL. RL and LR are the inside cases and need two single rotations."
        },
        {
            id: "avl-insert-after-ll",
            topic: "Cascading inserts",
            prompt: "After 30, 20, 10 the tree is balanced with root 20. Then insert 40, then 50. Which rotation does inserting 50 trigger?",
            options: [
                { id: "correct", text: "RR at 30 — rotate left; 40 becomes the subtree root." },
                { id: "ll", text: "LL at 30 — rotate right; 20 becomes the subtree root." },
                { id: "rl", text: "RL at 20 — rotate right at 40, then left at 20." },
                { id: "none", text: "No rotation: 40 absorbs the new value." }
            ],
            correctOptionId: "correct",
            explanation: "After 40, node 30 has a single right child. Inserting 50 makes 30 right-right heavy with bf −2, so one left rotation at 30 puts 40 at the top of that subtree. The root above (20) stays put."
        },
        {
            id: "avl-insert-after-lr",
            topic: "Cascading inserts",
            prompt: "After 30, 10, 20 the tree is balanced with root 20. Then insert 40, then 35. Which rotation does inserting 35 trigger?",
            options: [
                { id: "correct", text: "RL at 30 — rotate right at 40, then left at 30." },
                { id: "rr", text: "RR at 30 — rotate left at 30 once." },
                { id: "lr", text: "LR at 20 — rotate left at 30, then right at 20." },
                { id: "none", text: "No rotation: 35 fits under 40 without changing balance." }
            ],
            correctOptionId: "correct",
            explanation: "Inserting 35 gives node 30 bf −2, but its right child 40 has bf +1 because 35 went to 40's left. The right-left inside case rotates right at 40, then left at 30; 35 becomes that subtree's root."
        },
        {
            id: "avl-delete-rotation",
            topic: "Deleting and rebalancing",
            prompt: "The tree is 30 (root) with left child 20 and right child 40; 20 has left child 10. Delete 40. Which rotation restores balance?",
            options: [
                { id: "correct", text: "LL at 30 — rotate right; 20 becomes the root." },
                { id: "rr", text: "RR at 20 — rotate left; 30 becomes the root." },
                { id: "lr", text: "LR at 30 — rotate left at 20, then right at 30." },
                { id: "none", text: "No rotation: deleting a leaf cannot unbalance the tree." }
            ],
            correctOptionId: "correct",
            explanation: "Removing 40 leaves 30 with bf +2 and its left child 20 is also left-heavy (bf +1 from 10). That is LL, so one right rotation at 30 makes 20 the root. Unlike insert, delete then keeps checking ancestors."
        },
        {
            id: "avl-cascading-final-root",
            topic: "Cascading rotations",
            prompt: "Insert 10, 20, 30, 40, 50, then 25 into an AVL tree. Which value is the final root?",
            options: [
                { id: "correct", text: "30" },
                { id: "twenty", text: "20" },
                { id: "forty", text: "40" },
                { id: "twentyfive", text: "25" }
            ],
            correctOptionId: "correct",
            explanation: "Ascending inserts rotate 10 and then 30, leaving 20 as the root. Inserting 25 makes 20 right-heavy with its right child 40 left-heavy, an RL case at 20. The double rotation promotes 30, so the final root is 30 and the height is 2."
        },
        {
            id: "avl-height-versus-bst",
            topic: "Why balance matters",
            prompt: "Insert 10, 20, 30, 40, 50 in that order into a plain BST and into an AVL tree. Which pair of heights do you get?",
            options: [
                { id: "correct", text: "Plain BST height 4; AVL height 2." },
                { id: "same", text: "Both have height 4." },
                { id: "reversed", text: "Plain BST height 2; AVL height 4." },
                { id: "both-two", text: "Both have height 2." }
            ],
            correctOptionId: "correct",
            explanation: "The plain BST keeps every value on one long right spine, so its height is 4. The AVL tree rotates after 30 and again after 50, keeping its height at 2. That is the difference the Compare toggle makes visible."
        }
    ]
};

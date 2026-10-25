/*
 * Trie quiz — static, logic-free data.
 *
 * Every count and outcome below was produced by backend/tries.py, not written
 * by hand:
 *   car, card           -> inserting card creates 1 node (d), reuses 3
 *   car, card, care, cat -> 7 nodes including the root, 14 letters
 *   search "ca"          -> path exists, not_found reason "not_a_word"
 *   prefix "ca"          -> completions car, card, care, cat
 *   a, an, ant           -> 4 nodes, 3 terminal nodes
 *   card, then car       -> 0 created, 3 reused, r becomes terminal
 *   car, cat, then cab   -> 1 created (b), 2 reused
 *
 * Lookup time depends on key length, not on how many words are stored.
 * Schema: see docs/QUIZ_SPEC.md. Correctness is by option id, never position.
 */

export const trieQuiz = {
    id: "trieQuiz",
    unitId: "trie",
    title: "Tries: check yourself",
    questions: [
        {
            id: "trie-shared-prefix-insert",
            topic: "Shared prefixes",
            prompt: "The trie stores car. You insert card. How many new nodes does the insert create?",
            options: [
                { id: "correct", text: "1 — only the node for d" },
                { id: "four", text: "4 — one for each letter of card" },
                { id: "two", text: "2 — one for d and one new root" },
                { id: "zero", text: "0 — card is rejected because car exists" }
            ],
            correctOptionId: "correct",
            explanation: "The path c → a → r already exists, so those three nodes are reused. Only the final d is missing. A longer word is not a duplicate: it just adds the new suffix."
        },
        {
            id: "trie-node-count-four-words",
            topic: "Counting nodes",
            prompt: "Insert car, card, care, cat in that order. How many nodes does the trie contain, including the root?",
            options: [
                { id: "correct", text: "7" },
                { id: "six", text: "6" },
                { id: "fourteen", text: "14" },
                { id: "nine", text: "9" }
            ],
            correctOptionId: "correct",
            explanation: "The root plus c, a, r, d, e and t is 7 nodes. The words contain 14 letters, but c, a and r are shared, which is why the trie needs far fewer nodes than letters."
        },
        {
            id: "trie-compression-line",
            topic: "Why prefixes help",
            prompt: "Those four words hold 14 letters in 6 non-root nodes. What does that difference show?",
            options: [
                { id: "correct", text: "Shared prefixes are stored once, so nodes can be fewer than letters." },
                { id: "wrong", text: "The trie compresses each word with a separate hash." },
                { id: "same", text: "Every word always needs exactly one node per letter." },
                { id: "lost", text: "Some letters were dropped because they were duplicates." }
            ],
            correctOptionId: "correct",
            explanation: "car, card, care and cat all start with ca. The trie stores that path once and branches only where the words diverge, so 14 letters fit in 6 non-root nodes."
        },
        {
            id: "trie-search-prefix-only",
            topic: "Search outcomes",
            prompt: "The trie stores car, card, care and cat. What does searching for ca return?",
            options: [
                { id: "correct", text: "Not found — the path exists but the node for a is not terminal." },
                { id: "found", text: "Found — every letter of ca has an edge." },
                { id: "all", text: "Found, with all four completions." },
                { id: "error", text: "An error, because ca is shorter than every stored word." }
            ],
            correctOptionId: "correct",
            explanation: "Search follows the edges c then a successfully, but a search only succeeds when the final node carries the end-of-word marker. ca is a prefix, not a stored word."
        },
        {
            id: "trie-autocomplete-ca",
            topic: "Autocomplete",
            prompt: "With car, card, care and cat stored, what does prefix autocomplete for ca list?",
            options: [
                { id: "correct", text: "car, card, care, cat" },
                { id: "none", text: "Nothing, because a is not terminal" },
                { id: "one", text: "Only car" },
                { id: "ca", text: "ca itself, followed by the four words" }
            ],
            correctOptionId: "correct",
            explanation: "Autocomplete walks to the prefix node, then collects every terminal below it. All four words continue below a, and the non-terminal prefix itself is not a completion."
        },
        {
            id: "trie-terminal-count",
            topic: "Terminal markers",
            prompt: "Insert a, then an, then ant. How many terminal nodes does the trie have?",
            options: [
                { id: "correct", text: "3 — a, n and t" },
                { id: "one", text: "1 — only the last letter of ant" },
                { id: "two", text: "2 — a and t" },
                { id: "four", text: "4 — the root and all three letters" }
            ],
            correctOptionId: "correct",
            explanation: "Each inserted word marks its final node: a, n and t. The root is never terminal. A terminal node may still have children, which is exactly how a, an and ant coexist."
        },
        {
            id: "trie-terminal-with-children",
            topic: "Terminal markers",
            prompt: "Which statement about terminal nodes in a trie is true?",
            options: [
                { id: "correct", text: "A terminal node may have children, because a word can be a prefix of a longer word." },
                { id: "leaf", text: "A terminal node must always be a leaf." },
                { id: "root", text: "Only the root can be terminal." },
                { id: "one", text: "A node can be terminal for at most one word." }
            ],
            correctOptionId: "correct",
            explanation: "Inserting a and then an leaves a terminal while adding a child n. The marker records that a word ends there; it does not forbid longer words from continuing."
        },
        {
            id: "trie-insert-word-as-prefix",
            topic: "Words that are prefixes",
            prompt: "The trie stores card. You now insert car. What happens?",
            options: [
                { id: "correct", text: "No new node is created; the existing r node is marked terminal." },
                { id: "three", text: "Three new nodes are created for c, a and r." },
                { id: "reject", text: "The insert is rejected because car is a prefix of card." },
                { id: "delete", text: "The trie deletes card and stores car instead." }
            ],
            correctOptionId: "correct",
            explanation: "The path c → a → r already exists, so the insert reuses all three nodes and only flips r's end-of-word marker. Backend metrics for this case are 0 created and 3 reused."
        },
        {
            id: "trie-created-reused-cab",
            topic: "Created versus reused",
            prompt: "The trie stores car and cat. You insert cab. How many nodes are created and reused?",
            options: [
                { id: "correct", text: "1 created (b), 2 reused (c and a)" },
                { id: "three", text: "3 created, 0 reused" },
                { id: "zero", text: "0 created, 3 reused" },
                { id: "two", text: "2 created (a and b), 1 reused (c)" }
            ],
            correctOptionId: "correct",
            explanation: "cab shares c and a with the stored words, then needs a new b edge. The backend reports created_count 1 and reused_count 2."
        },
        {
            id: "trie-lookup-cost",
            topic: "Complexity",
            prompt: "How does the time to look up a word in a trie grow?",
            options: [
                { id: "correct", text: "With the length of the word, not with the number of stored words." },
                { id: "count", text: "With the number of stored words, not with the word length." },
                { id: "nlog", text: "With n log n, where n is the number of words." },
                { id: "constant", text: "It is always a single comparison, whatever the word length." }
            ],
            correctOptionId: "correct",
            explanation: "A lookup follows one edge per character, so its cost is O(length). That is the trie's advantage over searching a list of keys: adding more words does not lengthen the path for a given word."
        }
    ]
};

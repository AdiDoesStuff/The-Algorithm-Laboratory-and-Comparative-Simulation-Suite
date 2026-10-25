/**
 * trieLessons.js — Trie lesson data for the LessonRunner.
 *
 * Data only. Every action is replayed statelessly through POST /trie by the
 * page controller, so the lesson steps are produced by the real generator,
 * not written by hand. Insert actions are committed to the simulated op log;
 * search and prefix actions are read-only.
 *
 * Facts used below were produced by backend/tries.py:
 *   car, card, care, cat  -> 7 nodes (root + c,a,r,d,e,t), 14 letters
 *   insert card           -> 1 created, 3 reused
 *   search "ca"           -> path exists, not_found reason "not_a_word"
 *   prefix "ca"           -> completions car, card, care, cat
 *   a, an, ant            -> 4 nodes (root + a,n,t), 3 terminal nodes
 */

const baseNarration = {
    node_created: (step) => {
        const p = step.payload || {};
        return `Create '${p.letter}' at depth ${p.depth}: no child edge with that letter existed yet.`;
    },
    node_reused: (step) => {
        const p = step.payload || {};
        return `Reuse '${p.letter}' at depth ${p.depth}: the edge already exists, so this word shares that node. Shared prefixes are what keep a {{term:Trie|trie}} compact.`;
    },
    mark_end: (step) => {
        const p = step.payload || {};
        return `Mark the node for '${p.word}' as an {{term:End-of-Word Marker|end of word}}. The double ring means a word stops here, even when longer words continue below.`;
    },
    insert_done: (step) => {
        const p = step.payload || {};
        return `Insert complete: ${p.created_count} node${p.created_count === 1 ? '' : 's'} created and ${p.reused_count} reused.`;
    },
    match: (step) => {
        const p = step.payload || {};
        return `Follow the existing '${p.letter}' edge to depth ${p.depth}.`;
    },
    no_match: (step) => {
        const p = step.payload || {};
        return `No '${p.letter}' edge at depth ${p.depth}; the path stops at node ${p.failed_at}.`;
    },
    found: (step) => {
        const p = step.payload || {};
        return `The path ends on a terminal node, so '${p.word}' is stored.`;
    },
    not_found: (step) => {
        const p = step.payload || {};
        if (p.reason === 'missing_edge') {
            return 'Not found: a letter edge is missing, so no stored word can have this prefix.';
        }
        return 'The path exists, but it ends on a non-terminal node: this is a prefix, not a stored word.';
    },
    search_done: (step) => {
        const p = step.payload || {};
        return `Search for '${p.word}' complete: ${p.found ? 'found' : 'not found'}.`;
    },
    prefix_matched: (step) => {
        const p = step.payload || {};
        return `Prefix '${p.prefix}' ends at node ${p.node_id}. Every completion shares this path.`;
    },
    prefix_missing: (step) => {
        const p = step.payload || {};
        return `No stored word starts with '${p.prefix}'.`;
    },
    prefix_done: (step) => {
        const p = step.payload || {};
        const list = Array.isArray(p.completions) ? p.completions : [];
        if (list.length === 0) return `0 completions for '${p.prefix}'.`;
        return `${list.length} completion${list.length === 1 ? '' : 's'} for '${p.prefix}': ${list.join(', ')}${p.truncated ? ' (list truncated)' : ''}.`;
    }
};

export const trieBuildLesson = {
    id: 'trie-build-prefixes',
    title: 'Build a trie, share prefixes',
    unit: 'trie',
    description: 'Insert car, card, care and cat. Only the first word creates a full path; every later word reuses the nodes it shares.',
    actions: [
        { op: 'insert', word: 'car' },
        { op: 'insert', word: 'card' },
        { op: 'insert', word: 'care' },
        { op: 'insert', word: 'cat' }
    ],
    narration: {
        ...baseNarration,
        '0': 'A {{term:Trie|trie}} stores characters on edges, not whole words on nodes. Insert car first: the trie must create c, a and r, then mark r as the end of a word.'
    },
    checkpoints: [
        {
            anchorType: 'node_created',
            occurrence: 4,
            anchorOffset: -1,
            kind: 'predict',
            prompt: 'The path c → a → r already exists from the word car. Inserting card walks that path. What happens next?',
            choices: [
                'Create one new node, for d, and mark it as an end of word',
                'Create four new nodes, one per letter',
                'Reject card because car is already stored',
                'Reuse r as the end of card without adding a node'
            ],
            answer: 0,
            reveal: 'c, a and r are reused. Only d is missing, so card adds a single node and marks it terminal.',
            onCorrect: 'Correct — shared prefixes are reused, and only the new suffix costs nodes.',
            onWrong: 'The stored path is c → a → r. Only the final d is new.'
        },
        {
            anchorType: 'mark_end',
            occurrence: 2,
            anchorOffset: 0,
            kind: 'check',
            prompt: 'After inserting car and card, which words does the trie store?',
            choices: ['car and card', 'car only', 'card only', 'car, card, care and cat'],
            answer: 0,
            reveal: 'Both r and d carry the end-of-word marker. A terminal node does not need to be a leaf.',
            onCorrect: 'Correct — a word can end at an internal node of the trie.',
            onWrong: 'car was marked when it was inserted; card adds a second terminal at d.'
        }
    ],
    quizId: 'trieQuiz',
    emitQuizPrompt: true
};

export const trieSearchPrefixLesson = {
    id: 'trie-search-vs-prefix',
    title: 'Search versus autocomplete',
    unit: 'trie',
    description: 'With car, card, care and cat stored, search for ca and then run prefix autocomplete on the same input.',
    actions: [
        { op: 'insert', word: 'car' },
        { op: 'insert', word: 'card' },
        { op: 'insert', word: 'care' },
        { op: 'insert', word: 'cat' },
        { op: 'search', word: 'ca' },
        { op: 'prefix', prefix: 'ca' }
    ],
    narration: {
        ...baseNarration,
        '0': 'Search and autocomplete follow the same path. The difference is what they do when the path runs out of letters: search asks whether the current node ends a word, while autocomplete collects every terminal below it.'
    },
    checkpoints: [
        {
            anchorType: 'not_found',
            occurrence: 1,
            anchorOffset: -1,
            kind: 'predict',
            prompt: 'Searching for ca reaches node a, which is not terminal. What will the search report?',
            choices: [
                'Not found — ca is a prefix, not a stored word',
                'Found, because every letter of ca has an edge',
                'Found, and it returns every word that starts with ca',
                'An error, because ca is shorter than the stored words'
            ],
            answer: 0,
            reveal: 'A search succeeds only when the final letter lands on a terminal node. ca is a path, but no word stops there.',
            onCorrect: 'Correct — a path is necessary but a terminal marker is also required.',
            onWrong: 'Reaching the node proves the prefix exists, not that the word is stored.'
        },
        {
            anchorType: 'prefix_matched',
            occurrence: 1,
            anchorOffset: 0,
            kind: 'check',
            prompt: 'Prefix ca ends at the non-terminal a node. What should autocomplete return?',
            choices: [
                'Every stored word below a: car, card, care, cat',
                'Nothing, because a is not terminal',
                'Only car, the shortest completion',
                'An error, because ca is not a word'
            ],
            answer: 0,
            reveal: 'Autocomplete walks to the prefix node, then collects every terminal in that subtree. The non-terminal a itself is skipped.',
            onCorrect: 'Correct — the prefix node does not need to be terminal.',
            onWrong: 'Autocomplete returns complete words found below the prefix node, not the prefix itself.'
        }
    ],
    quizId: 'trieQuiz',
    emitQuizPrompt: true
};

export const triePrefixWordsLesson = {
    id: 'trie-word-as-prefix',
    title: 'Words that are prefixes',
    unit: 'trie',
    description: 'Insert a, an and ant. Each word extends the previous one, and every one of them is still a stored word.',
    actions: [
        { op: 'insert', word: 'a' },
        { op: 'insert', word: 'an' },
        { op: 'insert', word: 'ant' }
    ],
    narration: {
        ...baseNarration,
        '0': 'A terminal node may also have children. Insert a, then an: the a node stays terminal while the new n node is marked, so both words remain stored. ant extends the same path again.'
    },
    checkpoints: [
        {
            anchorType: 'mark_end',
            occurrence: 1,
            anchorOffset: 0,
            kind: 'predict',
            prompt: 'a is now a stored word. What changes when you insert an?',
            choices: [
                'Create n and mark it terminal; a stays terminal too',
                'Create both a and n again',
                'Reject an because a is a prefix of it',
                'Move the terminal marker from a to n'
            ],
            answer: 0,
            reveal: 'an shares a and adds one node for n. Both a and n keep their end-of-word markers.',
            onCorrect: 'Correct — terminal markers accumulate; they are not moved.',
            onWrong: 'The a node is reused and keeps its marker; only n is new.'
        },
        {
            anchorType: 'mark_end',
            occurrence: 3,
            anchorOffset: 0,
            kind: 'check',
            prompt: 'After a, an and ant, how many terminal nodes does the trie contain?',
            choices: ['3', '2', '1', '4'],
            answer: 0,
            reveal: 'a, n and t each end a stored word, so all three are terminal. The root is not terminal.',
            onCorrect: 'Correct — three nested words mean three terminal nodes.',
            onWrong: 'Every inserted word gets its own terminal node: a, n and t.'
        }
    ],
    quizId: 'trieQuiz',
    emitQuizPrompt: true
};

export const TRIE_LESSONS = [trieBuildLesson, trieSearchPrefixLesson, triePrefixWordsLesson];

/** Look up a trie lesson by id; returns null when absent. */
export function findTrieLesson(id) {
    return TRIE_LESSONS.find((lesson) => lesson.id === id) || null;
}

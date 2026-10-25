/**
 * hashLessons.js — Hashing lesson data for the LessonRunner.
 *
 * Data only. The page controller replays each action statelessly through
 * POST /hash, so every step and every count below comes from the real
 * generator. Insert actions are committed to the simulated op log; delete and
 * search are applied to both panels by the backend.
 *
 * A lesson may use `phases` when two different hash functions are needed in
 * one walkthrough. Each phase starts with a fresh table under its own
 * settings, and the controller inserts a narration-only marker between them.
 *
 * Facts produced by backend/hashing.py (table size 7 unless stated):
 *   sum_mod: ab -> 195 mod 7 = 6, ba -> 195 mod 7 = 6  (collision)
 *   poly:    ab -> 3105 mod 7 = 4, ba -> 3135 mod 7 = 6 (no collision)
 *   size 5, insert a b c, delete b, then insert d e f g:
 *     open resizes 5 -> 11 while inserting d (tombstone counts)
 *     chaining resizes 5 -> 11 while inserting g (load would exceed 1.0)
 */

function termsText(terms) {
    const list = Array.isArray(terms) ? terms : [];
    return list.map((term) => `${term.char}=${term.code}`).join(' ');
}

const baseNarration = {
    hash_compute: (step) => {
        const p = step.payload || {};
        const terms = termsText(p.terms);
        const fn = p.hash_fn === 'poly' ? 'polynomial x31' : 'sum of codes';
        return `hash('${p.key}') with ${fn}: ${terms}; raw ${p.raw} mod ${p.table_size} = ${p.index}.`;
    },
    chain_compare: (step) => {
        const p = step.payload || {};
        return `Compare '${p.key}' with '${p.occupant_key}' at chain position ${p.chain_pos} in bucket ${p.index}.`;
    },
    chain_append: (step) => {
        const p = step.payload || {};
        return `Append '${p.key}' to bucket ${p.index}; the {{term:Separate Chaining|chain}} now holds ${p.chain_length} entr${p.chain_length === 1 ? 'y' : 'ies'}.`;
    },
    chain_remove: (step) => {
        const p = step.payload || {};
        return `Remove '${p.key}' from chain position ${p.chain_pos} in bucket ${p.index}. The links close up, so no marker is left behind.`;
    },
    probe: (step) => {
        const p = step.payload || {};
        if (p.state === 'occupied') {
            return `Probe slot ${p.slot}: occupied by '${p.occupant_key}'. For '${p.key}' this is a collision, so {{term:Linear Probing|linear probing}} moves to the next slot.`;
        }
        if (p.state === 'tombstone') {
            return `Probe slot ${p.slot}: a {{term:Tombstone|tombstone}}. It is not the key, but a search must keep probing past it.`;
        }
        return `Probe slot ${p.slot}: empty. The probe stops here.`;
    },
    place: (step) => {
        const p = step.payload || {};
        return p.reused_tombstone
            ? `Place '${p.key}' in slot ${p.slot}, reusing the first tombstone on its probe path.`
            : `Place '${p.key}' in slot ${p.slot} after ${p.probes} probe${p.probes === 1 ? '' : 's'}.`;
    },
    tombstone: (step) => {
        const p = step.payload || {};
        return `Delete '${p.key}': slot ${p.slot} becomes a tombstone. A plain empty slot would break later probes, so the marker stays.`;
    },
    found: (step) => {
        const p = step.payload || {};
        return `Found '${p.key}'${p.slot !== undefined ? ` in slot ${p.slot}` : ` in bucket ${p.index}`}.`;
    },
    not_found: (step) => {
        const p = step.payload || {};
        return `'${p.key}' is not stored in this panel.`;
    },
    resize_start: (step) => {
        const p = step.payload || {};
        return `Load would pass ${p.threshold}; resize ${p.old_size} -> ${p.new_size}${p.in_place ? ' in place' : ''}.`;
    },
    rehash_move: (step) => {
        const p = step.payload || {};
        return `Rehash '${p.key}' from ${p.from} to ${p.to} using the new table size; ${p.remaining} entr${p.remaining === 1 ? 'y' : 'ies'} still to move.`;
    },
    resize_done: (step) => {
        const p = step.payload || {};
        return `Resize complete: size ${p.new_size}, ${p.count} live key${p.count === 1 ? '' : 's'}, ${p.tombstones} tombstone${p.tombstones === 1 ? '' : 's'}.`;
    },
    hash_insert_done: (step) => {
        const p = step.payload || {};
        return `Insert finished for this panel: ${p.count} key${p.count === 1 ? '' : 's'} in ${p.size} cells, load ${Number(p.load_factor || 0).toFixed(2)}.`;
    },
    hash_delete_done: (step) => {
        const p = step.payload || {};
        return `Delete finished for this panel: ${p.count} live key${p.count === 1 ? '' : 's'}, ${p.tombstones} tombstone${p.tombstones === 1 ? '' : 's'}.`;
    },
    hash_search_done: (step) => {
        const p = step.payload || {};
        return `Search finished for this panel: ${p.found ? 'found' : 'not found'} after ${p.total_probes} probe${p.total_probes === 1 ? '' : 's'} so far.`;
    }
};

export const hashIndexLesson = {
    id: 'hash-key-to-index',
    title: 'From key to index',
    unit: 'hash',
    description: 'Hash ab and ba with a weak sum hash, then with a polynomial hash. The same two keys collide under one function and separate under the other.',
    phases: [
        {
            hashFn: 'sum_mod',
            tableSize: 7,
            actions: [
                { op: 'insert', key: 'ab' },
                { op: 'insert', key: 'ba' }
            ],
            intro: 'A {{term:Hash Function|hash function}} turns a key into an index. Sum of codes adds ASCII values and ignores order, so anagrams are dangerous.'
        },
        {
            hashFn: 'poly',
            tableSize: 7,
            actions: [
                { op: 'insert', key: 'ab' },
                { op: 'insert', key: 'ba' }
            ],
            intro: 'Now switch to the polynomial hash and a fresh table. Each character is folded in as h = h * 31 + code, so position matters.'
        }
    ],
    narration: {
        ...baseNarration,
        '0': 'Both panels hash the same key, but they use their own table size. Watch the per-character terms before the index appears.'
    },
    checkpoints: [
        {
            anchorType: 'hash_compute',
            occurrence: 3,
            anchorOffset: -1,
            kind: 'predict',
            prompt: 'ab hashed to index 6 under the sum-of-codes hash. Where will ba land?',
            choices: [
                'Also 6, because a and b contribute the same total',
                'Index 5, because the letters are swapped',
                'Index 0, because every new key starts at 0',
                'A different index, because order changes the sum'
            ],
            answer: 0,
            reveal: 'Sum of codes is order-blind: 97 + 98 is 195 for both ab and ba, so both index 6. This is a {{term:Collision|collision}}.',
            onCorrect: 'Correct — the weak hash sees the same multiset of characters.',
            onWrong: 'Addition does not care about order. Both keys sum to 195.'
        },
        {
            anchorType: 'hash_compute',
            occurrence: 7,
            anchorOffset: -1,
            kind: 'predict',
            prompt: 'Under the polynomial hash, ab hashes to index 4. What about ba?',
            choices: [
                'Index 6, because multiplying by 31 preserves position',
                'Index 4 again, because the letters are the same',
                'Index 0, because the raw hash is taken modulo 7',
                'It is rejected as a duplicate of ab'
            ],
            answer: 0,
            reveal: 'poly(ab) = 3105 -> 4 and poly(ba) = 3135 -> 6. Folding position into the running value separates anagrams.',
            onCorrect: 'Correct — the polynomial hash is sensitive to order.',
            onWrong: 'The running value differs once the first character is multiplied by 31: 3105 vs 3135.'
        }
    ],
    quizId: 'hashQuiz',
    emitQuizPrompt: true
};

export const hashCollisionLesson = {
    id: 'hash-chaining-vs-open',
    title: 'Chaining versus open addressing',
    unit: 'hash',
    description: 'Insert ab and ba, delete ab, then search ba. Chaining removes a link; open addressing leaves a tombstone and must probe past it.',
    actions: [
        { op: 'insert', key: 'ab' },
        { op: 'insert', key: 'ba' },
        { op: 'delete', key: 'ab' },
        { op: 'search', key: 'ba' }
    ],
    hashFn: 'sum_mod',
    tableSize: 7,
    narration: {
        ...baseNarration,
        '0': 'ab and ba collide at index 6. Chaining keeps both in one bucket; open addressing puts one key per slot and probes for the next free one.'
    },
    checkpoints: [
        {
            anchorType: 'hash_compute',
            occurrence: 4,
            anchorOffset: 0,
            kind: 'predict',
            prompt: 'ab already occupies open-addressing slot 6. Open addressing hashes ba to 6 too. Where does ba go?',
            choices: [
                'Slot 0: probe to the next slot, which is empty',
                'Slot 6: overwrite ab',
                'Slot 7: append past the table',
                'Nowhere: the insert is rejected as a collision'
            ],
            answer: 0,
            reveal: 'Linear probing checks 6, finds it occupied, then wraps to 0, which is empty. Chaining instead appends ba to bucket 6.',
            onCorrect: 'Correct — the collision becomes a probe, not an error.',
            onWrong: 'Occupied slots are skipped. Slot 6 is taken, so the next slot is checked.'
        },
        {
            anchorType: 'hash_compute',
            occurrence: 7,
            anchorOffset: -1,
            kind: 'predict',
            prompt: 'ab was deleted from open addressing, leaving a tombstone in slot 6. Search now starts at slot 6 for ba. What happens?',
            choices: [
                'The search continues past the tombstone and finds ba in slot 0',
                'The search stops at the tombstone and reports not found',
                'The tombstone is overwritten by ba during the search',
                'The search restarts from slot 0 immediately'
            ],
            answer: 0,
            reveal: 'A {{term:Tombstone|tombstone}} means "deleted, keep probing". Stopping there would wrongly hide ba, which was pushed past it by the earlier collision.',
            onCorrect: 'Correct — tombstones preserve probe continuity.',
            onWrong: 'Treating a tombstone as empty would make ba unreachable.'
        }
    ],
    quizId: 'hashQuiz',
    emitQuizPrompt: true
};

export const hashResizeLesson = {
    id: 'hash-load-and-resize',
    title: 'Load factor and resizing',
    unit: 'hash',
    description: 'With a table of size 5, insert a, b and c, delete b, then keep inserting. Tombstones count toward the open-addressing threshold, so it resizes first.',
    actions: [
        { op: 'insert', key: 'a' },
        { op: 'insert', key: 'b' },
        { op: 'insert', key: 'c' },
        { op: 'delete', key: 'b' },
        { op: 'insert', key: 'd' },
        { op: 'insert', key: 'e' },
        { op: 'insert', key: 'f' },
        { op: 'insert', key: 'g' }
    ],
    hashFn: 'sum_mod',
    tableSize: 5,
    narration: {
        ...baseNarration,
        '0': 'The {{term:Load Factor|load factor}} is keys divided by cells. Chaining tolerates 1.0; open addressing resizes above 0.75 because probe chains get long.'
    },
    checkpoints: [
        {
            anchorType: 'resize_start',
            occurrence: 1,
            anchorOffset: -1,
            kind: 'predict',
            prompt: 'b was deleted, so the open table has 2 live keys and 1 tombstone in 5 slots. Inserting d would push live-plus-tombstones occupancy to 0.80. Which panel resizes first?',
            choices: [
                'Open addressing, while inserting d, because the tombstone counts toward 0.75',
                'Chaining, while inserting d, because its load reaches 0.80',
                'Neither panel ever resizes at this size',
                'Both resize at exactly the same step'
            ],
            answer: 0,
            reveal: 'Open addressing counts live keys plus tombstones before placing: (2 + 1 + 1) / 5 = 0.80 > 0.75. Chaining only looks at live keys, (2 + 1) / 5 = 0.60.',
            onCorrect: 'Correct — tombstones still occupy probe space.',
            onWrong: 'The tombstone is invisible to the live-key load factor but not to the probe-capacity check.'
        },
        {
            anchorType: 'resize_done',
            occurrence: 1,
            anchorOffset: 0,
            kind: 'check',
            prompt: 'The open table has just resized from 5 to 11. What happened to the tombstone?',
            choices: [
                'It vanished: a rehash reinserts only live keys into a fresh table',
                'It was copied to the same slot in the larger table',
                'It was converted into a live key',
                'It was moved to slot 0'
            ],
            answer: 0,
            reveal: '{{term:Rehash|Rehashing}} rebuilds from live keys, so tombstones are dropped and every key is re-probed under the new size.',
            onCorrect: 'Correct — resizing is also tombstone cleanup.',
            onWrong: 'Only live keys are reinserted; the deleted key does not come back.'
        },
        {
            anchorType: 'resize_start',
            occurrence: 2,
            anchorOffset: -1,
            kind: 'predict',
            prompt: 'After the delete and the later inserts, chaining has 5 live keys in 5 buckets. You insert g. What does chaining do?',
            choices: [
                'Resize 5 -> 11 first, so the new load stays at or below 1.0',
                'Append g and let the load factor become 1.20',
                'Reject g because every bucket is full',
                'Delete an existing key to make room'
            ],
            answer: 0,
            reveal: 'Chaining resizes before the insert when (5 + 1) / 5 > 1.0. It has no tombstones, so it waited until six live keys would not fit.',
            onCorrect: 'Correct — chaining expands once the chain load would pass 1.0.',
            onWrong: 'The threshold check happens before placing the new key.'
        }
    ],
    quizId: 'hashQuiz',
    emitQuizPrompt: true
};

export const HASH_LESSONS = [hashIndexLesson, hashCollisionLesson, hashResizeLesson];

/** Look up a hashing lesson by id; returns null when absent. */
export function findHashLesson(id) {
    return HASH_LESSONS.find((lesson) => lesson.id === id) || null;
}

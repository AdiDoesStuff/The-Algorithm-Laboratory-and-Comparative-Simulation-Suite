/*
 * Hashing quiz — static, logic-free data.
 *
 * Every index, count and resize below was produced by backend/hashing.py,
 * not written by hand (sum_mod unless stated):
 *   m=7, "ab" -> 195 -> index 6; "ba" -> 195 -> index 6
 *   m=7, poly "ab" -> 3105 -> 4; poly "ba" -> 3135 -> 6
 *   m=7, "abc" -> 294 -> 0; poly "abc" -> 96354 -> 6
 *   "listen","silent","enlist","tinsel" all sum to 655 -> index 4
 *     chaining: one bucket of 4; open: slots 4,5,6,0 (max probe 4)
 *   m=5, insert a b c, delete b: open count 2, tombstones 1
 *     inserting d: (2+1+1)/5 = 0.80 > 0.75 -> resize 5 -> 11 first
 *     chaining waits: (5+1)/5 > 1.0 while inserting g -> resize 5 -> 11
 *
 * Schema: see docs/QUIZ_SPEC.md. Correctness is by option id, never position.
 */

export const hashQuiz = {
    id: "hashQuiz",
    unitId: "hash",
    title: "Hashing: check yourself",
    questions: [
        {
            id: "hash-sum-mod-ab",
            topic: "Key to index",
            prompt: "With the sum-of-codes hash and table size 7, what index does the key ab map to?",
            options: [
                { id: "correct", text: "6" },
                { id: "zero", text: "0" },
                { id: "four", text: "4" },
                { id: "five", text: "5" }
            ],
            correctOptionId: "correct",
            explanation: "a is 97 and b is 98, so the raw hash is 195. 195 mod 7 = 6. The index is always the raw hash reduced modulo the current table size."
        },
        {
            id: "hash-anagram-weakness",
            topic: "Hash quality",
            prompt: "Why do ab and ba collide under the sum-of-codes hash?",
            options: [
                { id: "correct", text: "Addition ignores character order, so both keys sum to 195." },
                { id: "wrong-a", text: "Both keys have the same length, and length alone decides the index." },
                { id: "wrong-b", text: "The table size is a prime number, which forces them together." },
                { id: "wrong-c", text: "The second key is rejected as a duplicate before hashing." }
            ],
            correctOptionId: "correct",
            explanation: "The weak hash only adds ASCII values. Swapping two letters changes nothing, which makes every anagram of a key collide with it."
        },
        {
            id: "hash-poly-order",
            topic: "Hash quality",
            prompt: "With the polynomial x31 hash and table size 7, where do ab and ba land?",
            options: [
                { id: "correct", text: "ab at 4, ba at 6" },
                { id: "same", text: "Both at 4, because they share the same letters" },
                { id: "reverse", text: "ab at 6, ba at 4" },
                { id: "zero", text: "Both at 0, because the raw value is reduced modulo 7" }
            ],
            correctOptionId: "correct",
            explanation: "poly folds position into the running value: 3105 mod 7 = 4 for ab and 3135 mod 7 = 6 for ba. Unlike addition, multiplying by 31 makes order matter."
        },
        {
            id: "hash-anagram-chain-length",
            topic: "Collision handling",
            prompt: "Insert listen, silent, enlist, tinsel under sum_mod with size 7. What does separate chaining look like?",
            options: [
                { id: "correct", text: "All four share bucket 4, so the longest chain is 4." },
                { id: "spread", text: "All four spread across four different buckets." },
                { id: "reject", text: "The last three inserts are rejected as duplicates." },
                { id: "tombstone", text: "The first key becomes a tombstone so the others can fit." }
            ],
            correctOptionId: "correct",
            explanation: "Every anagram sums to 655, and 655 mod 7 = 4. Chaining keeps all four entries in bucket 4. The collision counter also reports 3, one per insert that hit an occupied bucket."
        },
        {
            id: "hash-open-probe-wrap",
            topic: "Open addressing",
            prompt: "Under sum_mod with size 7, ab sits in slot 6. Insert ba, which hashes to 6 as well. Where does open addressing place it?",
            options: [
                { id: "correct", text: "Slot 0: probe to 0 after 6 is occupied" },
                { id: "overwrite", text: "Slot 6: it overwrites ab" },
                { id: "seven", text: "Slot 7: it grows the table immediately" },
                { id: "reject", text: "The insert is rejected as a collision" }
            ],
            correctOptionId: "correct",
            explanation: "Linear probing checks slot 6, finds it occupied, and wraps to slot 0, which is empty. A collision is normal; only a full table is an error."
        },
        {
            id: "hash-tombstone-purpose",
            topic: "Tombstones",
            prompt: "Why does open addressing leave a tombstone instead of an empty slot when a key is deleted?",
            options: [
                { id: "correct", text: "An empty slot would stop later probes, hiding keys that were pushed past it." },
                { id: "memory", text: "A tombstone stores a copy of the deleted key for reuse." },
                { id: "order", text: "Tombstones keep the keys sorted inside the table." },
                { id: "resize", text: "A tombstone prevents the table from ever resizing." }
            ],
            correctOptionId: "correct",
            explanation: "Search and insert stop at an empty slot. A tombstone means deleted but keep probing, so keys placed after the deleted one stay reachable until a rehash clears it."
        },
        {
            id: "hash-chaining-delete",
            topic: "Chaining versus open",
            prompt: "What happens when a key is deleted from a separate-chaining table?",
            options: [
                { id: "correct", text: "Its link is removed from the bucket and the remaining links close up." },
                { id: "tombstone", text: "The bucket is replaced by a tombstone marker." },
                { id: "shift", text: "Every later key is rehashed into a new bucket immediately." },
                { id: "empty", text: "The whole bucket is cleared, including other keys." }
            ],
            correctOptionId: "correct",
            explanation: "Chaining deletes only the matching link. There is no probe-continuity problem, so it never needs a tombstone; tombstone counts are always zero for this panel."
        },
        {
            id: "hash-open-resize-tombstone",
            topic: "Load and resize",
            prompt: "Size 5, sum_mod: insert a, b, c, delete b, then insert d. Open addressing has 2 live keys and 1 tombstone. What happens while inserting d?",
            options: [
                { id: "correct", text: "It resizes 5 to 11 first, because (2 + 1 + 1) / 5 = 0.80 exceeds 0.75." },
                { id: "place", text: "It places d without resizing, because live load is only 0.40." },
                { id: "reject", text: "It rejects d because the table has a tombstone." },
                { id: "same", text: "It rehashes at size 5 and keeps the tombstone." }
            ],
            correctOptionId: "correct",
            explanation: "Open addressing reserves probe capacity for live keys plus tombstones. The projected 0.80 crosses the 0.75 threshold, so the table grows before d is placed and the rehash drops the tombstone."
        },
        {
            id: "hash-chaining-resize-wait",
            topic: "Load and resize",
            prompt: "In the same size-5 run, after a, b, c, delete b, then d, e and f, chaining has 5 live keys. What happens when g is inserted?",
            options: [
                { id: "correct", text: "It resizes 5 to 11 first, because (5 + 1) / 5 would exceed 1.0." },
                { id: "append", text: "It appends g, making the load factor 1.20." },
                { id: "tombstone", text: "It converts bucket 5 into a tombstone." },
                { id: "reject", text: "It rejects g because the load factor is already 1.00." }
            ],
            correctOptionId: "correct",
            explanation: "Chaining counts live keys only and resizes before an insert that would push the load above 1.0. The tombstone from b does not affect it, so it waits much longer than open addressing did."
        },
        {
            id: "hash-rehash-clears",
            topic: "Load and resize",
            prompt: "After either panel resizes, what is true about the new table?",
            options: [
                { id: "correct", text: "Every live key is re-probed under the new size, and tombstones are gone." },
                { id: "same", text: "Keys keep their old slot numbers, so no hashing is needed." },
                { id: "copy", text: "Tombstones are copied to the new table to preserve probe paths." },
                { id: "sorted", text: "Keys are inserted in sorted order to improve hashing." }
            ],
            correctOptionId: "correct",
            explanation: "A rehash rebuilds from live keys: each index is recomputed modulo the new size, and deleted entries are simply not reinserted, which clears every tombstone."
        }
    ]
};

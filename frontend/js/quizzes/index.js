/*
 * Quiz registry — the single lookup point for quiz ids.
 *
 * Adding a quiz means:
 *   1. add the data module in this folder,
 *   2. import it here and add it to the QUIZZES map,
 *   3. point the unit's lessons at its id via `quizId`.
 * No engine or page-controller edits.
 *
 * getQuiz() throws on a miss. It never returns undefined and never silently
 * falls back to another quiz, so a typo in lesson data surfaces loudly.
 */

import { bstQuiz } from "./bstQuiz.js";
import { heapQuiz } from "./heapQuiz.js";
import { avlQuiz } from "./avlQuiz.js";
import { trieQuiz } from "./trieQuiz.js";
import { hashQuiz } from "./hashQuiz.js";
import { merkleQuiz } from "./merkleQuiz.js";

const QUIZZES = new Map([
    [bstQuiz.id, bstQuiz],
    [heapQuiz.id, heapQuiz],
    [avlQuiz.id, avlQuiz],
    [trieQuiz.id, trieQuiz],
    [hashQuiz.id, hashQuiz],
    [merkleQuiz.id, merkleQuiz]
]);

/**
 * Look up a quiz by id.
 * @param {string} quizId
 * @returns {{id: string, unitId: string, title: string, questions: Array<object>}}
 */
export function getQuiz(quizId) {
    if (typeof quizId !== "string" || quizId.trim() === "") {
        throw new Error("Quiz registry: quizId must be a non-empty string");
    }
    const quiz = QUIZZES.get(quizId);
    if (!quiz) {
        throw new Error(`Quiz registry: no quiz registered with id "${quizId}"`);
    }
    return quiz;
}

/** @returns {Array<object>} every registered quiz, in registration order. */
export function listQuizzes() {
    return Array.from(QUIZZES.values());
}

/** @returns {string[]} every registered quiz id. */
export function getQuizIds() {
    return Array.from(QUIZZES.keys());
}

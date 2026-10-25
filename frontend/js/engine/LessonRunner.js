/**
 * LessonRunner.js — Generic lesson driver for AlgoLab.
 *
 * A lesson is data (see docs/LESSON_SPEC.md). The runner owns a
 * PlaybackController, flattens backend steps, resolves narration, gates
 * forward progress at checkpoints, and fires the quiz_prompt sentinel.
 *
 * ES module. Imported by module pages (e.g. bst.js). No DOM access.
 */

import { PlaybackController } from './PlaybackController.js';

export const LESSON_STATUS = Object.freeze({
    IDLE: 'idle',
    LOADING: 'loading',
    READY: 'ready',
    PLAYING: 'playing',
    CHECKPOINT: 'checkpoint',
    QUIZ: 'quiz',
    DONE: 'done',
    ERROR: 'error'
});

export class LessonRunner {
    /**
     * @param {Object} options
     * @param {(lesson: Object) => Promise<{steps: Array, checkpoints?: Array, blocks?: Array}|Array>} options.buildSteps
     * @param {(step: Object, index: number) => void} [options.onStep]
     * @param {(text: string) => void} [options.onAnnotation]
     * @param {(checkpoint: Object) => void} [options.onCheckpoint]
     * @param {(result: {checkpoint: Object, correct: boolean|null, choiceIndex: number|null}) => void} [options.onCheckpointResolved]
     * @param {(quizId: string, lesson: Object) => void} [options.onQuizPrompt]
     * @param {(state: Object) => void} [options.onStateChange]
     * @param {(error: Error) => void} [options.onError]
     */
    constructor({
        buildSteps,
        onStep = () => {},
        onAnnotation = () => {},
        onCheckpoint = () => {},
        onCheckpointResolved = () => {},
        onQuizPrompt = () => {},
        onStateChange = () => {},
        onError = () => {}
    } = {}) {
        if (typeof buildSteps !== 'function') {
            throw new Error('LessonRunner requires a buildSteps(lesson) function');
        }

        this._buildSteps = buildSteps;
        this._onStep = onStep;
        this._onAnnotation = onAnnotation;
        this._onCheckpoint = onCheckpoint;
        this._onCheckpointResolved = onCheckpointResolved;
        this._onQuizPrompt = onQuizPrompt;
        this._onStateChange = onStateChange;
        this._onError = onError;

        this._cache = new Map();          // lessonId -> { steps, checkpoints, blocks }
        this._lesson = null;
        this._steps = [];
        this._checkpoints = new Map();    // absolute step index -> checkpoint
        this._resolved = new Set();       // absolute step indexes already resolved
        this._blocks = [];                // [{ action, start, end }]
        this._activeCheckpoint = null;
        this._activeCheckpointIndex = -1;
        this._status = LESSON_STATUS.IDLE;
        this._loadToken = 0;

        // Forward-entry flags: checkpoints only gate forward navigation/auto-play.
        this._pendingNext = false;
        this._autoForward = false;

        this.playback = new PlaybackController({
            onStep: (step, index) => this._handleStep(step, index),
            onAnnotation: () => {},   // narration is resolved by the runner
            onDone: () => this._handlePlaybackDone(),
            onStateChange: () => {}
        });
    }

    // --- Public state -----------------------------------------------------

    get state() {
        const playbackState = this.playback.state;
        return {
            status: this._status,
            lessonId: this._lesson ? this._lesson.id : null,
            cursor: playbackState.cursor,
            total: playbackState.total,
            checkpoint: this._activeCheckpoint
        };
    }

    get currentLesson() {
        return this._lesson;
    }

    get status() {
        return this._status;
    }

    // --- Lifecycle --------------------------------------------------------

    /**
     * Build (or reuse) the step list for a lesson and seek to step 0.
     * @param {Object} lesson
     * @param {{forceRebuild?: boolean}} [options]
     */
    async loadLesson(lesson, { forceRebuild = false } = {}) {
        if (!lesson || !lesson.id) {
            throw new Error('loadLesson requires a lesson with an id');
        }

        this._lesson = lesson;
        this._resolved.clear();
        this._activeCheckpoint = null;
        this._activeCheckpointIndex = -1;
        this._pendingNext = false;
        this._autoForward = false;
        this._status = LESSON_STATUS.LOADING;
        const token = ++this._loadToken;
        this._emit();

        try {
            let built = forceRebuild ? null : this._cache.get(lesson.id);
            if (!built) {
                built = await this._buildSteps(lesson);
                this._cache.set(lesson.id, built);
            }

            // A newer load or a cancel() superseded this one.
            if (token !== this._loadToken) {
                return this.state;
            }

            const normalized = this._normalizeBuilt(built);
            this._steps = normalized.steps;
            this._blocks = normalized.blocks;
            this._checkpoints = this._indexCheckpoints(normalized.checkpoints);

            this.playback.load(this._steps);
            this._status = this._steps.length
                ? LESSON_STATUS.READY
                : LESSON_STATUS.DONE;
            this._emit();
            return this.state;
        } catch (error) {
            if (token !== this._loadToken) {
                return this.state;
            }
            this._status = LESSON_STATUS.ERROR;
            this._emit();
            this._onError(error instanceof Error ? error : new Error(String(error)));
            return this.state;
        }
    }

    /** Abandon an in-flight load and stop playback. */
    cancel() {
        this._loadToken++;
        this._autoForward = false;
        this._pendingNext = false;
        this._clearActiveCheckpoint();
        if (this._status === LESSON_STATUS.LOADING || this._status === LESSON_STATUS.PLAYING) {
            this._status = LESSON_STATUS.IDLE;
        }
        this.playback.cancel();
        this._emit();
    }

    /** Drop the cached step list for one lesson (or all lessons). */
    invalidate(lessonId) {
        if (lessonId) {
            this._cache.delete(lessonId);
        } else {
            this._cache.clear();
        }
    }

    // --- Navigation -------------------------------------------------------

    next() {
        if (!this._canAdvance()) return;
        if (!this._steps.length) return;

        const { cursor, total } = this.playback.state;
        if (cursor >= total - 1) {
            if (this._status !== LESSON_STATUS.DONE) {
                this._status = LESSON_STATUS.DONE;
                this._emit();
            }
            return;
        }

        this._pendingNext = true;
        this.playback.next();
        // If onStep did not fire (should not happen), clear the flag.
        this._pendingNext = false;
    }

    prev() {
        if (!this._canGoBack()) return;
        if (!this._steps.length) return;

        this._autoForward = false;
        this._pendingNext = false;
        this._status = LESSON_STATUS.READY;
        this._clearActiveCheckpoint();
        this.playback.prev();
        this._emit();
    }

    seek(index) {
        if (this._status === LESSON_STATUS.LOADING || this._status === LESSON_STATUS.ERROR) return;
        if (!this._steps.length) return;

        this._autoForward = false;
        this._pendingNext = false;
        this._status = LESSON_STATUS.READY;
        this._clearActiveCheckpoint();
        this.playback.seek(index);
        this._emit();
    }

    reset() {
        if (this._status === LESSON_STATUS.LOADING) return;

        this._autoForward = false;
        this._pendingNext = false;
        this._resolved.clear();
        this._clearActiveCheckpoint();
        this._status = this._steps.length ? LESSON_STATUS.READY : LESSON_STATUS.DONE;
        this.playback.reset();
        this._emit();
    }

    play() {
        if (!this._steps.length) return;
        if (this._status === LESSON_STATUS.CHECKPOINT ||
            this._status === LESSON_STATUS.QUIZ ||
            this._status === LESSON_STATUS.LOADING ||
            this._status === LESSON_STATUS.ERROR) {
            return;
        }

        this._autoForward = true;
        this._status = LESSON_STATUS.PLAYING;
        this.playback.play();
        this._emit();
    }

    pause() {
        this._autoForward = false;
        if (this._status === LESSON_STATUS.PLAYING) {
            this._status = LESSON_STATUS.READY;
        }
        this.playback.pause();
        this._emit();
    }

    // --- Checkpoints ------------------------------------------------------

    revealCheckpoint() {
        if (this._status !== LESSON_STATUS.CHECKPOINT || !this._activeCheckpoint) return;
        const checkpoint = this._activeCheckpoint;
        const index = this._activeCheckpointIndex;
        const text = checkpoint.reveal || checkpoint.onCorrect || '';

        this._resolved.add(index);
        this._clearActiveCheckpoint();
        this._status = LESSON_STATUS.READY;

        if (text) this._onAnnotation(text);
        this._onCheckpointResolved({
            checkpoint,
            correct: null,
            choiceIndex: null
        });
        this._emit();
    }

    answerCheckpoint(choiceIndex) {
        if (this._status !== LESSON_STATUS.CHECKPOINT || !this._activeCheckpoint) return;
        const checkpoint = this._activeCheckpoint;
        const index = this._activeCheckpointIndex;
        const correct = Array.isArray(checkpoint.choices)
            ? choiceIndex === checkpoint.answer
            : null;
        const text = correct
            ? (checkpoint.onCorrect || checkpoint.reveal || '')
            : (checkpoint.onWrong || checkpoint.reveal || '');

        this._resolved.add(index);
        this._clearActiveCheckpoint();
        this._status = LESSON_STATUS.READY;

        if (text) this._onAnnotation(text);
        this._onCheckpointResolved({
            checkpoint,
            correct,
            choiceIndex
        });
        this._emit();
    }

    isCheckpoint(index) {
        return this._checkpoints.has(index);
    }

    // --- Narration --------------------------------------------------------

    resolveNarration(step, index) {
        const narration = this._lesson ? this._lesson.narration : null;
        let value = null;

        if (typeof narration === 'function') {
            value = narration(step, index);
        } else if (narration && typeof narration === 'object') {
            if (index !== undefined && index !== null) {
                if (narration[index] !== undefined) {
                    value = narration[index];
                } else if (narration[String(index)] !== undefined) {
                    value = narration[String(index)];
                }
            }
            if (value === null && step && step.type && narration[step.type] !== undefined) {
                value = narration[step.type];
            }
        }

        if (typeof value === 'function') {
            value = value(step, index);
        }
        if (typeof value === 'string') {
            return value;
        }
        return step && typeof step.annotation === 'string' ? step.annotation : '';
    }

    // --- Internals --------------------------------------------------------

    _canAdvance() {
        return this._status !== LESSON_STATUS.CHECKPOINT &&
            this._status !== LESSON_STATUS.QUIZ &&
            this._status !== LESSON_STATUS.LOADING &&
            this._status !== LESSON_STATUS.ERROR;
    }

    _canGoBack() {
        return this._status !== LESSON_STATUS.LOADING &&
            this._status !== LESSON_STATUS.ERROR;
    }

    _handleStep(step, index) {
        this._onStep(step, index);
        const text = this.resolveNarration(step, index);
        if (text) this._onAnnotation(text);

        // Initial render while building the lesson: no checkpoint gating yet.
        if (this._status === LESSON_STATUS.LOADING) return;

        const forward = this._autoForward || this._pendingNext;
        this._pendingNext = false;

        if (forward && this._isQuizStep(step, index)) {
            this._autoForward = false;
            this._status = LESSON_STATUS.QUIZ;
            this.playback.pause();
            this._emit();
            this._onQuizPrompt(
                (step && step.quizId) || (this._lesson && this._lesson.quizId),
                this._lesson
            );
            return;
        }

        const checkpoint = this._checkpoints.get(index);
        if (forward && checkpoint && !this._resolved.has(index)) {
            this._activeCheckpoint = checkpoint;
            this._activeCheckpointIndex = index;
            this._autoForward = false;
            this._status = LESSON_STATUS.CHECKPOINT;
            this.playback.pause();
            this._emit();
            this._onCheckpoint(checkpoint);
            return;
        }

        if (this._status === LESSON_STATUS.CHECKPOINT || this._status === LESSON_STATUS.QUIZ) {
            return;
        }

        this._status = this.playback.state.playing
            ? LESSON_STATUS.PLAYING
            : LESSON_STATUS.READY;
        this._emit();
    }

    _handlePlaybackDone() {
        const { cursor, total } = this.playback.state;
        this._autoForward = false;
        this._status = (total > 0 && cursor >= total - 1)
            ? LESSON_STATUS.DONE
            : LESSON_STATUS.READY;
        this._emit();
    }

    _isQuizStep(step, index) {
        if (step && step.type === 'quiz_prompt') return true;
        // Fallback: last data step of a lesson that declares a quiz and did not
        // append an explicit sentinel.
        return !!(this._lesson &&
            this._lesson.quizId &&
            !this._lesson.emitQuizPrompt &&
            this._steps.length > 1 &&
            index === this._steps.length - 1);
    }

    _normalizeBuilt(built) {
        if (Array.isArray(built)) {
            return { steps: built, checkpoints: [], blocks: [] };
        }
        return {
            steps: Array.isArray(built && built.steps) ? built.steps : [],
            checkpoints: Array.isArray(built && built.checkpoints) ? built.checkpoints : [],
            blocks: Array.isArray(built && built.blocks) ? built.blocks : []
        };
    }

    _indexCheckpoints(checkpoints) {
        const map = new Map();
        for (const checkpoint of checkpoints) {
            if (!checkpoint || typeof checkpoint !== 'object') continue;
            const index = this._resolveCheckpointIndex(checkpoint);
            if (index === null) continue;
            // First checkpoint at an index wins.
            if (!map.has(index)) {
                map.set(index, checkpoint);
            }
        }
        return map;
    }

    _resolveCheckpointIndex(checkpoint) {
        if (Number.isInteger(checkpoint.atStep)) {
            return this._clampIndex(checkpoint.atStep);
        }

        const anchorValue = checkpoint.beforeValue !== undefined
            ? checkpoint.beforeValue
            : checkpoint.afterValue;

        if (anchorValue === undefined) {
            return null;
        }

        let matches = this._blocks.filter(block =>
            block && block.action && block.action.value === anchorValue
        );
        if (checkpoint.op) {
            matches = matches.filter(block => block.action.op === checkpoint.op);
        }

        if (!matches.length) {
            if (typeof console !== 'undefined') {
                console.warn('[LessonRunner] Checkpoint anchor not found', checkpoint);
            }
            return this._clampIndex(this._steps.length - 1);
        }

        // Last matching block: insert-then-delete of the same value targets the delete.
        const block = matches[matches.length - 1];
        const rawIndex = checkpoint.beforeValue !== undefined
            ? block.start - 1
            : block.end;
        return this._clampIndex(rawIndex);
    }

    _clampIndex(index) {
        if (!this._steps.length) return 0;
        return Math.max(0, Math.min(this._steps.length - 1, index));
    }

    _clearActiveCheckpoint() {
        this._activeCheckpoint = null;
        this._activeCheckpointIndex = -1;
    }

    _emit() {
        this._onStateChange(this.state);
    }
}

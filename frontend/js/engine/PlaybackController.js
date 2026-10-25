/**
 * PlaybackController.js — Reusable stateful animation runner for step traces.
 * Decoupled from DOM and API. Manages timers, step cursor, play/pause tokens, and speed.
 */

export class PlaybackController {
    constructor({
        onStep = () => {},
        onDone = () => {},
        onAnnotation = () => {},
        onStateChange = () => {}
    } = {}) {
        this.onStep = onStep;
        this.onDone = onDone;
        this.onAnnotation = onAnnotation;
        this.onStateChange = onStateChange;

        this._steps = [];
        this._cursor = -1;
        this._playing = false;
        this._speed = 600; // ms per step
        this._runToken = 0;
        this._timerId = null;
    }

    get state() {
        return {
            cursor: this._cursor,
            total: this._steps.length,
            playing: this._playing,
            speed: this._speed
        };
    }

    _notifyState() {
        this.onStateChange(this.state);
    }

    cancel() {
        this._runToken++;
        if (this._timerId !== null) {
            clearTimeout(this._timerId);
            this._timerId = null;
        }
        this._playing = false;
        this._notifyState();
    }

    load(steps = []) {
        this.cancel();
        this._steps = Array.isArray(steps) ? [...steps] : [];
        if (this._steps.length > 0) {
            this._cursor = 0;
            this._notifyState();
            this.onStep(this._steps[0], 0);
            if (this._steps[0].annotation) {
                this.onAnnotation(this._steps[0].annotation);
            }
        } else {
            this._cursor = -1;
            this._notifyState();
        }
    }

    seek(i) {
        if (this._steps.length === 0) return;
        this.cancel();
        const target = Math.max(0, Math.min(this._steps.length - 1, i));
        this._cursor = target;
        this._notifyState();
        this.onStep(this._steps[this._cursor], this._cursor);
        if (this._steps[this._cursor].annotation) {
            this.onAnnotation(this._steps[this._cursor].annotation);
        }
    }

    next() {
        if (this._steps.length === 0) return;
        if (this._cursor < this._steps.length - 1) {
            this.seek(this._cursor + 1);
        } else if (this._playing) {
            this.pause();
            this.onDone();
        }
    }

    prev() {
        if (this._steps.length === 0) return;
        if (this._cursor > 0) {
            this.seek(this._cursor - 1);
        }
    }

    play() {
        if (this._steps.length === 0) return;

        // If at end, loop back to start
        if (this._cursor >= this._steps.length - 1) {
            this._cursor = 0;
            this.onStep(this._steps[0], 0);
            if (this._steps[0].annotation) {
                this.onAnnotation(this._steps[0].annotation);
            }
        }

        this._playing = true;
        this._runToken++;
        const token = this._runToken;
        this._notifyState();
        this._scheduleNext(token);
    }

    _scheduleNext(token) {
        if (!this._playing || token !== this._runToken) return;

        this._timerId = setTimeout(() => {
            if (!this._playing || token !== this._runToken) return;

            if (this._cursor < this._steps.length - 1) {
                this._cursor++;
                this.onStep(this._steps[this._cursor], this._cursor);
                if (this._steps[this._cursor].annotation) {
                    this.onAnnotation(this._steps[this._cursor].annotation);
                }
                this._notifyState();
                this._scheduleNext(token);
            } else {
                this._playing = false;
                this._timerId = null;
                this._notifyState();
                this.onDone();
            }
        }, this._speed);
    }

    pause() {
        this.cancel();
    }

    resume() {
        this.play();
    }

    reset() {
        this.cancel();
        if (this._steps.length > 0) {
            this._cursor = 0;
            this.onStep(this._steps[0], 0);
            if (this._steps[0].annotation) {
                this.onAnnotation(this._steps[0].annotation);
            }
        } else {
            this._cursor = -1;
        }
        this._notifyState();
    }

    setSpeed(ms) {
        this._speed = Math.max(20, Number(ms) || 600);
        this._notifyState();
    }
}

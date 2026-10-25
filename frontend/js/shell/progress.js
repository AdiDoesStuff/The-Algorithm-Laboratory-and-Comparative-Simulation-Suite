/*
 * AlgoLab progress store.
 *
 * Classic script (no build step) so the hub's classic scripts and bst.js's ES
 * module can share it. Load it with a plain <script> tag before consumers:
 *
 *     <script src="js/shell/progress.js"></script>
 *
 * Exposes: window.AlgoLabProgress
 *
 * Storage key: algolab_progress
 * Schema:
 *   {
 *     "version": 1,
 *     "units": {
 *       "<unitId>": {
 *         "quizPassed": true,
 *         "score": 9,
 *         "total": 10,
 *         "bestScore": 9,
 *         "lastAttempt": "2026-10-25T12:00:00.000Z"
 *       }
 *     }
 *   }
 *
 * Failure policy: every localStorage access is wrapped. If storage is missing,
 * throws, holds corrupt JSON, or holds an unknown schema version, this module
 * falls back to an in-memory store for the session. Callers never see a throw
 * from a storage failure. Unknown-version / corrupt raw data is copied to
 * `algolab_progress_backup` before the first successful write of a new valid
 * object, so it stays recoverable.
 */
(function (window) {
    "use strict";

    var STORAGE_KEY = "algolab_progress";
    var BACKUP_KEY = "algolab_progress_backup";
    var SCHEMA_VERSION = 1;
    var PASS_THRESHOLD = 0.8;

    var memoryState = emptyState();
    var unrecognizedRaw = null;
    var persistenceWorks = null; // unknown until probed

    function emptyState() {
        return { version: SCHEMA_VERSION, units: {} };
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function getStorage() {
        try {
            return window.localStorage || null;
        } catch (error) {
            return null;
        }
    }

    function probeStorage() {
        var storage = getStorage();
        if (!storage) {
            persistenceWorks = false;
            return false;
        }
        var probeKey = STORAGE_KEY + "__probe";
        try {
            storage.setItem(probeKey, "1");
            var ok = storage.getItem(probeKey) === "1";
            storage.removeItem(probeKey);
            persistenceWorks = ok;
            return ok;
        } catch (error) {
            persistenceWorks = false;
            return false;
        }
    }

    function normalizeEntry(raw) {
        if (!raw || typeof raw !== "object") return null;
        if (!Number.isInteger(raw.total) || raw.total < 1) return null;

        var total = raw.total;
        var bestScore = Number.isInteger(raw.bestScore) ? raw.bestScore : 0;
        var score = Number.isInteger(raw.score) ? raw.score : 0;

        bestScore = Math.max(0, Math.min(total, bestScore));
        score = Math.max(0, Math.min(total, score));

        return {
            quizPassed: bestScore / total >= PASS_THRESHOLD,
            score: score,
            total: total,
            bestScore: bestScore,
            lastAttempt: typeof raw.lastAttempt === "string" ? raw.lastAttempt : null
        };
    }

    function normalizeState(raw) {
        if (!raw || typeof raw !== "object") return null;
        if (raw.version !== SCHEMA_VERSION) return null;
        if (!raw.units || typeof raw.units !== "object" || Array.isArray(raw.units)) {
            return null;
        }

        var units = {};
        Object.keys(raw.units).forEach(function (unitId) {
            var entry = normalizeEntry(raw.units[unitId]);
            if (entry) units[unitId] = entry;
        });

        return { version: SCHEMA_VERSION, units: units };
    }

    function readState() {
        var storage = getStorage();
        if (!storage) {
            persistenceWorks = false;
            return clone(memoryState);
        }

        var raw;
        try {
            raw = storage.getItem(STORAGE_KEY);
        } catch (error) {
            persistenceWorks = false;
            return clone(memoryState);
        }

        if (raw === null || raw === undefined || raw === "") {
            return clone(memoryState);
        }

        var parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (error) {
            if (unrecognizedRaw === null) unrecognizedRaw = raw;
            if (typeof console !== "undefined") {
                console.warn("[AlgoLabProgress] Ignoring corrupt progress JSON; using session memory.");
            }
            return clone(memoryState);
        }

        var normalized = normalizeState(parsed);
        if (!normalized) {
            if (unrecognizedRaw === null) unrecognizedRaw = raw;
            if (typeof console !== "undefined") {
                console.warn("[AlgoLabProgress] Ignoring unsupported progress data; using session memory.");
            }
            return clone(memoryState);
        }

        memoryState = normalized;
        return clone(normalized);
    }

    function writeState(state) {
        memoryState = clone(state);

        var storage = getStorage();
        if (!storage) {
            persistenceWorks = false;
            return false;
        }

        try {
            // Keep unrecognized data recoverable before the first overwrite.
            if (unrecognizedRaw !== null) {
                try {
                    storage.setItem(BACKUP_KEY, unrecognizedRaw);
                } catch (backupError) {
                    // Backup is best-effort; still attempt the primary write.
                }
                unrecognizedRaw = null;
            }
            storage.setItem(STORAGE_KEY, JSON.stringify(state));
            persistenceWorks = true;
            return true;
        } catch (error) {
            persistenceWorks = false;
            return false;
        }
    }

    function requireUnitId(unitId) {
        if (typeof unitId !== "string" || unitId.trim() === "") {
            throw new Error("AlgoLabProgress: unitId must be a non-empty string");
        }
    }

    function requireAttempt(score, total) {
        if (!Number.isInteger(total) || total < 1) {
            throw new Error("AlgoLabProgress: total must be an integer >= 1");
        }
        if (!Number.isInteger(score) || score < 0 || score > total) {
            throw new Error("AlgoLabProgress: score must be an integer between 0 and total");
        }
    }

    function getUnit(unitId) {
        requireUnitId(unitId);
        var state = readState();
        var entry = state.units[unitId];
        return entry ? clone(entry) : null;
    }

    function getAll() {
        return readState();
    }

    function recordAttempt(unitId, score, total) {
        requireUnitId(unitId);
        requireAttempt(score, total);

        var state = readState();
        var previous = state.units[unitId];

        // If the quiz was edited (total changed), clamp the old best to the new
        // total rather than trusting an out-of-range count.
        var previousBest = previous && Number.isInteger(previous.bestScore)
            ? Math.min(previous.bestScore, total)
            : 0;
        var bestScore = Math.max(previousBest, score);

        var entry = {
            quizPassed: bestScore / total >= PASS_THRESHOLD,
            score: score,
            total: total,
            bestScore: bestScore,
            lastAttempt: new Date().toISOString()
        };

        state.units[unitId] = entry;
        writeState(state);
        return clone(entry);
    }

    function isPassed(unitId) {
        var entry = getUnit(unitId);
        return !!(entry && entry.quizPassed);
    }

    function isAvailable() {
        if (persistenceWorks === null) {
            probeStorage();
        }
        return persistenceWorks === true;
    }

    window.AlgoLabProgress = {
        STORAGE_KEY: STORAGE_KEY,
        SCHEMA_VERSION: SCHEMA_VERSION,
        PASS_THRESHOLD: PASS_THRESHOLD,
        getUnit: getUnit,
        getAll: getAll,
        recordAttempt: recordAttempt,
        isPassed: isPassed,
        isAvailable: isAvailable
    };
})(window);

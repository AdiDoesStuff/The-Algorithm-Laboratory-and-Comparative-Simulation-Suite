#!/usr/bin/env node
/*
 * AlgoLab dev content validator. Not imported by the app.
 *
 *   node dev/validate_content.mjs
 *
 * Checks quiz/lesson/unit data for the mistakes that are easy to make in a
 * data-only app: duplicate ids, missing options, a correctOptionId that does
 * not exist, a lesson quizId that no registry entry resolves, and a quiz whose
 * unitId is not in units.js.
 *
 * ES modules cannot be imported straight from a no-package.json frontend, so
 * this script copies the modules it needs into a temp dir as .mjs (rewriting
 * relative imports) and cleans the temp dir up afterwards.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { pathToFileURL, fileURLToPath } from "node:url";

const DEV_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DEV_DIR, "..");
const FRONTEND = path.join(ROOT, "frontend");

const errors = [];
const passes = [];

function pass(message) {
    passes.push(`PASS  ${message}`);
}

function fail(message) {
    errors.push(`FAIL  ${message}`);
}

function loadClassicGlobal(relativePath, globalName) {
    const file = path.join(FRONTEND, relativePath);
    const source = fs.readFileSync(file, "utf8");
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: file });
    return sandbox.window[globalName];
}

function buildTempModules() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "algolab-content-"));
    const files = [
        "js/quizzes/bstQuiz.js",
        "js/quizzes/index.js",
        "js/lessons/bstLessons.js"
    ];
    for (const relativePath of files) {
        const source = fs.readFileSync(path.join(FRONTEND, relativePath), "utf8");
        // Point relative imports at the .mjs copies living beside each other.
        const rewritten = source.replace(/(from\s+["'][^"']+)\.js(["'])/g, "$1.mjs$2");
        const outName = `${path.basename(relativePath, ".js")}.mjs`;
        fs.writeFileSync(path.join(dir, outName), rewritten);
    }
    return dir;
}

function checkQuiz(quiz, unitsById) {
    if (!quiz || typeof quiz !== "object") {
        fail("registry returned a non-object quiz");
        return;
    }
    if (!quiz.id || typeof quiz.id !== "string") {
        fail("quiz has no id");
    }
    if (!unitsById.has(quiz.unitId)) {
        fail(`quiz "${quiz.id}" has unitId "${quiz.unitId}" which is not in units.js`);
    }
    if (!Array.isArray(quiz.questions) || quiz.questions.length === 0) {
        fail(`quiz "${quiz.id}" has no questions`);
        return;
    }

    const questionIds = new Set();
    quiz.questions.forEach((question, index) => {
        const label = `quiz "${quiz.id}" question ${index + 1} ("${question.id || "no id"}")`;
        if (!question.id || typeof question.id !== "string") {
            fail(`${label}: missing id`);
        } else if (questionIds.has(question.id)) {
            fail(`${label}: duplicate question id`);
        } else {
            questionIds.add(question.id);
        }
        if (typeof question.prompt !== "string" || question.prompt.trim() === "") {
            fail(`${label}: empty prompt`);
        }
        if (typeof question.explanation !== "string" || question.explanation.trim() === "") {
            fail(`${label}: empty explanation`);
        }
        if (!Array.isArray(question.options) || question.options.length < 3 || question.options.length > 4) {
            fail(`${label}: needs 3-4 options, found ${question.options ? question.options.length : 0}`);
            return;
        }
        const optionIds = new Set();
        question.options.forEach((option, optionIndex) => {
            if (!option.id || typeof option.id !== "string") {
                fail(`${label}: option ${optionIndex + 1} has no id`);
            } else if (optionIds.has(option.id)) {
                fail(`${label}: duplicate option id "${option.id}"`);
            } else {
                optionIds.add(option.id);
            }
            if (typeof option.text !== "string" || option.text.trim() === "") {
                fail(`${label}: option ${optionIndex + 1} has no text`);
            }
        });
        if (!optionIds.has(question.correctOptionId)) {
            fail(`${label}: correctOptionId "${question.correctOptionId}" is not one of its options`);
        }
    });

    pass(`quiz "${quiz.id}" (unit ${quiz.unitId}): ${quiz.questions.length} questions, ids and options valid`);
}

function checkGlossary(glossary, units) {
    if (!glossary || !Array.isArray(glossary.terms) || glossary.terms.length === 0) {
        fail("glossaryData.js did not expose a non-empty ALGOLAB_GLOSSARY.terms array");
        return;
    }

    const terms = new Set();
    const slugs = new Set();
    glossary.terms.forEach((entry) => {
        if (!entry || typeof entry.term !== "string" || entry.term.trim() === "") {
            fail("glossary entry has an empty term");
            return;
        }
        if (typeof entry.def !== "string" || entry.def.trim() === "") {
            fail(`glossary term "${entry.term}" has an empty definition`);
        }
        if (typeof entry.slug !== "string" || !/^[a-z0-9-]+$/.test(entry.slug)) {
            fail(`glossary term "${entry.term}" has an invalid slug "${entry.slug}"`);
        }
        const key = entry.term.toLowerCase();
        if (terms.has(key)) {
            fail(`duplicate glossary term "${entry.term}"`);
        }
        terms.add(key);
        if (slugs.has(entry.slug)) {
            fail(`duplicate glossary slug "${entry.slug}"`);
        }
        slugs.add(entry.slug);
        if (glossary.lookup(entry.term) !== entry) {
            fail(`glossary lookup failed for its own term "${entry.term}"`);
        }
        if (glossary.getBySlug(entry.slug) !== entry) {
            fail(`glossary slug lookup failed for "${entry.slug}"`);
        }
    });

    units.forEach((unit) => {
        const advertised = Array.isArray(unit.glossaryTerms) ? unit.glossaryTerms : [];
        advertised.forEach((term) => {
            if (!glossary.lookup(term)) {
                fail(`unit "${unit.id}" advertises glossary term "${term}", which is not in glossaryData.js`);
            }
        });
    });

    pass(`glossary: ${glossary.terms.length} terms, unique slugs, every units.js glossaryTerms entry resolves`);
}

const TERM_MARKER = /\{\{term:([^}|]+)(?:\|([^}]+))?\}\}/g;

function checkLessonGlossaryMarkers(lessonList, glossary) {
    const scan = (label, text, { allowMarkers = true } = {}) => {
        if (typeof text !== "string" || text === "") return;

        if (!allowMarkers) {
            if (text.includes("{{term:")) {
                fail(`${label}: term markers render as plain text here; put them in narration, prompt, reveal, or feedback instead`);
            }
            return;
        }

        let match;
        TERM_MARKER.lastIndex = 0;
        while ((match = TERM_MARKER.exec(text)) !== null) {
            const term = match[1].trim();
            const labelText = match[2] === undefined ? null : match[2].trim();
            if (!glossary.lookup(term)) {
                fail(`${label}: marker term "${term}" is not in glossaryData.js`);
            }
            if (labelText !== null && labelText === "") {
                fail(`${label}: marker "${match[0]}" has an empty display label`);
            }
        }

        if (text.replace(TERM_MARKER, "").includes("{{term:")) {
            fail(`${label}: malformed term marker (missing closing "}}" or empty term)`);
        }
    };

    lessonList.forEach((lesson) => {
        scan(`lesson "${lesson.id}" description`, lesson.description, { allowMarkers: false });

        const narration = lesson.narration;
        if (narration && typeof narration === "object") {
            Object.keys(narration).forEach((key) => {
                scan(`lesson "${lesson.id}" narration.${key}`, narration[key]);
            });
        }

        const checkpoints = Array.isArray(lesson.checkpoints) ? lesson.checkpoints : [];
        checkpoints.forEach((checkpoint, index) => {
            const label = `lesson "${lesson.id}" checkpoint ${index + 1}`;
            scan(`${label} prompt`, checkpoint.prompt);
            scan(`${label} reveal`, checkpoint.reveal);
            scan(`${label} onCorrect`, checkpoint.onCorrect);
            scan(`${label} onWrong`, checkpoint.onWrong);
            const choices = Array.isArray(checkpoint.choices) ? checkpoint.choices : [];
            choices.forEach((choice, choiceIndex) => {
                scan(`${label} choice ${choiceIndex + 1}`, choice, { allowMarkers: false });
            });
        });
    });

    pass("lesson term markers resolve (description and choices carry none)");
}

function main() {
    const units = loadClassicGlobal("js/shell/units.js", "ALGOLAB_UNITS");
    if (!Array.isArray(units) || units.length === 0) {
        fail("units.js did not expose a non-empty ALGOLAB_UNITS array");
    }
    const unitsById = new Map(units.map((unit) => [unit.id, unit]));

    const glossary = loadClassicGlobal("js/shell/glossaryData.js", "ALGOLAB_GLOSSARY");
    checkGlossary(glossary, units);

    const tempDir = buildTempModules();
    return (async () => {
        try {
            const registry = await import(pathToFileURL(path.join(tempDir, "index.mjs")).href);
            const lessons = await import(pathToFileURL(path.join(tempDir, "bstLessons.mjs")).href);

            const quizzes = registry.listQuizzes();
            if (!Array.isArray(quizzes) || quizzes.length === 0) {
                fail("quiz registry is empty");
            }
            quizzes.forEach((quiz) => {
                checkQuiz(quiz, unitsById);
                let resolved = null;
                try {
                    resolved = registry.getQuiz(quiz.id);
                } catch (error) {
                    fail(`registry could not resolve its own quiz "${quiz.id}": ${error.message}`);
                }
                if (resolved !== quiz) {
                    fail(`getQuiz("${quiz.id}") did not return the registered object`);
                }
            });

            // getQuiz must throw, never return undefined, on a miss.
            try {
                const missing = registry.getQuiz("definitely-not-a-quiz");
                fail(`getQuiz returned ${missing === undefined ? "undefined" : "a value"} for an unknown id`);
            } catch (error) {
                pass("getQuiz throws for an unknown id");
            }

            const lessonList = lessons.BST_LESSONS;
            if (!Array.isArray(lessonList) || lessonList.length === 0) {
                fail("BST_LESSONS is empty");
            } else {
                lessonList.forEach((lesson) => {
                    if (lesson.quizId) {
                        try {
                            registry.getQuiz(lesson.quizId);
                            pass(`lesson "${lesson.id}" quizId "${lesson.quizId}" resolves`);
                        } catch (error) {
                            fail(`lesson "${lesson.id}" quizId "${lesson.quizId}" does not resolve: ${error.message}`);
                        }
                    }
                    if (lesson.unit && !unitsById.has(lesson.unit)) {
                        fail(`lesson "${lesson.id}" unit "${lesson.unit}" is not in units.js`);
                    }
                });

                checkLessonGlossaryMarkers(lessonList, glossary);
            }

            // Units may advertise a quizId; it must resolve too.
            units.forEach((unit) => {
                if (unit.quizId) {
                    try {
                        registry.getQuiz(unit.quizId);
                        pass(`unit "${unit.id}" quizId "${unit.quizId}" resolves`);
                    } catch (error) {
                        fail(`unit "${unit.id}" quizId "${unit.quizId}" does not resolve: ${error.message}`);
                    }
                }
            });
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    })();
}

main()
    .then(() => {
        passes.forEach((line) => console.log(line));
        if (errors.length > 0) {
            errors.forEach((line) => console.error(line));
            console.error(`\n${errors.length} content error(s).`);
            process.exitCode = 1;
        } else {
            console.log(`\nContent OK: ${passes.length} checks passed.`);
        }
    })
    .catch((error) => {
        console.error("Validator crashed:", error);
        process.exitCode = 1;
    });

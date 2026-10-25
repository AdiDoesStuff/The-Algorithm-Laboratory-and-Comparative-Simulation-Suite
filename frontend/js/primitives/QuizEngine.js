/*
 * QuizEngine — generic, unit-agnostic quiz renderer.
 *
 * ES module (no build step). Knows nothing about BSTs or any unit; all content
 * comes from a quiz data object.
 *
 *   import { render } from "../primitives/QuizEngine.js";
 *   const controller = render(container, {
 *       questions: quiz.questions,
 *       onComplete: ({ score, total, passed, answers }) => { ... },
 *       passThreshold: 0.8,             // optional, defaults to 0.8
 *       rng: Math.random,               // optional, injectable for tests
 *       secondaryAction: { label: "Back to lesson", onClick: () => {} }
 *   });
 *   controller.restart();   // new attempt, reshuffles options + questions
 *   controller.destroy();   // removes DOM + listeners
 *
 * Question schema:
 *   {
 *       id: "unique-id",
 *       prompt: "Question text",
 *       topic: "Traversal",                      // optional, used for breakdown
 *       options: [{ id: "a", text: "..." }, ...], // 2-4 options
 *       correctOptionId: "a",                     // correctness is by option id,
 *                                                 // never by array position
 *       explanation: "Why the answer is right."
 *   }
 *
 * Accessibility: each question is a <fieldset> with a <legend>, native radio
 * inputs with real labels, a persistent aria-live feedback region, and explicit
 * focus management. Correct/incorrect state is always stated in text (plus an
 * icon), never by color alone.
 */

const DEFAULT_PASS_THRESHOLD = 0.8;
const instances = new WeakMap();
let instanceCounter = 0;

function el(tagName, className, text) {
    const node = document.createElement(tagName);
    if (className) node.className = className;
    if (typeof text === "string") node.textContent = text;
    return node;
}

function shuffle(items, rng) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const raw = Math.floor(rng() * (i + 1));
        const j = Math.min(i, Math.max(0, raw));
        const tmp = copy[i];
        copy[i] = copy[j];
        copy[j] = tmp;
    }
    return copy;
}

function validateQuestions(questions) {
    if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error("QuizEngine: questions must be a non-empty array");
    }
    const seenIds = new Set();
    questions.forEach((question, index) => {
        if (!question || typeof question !== "object") {
            throw new Error(`QuizEngine: question at index ${index} is not an object`);
        }
        if (typeof question.id !== "string" || question.id === "") {
            throw new Error(`QuizEngine: question at index ${index} needs a non-empty id`);
        }
        if (seenIds.has(question.id)) {
            throw new Error(`QuizEngine: duplicate question id "${question.id}"`);
        }
        seenIds.add(question.id);

        if (typeof question.prompt !== "string" || question.prompt === "") {
            throw new Error(`QuizEngine: question "${question.id}" needs a non-empty prompt`);
        }
        if (!Array.isArray(question.options) || question.options.length < 2) {
            throw new Error(`QuizEngine: question "${question.id}" needs at least 2 options`);
        }
        const optionIds = new Set();
        question.options.forEach((option) => {
            if (!option || typeof option !== "object") {
                throw new Error(`QuizEngine: question "${question.id}" has a non-object option`);
            }
            if (typeof option.id !== "string" || option.id === "") {
                throw new Error(`QuizEngine: question "${question.id}" has an option without an id`);
            }
            if (optionIds.has(option.id)) {
                throw new Error(`QuizEngine: question "${question.id}" has duplicate option id "${option.id}"`);
            }
            optionIds.add(option.id);
            if (typeof option.text !== "string" || option.text === "") {
                throw new Error(`QuizEngine: option "${option.id}" in "${question.id}" has no text`);
            }
        });
        if (!optionIds.has(question.correctOptionId)) {
            throw new Error(`QuizEngine: question "${question.id}" has a correctOptionId that is not one of its options`);
        }
    });
}

function cloneQuestions(questions) {
    return questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        topic: typeof question.topic === "string" ? question.topic : "",
        explanation: typeof question.explanation === "string" ? question.explanation : "",
        correctOptionId: question.correctOptionId,
        options: question.options.map((option) => ({ id: option.id, text: option.text }))
    }));
}

function progressUnavailable() {
    const progress = typeof window !== "undefined" ? window.AlgoLabProgress : null;
    if (!progress || typeof progress.isAvailable !== "function") return false;
    try {
        return progress.isAvailable() === false;
    } catch (error) {
        return false;
    }
}

function formatPercent(score, total) {
    if (!total) return "0%";
    return `${Math.round((score / total) * 100)}%`;
}

function answerText(question, optionId) {
    const option = question.options.find((item) => item.id === optionId);
    return option ? option.text : "No answer";
}

/**
 * Mount a quiz into `container`.
 * Returns { destroy(), restart() }.
 */
export function render(container, options = {}) {
    if (!container || typeof container.appendChild !== "function") {
        throw new Error("QuizEngine: render(container, ...) needs a DOM element");
    }
    validateQuestions(options.questions);

    const previous = instances.get(container);
    if (previous) previous.destroy();

    const questions = cloneQuestions(options.questions);
    const onComplete = typeof options.onComplete === "function" ? options.onComplete : null;
    const secondaryAction = options.secondaryAction && typeof options.secondaryAction.onClick === "function"
        ? options.secondaryAction
        : null;
    const passThreshold = Number.isFinite(options.passThreshold)
        ? options.passThreshold
        : DEFAULT_PASS_THRESHOLD;
    const rng = typeof options.rng === "function" ? options.rng : Math.random;

    instanceCounter += 1;
    const uid = `quiz${instanceCounter}`;

    const root = el("div", "quiz-root");
    root.setAttribute("data-quiz-root", "");

    const header = el("div", "quiz-header");
    const progressText = el("p", "quiz-progress", "");
    header.appendChild(progressText);

    const stage = el("div", "quiz-stage");
    const feedback = el("div", "quiz-feedback");
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");

    const actions = el("div", "quiz-actions");
    const primaryButton = el("button", "quiz-primary", "Check answer");
    primaryButton.type = "button";
    primaryButton.disabled = true;
    actions.appendChild(primaryButton);

    root.append(header, stage, feedback, actions);
    container.appendChild(root);

    const state = {
        attempt: 0,
        order: [],
        cursor: 0,
        phase: "unanswered", // 'unanswered' | 'answered' | 'revealed' | 'results'
        selectedOptionId: null,
        answers: [],
        completed: false,
        destroyed: false
    };

    let currentQuestion = null;
    let currentOptions = [];
    let currentFieldset = null;

    function startAttempt() {
        state.attempt += 1;
        state.cursor = 0;
        state.answers = [];
        state.completed = false;

        const indexes = questions.map((_, index) => index);
        const firstAttempt = state.attempt === 1;
        state.order = firstAttempt ? indexes : shuffle(indexes, rng);

        root.classList.remove("quiz-root--results");
        header.classList.remove("hidden");
        feedback.textContent = "";
        feedback.className = "quiz-feedback";

        // The results screen replaces the action buttons; put the primary
        // button back before the next question renders.
        actions.textContent = "";
        actions.appendChild(primaryButton);

        renderQuestion();
    }

    function renderQuestion() {
        state.phase = "unanswered";
        state.selectedOptionId = null;

        const question = questions[state.order[state.cursor]];
        currentQuestion = question;
        currentOptions = shuffle(question.options, rng);

        stage.textContent = "";
        progressText.textContent = `Question ${state.cursor + 1} of ${state.order.length}`;
        if (question.topic) {
            progressText.textContent += ` · ${question.topic}`;
        }

        const fieldset = el("fieldset", "quiz-question");
        const legend = el("legend", "quiz-prompt", question.prompt);
        legend.tabIndex = -1;
        fieldset.appendChild(legend);

        const optionList = el("div", "quiz-options");
        const name = `${uid}-q${state.cursor}`;

        currentOptions.forEach((option) => {
            const label = el("label", "quiz-option");
            label.setAttribute("data-option-id", option.id);

            const input = document.createElement("input");
            input.type = "radio";
            input.name = name;
            input.value = option.id;
            input.className = "quiz-radio";

            const text = el("span", "quiz-option-text", option.text);
            const tag = el("span", "quiz-option-tag", "");

            input.addEventListener("change", () => {
                if (state.phase === "revealed" || state.phase === "results") return;
                state.selectedOptionId = option.id;
                state.phase = "answered";
                updatePrimaryButton();
            });

            label.append(input, text, tag);
            optionList.appendChild(label);
        });

        fieldset.appendChild(optionList);
        stage.appendChild(fieldset);
        currentFieldset = fieldset;

        feedback.textContent = "";
        feedback.className = "quiz-feedback";
        updatePrimaryButton();
    }

    function updatePrimaryButton() {
        primaryButton.classList.remove("hidden");
        primaryButton.disabled = true;

        if (state.phase === "unanswered") {
            primaryButton.textContent = "Check answer";
            primaryButton.disabled = true;
        } else if (state.phase === "answered") {
            primaryButton.textContent = "Check answer";
            primaryButton.disabled = state.selectedOptionId === null;
        } else if (state.phase === "revealed") {
            const isLast = state.cursor >= state.order.length - 1;
            primaryButton.textContent = isLast ? "See results" : "Next question";
            primaryButton.disabled = false;
        }
    }

    function checkAnswer() {
        if (state.phase !== "answered" || !currentQuestion) return;

        const selectedOptionId = state.selectedOptionId;
        const correct = selectedOptionId === currentQuestion.correctOptionId;
        state.answers.push({
            questionId: currentQuestion.id,
            selectedOptionId,
            correct
        });
        state.phase = "revealed";

        // Lock the options and label them in words (not color alone).
        if (currentFieldset) {
            currentFieldset.querySelectorAll("input[type=radio]").forEach((input) => {
                input.disabled = true;
            });
            currentFieldset.querySelectorAll(".quiz-option").forEach((label) => {
                const optionId = label.getAttribute("data-option-id");
                const tag = label.querySelector(".quiz-option-tag");
                const isCorrect = optionId === currentQuestion.correctOptionId;
                const isSelected = optionId === selectedOptionId;
                label.classList.toggle("quiz-option--correct", isCorrect);
                label.classList.toggle("quiz-option--incorrect", isSelected && !isCorrect);
                if (tag) {
                    if (isCorrect && isSelected) tag.textContent = "Your answer — correct";
                    else if (isCorrect) tag.textContent = "Correct answer";
                    else if (isSelected) tag.textContent = "Your answer — incorrect";
                    else tag.textContent = "";
                }
            });
        }

        const outcome = el("p", `quiz-outcome ${correct ? "quiz-outcome--correct" : "quiz-outcome--incorrect"}`,
            correct ? "✓ Correct" : "✗ Not quite");
        feedback.textContent = "";
        feedback.appendChild(outcome);

        if (!correct) {
            const answerLine = el("p", "quiz-correct-answer",
                `Correct answer: ${answerText(currentQuestion, currentQuestion.correctOptionId)}`);
            feedback.appendChild(answerLine);
        }

        if (currentQuestion.explanation) {
            feedback.appendChild(el("p", "quiz-explanation", currentQuestion.explanation));
        }

        updatePrimaryButton();
        primaryButton.focus();
    }

    function advance() {
        if (state.cursor >= state.order.length - 1) {
            renderResults();
            return;
        }
        state.cursor += 1;
        renderQuestion();
        const legend = stage.querySelector(".quiz-prompt");
        if (legend) legend.focus();
    }

    function renderResults() {
        state.phase = "results";

        const total = state.answers.length;
        const score = state.answers.reduce((sum, answer) => (answer.correct ? sum + 1 : sum), 0);
        const ratio = total === 0 ? 0 : score / total;
        const passed = ratio >= passThreshold;

        header.classList.add("hidden");
        feedback.textContent = "";
        feedback.className = "quiz-feedback";
        stage.textContent = "";
        root.classList.add("quiz-root--results");

        const results = el("div", "quiz-results");

        const title = el("h2", "quiz-results-title", passed ? "Quiz passed" : "Quiz complete");
        title.tabIndex = -1;
        results.appendChild(title);

        results.appendChild(el("p", "quiz-score", `${score} / ${total} correct (${formatPercent(score, total)})`));

        const outcomeText = passed
            ? `You passed: this is at or above the ${formatPercent(passThreshold, 1)} pass mark.`
            : `Not passed yet: you need ${formatPercent(passThreshold, 1)} to pass. Try again when you are ready.`;
        results.appendChild(el("p", `quiz-outcome ${passed ? "quiz-outcome--correct" : "quiz-outcome--incorrect"}`, outcomeText));

        if (progressUnavailable()) {
            results.appendChild(el("p", "quiz-storage-note",
                "Progress won't be saved in this browser mode."));
        }

        // Per-topic breakdown, when the questions carry topics.
        const topics = new Map();
        state.answers.forEach((answer) => {
            const question = questions.find((item) => item.id === answer.questionId);
            const topic = question && question.topic ? question.topic : "";
            if (!topic) return;
            if (!topics.has(topic)) topics.set(topic, { correct: 0, total: 0 });
            const bucket = topics.get(topic);
            bucket.total += 1;
            if (answer.correct) bucket.correct += 1;
        });
        if (topics.size > 0) {
            const topicWrap = el("div", "quiz-topics");
            topicWrap.appendChild(el("h3", "quiz-subheading", "By topic"));
            const list = el("ul", "quiz-topic-list");
            topics.forEach((bucket, topic) => {
                list.appendChild(el("li", "quiz-topic", `${topic}: ${bucket.correct} / ${bucket.total}`));
            });
            topicWrap.appendChild(list);
            results.appendChild(topicWrap);
        }

        // Missed questions with the correct answer and explanation.
        const missed = state.answers.filter((answer) => !answer.correct);
        if (missed.length > 0) {
            const missedWrap = el("div", "quiz-missed");
            missedWrap.appendChild(el("h3", "quiz-subheading", "Missed questions"));
            const list = el("ul", "quiz-missed-list");

            missed.forEach((answer) => {
                const question = questions.find((item) => item.id === answer.questionId);
                if (!question) return;
                const item = el("li", "quiz-missed-item");
                item.appendChild(el("p", "quiz-missed-prompt", question.prompt));
                item.appendChild(el("p", "quiz-missed-your", `Your answer: ${answerText(question, answer.selectedOptionId)}`));
                item.appendChild(el("p", "quiz-missed-correct",
                    `Correct answer: ${answerText(question, question.correctOptionId)}`));
                if (question.explanation) {
                    item.appendChild(el("p", "quiz-explanation", question.explanation));
                }
                list.appendChild(item);
            });

            missedWrap.appendChild(list);
            results.appendChild(missedWrap);
        }

        stage.appendChild(results);

        actions.textContent = "";
        const retake = el("button", "quiz-retake", "Retake quiz");
        retake.type = "button";
        retake.addEventListener("click", () => restart());
        actions.appendChild(retake);

        if (secondaryAction) {
            const secondary = el("button", "quiz-secondary", secondaryAction.label || "Continue");
            secondary.type = "button";
            secondary.addEventListener("click", () => secondaryAction.onClick());
            actions.appendChild(secondary);
        }

        title.focus();

        if (!state.completed) {
            state.completed = true;
            if (onComplete) {
                onComplete({
                    score,
                    total,
                    passed,
                    answers: state.answers.map((answer) => ({
                        questionId: answer.questionId,
                        selectedOptionId: answer.selectedOptionId,
                        correct: answer.correct
                    }))
                });
            }
        }
    }

    function restart() {
        if (state.destroyed) return;
        startAttempt();
        const legend = stage.querySelector(".quiz-prompt");
        if (legend) legend.focus();
    }

    function onPrimaryClick() {
        if (state.destroyed) return;
        if (state.phase === "answered") {
            checkAnswer();
        } else if (state.phase === "revealed") {
            advance();
        }
    }

    primaryButton.addEventListener("click", onPrimaryClick);

    function destroy() {
        if (state.destroyed) return;
        state.destroyed = true;
        primaryButton.removeEventListener("click", onPrimaryClick);
        root.remove();
        if (instances.get(container) === controller) {
            instances.delete(container);
        }
    }

    const controller = { destroy, restart };
    instances.set(container, controller);

    startAttempt();
    const firstLegend = stage.querySelector(".quiz-prompt");
    if (firstLegend) firstLegend.focus();

    return controller;
}

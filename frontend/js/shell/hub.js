/*
 * AlgoLab hub renderer.
 *
 * Classic script. Reads window.ALGOLAB_UNITS (js/shell/units.js) and
 * window.AlgoLabProgress (js/shell/progress.js), then builds:
 *   - the unit cards inside #unit-grid (with progress badges and
 *     "Test yourself" deep links for units that declare a quizId),
 *   - the Guided Path list inside #guided-path-list, with a soft quiz nudge.
 *
 * Everything is derived from units.js; nothing is special-cased per unit.
 */
(function (window, document) {
    "use strict";

    function makeElement(tagName, className, text) {
        var node = document.createElement(tagName);
        if (className) {
            node.className = className;
        }
        if (typeof text === "string") {
            node.textContent = text;
        }
        return node;
    }

    function makeBadge(text, modifier) {
        return makeElement("span", "unit-badge unit-badge--" + modifier, text);
    }

    function getUnits() {
        return Array.isArray(window.ALGOLAB_UNITS) ? window.ALGOLAB_UNITS : [];
    }

    function unitById(unitId) {
        return getUnits().find(function (unit) {
            return unit.id === unitId;
        }) || null;
    }

    function progressEntry(unitId) {
        var progress = window.AlgoLabProgress;
        if (!progress || typeof progress.getUnit !== "function") {
            return null;
        }
        try {
            return progress.getUnit(unitId);
        } catch (error) {
            return null;
        }
    }

    function quizPassed(unitId) {
        var entry = progressEntry(unitId);
        return !!(entry && entry.quizPassed);
    }

    /* --- Unit cards ---------------------------------------------------- */

    function renderLiveCard(unit) {
        var card = makeElement("article", "unit-card unit-card--live");
        card.setAttribute("data-unit-id", unit.id);
        card.setAttribute("data-status", unit.status);

        var head = makeElement("div", "unit-card-head");
        head.appendChild(makeElement("h3", "unit-card-title", unit.title));
        head.appendChild(makeBadge("Live", "live"));
        card.appendChild(head);

        card.appendChild(makeElement("p", "unit-card-blurb", unit.blurb));

        var actions = makeElement("div", "unit-card-actions");

        var openLink = makeElement("a", "unit-open", "Open");
        openLink.href = unit.page;
        openLink.setAttribute("aria-label", "Open " + unit.title);
        actions.appendChild(openLink);

        var progressSlot = makeElement("span", "progress-badge");
        progressSlot.setAttribute("data-progress-slot", unit.id);
        actions.appendChild(progressSlot);

        if (unit.quizId && unit.page) {
            var testLink = makeElement("a", "unit-test", "Test yourself");
            testLink.href = unit.page + "?quiz=" + encodeURIComponent(unit.quizId);
            testLink.setAttribute("aria-label", "Test yourself on " + unit.title);
            actions.appendChild(testLink);
        } else {
            var testButton = makeElement("button", "unit-test", "Test yourself");
            testButton.type = "button";
            testButton.disabled = true;
            testButton.title = "Coming with quizzes";
            actions.appendChild(testButton);
        }

        card.appendChild(actions);
        return card;
    }

    function renderSoonCard(unit) {
        var card = makeElement("article", "unit-card unit-card--soon");
        card.setAttribute("data-unit-id", unit.id);
        card.setAttribute("data-status", unit.status);
        card.setAttribute("aria-disabled", "true");

        var head = makeElement("div", "unit-card-head");
        head.appendChild(makeElement("h3", "unit-card-title", unit.title));
        head.appendChild(makeBadge("Coming soon", "soon"));
        card.appendChild(head);

        card.appendChild(makeElement("p", "unit-card-blurb", unit.blurb));

        return card;
    }

    function renderUnitGrid() {
        var grid = document.getElementById("unit-grid");
        if (!grid) {
            return;
        }

        var units = window.ALGOLAB_UNITS;
        if (!Array.isArray(units)) {
            grid.textContent = "Unit registry unavailable. Load js/shell/units.js first.";
            return;
        }

        var fragment = document.createDocumentFragment();
        units.forEach(function (unit) {
            fragment.appendChild(
                unit.status === "live" ? renderLiveCard(unit) : renderSoonCard(unit)
            );
        });

        grid.textContent = "";
        grid.appendChild(fragment);
    }

    /* --- Progress badges ----------------------------------------------- */

    function renderProgressBadges() {
        var slots = document.querySelectorAll("[data-progress-slot]");
        Array.prototype.forEach.call(slots, function (slot) {
            var unitId = slot.getAttribute("data-progress-slot");
            var entry = progressEntry(unitId);
            var unit = unitById(unitId);

            slot.textContent = "";
            slot.removeAttribute("aria-label");
            slot.removeAttribute("data-state");
            slot.classList.remove("progress-badge--passed", "progress-badge--attempted");

            if (!entry) {
                return;
            }

            var passed = !!entry.quizPassed;
            var text = passed
                ? "Quiz passed: " + entry.bestScore + "/" + entry.total
                : "Quiz: best " + entry.bestScore + "/" + entry.total + " (not passed yet)";
            var spoken = passed
                ? (unit ? unit.title : unitId) + " quiz passed: best score " + entry.bestScore + " out of " + entry.total + "."
                : (unit ? unit.title : unitId) + " quiz not passed yet: best score " + entry.bestScore + " out of " + entry.total + ".";

            var icon = makeElement("span", "progress-badge-icon", passed ? "✓" : "○");
            icon.setAttribute("aria-hidden", "true");
            slot.appendChild(icon);
            slot.appendChild(makeElement("span", "progress-badge-text", text));

            slot.setAttribute("data-state", passed ? "passed" : "attempted");
            slot.setAttribute("aria-label", spoken);
            slot.classList.add(passed ? "progress-badge--passed" : "progress-badge--attempted");
        });
    }

    /* --- Guided Path --------------------------------------------------- */

    function orderedUnits() {
        return getUnits().slice().sort(function (a, b) {
            var orderA = typeof a.guidedOrder === "number" ? a.guidedOrder : 999;
            var orderB = typeof b.guidedOrder === "number" ? b.guidedOrder : 999;
            return orderA - orderB;
        });
    }

    /**
     * "Current step" is derived from progress, never stored: the first live
     * unit that advertises a quiz and has not been passed yet. If every quiz
     * is passed (or none exists), the last live unit is current.
     */
    function currentStep(units) {
        var live = units.filter(function (unit) {
            return unit.status === "live";
        });
        var quizzable = live.filter(function (unit) {
            return !!unit.quizId;
        });
        for (var index = 0; index < quizzable.length; index += 1) {
            if (!quizPassed(quizzable[index].id)) {
                return quizzable[index];
            }
        }
        return live.length ? live[live.length - 1] : null;
    }

    function makeNudge(previousUnit, targetUnit) {
        var nudge = makeElement("div", "guided-nudge");
        nudge.setAttribute("role", "status");
        nudge.setAttribute("aria-live", "polite");

        nudge.appendChild(makeElement("p", "guided-nudge-text",
            "You haven't passed the " + previousUnit.title + " quiz yet. Take it first, or continue anyway."));

        var actions = makeElement("div", "guided-nudge-actions");

        var takeQuiz = makeElement("a", "guided-nudge-quiz", "Take the quiz");
        takeQuiz.href = previousUnit.page + "?quiz=" + encodeURIComponent(previousUnit.quizId);
        actions.appendChild(takeQuiz);

        var continueAnyway = makeElement("a", "guided-nudge-continue", "Continue anyway");
        continueAnyway.href = targetUnit.page;
        actions.appendChild(continueAnyway);

        var dismiss = makeElement("button", "guided-nudge-dismiss", "Dismiss");
        dismiss.type = "button";
        dismiss.addEventListener("click", function () {
            nudge.remove();
            var link = document.getElementById("guided-link-" + targetUnit.id);
            if (link) link.focus();
        });
        actions.appendChild(dismiss);

        nudge.appendChild(actions);
        return nudge;
    }

    function renderGuidedPath() {
        var list = document.getElementById("guided-path-list");
        if (!list) {
            return;
        }

        var units = orderedUnits();
        var current = currentStep(units);
        var fragment = document.createDocumentFragment();

        units.forEach(function (unit, index) {
            var item = makeElement("li", "guided-step-item");
            item.setAttribute("data-unit-id", unit.id);

            if (unit.status === "live" && unit.page) {
                var link = makeElement("a", "guided-step", (index + 1) + ". " + unit.title);
                link.id = "guided-link-" + unit.id;
                link.href = unit.page;
                item.appendChild(link);

                if (current && current.id === unit.id) {
                    item.appendChild(makeElement("span", "guided-step-tag", "Current step"));
                }
                if (unit.quizId && quizPassed(unit.id)) {
                    item.appendChild(makeElement("span", "guided-step-tag guided-step-tag--done", "Quiz passed"));
                }
            } else {
                var label = makeElement("span", "guided-step guided-step--soon",
                    (index + 1) + ". " + unit.title);
                item.appendChild(label);
                item.appendChild(makeElement("span", "guided-step-tag guided-step-tag--soon", "Coming soon"));
            }

            fragment.appendChild(item);
        });

        list.textContent = "";
        list.appendChild(fragment);
    }

    function onGuidedPathClick(event) {
        var link = event.target.closest ? event.target.closest("a.guided-step") : null;
        if (!link) {
            return;
        }

        var item = link.closest("li");
        var targetId = item ? item.getAttribute("data-unit-id") : null;
        var units = orderedUnits();
        var targetIndex = units.findIndex(function (unit) {
            return unit.id === targetId;
        });
        if (targetIndex <= 0) {
            return;
        }

        var previous = units[targetIndex - 1];
        if (!previous.quizId || quizPassed(previous.id)) {
            return;
        }

        // Soft gate: never block. Show an inline, dismissible nudge with an
        // explicit "Continue anyway".
        event.preventDefault();

        var existing = item.querySelector(".guided-nudge");
        if (existing) {
            existing.remove();
        }
        var target = unitById(targetId);
        var nudge = makeNudge(previous, target);
        item.appendChild(nudge);
    }

    /* --- Boot ---------------------------------------------------------- */

    function render() {
        renderUnitGrid();
        renderGuidedPath();
        renderProgressBadges();

        var list = document.getElementById("guided-path-list");
        if (list) {
            list.addEventListener("click", onGuidedPathClick);
        }
    }

    // Back/forward cache returns and cross-tab writes must refresh the
    // badges, the Guided Path's current step, and any "Quiz passed" tag.
    function refresh() {
        renderProgressBadges();
        renderGuidedPath();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", render);
    } else {
        render();
    }

    window.addEventListener("pageshow", refresh);
    window.addEventListener("storage", refresh);
})(window, document);

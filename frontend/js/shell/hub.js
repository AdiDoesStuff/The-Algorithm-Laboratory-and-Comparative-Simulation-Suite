/*
 * AlgoLab hub renderer.
 *
 * Classic script. Reads window.ALGOLAB_UNITS (js/shell/units.js) and builds
 * the unit cards inside #unit-grid. Progress slots stay empty until B3 wires
 * up localStorage badges. "Test yourself" stays disabled until quizzes land.
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

        var testButton = makeElement("button", "unit-test", "Test yourself");
        testButton.type = "button";
        testButton.disabled = true;
        testButton.title = "Coming with quizzes";
        actions.appendChild(testButton);

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

    function render() {
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

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", render);
    } else {
        render();
    }
})(window, document);

/*
 * glossaryTooltip.js — inline glossary term markers for lesson text.
 *
 * ES module (no build step). Data comes from js/shell/glossaryData.js
 * (window.ALGOLAB_GLOSSARY); this module only renders and positions UI.
 *
 * Marker syntax inside narration / checkpoint text:
 *
 *     "A leaf has {{term:Height|height}} 0."
 *     "Find the in-order {{term:Successor}}."
 *
 * `{{term:Name}}` renders the term's own label. `{{term:Name|label}}` renders a
 * custom label, which keeps prose in lower case. Unknown terms fall back to
 * plain label text (and the content validator flags them before shipping).
 *
 * The popover is a single element appended to <body>, positioned with fixed
 * coordinates and clamped to the viewport, so it is never clipped and cannot
 * cause horizontal overflow at narrow widths.
 */

const MARKER = /\{\{term:([^}|]+)(?:\|([^}]+))?\}\}/g;

let popover = null;
let popoverTerm = null;
let popoverDef = null;
let popoverLink = null;
let activeTrigger = null;
let positionFrame = null;

function glossary() {
    return typeof window !== "undefined" ? window.ALGOLAB_GLOSSARY : null;
}

function lookup(term) {
    const store = glossary();
    if (!store || typeof store.lookup !== "function") return null;
    try {
        return store.lookup(term);
    } catch (error) {
        return null;
    }
}

/** Curated definitions may contain <strong>/<em>; the popover shows plain text. */
function stripTags(value) {
    return String(value)
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

function makeTermRef(entry, label) {
    const wrap = document.createElement("span");
    wrap.className = "glossary-ref";

    const term = document.createElement("span");
    term.className = "glossary-ref-term";
    term.textContent = label;
    wrap.appendChild(term);

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "glossary-ref-toggle";
    toggle.textContent = "?";
    toggle.setAttribute("aria-label", "Glossary: " + entry.term);
    toggle.setAttribute("aria-haspopup", "dialog");
    toggle.setAttribute("aria-expanded", "false");
    toggle.addEventListener("click", (event) => {
        event.preventDefault();
        togglePopover(entry, toggle);
    });
    wrap.appendChild(toggle);

    return wrap;
}

/**
 * Replace `container`'s content with text where {{term:...}} markers become
 * inline term buttons. Plain text nodes are used for everything else, so no
 * narration string is ever parsed as HTML.
 */
export function renderGlossaryText(container, text) {
    if (!container) return;

    if (activeTrigger && container.contains(activeTrigger)) {
        closePopover(false);
    }

    container.textContent = "";

    const source = typeof text === "string" ? text : "";
    if (source === "") return;

    let lastIndex = 0;
    let match;
    MARKER.lastIndex = 0;

    while ((match = MARKER.exec(source)) !== null) {
        if (match.index > lastIndex) {
            container.appendChild(document.createTextNode(source.slice(lastIndex, match.index)));
        }

        const entry = lookup(match[1].trim());
        const label = (match[2] || match[1]).trim();
        if (entry) {
            container.appendChild(makeTermRef(entry, label));
        } else {
            container.appendChild(document.createTextNode(label));
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < source.length) {
        container.appendChild(document.createTextNode(source.slice(lastIndex)));
    }
}

/* --- Popover -------------------------------------------------------------- */

function ensurePopover() {
    if (popover) return popover;

    popover = document.createElement("div");
    popover.className = "glossary-popover";
    popover.id = "glossary-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-modal", "false");
    popover.setAttribute("aria-labelledby", "glossary-popover-term");
    popover.setAttribute("aria-describedby", "glossary-popover-def");
    popover.tabIndex = -1;
    popover.hidden = true;

    const head = document.createElement("div");
    head.className = "glossary-popover-head";

    popoverTerm = document.createElement("p");
    popoverTerm.className = "glossary-popover-term";
    popoverTerm.id = "glossary-popover-term";
    head.appendChild(popoverTerm);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "glossary-popover-close";
    close.textContent = "\u00d7";
    close.setAttribute("aria-label", "Close glossary entry");
    close.addEventListener("click", () => closePopover(true));
    head.appendChild(close);

    popoverDef = document.createElement("p");
    popoverDef.className = "glossary-popover-def";
    popoverDef.id = "glossary-popover-def";

    popoverLink = document.createElement("a");
    popoverLink.className = "glossary-popover-link";
    popoverLink.textContent = "Open in glossary";

    popover.append(head, popoverDef, popoverLink);
    document.body.appendChild(popover);

    popover.addEventListener("focusout", (event) => {
        const next = event.relatedTarget;
        if (next && (popover.contains(next) || next === activeTrigger)) return;

        // relatedTarget can be null for some focus moves (and for a tab that
        // leaves the popover), so re-check where focus actually landed.
        window.setTimeout(() => {
            if (!popover || popover.hidden) return;
            const focused = document.activeElement;
            if (popover.contains(focused) || focused === activeTrigger) return;
            closePopover(false);
        }, 0);
    });

    document.addEventListener("pointerdown", (event) => {
        if (!popover || popover.hidden) return;
        if (popover.contains(event.target) || (activeTrigger && activeTrigger.contains(event.target))) {
            return;
        }
        closePopover(false);
    }, true);

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !popover || popover.hidden) return;
        event.preventDefault();
        closePopover(true);
    }, true);

    const reposition = () => {
        if (!popover || popover.hidden) return;
        if (positionFrame !== null) window.cancelAnimationFrame(positionFrame);
        positionFrame = window.requestAnimationFrame(() => {
            positionFrame = null;
            if (popover && !popover.hidden) positionPopover();
        });
    };

    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    return popover;
}

function positionPopover() {
    if (!popover || !activeTrigger) return;

    const margin = 8;
    const gap = 6;
    const rect = activeTrigger.getBoundingClientRect();
    const width = popover.offsetWidth;
    const height = popover.offsetHeight;
    // clientWidth/clientHeight exclude the scrollbar, so the popover never
    // sits under it at narrow widths.
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = document.documentElement.clientHeight || window.innerHeight;

    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(margin, Math.min(left, viewportWidth - width - margin));

    let top = rect.bottom + gap;
    if (top + height > viewportHeight - margin) {
        const above = rect.top - gap - height;
        if (above >= margin) top = above;
    }
    // Both sides can be off-screen when the trigger is scrolled out of view;
    // clamping keeps the popover readable instead of invisible.
    top = Math.max(margin, Math.min(top, viewportHeight - height - margin));

    popover.style.left = Math.round(left) + "px";
    popover.style.top = Math.round(top) + "px";
}

function togglePopover(entry, trigger) {
    if (activeTrigger === trigger && popover && !popover.hidden) {
        closePopover(true);
        return;
    }
    openPopover(entry, trigger);
}

function openPopover(entry, trigger) {
    ensurePopover();

    if (activeTrigger && activeTrigger !== trigger) {
        activeTrigger.setAttribute("aria-expanded", "false");
    }

    activeTrigger = trigger;
    trigger.setAttribute("aria-expanded", "true");
    trigger.setAttribute("aria-controls", popover.id);

    popoverTerm.textContent = entry.term;
    popoverDef.textContent = stripTags(entry.def);
    popoverLink.href = "definitions.html#term-" + encodeURIComponent(entry.slug);

    popover.hidden = false;
    popover.style.visibility = "hidden";
    positionPopover();
    popover.style.visibility = "";
    popover.focus();
}

function closePopover(restoreFocus) {
    if (!popover || popover.hidden) return;

    const trigger = activeTrigger;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    activeTrigger = null;
    popover.hidden = true;

    if (restoreFocus && trigger && typeof trigger.focus === "function") {
        trigger.focus();
    }
}

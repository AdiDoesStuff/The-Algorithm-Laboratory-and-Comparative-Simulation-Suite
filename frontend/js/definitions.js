// definitions.js — glossary page controller.
//
// Terms come from js/shell/glossaryData.js (window.ALGOLAB_GLOSSARY), the same
// source the inline tooltips use. This file owns only page behaviour:
// rendering, search, the modal, and definitions.html#term-<slug> deep links.

const glossary = window.ALGOLAB_GLOSSARY;
const definitions = glossary && Array.isArray(glossary.terms) ? glossary.terms : [];

const definitionsGrid = document.getElementById('definitions-grid');
const searchInput = document.getElementById('search-input');

// Modal Elements
const overlay = document.getElementById('definition-modal');
const modalTitle = document.getElementById('modal-title');
const modalDef = document.getElementById('modal-def');

let lastTrigger = null;

function prefersReducedMotion() {
    return typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Initialize and Render Pages
function renderCards(filterText = "") {
    if (!definitionsGrid) return;

    definitionsGrid.textContent = "";

    if (!glossary) {
        const message = document.createElement('p');
        message.className = 'glossary-empty';
        message.textContent = 'Glossary data unavailable. Load js/shell/glossaryData.js first.';
        definitionsGrid.appendChild(message);
        return;
    }

    const needle = String(filterText).trim().toLowerCase();
    const filtered = definitions.filter(item =>
        item.term.toLowerCase().includes(needle) ||
        item.def.toLowerCase().includes(needle)
    );

    if (filtered.length === 0) {
        const message = document.createElement('p');
        message.className = 'glossary-empty';
        message.textContent = 'No glossary terms match your search.';
        definitionsGrid.appendChild(message);
        return;
    }

    filtered.forEach((item) => {
        const card = document.createElement('div');
        card.className = `glossary-card ${needle ? 'search-match' : ''}`;
        card.id = `term-${item.slug}`;

        // Keep the raw values on the card; no JSON stringify round-trip.
        card.dataset.term = item.term;
        card.dataset.def = item.def;

        // Cards are interactive, so make them real buttons for keyboards and
        // screen readers rather than click-only divs.
        card.setAttribute('role', 'button');
        card.tabIndex = 0;
        card.setAttribute('aria-label', `${item.term}. Open definition.`);

        const title = document.createElement('h3');
        title.className = 'card-title';
        title.textContent = item.term;
        card.appendChild(title);

        card.addEventListener('click', () => openModal(item.term, item.def, card));
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                event.preventDefault();
                openModal(item.term, item.def, card);
            }
        });

        definitionsGrid.appendChild(card);
    });
}

// Modal Logic
function openModal(term, def, trigger) {
    if (!overlay) return;

    lastTrigger = trigger || null;
    modalTitle.textContent = term;
    modalDef.innerHTML = def; // Curated glossary HTML (<strong>, <em>), never user input.

    // Prevent body bounce/scrolling when modal is open
    document.body.style.overflow = "hidden";

    // Show modal. The .hidden class transitions visibility, which would keep
    // the close button unfocusable for the length of the fade; set visibility
    // explicitly so focus can move into the dialog immediately.
    overlay.style.visibility = "visible";
    overlay.classList.remove('hidden');

    void overlay.offsetWidth;
    const focusTarget = overlay.querySelector('.close-modal');
    const focusClose = () => {
        if (focusTarget && typeof focusTarget.focus === 'function') {
            focusTarget.focus();
        }
    };
    focusClose();
    // Focus calls made while the document is still finishing its load can be
    // dropped; retry once on the next task. Deep links land here.
    window.setTimeout(focusClose, 0);
}

function closeModal() {
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.style.visibility = "";

    // Restore body scrolling
    document.body.style.overflow = "";

    if (lastTrigger && typeof lastTrigger.focus === 'function') {
        lastTrigger.focus({ preventScroll: true });
    }
    lastTrigger = null;
}

function closeModalOnOutsideClick(event) {
    if (event.target === overlay) {
        closeModal();
    }
}

// Keyboard accessible modal closing
window.addEventListener('keydown', (e) => {
    if (e.key === "Escape" && overlay && !overlay.classList.contains('hidden')) {
        closeModal();
    }
});

// Search Logic
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        renderCards(e.target.value);
    });
}

// --- Deep links: definitions.html#term-<slug> ------------------------------

function slugFromHash() {
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw) return null;
    if (raw.indexOf('term-') === 0) return decodeURIComponent(raw.slice(5));
    return decodeURIComponent(raw);
}

/**
 * Highlight the deep-linked card, scroll it into view, and open its
 * definition. Unknown slugs are ignored so a stale link never breaks the page.
 */
function applyHashTarget() {
    if (!glossary || typeof glossary.getBySlug !== 'function') return;

    const slug = slugFromHash();
    if (!slug) return;

    const entry = glossary.getBySlug(slug);
    if (!entry) return;

    const card = document.getElementById(`term-${entry.slug}`);
    if (!card) return;

    card.classList.add('glossary-card--target');
    if (typeof card.scrollIntoView === 'function') {
        card.scrollIntoView({
            block: 'center',
            behavior: prefersReducedMotion() ? 'auto' : 'smooth'
        });
    }
    card.focus({ preventScroll: true });
    openModal(entry.term, entry.def, card);
}

window.addEventListener('hashchange', () => {
    document.querySelectorAll('.glossary-card--target').forEach((card) => {
        card.classList.remove('glossary-card--target');
    });
    applyHashTarget();
});

// Transition specific
function goBack() {
    const pageTransition = document.getElementById('page-transition');
    if (pageTransition) {
        pageTransition.classList.remove('fade-out');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500); // Wait for transition
    } else {
        window.location.href = 'index.html';
    }
}

// Window init
window.onload = () => {
    // Initial Render
    renderCards();
    applyHashTarget();

    // Fade in overlay removal
    const pageTransition = document.getElementById('page-transition');
    if (pageTransition) {
        setTimeout(() => {
            pageTransition.classList.add('fade-out');
        }, 50);
    }
}

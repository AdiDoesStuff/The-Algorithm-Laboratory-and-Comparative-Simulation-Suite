/**
 * utils.js — Shared utilities used across all pages.
 * Include this script FIRST before any other JS on every page.
 */

// Central backend URL — change once here if the server port ever changes.
const BASE_URL = 'http://127.0.0.1:5000';

/**
 * Shared toast notification utility.
 * @param {string} message  - The text to display.
 * @param {'info'|'warning'|'error'} type - Controls colour scheme.
 * @param {number} duration - Auto-dismiss delay in ms (default 5000).
 */
function showToast(message, type = 'info', duration = 5000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-message">${message}</span>
        <button class="toast-dismiss" onclick="this.closest('.toast').remove()" title="Dismiss">&times;</button>
    `;

    container.appendChild(toast);

    // Auto-dismiss
    setTimeout(() => {
        toast.classList.add('toast-hiding');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, duration);
}

function autoPositionComplexityTooltips(root = document, viewportPaddingPx = 10) {
    const targets = root.querySelectorAll?.('.complexity-tooltip');
    if (!targets || targets.length === 0) return;

    const clampShift = (tooltipEl) => {
        const bubble = tooltipEl.querySelector('.complexity-tooltip-bubble');
        if (!bubble) return;

        // Reset before measuring so we don't accumulate shifts.
        bubble.style.setProperty('--tooltip-shift-x', '0px');

        requestAnimationFrame(() => {
            const rect = bubble.getBoundingClientRect();
            const vpW = window.innerWidth || document.documentElement.clientWidth || 0;
            if (!vpW) return;

            let shift = 0;
            const leftOverflow = viewportPaddingPx - rect.left;
            const rightOverflow = rect.right - (vpW - viewportPaddingPx);

            if (leftOverflow > 0) shift += leftOverflow;
            if (rightOverflow > 0) shift -= rightOverflow;

            if (shift !== 0) {
                bubble.style.setProperty('--tooltip-shift-x', `${Math.round(shift)}px`);
            }
        });
    };

    targets.forEach((el) => {
        if (el.dataset.tooltipAutoPosBound === '1') return;
        el.dataset.tooltipAutoPosBound = '1';

        el.addEventListener('mouseenter', () => clampShift(el));
        el.addEventListener('mouseleave', () => {
            const bubble = el.querySelector('.complexity-tooltip-bubble');
            if (bubble) bubble.style.setProperty('--tooltip-shift-x', '0px');
        });
    });
}

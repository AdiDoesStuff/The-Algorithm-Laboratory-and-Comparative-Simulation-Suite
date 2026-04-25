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

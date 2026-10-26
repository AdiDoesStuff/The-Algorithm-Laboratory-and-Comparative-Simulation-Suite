/*
 * AlgoLab shared navigation.
 *
 * Classic script (no build step). Load after js/shell/units.js:
 *
 *     <script src="js/shell/units.js"></script>
 *     <script src="js/shell/nav.js"></script>
 *
 * Auto-mounts into any element carrying data-algo-nav:
 *
 *     <div id="algo-nav" data-algo-nav data-current-id="sorting"></div>
 *
 * Or mount explicitly:
 *
 *     window.AlgoLabNav.mount(document.getElementById("algo-nav"), {
 *         currentId: "sorting"
 *     });
 *
 * Exposes: window.AlgoLabNav
 */
(function (window, document) {
    "use strict";

    /* Inline SVG icons copied from the existing page navigation. */
    var ICONS = {
        sorting: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>',
        pathfinding: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
        bst: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><circle cx="6" cy="19" r="3"/><circle cx="18" cy="19" r="3"/><line x1="10.5" y1="7.5" x2="7.5" y2="16.5"/><line x1="13.5" y1="7.5" x2="16.5" y2="16.5"/></svg>',
        heaps: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="4" rx="1"/><rect x="6" y="10" width="12" height="4" rx="1"/><rect x="8" y="16" width="8" height="4" rx="1"/></svg>',
        avl: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6" r="2.5"/><circle cx="6" cy="17" r="2.5"/><circle cx="18" cy="17" r="2.5"/><line x1="10.4" y1="8.2" x2="7.2" y2="14.8"/><line x1="13.6" y1="8.2" x2="16.8" y2="14.8"/><path d="M18 4a6 6 0 0 1 1.5 5.5"/></svg>',
        trie: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2.5"/><circle cx="6" cy="20" r="2.5"/><circle cx="18" cy="20" r="2.5"/><line x1="12" y1="6.5" x2="12" y2="12"/><line x1="12" y1="12" x2="6" y2="17.5"/><line x1="12" y1="12" x2="18" y2="17.5"/></svg>',
        hash: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="15" width="7" height="5" rx="1"/><rect x="14" y="15" width="7" height="5" rx="1"/><path d="M6.5 7.5h0"/></svg>',
        trie: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2.5"/><circle cx="6" cy="20" r="2.5"/><circle cx="18" cy="20" r="2.5"/><line x1="12" y1="6.5" x2="12" y2="12"/><line x1="12" y1="12" x2="6" y2="17.5"/><line x1="12" y1="12" x2="18" y2="17.5"/></svg>',
        hash: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="15" width="7" height="5" rx="1"/><rect x="14" y="15" width="7" height="5" rx="1"/><path d="M6.5 7.5h0"/></svg>',
        merkle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="4" rx="1"/><rect x="3" y="10" width="6" height="4" rx="1"/><rect x="15" y="10" width="6" height="4" rx="1"/><rect x="3" y="19" width="6" height="3" rx="1"/><rect x="15" y="19" width="6" height="3" rx="1"/><line x1="12" y1="6" x2="6" y2="10"/><line x1="12" y1="6" x2="18" y2="10"/><line x1="6" y1="14" x2="6" y2="19"/><line x1="18" y1="14" x2="18" y2="19"/></svg>',
        growth: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>',
        knapsack: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a4 4 0 0 1 8 0v2"/></svg>',
        nqueens: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/><circle cx="10" cy="16" r="1.5" fill="currentColor"/></svg>',
        definitions: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>'
    };

    /* Existing unit colours. Home and Definitions use the established accents. */
    var UNIT_STYLE = {
        sorting: {
            gradient: "linear-gradient(135deg, #f97316, #ea580c)",
            shadow: "rgba(234, 88, 12, 0.45)"
        },
        pathfinding: {
            gradient: "linear-gradient(135deg, #06b6d4, #0891b2)",
            shadow: "rgba(6, 182, 212, 0.4)"
        },
        bst: {
            gradient: "linear-gradient(135deg, #a855f7, #7e22ce)",
            shadow: "rgba(168, 85, 247, 0.4)"
        },
        heaps: {
            gradient: "linear-gradient(135deg, #10b981, #059669)",
            shadow: "rgba(16, 185, 129, 0.4)"
        },
        avl: {
            gradient: "linear-gradient(135deg, #f43f5e, #be123c)",
            shadow: "rgba(244, 63, 94, 0.4)"
        }
    };

    var HOME_ROUTE = {
        id: "home",
        title: "Home",
        page: "index.html",
        icon: "",
        gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
        shadow: "rgba(59, 130, 246, 0.35)"
    };

    var DEFINITIONS_ROUTE = {
        id: "definitions",
        title: "Definitions",
        page: "definitions.html",
        icon: ICONS.definitions,
        gradient: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
        shadow: "rgba(139, 92, 246, 0.4)"
    };

    function buildRoutes() {
        var units = window.ALGOLAB_UNITS;
        if (!Array.isArray(units)) {
            throw new Error(
                "AlgoLabNav: window.ALGOLAB_UNITS is missing. Load js/shell/units.js before js/shell/nav.js."
            );
        }

        var routes = [HOME_ROUTE];

        units.forEach(function (unit) {
            if (unit.status !== "live") {
                return;
            }
            var style = UNIT_STYLE[unit.id] || {};
            routes.push({
                id: unit.id,
                title: unit.title,
                page: unit.page,
                icon: ICONS[unit.id] || "",
                gradient: style.gradient || HOME_ROUTE.gradient,
                shadow: style.shadow || HOME_ROUTE.shadow
            });
        });

        routes.push(DEFINITIONS_ROUTE);
        return routes;
    }

    function createLink(route, currentId) {
        var link = document.createElement("a");
        link.className = "algo-nav-link";
        link.href = route.page;
        link.setAttribute("data-route-id", route.id);
        link.style.setProperty("--nav-gradient", route.gradient);
        link.style.setProperty("--nav-shadow", route.shadow);

        if (route.icon) {
            var icon = document.createElement("span");
            icon.className = "algo-nav-icon";
            icon.setAttribute("aria-hidden", "true");
            icon.innerHTML = route.icon;
            link.appendChild(icon);
        }

        var label = document.createElement("span");
        label.className = "algo-nav-label";
        label.textContent = route.title;
        link.appendChild(label);

        if (route.id === currentId) {
            link.setAttribute("aria-current", "page");
        }

        return link;
    }

    function mount(container, options) {
        var target = container;

        if (typeof target === "string") {
            target = document.querySelector(target);
        }

        if (!target) {
            throw new Error("AlgoLabNav.mount: container not found.");
        }

        options = options || {};
        var currentId = options.currentId || target.getAttribute("data-current-id") || "";

        var nav = document.createElement("nav");
        nav.className = "algo-nav";
        nav.setAttribute("aria-label", "Primary");

        var list = document.createElement("ul");
        list.className = "algo-nav-list";

        buildRoutes().forEach(function (route) {
            var item = document.createElement("li");
            item.className = "algo-nav-item";
            item.appendChild(createLink(route, currentId));
            list.appendChild(item);
        });

        nav.appendChild(list);
        target.textContent = "";
        target.appendChild(nav);

        return nav;
    }

    function mountAll() {
        var containers = document.querySelectorAll("[data-algo-nav]");

        Array.prototype.forEach.call(containers, function (container) {
            if (container.getAttribute("data-algo-nav-mounted") === "true") {
                return;
            }
            mount(container, {
                currentId: container.getAttribute("data-current-id") || ""
            });
            container.setAttribute("data-algo-nav-mounted", "true");
        });
    }

    window.AlgoLabNav = {
        mount: mount,
        mountAll: mountAll,
        routes: buildRoutes
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", mountAll);
    } else {
        mountAll();
    }
})(window, document);

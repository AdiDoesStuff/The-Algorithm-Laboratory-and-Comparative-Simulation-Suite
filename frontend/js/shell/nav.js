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

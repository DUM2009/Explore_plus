// Adaptação vanilla JS/CSS do componente React "AnimatedTabs" para o cabeçalho do Explore+.
// Não há Next.js/shadcn/Tailwind/TypeScript no projeto, por isso o comportamento
// (indicador em pílula que desliza sobre o separador ativo/em hover) foi reescrito
// para funcionar num site multi-página em HTML/CSS/JS puro.
// Usa delegação de eventos e um MutationObserver porque o auth.js injeta
// dinamicamente os itens "Perfil" e "Sair" depois do carregamento inicial.

(function () {
    function currentPageName() {
        return (location.pathname.split("/").pop() || "index.html").toLowerCase();
    }

    function setupNavTabs(nav) {
        const indicator = document.createElement("span");
        indicator.className = "nav-tabs-indicator";
        nav.insertBefore(indicator, nav.firstChild);

        let activeTab = null;

        function getTabs() {
            return Array.from(nav.querySelectorAll("a, button"));
        }

        function findActiveTab() {
            const page = currentPageName();
            return (
                getTabs().find((tab) => (tab.getAttribute("href") || "").toLowerCase() === page) ||
                null
            );
        }

        function moveIndicatorTo(tab) {
            if (!tab) {
                indicator.classList.remove("is-visible");
                return;
            }
            indicator.style.left = tab.offsetLeft + "px";
            indicator.style.width = tab.offsetWidth + "px";
            indicator.classList.toggle("is-danger", tab.dataset.tabVariant === "danger");
            indicator.classList.add("is-visible");
        }

        function clearHighlights() {
            getTabs().forEach((tab) => tab.classList.remove("nav-tab-hover"));
        }

        function resetToActive() {
            clearHighlights();
            activeTab = findActiveTab();
            getTabs().forEach((tab) => tab.classList.toggle("nav-tab-active", tab === activeTab));
            moveIndicatorTo(activeTab);
        }

        function highlight(tab) {
            clearHighlights();
            if (tab !== activeTab) tab.classList.add("nav-tab-hover");
            moveIndicatorTo(tab);
        }

        nav.addEventListener("mouseover", (event) => {
            const tab = event.target.closest("a, button");
            if (tab && nav.contains(tab)) highlight(tab);
        });

        nav.addEventListener("focusin", (event) => {
            const tab = event.target.closest("a, button");
            if (tab && nav.contains(tab)) highlight(tab);
        });

        nav.addEventListener("mouseleave", resetToActive);

        nav.addEventListener("focusout", (event) => {
            if (!nav.contains(event.relatedTarget)) resetToActive();
        });

        // Re-sincroniza sempre que "Perfil"/"Sair" (auth.js) são adicionados ou removidos
        new MutationObserver(resetToActive).observe(nav, { childList: true });

        resetToActive();
        window.addEventListener("resize", resetToActive);
    }

    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll("header nav").forEach(setupNavTabs);
    });
})();

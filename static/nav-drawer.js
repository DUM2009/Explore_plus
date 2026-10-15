(function () {
    const toggle = document.getElementById('navDrawerToggle');
    // Pages with the old brown off-canvas menu use #navDrawer; pages that
    // reuse the profile page's white sidebar (e.g. Missões) toggle
    // #profileSidebar/#sidebarOverlay instead — same toggle button either way.
    const drawer = document.getElementById('navDrawer') || document.getElementById('profileSidebar');
    const overlay = document.getElementById('navDrawerOverlay') || document.getElementById('sidebarOverlay');
    const closeBtn = document.getElementById('navDrawerClose');
    if (!toggle || !drawer || !overlay) return;

    const isDesktopSidebar = () => drawer.id === 'profileSidebar' && window.matchMedia('(min-width: 981px)').matches;

    function setOpen(isOpen) {
        drawer.classList.toggle('is-open', isOpen);
        drawer.setAttribute('aria-hidden', String(!isOpen));
        overlay.toggleAttribute('hidden', !isOpen);
        // The off-canvas drawer only overlays the viewport — it doesn't stop
        // a touch-drag over the overlay from scrolling whatever's behind it
        // (the real scrollable element, e.g. .profile-main-shell, isn't an
        // ancestor of the overlay). Locking the page itself while open is
        // the only way to actually block that.
        document.documentElement.classList.toggle('nav-drawer-open', isOpen);
        document.body.classList.toggle('nav-drawer-open', isOpen);
    }

    // On desktop, #profileSidebar is open by default (no class needed) and
    // stays that way until the user collapses it — a class on the layout
    // wrapper (not the sidebar itself) drives that, separate from the
    // mobile off-canvas .is-open toggle below.
    function setCollapsed(isCollapsed) {
        const layout = drawer.closest('.profile-layout');
        layout?.classList.toggle('is-sidebar-collapsed', isCollapsed);
    }

    toggle.addEventListener('click', () => {
        if (isDesktopSidebar()) {
            const layout = drawer.closest('.profile-layout');
            setCollapsed(!layout?.classList.contains('is-sidebar-collapsed'));
        } else {
            setOpen(!drawer.classList.contains('is-open'));
        }
    });

    overlay.addEventListener('click', () => setOpen(false));
    closeBtn?.addEventListener('click', () => setOpen(false));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            setOpen(false);
            setCollapsed(false);
        }
    });
})();

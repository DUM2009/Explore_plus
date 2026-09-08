(function () {
    const btn = document.getElementById('subjectSwitcherBtn');
    const menu = document.getElementById('subjectSwitcherMenu');
    if (!btn || !menu) return;

    btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isOpen));
        menu.hidden = isOpen;
    });

    document.addEventListener('click', (event) => {
        if (!menu.hidden && !menu.contains(event.target) && !btn.contains(event.target)) {
            menu.hidden = true;
            btn.setAttribute('aria-expanded', 'false');
        }
    });
})();

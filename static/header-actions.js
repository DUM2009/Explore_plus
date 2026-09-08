// Wires up the notification bell + light/dark toggle in the page header.
// Shared by pages that don't already load profile-django.js/perfil.js
// (which wire the same two elements for the sidebar layout).
(function () {
    const THEME_KEY = 'explore-theme';
    const themeToggleBtns = document.querySelectorAll('.theme-toggle-btn');
    const notificationsBtn = document.getElementById('notificationsBtn');
    const notificationsPanel = document.getElementById('notificationsPanel');

    function applyTheme(theme) {
        document.documentElement.classList.toggle('dark-mode', theme === 'dark');
        themeToggleBtns.forEach((btn) => {
            btn.setAttribute('aria-pressed', String(theme === 'dark'));
            btn.setAttribute('aria-label', theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro');
        });
    }

    let initialTheme = 'light';
    try {
        initialTheme = localStorage.getItem(THEME_KEY) || 'light';
    } catch (error) {
        // Private browsing / storage disabled — default to light.
    }
    applyTheme(initialTheme);

    themeToggleBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const nextTheme = document.documentElement.classList.contains('dark-mode') ? 'light' : 'dark';
            applyTheme(nextTheme);
            try {
                localStorage.setItem(THEME_KEY, nextTheme);
            } catch (error) {
                // Ignore storage errors (private browsing, quota).
            }
        });
    });

    notificationsBtn?.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = !notificationsPanel.hidden;
        notificationsPanel.hidden = isOpen;
        notificationsBtn.setAttribute('aria-expanded', String(!isOpen));
    });

    document.addEventListener('click', (event) => {
        if (notificationsPanel && !notificationsPanel.hidden && !notificationsPanel.contains(event.target) && event.target !== notificationsBtn) {
            notificationsPanel.hidden = true;
            notificationsBtn?.setAttribute('aria-expanded', 'false');
        }
    });
})();

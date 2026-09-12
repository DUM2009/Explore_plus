/**
 * Shared "Comentários da mascote" preference — ativado por defeito.
 * Stored client-side (like the theme toggle) so it applies instantly
 * everywhere the mascot could speak, without needing a server round-trip.
 */
(function () {
    const STORAGE_KEY = 'explore_mascote_comentarios';

    function isEnabled() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw === null ? true : raw === '1';
        } catch (error) {
            return true;
        }
    }

    function setEnabled(enabled) {
        try {
            localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
        } catch (error) {
            // Ignore storage errors (private browsing) — the choice just
            // won't be remembered for next time.
        }
        window.dispatchEvent(new CustomEvent('explore:mascot-prefs-changed', { detail: { enabled } }));
    }

    window.MascotPrefs = { STORAGE_KEY, isEnabled, setEnabled };
})();

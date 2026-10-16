/**
 * Shared "Animações" preference — ativado por defeito. Mesma técnica do
 * tema escuro/claro: aplica-se já aqui (síncrono, antes do resto da página
 * carregar) para não haver um instante de animações a acontecer antes do
 * JS "apanhar" a preferência guardada.
 */
(function () {
    const STORAGE_KEY = 'explore_animacoes';

    function isEnabled() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw === null ? true : raw === '1';
        } catch (error) {
            return true;
        }
    }

    function apply(enabled) {
        document.documentElement.classList.toggle('no-animations', !enabled);
    }

    function setEnabled(enabled) {
        try {
            localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
        } catch (error) {
            // Ignora erros de armazenamento (navegação privada) — a escolha
            // só não fica guardada para a próxima vez.
        }
        apply(enabled);
        window.dispatchEvent(new CustomEvent('explore:animation-prefs-changed', { detail: { enabled } }));
    }

    apply(isEnabled());

    window.AnimationPrefs = { STORAGE_KEY, isEnabled, setEnabled };
})();

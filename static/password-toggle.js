// Mostrar/ocultar palavra-passe nos campos marcados com .olho — ver
// Templates/signup.html. Ficheiro à parte de script.js (que arrasta
// dependências do Firebase e não está incluído nesta página) para não
// interferir com o submit real do formulário, que é tratado pelo Django.
document.addEventListener('DOMContentLoaded', () => {
    function bindToggle(toggleId, inputId) {
        const toggle = document.getElementById(toggleId);
        const input = document.getElementById(inputId);
        if (!toggle || !input) return;

        function setVisible(visible) {
            input.type = visible ? 'text' : 'password';
            toggle.classList.toggle('is-visible', visible);
            toggle.setAttribute('aria-label', visible ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe');
        }

        toggle.addEventListener('click', () => setVisible(input.type === 'password'));
        toggle.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setVisible(input.type === 'password');
            }
        });
    }

    bindToggle('olhoPassword', 'password');
    bindToggle('olhoConfirmar', 'confirmarPassword');
});

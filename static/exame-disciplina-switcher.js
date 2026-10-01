(function () {
    const switcher = document.getElementById('exameDisciplinaSwitcher');
    const grid = document.getElementById('exameMissionsGrid');
    const vazio = document.getElementById('exameDisciplinaVazio');
    if (!switcher || !grid) return;

    const opcoes = switcher.querySelectorAll('.ano-switcher-option');
    const cartoes = grid.querySelectorAll('.mission-card[data-disciplina]');

    function selecionarDisciplina(disciplina) {
        let algumVisivel = false;
        cartoes.forEach((cartao) => {
            const visivel = cartao.dataset.disciplina === disciplina;
            cartao.hidden = !visivel;
            if (visivel) algumVisivel = true;
        });
        opcoes.forEach((opcao) => {
            opcao.classList.toggle('is-active', opcao.dataset.disciplina === disciplina);
        });
        grid.hidden = !algumVisivel;
        if (vazio) vazio.hidden = algumVisivel;
    }

    opcoes.forEach((opcao) => {
        opcao.addEventListener('click', () => selecionarDisciplina(opcao.dataset.disciplina));
    });
})();

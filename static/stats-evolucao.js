(function () {
    const modoBtn = document.getElementById('statsEvolucaoModoBtn');
    const modoMenu = document.getElementById('statsEvolucaoModoMenu');
    const modoLabel = document.getElementById('statsEvolucaoModoLabel');
    const chart = document.getElementById('statsEvolucaoChart');
    const dadosEl = document.getElementById('statsEvolucaoDados');
    if (!modoBtn || !modoMenu || !chart || !dadosEl) return;

    let periodos;
    try {
        periodos = JSON.parse(dadosEl.textContent);
    } catch (erro) {
        return;
    }

    const mensagensVazio = {
        teste: 'Ainda não corrigiste nenhum teste — assim que o fizeres, a tua evolução aparece aqui.',
        exame: 'Ainda não corrigiste nenhum exame — assim que o fizeres, a tua evolução aparece aqui.',
    };

    function renderizar(modo) {
        const dados = periodos[modo] || { pontos: [], coords: '' };
        if (dados.pontos.length === 0) {
            chart.innerHTML = `<p class="stats-empty">${mensagensVazio[modo] || 'Ainda não há dados.'}</p>`;
            return;
        }

        const primeiro = dados.pontos[0];
        const ultimo = dados.pontos[dados.pontos.length - 1];
        chart.innerHTML = `
            <div class="stats-chart">
                <div class="stats-chart-yaxis">
                    <span>20</span>
                    <span>10</span>
                    <span>0</span>
                </div>
                <svg class="stats-chart-svg" viewBox="0 0 300 100" preserveAspectRatio="none">
                    <line x1="0" y1="0" x2="300" y2="0" class="stats-chart-gridline"/>
                    <line x1="0" y1="50" x2="300" y2="50" class="stats-chart-gridline"/>
                    <line x1="0" y1="100" x2="300" y2="100" class="stats-chart-gridline"/>
                    <polyline points="${dados.coords}" class="stats-chart-line"/>
                </svg>
            </div>
            <div class="stats-chart-labels">
                <span>${primeiro.label}</span>
                <span>${ultimo.label}</span>
            </div>
        `;
    }

    modoBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = modoBtn.getAttribute('aria-expanded') === 'true';
        modoBtn.setAttribute('aria-expanded', String(!isOpen));
        modoMenu.hidden = isOpen;
    });

    document.addEventListener('click', (event) => {
        if (!modoMenu.hidden && !modoMenu.contains(event.target) && !modoBtn.contains(event.target)) {
            modoMenu.hidden = true;
            modoBtn.setAttribute('aria-expanded', 'false');
        }
    });

    modoMenu.addEventListener('click', (event) => {
        const opcao = event.target.closest('[data-modo]');
        if (!opcao) return;

        modoMenu.querySelectorAll('[data-modo]').forEach((span) => span.classList.remove('is-active'));
        opcao.classList.add('is-active');
        if (modoLabel) modoLabel.textContent = opcao.textContent.trim();
        modoMenu.hidden = true;
        modoBtn.setAttribute('aria-expanded', 'false');

        renderizar(opcao.dataset.modo);
    });
})();

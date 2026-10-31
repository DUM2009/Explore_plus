(function () {
    const disciplinaBtn = document.getElementById('statsEvolucaoDisciplinaBtn');
    const disciplinaMenu = document.getElementById('statsEvolucaoDisciplinaMenu');
    const disciplinaLabel = document.getElementById('statsEvolucaoDisciplinaLabel');
    const fonteWrap = document.getElementById('statsEvolucaoFonte');
    const fonteBtn = document.getElementById('statsEvolucaoFonteBtn');
    const fonteMenu = document.getElementById('statsEvolucaoFonteMenu');
    const fonteLabel = document.getElementById('statsEvolucaoFonteLabel');
    const chart = document.getElementById('statsEvolucaoChart');
    const dadosEl = document.getElementById('statsEvolucaoDados');
    if (!disciplinaBtn || !disciplinaMenu || !chart || !dadosEl) return;

    let periodos;
    try {
        periodos = JSON.parse(dadosEl.textContent);
    } catch (erro) {
        return;
    }

    // Disciplinas avaliadas só por exame (par de disciplinas) — sem
    // "Fonte de Dados", o exame já é a única fonte.
    const disciplinasExame = new Set(['bg_exames', 'fq_exames']);

    let disciplinaAtual = 'biologia';
    let fonteAtual = 'geral';

    function chaveAtual() {
        return disciplinasExame.has(disciplinaAtual)
            ? disciplinaAtual
            : `${disciplinaAtual}_${fonteAtual}`;
    }

    function mensagemVazia() {
        if (disciplinaAtual === 'bg_exames') {
            return 'Ainda não corrigiste nenhum exame de Biologia e Geologia — assim que o fizeres, a tua evolução aparece aqui.';
        }
        if (disciplinaAtual === 'fq_exames') {
            return 'Ainda não corrigiste nenhum exame de Física e Química — assim que o fizeres, a tua evolução aparece aqui.';
        }
        if (fonteAtual === 'simulado') {
            return 'Ainda não fizeste nenhum simulado — assim que o fizeres, a tua evolução aparece aqui.';
        }
        return 'Ainda não corrigiste nenhum teste — assim que o fizeres, a tua evolução aparece aqui.';
    }

    function renderizar() {
        const dados = periodos[chaveAtual()] || { pontos: [], coords: '' };
        if (dados.pontos.length === 0) {
            chart.innerHTML = `<p class="stats-empty">${mensagemVazia()}</p>`;
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

    function bindDropdown(btn, menu, onEscolher) {
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

        menu.addEventListener('click', (event) => {
            const opcao = event.target.closest('button');
            if (!opcao) return;

            menu.querySelectorAll('button').forEach((item) => item.classList.remove('is-active'));
            opcao.classList.add('is-active');
            menu.hidden = true;
            btn.setAttribute('aria-expanded', 'false');

            onEscolher(opcao);
        });
    }

    // Arranca na disciplina escolhida em "Explore X" (e não sempre em Biologia).
    const disciplinaInicial = {
        biology: 'biologia', geology: 'geologia', physics: 'fisica', chemistry: 'quimica',
    }[window.exploreDisciplinaAtual];
    const opcaoInicial = disciplinaInicial
        && disciplinaMenu.querySelector(`[data-disciplina="${disciplinaInicial}"]`);
    if (opcaoInicial) {
        disciplinaAtual = disciplinaInicial;
        disciplinaMenu.querySelectorAll('button').forEach((item) => item.classList.remove('is-active'));
        opcaoInicial.classList.add('is-active');
        if (disciplinaLabel) disciplinaLabel.textContent = opcaoInicial.textContent.trim();
        renderizar();
    }

    bindDropdown(disciplinaBtn, disciplinaMenu, (opcao) => {
        disciplinaAtual = opcao.dataset.disciplina;
        if (disciplinaLabel) disciplinaLabel.textContent = opcao.textContent.trim();
        if (fonteWrap) fonteWrap.hidden = disciplinasExame.has(disciplinaAtual);
        renderizar();
    });

    if (fonteBtn && fonteMenu) {
        bindDropdown(fonteBtn, fonteMenu, (opcao) => {
            fonteAtual = opcao.dataset.fonte;
            if (fonteLabel) fonteLabel.textContent = opcao.textContent.trim();
            renderizar();
        });
    }
})();

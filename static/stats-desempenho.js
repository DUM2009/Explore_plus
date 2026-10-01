(function () {
    const modoBtn = document.getElementById('statsDesempenhoModoBtn');
    const modoMenu = document.getElementById('statsDesempenhoModoMenu');
    const modoLabel = document.getElementById('statsDesempenhoModoLabel');
    const chart = document.getElementById('statsDesempenhoChart');
    const dadosEl = document.getElementById('statsDesempenhoDados');
    if (!modoBtn || !modoMenu || !chart || !dadosEl) return;

    let periodos;
    try {
        periodos = JSON.parse(dadosEl.textContent);
    } catch (erro) {
        return;
    }

    function renderizarVazio(mensagem) {
        chart.innerHTML = `<p class="stats-empty">${mensagem}</p>`;
    }

    function renderizarBarras(pontos) {
        chart.innerHTML = '';
        pontos.forEach((ponto) => {
            const col = document.createElement('div');
            col.className = 'stats-tempo-col';
            col.innerHTML = `
                <span class="stats-tempo-valor">${ponto.valor_label}</span>
                <span class="stats-tempo-bar" style="height: ${ponto.percent}%; background: ${ponto.cor};"></span>
                <span class="stats-tempo-label">${ponto.label}</span>
            `;
            chart.appendChild(col);
        });
    }

    function renderizar(modo) {
        const pontos = periodos[modo] || [];
        if (pontos.length === 0) {
            renderizarVazio('Ainda não há dados para mostrar.');
            return;
        }
        renderizarBarras(pontos);
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

(function () {
    const tabs = document.getElementById('statsTempoTabs');
    const chart = document.getElementById('statsTempoChart');
    const titulo = document.getElementById('statsTempoTitle');
    const dadosEl = document.getElementById('statsTempoPeriodos');
    if (!tabs || !chart || !dadosEl) return;

    let periodos;
    try {
        periodos = JSON.parse(dadosEl.textContent);
    } catch (erro) {
        return;
    }

    const titulos = {
        '7d': 'Tempo de estudo — esta semana',
        '30d': 'Tempo de estudo — últimos 30 dias',
        'sempre': 'Tempo de estudo — desde sempre',
    };

    const PERIODOS_EM_LINHA = new Set(['30d']);

    function renderizarVazio() {
        chart.innerHTML = '<p class="stats-empty">Ainda não há registos de estudo neste período.</p>';
    }

    function renderizarBarras(pontos) {
        chart.className = 'stats-tempo-chart';
        pontos.forEach((ponto) => {
            const col = document.createElement('div');
            col.className = 'stats-tempo-col';
            col.innerHTML = `
                <span class="stats-tempo-valor">${ponto.valor_label}</span>
                <span class="stats-tempo-bar" style="height: ${ponto.percent}%"></span>
                <span class="stats-tempo-label">${ponto.label}</span>
            `;
            chart.appendChild(col);
        });
    }

    function renderizarLinha(pontos) {
        chart.className = 'stats-linha-chart';

        const plot = document.createElement('div');
        plot.className = 'stats-linha-plot';

        const passo = pontos.length > 1 ? 300 / (pontos.length - 1) : 0;
        const svgPontos = pontos
            .map((ponto, i) => `${(i * passo).toFixed(1)},${(100 - ponto.percent).toFixed(1)}`)
            .join(' ');

        plot.innerHTML = `
            <svg class="stats-chart-svg" viewBox="0 0 300 100" preserveAspectRatio="none">
                <line x1="0" y1="0" x2="300" y2="0" class="stats-chart-gridline"/>
                <line x1="0" y1="50" x2="300" y2="50" class="stats-chart-gridline"/>
                <line x1="0" y1="100" x2="300" y2="100" class="stats-chart-gridline"/>
                <polyline points="${svgPontos}" class="stats-chart-line"/>
            </svg>
        `;

        pontos.forEach((ponto, i) => {
            const esquerda = pontos.length > 1 ? (i / (pontos.length - 1)) * 100 : 50;
            const dot = document.createElement('span');
            dot.className = 'stats-linha-dot';
            dot.style.left = `${esquerda}%`;
            dot.style.bottom = `${ponto.percent}%`;
            dot.title = `${ponto.label}: ${ponto.valor_label}`;
            plot.appendChild(dot);
        });

        chart.appendChild(plot);

        const labels = document.createElement('div');
        labels.className = 'stats-chart-labels stats-linha-labels';
        labels.innerHTML = `<span>${pontos[0].label}</span><span>${pontos[pontos.length - 1].label}</span>`;
        chart.appendChild(labels);
    }

    function renderizar(periodo) {
        const pontos = periodos[periodo] || [];
        chart.innerHTML = '';

        if (pontos.length === 0) {
            chart.className = 'stats-tempo-chart';
            renderizarVazio();
            return;
        }

        if (PERIODOS_EM_LINHA.has(periodo)) {
            renderizarLinha(pontos);
        } else {
            renderizarBarras(pontos);
        }
    }

    tabs.addEventListener('click', (event) => {
        const alvo = event.target.closest('[data-periodo]');
        if (!alvo) return;

        tabs.querySelectorAll('[data-periodo]').forEach((span) => span.classList.remove('active'));
        alvo.classList.add('active');

        if (titulo) {
            titulo.textContent = titulos[alvo.dataset.periodo] || titulo.textContent;
        }
        renderizar(alvo.dataset.periodo);
    });
})();

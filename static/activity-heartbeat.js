/**
 * Regista tempo de estudo em qualquer página da plataforma (para "Hábitos
 * de estudo" e os gráficos de tempo de estudo nas Estatísticas) — um ping
 * por minuto, só enquanto o separador estiver mesmo visível E o aluno
 * tiver interagido (rato, teclado, scroll ou toque) nos últimos 5
 * minutos. Sem isto, deixar uma página aberta e esquecida faria o
 * temporizador contar tempo indefinidamente, o que não seria tempo de
 * estudo real.
 *
 * Precisa de window.exploreActivityHeartbeatUrl e window.exploreCsrfToken
 * definidos na página (ver Templates/*.html). Nas páginas de missão
 * (missao.html), este heartbeat já é feito pelo próprio missao-engine.js,
 * por isso este ficheiro não deve ser incluído aí também.
 */
(function () {
    'use strict';

    if (!window.exploreActivityHeartbeatUrl) return;

    const LIMITE_INATIVIDADE_MS = 5 * 60 * 1000;
    let ultimaInteracao = Date.now();
    const marcarInteracao = () => { ultimaInteracao = Date.now(); };
    ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'].forEach((evento) => {
        window.addEventListener(evento, marcarInteracao, { passive: true });
    });

    const enviarPing = () => {
        if (document.visibilityState !== 'visible') return;
        if (Date.now() - ultimaInteracao > LIMITE_INATIVIDADE_MS) return;
        fetch(window.exploreActivityHeartbeatUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.exploreCsrfToken || '' },
            body: JSON.stringify({ minutos: 1 }),
        }).catch(() => {});
    };
    setInterval(enviarPing, 60000);
})();

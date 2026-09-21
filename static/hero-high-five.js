(function () {
    'use strict';

    const root = document.getElementById('heroHifive');
    const hotspot = document.getElementById('heroHifiveHotspot');
    const bubble = document.getElementById('heroHifiveBubble');
    const fx = document.getElementById('heroHifiveFx');
    if (!root || !hotspot || !bubble || !fx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctaUrl = bubble.dataset.ctaUrl || '/login/';
    const sparkSymbols = ['✨', '⭐', '🌿', '💚', '🧬'];

    // Momento do impacto dentro da animação (38% de 0.8s) e tempo até o Kim
    // voltar à pose "pronto?" se ninguém clicar em nada.
    const IMPACT_MS = 300;
    const RESET_AFTER_MS = 9000;

    let impactTimer = null;
    let resetTimer = null;
    let resetAnimTimer = null;
    let cheerTimer = null;

    function pop() {
        bubble.classList.remove('is-pop');
        void bubble.offsetWidth;
        bubble.classList.add('is-pop');
    }

    function showReadyText() {
        bubble.classList.remove('is-cta', 'is-pop');
        bubble.textContent = 'Pronto?';
    }

    function showCta() {
        bubble.textContent = '';
        const link = document.createElement('a');
        link.className = 'hero-hifive-cta';
        link.href = ctaUrl;
        link.textContent = 'Que comece a aventura! →';
        bubble.appendChild(link);
        bubble.classList.add('is-cta');
        pop();
    }

    function burst() {
        if (reduceMotion) return;

        const ring = document.createElement('span');
        ring.className = 'hifive-ring';
        fx.appendChild(ring);
        ring.addEventListener('animationend', () => ring.remove());

        const total = 12;
        for (let i = 0; i < total; i++) {
            const angle = (Math.PI * 2 * i) / total + (Math.random() - 0.5) * 0.5;
            const distance = 45 + Math.random() * 75;
            const spark = document.createElement('span');
            spark.className = 'hifive-spark';
            spark.textContent = sparkSymbols[Math.floor(Math.random() * sparkSymbols.length)];
            spark.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
            spark.style.setProperty('--dy', `${Math.sin(angle) * distance}px`);
            spark.style.setProperty('--rot', `${Math.round((Math.random() - 0.5) * 120)}deg`);
            fx.appendChild(spark);
            spark.addEventListener('animationend', () => spark.remove());
        }
    }

    function cheer() {
        if (reduceMotion) return;
        root.classList.remove('is-cheer');
        void root.offsetWidth;
        root.classList.add('is-cheer');
        clearTimeout(cheerTimer);
        cheerTimer = setTimeout(() => root.classList.remove('is-cheer'), 1000);
    }

    function impact() {
        burst();
        cheer();
        showCta();
        if (navigator.vibrate) navigator.vibrate(25);
        resetTimer = setTimeout(backToReady, RESET_AFTER_MS);
    }

    function backToReady() {
        root.classList.remove('is-hit');
        showReadyText();
        if (reduceMotion) {
            root.classList.remove('is-clapped');
            return;
        }
        root.classList.add('is-reset');
        root.classList.remove('is-clapped');
        clearTimeout(resetAnimTimer);
        resetAnimTimer = setTimeout(() => root.classList.remove('is-reset'), 700);
    }

    root.addEventListener('animationend', (event) => {
        if (event.target.classList.contains('hifive-kim') && event.animationName === 'hifive-kim-slap') {
            root.classList.remove('is-hit');
        }
    });

    hotspot.addEventListener('click', () => {
        clearTimeout(impactTimer);
        clearTimeout(resetTimer);
        clearTimeout(resetAnimTimer);

        root.classList.add('is-touched', 'is-clapped');
        root.classList.remove('is-reset');
        showReadyText();

        if (reduceMotion) {
            impact();
            return;
        }

        root.classList.remove('is-hit');
        void root.offsetWidth;
        root.classList.add('is-hit');
        impactTimer = setTimeout(impact, IMPACT_MS);
    });
})();

(function () {
    const dataEl = document.getElementById('flashcards-data');
    if (!dataEl) return;

    const termos = JSON.parse(dataEl.textContent);
    const total = termos.length;

    // ---- Ecrã 1: flashcards ----
    const screen1 = document.getElementById('flashcardsScreen1');
    const progressFill = document.getElementById('flashcardsProgressFill');
    const progressLabel = document.getElementById('flashcardsProgressLabel');
    const flashcard = document.getElementById('flashcard');
    const flashcardInner = document.getElementById('flashcardInner');
    const termEl = document.getElementById('flashcardTerm');
    const definitionEl = document.getElementById('flashcardDefinition');
    const stampKnow = document.getElementById('flashcardStampKnow');
    const stampDontknow = document.getElementById('flashcardStampDontknow');
    const actions = document.getElementById('flashcardsActions');
    const btnYes = document.getElementById('flashcardsBtnYes');
    const btnNo = document.getElementById('flashcardsBtnNo');

    // ---- Ecrã 2: resumo intermédio ----
    const screen2 = document.getElementById('flashcardsScreen2');
    const summaryMessage = document.getElementById('flashcardsSummaryMessage');
    const summaryYes = document.getElementById('flashcardsSummaryYes');
    const summaryNo = document.getElementById('flashcardsSummaryNo');
    const goToAssociacaoBtn = document.getElementById('flashcardsGoToAssociacao');
    const skipToResultBtn = document.getElementById('flashcardsSkipToResult');

    // ---- Ecrã 3: associação ----
    const screen3 = document.getElementById('flashcardsScreen3');
    const associacaoTermosEl = document.getElementById('associacaoTermos');
    const associacaoDefinicoesEl = document.getElementById('associacaoDefinicoes');
    const verResultadoBtn = document.getElementById('flashcardsVerResultado');

    // ---- Ecrã 4: resultado final ----
    const screen4 = document.getElementById('flashcardsScreen4');
    const resultDominadosEl = document.getElementById('flashcardsResultDominados');
    const resultARever = document.getElementById('flashcardsResultARever');

    const SWIPE_THRESHOLD = 90;
    const CLICK_TOLERANCE = 8;

    let currentIndex = 0;
    let isFlipped = false;
    let respostas = []; // [{id, termo, sabia}]
    let outcomesAssociacao = {}; // { termoId: 'correto' | 'errado' }
    let associacaoFoiSaltada = false;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let deltaX = 0;
    let moved = false;

    function esconderTodosOsEcras() {
        screen1.hidden = true;
        screen2.hidden = true;
        screen3.hidden = true;
        screen4.hidden = true;
    }

    // ---------------- Ecrã 1 ----------------

    function renderCard() {
        const termo = termos[currentIndex];
        termEl.textContent = termo.termo;
        definitionEl.textContent = termo.definicao;

        isFlipped = false;
        flashcard.classList.remove('is-flipped');
        actions.hidden = true;

        flashcard.style.transition = 'none';
        flashcard.style.transform = '';
        flashcard.style.opacity = '1';
        stampKnow.style.opacity = '0';
        stampDontknow.style.opacity = '0';
        void flashcard.offsetWidth;
        flashcard.style.transition = '';

        progressLabel.textContent = `${currentIndex + 1}/${total}`;
        progressFill.style.width = `${(currentIndex / total) * 100}%`;
    }

    function flip() {
        isFlipped = true;
        flashcard.classList.add('is-flipped');
        actions.hidden = false;
    }

    function updateDragVisuals() {
        flashcard.style.transform = `translateX(${deltaX}px) rotate(${deltaX / 18}deg)`;
        const ratio = Math.min(Math.abs(deltaX) / SWIPE_THRESHOLD, 1);
        if (deltaX > 0) {
            stampKnow.style.opacity = String(ratio);
            stampDontknow.style.opacity = '0';
        } else if (deltaX < 0) {
            stampDontknow.style.opacity = String(ratio);
            stampKnow.style.opacity = '0';
        } else {
            stampKnow.style.opacity = '0';
            stampDontknow.style.opacity = '0';
        }
    }

    function resetDragVisuals() {
        flashcard.style.transform = '';
        stampKnow.style.opacity = '0';
        stampDontknow.style.opacity = '0';
    }

    function registarResposta(sabia) {
        const termo = termos[currentIndex];
        respostas.push({ id: termo.id, termo: termo.termo, sabia });
    }

    function commitSwipe(direction) {
        registarResposta(direction === 1);

        const flyX = direction * (window.innerWidth || 800);
        flashcard.style.transform = `translateX(${flyX}px) rotate(${direction * 24}deg)`;
        flashcard.style.opacity = '0';

        setTimeout(() => {
            currentIndex += 1;
            if (currentIndex >= total) {
                mostrarEcra2();
            } else {
                renderCard();
            }
        }, 220);
    }

    flashcard.addEventListener('pointerdown', (event) => {
        dragging = true;
        moved = false;
        startX = event.clientX;
        startY = event.clientY;
        deltaX = 0;
        flashcard.setPointerCapture(event.pointerId);
        flashcard.style.transition = 'none';
    });

    flashcard.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (Math.abs(dx) > CLICK_TOLERANCE || Math.abs(dy) > CLICK_TOLERANCE) {
            moved = true;
        }
        if (isFlipped) {
            deltaX = dx;
            updateDragVisuals();
        }
    });

    function endDrag() {
        if (!dragging) return;
        dragging = false;
        flashcard.style.transition = '';

        if (!moved) {
            if (!isFlipped) flip();
            return;
        }

        if (isFlipped) {
            if (deltaX > SWIPE_THRESHOLD) {
                commitSwipe(1);
                return;
            }
            if (deltaX < -SWIPE_THRESHOLD) {
                commitSwipe(-1);
                return;
            }
            resetDragVisuals();
        }
        deltaX = 0;
    }

    flashcard.addEventListener('pointerup', endDrag);
    flashcard.addEventListener('pointercancel', endDrag);

    btnYes?.addEventListener('click', () => commitSwipe(1));
    btnNo?.addEventListener('click', () => commitSwipe(-1));

    // ---------------- Ecrã 2 ----------------

    function mostrarEcra2() {
        const sabiaCount = respostas.filter((r) => r.sabia).length;
        const naoSabiaCount = respostas.length - sabiaCount;

        summaryYes.textContent = String(sabiaCount);
        summaryNo.textContent = String(naoSabiaCount);

        summaryMessage.textContent = naoSabiaCount > 0
            ? `Reviste os ${total} termos! Sabias ${sabiaCount} — vamos trabalhar os outros ${naoSabiaCount} juntos?`
            : `Reviste os ${total} termos e sabias todos! Boa exploração de hoje.`;

        skipToResultBtn.hidden = false;
        goToAssociacaoBtn.hidden = naoSabiaCount === 0;

        esconderTodosOsEcras();
        screen2.hidden = false;
    }

    goToAssociacaoBtn?.addEventListener('click', () => {
        const naoSabiaTermos = respostas.filter((r) => !r.sabia);
        if (naoSabiaTermos.length === 0) {
            mostrarEcra4();
            return;
        }
        montarEcra3(naoSabiaTermos.map((r) => r.id));
    });

    skipToResultBtn?.addEventListener('click', () => {
        associacaoFoiSaltada = true;
        mostrarEcra4();
    });

    // ---------------- Ecrã 3: associação ----------------

    function embaralhar(lista) {
        const copia = [...lista];
        for (let i = copia.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [copia[i], copia[j]] = [copia[j], copia[i]];
        }
        return copia;
    }

    let termoSelecionadoEl = null;
    let termoSelecionadoId = null;
    let pendentes = 0;

    function montarEcra3(idsNaoSabia) {
        const termosParaAssociar = termos.filter((t) => idsNaoSabia.includes(t.id));
        const definicoesEmbaralhadas = embaralhar(termosParaAssociar);

        pendentes = termosParaAssociar.length;
        termoSelecionadoEl = null;
        termoSelecionadoId = null;
        outcomesAssociacao = {};
        verResultadoBtn.hidden = true;

        associacaoTermosEl.innerHTML = '';
        associacaoDefinicoesEl.innerHTML = '';

        termosParaAssociar.forEach((termo) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'associacao-item associacao-item--termo';
            item.dataset.id = termo.id;
            item.textContent = termo.termo;
            item.addEventListener('click', () => selecionarTermo(item, termo.id));
            associacaoTermosEl.appendChild(item);
        });

        definicoesEmbaralhadas.forEach((termo) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'associacao-item associacao-item--definicao';
            item.dataset.correctId = termo.id;
            item.textContent = termo.definicao;
            item.addEventListener('click', () => selecionarDefinicao(item, termo.id));
            associacaoDefinicoesEl.appendChild(item);
        });

        esconderTodosOsEcras();
        screen3.hidden = false;
    }

    function selecionarTermo(el, termoId) {
        if (el.classList.contains('is-resolved')) return;
        if (termoSelecionadoEl) termoSelecionadoEl.classList.remove('is-selected');
        termoSelecionadoEl = el;
        termoSelecionadoId = termoId;
        el.classList.add('is-selected');
    }

    function selecionarDefinicao(el, definicaoDonoId) {
        if (el.classList.contains('is-resolved')) return;
        if (!termoSelecionadoId) return;

        const termoEl = associacaoTermosEl.querySelector(`[data-id="${termoSelecionadoId}"]`);

        if (definicaoDonoId === termoSelecionadoId) {
            el.classList.add('is-correct', 'is-resolved');
            termoEl?.classList.add('is-correct', 'is-resolved');
            outcomesAssociacao[termoSelecionadoId] = 'correto';
            resolverSelecao();
        } else {
            el.classList.add('is-wrong');
            setTimeout(() => el.classList.remove('is-wrong'), 500);

            const definicaoCorretaEl = associacaoDefinicoesEl.querySelector(`[data-correct-id="${termoSelecionadoId}"]`);
            definicaoCorretaEl?.classList.add('is-correct', 'is-resolved');
            termoEl?.classList.add('is-wrong-resolved', 'is-resolved');
            outcomesAssociacao[termoSelecionadoId] = 'errado';
            resolverSelecao();
        }
    }

    function resolverSelecao() {
        termoSelecionadoEl?.classList.remove('is-selected');
        termoSelecionadoEl = null;
        termoSelecionadoId = null;
        pendentes -= 1;
        if (pendentes <= 0) {
            verResultadoBtn.hidden = false;
        }
    }

    verResultadoBtn?.addEventListener('click', () => mostrarEcra4());

    // ---------------- Ecrã 4: resultado final ----------------

    function mostrarEcra4() {
        let dominados = 0;
        let aRever = 0;
        const atualizacoes = [];

        respostas.forEach((resposta) => {
            let estadoFinal;
            if (resposta.sabia) {
                estadoFinal = 'dominado';
            } else if (outcomesAssociacao[resposta.id] === 'correto') {
                estadoFinal = 'dominado';
            } else {
                // Errou na associação, ou saltou a associação (associacaoFoiSaltada).
                estadoFinal = 'a_rever';
            }

            if (estadoFinal === 'dominado') dominados += 1;
            else aRever += 1;

            atualizacoes.push({ id: resposta.id, estado: estadoFinal });
        });

        resultDominadosEl.textContent = String(dominados);
        resultARever.textContent = String(aRever);

        esconderTodosOsEcras();
        screen4.hidden = false;

        fetch(window.exploreAtualizarVocabularioUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.exploreCsrfToken },
            credentials: 'same-origin',
            body: JSON.stringify({ atualizacoes }),
        }).catch(() => {
            // Falha silenciosa — o resultado já foi mostrado ao aluno; a
            // próxima ronda de flashcards simplesmente não reflete esta.
        });
    }

    renderCard();
})();

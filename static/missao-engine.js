/**
 * Motor de missões reutilizável — Explore+
 *
 * Lê um ficheiro de missão (ver missoes/*.json para o formato) e percorre
 * secções/ecrãs pela ordem, renderizando cada "tipo" de ecrã com o layout
 * correspondente. Para criar uma missão nova basta escrever um novo JSON
 * no mesmo formato — este ficheiro não conhece nada específico de nenhuma
 * missão em concreto.
 *
 * Tipos de ecrã suportados: gancho, diagrama_interativo, micro_verificacao,
 * analogia, aprofundar, quiz_seccao.
 */
(function () {
    'use strict';

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // **negrito** — mesma sintaxe do filtro md_inline usado nos Resumos
    // (ver meu_site/templatetags/resumo_extras.py), aplicado depois de
    // escapeHtml porque o conteúdo vem de missoes/*.json, não de input
    // de utilizadores.
    function boldMarkdown(escapedValue) {
        return escapedValue.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    }

    // Plain text with line breaks (\n\n) turned into paragraphs — content
    // comes from our own missoes/*.json, not user input, so this only ever
    // needs to handle that trusted authoring format.
    function textToHtml(value) {
        const paragraphs = String(value ?? '').split(/\n\s*\n/).filter(Boolean);
        if (paragraphs.length <= 1) {
            return `<p>${boldMarkdown(escapeHtml(value))}</p>`;
        }
        return paragraphs.map((p) => `<p>${boldMarkdown(escapeHtml(p))}</p>`).join('');
    }

    // Bloco "Medição e incertezas" partilhado por todas as atividades
    // laboratoriais de Física (10.º e 11.º ano) — ver renderAtividadeLaboratorial
    // e screen.rever_medicao_incertezas. Escrito uma única vez aqui em vez de
    // duplicado em cada missões/fisica/*.json, para o botão "Rever" abrir
    // sempre o mesmo texto, esteja em que missão estiver.
    const MEDICAO_INCERTEZAS_TEXTO = `Medir é comparar uma grandeza com uma unidade. Nenhuma medição é perfeita: há sempre uma incerteza associada.

**1. Incerteza de leitura**

Instrumento analógico (régua, termómetro de mercúrio, proveta): metade da menor divisão da escala. Régua graduada em milímetros: incerteza de leitura = 0,5 mm. Instrumento digital (cronómetro digital, multímetro, balança digital): uma unidade do último dígito. Balança que mostra 12,34 g: incerteza = 0,01 g. O resultado escreve-se com a incerteza: comprimento = (12,5 ± 0,5) mm.

**2. Medições repetidas**

Quando se repete uma medição várias vezes, o valor mais provável é a média dos valores obtidos. A incerteza absoluta pode ser estimada pelo maior desvio em módulo em relação à média. Exemplo: tempos 1,52 s; 1,48 s; 1,55 s. Média = 1,52 s. Desvios: 0,00; 0,04; 0,03. Maior desvio = 0,04 s. Resultado: t = (1,52 ± 0,04) s.

**3. Incerteza relativa**

Incerteza relativa = incerteza absoluta / valor medido, normalmente em percentagem. No exemplo anterior: 0,04 / 1,52 × 100 = 2,6 %. Quanto menor a incerteza relativa, mais precisa é a medição.

**4. Erro percentual (quando se conhece o valor de referência)**

Erro percentual = |valor experimental − valor de referência| / valor de referência × 100. Mede a exatidão do resultado.

**5. Precisão e exatidão**

Precisão: os valores medidos estão próximos uns dos outros (pouca dispersão). Exatidão: o valor medido está próximo do valor verdadeiro. Uma medição pode ser precisa e pouco exata (todos os tiros agrupados, mas longe do centro do alvo).

**6. Erros sistemáticos e aleatórios**

Erros sistemáticos: afetam sempre no mesmo sentido (balança mal calibrada, zero da escala deslocado, paralaxe feita sempre do mesmo lado). Não se eliminam repetindo a medição. Afetam a exatidão. Erros aleatórios: variam de medição para medição, em sentido imprevisível (tempo de reação a acionar o cronómetro, pequenas vibrações). Reduzem-se repetindo a medição e calculando a média. Afetam a precisão.

**7. Algarismos significativos**

O resultado final não pode ter mais algarismos significativos do que os dados permitem. A incerteza escreve-se normalmente com um algarismo significativo, e o valor medido acaba na mesma casa decimal da incerteza.`;

    // Números mostrados nas simulações usam vírgula como separador decimal.
    function comVirgula(value) {
        return String(value).replace('.', ',');
    }

    // Disponível nas fórmulas das simulações como num(x, algarismos):
    // algarismos significativos, vírgula decimal e, para valores muito
    // pequenos ou grandes, notação científica "2,50 × 10⁻⁴".
    const SUPERSCRITOS = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
    function formatarNumero(x, algarismos = 3) {
        if (typeof x !== 'number' || !Number.isFinite(x)) return '—';
        if (x === 0) return '0';
        const abs = Math.abs(x);
        if (abs >= 1e-3 && abs < 1e5) {
            const simples = x.toPrecision(algarismos);
            if (!simples.includes('e')) return simples.replace('.', ',').replace('-', '−');
        }
        const [mantissa, expoente] = x.toExponential(algarismos - 1).split('e');
        const sup = String(Number(expoente)).split('').map((c) => SUPERSCRITOS[c]).join('');
        return `${mantissa.replace('.', ',').replace('-', '−')} × 10${sup}`;
    }

    function escapeAttr(value) {
        return escapeHtml(value).replace(/"/g, '&quot;');
    }

    // ---- Correção das respostas dos exercícios (ver exercicioPontoHtml) ----

    // "1,35 × 10⁵", "1.35e5", "135 000", "135000 J"... → lista de valores
    // possíveis. Mais de um porque "1.350" tanto pode ser 1,35 (ponto
    // decimal) como 1350 (ponto de milhar): a resposta é aceite se
    // qualquer das leituras bater certo.
    function parseNumerosPt(texto) {
        const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };
        const s = String(texto || '').toLowerCase()
            .replace(/[\s\u00a0\u202f]/g, '')
            .replace(/[°º]+$/, '')
            .replace(/[−–]/g, '-')
            .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => '^' + m.split('').map((c) => SUP[c]).join(''))
            .replace(/[a-zµ]+$/, (m) => (m === 'e' ? m : ''));
        const sci = s.match(/^([+-]?[\d.,]+)(?:[x×*]10\^?\(?([+-]?\d+)\)?|e([+-]?\d+))$/);
        const simples = s.match(/^([+-]?[\d.,]+)$/);
        const mantissa = sci ? sci[1] : (simples ? simples[1] : null);
        if (mantissa === null) return [];
        const expoente = sci ? Number(sci[2] !== undefined ? sci[2] : sci[3]) : 0;
        const sinal = mantissa.startsWith('-') ? -1 : 1;
        const corpo = mantissa.replace(/^[+-]/, '');
        const leituras = new Set();
        if (corpo.includes(',') && corpo.includes('.')) {
            leituras.add(corpo.replace(/\./g, '').replace(',', '.'));
        } else if (corpo.includes(',')) {
            leituras.add(corpo.replace(',', '.'));
            if (/^\d{1,3}(,\d{3})+$/.test(corpo)) leituras.add(corpo.replace(/,/g, ''));
        } else {
            leituras.add(corpo);
            if (/^\d{1,3}(\.\d{3})+$/.test(corpo)) leituras.add(corpo.replace(/\./g, ''));
        }
        return Array.from(leituras)
            .map((v) => sinal * Number(v) * Math.pow(10, expoente))
            .filter((v) => Number.isFinite(v));
    }

    function normalizarTexto(texto) {
        return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
    }

    // Avalia uma resposta: "certo", "quase" ou "errado".
    // campo.correta (número): certo até campo.tolerancia relativa (0,05% por
    // omissão — só deixa passar erros de vírgula flutuante ou um algarismo
    // a mais, nunca um valor arredondado de outra forma: 3,70 × 10⁵ não é
    // 3,75 × 10⁵); "quase" até campo.proximidade relativa (15% por
    // omissão), para quem está perto mas falhou qualquer coisinha; senão
    // errado.
    // campo.aceites (lista de palavras/expressões): certo se o texto
    // contiver uma delas, senão errado — não há "quase" em texto.
    function avaliarResposta(campo, valor) {
        if (campo.correta !== undefined && campo.correta !== null) {
            const tol = campo.tolerancia !== undefined ? campo.tolerancia : 0.0005;
            const perto = campo.proximidade !== undefined ? campo.proximidade : 0.15;
            // Resposta 0: erro absoluto (não dá para dividir por zero).
            const erros = parseNumerosPt(valor).map((v) => Math.abs(v - campo.correta) / (campo.correta === 0 ? 1 : Math.abs(campo.correta)));
            if (!erros.length) return 'errado';
            const menor = Math.min(...erros);
            if (menor <= tol) return 'certo';
            return menor <= perto ? 'quase' : 'errado';
        }
        const dado = normalizarTexto(valor);
        return dado !== '' && (campo.aceites || []).some((a) => dado.includes(normalizarTexto(a))) ? 'certo' : 'errado';
    }

    function imagemEcraHtml(nome, classe, alt, legenda) {
        if (!nome) return '';
        const src = `/static/images/${encodeURIComponent(nome)}`;
        if (!legenda) {
            return `<img class="${classe}" src="${src}" alt="${escapeAttr(alt)}" onerror="this.style.display='none'">`;
        }
        return `<img class="${classe}" src="${src}" alt="${escapeAttr(alt)}" data-legenda="${escapeAttr(legenda)}" onerror="meImagemEmFalta(this)">`;
    }

    window.meImagemEmFalta = function (img) {
        const reservado = document.createElement('div');
        reservado.className = 'me-imagem-reservada';
        reservado.textContent = img.dataset.legenda || '';
        img.replaceWith(reservado);
    };

    class MissaoEngine {
        constructor(missao, options = {}) {
            this.missao = missao;
            this.root = options.root;
            this.missionsIndexUrl = options.missionsIndexUrl || '#';
            this.mascotImageUrl = options.mascotImageUrl || '';
            this.progressSyncUrl = options.progressSyncUrl || window.exploreProgressSyncUrl || '';
            this.activityHeartbeatUrl = options.activityHeartbeatUrl || window.exploreActivityHeartbeatUrl || '';
            this.csrfToken = options.csrfToken || window.exploreCsrfToken || '';
            this.mascoteChatUrl = options.mascoteChatUrl || window.exploreMascoteChatUrl || '';
            this.mascotWaveVideoUrl = options.mascotWaveVideoUrl || window.exploreMascotWaveVideoUrl || '';
            this.mascotDoubtsImageUrl = options.mascotDoubtsImageUrl || window.exploreMascotDoubtsImageUrl || '';
            this.mascotExplainingImageUrl = options.mascotExplainingImageUrl || window.exploreMascotExplainingImageUrl || '';

            // Estado do painel de chat — não persiste em localStorage (tal
            // como na Fotossíntese, o chat começa sempre fechado e sem
            // histórico a cada visita/recarregamento da página).
            this.chatOpen = false;
            this.chatHistory = [];
            // Respostas dos exercícios por ponto (ver exercicioPontoHtml) —
            // só em memória, como o chat.
            this.exercicioEstado = {};
            this.chatLimitReached = false;
            this._lastGanchoPopupKey = null;
            // Flutuante (padrão) vs. fixo na barra lateral — mesma chave e
            // comportamento do botão de expandir da Fotossíntese (ver
            // initChatDockToggle em mission.js), para a preferência ficar
            // consistente entre as duas missões.
            this.chatDocked = this.loadChatDockedPref();
            // Largura do painel quando fixo (arrastando meSidebarResizeHandle,
            // ver bindSidebarResize) — guardada à parte porque o render()
            // recria o <aside> do zero a cada chamada, perdendo qualquer
            // estilo aplicado diretamente ao elemento anterior. Mesmos
            // limites da Fotossíntese (ver initSidebarResize em mission.js).
            this.SIDEBAR_MIN_WIDTH = 240;
            this.SIDEBAR_MAX_WIDTH = 520;
            this.sidebarWidth = this.loadSidebarWidthPref();

            this.storageKey = this.buildStorageKey();
            this.state = this.loadState();

            this.render();
            window.addEventListener('explore:mascot-prefs-changed', () => this.render());
            this.startActivityHeartbeat();
        }

        /** Regista tempo de estudo (para "Hábitos de estudo" e os gráficos
         *  de tempo de estudo nas Estatísticas) — um ping por minuto, só
         *  enquanto o separador estiver mesmo visível E o aluno tiver
         *  interagido (rato, teclado, scroll ou toque) nos últimos 5
         *  minutos. Sem isto, deixar a página aberta e esquecida faria o
         *  temporizador contar tempo indefinidamente, o que não seria
         *  tempo de estudo real. Falhas são silenciosas: isto é
         *  telemetria, não deve nunca bloquear ou quebrar a missão em si. */
        startActivityHeartbeat() {
            if (!this.activityHeartbeatUrl) return;

            const LIMITE_INATIVIDADE_MS = 5 * 60 * 1000;
            let ultimaInteracao = Date.now();
            const marcarInteracao = () => { ultimaInteracao = Date.now(); };
            ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'].forEach((evento) => {
                window.addEventListener(evento, marcarInteracao, { passive: true });
            });

            const enviarPing = () => {
                if (document.visibilityState !== 'visible') return;
                if (Date.now() - ultimaInteracao > LIMITE_INATIVIDADE_MS) return;
                fetch(this.activityHeartbeatUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken },
                    body: JSON.stringify({ minutos: 1 }),
                }).catch(() => {});
            };
            setInterval(enviarPing, 60000);
        }

        // ---- Persistência -------------------------------------------------

        buildStorageKey() {
            const user = window.exploreCurrentUser;
            const userKey = user?.uid ? `uid:${user.uid}` : (user?.email ? `email:${user.email.toLowerCase()}` : 'guest');
            return `missao_engine_${userKey}_${this.missao.missao_id}`;
        }

        defaultState() {
            return {
                view: 'mapa',
                activeSectionIndex: 0,
                screenIndexBySection: {},
                answers: {},
                quizState: {},
                completedSections: [],
                celebrationShown: false,
                // XP already paid out per screen — "<secao_id>::<screenIndex>"
                // -> amount. Keyed per screen so re-entering an already-paid
                // page (Anterior, then Próximo again) never pays twice, and
                // going back never removes an entry (see awardPageXP).
                xpAwardedPages: {}
            };
        }

        loadState() {
            try {
                const raw = localStorage.getItem(this.storageKey);
                if (!raw) return this.defaultState();
                const parsed = JSON.parse(raw);
                return { ...this.defaultState(), ...parsed };
            } catch (error) {
                return this.defaultState();
            }
        }

        saveState() {
            try {
                localStorage.setItem(this.storageKey, JSON.stringify(this.state));
            } catch (error) {
                // Ignore storage errors (private browsing / quota).
            }
        }

        /** Ícone do botão de expandir/flutuar o chat — mesmos dois traçados
         *  do botão equivalente na Fotossíntese (ver initChatDockToggle em
         *  mission.js), para o símbolo ser reconhecível nas duas missões. */
        chatDockIconSvg() {
            const DOCK_ICON = '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>';
            const FLOAT_ICON = '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/>';
            return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${this.chatDocked ? FLOAT_ICON : DOCK_ICON}</svg>`;
        }

        loadChatDockedPref() {
            try {
                return localStorage.getItem('explore_mission_chat_docked') === '1';
            } catch (error) {
                return false;
            }
        }

        saveChatDockedPref(isDocked) {
            try {
                localStorage.setItem('explore_mission_chat_docked', isDocked ? '1' : '0');
            } catch (error) {
                // Ignore storage errors — o botão continua a funcionar
                // nesta visita, só não fica guardado.
            }
        }

        loadSidebarWidthPref() {
            try {
                const saved = Number(localStorage.getItem('explore_mission_sidebar_width'));
                if (Number.isFinite(saved) && saved > 0) {
                    return Math.max(this.SIDEBAR_MIN_WIDTH, Math.min(this.SIDEBAR_MAX_WIDTH, saved));
                }
            } catch (error) {
                // Ignore storage access errors (private browsing).
            }
            return 280;
        }

        saveSidebarWidthPref(width) {
            try {
                localStorage.setItem('explore_mission_sidebar_width', String(width));
            } catch (error) {
                // Ignore storage errors — o arrastar continua a funcionar
                // nesta visita, só não fica guardado.
            }
        }

        // ---- Helpers de missão ---------------------------------------------

        get sections() {
            return this.missao.secoes || [];
        }

        getSection(index) {
            return this.sections[index];
        }

        // ---- XP por página ----------------------------------------------------
        // Cada ecrã (página) da missão vale 15 XP ao avançar por ele pela
        // primeira vez; o quiz_seccao é a exceção — a sua recompensa depende
        // do desempenho (ver computeQuizSectionXP). Isto substitui o antigo
        // modelo de XP fixo por secção (o campo "xp" no JSON já não é usado
        // para calcular recompensas).

        /** Maior XP que um ecrã pode valer — usado só para os badges de
         *  "recompensa" mostrados antes de começar (mapa da missão), que
         *  mostram o melhor cenário possível (quiz 100% certo). */
        screenMaxXP(screen) {
            return screen.tipo === 'quiz_seccao' ? 30 : 15;
        }

        sectionMaxXP(section) {
            return (section.ecrãs || []).reduce((sum, screen) => sum + this.screenMaxXP(screen), 0);
        }

        totalMissionXP() {
            return this.sections.reduce((sum, s) => sum + this.sectionMaxXP(s), 0);
        }

        /** Soma do que já foi mesmo pago (ver awardPageXP) — usado na
         *  celebração final, ao contrário de totalMissionXP() (que é só a
         *  pré-visualização do melhor cenário possível). */
        totalMissionXpEarned() {
            return Object.values(this.state.xpAwardedPages || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
        }

        /** Recompensa do quiz de secção, consoante o desempenho: tudo certo
         *  = 30 XP; pelo menos metade certo (mas não tudo) = 15 XP; menos de
         *  metade (incluindo zero) = 5 XP. */
        computeQuizSectionXP(section, screen) {
            const totalQuestions = (screen.perguntas || []).length;
            if (totalQuestions === 0) return 5;
            const quizState = this.state.quizState[section.secao_id];
            const correct = quizState ? quizState.answers.filter((a) => a.correct).length : 0;
            if (correct === totalQuestions) return 30;
            if (correct >= totalQuestions / 2) return 15;
            return 5;
        }

        /** Paga a recompensa de um ecrã exatamente uma vez — a chave
         *  (secao::índice do ecrã) já ficar registada em xpAwardedPages
         *  impede um segundo pagamento se o aluno voltar a passar por este
         *  ecrã (Anterior e depois Próximo outra vez); nada aqui alguma vez
         *  remove uma entrada, por isso ir para trás nunca tira XP já
         *  ganho. */
        awardPageXP(section, screenIndex, screen) {
            const key = `${section.secao_id}::${screenIndex}`;
            if (this.state.xpAwardedPages[key]) return;

            const amount = screen.tipo === 'quiz_seccao'
                ? this.computeQuizSectionXP(section, screen)
                : 15;

            this.state.xpAwardedPages[key] = amount;
            this.saveState();

            if (window.ProfileXP) {
                // A source tem de ser única por página, não só por missão —
                // awardXPToCurrentUser recusa silenciosamente (0 XP, sem
                // erro) uma segunda chamada com a mesma source, para nunca
                // pagar duas vezes a mesma recompensa. Usar sempre
                // "missao:<id>" aqui faria com que só a primeira página
                // desta missão alguma vez desse XP a sério.
                const source = window.ProfileXP.buildRewardSource
                    ? window.ProfileXP.buildRewardSource('missao', `${this.missao.missao_id}:${key}`)
                    : undefined;
                window.ProfileXP.awardXPToCurrentUser(amount, source);
            }
        }

        isSectionUnlocked(index) {
            if (index === 0) return true;
            const previous = this.sections[index - 1];
            return this.state.completedSections.includes(previous.secao_id);
        }

        mascotEnabled() {
            return window.MascotPrefs ? window.MascotPrefs.isEnabled() : true;
        }

        // ---- Render raiz ----------------------------------------------------

        render() {
            if (!this.root) return;

            if (this.state.view === 'celebracao') {
                this.renderCelebration();
                return;
            }

            if (this.state.view === 'mapa') {
                this.renderMapa();
                return;
            }

            this.renderSeccao();
        }

        // ---- Vista: mapa da missão ------------------------------------------

        // Reaproveita exatamente as classes "mo-*" de mission-styles.css (a
        // mesma folha de estilo usada pelo ecrã de percurso da missão da
        // Fotossíntese) para que qualquer missão deste motor genérico tenha
        // a mesma aparência de índice/hero/progresso, sem CSS duplicado.
        renderMapa() {
            const totalXP = this.totalMissionXP();
            const completedCount = this.state.completedSections.length;
            const totalCount = this.sections.length;
            const progressPercent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

            const xpStarIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="yellow" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/></svg>';
            const checkIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
            const chevronIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>';

            const rowsHtml = this.sections.map((section, index) => {
                const isDone = this.state.completedSections.includes(section.secao_id);
                const isLocked = !this.isSectionUnlocked(index);
                const isActive = !isDone && !isLocked;
                const statusHtml = isLocked
                    ? '<span class="mo-index-status mo-index-status--locked">🔒 Bloqueada</span>'
                    : (isDone
                        ? `<span class="mo-index-status mo-index-status--done">${checkIconSvg} Concluída</span>`
                        : '<span class="mo-index-status mo-index-status--active">Em progresso</span>');

                return `
                    <li class="mo-index-row ${isActive ? 'is-active' : ''} ${isLocked ? 'is-locked' : ''}">
                        <button type="button" class="mo-index-row-btn" data-section-index="${index}" ${isLocked ? 'disabled' : ''}>
                            <span class="mo-index-icon" style="background:#1f8a5b22; color:#1f8a5b">${section.icone || (index + 1)}</span>
                            <span class="mo-index-copy">
                                <strong>${escapeHtml(section.titulo)}</strong>
                                <span>~${section.tempo_estimado_min || 0} min</span>
                            </span>
                            <span class="mo-index-meta">
                                ${statusHtml}
                                <span class="mo-index-xp">${xpStarIconSvg} +${this.sectionMaxXP(section)} XP</span>
                            </span>
                            <span class="mo-index-chevron" aria-hidden="true">${chevronIconSvg}</span>
                        </button>
                    </li>
                `;
            }).join('');

            const logoUrl = window.exploreLogoUrl || '';
            const planoIsPro = window.explorePlano === 'pro';
            const avatarInitial = (window.exploreUsername || '').trim().charAt(0).toUpperCase() || '?';

            this.root.innerHTML = `
                <div class="mo-page" id="moPage">
                    <div class="sidebar-overlay" id="sidebarOverlay" hidden></div>
                    <aside class="profile-sidebar" id="profileSidebar" aria-hidden="true">
                        <div class="profile-sidebar-brand"><div><img src="${logoUrl}" alt="Logotipo Explore+"></div></div>
                        <nav class="profile-sidebar-nav">
                            <div class="sidebar-plan-card">
                                <div class="sidebar-plan-info">
                                    <span class="sidebar-plan-label">Plano</span>
                                    <strong class="sidebar-plan-name">${planoIsPro ? 'Pro' : 'Gratuito'}</strong>
                                </div>
                                ${planoIsPro ? '<span class="sidebar-plan-cta sidebar-plan-cta--badge">SuperExplore</span>' : `<a href="${window.exploreSuperExploreUrl || '#'}" class="sidebar-plan-cta">SuperExplore</a>`}
                            </div>
                            <a href="${window.explorePerfilUrl || '#'}"><span class="profile-sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></span>
                            <span class="profile-sidebar-label">Perfil</span>
                            </a>
                            <a href="${this.missionsIndexUrl}" class="is-active" aria-current="page"><span class="profile-sidebar-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg></span>
                            <span class="profile-sidebar-label">Missões</span>
                            </a>
                            <a href="${window.exploreTestesUrl || '#'}"><span class="profile-sidebar-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/></svg></span>
                            <span class="profile-sidebar-label">Testes</span>
                            </a>
                            <a href="${window.exploreExamesUrl || '#'}"><span class="profile-sidebar-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg></span>
                            <span class="profile-sidebar-label">Exames</span>
                            </a>
                            <a href="${window.exploreBibliotecaUrl || '#'}"><span class="profile-sidebar-icon" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v8l3-3 3 3V2"/><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/></svg></span>
                            <span class="profile-sidebar-label">Biblioteca do Explorador</span>
                            </a>
                            <a href="${window.exploreResumosUrl || '#'}"><span class="profile-sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/></svg></span>
                            <span class="profile-sidebar-label">Resumos</span>
                            </a>
                        </nav>
                        <div class="sidebar-theme-card">
                            <span class="sidebar-theme-label">Tema</span>
                            <button class="header-icon-btn theme-toggle-btn" id="sidebarThemeToggleBtn" type="button" aria-label="Ativar modo escuro" aria-pressed="false">
                                <svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
                                <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>
                            </button>
                        </div>
                        <div class="profile-account">
                            <button class="profile-account-trigger" id="profileAccountTrigger" type="button" aria-expanded="false" aria-controls="profileAccountMenu">
                                <span class="profile-account-avatar" id="profileAccountAvatar">${avatarInitial}</span>
                                <span class="profile-account-info">
                                    <strong id="profileAccountName">${escapeHtml(window.exploreUsername || '')}</strong>
                                    <span id="profileAccountEmail">${escapeHtml(this.missao ? (window.exploreCurrentUser?.email || '') : '')}</span>
                                </span>
                                <span class="profile-account-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>
                            </button>
                            <div class="profile-account-menu" id="profileAccountMenu" hidden>
                                <a href="${window.exploreConfiguracoesUrl || '#'}">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/></svg>
                                    <span>Configurações</span>
                                </a>
                                <a href="${window.exploreLogoutUrl || '#'}" class="profile-account-logout">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-6"/></svg>
                                    <span>Terminar sessão</span>
                                </a>
                            </div>
                        </div>
                    </aside>

                    <div class="mo-body">
                        <div class="mo-topbar">
                            <a href="${window.explorePaginaInicialUrl || '#'}" class="mo-header-logo"><img src="${logoUrl}" alt="Explore+"></a>
                            <button type="button" class="nav-drawer-toggle" id="navDrawerToggle" aria-label="Abrir menu">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                            </button>
                        </div>

                        <nav class="mo-breadcrumb" aria-label="Navegação">
                            <a href="${this.missionsIndexUrl}">Missões</a>
                            <span class="mo-breadcrumb-sep">›</span>
                            <span>${escapeHtml(this.missao.titulo)}</span>
                        </nav>

                        <section class="mo-hero${this.missao.imagem ? ' mo-hero--has-image' : ''}"${this.missao.imagem ? ` style="background-image:linear-gradient(120deg, rgba(10,20,14,.65), rgba(10,20,14,.3)), url('/static/images/${encodeURIComponent(this.missao.imagem)}')"` : ''}>
                            <div class="mo-hero-info">
                                <h1>${escapeHtml(this.missao.titulo)}</h1>
                                ${this.missao.descricao ? `<p>${escapeHtml(this.missao.descricao)}</p>` : ''}
                                <div class="mo-hero-meta">
                                    <span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/></svg> ${totalCount} secções</span>
                                    <span>${xpStarIconSvg} +${totalXP} XP</span>
                                    ${this.missao.badge ? `<span class="mo-hero-badge">${this.missao.badge.icone || '🏆'} ${escapeHtml(this.missao.badge.nome || '')}</span>` : ''}
                                </div>
                            </div>
                        </section>

                        <section class="mo-index">
                            <h2>Índice da Missão</h2>
                            <p class="mo-index-subtitle">Completa todos os passos para ganhares a tua recompensa!</p>
                            <div class="mo-layout">
                                <ol class="mo-index-list">${rowsHtml}</ol>
                                <aside class="mo-sidebar">
                                    <div class="mo-card mo-progress-card">
                                        <h3>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                                            O teu progresso
                                        </h3>
                                        <div class="mo-progress-row">
                                            <div class="mo-progress-ring" style="--progress: ${progressPercent}">
                                                <span>${completedCount}/${totalCount}</span>
                                            </div>
                                            <strong class="mo-progress-percent">${progressPercent}%</strong>
                                        </div>
                                        <div class="mo-progress-bar"><div class="mo-progress-bar-fill" style="width:${progressPercent}%"></div></div>
                                    </div>
                                    <div class="mo-card mo-rewards-card">
                                        <h3>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>
                                            Recompensas da missão
                                        </h3>
                                        <div class="mo-reward-buttons">
                                            <span class="mo-reward-btn">+${totalXP} XP</span>
                                            ${this.missao.badge ? `<span class="mo-reward-btn">${escapeHtml(this.missao.badge.nome || '')}</span>` : ''}
                                        </div>
                                    </div>
                                </aside>
                            </div>
                        </section>
                    </div>
                </div>
            `;

            this.bindMapaChrome();

            this.root.querySelectorAll('[data-section-index]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const index = Number(btn.dataset.sectionIndex);
                    this.state.activeSectionIndex = index;
                    this.state.view = 'seccao';
                    if (!(this.getSection(index).secao_id in this.state.screenIndexBySection)) {
                        this.state.screenIndexBySection[this.getSection(index).secao_id] = 0;
                    }
                    this.saveState();
                    this.render();
                });
            });
        }

        /**
         * Liga o hamburger/sidebar, o toggle de tema e o menu da conta do
         * ecrã de mapa — mission-styles.css espera este comportamento (ver
         * a mesma lógica em mission.js/renderPathScreen), e como este HTML
         * é gerado dinamicamente, nav-drawer.js/header-actions.js (que só
         * ligam elementos já presentes no momento em que correm) nunca
         * chegam a encontrar estes botões.
         */
        bindMapaChrome() {
            const page = this.root.querySelector('#moPage');
            const drawer = this.root.querySelector('#profileSidebar');
            const overlay = this.root.querySelector('#sidebarOverlay');
            const toggle = this.root.querySelector('#navDrawerToggle');

            const setSidebarOpen = (isOpen) => {
                if (!drawer || !overlay) return;
                drawer.classList.toggle('is-open', isOpen);
                drawer.setAttribute('aria-hidden', String(!isOpen));
                overlay.toggleAttribute('hidden', !isOpen);
                page?.classList.toggle('sidebar-open', isOpen);
            };

            toggle?.addEventListener('click', () => setSidebarOpen(!drawer?.classList.contains('is-open')));
            overlay?.addEventListener('click', () => setSidebarOpen(false));

            this.bindThemeToggle(this.root.querySelector('#sidebarThemeToggleBtn'));

            const accountTrigger = this.root.querySelector('#profileAccountTrigger');
            const accountMenu = this.root.querySelector('#profileAccountMenu');
            accountTrigger?.addEventListener('click', (event) => {
                event.stopPropagation();
                const isOpen = !accountMenu.hidden;
                accountMenu.hidden = isOpen;
                accountTrigger.setAttribute('aria-expanded', String(!isOpen));
            });

            if (!this._mapaGlobalChromeBound) {
                this._mapaGlobalChromeBound = true;
                document.addEventListener('keydown', (event) => {
                    if (event.key === 'Escape') setSidebarOpen(false);
                });
                document.addEventListener('click', (event) => {
                    const menu = this.root.querySelector('#profileAccountMenu');
                    const trigger = this.root.querySelector('#profileAccountTrigger');
                    if (menu && !menu.hidden && !menu.contains(event.target) && event.target !== trigger && !trigger?.contains(event.target)) {
                        menu.hidden = true;
                        trigger?.setAttribute('aria-expanded', 'false');
                    }
                });
            }
        }

        /** Partilhado pelo botão de tema do mapa e pelo do topbar da secção. */
        bindThemeToggle(themeToggle) {
            if (!themeToggle) return;
            const isDark = document.documentElement.classList.contains('dark-mode');
            themeToggle.setAttribute('aria-pressed', String(isDark));
            themeToggle.addEventListener('click', () => {
                const nextDark = !document.documentElement.classList.contains('dark-mode');
                document.documentElement.classList.toggle('dark-mode', nextDark);
                document.documentElement.dataset.theme = nextDark ? 'dark' : 'light';
                try {
                    localStorage.setItem('explore-theme', nextDark ? 'dark' : 'light');
                } catch (error) {
                    // Ignora erros de acesso ao storage (navegação privada).
                }
                themeToggle.setAttribute('aria-pressed', String(nextDark));
            });
        }

        /** Deixa arrastar a fronteira entre a barra lateral e o conteúdo
         *  principal para alargar/apertar o painel de chat — mesma lógica
         *  de initSidebarResize em mission.js (Fotossíntese), adaptada para
         *  gravar a largura em this.sidebarWidth em vez de só no elemento,
         *  porque aqui o <aside> é recriado do zero a cada render(). Só faz
         *  algo quando o chat está fixo (.is-chat-docked) — flutuante não
         *  tem a pega visível (ver CSS). */
        bindSidebarResize() {
            const handle = this.root.querySelector('#meSidebarResizeHandle');
            const sidebar = this.root.querySelector('#meMissionSidebar');
            if (!handle || !sidebar) return;

            const applyWidth = (width) => {
                const clamped = Math.max(this.SIDEBAR_MIN_WIDTH, Math.min(this.SIDEBAR_MAX_WIDTH, width));
                sidebar.style.setProperty('--mission-sidebar-width', `${clamped}px`);
                this.sidebarWidth = clamped;
                return clamped;
            };

            let startX = 0;
            let startWidth = 0;

            const onPointerMove = (event) => {
                // A barra lateral fica à direita, por isso arrastar para a
                // esquerda (delta negativo em clientX) é o que a alarga —
                // sinal invertido em relação a um painel fixo à esquerda.
                const width = applyWidth(startWidth - (event.clientX - startX));
                this.saveSidebarWidthPref(width);
            };

            const onPointerUp = () => {
                handle.classList.remove('is-dragging');
                document.body.style.removeProperty('cursor');
                document.body.style.removeProperty('user-select');
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUp);
            };

            handle.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                startX = event.clientX;
                startWidth = sidebar.getBoundingClientRect().width;
                handle.classList.add('is-dragging');
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
            });
        }

        // ---- Painel de chat com a mascote -------------------------------------
        // Reaproveita tal e qual o botão flutuante (.mascot-chat-fab) e o
        // painel (.mascote-chat-panel, dentro de .mission-sidebar) da missão
        // da Fotossíntese, incluindo o próprio endpoint /api/mascote-chat/
        // (já agnóstico da missão) — ver mascote_chat() em views.py e
        // sendMascoteChatMessage() em mission.js, que este código espelha.

        mascotFabFigureHtml() {
            if (this.mascotWaveVideoUrl) {
                return `<video src="${this.mascotWaveVideoUrl}" autoplay loop muted playsinline></video>`;
            }
            if (this.mascotImageUrl) {
                return `<img src="${this.mascotImageUrl}" alt="Mascote">`;
            }
            return `<span class="me-mascot-avatar--fallback"></span>`;
        }

        chatBubbleHtml(role, text, isTyping = false) {
            return `<div class="mascote-chat-bubble mascote-chat-bubble--${role}${isTyping ? ' is-typing' : ''}">${escapeHtml(text)}</div>`;
        }

        chatWelcomeHtml() {
            const username = window.exploreUsername || '';
            const suggestions = [
                'Podes explicar-me este conceito de forma simples?',
                'Podes resumir a matéria desta unidade?',
                'Podes dar-me um exemplo prático?'
            ];
            return `
                <div class="mascote-chat-welcome" id="meChatWelcome">
                    ${this.mascotDoubtsImageUrl ? `<img src="${this.mascotDoubtsImageUrl}" class="mascote-chat-welcome-video" alt="Mascote com dúvidas">` : ''}
                    <div class="mascote-chat-welcome-copy">
                        <p class="mascote-chat-welcome-greeting">${username ? `Olá, ${escapeHtml(username)}!` : 'Olá!'}</p>
                        <h3 class="mascote-chat-welcome-title">Como posso ajudar?</h3>
                        <p class="mascote-chat-welcome-subtitle">Escolhe uma sugestão ou escreve a tua pergunta!</p>
                    </div>
                    <div class="mascote-chat-suggestions">
                        ${suggestions.map((s) => `<button type="button" class="mascote-chat-suggestion" data-suggestion="${s.replace(/"/g, '&quot;')}">${escapeHtml(s)}</button>`).join('')}
                    </div>
                </div>
            `;
        }

        renderChatMessagesHtml() {
            if (!this.chatHistory.length) return this.chatWelcomeHtml();
            return this.chatHistory.map((m) => this.chatBubbleHtml(m.role, m.text)).join('');
        }

        appendChatBubble(role, text, isTyping = false) {
            const messagesEl = this.root.querySelector('#meChatMessages');
            if (!messagesEl) return null;
            this.root.querySelector('#meChatWelcome')?.remove();
            const bubble = document.createElement('div');
            bubble.className = `mascote-chat-bubble mascote-chat-bubble--${role}${isTyping ? ' is-typing' : ''}`;
            bubble.textContent = text;
            messagesEl.appendChild(bubble);
            messagesEl.scrollTop = messagesEl.scrollHeight;
            return bubble;
        }

        disableChatInput() {
            this.chatLimitReached = true;
            const input = this.root.querySelector('#meChatInput');
            const sendBtn = this.root.querySelector('#meChatSend');
            if (input) {
                input.disabled = true;
                input.placeholder = 'Sem perguntas disponíveis esta semana';
            }
            if (sendBtn) sendBtn.disabled = true;
        }

        async sendChatMessage(section) {
            const input = this.root.querySelector('#meChatInput');
            const text = input?.value.trim();
            if (!text || !this.mascoteChatUrl) return;

            input.value = '';
            this.appendChatBubble('user', text);
            const historyBeforeThisMessage = this.chatHistory.map((m) => ({ role: m.role, text: m.text }));
            this.chatHistory.push({ role: 'user', text });

            const typingEl = this.appendChatBubble('assistant', '…', true);
            const context = (this.root.querySelector('.screen-card')?.textContent || '').trim().slice(0, 6000);

            try {
                const response = await fetch(this.mascoteChatUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.csrfToken
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        message: text,
                        missionTitle: this.missao.titulo,
                        sectionTitle: section?.titulo || '',
                        context,
                        history: historyBeforeThisMessage
                    })
                });

                const data = await response.json().catch(() => ({}));
                typingEl?.remove();

                if (!response.ok) {
                    this.appendChatBubble('assistant', data.erro || 'Não consegui responder agora. Tenta mais tarde.');
                    if (data.limiteAtingido) this.disableChatInput();
                    return;
                }

                this.appendChatBubble('assistant', data.reply || '...');
                this.chatHistory.push({ role: 'assistant', text: data.reply || '' });
            } catch (error) {
                typingEl?.remove();
                this.appendChatBubble('assistant', 'Não consegui ligar ao servidor. Verifica a tua ligação.');
            }
        }

        // ---- Vista: dentro de uma secção -------------------------------------

        getScreenIndex(section) {
            return this.state.screenIndexBySection[section.secao_id] || 0;
        }

        setScreenIndex(section, index) {
            this.state.screenIndexBySection[section.secao_id] = index;
            this.saveState();
            // Limpa a marca de "popup já mostrado" ao mudar de ecrã, para
            // que voltar a um ecrã já visitado (ex: "Anterior") reavalie
            // showEntryPopupIfNeeded do zero em vez de assumir que já foi
            // tratado da última vez que lá se esteve.
            this._lastGanchoPopupKey = null;
        }

        // Classes "lesson-*"/"screen-*"/"quiz-*"/"did-you-know"/"mission-intro-callout"
        // abaixo são as mesmas de mission-styles.css usadas pelas páginas onde
        // se aprende o conteúdo da missão da Fotossíntese — reaproveitadas tal
        // e qual, para qualquer missão deste motor ter a mesma aparência.
        renderSeccao() {
            const sectionIndex = this.state.activeSectionIndex;
            const section = this.getSection(sectionIndex);
            const screens = section.ecrãs || [];
            const screenIndex = Math.max(0, Math.min(this.getScreenIndex(section), screens.length - 1));
            const screen = screens[screenIndex];
            const percent = Math.round(((screenIndex + 1) / screens.length) * 100);

            const isAnswerGate = ['micro_verificacao'].includes(screen.tipo);
            const answerKey = `${section.secao_id}::${screenIndex}`;
            const hasAnswered = !!this.state.answers[answerKey];
            const canContinue = screen.tipo === 'quiz_seccao'
                ? this.isQuizFullyAnswered(section, screen)
                : (!isAnswerGate || hasAnswered);
            const isLastScreen = screenIndex === screens.length - 1;

            // O quiz_seccao gere a sua própria progressão pergunta a
            // pergunta (ver renderQuizSeccao) — o "Continuar" genérico só
            // aparece depois de chegar ao resultado, tal como o
            // .screen-nav original escondia o botão "next" em modo quiz.
            const showNextBtn = screen.tipo !== 'quiz_seccao' || canContinue;
            const nextLabel = isLastScreen
                ? (sectionIndex === this.sections.length - 1 ? 'Concluir missão' : 'Concluir secção')
                : '';
            const nextBtnHtml = showNextBtn
                ? `
                    <button type="button"
                        class="screen-nav-btn ${nextLabel ? '' : 'screen-nav-btn--sinal'}"
                        id="meNextBtn"
                        data-nav-action="next"
                        aria-label="${nextLabel || 'Continuar'}"
                        ${canContinue ? '' : 'disabled'}>
                        ${nextLabel || '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>'}
                    </button>
                `
                : '';

            // Bolinhas numeradas entre as setas, uma por página da secção,
            // para saltar diretamente para qualquer página. Só se pode ir
            // até à primeira micro-verificação ainda por responder (tal
            // como o > fica desativado nela) — para trás, sempre.
            let ultimaAlcancavel = screens.length - 1;
            for (let j = 0; j < screens.length - 1; j++) {
                if (screens[j].tipo === 'micro_verificacao' && !this.state.answers[`${section.secao_id}::${j}`]) {
                    ultimaAlcancavel = j;
                    break;
                }
            }
            const paginasHtml = screens.length > 1
                ? `<div class="screen-nav-pages me-nav-paginas" role="group" aria-label="Páginas da secção">${screens.map((_, i) => `
                    <button type="button" class="screen-nav-page${i === screenIndex ? ' active' : ''}" data-ir-para-pagina="${i}"
                        aria-label="Página ${i + 1}"${i === screenIndex ? ' aria-current="step"' : ''}${i > ultimaAlcancavel ? ' disabled' : ''}>${i + 1}</button>`).join('')}
                   </div>`
                : '';

            let xpStat = '';
            if (window.ProfileXP) {
                try {
                    const stats = window.ProfileXP.getProfileStats(window.ProfileXP.getCurrentUserProfile());
                    xpStat = `<span class="lesson-stat">${stats.xp} XP</span>`;
                } catch (error) {
                    xpStat = '';
                }
            }

            this.root.innerHTML = `
                <div class="mission-shell ${this.chatOpen ? '' : 'is-sidebar-collapsed'} ${this.chatDocked ? 'is-chat-docked' : ''}">
                    <aside class="mission-sidebar" id="meMissionSidebar" style="--mission-sidebar-width:${this.sidebarWidth}px">
                        <div class="mascote-chat-panel">
                            <div class="mascote-chat-header">
                                <button type="button" class="mascote-chat-close" id="meChatCloseBtn" aria-label="Fechar o chat">✕</button>
                                <span>Fala com a mascote</span>
                                <button type="button" class="mascote-chat-dock-btn" id="meChatDockBtn" aria-label="${this.chatDocked ? 'Flutuar o chat' : 'Fixar o chat à página'}">
                                    ${this.chatDockIconSvg()}
                                </button>
                            </div>
                            <div class="mascote-chat-messages" id="meChatMessages">${this.renderChatMessagesHtml()}</div>
                            <form class="mascote-chat-form" id="meChatForm">
                                <input type="text" class="mascote-chat-input" id="meChatInput" placeholder="${this.chatLimitReached ? 'Sem perguntas disponíveis esta semana' : 'Escreve a tua pergunta...'}" autocomplete="off" maxlength="500" ${this.chatLimitReached ? 'disabled' : ''}>
                                <button type="submit" class="mascote-chat-send" id="meChatSend" aria-label="Enviar" ${this.chatLimitReached ? 'disabled' : ''}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                                </button>
                            </form>
                        </div>
                    </aside>
                    <div class="mission-sidebar-resize-handle" id="meSidebarResizeHandle"></div>
                    <div class="mission-main">
                        <div class="lesson-topbar">
                            <button type="button" class="lesson-topbar-close" id="meBackToMap" aria-label="Voltar ao mapa da missão">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                            <div class="lesson-topbar-titles">
                                <span class="lesson-topbar-title">${escapeHtml(section.titulo)}</span>
                                <div class="lesson-progress-row">
                                    <div class="lesson-progress-track" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100">
                                        <div class="lesson-progress-fill" style="width:${percent}%"></div>
                                    </div>
                                    <span class="lesson-progress-percent">${percent}%</span>
                                </div>
                            </div>
                            <div class="lesson-topbar-actions">
                                <div class="lesson-stats">${xpStat}</div>
                                <button type="button" class="lesson-theme-toggle" id="meThemeToggle" aria-label="Alternar modo claro/escuro">
                                    <svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
                                    <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>
                                </button>
                            </div>
                        </div>
                        <div class="mission-content">
                            <div class="section-body">
                                <div class="section-content">
                                    <div class="screen-card">${this.renderScreen(section, screen, screenIndex)}</div>
                                </div>
                                <div class="me-gancho-nav-wrap">
                                    <div class="screen-nav">
                                        <button type="button" class="screen-nav-btn screen-nav-btn--sinal" id="mePrevBtn" aria-label="Anterior" ${screenIndex === 0 ? 'disabled' : ''}><svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg></button>
                                        ${paginasHtml}
                                        ${nextBtnHtml}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <button type="button" class="mascot-chat-fab" id="meMascotFab" aria-label="Falar com a mascote" ${this.chatOpen ? 'hidden' : ''}>
                    ${this.mascotFabFigureHtml()}
                </button>
            `;

            // Ecrãs com painel principal (.me-gancho-card): a navegação passa
            // para dentro dele, nos cantos de baixo (< à esquerda, > à
            // direita). Ecrãs sem painel mantêm-na por baixo do conteúdo.
            // O resumo do quiz (.me-quiz-resultado) também é um painel
            // branco: a navegação (incluindo "Concluir secção") fica no
            // canto de baixo dele.
            const painelPrincipal = this.root.querySelector('.screen-card .me-gancho-card')
                || this.root.querySelector('.screen-card .me-quiz-resultado');
            const navegacao = this.root.querySelector('.me-gancho-nav-wrap');
            if (painelPrincipal && navegacao) {
                painelPrincipal.appendChild(navegacao);
                navegacao.classList.add('me-nav-no-painel');
            }

            this.bindScreenInteractions(section, screen, screenIndex);

            this.root.querySelector('#meBackToMap')?.addEventListener('click', () => {
                this.state.view = 'mapa';
                this.saveState();
                this.render();
            });

            this.root.querySelector('#mePrevBtn')?.addEventListener('click', () => {
                // "Anterior" só troca de ecrã — nunca mexe na pergunta
                // atual do quiz (isso é o par de setas dentro do próprio
                // painel, ver #meQuizPrevQuestionBtn/#meQuizContinueBtn em
                // renderQuizSeccao/bindScreenInteractions).
                this.setScreenIndex(section, screenIndex - 1);
                this.render();
            });

            this.root.querySelector('#meNextBtn')?.addEventListener('click', () => {
                this.advance(section, sectionIndex, screenIndex, screens);
            });

            this.root.querySelectorAll('[data-ir-para-pagina]').forEach((botao) => {
                botao.addEventListener('click', () => {
                    const destino = Number(botao.dataset.irParaPagina);
                    if (destino === screenIndex) return;
                    // Saltar para a frente conta como ter passado pelas
                    // páginas do meio (o mesmo XP que dariam com o >).
                    for (let j = screenIndex; j < destino; j++) {
                        this.awardPageXP(section, j, screens[j]);
                    }
                    this.setScreenIndex(section, destino);
                    if (destino > screenIndex) this.syncProgressWithDjango();
                    this.render();
                });
            });

            this.bindThemeToggle(this.root.querySelector('#meThemeToggle'));
            this.bindSidebarResize();

            const chatMessagesEl = this.root.querySelector('#meChatMessages');
            if (chatMessagesEl) chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

            this.root.querySelector('#meMascotFab')?.addEventListener('click', () => {
                this.chatOpen = true;
                this.render();
            });

            this.root.querySelector('#meChatCloseBtn')?.addEventListener('click', () => {
                this.chatOpen = false;
                this.render();
            });

            this.root.querySelector('#meChatDockBtn')?.addEventListener('click', () => {
                this.chatDocked = !this.chatDocked;
                this.saveChatDockedPref(this.chatDocked);
                this.render();
            });

            this.root.querySelector('#meChatForm')?.addEventListener('submit', (event) => {
                event.preventDefault();
                this.sendChatMessage(section);
            });

            this.root.querySelectorAll('.mascote-chat-suggestion').forEach((button) => {
                button.addEventListener('click', () => {
                    const input = this.root.querySelector('#meChatInput');
                    if (!input) return;
                    input.value = button.dataset.suggestion || '';
                    input.focus();
                });
            });

            this.showEntryPopupIfNeeded(section, screen, screenIndex);
        }

        advance(section, sectionIndex, screenIndex, screens) {
            // Paga a página que está a ser deixada para trás — antes de
            // qualquer outra mudança de estado, para o quiz_seccao (sempre a
            // última página de uma secção) já ter a secção incluída em
            // completedSections quando syncProgressWithDjango correr mais
            // abaixo.
            this.awardPageXP(section, screenIndex, screens[screenIndex]);

            const isLastScreen = screenIndex === screens.length - 1;

            if (!isLastScreen) {
                this.setScreenIndex(section, screenIndex + 1);
                this.syncProgressWithDjango();
                this.render();
                return;
            }

            // Última tela da secção (o quiz_seccao) — marca a secção como
            // concluída e avança para a próxima, ou celebra se for a última.
            if (!this.state.completedSections.includes(section.secao_id)) {
                this.state.completedSections.push(section.secao_id);
            }

            const isLastSection = sectionIndex === this.sections.length - 1;
            if (isLastSection) {
                this.completeMission();
                return;
            }

            this.state.activeSectionIndex = sectionIndex + 1;
            const nextSection = this.getSection(sectionIndex + 1);
            if (!(nextSection.secao_id in this.state.screenIndexBySection)) {
                this.state.screenIndexBySection[nextSection.secao_id] = 0;
            }
            this.saveState();
            this.syncProgressWithDjango();
            this.render();
        }

        // ---- Render por tipo de ecrã -----------------------------------------

        renderScreen(section, screen, screenIndex) {
            switch (screen.tipo) {
                case 'gancho': return this.renderGancho(screen);
                case 'diagrama_interativo': return this.renderDiagrama(screen);
                case 'formula_interativa': return this.renderFormulaInterativa(screen);
                case 'acordeao': return this.renderAcordeao(screen);
                case 'micro_verificacao': return this.renderMicroVerificacao(section, screen, screenIndex);
                case 'analogia': return this.renderAnalogia(screen);
                case 'aprofundar': return this.renderAprofundar(screen);
                case 'quiz_seccao': return this.renderQuizSeccao(section, screen);
                case 'atividade_laboratorial': return this.renderAtividadeLaboratorial(screen);
                case 'simulacao': return this.renderSimulacao(screen);
                default: return '';
            }
        }

        /**
         * Procura, para trás a partir de screenIndex, o ecrã de gancho ou
         * diagrama mais recente (ex: o do lago com os peixes) — usado como
         * pano de fundo visual atrás do popup de uma pergunta de
         * micro-verificação (ver renderMicroVerificacao), para o conteúdo
         * a que a pergunta se refere continuar visível.
         */
        findBackdropScreen(section, screenIndex) {
            const screens = section.ecrãs || [];
            for (let i = screenIndex - 1; i >= 0; i--) {
                if (screens[i].tipo === 'gancho' || screens[i].tipo === 'diagrama_interativo') {
                    return screens[i];
                }
            }
            return null;
        }

        /**
         * Cartão inline com o avatar + fala da mascote, reaproveitando o
         * visual de .mascot-overlay-card--split (o mesmo usado nos diálogos
         * flutuantes da Fotossíntese) mas exibido dentro do próprio ecrã em
         * vez de num modal — não há botão de fechar porque não é modal.
         */
        mascotInlineCardHtml(texto) {
            if (!this.mascotEnabled() || !texto) return '';
            const figureHtml = this.mascotImageUrl
                ? `<img class="mascot-overlay-figure" src="${this.mascotImageUrl}" alt="Mascote">`
                : `<span class="mascot-overlay-figure me-mascot-avatar--fallback"></span>`;
            return `
                <div class="mascot-overlay-card mascot-overlay-card--split me-mascot-inline">
                    <div class="mascot-overlay-split-figure">${figureHtml}</div>
                    <div class="mascot-overlay-split-body">
                        <p class="mascot-overlay-text">${escapeHtml(texto).replace(/\n/g, '<br>')}</p>
                    </div>
                </div>
            `;
        }

        renderGancho(screen) {
            // A fala da mascote nunca aparece inline aqui — todo ecrã de
            // gancho com mascote_texto abre num popup à parte (mascote à
            // esquerda, texto à direita — ver showMascotPopup, chamado
            // pelo renderSeccao/showEntryPopupIfNeeded). O painel deste
            // ecrã só leva a imagem própria (quando existe) e o título.
            if (screen.imagem) {
                return `
                    <div class="mascot-overlay-card me-mascot-inline me-gancho-card">
                        ${imagemEcraHtml(screen.imagem, 'me-gancho-hero-image', screen.titulo || '', screen.imagem_legenda)}
                        <h3 class="screen-title-lg">${escapeHtml(screen.texto)}</h3>
                    </div>
                `;
            }
            return `
                <h3 class="screen-title-lg">${escapeHtml(screen.texto)}</h3>
            `;
        }

        /**
         * Popup com a mascote à esquerda e a fala à direita — reaproveita
         * tal e qual .mascot-overlay-card--split (o mesmo diálogo modal
         * usado nas saudações/curiosidades da Fotossíntese). Chamado uma
         * vez por cada vez que se entra num ecrã de gancho com imagem
         * própria, ou no quiz de fim de secção (ver showEntryPopupIfNeeded).
         */
        mascotOverlayFigureHtml(pose) {
            // pose "pensar": mascote a pensar (a mesma imagem "com dúvidas"),
            // usada nos popups de perguntas — ver showMicroVerificacaoPopup.
            if (pose === 'pensar' && this.mascotDoubtsImageUrl) {
                return `<img class="mascot-overlay-figure" src="${this.mascotDoubtsImageUrl}" alt="Mascote a pensar">`;
            }
            if (this.mascotExplainingImageUrl) {
                return `<img class="mascot-overlay-figure" src="${this.mascotExplainingImageUrl}" alt="Mascote a explicar">`;
            }
            if (this.mascotDoubtsImageUrl) {
                return `<img class="mascot-overlay-figure" src="${this.mascotDoubtsImageUrl}" alt="Mascote com dúvidas">`;
            }
            if (this.mascotImageUrl) {
                return `<img class="mascot-overlay-figure" src="${this.mascotImageUrl}" alt="Mascote">`;
            }
            return `<span class="mascot-overlay-figure me-mascot-avatar--fallback"></span>`;
        }

        showMascotPopup(texto) {
            if (!this.mascotEnabled() || !texto) return;
            document.querySelector('.me-mascot-popup')?.remove();

            const overlay = document.createElement('div');
            overlay.className = 'mascot-overlay me-mascot-popup';
            overlay.innerHTML = `
                <div class="mascot-overlay-card mascot-overlay-card--split" role="dialog" aria-modal="true" aria-label="Mensagem da mascote">
                    <button type="button" class="mascot-overlay-close" aria-label="Fechar">✕</button>
                    <div class="mascot-overlay-split-figure">${this.mascotOverlayFigureHtml()}</div>
                    <div class="mascot-overlay-split-body">
                        <p class="mascot-overlay-text">${escapeHtml(texto).replace(/\n/g, '<br>')}</p>
                        <button type="button" class="mascot-overlay-btn">Bora explorar!</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const close = () => overlay.remove();
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) close();
            });
            overlay.querySelector('.mascot-overlay-btn')?.addEventListener('click', close);
            overlay.querySelector('.mascot-overlay-close')?.addEventListener('click', close);
        }

        /** Só mostra o popup na primeira vez que se entra neste ecrã em
         *  concreto — reentradas por causa de outro re-render (ex: abrir/
         *  fechar o chat) não o voltam a mostrar. */
        showEntryPopupIfNeeded(section, screen, screenIndex) {
            const popupKey = `${section.secao_id}::${screenIndex}`;
            if (this._lastGanchoPopupKey === popupKey) return;

            // Nas analogias sem cartao_estilo, o mascote_texto já aparece
            // inline (ver mascotInlineCardHtml em renderAnalogia) — só as
            // de cartao_estilo (sem esse cartão inline) entram aqui, para
            // não sair duplicado (popup + cartão inline ao mesmo tempo).
            const temGancho = screen.tipo === 'gancho'
                || screen.tipo === 'diagrama_interativo'
                || (screen.tipo === 'analogia' && screen.cartao_estilo);
            if (temGancho && screen.mascote_texto) {
                this._lastGanchoPopupKey = popupKey;
                this.showMascotPopup(screen.mascote_texto);
                return;
            }

            // Ao chegar ao quiz da secção (só na primeira pergunta, antes
            // de qualquer resposta), avisa que vem aí um desafio — genérico
            // do motor, não depende de nenhum campo do JSON da missão.
            if (screen.tipo === 'quiz_seccao') {
                const quizState = this.getQuizState(section);
                if (quizState.current === 0 && quizState.answers.length === 0) {
                    this._lastGanchoPopupKey = popupKey;
                    this.showMascotPopup(`Agora que já viste "${section.titulo}", tenho um desafio para ti.`);
                }
                return;
            }

            // Perguntas de micro-verificação: a pergunta e as opções
            // aparecem sempre num popup (mascote à esquerda, pergunta +
            // opções à direita) ao entrar neste ecrã — tanto na primeira
            // vez como ao voltar a ele com "Anterior" (nesse caso em modo
            // de revisão, já com a resposta e o feedback visíveis) — para
            // nunca haver um ecrã por baixo só com o feedback (ver
            // renderMicroVerificacao).
            if (screen.tipo === 'micro_verificacao' && screen.pergunta) {
                this._lastGanchoPopupKey = popupKey;
                this.showMicroVerificacaoPopup(section, screen, screenIndex);
            }
        }

        /**
         * Popup de pergunta: igual ao mascot-overlay-card--split (mascote à
         * esquerda), mas o lado direito é a própria pergunta com as opções
         * clicáveis, em vez de só texto + botão "Entendido" — responder
         * aqui grava a resposta tal como responder no ecrã (mesma
         * data-option-index e mesma chave em this.state.answers, ver
         * bindScreenInteractions). O feedback (certo/errado) aparece dentro
         * do próprio popup, junto da mascote e da pergunta. Se a pergunta
         * já tinha sido respondida antes (ex: ao rever com "Anterior", ou um
         * aluno que já terminou o quiz e está a rever a matéria), abre logo
         * em modo de revisão — opções e feedback já preenchidos — e
         * "Continuar" (tal como o X e clicar fora) só fecha o popup, sem
         * avançar de ecrã. Avançar automaticamente aqui prendia quem revê
         * para trás com "Anterior" num ciclo: o clique em "Continuar"
         * empurrava-o de volta para a frente, e o "Anterior" seguinte
         * voltava a mostrar o mesmo popup.
         */
        showMicroVerificacaoPopup(section, screen, screenIndex) {
            if (!this.mascotEnabled()) return;
            document.querySelector('.me-mascot-popup')?.remove();

            const answerKey = `${section.secao_id}::${screenIndex}`;
            const saved = this.state.answers[answerKey];

            const optionsHtml = (screen.opcoes || []).map((opcao, i) => {
                let stateClass = '';
                if (saved) {
                    if (i === screen.correta) stateClass = 'correct';
                    else if (i === saved.selected) stateClass = 'incorrect';
                }
                return `
                    <button type="button" class="quiz-option ${stateClass}" data-option-index="${i}" ${saved ? 'disabled' : ''}>
                        <span class="option-letter">${String.fromCharCode(65 + i)}</span>
                        <span class="option-text">${escapeHtml(opcao)}</span>
                    </button>
                `;
            }).join('');

            const feedbackSlotHtml = saved
                ? `
                    ${this.buildFeedbackHtml(saved.correct, screen.mascote_feedback_certo, screen.mascote_feedback_errado)}
                    <button type="button" class="mascot-overlay-btn">Continuar</button>
                `
                : '';

            const overlay = document.createElement('div');
            overlay.className = 'mascot-overlay me-mascot-popup';
            overlay.innerHTML = `
                <div class="mascot-overlay-card mascot-overlay-card--split" role="dialog" aria-modal="true" aria-label="Pergunta">
                    <button type="button" class="mascot-overlay-close" aria-label="Fechar">✕</button>
                    <div class="mascot-overlay-split-figure">${this.mascotOverlayFigureHtml('pensar')}</div>
                    <div class="mascot-overlay-split-body">
                        <p class="mascot-overlay-text quiz-question">${escapeHtml(screen.pergunta)}</p>
                        <div class="quiz-options" data-answer-key="${answerKey}">${optionsHtml}</div>
                        <div class="me-popup-feedback-slot">${feedbackSlotHtml}</div>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            if (saved) {
                // Modo de revisão: já respondida antes — "Continuar", o X e
                // clicar fora fecham sem avançar de ecrã, para o aluno poder
                // navegar livremente (para a frente ou para trás) com as
                // setas da própria página.
                const closeReview = () => overlay.remove();
                overlay.querySelector('.mascot-overlay-btn')?.addEventListener('click', closeReview);
                overlay.querySelector('.mascot-overlay-close')?.addEventListener('click', closeReview);
                overlay.addEventListener('click', (event) => {
                    if (event.target === overlay) closeReview();
                });
                return;
            }

            const screens = section.ecrãs || [];
            const sectionIndex = this.state.activeSectionIndex;

            // O X fecha sem responder nem avançar — o aluno volta a ver o
            // ecrã por baixo (o diagrama/gancho, via findBackdropScreen em
            // renderMicroVerificacao) e reabre a pergunta ao navegar de novo
            // para este ecrã (ver showEntryPopupIfNeeded).
            overlay.querySelector('.mascot-overlay-close')?.addEventListener('click', () => overlay.remove());

            // Sem botão de "Entendido" nem fecho ao clicar fora: como o
            // ecrã por baixo já não mostra a pergunta/opções nem repete o
            // feedback (ver renderMicroVerificacao), o botão "Continuar"
            // (depois de responder) avança logo para o ecrã seguinte, em
            // vez de deixar o aluno num ecrã residual só com o feedback.
            overlay.querySelectorAll('[data-option-index]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const selected = Number(btn.dataset.optionIndex);
                    const correct = selected === screen.correta;
                    this.state.answers[answerKey] = { selected, correct };
                    this.saveState();
                    if (correct) this.celebrateCorrectAnswer();

                    overlay.querySelectorAll('[data-option-index]').forEach((optionBtn) => {
                        const optionIndex = Number(optionBtn.dataset.optionIndex);
                        optionBtn.disabled = true;
                        if (optionIndex === screen.correta) optionBtn.classList.add('correct');
                        else if (optionIndex === selected) optionBtn.classList.add('incorrect');
                    });

                    const slot = overlay.querySelector('.me-popup-feedback-slot');
                    if (slot) {
                        slot.innerHTML = `
                            ${this.buildFeedbackHtml(correct, screen.mascote_feedback_certo, screen.mascote_feedback_errado)}
                            <button type="button" class="mascot-overlay-btn">Continuar</button>
                        `;
                        slot.querySelector('.mascot-overlay-btn')?.addEventListener('click', () => {
                            overlay.remove();
                            this.advance(section, sectionIndex, screenIndex, screens);
                        });
                    }
                });
            });
        }

        /**
         * Formato alternativo aos chips: pontos numa linha do tempo
         * horizontal, com o nome em diagonal por cima do ponto e o ano por
         * baixo (extraído de labels do tipo "Nome (ano)"). Só é usado quando
         * o próprio ecrã pede explicitamente screen.layout === "timeline"
         * (ver renderDiagrama) — os outros diagramas mantêm os chips atuais.
         * Reaproveita a classe "me-diagrama-chip" e o atributo
         * data-ponto-index nos botões para que o clique continue a
         * funcionar tal e qual (ver bindScreenInteractions), sem precisar
         * de nenhuma lógica de clique nova.
         */
        renderDiagramaTimeline(pontos) {
            const itemsHtml = pontos.map((ponto, i) => {
                const partido = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(ponto.label || '');
                const nome = partido ? partido[1].trim() : (ponto.label || '');
                const ano = partido ? partido[2].trim() : '';
                return `
                    <li class="me-timeline-item">
                        ${nome ? `<span class="me-timeline-label">${escapeHtml(nome)}</span>` : ''}
                        <button type="button" class="me-diagrama-chip me-timeline-dot" data-ponto-index="${i}" aria-label="${escapeHtml(ponto.label || '')}" title="${escapeHtml(ponto.label || '')}"></button>
                        ${ano ? `<span class="me-timeline-caption">${escapeHtml(ano)}</span>` : ''}
                    </li>
                `;
            }).join('');

            return `
                <div class="me-timeline-scroll">
                    <div class="me-timeline-rail-wrap">
                        <div class="me-timeline-rail" aria-hidden="true"></div>
                        <ol class="me-timeline-dots" role="list">${itemsHtml}</ol>
                    </div>
                </div>
            `;
        }

        /** Caixa destacada com as fórmulas de um ecrã de diagrama (Física,
         *  ver screen.caixa_formula) — lista de { expressao, significado,
         *  unidades }, cada uma num bloco próprio dentro da mesma caixa. */
        caixaFormulaHtml(caixaFormula) {
            if (!Array.isArray(caixaFormula) || caixaFormula.length === 0) return '';
            const itensHtml = caixaFormula.map((formula) => `
                <div class="me-caixa-formula-item">
                    <p class="me-caixa-formula-expressao">${escapeHtml(formula.expressao || '')}</p>
                    ${formula.significado ? `<p class="me-caixa-formula-significado">${boldMarkdown(escapeHtml(formula.significado))}</p>` : ''}
                    ${Array.isArray(formula.unidades)
                        ? `<ul class="me-caixa-formula-unidades me-caixa-formula-unidades-lista">${formula.unidades.map((u) => `<li>${boldMarkdown(escapeHtml(u))}</li>`).join('')}</ul>`
                        : (formula.unidades ? `<p class="me-caixa-formula-unidades">${escapeHtml(formula.unidades)}</p>` : '')}
                </div>
            `).join('');
            return `<div class="me-caixa-formula">${itensHtml}</div>`;
        }

        /** Tabelas de dados de um ecrã de diagrama (ver screen.tabelas) —
         *  lista de { titulo, colunas, linhas }, lado a lado quando há
         *  espaço. Cada tabela tem scroll horizontal próprio para se ler
         *  no telemóvel sem empurrar a página para os lados. */
        tabelasHtml(tabelas) {
            if (!Array.isArray(tabelas) || tabelas.length === 0) return '';
            const tabelaHtml = (tabela) => `
                <figure class="me-tabela">
                    ${tabela.titulo ? `<figcaption class="me-tabela-titulo">${escapeHtml(tabela.titulo)}</figcaption>` : ''}
                    <div class="me-tabela-scroll">
                        <table>
                            <thead><tr>${(tabela.colunas || []).map((c) => `<th scope="col">${escapeHtml(c)}</th>`).join('')}</tr></thead>
                            <tbody>${(tabela.linhas || []).map((linha) => `<tr>${linha.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
                        </table>
                    </div>
                    ${tabela.nota ? `<p class="me-tabela-nota">${escapeHtml(tabela.nota)}</p>` : ''}
                </figure>
            `;
            return `<div class="me-tabelas${tabelas.length > 1 ? ' me-tabelas--lado-a-lado' : ''}">${tabelas.map(tabelaHtml).join('')}</div>`;
        }

        /** Escada de conversão de unidades (ver screen.escada_conversao):
         *  { titulo, unidades: [{ simbolo, expoente }], passo } — os degraus
         *  vão da unidade maior para a mais pequena, com "× 10^passo" por
         *  cima (para a direita) e "× 10^-passo" por baixo (para a
         *  esquerda). Por baixo, um conversor: o aluno escreve um valor,
         *  escolhe a unidade (no menu ou clicando num degrau) e vê o mesmo
         *  valor em todas as unidades da escada (ver bindEscadaConversao). */
        escadaConversaoHtml(escada) {
            if (!escada || !Array.isArray(escada.unidades) || escada.unidades.length === 0) return '';
            const unidades = escada.unidades;
            const sup = (n) => String(n).split('').map((c) => SUPERSCRITOS[c] || c).join('');
            const passo = escada.passo || 3;
            const inicial = escada.unidade_inicial || unidades[0].simbolo;
            const degrausHtml = unidades.map((u, i) => `
                ${i > 0 ? `
                    <span class="me-escada-conv-seta" aria-hidden="true">
                        <span class="me-escada-conv-seta-dir">× 10${sup(passo)}<i>→</i></span>
                        <span class="me-escada-conv-seta-esq"><i>←</i>× 10${sup(-passo)}</span>
                    </span>` : ''}
                <button type="button" class="me-escada-conv-degrau${u.simbolo === inicial ? ' is-active' : ''}" data-escada-unidade="${escapeAttr(u.simbolo)}">${escapeHtml(u.simbolo)}</button>
            `).join('');
            const opcoesHtml = unidades.map((u) => `<option value="${escapeAttr(u.simbolo)}"${u.simbolo === inicial ? ' selected' : ''}>${escapeHtml(u.simbolo)}</option>`).join('');
            return `
                <div class="me-escada-conv" data-escada-conv='${escapeAttr(JSON.stringify(unidades))}'>
                    ${escada.titulo ? `<p class="me-escada-conv-titulo">${escapeHtml(escada.titulo)}</p>` : ''}
                    <div class="me-escada-conv-scroll"><div class="me-escada-conv-degraus">${degrausHtml}</div></div>
                    <div class="me-escada-conv-form">
                        <label>Valor <input type="text" inputmode="decimal" class="me-escada-conv-valor" value="${escapeAttr(escada.valor_inicial || '1')}"></label>
                        <label>Unidade <select class="me-escada-conv-unidade">${opcoesHtml}</select></label>
                    </div>
                    <ul class="me-escada-conv-resultados" aria-live="polite"></ul>
                </div>
            `;
        }

        bindEscadaConversao() {
            this.root.querySelectorAll('.me-escada-conv').forEach((escada) => {
                if (escada.dataset.bound === 'true') return;
                escada.dataset.bound = 'true';
                let unidades;
                try { unidades = JSON.parse(escada.dataset.escadaConv); } catch (e) { return; }
                const input = escada.querySelector('.me-escada-conv-valor');
                const select = escada.querySelector('.me-escada-conv-unidade');
                const lista = escada.querySelector('.me-escada-conv-resultados');
                // Até 4 algarismos significativos, sem zeros à direita
                // (154 em vez de 154,0).
                const formatar = (x) => formatarNumero(x, 4).split(' × ')
                    .map((parte, i) => (i === 0 ? parte.replace(/(,\d*?)0+$/, '$1').replace(/,$/, '') : parte))
                    .join(' × ');
                const atualizar = () => {
                    const valor = Number(String(input.value).trim().replace(/\s/g, '').replace(',', '.'));
                    const origem = unidades.find((u) => u.simbolo === select.value);
                    escada.querySelectorAll('[data-escada-unidade]').forEach((b) => b.classList.toggle('is-active', b.dataset.escadaUnidade === select.value));
                    if (!origem || input.value.trim() === '' || !Number.isFinite(valor)) {
                        lista.innerHTML = '<li class="me-escada-conv-aviso">Escreve um número (podes usar vírgula).</li>';
                        return;
                    }
                    lista.innerHTML = unidades.map((u) => `
                        <li class="${u.simbolo === origem.simbolo ? 'is-active' : ''}">
                            <span class="me-escada-conv-res-valor">${escapeHtml(formatar(valor * Math.pow(10, origem.expoente - u.expoente)))}</span>
                            <span class="me-escada-conv-res-unidade">${escapeHtml(u.simbolo)}</span>
                        </li>
                    `).join('');
                };
                input.addEventListener('input', atualizar);
                select.addEventListener('change', atualizar);
                escada.querySelectorAll('[data-escada-unidade]').forEach((botao) => {
                    botao.addEventListener('click', () => {
                        select.value = botao.dataset.escadaUnidade;
                        atualizar();
                    });
                });
                atualizar();
            });
        }

        /** Botão colapsável "Saber mais" com ponto.saber_mais, se existir —
         *  usado tanto no cartão "Nível X de N" (pontoDetailInnerHtml) como
         *  no painel "did-you-know" genérico (ver bindDiagramaChips), para
         *  não duplicar este bocado de HTML nos dois formatos. */
        saberMaisHtml(ponto) {
            if (!ponto.saber_mais) return '';
            return `
                <details class="me-ponto-saber-mais">
                    <summary>Saber mais</summary>
                    <p>${escapeHtml(ponto.saber_mais)}</p>
                </details>
            `;
        }

        /**
         * Caixa do exercício do ponto selecionado (ver ponto.exercicio:
         * { enunciado, campos: [{ rotulo, unidade, correta | aceites,
         * tolerancia }], resolucao, resposta }). Fica por baixo do cartão e
         * muda a cada chip — só aparece o exercício do ponto que o aluno
         * está a estudar (ver bindDiagramaChips). O aluno escreve a
         * resposta e carrega em "Verificar": certo → "Certo!"; errado →
         * "Tenta outra vez". "Ver resolução" só aparece depois da primeira
         * tentativa. As respostas ficam guardadas só enquanto a página
         * está aberta (this.exercicioEstado).
         */
        exercicioChave(screen, ponto) {
            return `${screen.titulo || ''}::${ponto.id || ponto.label}`;
        }

        exercicioPontoHtml(screen, ponto) {
            const ex = ponto && ponto.exercicio;
            if (!ex || !ex.enunciado) return '';
            const campos = Array.isArray(ex.campos) ? ex.campos : [];
            const estado = this.exercicioEstado[this.exercicioChave(screen, ponto)] || {};
            const camposHtml = campos.map((campo, i) => {
                const numerico = campo.correta !== undefined && campo.correta !== null;
                const classe = estado.campos ? ` is-${estado.campos[i]}` : '';
                return `
                    <label class="me-ex-campo${classe}">
                        ${campo.rotulo ? `<span class="me-ex-rotulo">${escapeHtml(campo.rotulo)} =</span>` : ''}
                        <input type="text" class="me-ex-input" data-ex-campo="${i}" inputmode="${numerico ? 'decimal' : 'text'}" autocomplete="off" placeholder="${numerico ? 'A tua resposta' : 'Escreve a tua resposta'}" value="${escapeAttr((estado.valores || [])[i] || '')}">
                        ${numerico && !campo.sem_potencia ? '<button type="button" class="me-ex-potencia" data-ex-potencia aria-label="Inserir × 10 elevado a" title="Inserir × 10^">×10<sup>n</sup></button>' : ''}
                        ${campo.unidade ? `<span class="me-ex-unidade">${escapeHtml(campo.unidade)}</span>` : ''}
                    </label>
                `;
            }).join('');
            // Botão redondo de enviar, ao lado da última resposta (substitui o
            // antigo botão "Verificar"; o data-ex-verificar é o que o liga).
            const enviarHtml = `<button type="button" class="me-ex-enviar" data-ex-verificar aria-label="Enviar resposta" title="Enviar resposta"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/></svg></button>`;
            const passosHtml = (Array.isArray(ex.resolucao) ? ex.resolucao : []).map((p) => `<p>${boldMarkdown(escapeHtml(p))}</p>`).join('');
            const respostaHtml = ex.resposta ? `<p><strong>Resposta:</strong> ${boldMarkdown(escapeHtml(ex.resposta))}</p>` : '';
            // Painel de resultado depois de verificar: vermelho "Resposta
            // Incorreta" ou verde "Resposta Correta", com o botão "Ver
            // explicação" (a resolução só abre ao clicar).
            const ICONES = {
                certo: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
                quase: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
                errado: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
            };
            const TITULOS = {
                certo: 'Resposta Correta',
                quase: 'Estás quase, mas falta qualquer coisinha...',
                errado: 'Tenta outra vez',
            };
            const iconeResultado = ICONES[estado.resultado];
            const svgIcone = (caminhos, tamanho) => `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${caminhos}</svg>`;
            const semCampos = !campos.length;
            const explicacaoHtml = (passosHtml || respostaHtml)
                ? `
                    <button type="button" class="me-ex-explicacao-btn" data-ex-resolucao aria-expanded="${estado.resolucaoAberta ? 'true' : 'false'}">
                        ${svgIcone('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>', 16)}
                        <span>${estado.resolucaoAberta ? (semCampos ? 'Esconder resposta' : 'Esconder explicação') : (semCampos ? 'Ver resposta' : 'Ver explicação')}</span>
                    </button>
                    <div class="me-ex-resolucao"${estado.resolucaoAberta ? '' : ' hidden'}>${passosHtml}${respostaHtml}</div>
                `
                : '';
            const painelHtml = estado.resultado
                ? `
                    <div class="me-ex-painel is-${estado.resultado}" role="status">
                        <p class="me-ex-painel-titulo">${svgIcone(iconeResultado, 20)}<span>${TITULOS[estado.resultado]}</span></p>
                        ${explicacaoHtml}
                    </div>
                `
                : '';
            return `
                <div class="me-caixa-exercicio">
                    <div class="me-caixa-formula">
                        <div class="me-caixa-formula-item">
                            <p class="me-caixa-formula-expressao"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ex.icone === 'alvo' ? '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>' : '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>'}</svg><span>${escapeHtml(ex.titulo || 'Exercício')}</span></p>
                            <p class="me-caixa-formula-significado">${boldMarkdown(escapeHtml(ex.enunciado))}</p>
                            ${camposHtml ? `<div class="me-ex-campos">${camposHtml}${enviarHtml}</div>` : ''}
                            ${painelHtml}
                            ${semCampos ? `<div class="me-ex-sem-campos">${explicacaoHtml}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        /** Liga (uma só vez por caixa) os cliques de "Verificar" e "Ver
         *  resolução" e o Enter nas respostas — por delegação, para
         *  continuar a funcionar quando a caixa é redesenhada ao mudar de
         *  chip. O ponto e o ecrã atuais ficam em container._exPonto/_exScreen. */
        bindExercicio(container, screen, ponto) {
            container._exScreen = screen;
            container._exPonto = ponto;
            if (container.dataset.exDelegado) return;
            container.dataset.exDelegado = '1';
            const redesenhar = (focoIndex) => {
                container.innerHTML = this.exercicioPontoHtml(container._exScreen, container._exPonto);
                if (focoIndex !== undefined) container.querySelector(`[data-ex-campo="${focoIndex}"]`)?.focus();
            };
            const verificar = () => {
                const ex = container._exPonto.exercicio;
                const campos = ex.campos || [];
                const valores = Array.from(container.querySelectorAll('[data-ex-campo]')).map((el) => el.value);
                const avaliacoes = campos.map((campo, i) => avaliarResposta(campo, valores[i]));
                const chave = this.exercicioChave(container._exScreen, container._exPonto);
                const anterior = this.exercicioEstado[chave] || {};
                // Tudo certo → certo; tudo certo ou quase → "estás quase";
                // senão errado.
                const resultado = avaliacoes.every((a) => a === 'certo')
                    ? 'certo'
                    : (avaliacoes.every((a) => a !== 'errado') ? 'quase' : 'errado');
                this.exercicioEstado[chave] = {
                    valores,
                    campos: avaliacoes,
                    resultado,
                    resolucaoAberta: anterior.resolucaoAberta || false,
                };
                const primeiroErrado = avaliacoes.findIndex((a) => a !== 'certo');
                redesenhar(primeiroErrado === -1 ? undefined : primeiroErrado);
            };
            container.addEventListener('click', (event) => {
                const botaoPotencia = event.target.closest('[data-ex-potencia]');
                if (botaoPotencia) {
                    // Escreve "×10^" no sítio do cursor, para o aluno só ter de
                    // pôr o expoente (o teclado não tem o 10⁵ com o 5 em cima).
                    const input = botaoPotencia.closest('.me-ex-campo')?.querySelector('[data-ex-campo]');
                    if (input) {
                        const inicio = input.selectionStart ?? input.value.length;
                        const fim = input.selectionEnd ?? inicio;
                        const texto = '×10^';
                        input.value = input.value.slice(0, inicio) + texto + input.value.slice(fim);
                        const cursor = inicio + texto.length;
                        input.focus();
                        input.setSelectionRange(cursor, cursor);
                    }
                    return;
                }
                if (event.target.closest('[data-ex-verificar]')) {
                    verificar();
                    return;
                }
                if (event.target.closest('[data-ex-resolucao]')) {
                    const chave = this.exercicioChave(container._exScreen, container._exPonto);
                    // Sem campos de resposta (só "Ver resposta") ainda não há estado.
                    const estado = this.exercicioEstado[chave] || (this.exercicioEstado[chave] = {});
                    estado.resolucaoAberta = !estado.resolucaoAberta;
                    redesenhar();
                }
            });
            container.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && event.target.matches('[data-ex-campo]')) {
                    event.preventDefault();
                    verificar();
                }
            });
        }

        /** Botão colapsável "💡 Dica de estudo" com ponto.dica_estudo, se
         *  existir — mesmo mecanismo de saberMaisHtml, mas com rótulo e
         *  ícone próprios para uma dica de estudo (ex: uma analogia). */
        dicaEstudoHtml(ponto) {
            if (!ponto.dica_estudo) return '';
            return `
                <details class="me-ponto-dica-estudo">
                    <summary>💡 Dica de estudo</summary>
                    <p>${escapeHtml(ponto.dica_estudo)}</p>
                </details>
            `;
        }

        /** Botão com o ícone da lâmpada (SVG, não o emoji) alinhado horizontalmente com o texto da explicação
         *  (ver .me-escada-detail-text-row no CSS), com ponto.curiosidade
         *  revelado numa faixa por baixo, a toda a largura — não usa
         *  <details>/<summary> como saberMaisHtml/dicaEstudoHtml porque o
         *  texto da explicação (sempre visível) e o da curiosidade
         *  (escondido até se clicar) têm de poder ficar lado a lado sem
         *  partilhar o mesmo elemento de disclosure nativo, que esconderia
         *  os dois juntos. Ver bindCuriosidadeToggle para a interação. */
        curiosidadeToggleHtml(ponto) {
            if (!ponto.curiosidade) return '';
            return `<button type="button" class="me-ponto-curiosidade-toggle" aria-expanded="false" aria-label="Ver curiosidade"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg></button>`;
        }

        curiosidadeRevealHtml(ponto) {
            if (!ponto.curiosidade) return '';
            return `<div class="me-ponto-curiosidade-reveal" hidden>${ponto.curiosidade_sem_titulo ? '' : '<p class="me-ponto-curiosidade-titulo">Sabias que...</p>'}${textToHtml(ponto.curiosidade)}</div>`;
        }

        /** Liga o clique no 💡 (ver curiosidadeToggleHtml) a mostrar/esconder
         *  curiosidadeRevealHtml — chamado nos mesmos dois sítios que os
         *  outros binds do ponto (ver bindDiagramaChips), pelo mesmo
         *  motivo: o conteúdo do cartão é recriado de raiz a cada clique
         *  num ponto diferente, por isso precisa de se ligar de novo de
         *  cada vez. */
        bindCuriosidadeToggle(container) {
            const toggle = container.querySelector('.me-ponto-curiosidade-toggle');
            const reveal = container.querySelector('.me-ponto-curiosidade-reveal');
            if (!toggle || !reveal || toggle.dataset.bound === 'true') return;
            toggle.dataset.bound = 'true';
            toggle.addEventListener('click', () => {
                const isOpen = toggle.getAttribute('aria-expanded') === 'true';
                toggle.setAttribute('aria-expanded', String(!isOpen));
                reveal.hidden = isOpen;
            });
        }

        /** Mesmo mecanismo de curiosidadeToggleHtml/curiosidadeRevealHtml,
         *  mas com ícone de aviso (⚠️) e ponto.atencao — para avisar de um
         *  erro comum ou confusão frequente (ex: Espécie → "não confundas
         *  com raça"), com estilo próprio (âmbar) em vez do da curiosidade
         *  (verde), para se distinguir como um alerta, não só um extra. */
        atencaoToggleHtml(ponto) {
            if (!ponto.atencao) return '';
            return `<button type="button" class="me-ponto-atencao-toggle" aria-expanded="false" aria-label="Ver aviso">⚠️</button>`;
        }

        atencaoRevealHtml(ponto) {
            if (!ponto.atencao) return '';
            return `<div class="me-ponto-atencao-reveal" hidden>${textToHtml(ponto.atencao)}</div>`;
        }

        bindAtencaoToggle(container) {
            const toggle = container.querySelector('.me-ponto-atencao-toggle');
            const reveal = container.querySelector('.me-ponto-atencao-reveal');
            if (!toggle || !reveal || toggle.dataset.bound === 'true') return;
            toggle.dataset.bound = 'true';
            toggle.addEventListener('click', () => {
                const isOpen = toggle.getAttribute('aria-expanded') === 'true';
                toggle.setAttribute('aria-expanded', String(!isOpen));
                reveal.hidden = isOpen;
            });
        }

        /** Seta para baixo, sem texto, com ponto.proxima_missao_texto — usada
         *  para dar um "teaser" de uma missão futura relacionada com este
         *  ponto (ex: Biomolécula → teaser de Células e Organelos), sem
         *  competir com o rótulo "Saber mais"/"💡 Dica de estudo". Mesmo
         *  mecanismo <details> dos outros, só muda o conteúdo do summary.
         *  O texto revelado fica dentro do seu próprio painel (ainda
         *  aninhado no cartão do ponto, não um ecrã à parte), com uma seta
         *  que já leva direto à missão em si (ponto.proxima_missao_id) se
         *  vier preenchido. */
        proximaMissaoHtml(ponto) {
            if (!ponto.proxima_missao_texto) return '';
            const linkHtml = ponto.proxima_missao_id
                ? `
                    <a class="me-proxima-missao-link" href="/missao/${encodeURIComponent(ponto.proxima_missao_id)}/" aria-label="Ir para a missão">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </a>
                `
                : '';
            return `
                <details class="me-ponto-proxima-missao">
                    <summary aria-label="Ver mais">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </summary>
                    <div class="me-proxima-missao-card">
                        <p>${boldMarkdown(escapeHtml(ponto.proxima_missao_texto))}</p>
                        ${linkHtml}
                    </div>
                </details>
            `;
        }

        /** Minúsculas e sem acentos, para comparar o que o aluno escreve no
         *  "Outro" do inquérito (ver bindInquerito) sem depender de
         *  maiúsculas/acentos exatos — ex: "Esquelético" e "esqueletico"
         *  têm de dar o mesmo resultado. */
        normalizarTexto(valor) {
            return String(valor ?? '')
                .normalize('NFD')
                .replace(/[̀-ͯ]/g, '')
                .toLowerCase()
                .trim();
        }

        /**
         * Painel branco com uma pergunta de opinião (ponto.inquerito),
         * dentro da coluna de texto do ponto — ao escolher uma opção,
         * mostra uma curiosidade específica dessa escolha. Inclui sempre um
         * botão final "Outro" com um campo de texto: o aluno escreve um
         * sistema que não esteja na lista e recebe uma curiosidade
         * correspondente (ponto.inquerito.outro.opcoes_extra) ou, sem
         * correspondência, uma curiosidade genérica — nunca fica sem
         * resposta. Ver bindInquerito para a lógica de comparação.
         */
        inqueritoHtml(ponto) {
            const inquerito = ponto.inquerito;
            if (!inquerito || !Array.isArray(inquerito.opcoes) || inquerito.opcoes.length === 0) return '';
            const opcoesHtml = inquerito.opcoes.map((opcao, i) => `
                <button type="button" class="me-inquerito-opcao" data-opcao-index="${i}">${escapeHtml(opcao.label)}</button>
            `).join('');
            const outroHtml = inquerito.outro ? `
                <button type="button" class="me-inquerito-opcao me-inquerito-opcao--outro" data-outro-trigger="true">Outro</button>
                <div class="me-inquerito-outro-form" hidden>
                    <input type="text" class="me-inquerito-outro-input" placeholder="${escapeHtml(inquerito.outro.placeholder || 'Escreve outro sistema...')}" maxlength="60">
                    <button type="button" class="me-inquerito-outro-submit">Ver curiosidade</button>
                </div>
            ` : '';
            return `
                <div class="me-ponto-inquerito" aria-hidden="false">
                    <p class="me-inquerito-pergunta">${escapeHtml(inquerito.pergunta || '')}</p>
                    <div class="me-inquerito-opcoes">${opcoesHtml}${outroHtml}</div>
                    <div class="me-inquerito-resultado" hidden></div>
                </div>
            `;
        }

        /** Liga o clique numa opção do inquérito (ver inqueritoHtml) a
         *  mostrar a curiosidade dessa opção específica e destacá-la entre
         *  as restantes, e liga o botão/campo "Outro" à mesma lógica —
         *  chamado a par dos outros binds do ponto. */
        bindInquerito(container, ponto) {
            const painel = container.querySelector('.me-ponto-inquerito');
            const inquerito = ponto?.inquerito;
            if (!painel || !inquerito || painel.dataset.bound === 'true') return;
            painel.dataset.bound = 'true';

            const resultado = painel.querySelector('.me-inquerito-resultado');
            const marcarSelecionado = (botaoAtivo) => {
                painel.querySelectorAll('.me-inquerito-opcao').forEach((btn) => btn.classList.remove('is-selected'));
                botaoAtivo?.classList.add('is-selected');
            };
            const mostrarResultado = (texto) => {
                if (!resultado) return;
                resultado.hidden = false;
                resultado.textContent = texto;
            };

            painel.querySelectorAll('.me-inquerito-opcao[data-opcao-index]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const opcao = inquerito.opcoes[Number(btn.dataset.opcaoIndex)];
                    if (!opcao) return;
                    marcarSelecionado(btn);
                    mostrarResultado(opcao.curiosidade || '');
                });
            });

            const outroTrigger = painel.querySelector('[data-outro-trigger]');
            const outroForm = painel.querySelector('.me-inquerito-outro-form');
            const outroInput = painel.querySelector('.me-inquerito-outro-input');
            const outroSubmit = painel.querySelector('.me-inquerito-outro-submit');
            if (!outroTrigger || !outroForm || !outroInput || !outroSubmit || !inquerito.outro) return;

            outroTrigger.addEventListener('click', () => {
                marcarSelecionado(outroTrigger);
                outroForm.hidden = !outroForm.hidden;
                if (!outroForm.hidden) outroInput.focus();
            });

            const responderOutro = () => {
                const escrito = this.normalizarTexto(outroInput.value);
                if (!escrito) return;

                // Procura primeiro entre as opções já com botão próprio (ex:
                // o aluno escreve "digestivo" em vez de clicar no botão),
                // depois nas extra só disponíveis por aqui (ver JSON).
                const todasAsFontes = [
                    ...inquerito.opcoes.map((opcao) => ({ chave: opcao.label, curiosidade: opcao.curiosidade })),
                    ...Object.entries(inquerito.outro.opcoes_extra || {}).map(([chave, curiosidade]) => ({ chave, curiosidade })),
                ];
                const encontrada = todasAsFontes.find(({ chave }) => {
                    const chaveNormalizada = this.normalizarTexto(chave);
                    return chaveNormalizada && (escrito.includes(chaveNormalizada) || chaveNormalizada.includes(escrito));
                });

                mostrarResultado(encontrada ? encontrada.curiosidade : (inquerito.outro.generica || ''));
            };

            outroSubmit.addEventListener('click', responderOutro);
            outroInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    responderOutro();
                }
            });
        }

        /**
         * Conteúdo do cartão "Nível X de N" (ver .me-escada-detail no CSS) —
         * imagem à esquerda, linha divisória subtil ao meio, texto (título,
         * explicação e extras) à direita — ver .me-escada-detail-columns no
         * CSS. Sem imagem, o texto ocupa a largura toda (sem coluna nem
         * divisória). Reaproveitado tanto no primeiro render (escada/
         * árvore/cartao_estilo, sempre com um ponto pré-selecionado) como
         * no clique num ponto (ver bindDiagramaChips), para não duplicar
         * este bocado de HTML nos dois sítios.
         */
        pontoDetailInnerHtml(ponto) {
            const imagemHtml = ponto.imagem ? `<img class="me-escada-detail-image" src="/static/images/${encodeURIComponent(ponto.imagem)}" alt="${escapeHtml(ponto.label || '')}" onerror="this.style.display='none'">` : '';
            const conteudoHtml = `
                <h4 class="me-escada-detail-title">${escapeHtml(ponto.label || '')}</h4>
                <div class="me-escada-detail-text-row">
                    <p class="me-escada-detail-text">${escapeHtml(ponto.explicacao || '')}</p>
                    ${this.curiosidadeToggleHtml(ponto)}
                    ${this.atencaoToggleHtml(ponto)}
                </div>
                ${this.caixaFormulaHtml(ponto.caixa_formula)}
                ${this.curiosidadeRevealHtml(ponto)}
                ${this.atencaoRevealHtml(ponto)}
                ${this.proximaMissaoHtml(ponto)}
                ${this.dicaEstudoHtml(ponto)}
                ${this.saberMaisHtml(ponto)}
                ${this.inqueritoHtml(ponto)}
            `;
            if (!imagemHtml) return conteudoHtml;
            return `
                <div class="me-escada-detail-columns">
                    <div class="me-escada-detail-media">${imagemHtml}</div>
                    <div class="me-escada-detail-divider" aria-hidden="true"></div>
                    <div class="me-escada-detail-content">${conteudoHtml}</div>
                </div>
            `;
        }

        /**
         * Formato "escada": um degrau por ponto, com altura crescente
         * (--step-index) para se ler como uma escada ascendente — sem
         * imagem de diagrama própria (os próprios degraus já são a
         * visualização). Reaproveita data-ponto-index para o clique (ver
         * bindScreenInteractions), tal como os outros formatos.
         */
        renderDiagramaEscada(pontos) {
            const stepsHtml = pontos.map((ponto, i) => `
                <button type="button" class="me-escada-step ${i === 0 ? 'is-active' : ''}" data-ponto-index="${i}" style="--step-index:${i}">
                    <span class="me-escada-step-num">${i + 1}</span>
                    <span class="me-escada-step-label">${escapeHtml(ponto.label)}</span>
                </button>
            `).join('');
            return `<div class="me-escada-track">${stepsHtml}</div>`;
        }

        /**
         * Formato "árvore": pontos de topo (sem screen.pai) numa lista
         * vertical, com os filhos de cada um (pontos cujo "pai" é o id
         * desse ponto de topo) indentados por baixo, ligados por uma linha
         * — para grupos com dois níveis (ex: célula procariótica/
         * eucariótica, e esta última a dividir-se em animal/vegetal), em
         * vez de um formato plano onde essa relação não se via. Reaproveita
         * data-ponto-index (o índice real em screen.pontos) para o clique,
         * tal como os outros formatos.
         */
        renderDiagramaArvore(pontos) {
            const nodeHtml = (ponto, index, isFilho) => `
                <button type="button" class="me-arvore-node ${isFilho ? 'me-arvore-node--filho' : ''} ${index === 0 ? 'is-active' : ''}" data-ponto-index="${index}">
                    ${escapeHtml(ponto.label)}
                </button>
            `;
            // Organograma clássico (ligações em "chavena" entre irmãos, tronco
            // vertical até ao pai) em vez da lista indentada anterior — <ul>
            // aninhados, um por cada ponto de topo com filhos, com as linhas
            // desenhadas a CSS (ver .me-arvore-tree).
            const topo = pontos.filter((ponto) => !ponto.pai);
            const itensHtml = topo.map((ponto) => {
                const index = pontos.indexOf(ponto);
                const filhos = pontos.filter((filho) => filho.pai === ponto.id);
                const filhosHtml = filhos.length
                    ? `
                        <ul>
                            ${filhos.map((filho) => `
                                <li>${nodeHtml(filho, pontos.indexOf(filho), true)}</li>
                            `).join('')}
                        </ul>
                    `
                    : '';
                return `
                    <li>
                        ${nodeHtml(ponto, index, false)}
                        ${filhosHtml}
                    </li>
                `;
            }).join('');
            return `<div class="me-arvore-wrap"><ul class="me-arvore-tree">${itensHtml}</ul></div>`;
        }

        /**
         * Formato "mapa": a própria imagem do diagrama com um marcador
         * numerado sobre cada ponto (posicionado por percentagem, via
         * ponto.pos.x/ponto.pos.y — 0-100, relativo ao canto superior
         * esquerdo da imagem), em vez de uma fila de chips ao lado. Para
         * quando a imagem já mostra visualmente onde cada estrutura está
         * (ex: os organelos numa célula) e faz mais sentido apontar
         * diretamente para lá do que descrever por texto. Reaproveita
         * data-ponto-index para o clique, tal como os outros formatos.
         */
        renderDiagramaMapa(screen, pontos) {
            const marcadoresHtml = pontos.map((ponto, i) => {
                const x = (ponto.pos && typeof ponto.pos.x === 'number') ? ponto.pos.x : 50;
                const y = (ponto.pos && typeof ponto.pos.y === 'number') ? ponto.pos.y : 50;
                return `
                    <button type="button" class="me-mapa-marker ${i === 0 ? 'is-active' : ''}" data-ponto-index="${i}" style="left:${x}%; top:${y}%;" aria-label="${escapeHtml(ponto.label)}" title="${escapeHtml(ponto.label)}">
                        <span class="me-mapa-marker-num">${i + 1}</span>
                    </button>
                `;
            }).join('');
            return `
                <div class="me-mapa-wrap">
                    <img class="me-mapa-image" src="/static/images/${encodeURIComponent(screen.imagem)}" alt="${escapeHtml(screen.titulo || '')}" onerror="this.style.display='none'">
                    ${marcadoresHtml}
                </div>
            `;
        }

        /**
         * Ecrã "acordeao": um texto de introdução e, por baixo, uma lista de
         * linhas empilhadas, pela ordem do ficheiro; ao clicar numa linha, o
         * texto dela abre logo por baixo (e volta a fechar ao clicar de novo).
         * Podem estar várias abertas ao mesmo tempo, para se compararem.
         *
         *   titulo    — título do ecrã
         *   texto     — introdução (parágrafos separados por linha em branco)
         *   instrucao — frase antes da lista (ex: "Explora cada um deles:")
         *   itens     — lista de { rotulo, explicacao, imagem? }; com imagem, o
         *               texto abre no formato de cartão (imagem à esquerda)
         */
        renderAcordeao(screen) {
            const chevron = '<svg class="me-acordeao-seta" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
            const itensHtml = (screen.itens || []).map((item, i) => {
                const paragrafos = String(item.explicacao || '').split(/\n\s*\n/).filter(Boolean)
                    .map((par) => `<p class="me-escada-detail-text">${boldMarkdown(escapeHtml(par))}</p>`).join('');
                // item.curiosidade: 💡 por baixo do texto, que só mostra a
                // curiosidade depois de clicar (ver bindAcordeao).
                const curiosidade = item.curiosidade
                    ? `<div class="me-curiosidade-baixo">${this.curiosidadeToggleHtml(item)}</div>${this.curiosidadeRevealHtml(item)}`
                    : '';
                const texto = `<div class="me-escada-detail-content">${paragrafos}${curiosidade}</div>`;
                const conteudo = item.imagem
                    ? `<div class="me-escada-detail-columns">
                           <div class="me-escada-detail-media">${imagemEcraHtml(item.imagem, 'me-escada-detail-image', item.rotulo || '', item.imagem_legenda)}</div>
                           <div class="me-escada-detail-divider" aria-hidden="true"></div>
                           ${texto}
                       </div>`
                    : texto;
                return `
                    <div class="me-acordeao-item">
                        <button type="button" class="me-acordeao-cabeca" aria-expanded="false" aria-controls="meAcordeaoPainel${i}" data-ac-botao>
                            <span class="me-acordeao-num">${i + 1}</span>
                            <span class="me-acordeao-rotulo">${escapeHtml(item.rotulo || '')}</span>
                            ${chevron}
                        </button>
                        <div class="me-acordeao-painel me-escada-detail" id="meAcordeaoPainel${i}" hidden>${conteudo}</div>
                    </div>
                `;
            }).join('');
            return `
                <div class="mascot-overlay-card me-mascot-inline me-gancho-card">
                    ${screen.titulo ? `<h3>${escapeHtml(screen.titulo)}</h3>` : ''}
                    ${screen.texto ? `<div class="me-diagrama-texto-principal">${textToHtml(screen.texto)}</div>` : ''}
                    ${screen.instrucao ? `<p class="me-acordeao-instrucao">${escapeHtml(screen.instrucao)}</p>` : ''}
                    <div class="me-acordeao">${itensHtml}</div>
                </div>
            `;
        }

        bindAcordeao() {
            this.root.querySelectorAll('[data-ac-botao]').forEach((botao) => {
                botao.addEventListener('click', () => {
                    const painel = this.root.querySelector(`#${botao.getAttribute('aria-controls')}`);
                    if (!painel) return;
                    const abrir = painel.hidden;
                    painel.hidden = !abrir;
                    botao.setAttribute('aria-expanded', abrir ? 'true' : 'false');
                    botao.classList.toggle('is-open', abrir);
                });
            });
            this.root.querySelectorAll('.me-acordeao-painel').forEach((painel) => this.bindCuriosidadeToggle(painel));
        }

        /**
         * Ecrã "formula_interativa": o cartão de um ponto de diagrama (imagem
         * à esquerda, linha, texto à direita) em que, por baixo do texto, a
         * caixa verde de fórmulas mostra a fórmula bem grande com uma bolinha
         * clicável por baixo de cada letra; ao clicar, a explicação da letra
         * aparece dentro da própria caixa, por baixo da fórmula. Por baixo do
         * cartão, o exercício (mesma caixa dos diagramas, ver
         * exercicioPontoHtml).
         *
         *   rotulo     — título do cartão (como o label de um ponto)
         *   imagem     — imagem do lado esquerdo (opcional; sem ficheiro fica em branco)
         *   texto      — explicação por cima da fórmula (parágrafos separados por linha em branco)
         *   formula    — lista de { t: "símbolo", id?: "chave" }; os que têm id
         *                ganham bolinha, os outros (ex: "=") ficam só como texto
         *   variaveis  — { chave: { rotulo, explicacao } }
         *   instrucao  — dica mostrada na caixa antes de se clicar numa bolinha
         *   exercicio  — como em ponto.exercicio
         */
        renderFormulaInterativa(screen) {
            const tokensHtml = (screen.formula || []).map((tk) => {
                if (!tk.id) {
                    return `<span class="me-fi-token me-fi-token--fixo"><span class="me-fi-simbolo">${escapeHtml(tk.t)}</span><span class="me-fi-bolinha me-fi-bolinha--vazia" aria-hidden="true"></span></span>`;
                }
                const rotulo = (screen.variaveis && screen.variaveis[tk.id] && screen.variaveis[tk.id].rotulo) || tk.t;
                return `
                    <span class="me-fi-token">
                        <span class="me-fi-simbolo">${escapeHtml(tk.t)}</span>
                        <button type="button" class="me-fi-bolinha" data-fi-id="${escapeAttr(tk.id)}" aria-pressed="false" aria-label="${escapeAttr(rotulo)}" title="${escapeAttr(rotulo)}"></button>
                    </span>
                `;
            }).join('');
            const paragrafosHtml = String(screen.texto || '').split(/\n\s*\n/).filter(Boolean)
                .map((par) => `<p class="me-escada-detail-text">${boldMarkdown(escapeHtml(par))}</p>`).join('');
            const imagemHtml = screen.imagem
                ? `<div class="me-escada-detail-media">${imagemEcraHtml(screen.imagem, 'me-escada-detail-image', screen.rotulo || screen.titulo || '', screen.imagem_legenda)}</div>`
                : '<div class="me-escada-detail-media"></div>';
            const pseudoPonto = { id: 'formula', exercicio: screen.exercicio };
            return `
                <div class="mascot-overlay-card me-mascot-inline me-gancho-card">
                    ${screen.titulo ? `<h3>${escapeHtml(screen.titulo)}</h3>` : ''}
                    <div class="me-escada-detail me-fi-cartao">
                        <div class="me-escada-detail-columns">
                            ${imagemHtml}
                            <div class="me-escada-detail-divider" aria-hidden="true"></div>
                            <div class="me-escada-detail-content">
                                ${screen.rotulo ? `<h4 class="me-escada-detail-title">${escapeHtml(screen.rotulo)}</h4>` : ''}
                                ${paragrafosHtml}
                                <div class="me-caixa-formula me-fi-caixa">
                                    <div class="me-fi-formula" role="group" aria-label="Fórmula">${tokensHtml}</div>
                                    <div class="me-fi-explicacao" id="meFormulaExplicacao" aria-live="polite">
                                        <p class="me-fi-dica">${escapeHtml(screen.instrucao || 'Clica numa bolinha para veres o que significa.')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="meDiagramaExercicio">${this.exercicioPontoHtml(screen, pseudoPonto)}</div>
                </div>
            `;
        }

        bindFormulaInterativa(screen) {
            const explicacaoEl = this.root.querySelector('#meFormulaExplicacao');
            const bolinhas = this.root.querySelectorAll('[data-fi-id]');
            bolinhas.forEach((bolinha) => {
                bolinha.addEventListener('click', () => {
                    const variavel = (screen.variaveis || {})[bolinha.dataset.fiId];
                    if (!variavel || !explicacaoEl) return;
                    bolinhas.forEach((b) => {
                        const ativa = b === bolinha;
                        b.classList.toggle('is-active', ativa);
                        b.setAttribute('aria-pressed', ativa ? 'true' : 'false');
                    });
                    const paragrafos = String(variavel.explicacao || '').split(/\n\s*\n/).filter(Boolean)
                        .map((par) => `<p class="me-caixa-formula-significado">${boldMarkdown(escapeHtml(par))}</p>`).join('');
                    explicacaoEl.innerHTML = `
                        <p class="me-caixa-formula-expressao">${escapeHtml(variavel.rotulo || '')}</p>
                        ${paragrafos}
                    `;
                });
            });
            const exercicioEl = this.root.querySelector('#meDiagramaExercicio');
            if (exercicioEl) this.bindExercicio(exercicioEl, screen, { id: 'formula', exercicio: screen.exercicio });
        }

        renderDiagrama(screen) {
            const pontos = screen.pontos || [];
            const isEscada = screen.layout === 'escada';
            const isTimeline = screen.layout === 'timeline';
            const isArvore = screen.layout === 'arvore';
            const isMapa = screen.layout === 'mapa';
            // screen.cartao_estilo pré-seleciona o primeiro chip (tal como
            // a escada), para o cartão branco já aparecer preenchido em vez
            // de escondido à espera de um clique.
            const pontosHtml = isEscada
                ? this.renderDiagramaEscada(pontos)
                : isTimeline
                    ? this.renderDiagramaTimeline(pontos)
                    : isArvore
                        ? this.renderDiagramaArvore(pontos)
                        : isMapa
                            ? this.renderDiagramaMapa(screen, pontos)
                            : `<div class="me-diagrama-chips">${pontos.map((ponto, i) => `
                        ${(screen.chips_setas && i > 0) ? '<span class="me-diagrama-seta" aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span>' : ''}
                        <button type="button" class="me-diagrama-chip ${(screen.cartao_estilo && i === 0) ? 'is-active' : ''}" data-ponto-index="${i}">
                            ${screen.chips_setas ? '' : `<span class="me-diagrama-chip-num">${i + 1}</span>`}
                            <span>${escapeHtml(ponto.label)}</span>
                        </button>
                    `).join('')}</div>`;

            // Introdução opcional (gancho fundido neste ecrã, ver
            // showMascotPopupIfNeeded): imagem + frase-isco. A frase-ponte
            // já não vive aqui — passou para logo a seguir ao título (ver
            // mais abaixo), para se ler como "título, depois a ponte para
            // o diagrama", em vez de aparecer antes do título ainda a
            // falar do gancho anterior. Na timeline, o título e a
            // frase-ponte saem sempre juntos por cima da própria linha
            // temporal (ver tituloPonteHtml).
            const hasIntro = Boolean(screen.intro_imagem || screen.intro_texto);
            const hasIntroTexto = Boolean(screen.intro_texto);
            // Isco sozinho ainda partilha a caixa com traço fino (ver
            // .me-diagrama-intro-bloco no CSS) — screen.intro_sem_caixa
            // salta essa caixa (só texto solto), para quando o guião pede
            // o texto sem painel à volta.
            const introParagrafosHtml = `
                ${screen.intro_texto ? `<p class="me-diagrama-intro-texto">${escapeHtml(screen.intro_texto)}</p>` : ''}
            `;
            const introTextoHtml = hasIntroTexto
                ? `<div class="me-intro-texto-col">${screen.intro_sem_caixa
                    ? introParagrafosHtml
                    : `<div class="me-diagrama-intro-bloco">${introParagrafosHtml}</div>`}</div>`
                : '';
            const introImagemHtml = screen.intro_imagem
                ? `<img class="me-gancho-hero-image" src="/static/images/${encodeURIComponent(screen.intro_imagem)}" alt="" onerror="this.style.display='none'">`
                : '';
            // Com imagem E texto, ficam lado a lado (imagem à esquerda, texto
            // à direita, ver .me-intro-columns no CSS) — só um dos dois,
            // continua sozinho e centrado como antes.
            const introHtml = hasIntro
                ? (introImagemHtml && introTextoHtml
                    ? `<div class="me-intro-columns">${introImagemHtml}${introTextoHtml}</div>`
                    : `${introImagemHtml}${introTextoHtml}`)
                : '';

            // A escada, a árvore e o mapa já são a própria visualização —
            // sem imagem de diagrama por cima (o mapa tem a sua própria
            // imagem, com os marcadores em cima dela), e o painel de
            // explicação ganha o formato "Nível X de N" em vez do
            // "did-you-know" genérico. O mesmo cartão pode ser pedido para
            // chips normais via screen.cartao_estilo, sem mudar o layout da
            // fila de pontos.
            const useCardDetail = isEscada || isArvore || isMapa || screen.cartao_estilo === true;
            const primeiroPonto = pontos[0] || {};
            const explicacaoHtml = useCardDetail
                ? `<div class="me-escada-detail" id="meDiagramaExplicacao">${this.pontoDetailInnerHtml(primeiroPonto)}</div>`
                : `<div class="me-diagrama-explicacao did-you-know" id="meDiagramaExplicacao" hidden></div>`;

            // Título + frase-ponte centrados por cima da linha temporal —
            // título primeiro, frase-ponte logo a seguir.
            const tituloPonteHtml = isTimeline
                ? `
                    ${screen.titulo ? `<h3 class="me-timeline-titulo">${escapeHtml(screen.titulo)}</h3>` : ''}
                    ${screen.ponte_texto ? `<p class="me-diagrama-ponte-texto me-timeline-ponte">${escapeHtml(screen.ponte_texto)}</p>` : ''}
                `
                : '';

            // Na timeline, a dica "Clica em cada marco..." passa a aparecer
            // por baixo da linha temporal (junto ao início da explicação),
            // em vez de por cima como nos outros formatos de diagrama.
            // screen.sem_chips: ecrã com um só ponto, sem fila de chips nem a
            // dica "Clica num ponto" — o cartão do ponto aparece logo aberto
            // (precisa de screen.cartao_estilo).
            const instrucaoHtml = `<p class="plant-diagram-hint">${escapeHtml(screen.instrucao || 'Clica num ponto para veres a explicação.')}</p>`;

            // texto_principal (Física) — explicação corrida que acompanha o
            // diagrama, distinta da frase-ponte (uma frase curta) e do
            // intro_texto (isco antes do título): aqui é o corpo principal
            // do ecrã, por isso vem depois da ponte e antes da imagem.
            const textoPrincipalHtml = screen.texto_principal
                ? `<div class="me-diagrama-texto-principal">${textToHtml(screen.texto_principal)}</div>`
                : '';

            const diagramaHtml = `
                ${isTimeline ? tituloPonteHtml : `
                    ${screen.titulo ? `<h3>${escapeHtml(screen.titulo)}</h3>` : ''}
                    ${screen.ponte_texto ? `<p class="me-diagrama-ponte-texto">${escapeHtml(screen.ponte_texto)}</p>` : ''}
                `}
                ${textoPrincipalHtml}
                ${(isEscada || isArvore || isMapa) ? '' : (screen.video
                    ? `<video class="me-video-chroma-source" data-chroma-key="white" src="/static/${encodeURIComponent(screen.video)}" autoplay loop muted playsinline style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none"></video>
                       <canvas class="card-visual me-video-chroma-canvas"></canvas>`
                    : imagemEcraHtml(screen.imagem, 'card-visual', screen.titulo || '', screen.imagem_legenda))}
                ${(isTimeline || screen.sem_chips) ? '' : instrucaoHtml}
                ${screen.sem_chips ? '' : pontosHtml}
                ${isTimeline ? instrucaoHtml : ''}
                ${explicacaoHtml}
                ${this.tabelasHtml(screen.tabelas)}
                ${this.escadaConversaoHtml(screen.escada_conversao)}
                ${this.caixaFormulaHtml(screen.caixa_formula)}
                ${pontos.some((ponto) => ponto.exercicio)
                    ? `<div id="meDiagramaExercicio">${screen.cartao_estilo ? this.exercicioPontoHtml(screen, primeiroPonto) : ''}</div>`
                    : ''}
            `;

            // "Queres saber mais?" opcional, dentro do mesmo painel branco
            // do diagrama (ver screen.aprofundar) — sem breakout de largura
            // nem caixa própria (ver .me-gancho-card .did-you-know no CSS),
            // fundido aqui em vez de ser um ecrã à parte só para um botão.
            const aprofundarHtml = this.aprofundarHtml(screen.aprofundar);

            // Com introdução, "saber mais" ou screen.cartao_estilo (gancho
            // fundido, ou só o painel pedido para chips normais), tudo —
            // título, instrução, pontos e explicação — partilha o mesmo
            // painel com traço fino em vez de flutuar solto na página. A
            // timeline recebe uma modificadora extra: precisa de mais
            // largura do que o painel estreito normal para caberem os
            // nomes em diagonal sem scroll horizontal (ver
            // .me-gancho-card--timeline, que quebra a coluna de leitura
            // estreita de .section-body tal como .plant-diagram-card).
            if (hasIntro || screen.aprofundar || screen.cartao_estilo || screen.texto_principal || screen.caixa_formula) {
                const cardModifier = screen.layout === 'timeline' ? ' me-gancho-card--timeline' : '';
                return `
                    <div class="mascot-overlay-card me-mascot-inline me-gancho-card${cardModifier}">
                        ${introHtml}
                        ${diagramaHtml}
                        ${aprofundarHtml}
                    </div>
                `;
            }
            return diagramaHtml;
        }

        renderMicroVerificacao(section, screen, screenIndex) {
            const answerKey = `${section.secao_id}::${screenIndex}`;
            const saved = this.state.answers[answerKey];
            const feedbackHtml = saved
                ? this.buildFeedbackHtml(saved.correct, screen.mascote_feedback_certo, screen.mascote_feedback_errado)
                : '';

            // Com a mascote ativa, a pergunta, as opções e o feedback
            // aparecem sempre no popup ao entrar neste ecrã — tanto para
            // responder como para rever (ver showMicroVerificacaoPopup).
            // Em vez de deixar o ecrã por baixo vazio, mostra-se o último
            // ecrã de gancho/diagrama (ex: o do lago com os peixes) como
            // pano de fundo, para o aluno continuar a ver o conteúdo a que
            // a pergunta se refere enquanto o popup está aberto. Sem
            // mascote (o popup nunca chega a aparecer), mantém-se a
            // pergunta e as opções aqui para a pergunta continuar
            // respondível.
            if (this.mascotEnabled() && screen.pergunta) {
                const backdrop = this.findBackdropScreen(section, screenIndex);
                return backdrop ? this.renderScreen(section, backdrop, screenIndex) : '';
            }

            const optionsHtml = (screen.opcoes || []).map((opcao, i) => {
                let stateClass = '';
                if (saved) {
                    if (i === screen.correta) stateClass = 'correct';
                    else if (i === saved.selected) stateClass = 'incorrect';
                }
                return `
                    <button type="button" class="quiz-option ${stateClass}" data-option-index="${i}" ${saved ? 'disabled' : ''}>
                        <span class="option-letter">${String.fromCharCode(65 + i)}</span>
                        <span class="option-text">${escapeHtml(opcao)}</span>
                    </button>
                `;
            }).join('');

            return `
                ${this.mascotInlineCardHtml(screen.mascote_texto)}
                <p class="quiz-question">${escapeHtml(screen.pergunta)}</p>
                <div class="quiz-options" data-answer-key="${answerKey}">${optionsHtml}</div>
                ${feedbackHtml}
            `;
        }

        buildFeedbackHtml(isCorrect, textoCerto, textoErrado) {
            const mascotText = isCorrect ? textoCerto : textoErrado;
            const showMascotText = this.mascotEnabled() && mascotText;
            return `
                <div class="quiz-feedback ${isCorrect ? 'feedback-correct' : 'feedback-incorrect'}">
                    <span class="feedback-icon">${isCorrect ? '✓' : '✕'}</span>
                    <span class="feedback-text">${isCorrect ? 'Certo!' : 'Não é bem isso.'}${showMascotText ? ` ${escapeHtml(mascotText)}` : ''}</span>
                </div>
            `;
        }

        /**
         * Explosão de confetti a cobrir o ecrã inteiro quando o aluno
         * acerta numa pergunta (ver os 3 sítios que chamam isto: popup de
         * micro-verificação, micro-verificação inline, e quiz de secção).
         * Feito como um overlay solto anexado a document.body — não ao
         * ecrã da pergunta em si — porque logo a seguir a resposta o ecrã
         * costuma voltar a renderizar-se (this.render()), o que substituiria
         * qualquer coisa que estivesse dentro dele antes da animação acabar.
         * Autolimpa-se sozinho, e respeita prefers-reduced-motion.
         */
        celebrateCorrectAnswer() {
            if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

            const colors = ['#3f7d3a', '#ffb020', '#2a8fae', '#e6362a', '#8a4fd1', '#1f8a5b'];
            const burst = document.createElement('div');
            burst.className = 'me-confetti-burst';
            burst.setAttribute('aria-hidden', 'true');

            const pieceCount = 32;
            for (let i = 0; i < pieceCount; i++) {
                const piece = document.createElement('span');
                piece.className = 'me-confetti-piece';
                const drift = Math.round(Math.random() * 240 - 120);
                const spin = Math.round(Math.random() * 720 - 360);
                const delay = (Math.random() * 0.2).toFixed(2);
                const duration = (0.9 + Math.random() * 0.5).toFixed(2);
                piece.style.left = `${Math.random() * 100}%`;
                piece.style.background = colors[i % colors.length];
                piece.style.setProperty('--drift', `${drift}px`);
                piece.style.setProperty('--spin', `${spin}deg`);
                piece.style.animationDelay = `${delay}s`;
                piece.style.animationDuration = `${duration}s`;
                burst.appendChild(piece);
            }

            document.body.appendChild(burst);
            setTimeout(() => burst.remove(), 1700);
        }

        renderAnalogia(screen) {
            // O ícone do callout já assume o papel do 💡 — o guião escreve-o
            // também no início do texto, então tira-se aqui para não sair
            // duplicado no ecrã.
            const texto = (screen.texto || '').replace(/^\s*💡\s*/, '');
            // screen.cartao_estilo troca o callout azul-claro padrão por um
            // cartão branco com a imagem, e o texto ganha o seu próprio
            // bloco destacado (castanho-rosado) lá dentro — em vez de
            // reaproveitar tal e qual .me-escada-detail (o painel creme dos
            // pontos de um diagrama, ver renderDiagrama), que aqui ficaria
            // com a imagem e o texto na mesma cor, sem os separar.
            // screen.curiosidade troca o cartão por o mesmo formato do
            // painel de um ponto de diagrama (ver pontoDetailInnerHtml):
            // imagem à esquerda, texto à direita e, por baixo do texto, um
            // 💡 que só mostra a curiosidade depois de se clicar.
            if (screen.cartao_estilo && screen.curiosidade) {
                const paragrafosHtml = texto.split(/\n\s*\n/).filter(Boolean)
                    .map((p) => `<p class="me-escada-detail-text">${boldMarkdown(escapeHtml(p))}</p>`).join('');
                const imagemHtml = imagemEcraHtml(screen.imagem, 'me-escada-detail-image', screen.titulo || '', screen.imagem_legenda);
                const conteudoHtml = `
                    ${screen.titulo ? `<h4 class="me-escada-detail-title">${escapeHtml(screen.titulo)}</h4>` : ''}
                    ${paragrafosHtml}
                    <div class="me-curiosidade-baixo">${this.curiosidadeToggleHtml(screen)}</div>
                    ${this.curiosidadeRevealHtml(screen)}
                `;
                return `
                    <div class="me-escada-detail me-analogia-detalhe me-gancho-card">
                        ${imagemHtml
                            ? `<div class="me-escada-detail-columns">
                                   <div class="me-escada-detail-media">${imagemHtml}</div>
                                   <div class="me-escada-detail-divider" aria-hidden="true"></div>
                                   <div class="me-escada-detail-content">${conteudoHtml}</div>
                               </div>`
                            : conteudoHtml}
                    </div>
                `;
            }
            if (screen.cartao_estilo) {
                const paragrafosHtml = texto.split(/\n\s*\n/).filter(Boolean)
                    .map((p) => `<p class="me-escada-detail-text">${boldMarkdown(escapeHtml(p))}</p>`).join('');
                // .me-gancho-hero-image (maior, ver renderGancho) em vez de
                // .me-escada-detail-image (pensada para ícones pequenos nos
                // degraus da escada) — aqui a imagem é um diagrama com
                // texto (ex: a teia alimentar), que precisa de mais espaço
                // para se conseguir ler.
                const imagemHtml = imagemEcraHtml(screen.imagem, 'me-gancho-hero-image', '', screen.imagem_legenda);
                // Também leva a classe me-gancho-card só para herdar a
                // largura total (e o "escape" da coluna estreita de
                // leitura, ver .screen-card:has(.me-gancho-card) no CSS) —
                // as próprias cores/bordas de .me-analogia-cartao/-texto-
                // bloco continuam a ganhar por virem depois no CSS.
                return `
                    <div class="me-analogia-cartao me-gancho-card">
                        ${screen.titulo ? `<h3>${escapeHtml(screen.titulo)}</h3>` : ''}
                        ${imagemHtml}
                        <div class="me-analogia-texto-bloco">${paragrafosHtml}</div>
                        ${this.aprofundarHtml(screen.aprofundar)}
                    </div>
                `;
            }
            return `
                ${this.mascotInlineCardHtml(screen.mascote_texto)}
                <div class="mission-intro-callout">
                    <span class="mission-intro-callout-icon">💡</span>
                    <div class="mission-intro-callout-text">${textToHtml(texto)}</div>
                </div>
            `;
        }

        /** Reaproveitado tanto pelo ecrã dedicado (renderAprofundar) como
         *  pelo bloco "Queres saber mais?" opcional dentro de um diagrama
         *  (ver screen.aprofundar em renderDiagrama), para não haver dois
         *  sítios a construir o mesmo <details>. */
        aprofundarHtml(aprofundar) {
            if (!aprofundar) return '';
            // aprofundar.rotulo troca o texto padrão do botão ("Queres
            // saber mais? — <titulo>") por um rótulo próprio (ex: "Guia de
            // estudo"), para quando o conteúdo não é uma curiosidade extra
            // mas antes algo como uma analogia/resumo que merece o seu
            // próprio nome — sem precisar de um screen.titulo à parte.
            const rotulo = aprofundar.rotulo ? escapeHtml(aprofundar.rotulo) : `Queres saber mais? — ${escapeHtml(aprofundar.titulo)}`;
            // aprofundar.icone: lâmpada à frente do rótulo em vez da setinha ▸
            // (ver .me-saber-mais--icone no CSS).
            const iconeHtml = aprofundar.icone
                ? '<svg class="me-saber-mais-icone" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>'
                : '';
            return `
                <details class="did-you-know me-saber-mais${aprofundar.icone ? ' me-saber-mais--icone' : ''}">
                    <summary>${iconeHtml}${rotulo}</summary>
                    <div class="did-you-know-body">
                        <div class="did-you-know-text">${textToHtml(aprofundar.texto)}</div>
                    </div>
                </details>
            `;
        }

        renderAprofundar(screen) {
            return this.aprofundarHtml(screen);
        }

        /** Ecrã "atividade_laboratorial" (Física) — cada campo da AL é o seu
         *  próprio bloco colapsável, reaproveitando o visual .did-you-know
         *  do "aprofundar" (ver aprofundarHtml) em vez de inventar um
         *  componente novo. Ao contrário do "aprofundar", os campos são
         *  fixos (objetivo, material, procedimento, tratamento de dados,
         *  conclusão, erros comuns), não uma lista livre de "blocos". */
        renderAtividadeLaboratorial(screen) {
            const listaHtml = (itens) => `<ul class="me-laboratorio-lista">${(itens || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
            const blocoHtml = (rotulo, corpoHtml, aberto) => corpoHtml ? `
                <details class="did-you-know me-laboratorio-bloco"${aberto ? ' open' : ''}>
                    <summary>${escapeHtml(rotulo)}</summary>
                    <div class="did-you-know-body">${corpoHtml}</div>
                </details>
            ` : '';

            return `
                <div class="me-laboratorio-cartao mascot-overlay-card me-mascot-inline me-gancho-card">
                    <p class="me-laboratorio-codigo">${escapeHtml(screen.codigo || '')}</p>
                    <h3>${escapeHtml(screen.titulo || '')}</h3>
                    ${blocoHtml('Objetivo', screen.objetivo ? textToHtml(screen.objetivo) : '', true)}
                    ${blocoHtml('Material', screen.material ? listaHtml(screen.material) : '')}
                    ${blocoHtml('Procedimento', screen.procedimento ? `<ol class="me-laboratorio-lista me-laboratorio-lista--numerada">${screen.procedimento.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol>` : '')}
                    ${blocoHtml('Tratamento de dados', screen.tratamento_de_dados ? textToHtml(screen.tratamento_de_dados) : '')}
                    ${blocoHtml('Conclusão', screen.conclusao ? textToHtml(screen.conclusao) : '')}
                    ${blocoHtml('Erros comuns', screen.erros_comuns ? listaHtml(screen.erros_comuns) : '')}
                    ${blocoHtml('Segurança', screen.seguranca ? textToHtml(screen.seguranca) : '')}
                    ${screen.rever_medicao_incertezas ? blocoHtml('Rever: medição e incertezas', textToHtml(MEDICAO_INCERTEZAS_TEXTO)) : ''}
                </div>
            `;
        }

        /** Ecrã "simulacao" (Física) — sliders/controlos que recalculam
         *  saídas em tempo real, sem chamadas ao servidor. As fórmulas em
         *  screen.saidas/controlos.formula são expressões JS em texto
         *  (ver guião), avaliadas com Function() num âmbito isolado onde só
         *  os ids dos controlos existem como variáveis — nunca com dados
         *  vindos do aluno, só do JSON da própria missão. */
        renderSimulacao(screen) {
            const controlos = screen.controlos || [];
            const controlosHtml = controlos.map((controlo) => {
                if (controlo.tipo === 'botao') {
                    return `<button type="button" class="me-simulacao-botao" data-simulacao-botao="${escapeHtml(controlo.id)}">${escapeHtml(controlo.rotulo || controlo.id)}</button>`;
                }
                if (controlo.tipo === 'tabela_periodica') {
                    return this.tabelaPeriodicaHtml(controlo);
                }
                if (Array.isArray(controlo.opcoes)) {
                    return `
                        <div class="me-simulacao-controlo">
                            <label class="me-simulacao-rotulo" for="sim-${escapeHtml(controlo.id)}">${escapeHtml(controlo.rotulo || controlo.id)}</label>
                            <select class="me-simulacao-select" id="sim-${escapeHtml(controlo.id)}" data-simulacao-controlo="${escapeHtml(controlo.id)}" data-tipo="opcao">
                                ${controlo.opcoes.map((opcao) => `<option value="${escapeHtml(String(opcao.valor))}"${controlo.valor_inicial != null && String(opcao.valor) === String(controlo.valor_inicial) ? ' selected' : ''}>${escapeHtml(opcao.label)}</option>`).join('')}
                            </select>
                        </div>
                    `;
                }
                return `
                    <div class="me-simulacao-controlo">
                        <label class="me-simulacao-rotulo" for="sim-${escapeHtml(controlo.id)}">
                            ${escapeHtml(controlo.rotulo || controlo.id)}
                            <span class="me-simulacao-valor" data-simulacao-valor-de="${escapeHtml(controlo.id)}">${controlo.valor_inicial}</span>
                            ${controlo.unidade ? `<span class="me-simulacao-unidade">${escapeHtml(controlo.unidade)}</span>` : ''}
                        </label>
                        <input type="range" class="me-simulacao-slider" id="sim-${escapeHtml(controlo.id)}"
                            data-simulacao-controlo="${escapeHtml(controlo.id)}" data-tipo="slider"
                            min="${controlo.min}" max="${controlo.max}" step="${controlo.passo || 1}" value="${controlo.valor_inicial}">
                    </div>
                `;
            }).join('');

            const saidasHtml = (screen.saidas || []).map((saida, i) => `
                <div class="me-simulacao-saida">
                    <span class="me-simulacao-saida-rotulo">${escapeHtml(saida.rotulo)}</span>
                    <span class="me-simulacao-saida-valor" data-simulacao-saida="${i}">—</span>
                    ${saida.unidade ? `<span class="me-simulacao-unidade">${escapeHtml(saida.unidade)}</span>` : ''}
                </div>
            `).join('');

            return `
                <div class="me-simulacao-cartao mascot-overlay-card me-mascot-inline me-gancho-card" id="meSimulacao-${escapeHtml(screen.id || '')}" data-simulacao-id="${escapeHtml(screen.id || '')}">
                    ${screen.titulo ? `<h3>${escapeHtml(screen.titulo)}</h3>` : ''}
                    ${screen.instrucao ? `<p class="me-diagrama-ponte-texto">${escapeHtml(screen.instrucao)}</p>` : ''}
                    ${this.visualSimulacaoHtml(screen)}
                    ${screen.painel_colunas ? `
                        <div class="me-escada-detail me-sim-painel">
                            <div class="me-escada-detail-columns">
                                <div class="me-sim-painel-controlos"><div class="me-simulacao-controlos">${controlosHtml}</div></div>
                                <div class="me-escada-detail-divider" aria-hidden="true"></div>
                                <div class="me-sim-painel-saidas"><div class="me-simulacao-saidas">${saidasHtml}</div></div>
                            </div>
                            ${screen.curiosidade ? `<div class="me-sim-lampada">${this.curiosidadeToggleHtml(screen)}</div>` : ''}
                        </div>
                        ${screen.curiosidade ? this.curiosidadeRevealHtml(screen) : ''}
                    ` : `
                        <div class="me-simulacao-controlos">${controlosHtml}</div>
                        <div class="me-simulacao-saidas">${saidasHtml}</div>
                    `}
                    ${screen.desafio ? `<div class="me-simulacao-desafio" id="meDesafio-${escapeHtml(screen.id || '')}">${this.exercicioPontoHtml(screen, { id: 'desafio', exercicio: { ...screen.desafio, titulo: screen.desafio.titulo || 'Desafio', icone: 'alvo' } })}</div>` : ''}
                    ${!screen.desafio && screen.pergunta_final ? `
                        <details class="did-you-know me-laboratorio-bloco">
                            <summary>Pergunta final</summary>
                            <div class="did-you-know-body"><p>${escapeHtml(screen.pergunta_final)}</p></div>
                        </details>
                    ` : ''}
                </div>
            `;
        }

        /** Desenho que acompanha uma simulação e se redesenha a cada
         *  alteração dos controlos (screen.visual). Por agora só existe
         *  'trabalho_caixa': uma caixa num plano horizontal com o peso (P),
         *  a reação normal (N), uma força F inclinada de α em relação ao
         *  deslocamento d, usando os controlos F (N), d (m) e alfa (graus).
         *  O SVG é criado aqui vazio e preenchido por
         *  atualizarVisualSimulacao. */
        visualSimulacaoHtml(screen) {
            if (screen.visual !== 'trabalho_caixa') return '';
            const seta = (id, cor) => `<marker id="meTc-${id}" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="15" markerHeight="15" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="${cor}"/></marker>`;
            return `
                <figure class="me-sim-visual">
                    <svg class="me-tc" viewBox="0 40 640 300" role="img" aria-label="Caixa num plano horizontal com o peso, a reação normal, a força F e o deslocamento d">
                        <defs>
                            ${seta('F', '#e8590c')}${seta('N', '#2f9e44')}${seta('P', '#c92a2a')}${seta('d', 'currentColor')}
                        </defs>
                        <text class="me-tc-w" x="320" y="66" text-anchor="middle"></text>
                        <line class="me-tc-chao" x1="0" y1="250" x2="640" y2="250"/>
                        <g class="me-tc-hachura"></g>
                        <rect class="me-tc-fantasma" x="110" y="180" width="100" height="70" rx="6"/>
                        <rect class="me-tc-caixa" x="110" y="180" width="100" height="70" rx="6"/>
                        <g class="me-tc-N"><line stroke="#2f9e44" stroke-width="3.5" marker-end="url(#meTc-N)"/><text fill="#2f9e44">N</text></g>
                        <g class="me-tc-P"><line stroke="#c92a2a" stroke-width="3.5" marker-end="url(#meTc-P)"/><text fill="#c92a2a">P</text></g>
                        <circle class="me-tc-cm" r="4.5" fill="currentColor"/>
                        <g class="me-tc-F">
                            <line class="me-tc-fy" stroke-width="1.5" stroke-dasharray="4 4"/>
                            <line class="me-tc-fx" stroke-width="5" stroke-dasharray="1 0" opacity=".55"/>
                            <path class="me-tc-arco" fill="none" stroke="currentColor" stroke-width="1.5"/>
                            <text class="me-tc-alfa" fill="currentColor">α</text>
                            <line class="me-tc-fseta" stroke="#e8590c" stroke-width="3.5" marker-end="url(#meTc-F)"/>
                            <text class="me-tc-flabel" fill="#e8590c">F</text>
                        </g>
                        <g class="me-tc-d">
                            <line class="me-tc-dlinha" stroke="currentColor" stroke-width="2.5" marker-end="url(#meTc-d)"/>
                            <text class="me-tc-dlabel" fill="currentColor" text-anchor="middle"></text>
                        </g>
                    </svg>
                    <figcaption class="me-sim-visual-legenda">
                        <span class="me-tc-chave me-tc-chave--F">F</span> força aplicada
                        <span class="me-tc-chave me-tc-chave--fx">F cos α</span> componente que realiza trabalho
                        <span class="me-tc-chave me-tc-chave--N">N</span> e <span class="me-tc-chave me-tc-chave--P">P</span> são perpendiculares a d: trabalho nulo
                    </figcaption>
                </figure>
            `;
        }

        atualizarVisualSimulacao(screen, container, valores) {
            if (screen.visual !== 'trabalho_caixa') return;
            const svg = container.querySelector('.me-tc');
            if (!svg) return;
            const set = (el, attrs) => { if (el) Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); };
            const q = (sel) => svg.querySelector(sel);
            const F = Number(valores.F) || 0;
            const d = Number(valores.d) || 0;
            const alfa = Number(valores.alfa) || 0;
            const rad = alfa * Math.PI / 180;
            const cosA = Math.cos(rad);
            const sinA = Math.sin(rad);
            const x0 = 110; // aresta esquerda da caixa no início
            const xe = x0 + d * 14;
            const cx = xe + 50;
            const cy = 215;
            const L = F * 1.3;
            const r1 = (n) => Math.round(n * 10) / 10;

            set(q('.me-tc-caixa'), { x: r1(xe) });

            // Fundo hachurado do chão (só uma vez)
            const hach = q('.me-tc-hachura');
            if (hach && !hach.childNodes.length) {
                let traços = '';
                for (let x = 0; x <= 630; x += 16) traços += `<line x1="${x + 10}" y1="250" x2="${x}" y2="262"/>`;
                hach.innerHTML = traços;
            }

            // N (para cima) e P (para baixo) partem do centro de massa da
            // caixa (o centro do retângulo, onde também está a bolinha).
            const gN = q('.me-tc-N');
            set(gN.querySelector('line'), { x1: r1(cx), y1: cy, x2: r1(cx), y2: cy - 62 });
            set(gN.querySelector('text'), { x: r1(cx - 24), y: cy - 62 });
            const gP = q('.me-tc-P');
            set(gP.querySelector('line'), { x1: r1(cx), y1: cy, x2: r1(cx), y2: cy + 56 });
            set(gP.querySelector('text'), { x: r1(cx + 12), y: cy + 74 });
            set(q('.me-tc-cm'), { cx: r1(cx), cy });

            // F e as suas componentes
            const gF = q('.me-tc-F');
            gF.style.display = F < 1 ? 'none' : '';
            const ex = cx + L * cosA;
            const ey = cy - L * sinA;
            const corW = Math.abs(cosA * F * d) < 0.05 || Math.abs(cosA) < 0.005 ? '#868e96' : (cosA > 0 ? '#1f8a5b' : '#c92a2a');
            set(q('.me-tc-fseta'), { x1: r1(cx), y1: cy, x2: r1(ex), y2: r1(ey) });
            set(q('.me-tc-fx'), { x1: r1(cx), y1: cy, x2: r1(ex), y2: cy, stroke: corW });
            set(q('.me-tc-fy'), { x1: r1(ex), y1: cy, x2: r1(ex), y2: r1(ey), stroke: '#868e96' });
            set(q('.me-tc-flabel'), { x: r1(ex + 12 * cosA + (cosA >= 0 ? 4 : -14)), y: r1(ey - 8 * sinA - 4) });
            // Raio do arco: até 90° tem de ficar dentro do triângulo formado por F,
            // F cos α e F sen α (não pode passar da linha tracejada vertical);
            // depois de 90° o triângulo passa para o outro lado e basta
            // caber ao longo de F.
            const rArco = alfa < 90
                ? Math.max(8, Math.min(38, L * 0.4, L * cosA * 0.85))
                : Math.min(38, Math.max(14, L * 0.5));
            set(q('.me-tc-arco'), {
                d: `M ${r1(cx + rArco)} ${cy} A ${r1(rArco)} ${r1(rArco)} 0 0 0 ${r1(cx + rArco * cosA)} ${r1(cy - rArco * sinA)}`,
                display: alfa < 3 || Math.abs(alfa - 90) < 0.5 ? 'none' : ''
            });
            const meio = rad / 2;
            set(q('.me-tc-alfa'), { x: r1(cx + (rArco + 12) * Math.cos(meio) - 4), y: r1(cy - (rArco + 12) * Math.sin(meio) + 4), display: alfa < 8 || Math.abs(alfa - 90) < 0.5 || F < 1 ? 'none' : '' });

            // Deslocamento: seta por baixo do chão, do centro inicial ao final
            const gd = q('.me-tc-d');
            gd.style.display = d < 0.25 ? 'none' : '';
            set(q('.me-tc-dlinha'), { x1: x0 + 50, y1: 305, x2: r1(cx), y2: 305 });
            const dl = q('.me-tc-dlabel');
            set(dl, { x: r1((x0 + 50 + cx) / 2), y: 324 });
            dl.textContent = `d = ${comVirgula(d)} m`;

            // Trabalho no canto de cima
            const W = F * d * cosA;
            const w = q('.me-tc-w');
            w.textContent = `W = F d cos α = ${comVirgula(W.toFixed(1))} J`;
            w.setAttribute('fill', corW);
        }

        /** Tabela periódica clicável, reutilizável como controlo de uma
         *  simulação (controlo.tipo === 'tabela_periodica'). Cada elemento
         *  de controlo.elementos traz z, simbolo, nome, massa, periodo,
         *  grupo e bloco; a posição na grelha vem do período e do grupo e
         *  a cor do bloco. O elemento escolhido fica num <input hidden>
         *  com o id do controlo, lido como qualquer outro controlo. */
        tabelaPeriodicaHtml(controlo) {
            const elementos = controlo.elementos || [];
            const inicial = controlo.valor_inicial ?? (elementos[0] && elementos[0].z);
            const celulasHtml = elementos.map((el) => `
                <button type="button" class="me-tp-celula me-tp-bloco-${escapeAttr(el.bloco)}${el.z === inicial ? ' is-active' : ''}"
                    style="grid-row:${Number(el.periodo)};grid-column:${Number(el.grupo)}"
                    data-tp-z="${Number(el.z)}" title="${escapeAttr(`${el.nome} (Z = ${el.z})`)}" aria-label="${escapeAttr(el.nome)}">
                    <span class="me-tp-z">${Number(el.z)}</span>
                    <span class="me-tp-simbolo">${escapeHtml(el.simbolo)}</span>
                    <span class="me-tp-massa">${escapeHtml(el.massa)}</span>
                </button>
            `).join('');
            return `
                <div class="me-simulacao-controlo me-tp">
                    <span class="me-simulacao-rotulo">${escapeHtml(controlo.rotulo || 'Tabela periódica')}</span>
                    <input type="hidden" data-simulacao-controlo="${escapeAttr(controlo.id)}" data-tipo="tabela_periodica" value="${escapeAttr(inicial)}">
                    <div class="me-tp-grelha">${celulasHtml}</div>
                    <div class="me-tp-legenda">
                        <span class="me-tp-bloco-s">bloco s</span>
                        <span class="me-tp-bloco-p">bloco p</span>
                        <span class="me-tp-bloco-d">bloco d</span>
                        <span class="me-tp-bloco-f">bloco f</span>
                    </div>
                </div>
            `;
        }

        /** Liga os sliders/selects/botões de uma simulação (ver
         *  renderSimulacao) a um recálculo em tempo real das saídas. Cada
         *  fórmula é avaliada com os ids dos controlos como variáveis
         *  soltas no âmbito — new Function(...ids, 'return (' + formula +
         *  ')') em vez de eval(), para não herdar o âmbito local daqui. */
        bindSimulacao(screen) {
            const container = this.root.querySelector(`[data-simulacao-id="${screen.id || ''}"]`);
            if (!container || container.dataset.bound === 'true') return;
            container.dataset.bound = 'true';

            const controlos = screen.controlos || [];
            const saidas = screen.saidas || [];
            const ids = controlos.filter((c) => c.tipo !== 'botao').map((c) => c.id);
            const estadoBotoes = {};

            const lerValores = () => {
                const valores = {};
                ids.forEach((id) => {
                    const el = container.querySelector(`[data-simulacao-controlo="${id}"]`);
                    valores[id] = el ? Number(el.value) || el.value : 0;
                });
                Object.assign(valores, estadoBotoes);
                return valores;
            };

            const recalcular = () => {
                const valores = lerValores();
                ids.forEach((id) => {
                    const span = container.querySelector(`[data-simulacao-valor-de="${id}"]`);
                    if (span) span.textContent = comVirgula(valores[id]);
                });
                // screen.dados: tabela fixa da própria simulação (ex: dados
                // por elemento químico), disponível nas fórmulas como `dados`
                // em vez de repetida dentro de cada fórmula.
                const escopo = { ...valores, dados: screen.dados || {}, num: formatarNumero };
                this.atualizarVisualSimulacao(screen, container, valores);
                saidas.forEach((saida, i) => {
                    const span = container.querySelector(`[data-simulacao-saida="${i}"]`);
                    if (!span) return;
                    let resultado;
                    try {
                        resultado = new Function(...Object.keys(escopo), `return (${saida.formula});`)(...Object.values(escopo));
                    } catch (erro) {
                        resultado = null;
                    }
                    if (typeof resultado === 'number' && Number.isFinite(resultado)) {
                        span.textContent = comVirgula(saida.casas_decimais != null ? resultado.toFixed(saida.casas_decimais) : resultado);
                    } else if (typeof resultado === 'string') {
                        span.textContent = resultado;
                    } else {
                        span.textContent = '—';
                    }
                });
            };

            container.querySelectorAll('[data-simulacao-controlo]').forEach((el) => {
                el.addEventListener('input', recalcular);
                el.addEventListener('change', recalcular);
            });
            container.querySelectorAll('[data-simulacao-botao]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    estadoBotoes[btn.dataset.simulacaoBotao] = true;
                    recalcular();
                });
            });
            container.querySelectorAll('.me-tp').forEach((tabela) => {
                const input = tabela.querySelector('input[data-tipo="tabela_periodica"]');
                tabela.querySelectorAll('[data-tp-z]').forEach((celula) => {
                    celula.addEventListener('click', () => {
                        tabela.querySelectorAll('[data-tp-z]').forEach((c) => c.classList.toggle('is-active', c === celula));
                        input.value = celula.dataset.tpZ;
                        recalcular();
                    });
                });
            });

            recalcular();
        }

        getQuizState(section) {
            if (!this.state.quizState[section.secao_id]) {
                this.state.quizState[section.secao_id] = { current: 0, answers: [] };
            }
            return this.state.quizState[section.secao_id];
        }

        isQuizFullyAnswered(section, screen) {
            const quizState = this.getQuizState(section);
            return quizState.current >= (screen.perguntas || []).length;
        }

        /** Lista de opções só de leitura (sem clique), para a revisão do
         *  resultado — reaproveita tal e qual o visual de .quiz-option da
         *  pergunta em curso (correta a verde, a escolhida errada a
         *  vermelho, as restantes neutras), só que mostra todas as opções
         *  de uma vez em vez de só a que foi escolhida. */
        quizOptionsReviewHtml(opcoes, correta, selected) {
            return (opcoes || []).map((opcao, i) => {
                let stateClass = '';
                if (i === correta) stateClass = 'correct';
                else if (i === selected) stateClass = 'incorrect';
                return `
                    <div class="quiz-option me-quiz-resultado-option ${stateClass}">
                        <span class="option-letter">${String.fromCharCode(65 + i)}</span>
                        <span class="option-text">${escapeHtml(opcao)}</span>
                    </div>
                `;
            }).join('');
        }

        renderQuizSeccao(section, screen) {
            const perguntas = screen.perguntas || [];
            const quizState = this.getQuizState(section);

            if (quizState.current >= perguntas.length) {
                const correctCount = quizState.answers.filter((a) => a.correct).length;
                const total = perguntas.length;
                const ratio = total ? correctCount / total : 0;
                const allCorrect = total > 0 && correctCount === total;

                // Verde se acertar tudo, amarelo se acertar metade ou mais,
                // vermelho caso contrário — proporcional ao nº de perguntas
                // da secção, não fixo em "3".
                const resultModifier = allCorrect ? 'green' : (ratio >= 0.5 ? 'yellow' : 'red');

                // Revisão: pergunta a pergunta, com todas as opções (não só
                // a escolhida) — a certa sempre a verde, a errada que
                // escolheste a vermelho, as restantes neutras — para dar
                // para comparar, em vez da mascote, que aqui só repetia o
                // resultado sem dar detalhe nenhum.
                const revisaoHtml = perguntas.length
                    ? `
                        <div class="me-quiz-resultado-revisao">
                            ${perguntas.map((pergunta, i) => {
                                const resposta = quizState.answers[i];
                                if (!resposta) return '';
                                return `
                                    <div class="me-quiz-resultado-item">
                                        <p class="me-quiz-resultado-pergunta">${i + 1}. ${escapeHtml(pergunta.pergunta)}</p>
                                        <div class="quiz-options me-quiz-resultado-options">
                                            ${this.quizOptionsReviewHtml(pergunta.opcoes, pergunta.correta, resposta.selected)}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `
                    : '';

                const conclusaoHtml = screen.mascote_conclusao
                    ? `
                        <div class="me-escada-detail me-quiz-resultado-conclusao-painel">
                            <p class="me-quiz-resultado-conclusao">${escapeHtml(screen.mascote_conclusao)}</p>
                        </div>
                    `
                    : '';

                return `
                    <div class="me-quiz-seccao">
                        <div class="me-quiz-resultado">
                            ${allCorrect ? `<div class="me-confetti">${this.buildConfettiHtml(50)}</div>` : ''}
                            <h3 class="me-quiz-resultado-title">Resultado do quiz</h3>
                            <div class="me-quiz-resultado-circle me-quiz-resultado-circle--${resultModifier}">${correctCount}/${total}</div>
                            ${revisaoHtml}
                            ${conclusaoHtml}
                        </div>
                    </div>
                `;
            }

            const introHtml = quizState.current === 0 ? this.mascotInlineCardHtml(screen.mascote_texto) : '';

            const questionIndex = quizState.current;
            const question = perguntas[questionIndex];
            const savedAnswer = quizState.answers[questionIndex];

            const optionsHtml = (question.opcoes || []).map((opcao, i) => {
                let stateClass = '';
                if (savedAnswer) {
                    if (i === question.correta) stateClass = 'correct';
                    else if (i === savedAnswer.selected) stateClass = 'incorrect';
                }
                return `
                    <button type="button" class="quiz-option ${stateClass}" data-quiz-option-index="${i}" ${savedAnswer ? 'disabled' : ''}>
                        <span class="option-letter">${String.fromCharCode(65 + i)}</span>
                        <span class="option-text">${escapeHtml(opcao)}</span>
                    </button>
                `;
            }).join('');

            const feedbackHtml = savedAnswer
                ? this.buildFeedbackHtml(savedAnswer.correct, question.mascote_feedback_certo, question.mascote_feedback_errado)
                : '';

            // Navegação entre perguntas do quiz vive dentro do próprio
            // painel (setas), separada do "Anterior" de fora (que só troca
            // de ecrã, ver bindScreenInteractions/#mePrevBtn) — a seta
            // esquerda volta a uma pergunta já respondida, a direita avança
            // para a seguinte. Só a última pergunta usa o botão "Ver
            // resultado" (fora do painel, ver quizContinueHtml abaixo), que
            // sai do quiz para o ecrã de resultado.
            const isLastQuestion = questionIndex === perguntas.length - 1;
            const quizPrevArrowHtml = questionIndex > 0
                ? `
                    <button type="button" class="me-quiz-nav-arrow me-quiz-nav-arrow--prev" id="meQuizPrevQuestionBtn" aria-label="Pergunta anterior">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
                    </button>
                `
                : '';
            const quizNextArrowHtml = (savedAnswer && !isLastQuestion)
                ? `
                    <button type="button" class="me-quiz-nav-arrow me-quiz-nav-arrow--next" id="meQuizContinueBtn" aria-label="Pergunta seguinte">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </button>
                `
                : '';
            const quizArrowsHtml = (quizPrevArrowHtml || quizNextArrowHtml)
                ? `<div class="me-quiz-nav-arrows">${quizPrevArrowHtml}${quizNextArrowHtml}</div>`
                : '';

            const quizContinueHtml = (savedAnswer && isLastQuestion)
                ? `
                    <div class="lesson-quiz-actions">
                        <button type="button" class="lesson-primary-btn quiz-nav-btn--next" id="meQuizContinueBtn">Ver resultado</button>
                    </div>
                `
                : '';

            return `
                <div class="me-quiz-seccao me-quiz-seccao--pergunta">
                    ${introHtml}
                    <p class="quiz-progress-label">Pergunta ${questionIndex + 1} de ${perguntas.length}</p>
                    <p class="quiz-question">${escapeHtml(question.pergunta)}</p>
                    <div class="quiz-options">${optionsHtml}</div>
                    ${feedbackHtml}
                    ${quizArrowsHtml}
                </div>
                ${quizContinueHtml}
            `;
        }

        // ---- Interações -------------------------------------------------------

        /** Liga o clique em cada chip/degrau ([data-ponto-index]) de um
         *  diagrama à atualização do painel de explicação — reaproveitado
         *  tanto para o diagrama do ecrã atual como para uma cópia dele a
         *  aparecer só como pano de fundo (ver findBackdropScreen). */
        bindDiagramaChips(diagramScreen) {
            const isEscada = diagramScreen.layout === 'escada';
            const isArvore = diagramScreen.layout === 'arvore';
            const isMapa = diagramScreen.layout === 'mapa';
            const useCardDetail = isEscada || isArvore || isMapa || diagramScreen.cartao_estilo === true;
            const explicacaoEl = this.root.querySelector('#meDiagramaExplicacao');
            const activeSelector = isEscada ? '.me-escada-step' : (isArvore ? '.me-arvore-node' : (isMapa ? '.me-mapa-marker' : '.me-diagrama-chip'));
            // O ponto pré-selecionado (primeiroPonto) já pode ter vindo com
            // uma curiosidade ou um inquérito no HTML inicial — sem isto,
            // só ganhavam a interação depois de se clicar noutro degrau e
            // voltar a este.
            if (explicacaoEl) {
                this.bindCuriosidadeToggle(explicacaoEl);
                this.bindAtencaoToggle(explicacaoEl);
                this.bindInquerito(explicacaoEl, diagramScreen.pontos[0]);
            }
            const exercicioInicialEl = this.root.querySelector('#meDiagramaExercicio');
            if (exercicioInicialEl) {
                this.bindExercicio(exercicioInicialEl, diagramScreen, diagramScreen.pontos[0]);
            }
            this.root.querySelectorAll('[data-ponto-index]').forEach((chip) => {
                chip.addEventListener('click', () => {
                    const ponto = diagramScreen.pontos[Number(chip.dataset.pontoIndex)];
                    this.root.querySelectorAll(activeSelector).forEach((c) => c.classList.remove('is-active'));
                    chip.classList.add('is-active');
                    const exercicioEl = this.root.querySelector('#meDiagramaExercicio');
                    if (exercicioEl) {
                        this.bindExercicio(exercicioEl, diagramScreen, ponto);
                        exercicioEl.innerHTML = this.exercicioPontoHtml(diagramScreen, ponto);
                    }
                    if (useCardDetail) {
                        if (explicacaoEl) {
                            explicacaoEl.hidden = false;
                            explicacaoEl.innerHTML = this.pontoDetailInnerHtml(ponto);
                            this.bindCuriosidadeToggle(explicacaoEl);
                            this.bindAtencaoToggle(explicacaoEl);
                            this.bindInquerito(explicacaoEl, ponto);
                        }
                        return;
                    }
                    if (explicacaoEl) {
                        explicacaoEl.hidden = false;
                        // ponto.imagem/ponto.intro são opcionais — um
                        // ponto (ex: Robert Hooke) pode ter foto própria
                        // e uma frase de abertura antes da explicação em
                        // si, para ligar ao contexto da secção.
                        const fotoHtml = ponto.imagem
                            ? `<img class="curiosity-illustration" src="/static/images/${encodeURIComponent(ponto.imagem)}" alt="${escapeHtml(ponto.label)}" onerror="this.remove()">`
                            : '';
                        const introHtml = ponto.intro
                            ? `<p class="me-diagrama-explicacao-intro">${escapeHtml(ponto.intro)}</p>`
                            : '';
                        explicacaoEl.innerHTML = `
                            <div class="did-you-know-body">
                                ${fotoHtml}
                                <div class="did-you-know-text">
                                    <strong>${escapeHtml(ponto.label)}</strong>
                                    ${introHtml}
                                    <p>${escapeHtml(ponto.explicacao)}</p>
                                    ${this.saberMaisHtml(ponto)}
                                </div>
                            </div>
                        `;
                    }
                });
            });
        }

        /** Vídeos decorativos (ex: molécula a girar) vêm com fundo branco
         *  gravado nos próprios pixels — sem canal alfa num .mp4, um
         *  filtro CSS não consegue distinguir "fundo branco" de "peça
         *  branca da própria molécula" (ambos ficam com a mesma
         *  luminosidade). Por isso desenha-se cada frame num <canvas>
         *  escondido atrás do vídeo e torna-se transparente só o que está
         *  muito perto do branco puro do fundo (ver amostragem em
         *  sample_video_pixels: cantos ~253-255, molécula bem mais escura
         *  que isso) — a molécula em si fica intacta. */
        startChromaKeyLoop(video) {
            const canvas = video.nextElementSibling;
            if (!canvas || !canvas.classList.contains('me-video-chroma-canvas')) return;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            const NEAR = 10;
            const FAR = 60;
            const draw = () => {
                if (!video.isConnected || !canvas.isConnected) return;
                if (video.videoWidth && video.videoHeight) {
                    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                        canvas.width = video.videoWidth;
                        canvas.height = video.videoHeight;
                    }
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = frame.data;
                    for (let i = 0; i < data.length; i += 4) {
                        const dist = (255 - data[i]) + (255 - data[i + 1]) + (255 - data[i + 2]);
                        if (dist <= NEAR) {
                            data[i + 3] = 0;
                        } else if (dist < FAR) {
                            data[i + 3] = Math.round(255 * (dist - NEAR) / (FAR - NEAR));
                        }
                    }
                    ctx.putImageData(frame, 0, 0);
                }
                video.requestVideoFrameCallback ? video.requestVideoFrameCallback(draw) : requestAnimationFrame(draw);
            };
            video.requestVideoFrameCallback ? video.requestVideoFrameCallback(draw) : requestAnimationFrame(draw);
        }

        bindScreenInteractions(section, screen, screenIndex) {
            // Re-render substitui o <video> por um elemento novo a cada
            // vez (troca de ponto, popup, etc.) — o atributo autoplay do
            // HTML nem sempre chega a tempo de arrancar (a promise de
            // play() pode ser interrompida pela própria substituição do
            // nó), ficando um vídeo parado e invisível. Chamar .play()
            // explicitamente aqui, já muted, garante que arranca sempre.
            this.root.querySelectorAll('video[autoplay]').forEach((video) => {
                const playPromise = video.play();
                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(() => {});
                }
            });
            this.root.querySelectorAll('video[data-chroma-key]').forEach((video) => {
                this.startChromaKeyLoop(video);
            });

            if (screen.tipo === 'diagrama_interativo') {
                this.bindDiagramaChips(screen);
            }

            if (screen.tipo === 'formula_interativa') {
                this.bindFormulaInterativa(screen);
            }

            if (screen.tipo === 'acordeao') {
                this.bindAcordeao();
            }

            if (screen.tipo === 'simulacao') {
                this.bindSimulacao(screen);
                if (screen.curiosidade) this.bindCuriosidadeToggle(this.root.querySelector('.me-simulacao-cartao') || this.root);
                const desafioEl = screen.desafio && this.root.querySelector(`#meDesafio-${screen.id || ''}`);
                if (desafioEl) {
                    this.bindExercicio(desafioEl, screen, { id: 'desafio', exercicio: { ...screen.desafio, titulo: screen.desafio.titulo || 'Desafio', icone: 'alvo' } });
                }
            }

            // Também no pano de fundo de uma micro-verificação (ver abaixo).
            this.bindEscadaConversao();

            if (screen.tipo === 'analogia' && screen.curiosidade) {
                this.bindCuriosidadeToggle(this.root);
            }

            // Quando o ecrã de baixo é uma micro-verificação com pano de
            // fundo (o último diagrama/gancho, ver renderMicroVerificacao e
            // findBackdropScreen), os degraus/chips aparecem também por lá
            // — sem isto, cliques nesse pano de fundo não faziam nada, o
            // que parecia um bug de "a escada não responde ao clique".
            if (screen.tipo === 'micro_verificacao' && this.mascotEnabled() && screen.pergunta) {
                const backdrop = this.findBackdropScreen(section, screenIndex);
                if (backdrop) this.bindDiagramaChips(backdrop);
            }

            if (screen.tipo === 'micro_verificacao') {
                const answerKey = `${section.secao_id}::${screenIndex}`;
                if (!this.state.answers[answerKey]) {
                    this.root.querySelectorAll('[data-option-index]').forEach((btn) => {
                        btn.addEventListener('click', () => {
                            const selected = Number(btn.dataset.optionIndex);
                            const correct = selected === screen.correta;
                            this.state.answers[answerKey] = { selected, correct };
                            this.saveState();
                            if (correct) this.celebrateCorrectAnswer();
                            this.render();
                        });
                    });
                }
            }

            if (screen.tipo === 'quiz_seccao') {
                const quizState = this.getQuizState(section);
                const perguntas = screen.perguntas || [];

                if (quizState.current < perguntas.length) {
                    const question = perguntas[quizState.current];
                    const savedAnswer = quizState.answers[quizState.current];

                    if (!savedAnswer) {
                        this.root.querySelectorAll('[data-quiz-option-index]').forEach((btn) => {
                            btn.addEventListener('click', () => {
                                const selected = Number(btn.dataset.quizOptionIndex);
                                const correct = selected === question.correta;
                                quizState.answers[quizState.current] = { selected, correct };
                                this.saveState();
                                if (correct) this.celebrateCorrectAnswer();
                                this.render();
                            });
                        });
                    }

                    this.root.querySelector('#meQuizContinueBtn')?.addEventListener('click', () => {
                        quizState.current += 1;
                        this.saveState();
                        this.render();
                    });

                    this.root.querySelector('#meQuizPrevQuestionBtn')?.addEventListener('click', () => {
                        quizState.current -= 1;
                        this.saveState();
                        this.render();
                    });
                }
            }
        }

        // ---- Conclusão da missão -----------------------------------------------

        completeMission() {
            // O XP já foi todo pago página a página (e no quiz de cada
            // secção) por awardPageXP, chamado em advance() antes de chegar
            // aqui — nada a pagar de novo, só sincronizar o estado final
            // (completedSections já inclui a última secção neste ponto).
            this.syncProgressWithDjango();

            this.state.view = 'celebracao';
            this.state.celebrationShown = true;
            this.saveState();
            this.render();
        }

        syncProgressWithDjango(totalXP = this.totalMissionXpEarned()) {
            if (!this.progressSyncUrl || !this.csrfToken) return;

            const sectionScores = {};
            this.sections.forEach((section) => {
                const quizScreen = (section.ecrãs || []).find((e) => e.tipo === 'quiz_seccao');
                const quizState = this.state.quizState[section.secao_id];
                if (quizScreen && quizState && quizState.answers.length) {
                    const correct = quizState.answers.filter((a) => a.correct).length;
                    sectionScores[section.secao_id] = Math.round((correct / quizScreen.perguntas.length) * 100);
                }
            });

            const xpAfter = window.ProfileXP
                ? window.ProfileXP.getProfileStats(window.ProfileXP.getCurrentUserProfile()).xp
                : totalXP;

            fetch(this.progressSyncUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': this.csrfToken },
                credentials: 'same-origin',
                body: JSON.stringify({
                    missionId: this.missao.missao_id,
                    progress: {
                        totalSections: this.sections.length,
                        completedSections: this.state.completedSections,
                        sectionScores
                    },
                    xp: xpAfter
                })
            }).catch(() => {
                // Fire-and-forget — o progresso local (localStorage) já foi guardado.
            });
        }

        /** Gera N peças de confetti (cor, posição e duração aleatórias) para
         *  dentro de um contentor ".me-confetti" (position:relative na mãe,
         *  ver missao-engine.css) — reaproveitado na celebração de fim de
         *  missão e no resultado do quiz de secção quando acerta tudo. */
        buildConfettiHtml(count) {
            return Array.from({ length: count }, () => {
                const left = Math.random() * 100;
                const delay = Math.random() * 1.2;
                const duration = 2.2 + Math.random() * 1.6;
                const hue = Math.floor(Math.random() * 360);
                return `<span class="me-confetti-piece" style="left:${left}%; animation-delay:${delay}s; animation-duration:${duration}s; background:hsl(${hue}, 80%, 60%);"></span>`;
            }).join('');
        }

        renderCelebration() {
            const totalXP = this.totalMissionXpEarned();
            const confettiHtml = this.buildConfettiHtml(60);
            const badgeIconHtml = this.missao.badge?.icone || '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.54 15H17a2 2 0 0 0-2 2v4.54"/><path d="M7 3.34V5a3 3 0 0 0 3 3a2 2 0 0 1 2 2c0 1.1.9 2 2 2a2 2 0 0 0 2-2c0-1.1.9-2 2-2h3.17"/><path d="M11 21.95V18a2 2 0 0 0-2-2a2 2 0 0 1-2-2v-1a2 2 0 0 0-2-2H2.05"/><circle cx="12" cy="12" r="10"/></svg>';

            this.root.innerHTML = `
                <div class="me-shell me-shell--celebracao">
                    <div class="me-confetti">${confettiHtml}</div>
                    <div class="me-celebracao-card">
                        <span class="me-celebracao-badge">${badgeIconHtml}</span>
                        <h1>Missão concluída!</h1>
                        <p>Completaste "${escapeHtml(this.missao.titulo)}".</p>
                        <div class="me-celebracao-xp">
                            <span>+</span><span id="meCelebracaoXpValue">0</span><span>XP</span>
                        </div>
                        <button type="button" class="lesson-primary-btn" id="meCelebracaoContinueBtn">Voltar ao mapa de missões</button>
                    </div>
                </div>
            `;

            const valueEl = this.root.querySelector('#meCelebracaoXpValue');
            if (valueEl) {
                const start = performance.now();
                const durationMs = 1200;
                const tick = (now) => {
                    const progress = Math.min(1, (now - start) / durationMs);
                    valueEl.textContent = Math.round(progress * totalXP);
                    if (progress < 1) requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            }

            this.root.querySelector('#meCelebracaoContinueBtn')?.addEventListener('click', () => {
                // Sem isto, uma visita futura a esta missão (voltar atrás,
                // ou reabrir o link) encontrava view:'celebracao' guardado
                // e mostrava sempre a festa de novo em vez do mapa.
                this.state.view = 'mapa';
                this.saveState();
                window.location.href = this.missionsIndexUrl;
            });
        }
    }

    window.MissaoEngine = MissaoEngine;
})();

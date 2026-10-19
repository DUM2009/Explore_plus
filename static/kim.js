/**
 * Página de página inteira do Kim (ver kim.html): coluna de conversas
 * guardadas à esquerda + chat à direita, usando as mesmas APIs do painel
 * flutuante (mascote-chat / mascote-conversas / mascote-conversas/<id>).
 */
(function () {
    const messagesEl = document.getElementById('kimChatMessages');
    const form = document.getElementById('kimChatForm');
    const input = document.getElementById('kimChatInput');
    const sendBtn = document.getElementById('kimChatSend');
    const welcomeEl = document.getElementById('kimChatWelcome');
    const welcomeHTML = welcomeEl ? welcomeEl.outerHTML : '';
    const novaConversaBtn = document.getElementById('kimNovaConversaBtn');
    const listaEl = document.getElementById('kimConversasList');
    const vaziaEl = document.getElementById('kimConversasEmpty');
    const conversasCol = document.getElementById('kimConversasCol');
    const conversasOverlay = document.getElementById('kimConversasOverlay');
    const conversasToggleBtn = document.getElementById('kimConversasToggleBtn');
    const conversasCloseBtn = document.getElementById('kimConversasCloseBtn');
    const kimLayout = document.querySelector('.kim-layout');

    if (!messagesEl || !form || !input) return;

    /* No telemóvel o chat ocupa o ecrã todo: em vez de assumir uma altura
       fixa de topbar (que muda consoante o dispositivo/zoom), mede-se o
       espaço já ocupado acima do .kim-layout e usa-se o resto. */
    function ajustarAlturaLayout() {
        if (!kimLayout) return;
        if (window.innerWidth > 860) {
            kimLayout.style.removeProperty('--kim-fill-height');
            return;
        }
        const topo = kimLayout.getBoundingClientRect().top;
        kimLayout.style.setProperty('--kim-fill-height', `${window.innerHeight - topo}px`);
    }
    ajustarAlturaLayout();
    window.addEventListener('resize', ajustarAlturaLayout);
    window.addEventListener('orientationchange', ajustarAlturaLayout);

    let history = [];
    let conversaId = null;

    function fecharConversas() {
        conversasCol?.classList.remove('is-open');
        conversasCol?.setAttribute('aria-hidden', 'true');
        if (conversasOverlay) conversasOverlay.hidden = true;
        conversasToggleBtn?.setAttribute('aria-expanded', 'false');
    }

    function abrirConversas() {
        conversasCol?.classList.add('is-open');
        conversasCol?.setAttribute('aria-hidden', 'false');
        if (conversasOverlay) conversasOverlay.hidden = false;
        conversasToggleBtn?.setAttribute('aria-expanded', 'true');
    }

    conversasToggleBtn?.addEventListener('click', () => {
        if (conversasCol?.classList.contains('is-open')) fecharConversas();
        else abrirConversas();
    });
    conversasCloseBtn?.addEventListener('click', fecharConversas);
    conversasOverlay?.addEventListener('click', fecharConversas);

    function bindSuggestionButtons(root) {
        root?.querySelectorAll('.mascote-chat-suggestion').forEach((button) => {
            button.addEventListener('click', () => {
                input.value = button.dataset.suggestion || '';
                input.focus();
            });
        });
    }
    bindSuggestionButtons(welcomeEl);

    function appendBubble(role, text, isTyping) {
        document.getElementById('kimChatWelcome')?.remove();
        const bubble = document.createElement('div');
        bubble.className = `mascote-chat-bubble mascote-chat-bubble--${role}${isTyping ? ' is-typing' : ''}`;
        bubble.textContent = text;
        messagesEl.appendChild(bubble);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return bubble;
    }

    function formatConversaData(isoString) {
        try {
            return new Date(isoString).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
        } catch (error) {
            return '';
        }
    }

    async function carregarListaConversas() {
        if (!listaEl || !window.exploreMascoteConversasUrl) return;
        try {
            const response = await fetch(window.exploreMascoteConversasUrl, { credentials: 'same-origin' });
            const data = await response.json();
            const conversas = Array.isArray(data) ? data : (data.conversas || []);
            listaEl.innerHTML = '';
            if (vaziaEl) vaziaEl.hidden = conversas.length > 0;
            conversas.forEach((conversa) => {
                const li = document.createElement('li');
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'kim-conversa-item';
                if (conversa.id === conversaId) button.classList.add('is-active');
                const titulo = document.createElement('span');
                titulo.className = 'kim-conversa-item-titulo';
                titulo.textContent = conversa.titulo || 'Conversa sem título';
                const meta = document.createElement('span');
                meta.className = 'kim-conversa-item-meta';
                meta.textContent = formatConversaData(conversa.atualizado_em);
                button.appendChild(titulo);
                button.appendChild(meta);
                button.addEventListener('click', () => abrirConversa(conversa.id));
                li.appendChild(button);
                listaEl.appendChild(li);
            });
        } catch (error) {
            if (vaziaEl) {
                vaziaEl.hidden = false;
                vaziaEl.textContent = 'Não foi possível carregar as conversas guardadas.';
            }
        }
    }

    async function abrirConversa(id) {
        if (!window.exploreMascoteConversaDetalheUrlBase) return;
        try {
            const response = await fetch(`${window.exploreMascoteConversaDetalheUrlBase}${id}/`, { credentials: 'same-origin' });
            const data = await response.json();
            if (!response.ok) return;
            messagesEl.innerHTML = '';
            const mensagens = data.mensagens || [];
            mensagens.forEach((mensagem) => appendBubble(mensagem.role, mensagem.text));
            history = mensagens.map((mensagem) => ({ role: mensagem.role, text: mensagem.text }));
            conversaId = id;
            if (input) {
                input.disabled = false;
                input.placeholder = 'Pergunta ao Kim...';
            }
            if (sendBtn) sendBtn.disabled = false;
            carregarListaConversas();
            fecharConversas();
        } catch (error) {
            // silencia — a conversa simplesmente não abre
        }
    }

    novaConversaBtn?.addEventListener('click', () => {
        messagesEl.innerHTML = welcomeHTML;
        bindSuggestionButtons(messagesEl);
        history = [];
        conversaId = null;
        if (input) {
            input.disabled = false;
            input.placeholder = 'Pergunta ao Kim...';
            input.focus();
        }
        if (sendBtn) sendBtn.disabled = false;
        carregarListaConversas();
        fecharConversas();
    });

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        appendBubble('user', text);
        const historyBefore = [...history];
        history.push({ role: 'user', text });
        const typingEl = appendBubble('assistant', '…', true);
        try {
            const response = await fetch(window.exploreMascoteChatUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.exploreCsrfToken },
                credentials: 'same-origin',
                body: JSON.stringify({
                    message: text,
                    missionTitle: 'Kim',
                    sectionTitle: '',
                    context: '',
                    history: historyBefore,
                    conversaId,
                }),
            });
            const data = await response.json().catch(() => ({}));
            typingEl?.remove();
            if (!response.ok) {
                appendBubble('assistant', data.erro || 'Não consegui responder agora. Tenta mais tarde.');
                if (data.limiteAtingido && input && sendBtn) {
                    input.disabled = true;
                    input.placeholder = 'Sem perguntas disponíveis esta semana';
                    sendBtn.disabled = true;
                }
                return;
            }
            appendBubble('assistant', data.reply || '...');
            history.push({ role: 'assistant', text: data.reply || '' });
            if (data.conversaId) {
                conversaId = data.conversaId;
                carregarListaConversas();
            }
        } catch (error) {
            typingEl?.remove();
            appendBubble('assistant', 'Não consegui ligar ao servidor. Verifica a tua ligação.');
        }
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        sendMessage();
    });

    carregarListaConversas();
})();

/**
 * Página do Kim (ver kim.html): coluna de conversas guardadas + chat,
 * usando as APIs mascote-chat / mascote-conversas / mascote-conversas/<id>.
 */
(function () {
    const workspace = document.getElementById('kimWorkspace');
    const messagesEl = document.getElementById('kimChatMessages');
    const form = document.getElementById('kimChatForm');
    const input = document.getElementById('kimChatInput');
    const sendBtn = document.getElementById('kimChatSend');
    const welcomeEl = document.getElementById('kimChatWelcome');
    const welcomeHTML = welcomeEl ? welcomeEl.outerHTML : '';
    const novaConversaBtn = document.getElementById('kimNovaConversaBtn');
    const toggleBtn = document.getElementById('kimToggleConversas');
    const listaEl = document.getElementById('kimConversasList');
    const vaziaEl = document.getElementById('kimConversasEmpty');
    const mobileQuery = window.matchMedia('(max-width: 980px)');

    if (!messagesEl || !form || !input) return;

    let history = [];
    let conversaId = null;

    function setConversasVisiveis(visiveis) {
        workspace?.classList.toggle('is-conversas-hidden', !visiveis);
        toggleBtn?.setAttribute('aria-expanded', String(visiveis));
    }
    setConversasVisiveis(!mobileQuery.matches);

    document.getElementById('kimConversasClose')?.addEventListener('click', () => setConversasVisiveis(false));
    document.getElementById('kimConversasOverlay')?.addEventListener('click', () => setConversasVisiveis(false));

    toggleBtn?.addEventListener('click', () => {
        setConversasVisiveis(workspace.classList.contains('is-conversas-hidden'));
    });

    function fecharConversasNoMobile() {
        if (mobileQuery.matches) setConversasVisiveis(false);
    }

    function bindSuggestionButtons(root) {
        root?.querySelectorAll('.kim-suggestion').forEach((button) => {
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

    function desbloquearInput() {
        input.disabled = false;
        input.placeholder = 'Pergunta ao Kim...';
        if (sendBtn) sendBtn.disabled = false;
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
                const texto = vaziaEl.querySelector('p');
                if (texto) texto.textContent = 'Não foi possível carregar as conversas.';
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
            desbloquearInput();
            fecharConversasNoMobile();
            carregarListaConversas();
        } catch (error) {
            // silencia — a conversa simplesmente não abre
        }
    }

    novaConversaBtn?.addEventListener('click', () => {
        messagesEl.innerHTML = welcomeHTML;
        bindSuggestionButtons(messagesEl);
        history = [];
        conversaId = null;
        desbloquearInput();
        fecharConversasNoMobile();
        input.focus();
        carregarListaConversas();
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
                if (data.limiteAtingido && sendBtn) {
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

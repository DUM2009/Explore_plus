/**
 * Botão flutuante "Falar com o Kim" + painel de chat, para páginas que não
 * têm a sua própria cópia deste componente (ver perfil.html/Testes.html
 * para as versões "nativas" de cada template). Injeta o mesmo HTML/CSS já
 * usados nessas páginas (classes .teste-mascote-fab / .mascote-chat-panel,
 * definidas em style.css) e liga-se à mesma API (mascote-chat).
 *
 * Não faz nada se a página já tiver um `.teste-mascote-fab` ou
 * `.mascot-chat-fab` próprio, ou se as globals do chat (definidas pelo
 * template antes de carregar este script) não existirem — ex: utilizador
 * não autenticado.
 */
(function () {
    if (document.querySelector('.teste-mascote-fab, .mascot-chat-fab')) return;
    if (!window.exploreMascoteChatUrl) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
<button type="button" class="teste-mascote-fab" id="profileMascoteFab" aria-label="Falar com o Kim">
    <video class="teste-mascote-fab-img teste-mascote-fab-img--desktop" autoplay loop muted playsinline aria-hidden="true">
        <source src="${window.exploreMascoteWebmUrl || ''}" type="video/webm">
    </video>
    <img class="teste-mascote-fab-img teste-mascote-fab-img--mobile" src="${window.exploreMascoteImgUrl || ''}" alt="" aria-hidden="true">
    <span class="teste-mascote-fab-tooltip">Precisas de ajuda a esclarecer dúvidas?</span>
</button>
<div class="mascote-chat-panel" id="mascoteChatPanel" hidden>
    <div class="mascote-chat-header">
        <button type="button" class="mascote-chat-history-btn" id="mascoteChatHistoryBtn" aria-haspopup="true" aria-expanded="false" aria-label="Conversas anteriores">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 2.64-6.36L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
        </button>
        <span>Fala com o Kim</span>
        <button type="button" class="mascote-chat-close" id="mascoteChatClose" aria-label="Fechar">✕</button>
    </div>
    <div class="mascote-chat-history-panel" id="mascoteChatHistoryPanel" hidden>
        <button type="button" class="mascote-chat-history-new" id="mascoteChatNewBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            Nova conversa
        </button>
        <p class="mascote-chat-history-empty" id="mascoteChatHistoryEmpty" hidden>Ainda não tens conversas guardadas.</p>
        <ul class="mascote-chat-history-list" id="mascoteChatHistoryList"></ul>
    </div>
    <div class="mascote-chat-messages" id="mascoteChatMessages">
        <div class="mascote-chat-welcome" id="mascoteChatWelcome">
            <video class="mascote-chat-welcome-video" autoplay loop muted playsinline aria-hidden="true">
                <source src="${window.exploreMascoteWebmUrl || ''}" type="video/webm">
            </video>
            <div class="mascote-chat-welcome-copy">
                <p class="mascote-chat-welcome-greeting">Olá, ${window.exploreUsername || ''}!</p>
                <h3 class="mascote-chat-welcome-title">Bem-vindo de volta! Como posso ajudar?</h3>
                <p class="mascote-chat-welcome-subtitle">Estou aqui para te ajudar a estudar Biologia. Escolhe uma sugestão ou escreve a tua pergunta!</p>
            </div>
            <div class="mascote-chat-suggestions">
                <button type="button" class="mascote-chat-suggestion" data-suggestion="Podes explicar-me este conceito de forma simples?">Explicar um conceito</button>
                <button type="button" class="mascote-chat-suggestion" data-suggestion="Podes resumir a matéria desta unidade?">Resumir a matéria</button>
                <button type="button" class="mascote-chat-suggestion" data-suggestion="Ajuda-me a preparar-me para um teste.">Preparar um teste</button>
                <button type="button" class="mascote-chat-suggestion" data-suggestion="Podes dar-me um exemplo prático?">Dar um exemplo</button>
                <button type="button" class="mascote-chat-suggestion" data-suggestion="Podes corrigir a minha resposta?">Corrigir a resposta</button>
            </div>
        </div>
    </div>
    <form class="mascote-chat-form" id="mascoteChatForm">
        <input type="text" class="mascote-chat-input" id="mascoteChatInput" placeholder="Escreve a tua pergunta..." autocomplete="off" maxlength="500">
        <button type="submit" class="mascote-chat-send" id="mascoteChatSend" aria-label="Enviar">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
        </button>
    </form>
</div>`;
    while (wrapper.firstChild) document.body.appendChild(wrapper.firstChild);

    const fab = document.getElementById('profileMascoteFab');
    const panel = document.getElementById('mascoteChatPanel');
    const messagesEl = document.getElementById('mascoteChatMessages');
    const form = document.getElementById('mascoteChatForm');
    const input = document.getElementById('mascoteChatInput');
    const sendBtn = document.getElementById('mascoteChatSend');
    const welcomeEl = document.getElementById('mascoteChatWelcome');
    const welcomeHTML = welcomeEl ? welcomeEl.outerHTML : '';
    let history = [];
    let conversaId = null;

    function bindSuggestionButtons(root) {
        root?.querySelectorAll('.mascote-chat-suggestion').forEach((button) => {
            button.addEventListener('click', () => {
                if (!input) return;
                input.value = button.dataset.suggestion || '';
                input.focus();
            });
        });
    }
    bindSuggestionButtons(welcomeEl);

    function appendBubble(role, text, isTyping) {
        document.getElementById('mascoteChatWelcome')?.remove();
        const bubble = document.createElement('div');
        bubble.className = `mascote-chat-bubble mascote-chat-bubble--${role}${isTyping ? ' is-typing' : ''}`;
        bubble.textContent = text;
        messagesEl.appendChild(bubble);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return bubble;
    }

    fab?.addEventListener('click', () => {
        panel.hidden = false;
        fab.hidden = true;
        if (window.matchMedia('(min-width: 721px)').matches) input?.focus();
    });

    document.getElementById('mascoteChatClose')?.addEventListener('click', () => {
        panel.hidden = true;
        if (fab) fab.hidden = false;
    });

    async function sendMessage() {
        const text = input?.value.trim();
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
                    missionTitle: document.title.split('|')[0].trim(),
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
            if (data.conversaId) conversaId = data.conversaId;
        } catch (error) {
            typingEl?.remove();
            appendBubble('assistant', 'Não consegui ligar ao servidor. Verifica a tua ligação.');
        }
    }

    form?.addEventListener('submit', (event) => {
        event.preventDefault();
        sendMessage();
    });

    const historyBtn = document.getElementById('mascoteChatHistoryBtn');
    const historyPanel = document.getElementById('mascoteChatHistoryPanel');
    const historyList = document.getElementById('mascoteChatHistoryList');
    const historyEmpty = document.getElementById('mascoteChatHistoryEmpty');
    const newBtn = document.getElementById('mascoteChatNewBtn');

    function formatConversaData(isoString) {
        try {
            return new Date(isoString).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
        } catch (error) {
            return '';
        }
    }

    async function loadConversaList() {
        if (!historyList || !window.exploreMascoteConversasUrl) return;
        historyList.innerHTML = '';
        try {
            const response = await fetch(window.exploreMascoteConversasUrl, { credentials: 'same-origin' });
            const conversas = await response.json();
            if (historyEmpty) historyEmpty.hidden = conversas.length > 0;
            conversas.forEach((conversa) => {
                const li = document.createElement('li');
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'mascote-chat-history-item';
                const titulo = document.createElement('span');
                titulo.textContent = conversa.titulo;
                const meta = document.createElement('span');
                meta.className = 'mascote-chat-history-item-meta';
                meta.textContent = formatConversaData(conversa.atualizado_em);
                button.appendChild(titulo);
                button.appendChild(meta);
                button.addEventListener('click', () => loadConversa(conversa.id));
                li.appendChild(button);
                historyList.appendChild(li);
            });
        } catch (error) {
            if (historyEmpty) {
                historyEmpty.hidden = false;
                historyEmpty.textContent = 'Não foi possível carregar as conversas guardadas.';
            }
        }
    }

    async function loadConversa(id) {
        if (!window.exploreMascoteConversaDetalheUrlBase) return;
        try {
            const response = await fetch(`${window.exploreMascoteConversaDetalheUrlBase}${id}/`, { credentials: 'same-origin' });
            const mensagens = await response.json();
            messagesEl.innerHTML = '';
            mensagens.forEach((mensagem) => appendBubble(mensagem.role, mensagem.text));
            history = mensagens.map((mensagem) => ({ role: mensagem.role, text: mensagem.text }));
            conversaId = id;
            if (historyPanel) historyPanel.hidden = true;
            historyBtn?.setAttribute('aria-expanded', 'false');
        } catch (error) {
            // silencia — a conversa simplesmente não abre
        }
    }

    historyBtn?.addEventListener('click', () => {
        if (!historyPanel) return;
        const willOpen = historyPanel.hidden;
        historyPanel.hidden = !willOpen;
        historyBtn.setAttribute('aria-expanded', String(willOpen));
        if (willOpen) loadConversaList();
    });

    newBtn?.addEventListener('click', () => {
        messagesEl.innerHTML = welcomeHTML;
        bindSuggestionButtons(messagesEl);
        history = [];
        conversaId = null;
        if (input) {
            input.disabled = false;
            input.placeholder = 'Escreve a tua pergunta...';
        }
        if (sendBtn) sendBtn.disabled = false;
        if (historyPanel) historyPanel.hidden = true;
        historyBtn?.setAttribute('aria-expanded', 'false');
    });
})();

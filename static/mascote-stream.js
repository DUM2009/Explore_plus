/* Pedido ao chat da mascote com resposta em streaming.

   exploreChatSend(url, csrf, payload, onParcial) -> { ok, data }
   - onParcial(textoAteAgora) é chamado à medida que o texto chega;
   - data tem o mesmo formato do endpoint sem streaming: { reply, conversaId,
     titulo } quando ok, ou { erro, limiteAtingido? } quando não.
   Se o servidor responder com JSON normal (erros, limite atingido), devolve-o
   tal como está. Lança exceção só se a ligação falhar. */
(function () {
    async function exploreChatSend(url, csrf, payload, onParcial) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
            credentials: 'same-origin',
            body: JSON.stringify(Object.assign({}, payload, { stream: true })),
        });

        const tipo = response.headers.get('Content-Type') || '';
        if (!response.ok || !tipo.includes('application/x-ndjson') || !response.body) {
            const data = await response.json().catch(() => ({}));
            return { ok: response.ok, data };
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let reply = '';
        let final = null;

        const tratarLinha = (linha) => {
            if (!linha.trim()) return null;
            let evento;
            try { evento = JSON.parse(linha); } catch (e) { return null; }
            if (evento.t === 'delta') {
                reply += evento.text;
                if (onParcial) onParcial(reply);
            } else if (evento.t === 'done') {
                final = evento;
            } else if (evento.t === 'erro') {
                return { ok: false, data: { erro: evento.erro } };
            }
            return null;
        };

        for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let indice;
            while ((indice = buffer.indexOf('\n')) >= 0) {
                const linha = buffer.slice(0, indice);
                buffer = buffer.slice(indice + 1);
                const erro = tratarLinha(linha);
                if (erro) return erro;
            }
        }
        const erro = tratarLinha(buffer);
        if (erro) return erro;

        if (!final && !reply) {
            return { ok: false, data: { erro: 'O Kim está a pensar demais, tenta outra vez.' } };
        }
        return {
            ok: true,
            data: {
                reply: final ? final.reply : reply,
                conversaId: final ? final.conversaId : null,
                titulo: final ? final.titulo : null,
            },
        };
    }

    window.exploreChatSend = exploreChatSend;
})();

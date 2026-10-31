// Mostra "Nova conquista: <nome>" quando uma resposta do servidor traz o
// cabeçalho X-Novas-Conquistas (ver ConquistasAvisoMiddleware). Embrulha o
// fetch da página, por isso funciona com qualquer quiz/teste/exame sem mexer
// no código de cada um.
(function () {
    if (!window.fetch || window.__exploreConquistasAviso) return;
    window.__exploreConquistasAviso = true;

    const fetchOriginal = window.fetch.bind(window);
    const fila = [];
    let aMostrar = false;

    function mostrarProxima() {
        const conquista = fila.shift();
        if (!conquista) {
            aMostrar = false;
            return;
        }
        aMostrar = true;
        const aviso = document.createElement('div');
        aviso.className = 'explore-conquista-aviso';
        aviso.setAttribute('role', 'status');
        aviso.textContent = `${conquista.icone} Nova conquista: ${conquista.nome}`;
        document.body.appendChild(aviso);
        setTimeout(() => {
            aviso.remove();
            mostrarProxima();
        }, 3500);
    }

    window.fetch = function (...args) {
        return fetchOriginal(...args).then((resposta) => {
            try {
                const cabecalho = resposta.headers.get('X-Novas-Conquistas');
                if (cabecalho) {
                    fila.push(...JSON.parse(cabecalho));
                    if (!aMostrar) mostrarProxima();
                }
            } catch (erro) {
                // o aviso é um extra — nunca deve estragar o pedido original
            }
            return resposta;
        });
    };
})();

import json
import threading

_estado = threading.local()


def registar_aviso_conquistas(avisos):
    """Chamado por verificar_conquistas (views.py) — guarda as conquistas
    desbloqueadas durante este pedido para o middleware as devolver."""
    _estado.novas = list(getattr(_estado, 'novas', [])) + list(avisos)


class ConquistasAvisoMiddleware:
    """Se, durante o pedido, o aluno desbloqueou conquistas, mete-as no
    cabeçalho X-Novas-Conquistas para static/conquistas-aviso.js mostrar
    "Nova conquista: ..." — assim nenhum endpoint de quiz/teste/exame precisa
    de saber disto."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _estado.novas = []
        response = self.get_response(request)
        if _estado.novas:
            response['X-Novas-Conquistas'] = json.dumps(_estado.novas)
        _estado.novas = []
        return response

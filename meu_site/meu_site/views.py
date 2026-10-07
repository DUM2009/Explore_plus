import json
import re
import unicodedata
from collections import defaultdict
from datetime import timedelta
import anthropic
import stripe
from django.conf import settings
from django.http import JsonResponse, Http404, HttpResponse
from django.shortcuts import render, redirect
from django.urls import reverse
from django.db import OperationalError
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.utils import timezone
from .models import (
    PerfilAluno, InqueritoAluno, obter_limite_chat, titulo_para_nivel,
    ResultadoAvaliacao, RegistoAtividadeDiaria,
)

# Mapeia teste_id/exame_id e missao_id para uma das 5 unidades da Biblioteca
# do Explorador (ver UNIDADES_BIBLIOTECA mais abaixo) — usado só para
# agrupar o histórico de resultados (ResultadoAvaliacao) por unidade na
# página de Estatísticas. Conteúdo ainda sem unidade correspondente (ex:
# os testes de "Biodiversidade") fica de fora dessa agregação por agora.
TESTE_ID_PARA_UNIDADE = {
    'celulas': 'citologia',
    'celulas-pancreas': 'citologia',
    'celulas-endossimbiotica': 'citologia',
}
MISSAO_ID_PARA_UNIDADE = {
    'celulas-organelos': 'citologia',
    'ciclo-celular': 'citologia',
    'biomoleculas': 'bioquimica',
    'codigo-da-vida': 'genetica',
    'terra-sistema-rochas': 'geologia',
    'tempo-geologico': 'geologia',
    'tectonica-de-placas': 'geologia',
    'origem-terra-sistema-solar': 'geologia',
    'interior-da-terra': 'geologia',
    'vulcanologia': 'geologia',
    'sismologia': 'geologia',
    'riscos-ordenamento-territorio': 'geologia',
    'minerais': 'geologia',
    'rochas-sedimentares': 'geologia',
    'rochas-magmaticas': 'geologia',
    'deformacao-das-rochas': 'geologia',
    'rochas-metamorficas': 'geologia',
    'recursos-geologicos': 'geologia',
}

# Inverso do mapa acima — que missões (uma ou mais) pertencem a cada unidade
# da Biblioteca do Explorador. Usado pelo filtro "Todos / <missão>" da
# página de flashcards (ver pagina_flashcards).
UNIDADE_PARA_MISSOES = defaultdict(list)
for _missao_id, _unidade_id in MISSAO_ID_PARA_UNIDADE.items():
    UNIDADE_PARA_MISSOES[_unidade_id].append(_missao_id)


def registar_atividade(user, minutos=0):
    """Marca hoje como um dia com atividade deste aluno (para a sequência
    de dias) e, se minutos > 0, soma-os ao tempo de estudo de hoje."""
    hoje = timezone.localdate()
    registo, _ = RegistoAtividadeDiaria.objects.get_or_create(user=user, data=hoje)
    if minutos > 0:
        registo.minutos += minutos
        registo.save(update_fields=['minutos'])


def registar_resultado(user, tipo, identificador, unidade, nota_percentagem):
    ResultadoAvaliacao.objects.create(
        user=user, tipo=tipo, identificador=identificador,
        unidade=unidade or '', nota_percentagem=nota_percentagem,
    )
    registar_atividade(user)


def redirecionar_apos_autenticacao(user):
    return redirect('perfil')


def pagina_inicial(request):
    return render(request, 'index.html')


def pagina_termos(request):
    return render(request, 'termos.html')


def pagina_privacidade(request):
    return render(request, 'privacidade.html')


def pagina_cookies(request):
    return render(request, 'cookies.html')

@login_required(login_url='login')
def pagina_mission(request):
    return render(request, 'mission.html')


@login_required(login_url='login')
def pagina_perfil(request):
    perfil_legacy = False
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        # Permite o acesso durante a atualização de uma base criada antes dos campos de progresso.
        perfil = PerfilAluno.objects.only('id', 'user', 'pontos_xp', 'nivel', 'titulo_atual').get(user=request.user)
        perfil_legacy = True
    progresso = {} if perfil_legacy else (perfil.progresso_missoes or {})
    badges = {} if perfil_legacy else (perfil.conquistas or {})

    (_, titulo_nome, titulo_icone, titulo_descricao), proximo_titulo = titulo_para_nivel(perfil.nivel)
    if not perfil_legacy and perfil.titulo_atual != titulo_nome:
        perfil.titulo_atual = titulo_nome
        perfil.save(update_fields=['titulo_atual'])

    # Metadados (categoria/descrição) das missões do motor genérico — os
    # próprios missoes/<id>.json não têm um campo de descrição, então
    # mantém-se aqui o mesmo texto já usado em index-missions.html.
    METADADOS_MISSOES = {
        'diversidade-organizacao-biologica': {
            'categoria': 'Biodiversidade',
            'descricao': 'Descobre como a vida se organiza, se classifica, e porque a biodiversidade importa.',
        },
        'biomoleculas': {
            'categoria': 'Bioquímica',
            'descricao': 'Descobre as moléculas que constroem todos os seres vivos.',
        },
        'celulas-organelos': {
            'categoria': 'Citologia',
            'descricao': 'Explora a unidade fundamental da vida e o "emprego" de cada organelo.',
        },
        'energia-e-movimentos': {
            'categoria': 'Energia e Movimentos',
            'descricao': 'Energia cinética, potencial e mecânica, trabalho, potência e rendimento.',
        },
        'energia-e-fenomenos-eletricos': {
            'categoria': 'Energia e Fenómenos Elétricos',
            'descricao': 'Corrente, tensão, resistência, circuitos em série e em paralelo, e pilhas.',
        },
        'energia-fenomenos-termicos-radiacao': {
            'categoria': 'Energia, Fenómenos Térmicos e Radiação',
            'descricao': 'Temperatura, calor, condução, convecção, radiação e as leis da termodinâmica.',
        },
        '11-movimento-e-interacoes': {
            'categoria': 'Movimento e Interações',
            'descricao': 'Referenciais, posição, velocidade, as quatro interações fundamentais e as leis de Newton.',
        },
        '11-forcas-e-movimentos': {
            'categoria': 'Forças e Movimentos',
            'descricao': 'Gráficos v-t, queda livre, planos inclinados, velocidade terminal e satélites.',
        },
        '11-sinais-ondas-som': {
            'categoria': 'Sinais, Ondas e Som',
            'descricao': 'Sinais, ondas, período, frequência, comprimento de onda e as características do som.',
        },
        '11-eletromagnetismo': {
            'categoria': 'Eletromagnetismo',
            'descricao': 'Carga, campo elétrico, campo magnético, indução eletromagnética e transformadores.',
        },
        '11-ondas-eletromagneticas': {
            'categoria': 'Ondas Eletromagnéticas',
            'descricao': 'Espetro eletromagnético, reflexão, refração, fibras óticas, difração, efeito Doppler e Big Bang.',
        },
        '12-cinematica-dinamica-2d': {
            'categoria': 'Cinemática e Dinâmica 2D',
            'descricao': 'Movimentos a duas dimensões, projéteis, atrito e curvas.',
        },
        '12-centro-massa-momento-linear': {
            'categoria': 'Centro de Massa e Momento Linear',
            'descricao': 'Centro de massa, momento linear, conservação e colisões.',
        },
        '12-fluidos': {
            'categoria': 'Fluidos',
            'descricao': 'Pressão, hidrostática, impulsão e viscosidade.',
        },
        '12-campo-gravitico': {
            'categoria': 'Campo Gravítico',
            'descricao': 'Leis de Kepler, campo gravítico, energia potencial gravítica e velocidade de escape.',
        },
        '12-campo-eletrico': {
            'categoria': 'Campo Elétrico',
            'descricao': 'Lei de Coulomb, potencial elétrico, condutores, cargas em movimento e condensadores.',
        },
        '12-campo-magnetico': {
            'categoria': 'Campo Magnético',
            'descricao': 'Força magnética, movimento circular de cargas e espectrómetro de massa.',
        },
        '12-fisica-moderna': {
            'categoria': 'Física Moderna',
            'descricao': 'Radiação térmica, fotões, efeito fotoelétrico, núcleos e radioatividade.',
        },
        '10-massa-tamanho-atomos': {
            'categoria': 'Massa e Tamanho dos Átomos',
            'descricao': 'Escala atómica, isótopos, massa atómica relativa, mole e massa molar.',
        },
        '10-energia-eletroes': {
            'categoria': 'Energia dos Eletrões nos Átomos',
            'descricao': 'Espetros, modelo de Bohr, orbitais e configurações eletrónicas.',
        },
        '10-tabela-periodica': {
            'categoria': 'Tabela Periódica',
            'descricao': 'Organização da tabela periódica, raio atómico, energia de ionização e densidade de metais.',
        },
        '10-ligacao-quimica': {
            'categoria': 'Ligação Química',
            'descricao': 'Ligações covalentes, iónicas e metálicas, Lewis, geometria molecular, compostos de carbono e forças intermoleculares.',
        },
        '10-gases-dispersoes': {
            'categoria': 'Gases e Dispersões',
            'descricao': 'Volume molar, composição da atmosfera, poluentes, soluções e diluições.',
        },
        '10-transformacoes-quimicas': {
            'categoria': 'Transformações Químicas',
            'descricao': 'Reações exotérmicas e endotérmicas, entalpia, energias de ligação, reações fotoquímicas e a camada de ozono.',
        },
        '11-aspetos-quantitativos': {
            'categoria': 'Aspetos Quantitativos das Reações',
            'descricao': 'Estequiometria, reagente limitante, pureza, rendimento e química verde.',
        },
        '11-equilibrio-quimico': {
            'categoria': 'Equilíbrio Químico',
            'descricao': 'Reações incompletas, constante de equilíbrio, quociente da reação e Princípio de Le Châtelier.',
        },
        '11-acido-base': {
            'categoria': 'Reações Ácido-Base',
            'descricao': 'Teoria de Brönsted-Lowry, pH, constantes de acidez, titulações e chuva ácida.',
        },
        '11-oxidacao-reducao': {
            'categoria': 'Oxidação-Redução',
            'descricao': 'Oxidação, redução, números de oxidação, reação ácido-metal e série eletroquímica.',
        },
        '11-solubilidade': {
            'categoria': 'Soluções e Solubilidade',
            'descricao': 'Dissolução, solubilidade, produto de solubilidade, ião comum e dureza da água.',
        },
        '12-estrutura-metais': {
            'categoria': 'Estrutura e Propriedades dos Metais',
            'descricao': 'Metais de transição, ligação metálica, tipos de sólidos e reciclagem do cobre.',
        },
        '12-degradacao-metais': {
            'categoria': 'Corrosão, Pilhas e Proteção',
            'descricao': 'Corrosão, acerto de equações redox, pilhas, potenciais-padrão e proteção de metais.',
        },
        '12-metais-ambiente-vida': {
            'categoria': 'Metais, Ambiente e Vida',
            'descricao': 'Complexos e cor, metais no organismo, tampões e catalisadores.',
        },
        '12-combustiveis-fosseis': {
            'categoria': 'Combustíveis Fósseis',
            'descricao': 'Destilação, cracking, nomenclatura, isomeria, gases ideais e combustíveis alternativos.',
        },
        '12-energia-combustiveis': {
            'categoria': 'A Energia dos Combustíveis',
            'descricao': 'Entalpia-padrão, Lei de Hess e poder energético dos combustíveis.',
        },
        '12-plasticos-novos-materiais': {
            'categoria': 'Plásticos, Vidros e Novos Materiais',
            'descricao': 'Polímeros naturais e sintéticos, polimerização, reciclagem de plásticos e biomateriais.',
        },
    }

    missoes_lancadas_perfil = set()
    try:
        caminho_lancamento = settings.BASE_DIR.parent / 'missoes' / 'lancamento.json'
        with open(caminho_lancamento, encoding='utf-8') as ficheiro:
            configuracao_lancamento = json.load(ficheiro)
        missoes_lancadas_perfil = {
            chave for chave, visivel in configuracao_lancamento.items()
            if visivel is True
        }
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    # Só as que estão de facto jogáveis (têm ficheiro json E metadados) —
    # as outras entradas de lancamento.json ainda aparecem como "Em breve"
    # em /missions/, não têm progresso real para mostrar aqui.
    missoes = []
    pasta_missoes = settings.BASE_DIR.parent / 'missoes'
    for missao_id, metadados in METADADOS_MISSOES.items():
        if missao_id not in missoes_lancadas_perfil:
            continue
        missao_json = None
        for caminho_json in [pasta_missoes / f'{missao_id}.json', *pasta_missoes.glob(f'*/{missao_id}.json')]:
            try:
                with open(caminho_json, encoding='utf-8') as ficheiro:
                    missao_json = json.load(ficheiro)
                break
            except (FileNotFoundError, json.JSONDecodeError):
                continue
        if missao_json is None:
            continue
        missoes.append({
            'id': missao_id,
            'titulo': missao_json.get('titulo', missao_id),
            'categoria': metadados['categoria'],
            'icone': (missao_json.get('badge') or {}).get('icone', '🧬'),
            'descricao': metadados['descricao'],
            'url': 'missao',
            'url_kwargs': {'missao_id': missao_id},
            'percent': int(progresso.get(missao_id, 0)),
        })

    # As já concluídas a 100% vão para o fim — o topo é para o que o aluno
    # está mesmo a explorar agora (mais progresso primeiro).
    missoes.sort(key=lambda missao: (missao['percent'] >= 100, -missao['percent']))

    definicoes_conquistas = [
        {'id': 'primeira-missao', 'nome': 'Primeiros Passos', 'icone': '🌱', 'descricao': 'Conclui a tua primeira missão.'},
        {'id': 'fotossintese-mestre', 'nome': 'Mestre da Fotossíntese', 'icone': '🌿', 'descricao': 'Termina o capítulo da Fotossíntese a 100%.'},
        {'id': 'sequencia-3-dias', 'nome': 'Em Chamas', 'icone': '🔥', 'descricao': 'Estuda 3 dias seguidos.'},
        {'id': 'sequencia-7-dias', 'nome': 'Semana Perfeita', 'icone': '⭐', 'descricao': 'Estuda 7 dias seguidos.'},
        {'id': 'nivel-5', 'nome': 'Explorador Veterano', 'icone': '🏅', 'descricao': 'Atinge o nível 5.'},
        {'id': 'primeiro-teste-ouro', 'nome': 'Emblema de Ouro', 'icone': '🥇', 'descricao': 'Consegue emblema de ouro num teste final.'},
    ]
    conquistas_lista = [
        {**definicao, 'desbloqueada': bool(badges.get(definicao['id']))}
        for definicao in definicoes_conquistas
    ]

    # Separador "Estatísticas" do perfil: mesmos dados de pagina_estatisticas
    # (ver calcular_dados_estatisticas), só que aqui dentro de um separador
    # em vez de página à parte. perfil_legacy não tem os campos que essa
    # função precisa (vocabulario_estado, etc.), por isso fica de fora.
    dados_estatisticas = {} if perfil_legacy else calcular_dados_estatisticas(request, perfil)

    return render(request, 'perfil.html', {
        'perfil': perfil,
        'nivel': perfil.nivel,
        'xp': perfil.pontos_xp,
        'xp_progress_percent': perfil.pontos_xp % 100,
        'proximo_nivel_xp': perfil.nivel * 100,
        'xp_restante': (perfil.nivel * 100) - perfil.pontos_xp,
        'proximo_nivel': perfil.nivel + 1,
        'progresso_missoes': progresso,
        'progresso_medio': round(sum(missao['percent'] for missao in missoes) / len(missoes)) if missoes else 0,
        'missoes_completas': sum(1 for missao in missoes if missao['percent'] >= 100),
        'conquistas': badges,
        'conquistas_lista': conquistas_lista,
        'total_conquistas': sum(1 for desbloqueada in badges.values() if desbloqueada),
        'missoes': missoes,
        'titulo_nome': titulo_nome,
        'titulo_icone': titulo_icone,
        'titulo_descricao': titulo_descricao,
        'proximo_titulo': proximo_titulo,
        'niveis_para_kim_nivel10': max(0, 10 - perfil.nivel),
        **dados_estatisticas,
    })


def _evolucao_notas(user, tipo):
    """Gráfico "Evolução das notas" — um ponto por teste ou exame
    corrigido (consoante `tipo`), na ordem em que aconteceram. Devolve os
    pontos e já as coordenadas do <polyline> (viewBox 0 0 300 100), para o
    template só desenhar, sem fazer contas — ver stats-evolucao.js para a
    troca entre "Testes" e "Exames"."""
    resultados = list(
        ResultadoAvaliacao.objects.filter(user=user, tipo=tipo).order_by('criado_em')
    )
    pontos = [
        {
            'label': resultado.criado_em.strftime('%d/%m'),
            'nota': round(resultado.nota_percentagem / 100 * 20, 1),
        }
        for resultado in resultados
    ]
    coords = ''
    if len(pontos) == 1:
        y = 100 - (pontos[0]['nota'] / 20 * 100)
        coords = f'150,{y:.1f}'
    elif len(pontos) > 1:
        passo = 300 / (len(pontos) - 1)
        coords = ' '.join(
            f'{i * passo:.1f},{100 - (ponto["nota"] / 20 * 100):.1f}'
            for i, ponto in enumerate(pontos)
        )
    return {'pontos': pontos, 'coords': coords}


def _formatar_minutos(minutos):
    if minutos <= 0:
        return '0min'
    if minutos < 60:
        return f'{minutos}min'
    horas_texto = f'{minutos / 60:.1f}'.rstrip('0').rstrip('.')
    return f'{horas_texto}h'


def _com_percentagens(pontos):
    """Acrescenta 'percent' (altura da barra, relativa ao máximo do
    período) e 'valor_label' a cada ponto de um período do gráfico de
    tempo de estudo."""
    maximo = max((ponto['minutos'] for ponto in pontos), default=0)
    for ponto in pontos:
        ponto['percent'] = round(ponto['minutos'] / maximo * 100) if maximo else 0
        ponto['valor_label'] = _formatar_minutos(ponto['minutos'])
    return pontos


def _tempo_estudo_semana_atual(user, hoje):
    """Aba "7d" — semana civil atual, de segunda a domingo, um ponto por dia."""
    dias_semana_pt = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
    segunda_feira = hoje - timedelta(days=hoje.weekday())
    domingo = segunda_feira + timedelta(days=6)
    registos_por_dia = {
        registo.data: registo.minutos
        for registo in RegistoAtividadeDiaria.objects.filter(
            user=user, data__gte=segunda_feira, data__lte=domingo
        )
    }
    pontos = [
        {
            'label': dias_semana_pt[(segunda_feira + timedelta(days=offset)).weekday()],
            'minutos': registos_por_dia.get(segunda_feira + timedelta(days=offset), 0),
        }
        for offset in range(7)
    ]
    return _com_percentagens(pontos)


def _tempo_estudo_ultimos_30_dias(user, hoje):
    """Aba "30d" — um ponto por dia, dos últimos 30 dias (hoje incluído),
    para o aluno ver a evolução dia a dia (gráfico de linha com pontos,
    não barras — ver render_linha em stats-tempo.js)."""
    inicio = hoje - timedelta(days=29)
    registos_por_dia = {
        registo.data: registo.minutos
        for registo in RegistoAtividadeDiaria.objects.filter(user=user, data__gte=inicio, data__lte=hoje)
    }
    pontos = [
        {
            'label': (inicio + timedelta(days=offset)).strftime('%d/%m'),
            'minutos': registos_por_dia.get(inicio + timedelta(days=offset), 0),
        }
        for offset in range(30)
    ]
    return _com_percentagens(pontos)


def _tempo_estudo_por_mes(user, hoje):
    """Aba "Sempre" — um ponto por mês, do primeiro registo de atividade do
    aluno até ao mês atual. Sem registos ainda, devolve uma lista vazia
    (o template mostra a mensagem de "ainda sem dados")."""
    primeiro_registo = RegistoAtividadeDiaria.objects.filter(user=user).order_by('data').first()
    if not primeiro_registo:
        return []

    meses_pt = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    somas_por_mes = defaultdict(int)
    for registo in RegistoAtividadeDiaria.objects.filter(user=user):
        somas_por_mes[registo.data.replace(day=1)] += registo.minutos

    pontos = []
    mes = primeiro_registo.data.replace(day=1)
    ultimo_mes = hoje.replace(day=1)
    while mes <= ultimo_mes:
        pontos.append({
            'label': f'{meses_pt[mes.month - 1]}/{mes.strftime("%y")}',
            'minutos': somas_por_mes.get(mes, 0),
        })
        mes = (mes.replace(year=mes.year + 1, month=1) if mes.month == 12
               else mes.replace(month=mes.month + 1))
    return _com_percentagens(pontos)


def _cor_desempenho(percent):
    """Vermelho/amarelo/verde consoante a nota — mesmos limiares usados
    nos badges de teste final (ver corrigir_teste/corrigir_exame)."""
    if percent < 50:
        return '#dc3545'
    if percent < 75:
        return '#e0a52c'
    return '#1f8a5b'


def _titulo_missao(missao_id):
    try:
        caminho = settings.BASE_DIR.parent / 'missoes' / f'{missao_id}.json'
        with open(caminho, encoding='utf-8') as ficheiro:
            dados = json.load(ficheiro)
        return dados.get('titulo', missao_id)
    except (FileNotFoundError, json.JSONDecodeError):
        return missao_id


def _progresso_missoes_por_unidade(perfil):
    """Modo "Evolução das missões" — % de conclusão média das missões de
    cada capítulo da Biblioteca (perfil.progresso_missoes), não a nota dos
    quizzes (ver _quizzes_por_unidade para isso). Barra sempre verde: isto
    é progresso, não uma nota a avaliar."""
    progresso = perfil.progresso_missoes or {}
    missoes_por_unidade = defaultdict(list)
    for missao_id, unidade_id in MISSAO_ID_PARA_UNIDADE.items():
        missoes_por_unidade[unidade_id].append(missao_id)

    pontos = []
    for unidade in UNIDADES_BIBLIOTECA:
        missao_ids = missoes_por_unidade.get(unidade['id'], [])
        if not missao_ids:
            pontos.append({
                'id': unidade['id'], 'label': unidade['nome'],
                'percent': 0, 'cor': '#c7cbd1', 'sem_dados': True, 'valor_label': 'Sem missões',
            })
            continue
        percent = round(sum(progresso.get(mid, 0) for mid in missao_ids) / len(missao_ids))
        pontos.append({
            'id': unidade['id'], 'label': unidade['nome'],
            'percent': percent, 'cor': '#1f8a5b', 'sem_dados': False, 'valor_label': f'{percent}%',
        })
    return pontos


def _quizzes_por_unidade(user):
    """Modo "Quizzes por capítulo" — média de todos os resultados de
    quizzes (testes, exames e secções de missão) de cada capítulo, com a
    barra colorida consoante o desempenho (vermelho/amarelo/verde)."""
    pontos = []
    for unidade in UNIDADES_BIBLIOTECA:
        notas = list(
            ResultadoAvaliacao.objects.filter(user=user, unidade=unidade['id'])
            .values_list('nota_percentagem', flat=True)
        )
        if not notas:
            pontos.append({
                'id': unidade['id'], 'label': unidade['nome'],
                'percent': 0, 'cor': '#c7cbd1', 'sem_dados': True, 'valor_label': 'Sem dados',
            })
            continue
        media = round(sum(notas) / len(notas))
        pontos.append({
            'id': unidade['id'], 'label': unidade['nome'],
            'percent': media, 'cor': _cor_desempenho(media), 'sem_dados': False, 'valor_label': f'{media}%',
        })
    return pontos


def _quizzes_por_missao(user):
    """Modo "Quizz por missão" — mesma ideia de _quizzes_por_unidade, mas
    quebrada por missão em vez de por capítulo (só quizzes de secção de
    missão, ver tipo='missao_seccao' em salvar_progresso_missao): uma
    barra por missão já tentada, todas juntas no mesmo gráfico."""
    resultados = ResultadoAvaliacao.objects.filter(user=user, tipo='missao_seccao')
    notas_por_missao = defaultdict(list)
    for resultado in resultados:
        missao_id = resultado.identificador.split(':', 1)[0]
        notas_por_missao[missao_id].append(resultado.nota_percentagem)

    pontos = []
    for missao_id, notas in notas_por_missao.items():
        media = round(sum(notas) / len(notas))
        pontos.append({
            'id': missao_id, 'label': _titulo_missao(missao_id),
            'percent': media, 'cor': _cor_desempenho(media), 'sem_dados': False, 'valor_label': f'{media}%',
        })
    return pontos


def calcular_dados_estatisticas(request, perfil):
    """Progresso pessoal do aluno — nunca comparações com outros alunos
    (sem rankings nem percentis aqui, ver Templates/estatisticas.html).
    Reaproveitado por pagina_estatisticas e pelo separador "Estatísticas"
    de pagina_perfil, para não duplicar esta lógica nos dois sítios."""
    # (a) Gráfico de evolução — um ponto por teste ou exame corrigido, na
    # ordem em que aconteceram, trocável entre "Testes" e "Exames" no
    # dropdown do cartão (ver stats-evolucao.js).
    evolucao_periodos = {
        'teste': _evolucao_notas(request.user, 'teste'),
        'exame': _evolucao_notas(request.user, 'exame'),
    }
    evolucao = evolucao_periodos['teste']['pontos']
    evolucao_pontos = evolucao_periodos['teste']['coords']

    # (b) Desempenho por unidade — três formas de ver o mesmo capítulo,
    # trocáveis no dropdown do cartão (ver stats-desempenho.js):
    #  - "missoes": % de conclusão média das missões de cada capítulo;
    #  - "quizzes_capitulo": média das notas de quizzes (testes, exames e
    #    secções de missão) de cada capítulo, barra colorida a
    #    vermelho/amarelo/verde consoante o desempenho;
    #  - "quizzes_missao": a mesma ideia da anterior, mas quebrada por
    #    missão dentro do capítulo escolhido pelo aluno (só quizzes de
    #    secção de missão, não testes/exames — esses não pertencem a
    #    nenhuma missão em concreto).
    desempenho_periodos = {
        'missoes': _progresso_missoes_por_unidade(perfil),
        'quizzes_capitulo': _quizzes_por_unidade(request.user),
        'quizzes_missao': _quizzes_por_missao(request.user),
    }

    # (c) Hábitos de estudo — tempo somado dos últimos 7 dias (hoje
    # incluído) e sequência de dias seguidos (ver PerfilAluno.calcular_sequencia).
    hoje = timezone.localdate()
    tempo_semana = sum(
        RegistoAtividadeDiaria.objects.filter(
            user=request.user, data__gte=hoje - timedelta(days=6)
        ).values_list('minutos', flat=True)
    )
    sequencia_atual, sequencia_recorde = perfil.calcular_sequencia()

    # (c.1) Tempo de estudo — três períodos para as abas "7d / 30d /
    # Sempre" do gráfico acima de "Evolução das notas" (mesma ideia
    # visual do gráfico estático da página inicial, mas com dados reais
    # do aluno e navegável entre períodos no frontend, ver stats-tempo.js).
    tempo_estudo_periodos = {
        '7d': _tempo_estudo_semana_atual(request.user, hoje),
        '30d': _tempo_estudo_ultimos_30_dias(request.user, hoje),
        'sempre': _tempo_estudo_por_mes(request.user, hoje),
    }
    tempo_estudo_dias = tempo_estudo_periodos['7d']

    # (d) Resumo de vocabulário — reaproveita a mesma lógica de overlay por
    # aluno da Biblioteca do Explorador (ver aplicar_estado_vocabulario_aluno),
    # só somado nas 5 unidades em vez de mostrado unidade a unidade.
    vocab_totais = {'dominado': 0, 'a_rever': 0, 'novo': 0}
    for unidade in UNIDADES_BIBLIOTECA:
        termos = aplicar_estado_vocabulario_aluno(perfil, unidade['id'], carregar_termos_unidade(unidade['id']))
        for termo in termos:
            vocab_totais[termo['estado']] = vocab_totais.get(termo['estado'], 0) + 1

    return {
        'evolucao': evolucao,
        'evolucao_pontos': evolucao_pontos,
        'evolucao_periodos': evolucao_periodos,
        'desempenho_periodos': desempenho_periodos,
        'desempenho_quizzes_capitulo': desempenho_periodos['quizzes_capitulo'],
        'tempo_semana_min': tempo_semana,
        'tempo_estudo_dias': tempo_estudo_dias,
        'tempo_estudo_periodos': tempo_estudo_periodos,
        'sequencia_atual': sequencia_atual,
        'sequencia_recorde': sequencia_recorde,
        'vocab_totais': vocab_totais,
        'vocab_total_termos': sum(vocab_totais.values()),
    }


@login_required(login_url='login')
def pagina_estatisticas(request):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    if perfil is None:
        return render(request, 'estatisticas.html', {'perfil': None})

    return render(request, 'estatisticas.html', {
        'perfil': perfil,
        **calcular_dados_estatisticas(request, perfil),
    })


def pagina_login(request):
    # Se o utilizador já estiver autenticado, vai direto para o perfil
    if request.user.is_authenticated:
        return redirecionar_apos_autenticacao(request.user)

    erro = None

    if request.method == 'POST':
        campo_input = request.POST.get('username', '').strip()
        password = request.POST.get('password', '')

        if campo_input and password:
            username = campo_input

            # Se digitou um e-mail, procura o username associado
            if '@' in campo_input:
                user_obj = User.objects.filter(email=campo_input).first()
                if user_obj:
                    username = user_obj.username

            # Autenticação no Django
            user = authenticate(request, username=username, password=password)

            if user is not None:
                login(request, user)
                return redirecionar_apos_autenticacao(user)
            else:
                erro = "E-mail/Utilizador ou palavra-passe incorretos!"
        else:
            erro = "Preencha todos os campos!"

    return render(request, 'login.html', {'erro': erro})


def pagina_signup(request):
    if request.user.is_authenticated:
        return redirecionar_apos_autenticacao(request.user)

    erro = None
    if request.method == 'POST':
        username = request.POST.get('username', '').strip()
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')
        confirm_password = request.POST.get('confirmarPassword', '')

        if not username or not email or not password:
            erro = 'Preencha todos os campos.'
        elif password != confirm_password:
            erro = 'As palavras-passe não coincidem.'
        elif User.objects.filter(username=username).exists():
            erro = 'Esse nome de utilizador já existe.'
        elif User.objects.filter(email=email).exists():
            erro = 'Esse email já está registado.'
        else:
            user = User.objects.create_user(username=username, email=email, password=password)
            login(request, user)
            return redirecionar_apos_autenticacao(user)

    return render(request, 'signup.html', {'erro': erro})


def pagina_logout(request):
    logout(request)
    return redirect('login')


DISCIPLINAS_INQUERITO = [
    ('biologia', 'Biologia'),
    ('quimica', 'Química'),
    ('fisica', 'Física'),
    ('geologia', 'Geologia'),
    ('matematica', 'Matemática'),
]


@login_required(login_url='login')
def pagina_onboarding(request):
    inquerito, _ = InqueritoAluno.objects.get_or_create(user=request.user)

    if inquerito.concluido:
        return redirect('perfil')

    erro = None
    if request.method == 'POST':
        ano_escolar = request.POST.get('ano_escolar', '').strip()
        curso_pretendido = request.POST.get('curso_pretendido', '').strip()

        if ano_escolar not in dict(InqueritoAluno.ANOS_ESCOLARES):
            erro = 'Escolhe o teu ano escolar.'
        else:
            niveis = {}
            for disciplina, _rotulo in DISCIPLINAS_INQUERITO:
                if request.POST.get(f'{disciplina}_nao_tem') == 'on':
                    niveis[disciplina] = None
                    continue

                valor = request.POST.get(f'nivel_{disciplina}', '').strip()
                if not valor.isdigit() or not (0 <= int(valor) <= 10):
                    erro = 'Escolhe um nível de 0 a 10 (ou marca "Não tenho esta disciplina") para cada disciplina.'
                    break
                niveis[disciplina] = int(valor)

            if not erro:
                inquerito.ano_escolar = ano_escolar
                inquerito.curso_pretendido = curso_pretendido
                inquerito.niveis_disciplinas = niveis
                inquerito.concluido = True
                inquerito.save()
                return redirect('perfil')

    return render(request, 'onboarding.html', {
        'erro': erro,
        'anos_escolares': InqueritoAluno.ANOS_ESCOLARES,
        'disciplinas': DISCIPLINAS_INQUERITO,
        'niveis_range': list(range(11)),
    })


@login_required(login_url='login')
def pagina_index_missions(request):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    missoes_lancadas = set()
    try:
        caminho_lancamento = settings.BASE_DIR.parent / 'missoes' / 'lancamento.json'
        with open(caminho_lancamento, encoding='utf-8') as ficheiro:
            configuracao_lancamento = json.load(ficheiro)
        missoes_lancadas = {
            chave for chave, visivel in configuracao_lancamento.items()
            if visivel is True
        }
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    return render(request, 'index-missions.html', {
        'perfil': perfil,
        'missoes_lancadas': missoes_lancadas,
    })


@login_required(login_url='login')
def pagina_lesson(request):
    return render(request, 'lesson.html')


def pagina_dashboard(request):
    return render(request, 'dashboard.html')


@login_required(login_url='login')
def pagina_mission_photosynthesis(request):
    perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    return render(request, 'mission-photosynthesis.html', {'perfil': perfil})


@login_required(login_url='login')
def pagina_mission_photosynthesis_goldtest(request):
    return render(request, 'mission-photosynthesis-goldtest.html')


@login_required(login_url='login')
def pagina_missao(request, missao_id):
    """
    Serve qualquer missão do motor genérico (ver static/missao-engine.js):
    basta existir um missoes/<missao_id>.json (ou missoes/<disciplina>/<missao_id>.json,
    ex: missoes/fisica/, para organizar missões de uma disciplina nova) neste
    formato para a missão ficar disponível aqui, sem código novo por missão.
    """
    pasta_missoes = settings.BASE_DIR.parent / 'missoes'
    candidatos = [pasta_missoes / f'{missao_id}.json', *pasta_missoes.glob(f'*/{missao_id}.json')]
    missao = None
    for caminho_json in candidatos:
        try:
            with open(caminho_json, 'r', encoding='utf-8') as f:
                missao = json.load(f)
            break
        except FileNotFoundError:
            continue
    if missao is None:
        raise Http404('Missão não encontrada.')

    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    return render(request, 'missao.html', {'missao': missao, 'missao_json': missao, 'perfil': perfil})


@login_required(login_url='login')
@require_POST
def salvar_progresso_missao(request):
    try:
        dados = json.loads(request.body or '{}')
    except (TypeError, ValueError):
        return JsonResponse({'erro': 'Dados inválidos.'}, status=400)

    mission_id = str(dados.get('missionId', '')).strip()
    progress = dados.get('progress')
    if not mission_id or not isinstance(progress, dict):
        return JsonResponse({'erro': 'Missão ou progresso ausente.'}, status=400)

    total_sections = max(0, int(progress.get('totalSections') or 0))
    completed_sections = progress.get('completedSections')
    completed_count = len(completed_sections) if isinstance(completed_sections, list) else 0
    percentage = round(min(completed_count / total_sections, 1) * 100) if total_sections else 0

    perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    progresso = dict(perfil.progresso_missoes or {})
    if mission_id != 'profile':
        progresso[mission_id] = percentage
    perfil.progresso_missoes = progresso
    update_fields = ['progresso_missoes']

    section_scores = progress.get('sectionScores')
    if isinstance(section_scores, dict) and mission_id != 'profile':
        secoes_antigas = dict((perfil.progresso_secoes or {}).get(mission_id, {}))
        secoes = dict(perfil.progresso_secoes or {})
        secoes[mission_id] = {
            str(secao_id): int(score)
            for secao_id, score in section_scores.items()
            if isinstance(score, (int, float))
        }
        perfil.progresso_secoes = secoes
        update_fields.append('progresso_secoes')

        # Só regista no histórico as secções cuja nota é nova ou mudou desde
        # a última gravação — este endpoint é chamado a cada progresso da
        # missão, e sectionScores vem sempre completo, não só o que mudou.
        unidade = MISSAO_ID_PARA_UNIDADE.get(mission_id, '')
        for secao_id, score in secoes[mission_id].items():
            if secoes_antigas.get(secao_id) != score:
                registar_resultado(
                    request.user, 'missao_seccao', f'{mission_id}:{secao_id}',
                    unidade, float(score),
                )

    xp = dados.get('xp')
    if isinstance(xp, (int, float)) and xp >= 0:
        # max() é de propósito: o XP "oficial" de cada aluno vive no
        # localStorage do browser (ver profile-xp.js), não só aqui — um
        # browser novo ou com cache limpa manda XP baixo (ou 0) nesta
        # sincronização, e sem o max() isso apagaria XP já ganho noutro
        # dispositivo. O efeito secundário é que uma alteração manual no
        # admin não "pega" enquanto o browser do aluno continuar a
        # ressincronizar o valor antigo por cima.
        perfil.pontos_xp = max(perfil.pontos_xp, int(xp))
        perfil.nivel = perfil.pontos_xp // 100 + 1
        update_fields.extend(['pontos_xp', 'nivel'])

    perfil.save(update_fields=update_fields)

    return JsonResponse({
        'ok': True,
        'missionId': mission_id,
        'percent': percentage,
        'xp': perfil.pontos_xp,
        'level': perfil.nivel,
    })


@login_required(login_url='login')
@require_POST
def registar_atividade_view(request):
    """Ping de "estou ativo agora" enviado pela página da missão (ver
    startActivityHeartbeat em missao-engine.js) — soma minutos ao tempo de
    estudo de hoje e marca o dia para a sequência. Best-effort: nunca deve
    ser motivo para a missão falhar, por isso aceita silenciosamente
    entradas inválidas em vez de devolver erro."""
    try:
        dados = json.loads(request.body or '{}')
    except (TypeError, ValueError):
        dados = {}
    minutos = dados.get('minutos', 1)
    if not isinstance(minutos, (int, float)) or minutos <= 0:
        minutos = 1
    registar_atividade(request.user, minutos=min(int(minutos), 5))
    return JsonResponse({'ok': True})


@login_required(login_url='login')
@require_POST
def registar_pergunta_errada(request):
    """
    Mantém o banco de perguntas erradas do aluno (PerfilAluno.perguntas_erradas)
    atualizado a cada resposta de quiz — chamado tanto para respostas certas
    (para "curar" uma pergunta já lá guardada) como erradas (para a
    adicionar/atualizar). Pensado para uma futura funcionalidade de
    "simulação" da IA voltar a questionar o aluno sobre o que já errou.
    """
    try:
        dados = json.loads(request.body or '{}')
    except (TypeError, ValueError):
        return JsonResponse({'erro': 'Dados inválidos.'}, status=400)

    mission_id = str(dados.get('missionId', '')).strip()
    section_id = str(dados.get('sectionId', '')).strip()
    question_index = dados.get('questionIndex')
    pergunta_texto = str(dados.get('question', '')).strip()
    is_correct = dados.get('isCorrect')

    if not mission_id or not section_id or not isinstance(question_index, int) or not isinstance(is_correct, bool):
        return JsonResponse({'erro': 'Dados da pergunta em falta.'}, status=400)

    chave = f"{mission_id}:{section_id}:{question_index}"

    perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    banco = dict(perfil.perguntas_erradas or {})

    if is_correct:
        # Acertou desta vez — sai do banco de perguntas erradas.
        banco.pop(chave, None)
    else:
        existente = banco.get(chave) or {}
        banco[chave] = {
            'missionId': mission_id,
            'sectionId': section_id,
            'questionIndex': question_index,
            'pergunta': pergunta_texto or existente.get('pergunta', ''),
            'vezesErrada': int(existente.get('vezesErrada', 0)) + 1,
            'ultimaVez': timezone.now().isoformat(),
        }

    perfil.perguntas_erradas = banco
    perfil.save(update_fields=['perguntas_erradas'])

    return JsonResponse({'ok': True})


@login_required(login_url='login')
@require_POST
def mascote_chat(request):
    """
    Proxies a chat message to Claude so the mascot can answer questions
    grounded in the mission's own content. The API key lives only here
    (server-side, read from the untracked .env file) — it never reaches
    the browser.
    """
    try:
        dados = json.loads(request.body or '{}')
    except (TypeError, ValueError):
        return JsonResponse({'erro': 'Dados inválidos.'}, status=400)

    user_message = str(dados.get('message', '')).strip()
    if not user_message:
        return JsonResponse({'erro': 'Mensagem vazia.'}, status=400)
    if len(user_message) > 1000:
        return JsonResponse({'erro': 'Mensagem demasiado longa.'}, status=400)

    # O limite semanal é verificado antes de chamar a Claude — mesmo sem
    # chave da API configurada, o aluno não deve poder "gastar" perguntas à
    # borla, e assim dá para testar o limite independentemente da IA estar
    # ligada. Só pedidos com uma mensagem válida chegam a consumir quota.
    perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    if not perfil.verificar_e_incrementar_uso_chat():
        limite = obter_limite_chat(perfil.plano)
        return JsonResponse({
            'erro': f'Atingiste o limite de {limite} perguntas ao Kim esta semana. Volta na próxima semana ou passa para o plano Pro para teres mais perguntas.',
            'limiteAtingido': True,
        }, status=429)

    if not settings.ANTHROPIC_API_KEY:
        return JsonResponse({'erro': 'O chat da mascote ainda não está configurado.'}, status=503)

    mission_title = str(dados.get('missionTitle', ''))[:200]
    section_title = str(dados.get('sectionTitle', ''))[:200]
    context_text = str(dados.get('context', ''))[:6000]

    history = dados.get('history')
    messages = []
    if isinstance(history, list):
        for entry in history[-10:]:
            if not isinstance(entry, dict):
                continue
            role = entry.get('role')
            text = str(entry.get('text', ''))[:2000]
            if role in ('user', 'assistant') and text:
                messages.append({'role': role, 'content': text})
    messages.append({'role': 'user', 'content': user_message})

    system_prompt = (
        "Chamas-te Kim, o Aventureiro, a mascote da Explore+, uma app de estudo de Biologia para alunos "
        "do ensino secundário em Portugal. Falas sempre em português de Portugal, "
        "de forma simpática, encorajadora e simples, como um explicador amigo.\n\n"
        f"O aluno está na missão \"{mission_title}\", na etapa \"{section_title}\".\n\n"
        "Usa o seguinte conteúdo desta etapa como referência para responderes com "
        "rigor científico — não inventes factos que o contradigam:\n\n"
        f"{context_text}\n\n"
        "Regras importantes:\n"
        "- Ajuda o aluno a perceber, mas não resolvas exercícios de teste por ele "
        "sem explicares o raciocínio.\n"
        "- Se perguntarem algo sem relação com Biologia ou com esta missão, recusa "
        "com simpatia e traz a conversa de volta ao tema.\n"
        "- Respostas curtas (2 a 4 frases), adequadas a um adolescente."
    )

    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=500,
            system=[{
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},
            }],
            messages=messages,
        )
        reply = next((block.text for block in response.content if block.type == 'text'), '')
    except anthropic.RateLimitError:
        return JsonResponse({'erro': 'Muitos pedidos de momento. Tenta novamente daqui a pouco.'}, status=429)
    except anthropic.APIStatusError:
        return JsonResponse({'erro': 'O serviço de chat está indisponível de momento.'}, status=502)
    except anthropic.APIConnectionError:
        return JsonResponse({'erro': 'Não foi possível ligar ao serviço de chat.'}, status=502)

    return JsonResponse({'reply': reply})


# Imagem do painel quadrado de cada categoria na página de Testes — as
# mesmas imagens usadas para a mesma categoria em index-missions.html.
# Categoria sem entrada aqui cai no genérico 'images/Biology image.jpg'.
CATEGORIA_TESTES_IMAGENS = {
    'Biodiversidade': 'images/Wallpaper biodiversidade.png',
    'Bioquímica': 'images/Wallpaper bioquimica.png',
    'Obtenção de Matéria': 'images/Folha.png',
    'Distribuição de Matéria': 'images/Coração.png',
    'Transformação e Utilização de Energia': 'images/Mitocôndira.png',
    'Evolução Biológica': 'images/especie.jpg',
    'Sistemática dos Seres Vivos': 'images/organismo.jpg',
    'Genética': 'images/Wallpaper DNA.png',
    'Citologia': 'images/Célula.png',
    'Ecologia': 'images/ecossistema.jpg',
    'Corpo Humano': 'images/Wallpaper corpo humano.png',
    'Botânica': 'images/Relva.jpeg',
    'Energia e Movimentos': 'images/Energia e movimentos.png',
    'Energia e Fenómenos Elétricos': 'images/Energia e fenómenos elétricos.png',
    'Energia, Fenómenos Térmicos e Radiação': 'images/Fenómenos térmicos e radiação.png',
    'Movimento e Interações': 'images/Movimentos e interações.png',
    'Forças e Movimentos': 'images/f11_pena_martelo_lua.png',
    'Sinais, Ondas e Som': 'images/Sinais e ondas.png',
    'Eletromagnetismo': 'images/Eletromagnetismo.png',
    'Ondas Eletromagnéticas': 'images/f11_espetro_dia_a_dia.png',
}

# Categorias cuja imagem usa background-size:contain em vez de cover (ver
# .missions-category-panel-image--contain), tal como em index-missions.html
# — evita cortar ícones/desenhos que não preenchem todo o retângulo.
CATEGORIA_TESTES_IMAGENS_CONTAIN = {'Citologia'}

# Disciplina de cada categoria (ver data-subject em .missions-category,
# tal como em index-missions.html) — usado pelo subject-switcher.js para
# mostrar só as categorias da disciplina escolhida. Categoria sem entrada
# aqui é Biologia, a disciplina por omissão da página.
CATEGORIA_TESTES_DISCIPLINA = {
    'Energia e Movimentos': 'physics',
    'Energia e Fenómenos Elétricos': 'physics',
    'Energia, Fenómenos Térmicos e Radiação': 'physics',
    'Movimento e Interações': 'physics',
    'Forças e Movimentos': 'physics',
    'Sinais, Ondas e Som': 'physics',
    'Eletromagnetismo': 'physics',
    'Ondas Eletromagnéticas': 'physics',
}

# Cada missão tem 3 testes: o primeiro incluído no plano Free, os outros
# dois exclusivos do SuperExplore (Pro). 'teste_id' fica a None enquanto o
# teste ainda não tiver conteúdo — a página mostra-o como "Em breve".
MISSOES_TESTES = [
    {
        'categoria': 'Botânica',
        'titulo': 'Fotossíntese',
        'meta': ['Grupos I, II e III', '14-16 perguntas', '45 minutos'],
        'correcao': 'Correção automática e por IA.',
        'testes': [
            {'titulo': 'Teste 1', 'plano': 'free', 'teste_id': 'fotossintese'},
            {'titulo': 'Teste 2', 'plano': 'pro', 'teste_id': 'fotossintese-c4-milho'},
            {'titulo': 'Teste 3', 'plano': 'pro', 'teste_id': 'fotossintese-cam-opuntia'},
        ],
    },
    {
        'categoria': 'Biodiversidade',
        'titulo': 'Diversidade e Organização Biológica',
        'meta': ['Grupos I, II e III', '14 perguntas', '45 minutos'],
        'correcao': 'Correção automática e por IA.',
        'testes': [
            {'titulo': 'Teste 1', 'plano': 'free', 'teste_id': 'diversidade'},
            {'titulo': 'Teste 2', 'plano': 'pro', 'teste_id': 'diversidade-ornitorrinco'},
            {'titulo': 'Teste 3', 'plano': 'pro', 'teste_id': 'diversidade-liquenes'},
        ],
    },
    {
        'categoria': 'Citologia',
        'titulo': 'Células e Organelos',
        'meta': ['Grupos I, II e III', '14 perguntas', '45 minutos'],
        'correcao': 'Correção automática e por IA.',
        'testes': [
            {'titulo': 'Teste 1', 'plano': 'free', 'teste_id': 'celulas'},
            {'titulo': 'Teste 2', 'plano': 'pro', 'teste_id': 'celulas-pancreas'},
            {'titulo': 'Teste 3', 'plano': 'pro', 'teste_id': 'celulas-endossimbiotica'},
        ],
    },
]

# Capítulos que ainda não têm testes escritos — aparecem na página de
# Testes com o mesmo painel e título das outras missões, mas com os 3
# testes a "Em breve" (teste_id a None), em vez de ficarem de fora da
# página só porque ainda não há conteúdo. Categoria e título espelham
# exatamente os usados em index-missions.html.
_TESTES_EM_BREVE = [
    ('Bioquímica', 'Biomoléculas'),
    ('Obtenção de Matéria', 'Obtenção de Matéria pelos Seres Heterotróficos'),
    ('Distribuição de Matéria', 'Xilema e Floema'),
    ('Distribuição de Matéria', 'Transporte nos Animais'),
    ('Transformação e Utilização de Energia', 'Respiração Aeróbia e Fermentação'),
    ('Transformação e Utilização de Energia', 'Trocas Gasosas'),
    ('Evolução Biológica', 'Lamarckismo e Darwinismo'),
    ('Sistemática dos Seres Vivos', 'Taxonomia e Sistemática'),
    ('Genética', 'O Código da Vida'),
    ('Genética', 'Síntese Proteica'),
    ('Genética', 'Mitose'),
    ('Genética', 'Meiose e Reprodução Sexuada'),
    ('Genética', 'Reprodução Assexuada'),
    ('Genética', 'Ciclos de Vida'),
    ('Citologia', 'Ciclo Celular'),
    ('Ecologia', 'Ecossistemas'),
    ('Corpo Humano', 'Sistema Nervoso'),
    ('Botânica', 'Fisiologia Vegetal'),
    ('Energia e Movimentos', 'Energia e Movimentos'),
    ('Energia e Fenómenos Elétricos', 'Energia e Fenómenos Elétricos'),
    ('Energia, Fenómenos Térmicos e Radiação', 'Energia, Fenómenos Térmicos e Radiação'),
    ('Movimento e Interações', 'Movimento e Interações'),
    ('Forças e Movimentos', 'Forças e Movimentos'),
    ('Sinais, Ondas e Som', 'Sinais, Ondas e Som'),
    ('Eletromagnetismo', 'Eletromagnetismo'),
    ('Ondas Eletromagnéticas', 'Ondas Eletromagnéticas'),
]
for _categoria, _titulo in _TESTES_EM_BREVE:
    MISSOES_TESTES.append({
        'categoria': _categoria,
        'titulo': _titulo,
        'meta': [],
        'correcao': '',
        'testes': [
            {'titulo': 'Teste 1', 'plano': 'free', 'teste_id': None},
            {'titulo': 'Teste 2', 'plano': 'pro', 'teste_id': None},
            {'titulo': 'Teste 3', 'plano': 'pro', 'teste_id': None},
        ],
    })


def encontrar_config_teste(teste_id):
    for missao in MISSOES_TESTES:
        for teste in missao['testes']:
            if teste.get('teste_id') == teste_id:
                return teste
    return None


def montar_categorias_testes(plano_aluno):
    categorias = {}
    for missao in MISSOES_TESTES:
        testes = []
        for teste in missao['testes']:
            disponivel = teste.get('teste_id') is not None
            testes.append({
                'titulo': teste['titulo'],
                'plano': teste['plano'],
                'disponivel': disponivel,
                'desbloqueado': teste['plano'] == 'free' or plano_aluno == 'pro',
                'url': reverse('teste-fotossintese', args=[teste['teste_id']]) if disponivel else None,
            })
        categorias.setdefault(missao['categoria'], []).append({**missao, 'testes': testes})
    return [
        {
            'nome': nome,
            'missoes': missoes,
            'imagem': CATEGORIA_TESTES_IMAGENS.get(nome, 'images/Biology image.jpg'),
            'imagem_contain': nome in CATEGORIA_TESTES_IMAGENS_CONTAIN,
            'disciplina': CATEGORIA_TESTES_DISCIPLINA.get(nome, 'biology'),
        }
        for nome, missoes in categorias.items()
    ]


@login_required(login_url='login')
def pagina_Testes(request):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    plano_aluno = perfil.plano if perfil is not None else 'free'
    return render(request, 'Testes.html', {
        'perfil': perfil,
        'categorias_testes': montar_categorias_testes(plano_aluno),
    })


EXAMES_DISPONIVEIS = [
    {
        'exame_id': 'biologia-geologia-2026-v1',
        'titulo': 'Exame Nacional de Biologia e Geologia — 2026, 1.ª Fase (V1)',
        'disciplina': 'Biologia e Geologia',
        'meta': ['11.º ano', 'Grupos I, II e III', '28 itens', '120 minutos'],
    },
    {
        'exame_id': 'biologia-geologia-2025-v1',
        'titulo': 'Exame Nacional de Biologia e Geologia — 2025, 1.ª Fase (V1)',
        'disciplina': 'Biologia e Geologia',
        'meta': ['11.º ano', 'Grupos I, II e III', '28 itens', '120 minutos'],
    },
]


def encontrar_config_exame(exame_id):
    for exame in EXAMES_DISPONIVEIS:
        if exame['exame_id'] == exame_id:
            return exame
    return None


@login_required(login_url='login')
def pagina_exames(request):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None
    return render(request, 'exames.html', {
        'perfil': perfil,
        'exames': EXAMES_DISPONIVEIS,
    })


def carregar_exame(exame_id):
    """Tal como os testes, os exames vivem fora de static/: contêm o
    gabarito e nunca devem chegar ao browser do aluno."""
    caminho_json = settings.BASE_DIR.parent / 'exames' / f'{exame_id}.json'
    with open(caminho_json, 'r', encoding='utf-8') as f:
        return json.load(f)


def _perguntas_publicas_por_id(perguntas):
    return {
        pergunta['id']: {chave: valor for chave, valor in pergunta.items() if chave not in CHAVES_SECRETAS_PERGUNTA}
        for pergunta in perguntas
    }


@login_required(login_url='login')
def pagina_exame_detalhe(request, exame_id):
    config_exame = encontrar_config_exame(exame_id)
    if config_exame is None:
        raise Http404('Exame não encontrado.')

    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    try:
        exame = carregar_exame(exame_id)
    except FileNotFoundError:
        raise Http404('Exame não encontrado.')

    perguntas_publicas_por_id = _perguntas_publicas_por_id(exame['perguntas'])

    # Monta, para cada secção de cada grupo, a lista já resolvida das suas
    # perguntas (sem chaves secretas) — o template não precisa de saber o
    # gabarito, só de desenhar as perguntas na ordem certa.
    grupos_para_template = []
    for grupo in exame['grupos']:
        seccoes_resolvidas = []
        for seccao in grupo['seccoes']:
            seccoes_resolvidas.append({
                **seccao,
                'perguntas': [perguntas_publicas_por_id[pid] for pid in seccao['pergunta_ids']],
            })
        grupos_para_template.append({**grupo, 'seccoes': seccoes_resolvidas})

    progresso_guardado = {}
    if perfil is not None:
        progresso_testes = perfil.progresso_testes if isinstance(perfil.progresso_testes, dict) else {}
        entrada = progresso_testes.get(exame_id)
        if isinstance(entrada, dict) and isinstance(entrada.get('respostas'), dict):
            progresso_guardado = entrada['respostas']

    return render(request, 'exame-detalhe.html', {
        'perfil': perfil,
        'exame': exame,
        'exame_id': exame_id,
        'grupos': grupos_para_template,
        'progresso_guardado': progresso_guardado,
    })


@login_required(login_url='login')
@require_POST
def corrigir_exame(request, exame_id):
    config_exame = encontrar_config_exame(exame_id)
    if config_exame is None:
        raise Http404('Exame não encontrado.')

    try:
        perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    try:
        dados_pedido = json.loads(request.body or '{}')
    except (TypeError, ValueError):
        return JsonResponse({'erro': 'Dados inválidos.'}, status=400)

    respostas_aluno = dados_pedido.get('respostas')
    if not isinstance(respostas_aluno, dict):
        return JsonResponse({'erro': 'Respostas em falta.'}, status=400)

    try:
        exame = carregar_exame(exame_id)
    except FileNotFoundError:
        raise Http404('Exame não encontrado.')

    resultado_perguntas = {}
    pontos_por_pergunta = {}
    perguntas_longas = []

    for pergunta in exame['perguntas']:
        resposta = respostas_aluno.get(pergunta['id'])
        if pergunta['tipo'] == 'resposta_longa':
            perguntas_longas.append((pergunta, resposta))
            continue
        pontos = corrigir_pergunta_automatica(pergunta, resposta)
        pontos_por_pergunta[pergunta['id']] = pontos
        resultado_perguntas[pergunta['id']] = {'pontos': pontos, 'cotacao': pergunta['cotacao']}

    feedback_ia = {}
    if perguntas_longas:
        correcao_ia = corrigir_perguntas_longas_com_ia(perguntas_longas)
        for pergunta, _ in perguntas_longas:
            item = correcao_ia.get(pergunta['id'], {'pontos': 0, 'feedback': ''})
            pontos_por_pergunta[pergunta['id']] = item['pontos']
            resultado_perguntas[pergunta['id']] = {'pontos': item['pontos'], 'cotacao': pergunta['cotacao']}
            feedback_ia[pergunta['id']] = item['feedback']

    # Itens de "melhor N de M" (ex: exames nacionais) — só as melhores
    # pontuações do conjunto opcional contam para a nota; as restantes são
    # descartadas, tal como na classificação oficial.
    pool_opcional = exame.get('pool_opcional')
    if pool_opcional:
        ids_pool = pool_opcional['ids']
        melhores_n = pool_opcional['melhores']
        pontuacoes_pool = sorted((pontos_por_pergunta.get(pid, 0) for pid in ids_pool), reverse=True)
        pontos_totais = sum(pontos for pid, pontos in pontos_por_pergunta.items() if pid not in ids_pool)
        pontos_totais += sum(pontuacoes_pool[:melhores_n])
    else:
        pontos_totais = sum(pontos_por_pergunta.values())

    nota_final = round(pontos_totais / (exame['cotacao_total'] / 20), 1)

    if perfil is not None:
        progresso_testes = dict(perfil.progresso_testes or {})
        if progresso_testes.pop(exame_id, None) is not None:
            perfil.progresso_testes = progresso_testes
            perfil.save(update_fields=['progresso_testes'])
        # Exames nacionais cobrem várias unidades ao mesmo tempo — sem
        # unidade específica, mas ainda conta para o gráfico de evolução.
        registar_resultado(request.user, 'exame', exame_id, '', nota_final / 20 * 100)

    return JsonResponse({
        'notaFinal': nota_final,
        'pontosTotais': round(pontos_totais, 2),
        'cotacaoTotal': exame['cotacao_total'],
        'perguntas': resultado_perguntas,
        'feedbackIA': feedback_ia,
    })


def carregar_vocabulario(missao_id):
    caminho_json = settings.BASE_DIR.parent / 'vocabulario' / f'{missao_id}.json'
    with open(caminho_json, 'r', encoding='utf-8') as f:
        return json.load(f)


def carregar_titulo_missao(missao_id):
    caminho_json = settings.BASE_DIR.parent / 'missoes' / f'{missao_id}.json'
    try:
        with open(caminho_json, 'r', encoding='utf-8') as f:
            return json.load(f).get('titulo', missao_id)
    except (FileNotFoundError, json.JSONDecodeError):
        return missao_id


# Biblioteca do Explorador: um "livro" de vocabulário por unidade, cada um
# associado ao ficheiro vocabulario/<id>.json (mesmo formato usado pelos
# flashcards — daí "Praticar com flashcards" reutilizar diretamente a rota
# de flashcards com o id da unidade). Uma unidade sem ficheiro ainda aparece
# na estante, mas como "ainda por começar".
UNIDADES_BIBLIOTECA = [
    {'id': 'citologia', 'nome': 'Citologia', 'cor_a': '#2f7ea6', 'cor_b': '#1fa6c9', 'cor_soft': '#e3f3f7', 'disciplina': 'Biologia'},
    {'id': 'bioquimica', 'nome': 'Bioquímica', 'cor_a': '#b0762f', 'cor_b': '#d19a3f', 'cor_soft': '#fbf1e2', 'disciplina': 'Biologia'},
    {'id': 'genetica', 'nome': 'Genética', 'cor_a': '#6c4fb0', 'cor_b': '#8a6bd1', 'cor_soft': '#efe7fa', 'disciplina': 'Biologia'},
    {'id': 'ecologia', 'nome': 'Ecologia', 'cor_a': '#5f7d33', 'cor_b': '#789b4a', 'cor_soft': '#eef3e0', 'disciplina': 'Biologia'},
    {'id': 'corpo_humano', 'nome': 'Corpo Humano', 'cor_a': '#b03a3a', 'cor_b': '#dc3545', 'cor_soft': '#fdecee', 'disciplina': 'Biologia'},
    {'id': 'botanica', 'nome': 'Botânica', 'cor_a': '#2f6b45', 'cor_b': '#1f8a5b', 'cor_soft': '#eaf3e9', 'disciplina': 'Biologia'},
    {'id': 'terra-sistema-rochas', 'nome': 'A Terra e as Rochas', 'cor_a': '#6b4a2f', 'cor_b': '#8f6b45', 'cor_soft': '#f1ece4', 'disciplina': 'Geologia'},
    {'id': 'tempo-e-tectonica', 'nome': 'Tempo e Tectónica de Placas', 'cor_a': '#1d4e73', 'cor_b': '#2f7ea6', 'cor_soft': '#e6f0f5', 'disciplina': 'Geologia'},
    {'id': 'origem-e-interior-da-terra', 'nome': 'Origem e Interior da Terra', 'cor_a': '#3a3a6b', 'cor_b': '#5a5a9e', 'cor_soft': '#eaeaf5', 'disciplina': 'Geologia'},
    {'id': 'vulcoes-e-sismos', 'nome': 'Vulcões e Sismos', 'cor_a': '#a3341f', 'cor_b': '#d4572e', 'cor_soft': '#faeae3', 'disciplina': 'Geologia'},
    {'id': 'riscos-ordenamento-territorio', 'nome': 'Riscos e Ordenamento do Território', 'cor_a': '#1d6b73', 'cor_b': '#2f9ea6', 'cor_soft': '#e5f3f4', 'disciplina': 'Geologia'},
    {'id': 'minerais', 'nome': 'Minerais', 'cor_a': '#6c4fb0', 'cor_b': '#8a6bd1', 'cor_soft': '#efe7fa', 'disciplina': 'Geologia'},
    {'id': 'rochas-sedimentares-magmaticas-metamorficas', 'nome': 'Rochas em Detalhe', 'cor_a': '#b0762f', 'cor_b': '#d19a3f', 'cor_soft': '#fbf1e2', 'disciplina': 'Geologia'},
    {'id': 'deformacao-e-recursos', 'nome': 'Deformação e Recursos', 'cor_a': '#3f5a6b', 'cor_b': '#5f87a6', 'cor_soft': '#e9eff2', 'disciplina': 'Geologia'},
]


def carregar_termos_unidade(unidade_id):
    try:
        return carregar_vocabulario(unidade_id).get('termos', [])
    except FileNotFoundError:
        return []


def aplicar_estado_vocabulario_aluno(perfil, unidade_id, termos):
    """Sobrepõe, em memória, o estado (dominado/a_rever) guardado por aluno
    em perfil.vocabulario_estado a cada termo — os ficheiros
    vocabulario/<unidade>.json só têm o conteúdo (termo, definição, etc.),
    nunca o progresso de leitura de ninguém."""
    estados_aluno = {}
    if perfil is not None and isinstance(perfil.vocabulario_estado, dict):
        estados_aluno = perfil.vocabulario_estado.get(unidade_id, {})
    for termo in termos:
        entrada = estados_aluno.get(termo['id'])
        if isinstance(entrada, dict):
            termo['estado'] = entrada.get('estado', 'novo')
            termo['ultima_revisao'] = entrada.get('ultima_revisao')
        else:
            termo['estado'] = 'novo'
            termo['ultima_revisao'] = None
    return termos


def montar_biblioteca_estante(perfil, unidades=None):
    estante = []
    for unidade in (unidades if unidades is not None else UNIDADES_BIBLIOTECA):
        termos = aplicar_estado_vocabulario_aluno(perfil, unidade['id'], carregar_termos_unidade(unidade['id']))
        novos = sum(1 for termo in termos if termo['estado'] == 'novo')
        estante.append({**unidade, 'total_termos': len(termos), 'novos': novos})
    return estante


@login_required(login_url='login')
def pagina_biblioteca(request):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None
    unidades = [u for u in UNIDADES_BIBLIOTECA if u['disciplina'] != 'Geologia']
    return render(request, 'biblioteca.html', {
        'perfil': perfil,
        'estante': montar_biblioteca_estante(perfil, unidades),
        'subject': 'biology',
    })


@login_required(login_url='login')
def pagina_biblioteca_geologia(request):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None
    unidades = [u for u in UNIDADES_BIBLIOTECA if u['disciplina'] == 'Geologia']
    return render(request, 'biblioteca.html', {
        'perfil': perfil,
        'estante': montar_biblioteca_estante(perfil, unidades),
        'subject': 'geology',
    })


@login_required(login_url='login')
def pagina_biblioteca_unidade(request, unidade_id):
    unidade = next((u for u in UNIDADES_BIBLIOTECA if u['id'] == unidade_id), None)
    if unidade is None:
        raise Http404('Unidade não encontrada.')

    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    termos = aplicar_estado_vocabulario_aluno(perfil, unidade_id, carregar_termos_unidade(unidade_id))
    nomes_por_id = {termo['id']: termo['termo'] for termo in termos}
    for termo in termos:
        termo['relacionados_nomes'] = [
            nomes_por_id.get(rel_id, rel_id) for rel_id in termo.get('relacionados', [])
        ]

    contagens = {'novo': 0, 'dominado': 0, 'a_rever': 0}
    for termo in termos:
        estado = termo['estado']
        if estado in contagens:
            contagens[estado] += 1

    missoes_capitulo = [
        {'id': id_missao_capitulo, 'titulo': carregar_titulo_missao(id_missao_capitulo)}
        for id_missao_capitulo in UNIDADE_PARA_MISSOES.get(unidade_id, [])
    ]

    return render(request, 'biblioteca-unidade.html', {
        'perfil': perfil,
        'unidade': unidade,
        'termos': termos,
        'total_termos': len(termos),
        'contagens': contagens,
        'missoes_capitulo': missoes_capitulo,
    })


@login_required(login_url='login')
def pagina_flashcards(request, missao_id):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    try:
        vocabulario = carregar_vocabulario(missao_id)
    except FileNotFoundError:
        raise Http404('Vocabulário não encontrado para esta missão.')

    vocabulario['termos'] = aplicar_estado_vocabulario_aluno(perfil, missao_id, vocabulario['termos'])

    missoes_capitulo = [
        {'id': id_missao_capitulo, 'titulo': carregar_titulo_missao(id_missao_capitulo)}
        for id_missao_capitulo in UNIDADE_PARA_MISSOES.get(missao_id, [])
    ]

    return render(request, 'flashcards.html', {
        'perfil': perfil,
        'vocabulario': vocabulario,
        'missao_id': missao_id,
        'missoes_capitulo': missoes_capitulo,
    })


@login_required(login_url='login')
@require_POST
def atualizar_vocabulario(request, missao_id):
    """Grava o resultado desta ronda de revisão no perfil do aluno (estado +
    última revisão por termo) — nunca no ficheiro de vocabulário, que é
    partilhado por todos os alunos."""
    try:
        dados_pedido = json.loads(request.body or '{}')
    except (TypeError, ValueError):
        return JsonResponse({'erro': 'Dados inválidos.'}, status=400)

    atualizacoes = dados_pedido.get('atualizacoes')
    if not isinstance(atualizacoes, list):
        return JsonResponse({'erro': 'Atualizações em falta.'}, status=400)

    estados_por_id = {}
    for item in atualizacoes:
        if not isinstance(item, dict):
            continue
        termo_id = item.get('id')
        estado = item.get('estado')
        if termo_id and estado in ('dominado', 'a_rever'):
            estados_por_id[termo_id] = estado

    if not estados_por_id:
        return JsonResponse({'ok': True})

    perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    hoje = timezone.localdate().isoformat()
    vocabulario_estado = dict(perfil.vocabulario_estado or {})
    unidade_estado = dict(vocabulario_estado.get(missao_id, {}))
    for termo_id, novo_estado in estados_por_id.items():
        unidade_estado[termo_id] = {'estado': novo_estado, 'ultima_revisao': hoje}
    vocabulario_estado[missao_id] = unidade_estado
    perfil.vocabulario_estado = vocabulario_estado
    perfil.save(update_fields=['vocabulario_estado'])
    registar_atividade(request.user)

    return JsonResponse({'ok': True})


RESUMOS = [
    {
        'id': 'fotossintese',
        'nome': 'Fotossíntese',
        'disciplina': 'Biologia',
        'categoria': 'Botânica',
        'imagem': 'images/Planta.png',
        'cor_a': '#2f6b45',
        'cor_b': '#1f8a5b',
        'cor_soft': '#eaf3e9',
        'descricao_curta': 'Como as plantas convertem luz solar em energia química, do cloroplasto ao Ciclo de Calvin.',
    },
    {
        'id': 'diversidade-organizacao-biologica',
        'nome': 'Diversidade e Organização Biológica',
        'disciplina': 'Biologia',
        'categoria': 'Biodiversidade',
        'imagem': 'images/Relva.jpeg',
        'cor_a': '#1d5f73',
        'cor_b': '#2a8fae',
        'cor_soft': '#e8f4f7',
        'descricao_curta': 'Dos átomos à biosfera, e da célula às moléculas da vida — os níveis de organização, os ecossistemas e a biodiversidade.',
    },
    {
        'id': 'terra-sistema-rochas',
        'nome': 'A Terra Como Sistema e as Rochas',
        'disciplina': 'Geologia',
        'cor_a': '#6b4a2f',
        'cor_b': '#8f6b45',
        'cor_soft': '#f1ece4',
        'descricao_curta': 'Os quatro subsistemas terrestres, a Geologia como ciência, e os três grandes grupos de rochas que registam a história da Terra.',
    },
    {
        'id': 'tempo-e-tectonica',
        'nome': 'O Tempo Geológico e a Tectónica de Placas',
        'disciplina': 'Geologia',
        'cor_a': '#1d4e73',
        'cor_b': '#2f7ea6',
        'cor_soft': '#e6f0f5',
        'descricao_curta': 'Datação relativa e absoluta, a idade da Terra, e como a Terra passou de fixista a mobilista com a tectónica de placas.',
    },
    {
        'id': 'origem-e-interior-da-terra',
        'nome': 'Origem da Terra e o Seu Interior',
        'disciplina': 'Geologia',
        'cor_a': '#3a3a6b',
        'cor_b': '#5a5a9e',
        'cor_soft': '#eaeaf5',
        'descricao_curta': 'Da nébula solar à diferenciação em camadas, e como estudamos — direta e indiretamente — o que está lá dentro.',
    },
    {
        'id': 'vulcoes-e-sismos',
        'nome': 'Vulcões e Sismos',
        'disciplina': 'Geologia',
        'cor_a': '#a3341f',
        'cor_b': '#d4572e',
        'cor_soft': '#faeae3',
        'descricao_curta': 'Magma, lava e tipos de vulcanismo, ondas sísmicas, intensidade e magnitude — a energia interna da Terra em ação.',
    },
    {
        'id': 'riscos-ordenamento-territorio',
        'nome': 'Riscos Geológicos e Ordenamento do Território',
        'disciplina': 'Geologia',
        'cor_a': '#1d6b73',
        'cor_b': '#2f9ea6',
        'cor_soft': '#e5f3f4',
        'descricao_curta': 'Bacias hidrográficas, zonas costeiras e de vertente — os riscos da ocupação humana e como preveni-los.',
    },
    {
        'id': 'minerais',
        'nome': 'Minerais',
        'disciplina': 'Geologia',
        'cor_a': '#6c4fb0',
        'cor_b': '#8a6bd1',
        'cor_soft': '#efe7fa',
        'descricao_curta': 'O que é um mineral, polimorfismo e isomorfismo, e as propriedades físicas usadas para os identificar.',
    },
    {
        'id': 'rochas-sedimentares-magmaticas-metamorficas',
        'nome': 'Rochas Sedimentares, Magmáticas e Metamórficas',
        'disciplina': 'Geologia',
        'cor_a': '#b0762f',
        'cor_b': '#d19a3f',
        'cor_soft': '#fbf1e2',
        'descricao_curta': 'Os três grandes grupos de rochas em detalhe: como se formam, como se classificam, e como se interligam no ciclo litológico.',
    },
    {
        'id': 'deformacao-e-recursos',
        'nome': 'Deformação das Rochas e Recursos Geológicos',
        'disciplina': 'Geologia',
        'cor_a': '#3f5a6b',
        'cor_b': '#5f87a6',
        'cor_soft': '#e9eff2',
        'descricao_curta': 'Tensões, dobras e falhas, e como explorar os recursos minerais, energéticos e hídricos de forma sustentável.',
    },
]

RESUMOS_CONTEUDO = {
    'fotossintese': {
        'seccoes': [
            {
                'titulo': 'Localização Celular: O Cloroplasto',
                'texto': (
                    'Nas plantas, a fotossíntese ocorre dentro de organelos celulares especializados chamados '
                    '**cloroplastos**, presentes maioritariamente nas células do parênquima clorofilino das folhas.'
                ),
                'imagem': 'images/Tilacoides 2.jpg',
                'imagem_alt': 'Ilustração do zoom da folha até à membrana dos tilacoides, com a grana e o estroma dentro do cloroplasto',
                # Coordenadas no espaço original da imagem (1536×1024 px). A
                # legenda vive numa faixa extra à direita ("imagem_gutter"),
                # fora dos limites da própria imagem — por isso o SVG que a
                # desenha é mais largo do que a <img> por baixo dela (ver
                # 'imagem_svg_largura_pct', calculado a partir destes números).
                'imagem_largura': 1536,
                'imagem_altura': 1024,
                'imagem_gutter': 430,
                # = (imagem_largura + imagem_gutter) / imagem_largura * 100 —
                # a largura do SVG de legenda face à <img> por baixo dele.
                'imagem_svg_largura_pct': 128,
                'imagem_marcadores': [
                    # Membranas e Tilacoides — ponto de ancoragem na membrana.
                    {'numero': 1, 'ax': 1352, 'ay': 461, 'lx': 1736, 'ly': 512},
                    # Grana — ponto de ancoragem na pilha de tilacoides.
                    {'numero': 2, 'ax': 952, 'ay': 430, 'lx': 1736, 'ly': 200},
                    # Estroma — ponto de ancoragem no espaço fluido entre as pilhas.
                    {'numero': 3, 'ax': 876, 'ay': 563, 'lx': 1736, 'ly': 824},
                ],
                'definicoes': [
                    {
                        'termo': 'Membranas e Tilacoides',
                        'texto': (
                            'No interior do cloroplasto existem sacos membranares achatados chamados '
                            '**tilacoides**. É na membrana dos tilacoides que se encontram ancorados os pigmentos '
                            'fotossintéticos (principalmente as clorofilas *a* e *b* e os carotenoides), '
                            'organizados em fotossistemas.'
                        ),
                    },
                    {
                        'termo': 'Grana',
                        'texto': 'O conjunto de tilacoides empilhados recebe o nome de **grana** (no singular, *granum*).',
                    },
                    {
                        'termo': 'Estroma',
                        'texto': (
                            'O espaço fluido e denso que preenche o interior do cloroplasto, envolvendo os '
                            'tilacoides. É rico em enzimas, ribossomas e DNA próprio.'
                        ),
                    },
                ],
                'dica': (
                    'pensa no cloroplasto como uma **fábrica de açúcar movida a energia solar**. Os tilacoides '
                    'são os **painéis solares**, empilhados em torres (grana) para captar o máximo de luz '
                    'possível. O estroma é o **chão de fábrica** à volta desses painéis, onde as peças (CO₂) são '
                    'montadas no produto final (glicose), usando a eletricidade (ATP/NADPH) que os painéis '
                    'acabaram de gerar.'
                ),
            },
            {
                'titulo': 'Fase 1 — Reações Fotoquímicas (Fase Dependente da Luz)',
                'texto': (
                    'Esta fase ocorre exclusivamente na membrana dos tilacoides e requer a presença direta '
                    'da luz solar.'
                ),
                'imagem': 'images/Cadeia transportadora de eletrões.png',
                'imagem_alt': 'Esquema da cadeia transportadora de eletrões na membrana do tilacoide: PSII, Cyt b6f, PSI e ATP-sintase',
                'imagem_max_width': '640px',
                'passos': [
                    {
                        'titulo': 'Excitação da clorofila e cadeia de transporte de eletrões',
                        'texto': (
                            'A luz incide nos pigmentos do Fotossistema II (PSII). A energia absorvida excita '
                            'os eletrões da clorofila, que saltam para níveis de energia superiores e são '
                            'transferidos ao longo de uma cadeia de transportadores.'
                        ),
                    },
                    {
                        'titulo': 'Fotólise da água',
                        'texto': (
                            'Para substituir os eletrões perdidos pela clorofila, ocorre a quebra de moléculas '
                            'de água (H₂O). A água divide-se em eletrões (repõem os da clorofila), protões H⁺ '
                            'e oxigénio gasoso.'
                        ),
                    },
                    {
                        'titulo': 'Produção de oxigénio',
                        'texto': 'O O₂ resultante da fotólise é libertado para o meio ambiente através dos estomas.',
                    },
                    {
                        'titulo': 'Fotofosforilação (síntese de ATP)',
                        'texto': (
                            'O movimento dos protões H⁺ através da enzima ATP-sintase impulsiona a conversão de '
                            'ADP em ATP.'
                        ),
                    },
                    {
                        'titulo': 'Formação de NADPH',
                        'texto': (
                            'Os eletrões chegam ao Fotossistema I (PSI), são novamente energizados pela luz, e '
                            'utilizados para reduzir o NADP⁺ a NADPH.'
                        ),
                    },
                ],
                'dica': (
                    'imagina a água como uma **garrafa reciclável que é esmagada** para libertar o que interessa '
                    '(eletrões) — o oxigénio que sobra é literalmente **lixo descartado** para o ar, não um '
                    'produto que a planta queira guardar. Já o ATP e o NADPH são como **dinheiro e um cartão de '
                    'crédito**: o ATP é dinheiro pronto a gastar (energia direta), o NADPH é um cartão que '
                    '"transporta" eletrões para serem usados como poder de compra mais tarde, na fase seguinte.'
                ),
            },
            {
                'titulo': 'Fase 2 — Reações Químicas (Ciclo de Calvin)',
                'texto': (
                    'Esta fase ocorre no **estroma** e utiliza a energia química gerada na fase fotoquímica '
                    '(ATP e NADPH) para converter o dióxido de carbono em compostos orgânicos.'
                ),
                'imagem': 'images/Ciclo de Calvin 2.png',
                'imagem_alt': 'Esquema do Ciclo de Calvin: fixação do carbono, redução e regeneração da RuBP',
                'imagem_max_width': '520px',
                'passos': [
                    {
                        'titulo': 'Fixação do carbono',
                        'texto': (
                            'O CO₂ difunde-se até ao estroma. A enzima **RuBisCO** catalisa a ligação do CO₂ a '
                            'uma molécula de 5 carbonos (RuBP), formando compostos de 3 carbonos (3-PGA).'
                        ),
                    },
                    {
                        'titulo': 'Redução',
                        'texto': (
                            'O ATP fornece energia e o NADPH fornece eletrões/hidrogénios para reduzir o 3-PGA '
                            'a G3P (gliceraldeído-3-fosfato).'
                        ),
                    },
                    {
                        'titulo': 'Produção de glicose',
                        'texto': (
                            'A cada 6 voltas do ciclo, são produzidas moléculas de G3P suficientes para '
                            'sintetizar uma molécula de glicose, além de sacarose e amido.'
                        ),
                    },
                    {
                        'titulo': 'Regeneração da RuBP',
                        'texto': (
                            'Parte das moléculas de G3P são reorganizadas, com mais ATP, para regenerar a RuBP, '
                            'permitindo que o ciclo recomece.'
                        ),
                    },
                ],
                'dica': (
                    'a RuBisCO é como um **anzol lançado ao ar** — "pesca" o CO₂ que está disperso na atmosfera '
                    'e prende-o a uma molécula maior, para deixar de andar solto. E pensa no ciclo todo como uma '
                    '**linha de montagem circular**: parte das peças a meio da linha (G3P) segue para o produto '
                    'final (glicose), mas outra parte volta ao início da linha (regenera a RuBP) para o processo '
                    'nunca parar — como uma correia transportadora fechada, não uma linha reta com fim.'
                ),
            },
        ],
        'fatores_titulo': 'Fatores Limitantes da Fotossíntese',
        'fatores': [
            {
                'titulo': 'Intensidade e comprimento de onda da luz',
                'texto': (
                    'a taxa aumenta com a luz até ao ponto de saturação. As clorofilas absorvem sobretudo azul '
                    'e vermelho, refletindo o verde (daí a cor das plantas).'
                ),
            },
            {
                'titulo': 'Concentração de CO₂',
                'texto': 'mais CO₂ acelera a taxa até a RuBisCO ficar saturada.',
            },
            {
                'titulo': 'Temperatura',
                'texto': (
                    'a taxa aumenta com a temperatura até um ótimo; temperaturas excessivas desnaturam as '
                    'enzimas e fecham os estomas.'
                ),
            },
            {
                'titulo': 'Disponibilidade de água',
                'texto': 'sem água, os estomas fecham para evitar dessecação, bloqueando a entrada de CO₂.',
            },
        ],
        'fatores_dica': (
            'pensa numa **autoestrada numa hora de ponta**. Mais carros (mais luz, mais CO₂) fazem o trânsito '
            'fluir mais depressa — até a estrada ficar cheia (saturação enzimática), e a partir daí, por mais '
            'carros que entrem, nada anda mais rápido. A temperatura é como o **motor de um carro de corrida**: '
            'quanto mais quente, mais rápido funciona — até sobreaquecer e avariar (desnaturação). E a água é '
            'como as **portas de um comboio no inverno**: fecham para não deixar entrar o frio (perder água), '
            'mas ao fechar, também impedem quem quer entrar (o CO₂) de o fazer.'
        ),
        'sintese_titulo': 'Síntese Final para Memória Rápida',
        'sintese_final': [
            {'label': 'Onde ocorre', 'valor': 'Cloroplastos'},
            {'label': 'Fase clara', 'valor': 'Tilacoides · usa H₂O e luz · produz O₂, ATP e NADPH'},
            {'label': 'Fase escura (Calvin)', 'valor': 'Estroma · usa CO₂, ATP e NADPH · produz glicose'},
            {'label': 'Origem do oxigénio', 'valor': 'Exclusivamente da água, na fase clara'},
        ],
        'sintese_dica': (
            '*"A luz parte a água lá em cima (tilacoides), o carbono é pescado lá em baixo (estroma) — o que '
            'sobe como energia (ATP/NADPH), desce para virar açúcar."*'
        ),
    },
    'diversidade-organizacao-biologica': {
        'seccoes': [
            {
                'titulo': 'O que é a Biodiversidade?',
                'texto': (
                    'A Terra alberga uma enorme variedade de seres vivos, distribuídos pelos mais diversos '
                    'ambientes (aquáticos, terrestres, extremos). A esta variedade dá-se o nome de '
                    '**diversidade biológica** ou **biodiversidade**. Apesar de toda esta diversidade, todos '
                    'os seres vivos partilham um conjunto de características comuns.'
                ),
                'definicoes': [
                    {
                        'termo': 'Constituição celular',
                        'texto': 'Todos os seres vivos são formados por uma ou mais células.',
                    },
                    {
                        'termo': 'Metabolismo',
                        'texto': 'Utilizam energia e matéria do meio para se manterem e crescerem.',
                    },
                    {
                        'termo': 'Irritabilidade',
                        'texto': 'Reagem a estímulos do ambiente que os rodeia.',
                    },
                    {
                        'termo': 'Reprodução',
                        'texto': 'Têm capacidade de originar novos seres vivos semelhantes a si.',
                    },
                    {
                        'termo': 'Crescimento e desenvolvimento',
                        'texto': 'Sofrem alterações ao longo do seu ciclo de vida.',
                    },
                ],
                'dica': (
                    'pensa nestas cinco características como um **"checklist de admissão" ao clube da vida** '
                    '— só entra quem tiver células, gastar energia, reagir ao que o rodeia, crescer e '
                    'conseguir reproduzir-se. Falta uma destas condições, e já não é considerado um ser vivo.'
                ),
            },
            {
                'titulo': 'Níveis de Organização Biológica',
                'texto': (
                    'O mundo vivo não é caótico — apresenta-se **hierarquicamente estruturado**, em níveis '
                    'de organização crescente, do mais simples ao mais complexo. Cada nível resulta da '
                    'interação e organização do nível anterior — é o chamado **princípio da hierarquização '
                    'biológica**.'
                ),
                'imagem': 'images/resumo-diversidade-organizacao-biologica/niveis-organizacao.png',
                'imagem_alt': 'Esquema dos níveis de organização biológica, em sequência: molécula e célula, tecido e órgão, organismo, população e comunidade, ecossistema e biosfera.',
                'definicoes': [
                    {
                        'termo': 'Átomo / Molécula',
                        'texto': 'Unidades químicas básicas (ex.: água, glicose, proteínas) que constituem a matéria viva.',
                    },
                    {
                        'termo': 'Célula',
                        'texto': 'Unidade estrutural e funcional básica de todos os seres vivos.',
                    },
                    {
                        'termo': 'Tecido',
                        'texto': 'Conjunto de células com a mesma origem, forma e função.',
                    },
                    {
                        'termo': 'Órgão',
                        'texto': 'Conjunto de tecidos diferentes que cooperam numa função comum.',
                    },
                    {
                        'termo': 'Sistema de órgãos',
                        'texto': 'Conjunto de órgãos que trabalham de forma coordenada (ex.: sistema digestivo).',
                    },
                    {
                        'termo': 'Organismo',
                        'texto': 'Ser vivo individual, resultante da integração de todos os sistemas.',
                    },
                    {
                        'termo': 'População',
                        'texto': 'Conjunto de organismos da mesma espécie que vivem na mesma área, na mesma altura, e que podem cruzar-se entre si.',
                    },
                    {
                        'termo': 'Comunidade (biocenose)',
                        'texto': 'Conjunto de populações de espécies diferentes que coexistem numa mesma área.',
                    },
                    {
                        'termo': 'Ecossistema',
                        'texto': 'Conjunto formado pela comunidade biótica e pelo meio abiótico (fatores físico-químicos) com que interage.',
                    },
                    {
                        'termo': 'Bioma',
                        'texto': 'Grande região com características climáticas e ecológicas semelhantes, que agrupa vários ecossistemas (ex.: floresta tropical, tundra).',
                    },
                    {
                        'termo': 'Biosfera',
                        'texto': 'Conjunto de todos os ecossistemas do planeta — a "camada" da Terra onde existe vida.',
                    },
                ],
                'dica': (
                    'imagina um conjunto de **bonecas russas (matrioskas)**: cada nível está contido no '
                    'seguinte e ajuda a construí-lo — os átomos formam moléculas, as moléculas formam '
                    'células, as células formam tecidos, e assim sucessivamente até à biosfera. Para '
                    'memorizar a ordem, tenta a frase: *"A Célula Trabalha Organizando Sistemas, Originando '
                    'Populações Companheiras Em Biomas Sempre."*'
                ),
            },
            {
                'titulo': 'Estrutura do Ecossistema: Biótopo e Biocenose',
                'texto': (
                    'Um ecossistema é constituído por dois componentes: o **biótopo** (componente abiótica) '
                    '— fatores físicos e químicos do meio, como luz, temperatura, água, solo, salinidade ou '
                    'pH — e a **biocenose** (componente biótica) — o conjunto dos seres vivos presentes. '
                    'Dentro da biocenose, os seres vivos organizam-se em três grandes grupos funcionais, '
                    'consoante o seu papel na cadeia alimentar.'
                ),
                'imagem': 'images/resumo-diversidade-organizacao-biologica/produtores-consumidores-decompositores.png',
                'imagem_alt': 'Esquema dos grupos funcionais de um ecossistema: produtores captam energia solar por fotossíntese, consumidores (herbívoros e carnívoros) alimentam-se deles, e decompositores (fungos e bactérias) devolvem a matéria ao meio, fechando o ciclo de volta aos produtores.',
                'imagem_max_width': '520px',
                'definicoes': [
                    {
                        'termo': 'Produtores',
                        'texto': 'Organismos autotróficos (ex.: plantas, algas, cianobactérias) que produzem matéria orgânica a partir de matéria inorgânica, geralmente através da fotossíntese.',
                    },
                    {
                        'termo': 'Consumidores primários',
                        'texto': 'Herbívoros — organismos heterotróficos que se alimentam diretamente dos produtores.',
                    },
                    {
                        'termo': 'Consumidores secundários e terciários',
                        'texto': 'Carnívoros que se alimentam, respetivamente, de consumidores primários ou de outros carnívoros.',
                    },
                    {
                        'termo': 'Decompositores',
                        'texto': 'Fungos e bactérias que decompõem matéria orgânica morta (restos de seres vivos, excrementos), devolvendo matéria inorgânica ao meio e fechando os ciclos de matéria.',
                    },
                ],
                'dica': (
                    'pensa numa **economia em miniatura**: os produtores são a fábrica que cria riqueza '
                    '(matéria orgânica) a partir do zero; os consumidores são quem compra e usa essa riqueza, '
                    'passando-a de mão em mão; e os decompositores são a reciclagem, que devolve os '
                    'materiais ao mercado para tudo poder recomeçar.'
                ),
            },
            {
                'titulo': 'Dinâmica do Ecossistema',
                'texto': (
                    'Um ecossistema não é estático — a energia e a matéria estão em constante movimento '
                    'entre os seus componentes, através de relações alimentares e de trocas com o meio '
                    'abiótico.'
                ),
                'definicoes': [
                    {
                        'termo': 'Fluxo de energia',
                        'texto': 'A energia entra no ecossistema pela luz solar (captada pelos produtores) e circula, de forma unidirecional, ao longo da cadeia/teia alimentar, dissipando-se progressivamente sob a forma de calor.',
                    },
                    {
                        'termo': 'Ciclo de matéria',
                        'texto': 'Ao contrário da energia, a matéria é reciclada: os decompositores devolvem os nutrientes ao meio abiótico, que voltam a ser utilizados pelos produtores.',
                    },
                    {
                        'termo': 'Cadeias e teias alimentares',
                        'texto': 'As cadeias alimentares raramente são lineares e isoladas; interligam-se formando teias alimentares complexas, o que confere maior estabilidade ao ecossistema.',
                    },
                    {
                        'termo': 'Fatores limitantes',
                        'texto': 'Fatores abióticos ou bióticos que condicionam o crescimento e a distribuição das populações (ex.: disponibilidade de água, temperatura, competição, predação).',
                    },
                ],
                'dica': (
                    'a energia é como a **água de um rio**: corre sempre no mesmo sentido e acaba por se '
                    'perder no mar, sob a forma de calor — nunca volta atrás. Já a matéria é como uma '
                    '**garrafa reutilizável**: anda sempre a circular entre os seres vivos e o meio, nunca '
                    'se perde, só muda de forma.'
                ),
            },
            {
                'titulo': 'Os Três Níveis da Biodiversidade',
                'texto': 'A biodiversidade pode ser analisada a três níveis distintos, do mais específico ao mais amplo.',
                'imagem': 'images/resumo-diversidade-organizacao-biologica/biodiversidade-extincao-conservacao.png',
                'imagem_alt': 'Esquema da biodiversidade (genes, espécies, ecossistemas), representada como uma árvore, e uma balança que equilibra as causas de extinção (destruição de habitats, poluição, exploração) com as estratégias de conservação (áreas protegidas, bancos de genes, educação).',
                'imagem_max_width': '480px',
                'definicoes': [
                    {
                        'termo': 'Diversidade genética',
                        'texto': 'Variabilidade de genes dentro de cada espécie (entre indivíduos da mesma população/espécie).',
                    },
                    {
                        'termo': 'Diversidade de espécies',
                        'texto': 'Número e variedade de espécies existentes numa determinada região ou no planeta.',
                    },
                    {
                        'termo': 'Diversidade de ecossistemas',
                        'texto': 'Variedade de habitats, comunidades bióticas e processos ecológicos numa dada área.',
                    },
                ],
                'dica': (
                    'pensa numa **biblioteca**: a diversidade de ecossistemas são as diferentes salas '
                    '(floresta, oceano, deserto); a diversidade de espécies são os livros diferentes em '
                    'cada sala; e a diversidade genética são as edições diferentes do mesmo livro — todas '
                    'contam para a riqueza total da biblioteca.'
                ),
            },
            {
                'titulo': 'Porque é Importante a Biodiversidade',
                'texto': 'A biodiversidade não é só uma curiosidade da natureza — sustenta diretamente a vida no planeta e a nossa própria qualidade de vida.',
                'definicoes': [
                    {
                        'termo': 'Equilíbrio e resiliência',
                        'texto': 'Garante o equilíbrio dos ecossistemas — quanto maior a diversidade, maior a capacidade de resposta a perturbações.',
                    },
                    {
                        'termo': 'Serviços de ecossistema',
                        'texto': 'Fornece polinização, purificação da água e do ar, regulação do clima e fertilidade do solo.',
                    },
                    {
                        'termo': 'Recursos genéticos',
                        'texto': 'Constitui uma reserva de recursos usados na alimentação, na medicina e na biotecnologia.',
                    },
                    {
                        'termo': 'Valor cultural, científico e estético',
                        'texto': 'Enriquece o conhecimento científico e a vida cultural e estética das sociedades humanas.',
                    },
                ],
                'dica': (
                    'quanto mais **ferramentas houver numa caixa de ferramentas** (biodiversidade), maior a '
                    'probabilidade de existir a ferramenta certa quando surge um problema novo — uma seca, '
                    'uma doença, uma alteração climática. É isso que dá **resiliência** a um ecossistema.'
                ),
            },
            {
                'titulo': 'Extinção de Espécies',
                'texto': (
                    'A **extinção** corresponde ao desaparecimento definitivo de uma espécie. Pode ser '
                    '**natural** — resultante de processos evolutivos e alterações ambientais ao longo do '
                    'tempo geológico, como as grandes extinções em massa registadas no registo fóssil — ou '
                    '**antrópica** — causada pela ação humana, atualmente a principal causa da perda '
                    'acelerada de biodiversidade.'
                ),
                'definicoes': [
                    {
                        'termo': 'Destruição e fragmentação de habitats',
                        'texto': 'Desflorestação, urbanização e agricultura intensiva reduzem e dividem os espaços onde as espécies vivem.',
                    },
                    {
                        'termo': 'Poluição',
                        'texto': 'Contaminação do solo, da água e do ar, que degrada habitats e prejudica os seres vivos.',
                    },
                    {
                        'termo': 'Sobre-exploração de recursos',
                        'texto': 'Pesca e caça excessivas, além da capacidade de renovação natural das populações.',
                    },
                    {
                        'termo': 'Espécies exóticas/invasoras',
                        'texto': 'Espécies introduzidas que competem com as espécies nativas ou as predam.',
                    },
                    {
                        'termo': 'Alterações climáticas globais',
                        'texto': 'Mudanças no clima que ultrapassam a capacidade de adaptação de muitas espécies.',
                    },
                ],
                'dica': (
                    'pensa nas causas antrópicas de extinção como **ameaças a uma casa**: destruíres a casa '
                    '(habitat), envenenares o ar lá dentro (poluição), esvaziares tudo o que lá está '
                    '(sobre-exploração), deixares entrar intrusos (espécies invasoras), ou mudares a própria '
                    'temperatura do bairro (alterações climáticas).'
                ),
            },
            {
                'titulo': 'Conservação da Biodiversidade',
                'texto': (
                    'Para travar a perda de biodiversidade, existem diferentes estratégias de conservação, '
                    'complementadas por legislação e acordos internacionais de proteção de espécies e '
                    'habitats, por sensibilização e educação ambiental, e pela gestão sustentável dos '
                    'recursos naturais.'
                ),
                'definicoes': [
                    {
                        'termo': 'Conservação in situ',
                        'texto': 'Proteção das espécies no seu habitat natural — ex.: parques naturais, reservas, áreas protegidas, corredores ecológicos.',
                    },
                    {
                        'termo': 'Conservação ex situ',
                        'texto': 'Conservação fora do habitat natural — ex.: jardins botânicos, zoológicos, bancos de sementes e de germoplasma, programas de reprodução em cativeiro.',
                    },
                ],
                'dica': (
                    'a conservação **in situ** é como tratar de um doente em casa dele; a conservação '
                    '**ex situ** é como levá-lo para o hospital — ambas podem salvar a espécie, mas fazem-no '
                    'em locais diferentes, e a ex situ costuma ser o último recurso quando o "ambiente '
                    'natural" já não é seguro.'
                ),
            },
            {
                'titulo': 'A Célula: Unidade da Vida (Teoria Celular)',
                'texto': (
                    'A **célula** é a unidade estrutural e funcional de todos os seres vivos. Esta ideia é '
                    'formalizada pela **Teoria Celular**, que assenta em três princípios fundamentais.'
                ),
                'passos': [
                    {
                        'titulo': 'Todos os seres vivos são celulares',
                        'texto': 'São constituídos por uma ou mais células.',
                    },
                    {
                        'titulo': 'A célula é a unidade básica',
                        'texto': 'É a unidade básica de estrutura e função dos seres vivos.',
                    },
                    {
                        'titulo': 'Continuidade celular',
                        'texto': 'Todas as células provêm de células pré-existentes, por divisão celular.',
                    },
                ],
                'dica': (
                    'pensa na célula como o **"tijolo" de qualquer construção viva**: todo o edifício (o '
                    'ser vivo) é feito de tijolos; cada tijolo já tem tudo o que precisa para funcionar por '
                    'si só; e um tijolo novo só nasce a partir de outro tijolo já existente — nunca do nada.'
                ),
            },
            {
                'titulo': 'Diversidade Celular: Procariótica vs. Eucariótica',
                'texto': (
                    'Apesar da grande variedade de formas, tamanhos e funções das células, distinguem-se '
                    'dois grandes tipos de organização celular.'
                ),
                'imagens': [
                    {
                        'imagem': 'images/resumo-diversidade-organizacao-biologica/procariotica-vs-eucariotica.png',
                        'imagem_alt': 'Comparação esquemática: a célula procariótica tem o material genético disperso no citoplasma (nucleoide), sem núcleo definido; a célula eucariótica tem um núcleo delimitado por membrana e organelos como mitocôndrias e retículo endoplasmático.',
                        'legenda': 'Célula procariótica vs. eucariótica',
                    },
                    {
                        'imagem': 'images/resumo-diversidade-organizacao-biologica/celula-eucariotica-detalhe.png',
                        'imagem_alt': 'Esquema pormenorizado de uma célula eucariótica, com a membrana celular, o núcleo, as mitocôndrias, o retículo endoplasmático, o complexo de Golgi, os ribossomas livres e um lisossoma assinalados.',
                        'legenda': 'Constituintes de uma célula eucariótica',
                    },
                ],
                'definicoes': [
                    {
                        'termo': 'Célula procariótica',
                        'texto': 'Não possui núcleo individualizado — o material genético encontra-se disperso no citoplasma, numa região designada nucleoide. Não apresenta organelos membranares. Estrutura mais simples e de menores dimensões. Característica das bactérias e arqueias.',
                    },
                    {
                        'termo': 'Célula eucariótica',
                        'texto': 'Possui um núcleo individualizado, delimitado por uma membrana nuclear, que contém o material genético. Apresenta diversos organelos membranares especializados (mitocôndrias, retículo endoplasmático, complexo de Golgi, etc.). Estrutura mais complexa e, em geral, de maiores dimensões. Característica dos protistas, fungos, plantas e animais.',
                    },
                ],
                'dica': (
                    'a célula procariótica é como um **escritório open-space**, sem paredes — tudo à vista, '
                    'incluindo o DNA "a boiar" na sala. A célula eucariótica é como um **escritório com '
                    'salas separadas** (os organelos), e o DNA tem a sua própria sala trancada — o núcleo.'
                ),
            },
            {
                'titulo': 'Célula Animal vs. Célula Vegetal, e o Número de Células',
                'texto': (
                    'Dentro das células eucarióticas distinguem-se, entre outras, a célula animal e a célula '
                    'vegetal, que apresentam diferenças estruturais. Os organismos podem ainda classificar-se '
                    'quanto ao número de células: os **unicelulares** são constituídos por uma única célula, '
                    'que desempenha todas as funções vitais (ex.: bactérias, muitos protistas); os '
                    '**pluricelulares** (multicelulares) são constituídos por muitas células, geralmente '
                    'especializadas e organizadas em tecidos, órgãos e sistemas.'
                ),
                'definicoes': [
                    {
                        'termo': 'Parede celular',
                        'texto': 'Ausente na célula animal; presente (de celulose) na célula vegetal.',
                    },
                    {
                        'termo': 'Cloroplastos',
                        'texto': 'Ausentes na célula animal; presentes na célula vegetal.',
                    },
                    {
                        'termo': 'Vacúolo',
                        'texto': 'Pequeno ou ausente na célula animal; grande vacúolo central na célula vegetal.',
                    },
                    {
                        'termo': 'Forma',
                        'texto': 'Geralmente irregular na célula animal; geralmente regular (definida pela parede) na célula vegetal.',
                    },
                ],
                'dica': (
                    'a célula vegetal tem "paredes de tijolo" (parede celular) e "painéis solares" '
                    '(cloroplastos) que a célula animal não tem — por isso a planta não precisa de "sair de '
                    'casa" para ir buscar energia, produz a sua própria.'
                ),
            },
            {
                'titulo': 'Constituintes Moleculares dos Seres Vivos',
                'texto': (
                    'Do ponto de vista químico, todos os seres vivos são constituídos pelos mesmos tipos de '
                    'moléculas, formadas essencialmente por um número reduzido de elementos químicos: '
                    '**Carbono (C), Oxigénio (O), Hidrogénio (H), Azoto/Nitrogénio (N)** e, em menor '
                    'quantidade, Fósforo (P), Enxofre (S), Cálcio (Ca), entre outros. Esta uniformidade '
                    'química é um forte argumento a favor da **unidade da vida**. Os compostos orgânicos '
                    '(macromoléculas) resultam da união de unidades mais simples — os monómeros — através '
                    'de reações de polimerização/condensação, com libertação de água; o processo inverso '
                    '(hidrólise) liberta os monómeros, com consumo de água.'
                ),
                'definicoes': [
                    {
                        'termo': 'Água',
                        'texto': 'A molécula mais abundante nos seres vivos. É uma molécula polar, o que lhe confere elevado poder solvente, coesão e adesão, e elevado calor específico. É o meio onde ocorrem as reações metabólicas, participa no transporte de substâncias, na termorregulação e em reações químicas como a hidrólise e a fotossíntese.',
                    },
                    {
                        'termo': 'Glícidos (hidratos de carbono)',
                        'texto': 'Monómeros: monossacarídeos (ex.: glicose). Função: fonte e reserva de energia (ex.: amido, glicogénio); função estrutural (ex.: celulose).',
                    },
                    {
                        'termo': 'Lípidos',
                        'texto': 'Monómeros: ácidos gordos e glicerol, entre outros. Função: reserva energética; constituintes das membranas celulares (fosfolípidos); função hormonal e isolamento.',
                    },
                    {
                        'termo': 'Proteínas',
                        'texto': 'Monómeros: aminoácidos. Função: estrutural, enzimática (catalisadores biológicos), defesa (anticorpos), transporte, regulação (hormonas).',
                    },
                    {
                        'termo': 'Ácidos nucleicos',
                        'texto': 'Monómeros: nucleótidos. Função: armazenamento e transmissão da informação genética (DNA) e síntese proteica (RNA).',
                    },
                ],
                'dica': (
                    'a água é o **"palco"** onde todas as reações químicas da vida acontecem — sem ela, as '
                    'moléculas não têm onde se encontrar. Já os monómeros são como **peças de LEGO**: os '
                    'glícidos são o "lego de energia rápida", os lípidos o "lego de reserva a longo prazo", '
                    'as proteínas o "lego das ferramentas" (fazem quase tudo) e os ácidos nucleicos o "lego '
                    'com o manual de instruções".'
                ),
            },
        ],
        'sintese_titulo': 'Síntese Final para Memória Rápida',
        'sintese_final': [
            {'label': 'Organização da vida', 'valor': 'Níveis hierárquicos, do átomo à biosfera'},
            {'label': 'Ecossistema', 'valor': 'Biótopo (abiótico) + Biocenose (biótico) · fluxo de energia unidirecional · ciclo de matéria'},
            {'label': 'Biodiversidade', 'valor': '3 níveis — genética, espécies, ecossistemas · ameaçada sobretudo por ação antrópica'},
            {'label': 'Conservação', 'valor': 'In situ (no habitat) e ex situ (fora do habitat)'},
            {'label': 'Célula', 'valor': 'Unidade estrutural e funcional · procariótica (sem núcleo) ou eucariótica (com núcleo)'},
            {'label': 'Moléculas da vida', 'valor': 'Água, glícidos, lípidos, proteínas e ácidos nucleicos — unidade química comum a todos os seres vivos'},
        ],
        'sintese_dica': (
            '*"Do átomo à biosfera, da célula à espécie — a vida organiza-se em camadas, e cada camada só '
            'existe porque a anterior a sustenta."*'
        ),
    },
    'terra-sistema-rochas': {
        'seccoes': [
            {
                'titulo': 'Um Sistema com Quatro Subsistemas',
                'texto': 'A Terra é, aproximadamente, um **sistema fechado**: troca energia com o exterior (recebe energia solar, liberta calor) mas quase não troca matéria. Dentro dela, quatro grandes subsistemas interagem permanentemente.',
                'definicoes': [
                    {
                        'termo': 'Geosfera',
                        'texto': 'A parte sólida (e o núcleo externo líquido): crosta, manto e núcleo.',
                    },
                    {
                        'termo': 'Hidrosfera',
                        'texto': 'Toda a água do planeta: oceanos, rios, lagos, águas subterrâneas e gelo.',
                    },
                    {
                        'termo': 'Atmosfera',
                        'texto': 'A camada gasosa que envolve a Terra (N₂, O₂, CO₂, vapor de água).',
                    },
                    {
                        'termo': 'Biosfera',
                        'texto': 'O conjunto dos seres vivos e dos locais onde vivem.',
                    },
                ],
                'dica': 'pensa nos quatro subsistemas como **quatro colegas de equipa que nunca param de trocar favores**: a água erode a rocha e evapora para o ar; o vento transporta partículas e alimenta os rios; as raízes fraturam as rochas; os vulcões libertam gases para a atmosfera. Ninguém trabalha sozinho.',
            },
            {
                'titulo': 'A Geologia Como Ciência',
                'texto': 'A Geologia estuda a composição, estrutura, processos e história da Terra. Trabalha com escalas de tempo enormes (milhões de anos) e, como muitos processos não podem ser reproduzidos diretamente, recorre a **modelos** e à **atividade experimental**, sempre conscientes das suas limitações (a escala de tempo, as dimensões e os materiais nunca são iguais aos reais). Combina trabalho de campo, laboratorial e tecnologias — é uma **ciência histórica**, que interpreta o passado a partir dos vestígios deixados nas rochas.',
                'dica': 'um geólogo é como um **detetive de uma cena de crime muito, muito antiga**: não pode voltar atrás no tempo para ver o que aconteceu, por isso reconstrói a história a partir das "provas" deixadas nas rochas — e testa as suas hipóteses com modelos, sabendo sempre que um modelo nunca é o real.',
            },
            {
                'titulo': 'Os Três Grandes Grupos de Rochas',
                'texto': 'Uma **rocha** é um agregado natural de um ou mais minerais. Consoante a forma como se formam, distinguem-se três grandes grupos.',
                'definicoes': [
                    {
                        'termo': 'Rochas sedimentares',
                        'texto': 'Formam-se à superfície por meteorização, erosão, transporte e deposição de sedimentos, seguidos de diagénese (ex.: arenito, calcário). Registam paleoambientes, clima e fósseis.',
                    },
                    {
                        'termo': 'Rochas magmáticas',
                        'texto': 'Formam-se por arrefecimento e solidificação do magma, em profundidade (plutónicas) ou à superfície (vulcânicas) (ex.: granito, basalto). Registam atividade magmática.',
                    },
                    {
                        'termo': 'Rochas metamórficas',
                        'texto': 'Resultam da transformação, no estado sólido, de rochas pré-existentes por aumento de pressão e/ou temperatura (ex.: xisto, mármore). Registam colisões de placas.',
                    },
                ],
                'dica': 'pensa nos três grupos como três formas diferentes de "cozinhar" o mesmo material: as sedimentares são **compactadas a frio**, como fazer um bloco de areia molhada; as magmáticas são **derretidas e voltadas a solidificar**, como derreter chocolate e deixá-lo endurecer num novo molde; as metamórficas são **cozinhadas sem derreter**, como assar barro até ficar mais duro, sem alguma vez ser líquido.',
            },
            {
                'titulo': 'O Ciclo das Rochas e os Fósseis',
                'texto': 'Os materiais da Terra são reciclados continuamente: qualquer tipo de rocha pode transformar-se noutro, alimentado pela energia solar (processos externos) e pela energia interna da Terra (processos internos). Os **fósseis**, preservados sobretudo em rochas sedimentares, permitem reconstituir paleoambientes, datar e correlacionar camadas, e estudar a evolução da vida.',
                'passos': [
                    {
                        'titulo': 'Meteorização, erosão e deposição',
                        'texto': 'Rochas à superfície desgastam-se; os sedimentos são transportados e depositados.',
                    },
                    {
                        'titulo': 'Diagénese',
                        'texto': 'Os sedimentos consolidam-se, formando rocha sedimentar.',
                    },
                    {
                        'titulo': 'Metamorfismo',
                        'texto': 'O aumento de pressão e/ou temperatura transforma qualquer rocha em rocha metamórfica.',
                    },
                    {
                        'titulo': 'Fusão e cristalização',
                        'texto': 'Se a temperatura for suficiente, forma-se magma; ao cristalizar, origina rocha magmática.',
                    },
                    {
                        'titulo': 'Soerguimento',
                        'texto': 'Os movimentos tectónicos trazem rochas formadas em profundidade de volta à superfície, e o ciclo recomeça.',
                    },
                ],
                'dica': 'o ciclo das rochas é uma **roda-gigante sem paragem final**: não há um ponto de "chegada" — uma rocha magmática pode ser erodida e virar sedimentar, uma sedimentar pode ser comprimida e virar metamórfica, e qualquer uma pode fundir e voltar a ser magmática. O único bilhete de saída temporária é ser trazida de volta à superfície pelo soerguimento.',
            },
        ],
        'sintese_titulo': 'Síntese Final para Memória Rápida',
        'sintese_final': [
            {
                'label': 'A Terra como sistema',
                'valor': 'Sistema fechado · 4 subsistemas: geosfera, hidrosfera, atmosfera, biosfera',
            },
            {
                'label': 'Geologia',
                'valor': 'Ciência histórica · usa modelos e atividade experimental, com limitações',
            },
            {
                'label': '3 grupos de rochas',
                'valor': 'Sedimentares (superfície), magmáticas (arrefecimento de magma), metamórficas (estado sólido)',
            },
            {
                'label': 'Ciclo litológico',
                'valor': 'Qualquer rocha pode transformar-se noutra · alimentado pela energia solar e interna',
            },
        ],
        'sintese_dica': '*"A Terra recicla tudo — a única pergunta é por que caminho do ciclo cada rocha está a passar agora."*',
    },
    'tempo-e-tectonica': {
        'seccoes': [
            {
                'titulo': 'O Tempo Geológico',
                'texto': 'Datação relativa e absoluta, a semivida dos isótopos, a escala do tempo geológico e a idade da Terra.',
            },
            {
                'titulo': 'Datação Relativa: Pôr os Acontecimentos em Ordem',
                'texto': 'A **datação relativa** ordena acontecimentos geológicos no tempo — o que é mais antigo e o que é mais recente — sem indicar a idade em anos. Baseia-se nos princípios da estratigrafia.',
                'definicoes': [
                    {
                        'termo': 'Sobreposição',
                        'texto': 'Numa sequência de estratos não deformada, um estrato é mais recente do que o que está por baixo.',
                    },
                    {
                        'termo': 'Horizontalidade original',
                        'texto': 'Os sedimentos depositam-se em camadas horizontais; estratos inclinados foram deformados depois.',
                    },
                    {
                        'termo': 'Interseção',
                        'texto': 'Uma estrutura (falha, filão) que corta outras é mais recente do que as estruturas que corta.',
                    },
                    {
                        'termo': 'Inclusão',
                        'texto': 'Os fragmentos de rocha incluídos noutra rocha são mais antigos do que a rocha que os contém.',
                    },
                ],
                'dica': 'pensa numa **sanduíche feita ao longo do tempo**: cada ingrediente novo é sempre colocado por cima dos anteriores (sobreposição) — nunca por baixo. Se encontrares um garfo espetado a direito através de todas as camadas (interseção), sabes que o garfo chegou depois da sanduíche estar feita.',
            },
            {
                'titulo': 'Discordâncias e Fósseis de Idade vs. Fácies',
                'texto': 'Uma **discordância** é uma superfície de erosão ou de não deposição que separa dois conjuntos de estratos, representando uma lacuna no registo geológico. Os fósseis também ajudam a datar e a interpretar o passado, mas de duas formas diferentes.',
                'definicoes': [
                    {
                        'termo': 'Fóssil de idade (estratigráfico)',
                        'texto': 'Existiu durante pouco tempo mas com ampla distribuição geográfica — usado para datar e correlacionar estratos (ex.: trilobites, amonites).',
                    },
                    {
                        'termo': 'Fóssil de fácies',
                        'texto': 'Existiu durante muito tempo mas viveu em ambientes muito específicos — usado para reconstituir paleoambientes (ex.: corais, que indicam mares quentes e pouco profundos).',
                    },
                ],
                'dica': 'o fóssil de idade é como um **selo de correio com a data bem impressa**: não importa onde apareça, diz-te quando foi usado. O fóssil de fácies é como um **casaco de inverno**: não te diz o ano, mas diz-te logo que tipo de clima (ambiente) existia.',
            },
            {
                'titulo': 'Datação Absoluta: A Idade em Números',
                'texto': 'A **datação absoluta** atribui uma idade numérica a uma rocha, com base no **decaimento radioativo**: um isótopo-pai instável transforma-se em isótopo-filho estável a um ritmo constante. A **semivida** é o tempo necessário para que metade dos átomos do isótopo-pai se transforme. Datam-se sobretudo rochas **magmáticas**, porque o "relógio" só começa a contar quando os minerais cristalizam.',
                'definicoes': [
                    {
                        'termo': 'Urânio-238 → Chumbo-206',
                        'texto': 'Semivida ≈ 4500 Ma — usado em rochas muito antigas.',
                    },
                    {
                        'termo': 'Potássio-40 → Árgon-40',
                        'texto': 'Semivida ≈ 1300 Ma — usado em rochas vulcânicas.',
                    },
                    {
                        'termo': 'Carbono-14 → Azoto-14',
                        'texto': 'Semivida ≈ 5730 anos — usado em restos orgânicos com menos de ≈50 000 anos.',
                    },
                ],
                'dica': 'a semivida é como o **tempo que demora metade do gelo de um copo a derreter**: não interessa se o copo está ao sol ou à sombra (temperatura e pressão não afetam o decaimento) — o ritmo é sempre o mesmo. Depois de uma semivida, resta metade do pai; depois de duas, resta um quarto; depois de três, um oitavo — é sempre a metade do que restava, nunca a metade do total inicial.',
            },
            {
                'titulo': 'A Escala do Tempo Geológico e a Idade da Terra',
                'texto': 'A história da Terra divide-se em **éons → eras → períodos → épocas**, cujos limites correspondem sobretudo a extinções em massa e ao aparecimento de novos grupos de seres vivos. A Terra tem cerca de **4600 Ma**, estimados pela datação de meteoritos e rochas lunares — as rochas terrestres mais antigas são mais "novas" porque a superfície primitiva foi destruída pela tectónica e pela erosão.',
                'definicoes': [
                    {
                        'termo': 'Paleozoico (541-252 Ma)',
                        'texto': 'Explosão da vida no Câmbrico, trilobites, formação da Pangeia; termina com a maior extinção em massa.',
                    },
                    {
                        'termo': 'Mesozoico (252-66 Ma)',
                        'texto': 'Dinossauros e amonites; fragmentação da Pangeia; termina com a extinção K-Pg (impacto de asteroide).',
                    },
                    {
                        'termo': 'Cenozoico (66 Ma-atualidade)',
                        'texto': 'Diversificação dos mamíferos; aparecimento do género Homo; glaciações quaternárias.',
                    },
                ],
                'dica': 'pensa na escala do tempo geológico como os **capítulos de um livro muito, muito longo**: cada novo capítulo (era) começa quase sempre depois de um grande acontecimento dramático — uma extinção em massa que "fecha" o capítulo anterior e abre espaço para novos protagonistas na história da vida.',
            },
            {
                'titulo': 'Tectónica de Placas',
                'texto': 'De Wegener a Hess — como a Terra passou de fixista a mobilista, e os três tipos de limites de placas.',
            },
            {
                'titulo': 'Catastrofismo, Uniformitarismo e Atualismo',
                'texto': 'Ao longo da história da Geologia, diferentes correntes tentaram explicar como a Terra mudou ao longo do tempo.',
                'definicoes': [
                    {
                        'termo': 'Catastrofismo',
                        'texto': 'A história da Terra foi marcada por catástrofes súbitas e violentas (Georges Cuvier).',
                    },
                    {
                        'termo': 'Uniformitarismo (atualismo)',
                        'texto': 'As leis naturais são constantes no tempo e no espaço; os processos atuais, lentos e graduais, explicam o passado — "o presente é a chave do passado" (Hutton, Lyell).',
                    },
                    {
                        'termo': 'Neocatastrofismo',
                        'texto': 'Visão atual: a Terra evoluiu sobretudo de forma gradual, mas também com acontecimentos catastróficos pontuais (impactos, grandes erupções).',
                    },
                ],
                'dica': 'o atualismo é como **aprender a história de uma casa olhando para como ela é usada hoje**: se hoje a maré deixa marcas de ondulação na areia da praia, e encontras essas mesmas marcas numa rocha antiga, podes concluir que essa rocha se formou também numa praia.',
            },
            {
                'titulo': 'A Deriva Continental de Wegener',
                'texto': 'Alfred Wegener propôs, em 1912-15, que os continentes estiveram unidos num supercontinente, a **Pangeia**, rodeado por um oceano único, a Pantalassa, e que depois derivaram até às posições atuais.',
                'definicoes': [
                    {
                        'termo': 'Argumento morfológico',
                        'texto': 'O encaixe das linhas de costa, como entre a América do Sul e a África.',
                    },
                    {
                        'termo': 'Argumento paleontológico',
                        'texto': 'Fósseis dos mesmos seres vivos (ex.: Mesosaurus, Glossopteris) em continentes hoje separados por oceanos.',
                    },
                    {
                        'termo': 'Argumento litológico',
                        'texto': 'Continuidade de cadeias montanhosas e formações rochosas com a mesma idade dos dois lados do Atlântico.',
                    },
                    {
                        'termo': 'Argumento paleoclimático',
                        'texto': 'Vestígios de glaciações antigas em regiões hoje tropicais.',
                    },
                ],
                'dica': 'Wegener tinha **as provas mas faltava-lhe o motor**: é como encontrares um puzzle que encaixa perfeitamente e ter a certeza de que as peças pertencem juntas, mas não conseguires explicar que máquina as moveu até lá. Por isso a teoria foi rejeitada na altura — faltava um mecanismo fisicamente credível.',
            },
            {
                'titulo': 'Expansão dos Fundos Oceânicos',
                'texto': 'Nas décadas seguintes, Harry Hess mostrou que nas **dorsais oceânicas** se forma nova crosta oceânica a partir de magma que ascende, afastando-se para ambos os lados. A crosta é depois destruída nas **fossas oceânicas** (subducção) — por isso a Terra não aumenta de tamanho. Esta descoberta finalmente deu um mecanismo ao mobilismo de Wegener.',
                'dica': 'as dorsais e as fossas são como uma **passadeira rolante gigante**: a crosta nasce num ponto (a dorsal), "anda" ao longo do fundo oceânico, e é reciclada noutro ponto (a fossa) — por isso nenhuma rocha do fundo oceânico tem mais de ≈200 Ma, muito menos do que os continentes.',
            },
            {
                'titulo': 'A Teoria da Tectónica de Placas',
                'texto': 'A litosfera está dividida em placas que se deslocam sobre a astenosfera. A maior parte da atividade sísmica, vulcânica e de formação de montanhas concentra-se nos limites das placas.',
                'definicoes': [
                    {
                        'termo': 'Limite divergente (construtivo)',
                        'texto': 'Placas afastam-se; magma basáltico ascende; nova litosfera oceânica; sismos pouco profundos (dorsais, riftes).',
                    },
                    {
                        'termo': 'Limite convergente (destrutivo)',
                        'texto': 'Placas aproximam-se; subducção (se houver crosta oceânica) ou colisão (crosta continental-continental); vulcanismo explosivo, sismos profundos, grandes cadeias montanhosas.',
                    },
                    {
                        'termo': 'Limite transformante (conservativo)',
                        'texto': 'Placas deslizam lateralmente; não há criação nem destruição de litosfera; sismos frequentes (ex.: Falha de Santo André).',
                    },
                ],
                'dica': 'pensa nos três limites como três formas de **duas pessoas se cruzarem num corredor**: afastam-se e abre-se espaço novo (divergente); chocam de frente e uma tem de ceder, indo por baixo ou a colidir (convergente); ou passam lado a lado, roçando-se (transformante).',
            },
            {
                'titulo': 'Portugal e a Tectónica de Placas',
                'texto': 'O arquipélago dos **Açores** situa-se na junção tripla entre as placas Norte-Americana, Euroasiática e Africana, atravessado pela Dorsal Médio-Atlântica — daí a sua forte atividade sísmica e vulcânica. Portugal continental está próximo da fronteira Euroasiática-Africana (zona de fratura Açores-Gibraltar), o que explica a sua sismicidade.',
                'dica': 'os Açores estão literalmente **no meio do cruzamento de três estradas** — por isso é natural que lá aconteça mais "trânsito" geológico (sismos e vulcões) do que em qualquer outra zona de Portugal.',
            },
        ],
        'sintese_titulo': 'Síntese Final para Memória Rápida',
        'sintese_final': [
            {
                'label': 'Datação relativa',
                'valor': 'Ordena acontecimentos (sem anos) · princípios da estratigrafia',
            },
            {
                'label': 'Datação absoluta',
                'valor': 'Idade numérica · decaimento radioativo · semivida · datam-se sobretudo rochas magmáticas',
            },
            {
                'label': 'Fóssil de idade vs. fácies',
                'valor': 'Idade: curta duração, ampla distribuição → datar. Fácies: longa duração, ambiente específico → reconstituir paleoambiente',
            },
            {
                'label': 'Idade da Terra',
                'valor': '≈ 4600 Ma, estimada por datação de meteoritos e rochas lunares',
            },
            {
                'label': 'Wegener',
                'valor': 'Deriva continental · 4 evidências · sem mecanismo credível → rejeitada',
            },
            {
                'label': 'Hess',
                'valor': 'Expansão dos fundos oceânicos · deu o mecanismo à deriva continental',
            },
            {
                'label': '3 limites de placas',
                'valor': 'Divergente (afasta), convergente (aproxima/subducção), transformante (desliza)',
            },
            {
                'label': 'Portugal',
                'valor': 'Açores: junção tripla de placas · Continente: perto da fronteira Euroasiática-Africana',
            },
        ],
        'sintese_dica': '*"Primeiro aprendemos a ler o relógio das rochas — depois percebemos que, afinal, elas também andam."*',
    },
    'origem-e-interior-da-terra': {
        'seccoes': [
            {
                'titulo': 'Origem da Terra e do Sistema Solar',
                'texto': 'A hipótese nebular, a diferenciação da Terra em camadas, e o que os meteoritos revelam sobre o Sistema Solar.',
            },
            {
                'titulo': 'A Hipótese Nebular',
                'texto': 'Há cerca de 4600 Ma, uma **nébula solar** (nuvem de gás e poeira em rotação) contraiu-se por ação da gravidade, aqueceu e achatou-se num disco. No centro formou-se o Sol; no disco, as partículas chocaram e aglomeraram-se por **acreção**, originando planetesimais e depois protoplanetas.',
                'definicoes': [
                    {
                        'termo': 'Planetas telúricos',
                        'texto': 'Perto do Sol, só condensaram materiais com ponto de fusão elevado (silicatos, metais): Mercúrio, Vénus, Terra, Marte — pequenos, rochosos e densos.',
                    },
                    {
                        'termo': 'Planetas gigantes',
                        'texto': 'Longe do Sol, condensaram também gelos e acumularam-se gases: Júpiter, Saturno, Úrano, Neptuno — grandes, pouco densos.',
                    },
                ],
                'dica': 'pensa na nébula solar como uma **pizza giratória de massa e ingredientes**: ao girar e achatar, os ingredientes mais "pesados" (metais, silicatos) ficam mais perto do centro quente, e os mais "leves e voláteis" (gelos, gases) só sobrevivem nas bordas frias.',
            },
            {
                'titulo': 'Diferenciação da Terra',
                'texto': 'A Terra primitiva aqueceu muito devido aos impactos, à compressão gravitacional e ao decaimento radioativo, ficando em grande parte fundida. Os materiais separaram-se por densidade: os mais densos (ferro, níquel) afundaram e formaram o **núcleo**; os menos densos (silicatos) formaram o **manto** e a **crosta**. A **Lua** ter-se-á formado por um impacto gigante de um corpo do tamanho de Marte com a Terra primitiva.',
                'dica': 'a diferenciação é como um **frasco de vinagrete que acabaste de agitar e deixas repousar**: o óleo (menos denso) sobe para cima, e o vinagre (mais denso) afunda — só que aqui falamos de ferro a afundar para o centro, e silicatos "flutuando" por cima.',
            },
            {
                'titulo': 'Atividade Geológica e Dimensão dos Planetas',
                'texto': 'Quanto maior o planeta, mais calor interno conserva (menor razão superfície/volume) e mais tempo se mantém geologicamente ativo. A Terra mantém tectónica de placas e vulcanismo; a Lua e Mercúrio, pequenos, arrefeceram depressa e as suas superfícies estão cobertas de crateras de impacto antigas, sem erosão nem tectónica que as apague.',
                'dica': 'pensa numa **batata grande e numa batata pequena, ambas acabadas de sair do forno**: a pequena arrefece muito mais depressa do que a grande, porque tem mais superfície exposta em relação ao seu volume. É por isso que a Lua "arrefeceu" geologicamente muito antes da Terra.',
            },
            {
                'titulo': 'Meteoritos: Mensageiros do Sistema Solar',
                'texto': 'Os meteoritos são fragmentos de asteroides que atingem a Terra, dando informação sobre a origem do Sistema Solar e sobre o interior do nosso planeta.',
                'definicoes': [
                    {
                        'termo': 'Sideritos (férreos)',
                        'texto': 'Ferro e níquel — composição semelhante à do núcleo terrestre.',
                    },
                    {
                        'termo': 'Aerólitos — condritos',
                        'texto': 'Silicatos com côndrulos, não diferenciados — material primitivo do Sistema Solar, usado para datar a idade da Terra.',
                    },
                    {
                        'termo': 'Aerólitos — acondritos',
                        'texto': 'Silicatos sem côndrulos, diferenciados — composição semelhante à da crosta/manto.',
                    },
                ],
                'dica': 'os meteoritos são como **amostras grátis de um planeta que nunca conseguimos visitar por inteiro**: como não podemos perfurar os 6370 km até ao centro da Terra, usamos os sideritos como a melhor pista possível sobre do que é feito o nosso próprio núcleo.',
            },
            {
                'titulo': 'O Interior da Terra',
                'texto': 'Métodos diretos e indiretos, descontinuidades sísmicas, e os modelos químico e físico da estrutura interna.',
            },
            {
                'titulo': 'Métodos Diretos e Indiretos',
                'texto': 'Como ninguém consegue viajar ao centro da Terra, o conhecimento do seu interior vem de dois tipos de métodos.',
                'definicoes': [
                    {
                        'termo': 'Métodos diretos',
                        'texto': 'Observação de afloramentos, minas, sondagens (a mais profunda, em Kola, chegou a ≈12 km — menos de 0,2% do raio da Terra) e xenólitos. Só dão acesso a uma camada muito superficial.',
                    },
                    {
                        'termo': 'Métodos indiretos',
                        'texto': 'Sismologia (o mais importante), gravimetria, geomagnetismo e geotermia — baseiam-se na interpretação de dados físicos e permitem inferir todo o interior do planeta.',
                    },
                ],
                'dica': 'os métodos diretos são como **espreitar por um buraco de fechadura**: veem muito pouco, mas com total certeza do que veem. Os indiretos são como **ouvir o som que vem de dentro de uma caixa fechada**: dão-te uma ideia de todo o interior, mas sempre por interpretação, nunca por observação direta.',
            },
            {
                'titulo': 'Geotermia',
                'texto': 'O calor interno provém do calor residual da formação da Terra e do decaimento de isótopos radioativos. O **gradiente geotérmico** (≈30°C por km na crosta) diminui em profundidade — caso contrário, o interior estaria totalmente fundido. O calor é transferido por condução (litosfera) e por convecção (manto e núcleo externo).',
                'dica': 'pensa no gradiente geotérmico como o **calor de um forno logo ao abrir a porta**: sentes muito calor perto da porta (crosta), mas esse aumento não é constante até ao fundo do forno — se fosse, nada lá dentro sobreviveria.',
            },
            {
                'titulo': 'Descontinuidades e o Modelo Químico',
                'texto': 'Quando as ondas sísmicas mudam de velocidade bruscamente, essas superfícies chamam-se **descontinuidades** e marcam o limite entre camadas de composição química diferente.',
                'definicoes': [
                    {
                        'termo': 'Moho (Mohorovičić)',
                        'texto': 'Separa a crosta do manto. As ondas P e S aumentam de velocidade.',
                    },
                    {
                        'termo': 'Gutenberg',
                        'texto': 'Separa o manto do núcleo (≈2900 km). As ondas S deixam de se propagar — revelou que o núcleo externo é líquido.',
                    },
                    {
                        'termo': 'Lehmann',
                        'texto': 'Separa o núcleo externo do núcleo interno (≈5150 km). As ondas P voltam a aumentar de velocidade — núcleo interno sólido.',
                    },
                ],
                'dica': 'a **zona de sombra sísmica**, entre 103° e 143° de distância angular ao epicentro, é o maior "prova de crime" da Geologia: a ausência de ondas S para lá dos 103° foi o que revelou que o núcleo externo tinha de ser líquido — porque as ondas S simplesmente não atravessam líquidos.',
            },
            {
                'titulo': 'O Modelo Físico: Litosfera, Astenosfera, Mesosfera',
                'texto': 'Além do modelo químico (crosta-manto-núcleo), existe o **modelo físico**, baseado no comportamento mecânico dos materiais.',
                'definicoes': [
                    {
                        'termo': 'Litosfera',
                        'texto': 'Rígida; crosta + manto superior; ≈100 km de espessura; dividida em placas.',
                    },
                    {
                        'termo': 'Astenosfera',
                        'texto': 'Plástica, parcialmente fundida (1-10%); corresponde à zona de baixa velocidade sísmica (≈100-250 km).',
                    },
                    {
                        'termo': 'Mesosfera',
                        'texto': 'Sólida e rígida, devido à elevada pressão, até ≈2900 km.',
                    },
                    {
                        'termo': 'Núcleo externo e interno',
                        'texto': 'Externo: líquido (2900-5150 km). Interno: sólido apesar de ≈5000-6000°C, devido à pressão muito elevada.',
                    },
                ],
                'dica': 'não confundas os dois modelos: o **químico** pergunta "do que é feito?" (crosta, manto, núcleo); o **físico** pergunta "como se comporta?" (rígido ou plástico). A astenosfera, por exemplo, é quimicamente manto, mas fisicamente comporta-se de forma diferente do resto do manto — daí ter um nome próprio só para o comportamento.',
            },
            {
                'titulo': 'Geomagnetismo, Paleomagnetismo e Isostasia',
                'texto': 'O campo magnético da Terra é gerado pelos movimentos do ferro líquido no núcleo externo (efeito de dínamo) e sofre **inversões de polaridade** ao longo do tempo. O **paleomagnetismo** estuda esse registo fixado nas rochas basálticas, e foi uma das maiores provas da expansão dos fundos oceânicos. A **isostasia** é o equilíbrio entre a litosfera e a astenosfera, semelhante à flutuação de gelo na água: a erosão de uma montanha faz a litosfera subir lentamente; a acumulação de gelo ou sedimentos faz-a afundar.',
                'dica': 'a isostasia é como um **barco a perder carga**: tira peso (erosão) e o barco sobe um pouco na água; acrescenta peso (sedimentos, gelo) e o barco afunda um pouco. É por isso que a Escandinávia continua a subir lentamente desde que os glaciares da última glaciação derreteram.',
            },
        ],
        'sintese_titulo': 'Síntese Final para Memória Rápida',
        'sintese_final': [
            {
                'label': 'Hipótese nebular',
                'valor': 'Nébula solar → Sol + acreção de planetesimais, há ≈4600 Ma',
            },
            {
                'label': 'Telúricos vs. gigantes',
                'valor': 'Perto do Sol: pequenos e densos. Longe do Sol: grandes e gasosos/gelados',
            },
            {
                'label': 'Diferenciação',
                'valor': 'Separação por densidade: núcleo (Fe, Ni) · manto e crosta (silicatos)',
            },
            {
                'label': 'Meteoritos',
                'valor': 'Sideritos ≈ núcleo · condritos = material primitivo, usados para datar a Terra',
            },
            {
                'label': 'Métodos',
                'valor': 'Diretos (observação, só superfície) · Indiretos (interpretação, todo o interior — sismologia é o principal)',
            },
            {
                'label': 'Descontinuidades',
                'valor': 'Moho (crosta/manto) · Gutenberg (manto/núcleo, S desaparecem) · Lehmann (núcleo externo/interno)',
            },
            {
                'label': 'Modelo químico',
                'valor': 'Crosta → manto → núcleo',
            },
            {
                'label': 'Modelo físico',
                'valor': 'Litosfera (rígida) → astenosfera (plástica) → mesosfera (rígida) → núcleo externo (líquido) → núcleo interno (sólido)',
            },
        ],
        'sintese_dica': '*"A Terra organizou-se em camadas mal nasceu — e é exatamente essa estrutura em camadas que ainda hoje tentamos “ver” sem lá chegar."*',
    },
    'vulcoes-e-sismos': {
        'seccoes': [
            {
                'titulo': 'Vulcanologia',
                'texto': 'Magma, lava, tipos de vulcanismo, materiais vulcânicos, e os riscos e benefícios do vulcanismo em Portugal.',
            },
            {
                'titulo': 'Magma, Lava e a Estrutura de um Vulcão',
                'texto': 'O **magma** é uma mistura de material rochoso fundido, gases dissolvidos e cristais em suspensão; quando chega à superfície e perde gases, chama-se **lava**. Uma **caldeira** é uma depressão de grandes dimensões formada pelo colapso do topo de um vulcão após o esvaziamento da câmara magmática (ex.: Sete Cidades e Furnas, São Miguel).',
                'definicoes': [
                    {
                        'termo': 'Câmara magmática',
                        'texto': 'Reservatório de magma em profundidade.',
                    },
                    {
                        'termo': 'Chaminé',
                        'texto': 'Conduta por onde o magma ascende.',
                    },
                    {
                        'termo': 'Cratera',
                        'texto': 'Abertura no topo do vulcão.',
                    },
                    {
                        'termo': 'Cone vulcânico',
                        'texto': 'Acumulação dos materiais emitidos.',
                    },
                ],
                'dica': 'um vulcão é como uma **garrafa de refrigerante agitada**: a câmara magmática é a garrafa cheia de gás sob pressão, e a chaminé é o gargalo por onde tudo escapa quando a tampa (a resistência da rocha) finalmente cede.',
            },
            {
                'titulo': 'Tipos de Magma e de Atividade Vulcânica',
                'texto': 'O comportamento de uma erupção depende sobretudo da **viscosidade** do magma, que aumenta com o teor de sílica e diminui com a temperatura. Magma mais viscoso retém mais gases, tornando a erupção mais explosiva.',
                'definicoes': [
                    {
                        'termo': 'Basáltico (45-52% sílica)',
                        'texto': 'Pouco viscoso; atividade efusiva — escoadas de lava fluida, vulcões em escudo.',
                    },
                    {
                        'termo': 'Andesítico (52-65% sílica)',
                        'texto': 'Viscosidade intermédia; atividade mista — estratovulcões, alternância de escoadas e explosões.',
                    },
                    {
                        'termo': 'Riolítico (>65% sílica)',
                        'texto': 'Muito viscoso; atividade explosiva — muitos piroclastos, nuvens ardentes (das manifestações mais perigosas).',
                    },
                ],
                'dica': 'a viscosidade é como a diferença entre **mel quente e mel gelado**: quanto mais sílica (mais "frio e espesso"), mais os gases ficam presos lá dentro, como bolhas presas num mel grosso — até que a pressão se torna demasiada e tudo explode de uma vez.',
            },
            {
                'titulo': 'Materiais Vulcânicos',
                'texto': 'Uma erupção pode libertar diferentes tipos de materiais.',
                'definicoes': [
                    {
                        'termo': 'Lava encordoada (pahoehoe)',
                        'texto': 'Lava basáltica fluida, superfície lisa ou com aspeto de cordas.',
                    },
                    {
                        'termo': 'Lava em almofada (pillow lava)',
                        'texto': 'Lava que solidifica rapidamente debaixo de água, típica das dorsais.',
                    },
                    {
                        'termo': 'Piroclastos',
                        'texto': 'Fragmentos projetados, classificados por tamanho: cinzas (<2 mm), lapili (2-64 mm), bombas e blocos (>64 mm).',
                    },
                ],
                'dica': 'imagina a diferença entre **chocolate derretido a escorrer de uma colher** (lava encordoada, fluida) e **pipocas a saltar de uma panela** (piroclastos, fragmentos sólidos projetados pelo ar).',
            },
            {
                'titulo': 'Vulcanismo Secundário e Vulcões em Portugal',
                'texto': 'Mesmo sem erupção, o calor de um magma em arrefecimento produz manifestações como **fumarolas** (gases), **géiseres** (jatos intermitentes de água quente) e **nascentes termais**. Os **Açores** são a única região portuguesa com vulcanismo ativo — ex.: erupção dos Capelinhos (Faial, 1957-58) e da Serreta (Terceira, 1998-2001). No continente há apenas vestígios antigos, como o Complexo Vulcânico de Lisboa (≈70 Ma).',
                'dica': 'o vulcanismo secundário é o **rescaldo de uma fogueira que já não tem chamas mas ainda está quente**: já não há erupção, mas o calor ainda escapa por gases e água aquecida.',
            },
            {
                'titulo': 'Riscos e Benefícios do Vulcanismo',
                'texto': 'O vulcanismo é simultaneamente risco e recurso, sobretudo nos Açores.',
                'definicoes': [
                    {
                        'termo': 'Riscos',
                        'texto': 'Escoadas de lava, nuvens ardentes, piroclastos, lahars, gases tóxicos, sismos e tsunamis associados.',
                    },
                    {
                        'termo': 'Benefícios',
                        'texto': 'Solos férteis, energia geotérmica (Ribeira Grande, São Miguel), águas termais, turismo, materiais de construção.',
                    },
                    {
                        'termo': 'Minimização do risco',
                        'texto': 'Monitorização (sismógrafos, GPS, análise de gases), cartas de risco, ordenamento do território, planos de emergência.',
                    },
                ],
                'dica': 'lembra-te da fórmula: **Risco = Perigosidade × Vulnerabilidade × Exposição**. Uma zona muito perigosa mas totalmente desabitada tem, na prática, baixo risco — porque não há pessoas nem bens expostos.',
            },
            {
                'titulo': 'Sismologia',
                'texto': 'Ondas sísmicas, intensidade e magnitude, tsunamis, e o risco sísmico em Portugal.',
            },
            {
                'titulo': 'O Que é um Sismo',
                'texto': 'Um **sismo** é um movimento vibratório brusco da superfície terrestre, resultante da libertação súbita de energia acumulada nas rochas quando estas fraturam. Pela **teoria do ressalto elástico**, as rochas deformam-se elasticamente e acumulam energia até a tensão ultrapassar a sua resistência — aí fraturam e regressam bruscamente à forma inicial, libertando a energia sob a forma de ondas sísmicas.',
                'definicoes': [
                    {
                        'termo': 'Hipocentro (foco)',
                        'texto': 'Local, em profundidade, onde se inicia a rutura.',
                    },
                    {
                        'termo': 'Epicentro',
                        'texto': 'Ponto da superfície na vertical do hipocentro, onde a intensidade é geralmente maior.',
                    },
                ],
                'dica': 'pensa numa **régua de plástico que vais dobrando cada vez mais**: ela armazena energia elástica até que, de repente, parte — e essa libertação súbita de energia, em forma de vibração, é exatamente o que acontece numa rocha durante um sismo.',
            },
            {
                'titulo': 'As Ondas Sísmicas',
                'texto': 'A energia de um sismo propaga-se através de vários tipos de ondas, cada uma com características próprias.',
                'definicoes': [
                    {
                        'termo': 'Ondas P (primárias)',
                        'texto': 'Longitudinais; propagam-se em sólidos, líquidos e gases; as mais rápidas — as primeiras a chegar.',
                    },
                    {
                        'termo': 'Ondas S (secundárias)',
                        'texto': 'Transversais; só se propagam em sólidos; mais lentas do que as P.',
                    },
                    {
                        'termo': 'Ondas L e R (superficiais)',
                        'texto': 'Formam-se quando as ondas de volume chegam à superfície; as mais lentas, mas de maior amplitude — as mais destrutivas.',
                    },
                ],
                'dica': 'pensa numa corrida de estafetas: **P chega primeiro** (mais rápida, atravessa tudo), **S chega a seguir** (mais lenta, só em sólidos — não consegue "nadar" em líquidos), e **L e R chegam por último**, mas são as que fazem mais estragos, como os últimos corredores que, por serem mais pesados, abanam mais o chão todo por onde passam.',
            },
            {
                'titulo': 'Registo, Intensidade e Magnitude',
                'texto': 'Os sismógrafos registam as vibrações num sismograma. O **intervalo de tempo entre a chegada das ondas P e S** aumenta com a distância ao epicentro, e com dados de pelo menos três estações é possível localizá-lo por triangulação.',
                'definicoes': [
                    {
                        'termo': 'Intensidade',
                        'texto': 'Mede os efeitos de um sismo num local (escala EMS-98); varia de local para local, diminuindo em geral com a distância ao epicentro.',
                    },
                    {
                        'termo': 'Magnitude',
                        'texto': 'Mede a energia libertada no foco (escala de Richter); um único valor por sismo. Cada grau a mais representa ≈10× mais amplitude e ≈30× mais energia.',
                    },
                ],
                'dica': 'não confundas: a **magnitude** é como o volume de uma coluna de som na origem (um único número); a **intensidade** é como esse som é realmente ouvido em diferentes salas da casa — mais alto perto da coluna, mais fraco longe dela.',
            },
            {
                'titulo': 'Tsunamis e o Risco Sísmico em Portugal',
                'texto': 'Um **tsunami** é uma onda de grande comprimento de onda gerada por deslocamento súbito de grandes volumes de água, sobretudo por sismos com epicentro no mar. Em Portugal, o maior risco vem dos sismos interplacas associados à zona de fratura Açores-Gibraltar — como o **sismo de 1 de novembro de 1755**, que destruiu grande parte de Lisboa e gerou um tsunami. Os Açores são a região de maior atividade sísmica do país.',
                'dica': 'não é possível prever quando um sismo vai acontecer — mas é possível reduzir o risco: construção antissísmica, ordenamento do território, monitorização, e o lema de um plano de emergência bem treinado: **"Baixar, Proteger, Aguardar."**',
            },
        ],
        'sintese_titulo': 'Síntese Final para Memória Rápida',
        'sintese_final': [
            {
                'label': 'Regra de ouro',
                'valor': 'Mais sílica → mais viscosidade → mais gases retidos → erupção mais explosiva',
            },
            {
                'label': '3 tipos de magma',
                'valor': 'Basáltico (efusivo) · Andesítico (misto) · Riolítico (explosivo)',
            },
            {
                'label': 'Distribuição',
                'valor': 'Dorsais/riftes (basáltico) · zonas de subducção (andesítico-riolítico) · pontos quentes (basáltico)',
            },
            {
                'label': 'Portugal',
                'valor': 'Açores: vulcanismo ativo. Continente: vestígios antigos (Lisboa, Monchique, Sintra)',
            },
            {
                'label': 'Origem',
                'valor': 'Libertação súbita de energia · teoria do ressalto elástico',
            },
            {
                'label': 'Ondas',
                'valor': 'P (rápidas, todos os meios) → S (só sólidos) → L/R (superficiais, mais destrutivas)',
            },
            {
                'label': 'Intensidade vs. magnitude',
                'valor': 'Intensidade = efeitos locais (EMS-98) · Magnitude = energia no foco (Richter, valor único)',
            },
            {
                'label': 'Portugal',
                'valor': 'Sismo de 1755 (interplacas) · Açores: maior atividade sísmica do país',
            },
        ],
        'sintese_dica': '*"Vulcões e sismos são a mesma energia interna da Terra, só que escapando por portas diferentes."*',
    },
    'riscos-ordenamento-territorio': {
        'seccoes': [
            {
                'titulo': 'Bacias Hidrográficas: Cheias e Inundações',
                'texto': 'Uma **bacia hidrográfica** é a área drenada por um rio principal e pelos seus afluentes, limitada por linhas de cumeada. O **leito maior (de cheia)**, ocupado pelo rio durante as cheias, tem solos férteis que atraem a ocupação humana — mas construir lá agrava o risco de inundação.',
                'definicoes': [
                    {
                        'termo': 'Causas agravantes',
                        'texto': 'Construção em leitos de cheia, impermeabilização dos solos (urbanização), desflorestação, canalização dos leitos.',
                    },
                    {
                        'termo': 'Medidas',
                        'texto': 'Não construir em leitos de cheia, preservar a vegetação ribeirinha, criar bacias de retenção, sistemas de alerta.',
                    },
                ],
                'dica': 'o leito maior é como a **faixa de rodagem de emergência de uma autoestrada**: na maior parte do tempo está vazio e parece "terreno livre", mas existe precisamente para o rio a usar quando precisa de mais espaço — construir lá é como estacionar nessa faixa.',
            },
            {
                'titulo': 'Zonas Costeiras: Arribas e Praias',
                'texto': 'As **costas de arriba** recuam quando o mar escava a base (sapa), fazendo a parte superior desmoronar. As **costas baixas** (praias e dunas) dependem da **deriva litoral** — o transporte de areia ao longo da costa (em Portugal, predominantemente de norte para sul) — para se manterem abastecidas de sedimento.',
                'definicoes': [
                    {
                        'termo': 'Esporões',
                        'texto': 'Retêm areia a montante, mas agravam a erosão a jusante (a sul, em Portugal).',
                    },
                    {
                        'termo': 'Paredões e enrocamentos',
                        'texto': 'Protegem a zona construída, mas refletem a energia das ondas, que arrastam a areia da praia.',
                    },
                    {
                        'termo': 'Causas da erosão costeira',
                        'texto': 'Subida do nível do mar, menos sedimento vindo dos rios (barragens), destruição de dunas, obras mal planeadas.',
                    },
                ],
                'dica': 'os esporões resolvem o problema de um lado da praia **à custa de o empurrar para o vizinho do lado de baixo** — como tirar areia de um monte para a pôr noutro: o primeiro fica satisfeito, mas o de baixo fica com ainda menos.',
            },
            {
                'titulo': 'Zonas de Vertente: Movimentos em Massa',
                'texto': 'Os **movimentos em massa** são deslocações de solo ou rocha pelas vertentes, por ação da gravidade.',
                'definicoes': [
                    {
                        'termo': 'Desabamentos',
                        'texto': 'Queda livre de blocos em vertentes muito inclinadas.',
                    },
                    {
                        'termo': 'Deslizamentos',
                        'texto': 'O material desloca-se ao longo de uma superfície de rutura.',
                    },
                    {
                        'termo': 'Fluxos',
                        'texto': 'Material saturado de água comporta-se como um fluido (escoadas de lama).',
                    },
                    {
                        'termo': 'Reptação',
                        'texto': 'Movimento muito lento do solo (visível em árvores e postes inclinados).',
                    },
                ],
                'dica': 'a água é o grande "traidor" das vertentes: chuva intensa **aumenta o peso do solo e reduz o atrito** entre partículas — como tentar manter-te de pé numa rampa seca (fácil) versus numa rampa encharcada de sabão (impossível).',
            },
            {
                'titulo': 'Ordenamento do Território',
                'texto': 'O ordenamento do território organiza a ocupação do espaço de forma a compatibilizar as atividades humanas com os riscos e os recursos naturais, através de instrumentos como os **Planos Diretores Municipais (PDM)**, a **Reserva Ecológica Nacional (REN)** e a **Reserva Agrícola Nacional (RAN)**.',
                'dica': 'em todos os riscos geológicos deste capítulo há um padrão comum: **prevenir pelo ordenamento é sempre mais eficaz e mais barato do que remediar depois com obras** — seja em leitos de cheia, em arribas, em dunas ou em vertentes instáveis.',
            },
        ],
        'sintese_titulo': 'Síntese Final para Memória Rápida',
        'sintese_final': [
            {
                'label': 'Bacias hidrográficas',
                'valor': 'Leito maior (cheia) fértil mas de risco · urbanização agrava cheias',
            },
            {
                'label': 'Zonas costeiras',
                'valor': 'Arribas recuam por sapa · deriva litoral alimenta praias e dunas',
            },
            {
                'label': 'Zonas de vertente',
                'valor': 'Desabamentos, deslizamentos, fluxos, reptação · água é o principal fator agravante',
            },
            {
                'label': 'Prevenção',
                'valor': 'Ordenamento do território (PDM, REN, RAN) é mais eficaz do que obras de remediação',
            },
        ],
        'sintese_dica': '*"O risco geológico quase sempre mora onde o ser humano decidiu construir — não onde a natureza decidiu agir."*',
    },
    'minerais': {
        'seccoes': [
            {
                'titulo': 'O Que é um Mineral',
                'texto': 'Um **mineral** é um sólido natural, geralmente inorgânico, com composição química definida e **estrutura cristalina** — átomos ou iões organizados num padrão ordenado e repetido. Um **mineraloide** não tem estrutura cristalina, é amorfo (ex.: opala, obsidiana).',
                'dica': 'a estrutura cristalina é como um **padrão de azulejos repetido sem fim**: nos minerais, os átomos repetem-se de forma geometricamente perfeita; num mineraloide (amorfo), é como ter os azulejos todos espalhados ao acaso, sem padrão.',
            },
            {
                'titulo': 'Polimorfismo e Isomorfismo',
                'texto': 'Dois minerais podem estar relacionados de duas formas opostas.',
                'definicoes': [
                    {
                        'termo': 'Polimorfismo',
                        'texto': 'Mesma composição química, estrutura cristalina diferente (ex.: diamante e grafite, ambos carbono puro).',
                    },
                    {
                        'termo': 'Isomorfismo',
                        'texto': 'Mesma estrutura cristalina, composição variável por substituição de iões de tamanho e carga semelhantes (ex.: olivina, plagioclases).',
                    },
                ],
                'dica': 'pensa em **polimorfismo** como a mesma receita (ingredientes) feita de duas formas diferentes (bolo fofo vs. bolo duro); e em **isomorfismo** como a mesma forma de bolo, mas com um ingrediente trocado por outro parecido (manteiga por margarina) — a estrutura mantém-se, só a composição varia.',
            },
            {
                'titulo': 'Propriedades dos Minerais',
                'texto': 'Os minerais identificam-se por um conjunto de propriedades físicas e químicas.',
                'definicoes': [
                    {
                        'termo': 'Cor e risca',
                        'texto': 'A cor é pouco fiável (muitos minerais têm várias cores por impurezas); a risca — cor do pó, obtida numa placa de porcelana — é mais constante.',
                    },
                    {
                        'termo': 'Dureza (escala de Mohs)',
                        'texto': 'Resistência a ser riscado, de 1 (talco) a 10 (diamante); um mineral risca os de dureza inferior.',
                    },
                    {
                        'termo': 'Clivagem e fratura',
                        'texto': 'Clivagem: tendência para partir segundo planos (micas em lâminas). Fratura: rotura irregular (quartzo).',
                    },
                    {
                        'termo': 'Outras',
                        'texto': 'Brilho (metálico ou não), densidade, magnetismo (magnetite), efervescência com HCl (calcite).',
                    },
                ],
                'dica': 'a cor engana, mas a **risca não mente**: dois quartzos podem ter cores completamente diferentes (roxo, rosa, transparente) por causa de impurezas, mas a sua risca é sempre branca — é por isso que os geólogos confiam mais na risca do que na cor para identificar um mineral.',
            },
            {
                'titulo': 'Os Silicatos',
                'texto': 'Os **silicatos** são os minerais mais abundantes da crosta, com base no tetraedro de sílica [SiO₄]⁴⁻. Incluem o quartzo, os feldspatos (ortóclase, plagioclases), as micas (moscovite, biotite), as anfíbolas, as piroxenas e a olivina. Minerais não silicatados frequentes incluem a calcite, a dolomite, o gesso, a halite, a hematite e a magnetite.',
                'dica': 'se um mineral de rocha-comum não for silicato, é quase sempre porque pertence a um pequeno grupo "famoso" de exceções — a calcite (efervesce com ácido), a halite (sabe a sal) ou a magnetite (atrai o íman). Fora desse grupo, aposta sempre nos silicatos.',
            },
        ],
        'sintese_titulo': 'Síntese Final para Memória Rápida',
        'sintese_final': [
            {
                'label': 'Mineral',
                'valor': 'Sólido natural, inorgânico, composição definida, estrutura cristalina',
            },
            {
                'label': 'Polimorfismo',
                'valor': 'Mesma composição, estrutura diferente (diamante/grafite)',
            },
            {
                'label': 'Isomorfismo',
                'valor': 'Mesma estrutura, composição variável (olivina, plagioclases)',
            },
            {
                'label': 'Identificação',
                'valor': 'Cor (pouco fiável), risca, brilho, dureza (Mohs), clivagem/fratura, densidade',
            },
        ],
        'sintese_dica': '*"A estrutura cristalina é a impressão digital geométrica de um mineral — repete-se sempre do mesmo jeito."*',
    },
    'rochas-sedimentares-magmaticas-metamorficas': {
        'seccoes': [
            {
                'titulo': 'Rochas Sedimentares',
                'texto': 'Sedimentogénese, diagénese, classificação, fósseis e a formação dos combustíveis fósseis.',
            },
            {
                'titulo': 'Sedimentogénese: Meteorização, Erosão, Transporte',
                'texto': 'A **meteorização** é a alteração de rochas no local onde estão. Pode ser física (fragmentação sem alterar a composição) ou química (altera a composição mineralógica).',
                'definicoes': [
                    {
                        'termo': 'Meteorização física',
                        'texto': 'Crioclastia (gelo nas fissuras), termoclastia (variações de temperatura), haloclastia (cristalização de sais). Mais intensa em climas frios/áridos.',
                    },
                    {
                        'termo': 'Meteorização química',
                        'texto': 'Dissolução (calcário → grutas), hidrólise (feldspatos → argila, "apodrece" o granito), oxidação. Mais intensa em climas quentes/húmidos.',
                    },
                    {
                        'termo': 'Transporte e sedimentação',
                        'texto': 'Durante o transporte, os detritos ficam mais arredondados e calibrados. A sedimentação ocorre quando o agente de transporte perde energia — os detritos maiores depositam-se primeiro.',
                    },
                ],
                'dica': 'a meteorização física é como **partir uma tablete de chocolate em pedaços** (muda a forma, não a composição); a química é como **deixar essa mesma tablete derreter ao sol e mudar de textura** (a própria substância transforma-se).',
            },
            {
                'titulo': 'Diagénese e a Classificação das Rochas Sedimentares',
                'texto': 'A **diagénese** transforma sedimentos soltos em rocha consolidada, a baixa temperatura e pressão, por compactação (expulsa a água), cimentação (precipita substâncias que ligam as partículas) e recristalização.',
                'definicoes': [
                    {
                        'termo': 'Detríticas',
                        'texto': 'Formadas por clastos de outras rochas, classificadas pelo tamanho: conglomerado/brecha (>2mm), arenito (1/16-2mm), siltito, argilito (<1/256mm).',
                    },
                    {
                        'termo': 'Quimiogénicas',
                        'texto': 'Por precipitação de substâncias dissolvidas: calcários de precipitação, evaporitos (gesso, sal-gema).',
                    },
                    {
                        'termo': 'Biogénicas',
                        'texto': 'Com intervenção de seres vivos: calcários biogénicos, carvões, petróleo.',
                    },
                ],
                'dica': 'a diagénese é como **comprimir neve fofa até virar gelo compacto**: a compactação espreme a água e aproxima as partículas, e a cimentação é como uma "cola invisível" (calcite, sílica) que se deposita entre elas, prendendo tudo no sítio.',
            },
            {
                'titulo': 'Estruturas Sedimentares e Paleoambientes',
                'texto': 'Pelo princípio do atualismo, certas estruturas revelam o ambiente de formação: marcas de ondulação (praia, rio), estratificação entrecruzada (dunas, rios — indica o sentido da corrente), fendas de dessecação (exposição ao ar e secagem) e estratificação gradada (sedimentos que diminuem de tamanho da base para o topo, por perda de energia).',
                'dica': 'se vês uma rocha com fendas poligonais em forma de "teia de aranha" (fendas de dessecação), sabes logo que aquele sedimento esteve exposto ao ar e secou — era, muito provavelmente, a margem lamacenta de um rio ou lago.',
            },
            {
                'titulo': 'Fósseis e Fossilização',
                'texto': 'A fossilização favorece-se com partes duras, soterramento rápido, ambiente pobre em oxigénio e ausência de metamorfismo posterior.',
                'definicoes': [
                    {
                        'termo': 'Mineralização (petrificação)',
                        'texto': 'A matéria orgânica é substituída, molécula a molécula, por minerais (troncos silicificados).',
                    },
                    {
                        'termo': 'Moldagem',
                        'texto': 'O ser vivo deixa a sua forma impressa (molde externo/interno) ou o espaço é preenchido (contramolde).',
                    },
                    {
                        'termo': 'Incarbonização',
                        'texto': 'Perda dos elementos voláteis, ficando uma película de carbono (folhas, fetos).',
                    },
                    {
                        'termo': 'Icnofósseis',
                        'texto': 'Marcas de atividade: pegadas, pistas, ovos, coprólitos (ex.: pegadas de dinossauros no Cabo Espichel).',
                    },
                ],
                'dica': 'pensa num icnofóssil como uma **pegada na areia molhada que endureceu**: não é o animal que ficou preservado, é só o vestígio da sua passagem — ainda assim conta uma história real sobre o seu comportamento.',
            },
            {
                'titulo': 'Combustíveis Fósseis',
                'texto': 'O **carvão** forma-se a partir de restos de plantas em pântanos pobres em oxigénio, por incarbonização progressiva: turfa → lenhite → hulha → antracite. O **petróleo e gás natural** formam-se a partir de matéria orgânica (sobretudo plâncton) na rocha-mãe, migram para uma rocha-armazém porosa e permeável, e ficam retidos por uma rocha de cobertura impermeável — numa estrutura chamada armadilha petrolífera.',
                'dica': 'numa armadilha petrolífera, a ordem é sempre a mesma por densidade, como num frasco de vinagrete deixado em repouso: **gás em cima, petróleo no meio, água em baixo**.',
            },
            {
                'titulo': 'Rochas Magmáticas',
                'texto': 'Génese dos magmas, a série de reações de Bowen, diferenciação magmática, textura e classificação.',
            },
            {
                'titulo': 'Génese dos Magmas',
                'texto': 'A maior parte do manto é sólida. Os magmas formam-se por **fusão parcial** (só os minerais com ponto de fusão mais baixo fundem), em três contextos principais.',
                'definicoes': [
                    {
                        'termo': 'Descompressão',
                        'texto': 'O manto ascende e o seu ponto de fusão baixa — origina magma basáltico (dorsais, pontos quentes).',
                    },
                    {
                        'termo': 'Adição de água',
                        'texto': 'A água baixa o ponto de fusão; ocorre em zonas de subducção — origina magma andesítico.',
                    },
                    {
                        'termo': 'Aumento de temperatura',
                        'texto': 'Magma quente funde a crosta continental acima dele — origina magma riolítico.',
                    },
                ],
                'dica': 'pensa nos três "gatilhos" da fusão como **três formas diferentes de derreter gelo**: tirar-lhe a pressão de cima, juntar-lhe sal (como a água faz ao ponto de fusão), ou simplesmente aquecê-lo mais.',
            },
            {
                'titulo': 'A Série de Reações de Bowen',
                'texto': 'Ao arrefecer, um magma não solidifica todo ao mesmo tempo — os minerais cristalizam por ordem de temperatura. Na **série descontínua** (ferromagnesianos), cada mineral reage com o líquido e origina um mineral com estrutura diferente: olivina → piroxena → anfíbola → biotite. Na **série contínua** (plagioclases), a estrutura mantém-se mas a composição varia de cálcica para sódica. Os últimos minerais a cristalizar são o feldspato potássico, a moscovite e o quartzo — o líquido residual fica cada vez mais rico em sílica.',
                'dica': 'os primeiros minerais a cristalizar (olivina, plagioclase cálcica) são também os **primeiros a meteorizar-se** à superfície — são como os primeiros convidados a sair de uma festa; o quartzo, o último a cristalizar, é o mais resistente e o último "convidado" a sair, por isso domina as areias.',
            },
            {
                'titulo': 'Diferenciação Magmática',
                'texto': 'Processos que fazem variar a composição de um magma, permitindo que de um magma original resultem rochas diferentes.',
                'definicoes': [
                    {
                        'termo': 'Cristalização fracionada',
                        'texto': 'Os minerais formados são separados do líquido — ex.: diferenciação gravítica, com os cristais densos a afundar na câmara magmática.',
                    },
                    {
                        'termo': 'Assimilação',
                        'texto': 'O magma incorpora e funde rochas encaixantes, alterando a sua composição.',
                    },
                    {
                        'termo': 'Mistura de magmas',
                        'texto': 'Dois magmas diferentes misturam-se.',
                    },
                ],
                'dica': 'a diferenciação magmática explica como um único magma "mãe" pode dar origem a uma família inteira de rochas diferentes — tal como uma única receita-base pode ser ajustada (mais farinha aqui, menos açúcar ali) para fazer bolos com sabores diferentes.',
            },
            {
                'titulo': 'Textura e Classificação das Rochas Magmáticas',
                'texto': 'A textura e a composição química, combinadas, permitem classificar qualquer rocha magmática.',
                'definicoes': [
                    {
                        'termo': 'Granular (plutónica)',
                        'texto': 'Arrefecimento lento, em profundidade; todos os minerais visíveis a olho nu.',
                    },
                    {
                        'termo': 'Agranular/vítrea (vulcânica)',
                        'texto': 'Arrefecimento rápido, à superfície; cristais muito pequenos ou ausentes (obsidiana, pedra-pomes).',
                    },
                    {
                        'termo': 'Granito e Riolito',
                        'texto': 'Composição ácida (>65% sílica), clara — granito (plutónica), riolito (vulcânica).',
                    },
                    {
                        'termo': 'Gabro e Basalto',
                        'texto': 'Composição básica (45-52% sílica), escura — gabro (plutónica), basalto (vulcânica).',
                    },
                ],
                'dica': 'a textura denuncia sempre a **velocidade do arrefecimento**: cristais grandes e visíveis = tempo para crescer (plutónica, profundidade); cristais minúsculos ou nenhuns = pressa (vulcânica, superfície) — é como a diferença entre deixar água congelar devagar no congelador (cristais de gelo grandes) ou muito depressa (gelo opaco, sem estrutura visível).',
            },
            {
                'titulo': 'Rochas Metamórficas',
                'texto': 'Fatores e tipos de metamorfismo, minerais-índice, texturas, e a síntese do ciclo litológico completo.',
            },
            {
                'titulo': 'O Que é o Metamorfismo e os Seus Fatores',
                'texto': 'O **metamorfismo** é o conjunto de transformações mineralógicas e texturais que ocorrem **no estado sólido**, em rochas pré-existentes sujeitas a novas condições de pressão e/ou temperatura.',
                'definicoes': [
                    {
                        'termo': 'Temperatura',
                        'texto': 'O principal fator; favorece a recristalização e as reações químicas.',
                    },
                    {
                        'termo': 'Pressão litostática',
                        'texto': 'Exercida igualmente em todas as direções; torna a rocha mais compacta e densa.',
                    },
                    {
                        'termo': 'Pressão não litostática (dirigida)',
                        'texto': 'Maior numa direção; orienta os minerais perpendicularmente à tensão máxima — origina a foliação.',
                    },
                    {
                        'termo': 'Fluidos e tempo',
                        'texto': 'Os fluidos aceleram as reações; as reações metamórficas são muito lentas.',
                    },
                ],
                'dica': 'a palavra-chave é **"sem derreter"**: ao contrário do magmatismo, o metamorfismo reorganiza os minerais sem nunca os fundir — é como reorganizar os livros de uma estante de forma diferente, sem nunca os destruir ou reescrever.',
            },
            {
                'titulo': 'Metamorfismo de Contacto vs. Regional',
                'texto': 'Consoante o fator dominante e a escala, distinguem-se dois grandes tipos.',
                'definicoes': [
                    {
                        'termo': 'Metamorfismo de contacto (térmico)',
                        'texto': 'Dominado pela temperatura; ocorre numa auréola à volta de intrusões magmáticas; rochas geralmente não foliadas (corneana, mármore, quartzito).',
                    },
                    {
                        'termo': 'Metamorfismo regional',
                        'texto': 'Dominado por temperatura e pressão dirigida; ocorre em grandes áreas, em zonas de colisão; rochas geralmente foliadas (ardósia, filito, micaxisto, gnaisse).',
                    },
                ],
                'dica': 'o metamorfismo de contacto é como **aproximar uma torradeira de um pão** — localizado, só o que está perto aquece; o metamorfismo regional é como **uma prensa gigante a esmagar uma área inteira** — afeta regiões enormes, em zonas de colisão de placas.',
            },
            {
                'titulo': 'Grau de Metamorfismo e Minerais-Índice',
                'texto': 'Os **minerais-índice** só se formam em determinadas condições, permitindo deduzir o grau de metamorfismo: clorite → moscovite → biotite → granada → estaurolite → distena → silimanite (de baixo para alto grau). Em metamorfismo regional crescente, uma rocha argilosa evolui: argilito → ardósia → filito → micaxisto → gnaisse — e, com temperaturas ainda mais altas, inicia-se a fusão parcial (anatexia), formando migmatitos.',
                'dica': 'esta sequência — argilito → ardósia → filito → micaxisto → gnaisse — é uma das mais pedidas em exame. Memoriza-a como uma **escada de 5 degraus de grau crescente**: quanto mais subes, mais visíveis ficam os cristais e mais marcado o bandado.',
            },
            {
                'titulo': 'Texturas e Rochas Metamórficas',
                'texto': 'A textura e os minerais de uma rocha metamórfica revelam as condições em que se formou.',
                'definicoes': [
                    {
                        'termo': 'Foliada',
                        'texto': 'Ardósia (grão fino, clivagem ardosiana), filito (brilho acetinado), micaxisto (micas visíveis), gnaisse (bandado, alto grau).',
                    },
                    {
                        'termo': 'Não foliada (granoblástica)',
                        'texto': 'Mármore (de calcário, efervesce com HCl), quartzito (de arenito quártzico, muito duro), corneana (metamorfismo de contacto).',
                    },
                ],
                'dica': 'em Portugal: as **ardósias de Valongo**, os **mármores de Estremoz, Borba e Vila Viçosa**, e os xistos e quartzitos do Maciço Hespérico (Beiras, Trás-os-Montes) são exemplos clássicos de exame.',
            },
            {
                'titulo': 'Síntese: o Ciclo das Rochas Completo',
                'texto': 'Com o estudo das rochas sedimentares, magmáticas e metamórficas, o ciclo litológico fecha-se: os sedimentos acumulam-se em bacias, são deformados e metamorfizados em zonas de colisão, podem fundir parcialmente em profundidade e originar magmas, e as rochas formadas são levantadas e expostas à superfície — onde o ciclo recomeça.',
                'dica': 'agora que já conheces os três grupos de rochas em detalhe, revê o ciclo litológico do início: cada seta do ciclo corresponde a um processo que já estudaste — meteorização, diagénese, metamorfismo, fusão, cristalização, soerguimento.',
            },
        ],
        'sintese_titulo': 'Síntese Final para Memória Rápida',
        'sintese_final': [
            {
                'label': 'Sedimentogénese',
                'valor': 'Meteorização (física/química) → erosão → transporte → sedimentação',
            },
            {
                'label': 'Diagénese',
                'valor': 'Compactação + cimentação + recristalização → rocha consolidada',
            },
            {
                'label': '3 tipos',
                'valor': 'Detríticas (clastos), quimiogénicas (precipitação), biogénicas (seres vivos)',
            },
            {
                'label': 'Petróleo',
                'valor': 'Rocha-mãe → migração → rocha-armazém (porosa/permeável) sob rocha de cobertura impermeável',
            },
            {
                'label': 'Origem do magma',
                'valor': 'Descompressão (basáltico) · água (andesítico) · temperatura (riolítico)',
            },
            {
                'label': 'Bowen',
                'valor': 'Cristaliza por ordem de temperatura · líquido residual enriquece em sílica',
            },
            {
                'label': 'Textura',
                'valor': 'Arrefecimento lento → granular · rápido → agranular/vítrea',
            },
            {
                'label': 'Pares plutónica/vulcânica',
                'valor': 'Granito/riolito (ácida) · diorito/andesito (intermédia) · gabro/basalto (básica)',
            },
            {
                'label': 'Metamorfismo',
                'valor': 'Transformação no estado sólido · fatores: temperatura, pressão (litostática e dirigida), fluidos, tempo',
            },
            {
                'label': 'Contacto vs. regional',
                'valor': 'Contacto: temperatura, auréola, não foliada. Regional: temperatura+pressão, grandes áreas, foliada',
            },
            {
                'label': 'Minerais-índice',
                'valor': 'Revelam o grau de metamorfismo (clorite → ... → silimanite)',
            },
            {
                'label': 'Série argilosa',
                'valor': 'Argilito → ardósia → filito → micaxisto → gnaisse (grau crescente)',
            },
        ],
        'sintese_dica': '*"Sedimentar, magmática ou metamórfica — cada rocha é só uma fase, nunca um destino final, do ciclo litológico."*',
    },
    'deformacao-e-recursos': {
        'seccoes': [
            {
                'titulo': 'Deformação das Rochas',
                'texto': 'Tensões compressivas, distensivas e cisalhantes, e as dobras e falhas que daí resultam.',
            },
            {
                'titulo': 'Tensões e Comportamento das Rochas',
                'texto': 'O tipo de tensão aplicada a uma rocha determina o tipo de estrutura que se forma, e está sempre ligado à tectónica de placas.',
                'definicoes': [
                    {
                        'termo': 'Tensão compressiva',
                        'texto': 'Encurta e espessa as camadas; origina dobras e falhas inversas. Típica de limites convergentes.',
                    },
                    {
                        'termo': 'Tensão distensiva',
                        'texto': 'Estira e adelgaça; origina falhas normais. Típica de limites divergentes.',
                    },
                    {
                        'termo': 'Tensão cisalhante',
                        'texto': 'Deslocamento lateral; origina falhas de desligamento. Típica de limites transformantes.',
                    },
                ],
                'dica': 'uma rocha deforma-se de forma **dúctil** (dobra, como plasticina) quando há temperatura elevada, pressão confinante elevada e a tensão é aplicada lentamente; deforma-se de forma **frágil** (parte, como uma bolacha) à superfície, onde as condições são o oposto.',
            },
            {
                'titulo': 'Dobras',
                'texto': 'São deformações dúcteis em que as camadas ficam encurvadas, sem fraturar.',
                'definicoes': [
                    {
                        'termo': 'Anticlinal',
                        'texto': 'Convexidade voltada para cima (em "A"); as rochas no núcleo são as mais antigas.',
                    },
                    {
                        'termo': 'Sinclinal',
                        'texto': 'Concavidade voltada para cima (em "U"); as rochas no núcleo são as mais recentes.',
                    },
                    {
                        'termo': 'Elementos de uma dobra',
                        'texto': 'Charneira (zona de maior curvatura), flancos (lados), superfície axial, eixo.',
                    },
                ],
                'dica': 'imagina as camadas de rocha como as **páginas de um livro fechado que dobras ao meio**: se o livro forma uma "montanha" (anticlinal), a página mais antiga fica no centro, mais exposta; se forma um "vale" (sinclinal), a página mais recente fica protegida no fundo.',
            },
            {
                'titulo': 'Falhas',
                'texto': 'São fraturas com deslocamento relativo dos blocos (ao contrário das diáclases, sem deslocamento).',
                'definicoes': [
                    {
                        'termo': 'Falha normal',
                        'texto': 'O teto desce em relação ao muro (há alongamento) — tensão distensiva.',
                    },
                    {
                        'termo': 'Falha inversa',
                        'texto': 'O teto sobe em relação ao muro (há encurtamento) — tensão compressiva. Com pouca inclinação, chama-se cavalgamento.',
                    },
                    {
                        'termo': 'Falha de desligamento',
                        'texto': 'Os blocos deslocam-se horizontalmente, paralelamente ao plano de falha — tensão cisalhante.',
                    },
                    {
                        'termo': 'Horsts e grabens',
                        'texto': 'Associações de falhas normais originam blocos elevados (horsts) e blocos abatidos (grabens — ex.: riftes).',
                    },
                ],
                'dica': 'para memorizar falha normal vs. inversa, pensa no **esforço necessário**: numa falha normal, o bloco simplesmente "cai" com a gravidade, puxado para baixo pela distensão — fácil, "normal". Numa falha inversa, o bloco é empurrado para cima contra a gravidade pela compressão — o "inverso" do que seria natural.',
            },
            {
                'titulo': 'Exploração Sustentada de Recursos Geológicos',
                'texto': 'Recursos minerais, energéticos e hídricos, aquíferos, e como explorá-los de forma sustentável.',
            },
            {
                'titulo': 'Recursos e Reservas',
                'texto': 'Nem todo o recurso identificado é, de facto, explorável.',
                'definicoes': [
                    {
                        'termo': 'Recurso geológico',
                        'texto': 'Qualquer material ou fonte de energia da geosfera útil ao ser humano.',
                    },
                    {
                        'termo': 'Reserva',
                        'texto': 'Parte do recurso já identificada e explorável com lucro, com a tecnologia e condições económicas atuais — varia com o preço, a tecnologia e novas descobertas.',
                    },
                    {
                        'termo': 'Renováveis vs. não renováveis',
                        'texto': 'Renováveis repõem-se à escala humana (água, geotermia bem gerida). Não renováveis formam-se à escala geológica (minérios, combustíveis fósseis).',
                    },
                ],
                'dica': 'uma reserva não é fixa: se o preço de um metal sobe, ou surge nova tecnologia de extração, uma parte do recurso que antes "não compensava" explorar passa a ser reserva — a reserva cresce sem que tenha sido descoberto nada de novo no terreno.',
            },
            {
                'titulo': 'Recursos Minerais',
                'texto': 'Um **jazigo mineral** é uma concentração anómala de um mineral que torna a sua exploração rentável. O **minério** é a associação da qual se extrai, com vantagem económica, uma substância útil; a **ganga** é o resto, sem valor. Em Portugal: Neves-Corvo e Aljustrel (cobre, zinco), Panasqueira (volfrâmio), Barroso e Beiras (lítio), Anticlinal de Estremoz (mármores).',
                'dica': 'a exploração mineira tem sempre dois lados: tão importante como extrair é **recuperar a paisagem depois** — tratar efluentes, evitar a drenagem ácida (que acidifica águas e liberta metais pesados), e reflorestar as áreas já exploradas.',
            },
            {
                'titulo': 'Recursos Energéticos',
                'texto': 'Além dos combustíveis fósseis, a geosfera fornece outras fontes de energia.',
                'definicoes': [
                    {
                        'termo': 'Nuclear (urânio)',
                        'texto': 'Muita energia, sem CO₂ na produção, mas resíduos radioativos perigosos durante muito tempo. Em Portugal explorou-se urânio na Urgeiriça.',
                    },
                    {
                        'termo': 'Geotérmica de alta entalpia',
                        'texto': 'Fluidos a >150°C, produção de eletricidade — Açores (Ribeira Grande, Pico Vermelho, São Miguel).',
                    },
                    {
                        'termo': 'Geotérmica de baixa entalpia',
                        'texto': 'Aquecimento de edifícios, estufas e termalismo (ex.: Chaves, São Pedro do Sul).',
                    },
                ],
                'dica': 'a geotermia divide-se pela "temperatura do recurso": alta entalpia é quente o suficiente para **gerar eletricidade** (como nos Açores); baixa entalpia só chega para **aquecer diretamente** — edifícios, estufas, termas.',
            },
            {
                'titulo': 'Recursos Hídricos: Aquíferos',
                'texto': 'A água infiltra-se no solo, atravessando a zona de aeração até à zona de saturação — o limite entre as duas é o **nível freático**.',
                'definicoes': [
                    {
                        'termo': 'Porosidade vs. permeabilidade',
                        'texto': 'Porosidade: % de espaços vazios. Permeabilidade: capacidade de a água atravessar a rocha. A argila é porosa mas pouco permeável.',
                    },
                    {
                        'termo': 'Aquífero livre',
                        'texto': 'Limitado só na base; à pressão atmosférica; recarregado em toda a área; água tem de ser bombeada; elevada vulnerabilidade à poluição.',
                    },
                    {
                        'termo': 'Aquífero cativo',
                        'texto': 'Entre duas camadas impermeáveis; água sob pressão; recarga só onde a formação aflora; mais protegido da poluição.',
                    },
                    {
                        'termo': 'Problemas',
                        'texto': 'Sobre-exploração (descida do nível freático, intrusão salina no litoral) e contaminação (nitratos, efluentes, drenagem ácida).',
                    },
                ],
                'dica': 'o aquífero cativo é como uma **sanduíche**: a água está "entalada" entre duas fatias de pão impermeável, protegida da contaminação exterior e sob pressão — por isso, ao perfurares até lá, a água pode subir sozinha pelo furo (e, se chegar à superfície, chama-se furo artesiano repuxante).',
            },
        ],
        'sintese_titulo': 'Síntese Final para Memória Rápida',
        'sintese_final': [
            {
                'label': 'Compressão',
                'valor': 'Dobras + falhas inversas · limites convergentes',
            },
            {
                'label': 'Distensão',
                'valor': 'Falhas normais · limites divergentes',
            },
            {
                'label': 'Cisalhamento',
                'valor': 'Falhas de desligamento · limites transformantes',
            },
            {
                'label': 'Dobras',
                'valor': 'Anticlinal: núcleo mais antigo · Sinclinal: núcleo mais recente',
            },
            {
                'label': 'Recurso vs. reserva',
                'valor': 'Recurso: útil. Reserva: explorável com lucro hoje — varia com preço e tecnologia',
            },
            {
                'label': 'Minério vs. ganga',
                'valor': 'Minério: tem valor económico. Ganga: o resto, sem valor',
            },
            {
                'label': 'Porosidade ≠ permeabilidade',
                'valor': 'Uma rocha pode ser muito porosa e pouco permeável (argila)',
            },
            {
                'label': 'Aquífero livre vs. cativo',
                'valor': 'Livre: pressão atmosférica, mais vulnerável. Cativo: sob pressão, mais protegido',
            },
        ],
        'sintese_dica': '*"As rochas registam a força que as deformou; os recursos que delas tiramos registam a força da nossa responsabilidade em os gerir bem."*',
    },
}


@login_required(login_url='login')
def pagina_Resumos(request):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None
    return render(request, 'Resumos.html', {
        'perfil': perfil,
        'resumos': [r for r in RESUMOS if r['disciplina'] != 'Geologia'],
        'subject': 'biology',
    })


@login_required(login_url='login')
def pagina_Resumos_geologia(request):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None
    return render(request, 'Resumos.html', {
        'perfil': perfil,
        'resumos': [r for r in RESUMOS if r['disciplina'] == 'Geologia'],
        'subject': 'geology',
    })


@login_required(login_url='login')
def pagina_resumo_detalhe(request, resumo_id):
    resumo = next((r for r in RESUMOS if r['id'] == resumo_id), None)
    conteudo = RESUMOS_CONTEUDO.get(resumo_id)
    if resumo is None or conteudo is None:
        raise Http404('Resumo não encontrado.')

    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    return render(request, 'resumo-detalhe.html', {
        'perfil': perfil,
        'resumo': resumo,
        'conteudo': conteudo,
    })


def pagina_Conquistas(request):
    return render(request, 'Conquistas.html')


@login_required(login_url='login')
def pagina_Configurações(request):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    return render(request, 'Configurações.html', {'perfil': perfil})


@login_required(login_url='login')
def pagina_superexplore(request):
    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None
    return render(request, 'superexplore.html', {
        'perfil': perfil,
        'limite_chat_free': obter_limite_chat('free'),
        'limite_chat_pro': obter_limite_chat('pro'),
    })


def _cliente_stripe():
    return stripe.StripeClient(
        api_key=settings.STRIPE_SECRET_KEY,
        stripe_version=settings.STRIPE_API_VERSION,
    )


@login_required(login_url='login')
@require_POST
def iniciar_checkout_superexplore(request):
    perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    if perfil.plano == 'pro':
        return redirect('superexplore')

    precos = {
        'quinzenal': settings.STRIPE_PRICE_ID_PRO_QUINZENAL,
        'mensal': settings.STRIPE_PRICE_ID_PRO,
        'anual': settings.STRIPE_PRICE_ID_PRO_ANUAL,
    }
    price_id = precos.get(request.POST.get('intervalo', 'mensal'))
    url_base = request.build_absolute_uri(reverse('superexplore'))
    if not price_id:
        return redirect(f'{url_base}?checkout=erro')
    dados_sessao = {
        'mode': 'subscription',
        'line_items': [{'price': price_id, 'quantity': 1}],
        'client_reference_id': str(request.user.id),
        'success_url': f'{url_base}?checkout=sucesso',
        'cancel_url': f'{url_base}?checkout=cancelado',
    }
    if perfil.stripe_customer_id:
        dados_sessao['customer'] = perfil.stripe_customer_id
    else:
        dados_sessao['customer_email'] = request.user.email

    try:
        sessao = _cliente_stripe().v1.checkout.sessions.create(dados_sessao)
    except stripe.StripeError:
        return redirect(f'{url_base}?checkout=erro')

    return redirect(sessao.url)


@login_required(login_url='login')
def gerir_subscricao(request):
    perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    if not perfil.stripe_customer_id:
        return redirect('superexplore')

    url_retorno = request.build_absolute_uri(reverse('superexplore'))
    try:
        sessao_portal = _cliente_stripe().v1.billing_portal.sessions.create({
            'customer': perfil.stripe_customer_id,
            'return_url': url_retorno,
        })
    except stripe.StripeError:
        return redirect('superexplore')

    return redirect(sessao_portal.url)


@csrf_exempt
@require_POST
def stripe_webhook(request):
    try:
        evento = stripe.Webhook.construct_event(
            request.body,
            request.META.get('HTTP_STRIPE_SIGNATURE', ''),
            settings.STRIPE_WEBHOOK_SECRET,
        )
    except (ValueError, stripe.SignatureVerificationError):
        return HttpResponse(status=400)

    tipo = evento['type']
    dados = evento['data']['object']

    if tipo == 'checkout.session.completed' or (
        tipo == 'checkout.session.async_payment_succeeded'
        and dados.get('payment_status') == 'paid'
    ):
        utilizador_id = dados.get('client_reference_id')
        if utilizador_id:
            try:
                utilizador = User.objects.get(pk=utilizador_id)
            except User.DoesNotExist:
                utilizador = None
            if utilizador is not None:
                perfil, _ = PerfilAluno.objects.get_or_create(user=utilizador)
                perfil.stripe_customer_id = dados.get('customer', '') or perfil.stripe_customer_id
                perfil.stripe_subscription_id = dados.get('subscription', '') or perfil.stripe_subscription_id
                perfil.plano = 'pro'
                perfil.save(update_fields=['stripe_customer_id', 'stripe_subscription_id', 'plano'])

    elif tipo == 'customer.subscription.updated':
        perfil = PerfilAluno.objects.filter(stripe_customer_id=dados.get('customer')).first()
        if perfil is not None:
            perfil.stripe_subscription_id = dados.get('id', '') or perfil.stripe_subscription_id
            perfil.plano = 'pro' if dados.get('status') in ('active', 'trialing') else 'free'
            perfil.save(update_fields=['stripe_subscription_id', 'plano'])

    elif tipo == 'customer.subscription.deleted':
        perfil = PerfilAluno.objects.filter(stripe_customer_id=dados.get('customer')).first()
        if perfil is not None:
            perfil.plano = 'free'
            perfil.stripe_subscription_id = ''
            perfil.save(update_fields=['plano', 'stripe_subscription_id'])

    return HttpResponse(status=200)


def carregar_teste(teste_id):
    """Testes vivem fora de static/ de propósito: static/ é servido
    publicamente, e este ficheiro contém o gabarito — nunca deve chegar
    ao browser do aluno."""
    caminho_json = settings.BASE_DIR.parent / 'testes' / f'{teste_id}.json'
    with open(caminho_json, 'r', encoding='utf-8') as f:
        return json.load(f)


CHAVES_SECRETAS_PERGUNTA = (
    'resposta_correta', 'criterios_correcao', 'tolerancia_numerica',
    'palavras_chave', 'grupos_palavras_chave', 'minimo_grupos',
)


@login_required(login_url='login')
def pagina_teste_fotossintese(request, teste_id):
    config_teste = encontrar_config_teste(teste_id)
    if config_teste is None:
        raise Http404('Teste não encontrado.')

    try:
        perfil, created = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    plano_aluno = perfil.plano if perfil is not None else 'free'
    if config_teste['plano'] == 'pro' and plano_aluno != 'pro':
        return redirect('superexplore')

    try:
        teste = carregar_teste(teste_id)
    except FileNotFoundError:
        raise Http404('Teste não encontrado.')

    # Nunca enviar o gabarito para o browser — a correção só acontece
    # no servidor, em corrigir_teste_fotossintese().
    perguntas_publicas = [
        {chave: valor for chave, valor in pergunta.items() if chave not in CHAVES_SECRETAS_PERGUNTA}
        for pergunta in teste['perguntas']
    ]

    progresso_guardado = {}
    if perfil is not None:
        progresso_testes = perfil.progresso_testes if isinstance(perfil.progresso_testes, dict) else {}
        entrada = progresso_testes.get(teste_id)
        if isinstance(entrada, dict) and isinstance(entrada.get('respostas'), dict):
            progresso_guardado = entrada['respostas']

    return render(request, 'teste-fotossintese.html', {
        'perfil': perfil,
        'teste': teste,
        'teste_id': teste_id,
        'perguntas': perguntas_publicas,
        'progresso_guardado': progresso_guardado,
    })


@login_required(login_url='login')
@require_POST
def guardar_progresso_teste(request):
    """Guarda um rascunho das respostas do aluno a meio do teste, para que
    possa fechar a página e continuar mais tarde de onde ficou — a correção
    em si só acontece quando ele submete (corrigir_teste_fotossintese)."""
    try:
        dados = json.loads(request.body or '{}')
    except (TypeError, ValueError):
        return JsonResponse({'erro': 'Dados inválidos.'}, status=400)

    teste_id = str(dados.get('testeId', '')).strip()
    respostas = dados.get('respostas')
    if not teste_id or not isinstance(respostas, dict):
        return JsonResponse({'erro': 'Teste ou respostas em falta.'}, status=400)

    perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    progresso_testes = dict(perfil.progresso_testes or {})
    progresso_testes[teste_id] = {
        'respostas': respostas,
        'atualizado_em': timezone.now().isoformat(),
    }
    perfil.progresso_testes = progresso_testes
    perfil.save(update_fields=['progresso_testes'])

    return JsonResponse({'ok': True})


def normalizar_resposta(valor):
    return str(valor if valor is not None else '').strip().lower()


def normalizar_sem_acentos(valor):
    """Para correspondência por palavras-chave: minúsculas e sem
    acentuação, para "espécie" e "especie" contarem como a mesma palavra."""
    texto = normalizar_resposta(valor)
    sem_acentos = unicodedata.normalize('NFKD', texto)
    return ''.join(c for c in sem_acentos if not unicodedata.combining(c))


def extrair_numero(valor):
    texto = str(valor if valor is not None else '').replace(',', '.')
    encontrado = re.search(r'-?\d+(\.\d+)?', texto)
    return float(encontrado.group()) if encontrado else None


def corrigir_pergunta_automatica(pergunta, resposta_aluno):
    """Corrige tudo exceto resposta_longa — sem chamar nenhuma API. Itens
    com várias partes (correspondência, ordenação, completar texto,
    verdadeiro/falso) têm a cotação repartida em partes iguais."""
    tipo = pergunta['tipo']
    cotacao = pergunta['cotacao']
    correta = pergunta.get('resposta_correta')

    if tipo == 'escolha_multipla':
        return cotacao if normalizar_resposta(resposta_aluno) == normalizar_resposta(correta) else 0

    if tipo == 'correspondencia' or tipo == 'completar_texto' or tipo == 'verdadeiro_falso':
        if not isinstance(resposta_aluno, dict) or not correta:
            return 0
        pontos_por_parte = cotacao / len(correta)
        pontos = sum(
            pontos_por_parte
            for chave, valor_correto in correta.items()
            if normalizar_resposta(resposta_aluno.get(chave)) == normalizar_resposta(valor_correto)
        )
        return round(pontos, 2)

    if tipo == 'ordenacao':
        if not isinstance(resposta_aluno, list) or not correta:
            return 0
        pontos_por_parte = cotacao / len(correta)
        pontos = 0
        for indice, letra_correta in enumerate(correta):
            valor_aluno = resposta_aluno[indice] if indice < len(resposta_aluno) else None
            if normalizar_resposta(valor_aluno) == normalizar_resposta(letra_correta):
                pontos += pontos_por_parte
        return round(pontos, 2)

    if tipo == 'selecao_multipla':
        # Escolher N de várias afirmações (ex: "as três afirmações corretas") —
        # cotação tudo-ou-nada, sem meios pontos, tal como nos exames nacionais.
        if not isinstance(resposta_aluno, list) or not correta:
            return 0
        aluno_normalizado = {normalizar_resposta(v) for v in resposta_aluno}
        correta_normalizada = {normalizar_resposta(v) for v in correta}
        return cotacao if aluno_normalizado == correta_normalizada else 0

    if tipo == 'resposta_curta':
        modo = pergunta.get('modo_correcao')

        # Um único grupo de sinónimos aceitáveis — qualquer um dá cotação
        # inteira (ex: "bicarbonato" ou "CO2" para a mesma variável).
        if modo == 'palavras_chave':
            palavras = pergunta.get('palavras_chave') or []
            texto_aluno = normalizar_sem_acentos(resposta_aluno)
            acertou = any(normalizar_sem_acentos(palavra) in texto_aluno for palavra in palavras)
            return cotacao if acertou else 0

        # Vários grupos de sinónimos (cada grupo = uma variável/ideia
        # distinta); cotação proporcional a quantos grupos diferentes o
        # aluno referiu, até ao mínimo pedido no enunciado.
        if modo == 'grupos_multiplos':
            grupos = pergunta.get('grupos_palavras_chave') or []
            minimo = pergunta.get('minimo_grupos') or len(grupos) or 1
            texto_aluno = normalizar_sem_acentos(resposta_aluno)
            grupos_encontrados = sum(
                1 for grupo in grupos
                if any(normalizar_sem_acentos(palavra) in texto_aluno for palavra in grupo)
            )
            pontos = cotacao * min(grupos_encontrados, minimo) / minimo
            return round(pontos, 2)

        numero_correto = extrair_numero(correta)
        numero_aluno = extrair_numero(resposta_aluno)
        tolerancia = pergunta.get('tolerancia_numerica')
        if numero_correto is not None and numero_aluno is not None and tolerancia is not None:
            return cotacao if abs(numero_correto - numero_aluno) <= tolerancia else 0
        return cotacao if normalizar_resposta(resposta_aluno) == normalizar_resposta(correta) else 0

    return 0


def corrigir_perguntas_longas_com_ia(perguntas_longas):
    """Uma única chamada à Claude (Haiku) que corrige todas as perguntas de
    resposta_longa do teste de uma vez. Sem limite de uso — não passa por
    verificar_e_incrementar_uso_chat(), disponível para Free e Pro."""
    resultado = {}

    if not settings.ANTHROPIC_API_KEY:
        for pergunta, _ in perguntas_longas:
            resultado[pergunta['id']] = {
                'pontos': 0,
                'feedback': 'A correção automática desta pergunta ainda não está configurada.',
            }
        return resultado

    blocos_pedido = [
        (
            f"Pergunta \"{pergunta['id']}\" (cotação máxima: {pergunta['cotacao']} pontos)\n"
            f"Enunciado: {pergunta['enunciado']}\n"
            f"Critérios de correção: {pergunta['criterios_correcao']}\n"
            f"Resposta do aluno: {(resposta or '').strip() or '(sem resposta)'}"
        )
        for pergunta, resposta in perguntas_longas
    ]
    formato_json = ', '.join(
        f'"{pergunta["id"]}": {{"pontuacao": numero, "feedback": "texto"}}'
        for pergunta, _ in perguntas_longas
    )
    prompt = (
        "És um professor de Biologia do ensino secundário em Portugal a corrigir um teste. "
        "Para cada pergunta abaixo, atribui uma pontuação entre 0 e a cotação máxima indicada, "
        "com base em quão bem a resposta do aluno cobre os critérios de correção, e escreve um "
        "feedback curto (1 a 2 frases, em português de Portugal) sobre o que está bem ou o que falta.\n\n"
        + "\n\n---\n\n".join(blocos_pedido)
        + "\n\nResponde APENAS com um objeto JSON válido, sem texto antes ou depois, no formato exato:\n"
        + "{" + formato_json + "}"
    )

    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1000,
            messages=[{"role": "user", "content": prompt}],
        )
        texto_resposta = next((bloco.text for bloco in response.content if bloco.type == 'text'), '{}')
        correcao_ia = json.loads(texto_resposta)
    except (anthropic.RateLimitError, anthropic.APIStatusError, anthropic.APIConnectionError, ValueError, TypeError):
        correcao_ia = {}

    for pergunta, _ in perguntas_longas:
        item = correcao_ia.get(pergunta['id']) if isinstance(correcao_ia, dict) else None
        if isinstance(item, dict) and isinstance(item.get('pontuacao'), (int, float)):
            pontos = max(0.0, min(float(pergunta['cotacao']), float(item['pontuacao'])))
            feedback = str(item.get('feedback', ''))[:500]
        else:
            pontos = 0
            feedback = 'Não foi possível obter a correção da IA para esta pergunta. Tenta submeter novamente.'
        resultado[pergunta['id']] = {'pontos': pontos, 'feedback': feedback}

    return resultado


@login_required(login_url='login')
@require_POST
def corrigir_teste_fotossintese(request, teste_id):
    config_teste = encontrar_config_teste(teste_id)
    if config_teste is None:
        raise Http404('Teste não encontrado.')

    try:
        perfil, _ = PerfilAluno.objects.get_or_create(user=request.user)
    except OperationalError:
        perfil = None

    plano_aluno = perfil.plano if perfil is not None else 'free'
    if config_teste['plano'] == 'pro' and plano_aluno != 'pro':
        return JsonResponse({'erro': 'Este teste está disponível apenas no plano SuperExplore.'}, status=403)

    try:
        dados_pedido = json.loads(request.body or '{}')
    except (TypeError, ValueError):
        return JsonResponse({'erro': 'Dados inválidos.'}, status=400)

    respostas_aluno = dados_pedido.get('respostas')
    if not isinstance(respostas_aluno, dict):
        return JsonResponse({'erro': 'Respostas em falta.'}, status=400)

    try:
        teste = carregar_teste(teste_id)
    except FileNotFoundError:
        raise Http404('Teste não encontrado.')

    resultado_perguntas = {}
    pontos_totais = 0.0
    perguntas_longas = []

    for pergunta in teste['perguntas']:
        resposta = respostas_aluno.get(pergunta['id'])
        if pergunta['tipo'] == 'resposta_longa':
            perguntas_longas.append((pergunta, resposta))
            continue
        pontos = corrigir_pergunta_automatica(pergunta, resposta)
        pontos_totais += pontos
        resultado_perguntas[pergunta['id']] = {'pontos': pontos, 'cotacao': pergunta['cotacao']}

    feedback_ia = {}
    if perguntas_longas:
        correcao_ia = corrigir_perguntas_longas_com_ia(perguntas_longas)
        for pergunta, _ in perguntas_longas:
            item = correcao_ia.get(pergunta['id'], {'pontos': 0, 'feedback': ''})
            resultado_perguntas[pergunta['id']] = {'pontos': item['pontos'], 'cotacao': pergunta['cotacao']}
            feedback_ia[pergunta['id']] = item['feedback']
            pontos_totais += item['pontos']

    nota_final = round(pontos_totais / (teste['cotacao_total'] / 20), 1)

    # O teste já foi corrigido — o rascunho de respostas em curso deixa de
    # fazer sentido (evita reaparecer pré-preenchido se o aluno repetir o
    # teste mais tarde).
    if perfil is not None:
        progresso_testes = dict(perfil.progresso_testes or {})
        if progresso_testes.pop(teste_id, None) is not None:
            perfil.progresso_testes = progresso_testes
            perfil.save(update_fields=['progresso_testes'])
        unidade = TESTE_ID_PARA_UNIDADE.get(teste_id, '')
        registar_resultado(request.user, 'teste', teste_id, unidade, nota_final / 20 * 100)

    return JsonResponse({
        'notaFinal': nota_final,
        'pontosTotais': round(pontos_totais, 2),
        'cotacaoTotal': teste['cotacao_total'],
        'perguntas': resultado_perguntas,
        'feedbackIA': feedback_ia,
    })


def pagina_conteudo(request):
    caminho_json = settings.BASE_DIR.parent / 'static' / 'conteudo.json'

    with open(caminho_json, 'r', encoding='utf-8') as f:
        dados = json.load(f)

    return render(request, 'mission.html', {'conteudo': dados})
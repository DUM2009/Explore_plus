from datetime import timedelta

from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save  # Importação necessária
from django.dispatch import receiver          # Importação necessária
from django.utils import timezone

# Perguntas semanais que cada plano tem direito a fazer ao Kim.
LIMITES_CHAT_SEMANAL = {
    'free': 10,
    'pro': 25,
}


def obter_limite_chat(plano):
    return LIMITES_CHAT_SEMANAL.get(plano, LIMITES_CHAT_SEMANAL['free'])


def inicio_da_semana_atual():
    hoje = timezone.localdate()
    return (hoje - timedelta(days=hoje.weekday())).isoformat()


# Título do aluno por nível. Cada tupla é (nível mínimo, nome, ícone,
# descrição curta). O nível 1 == 0 XP, e cada nível seguinte custa 100 XP
# a mais (ver PerfilAluno.nivel), por isso o nível 30 = 2900 XP.
TITULOS_POR_NIVEL = [
    (1, 'Aprendiz', '🌱', 'Começou a explorar.'),
    (5, 'Explorador', '🧭', 'Já domina os fundamentos.'),
    (10, 'Investigador', '🔍', 'Analisa e relaciona conceitos.'),
    (15, 'Cientista', '🧪', 'Resolve desafios complexos.'),
    (20, 'Especialista', '🎯', 'Domina uma disciplina.'),
    (25, 'Mestre', '👑', 'Alcançou um elevado nível de conhecimento.'),
    (30, 'Lenda Explore+', '🏆', 'Concluiu praticamente todo o conteúdo da plataforma.'),
]


def titulo_para_nivel(nivel):
    """Devolve (nivel_minimo, nome, icone, descricao) do título correspondente
    ao nível dado, e o mesmo para o título seguinte (ou None se for o último)."""
    atual = TITULOS_POR_NIVEL[0]
    seguinte = None
    for indice, (nivel_minimo, nome, icone, descricao) in enumerate(TITULOS_POR_NIVEL):
        if nivel >= nivel_minimo:
            atual = (nivel_minimo, nome, icone, descricao)
            seguinte = TITULOS_POR_NIVEL[indice + 1] if indice + 1 < len(TITULOS_POR_NIVEL) else None
        else:
            break
    return atual, seguinte


class PerfilAluno(models.Model):
    PLANOS = [('free', 'Free'), ('pro', 'Pro')]

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    pontos_xp = models.IntegerField(default=0)
    nivel = models.IntegerField(default=1)
    titulo_atual = models.CharField(max_length=100, default="Aprendiz")
    progresso_missoes = models.JSONField(default=dict, blank=True)
    progresso_secoes = models.JSONField(default=dict, blank=True)
    progresso_testes = models.JSONField(default=dict, blank=True)
    conquistas = models.JSONField(default=dict, blank=True)
    # Banco de perguntas erradas, por aluno — sobrevive entre sessões e
    # dispositivos (ao contrário do localStorage) para uma futura "simulação"
    # da IA poder voltar a questionar o aluno sobre o que já errou.
    # Chave: "<missionId>:<sectionId>:<questionIndex>". Valor:
    # {"missionId", "sectionId", "questionIndex", "pergunta", "vezesErrada",
    #  "ultimaVez" (ISO datetime)}. Uma resposta certa a essa mesma pergunta
    # remove-a daqui (ver registar_pergunta_errada em views.py).
    perguntas_erradas = models.JSONField(default=dict, blank=True)
    criado_em = models.DateTimeField(default=timezone.now)
    plano = models.CharField(max_length=4, choices=PLANOS, default='free')
    uso_chat_semana = models.JSONField(default=dict, blank=True)

    class Meta:
        app_label = 'meu_site'

    def __str__(self):
        return f"Perfil de {self.user.username} - Nível {self.nivel}"

    def verificar_e_incrementar_uso_chat(self):
        """
        Devolve True e regista mais uma pergunta se o aluno ainda tiver
        perguntas disponíveis esta semana; devolve False sem alterar nada
        se o limite já tiver sido atingido. Reinicia a contagem sozinho
        quando a semana atual guardada já não é a semana atual real.
        """
        semana_atual = inicio_da_semana_atual()
        uso = self.uso_chat_semana if isinstance(self.uso_chat_semana, dict) else {}

        if uso.get('semana_inicio') != semana_atual:
            uso = {'semana_inicio': semana_atual, 'perguntas': 0}

        limite = obter_limite_chat(self.plano)
        if uso.get('perguntas', 0) >= limite:
            self.uso_chat_semana = uso
            self.save(update_fields=['uso_chat_semana'])
            return False

        uso['perguntas'] = uso.get('perguntas', 0) + 1
        self.uso_chat_semana = uso
        self.save(update_fields=['uso_chat_semana'])
        return True


class InqueritoAluno(models.Model):
    ANOS_ESCOLARES = [('10', '10º ano'), ('11', '11º ano'), ('12', '12º ano')]

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    ano_escolar = models.CharField(max_length=2, choices=ANOS_ESCOLARES, blank=True)
    curso_pretendido = models.CharField(max_length=200, blank=True)
    # {"biologia": 7, "quimica": null, "fisica": 4, "geologia": 9, "matematica": 2}
    # null = aluno marcou "não tenho esta disciplina"
    niveis_disciplinas = models.JSONField(default=dict, blank=True)
    concluido = models.BooleanField(default=False)
    criado_em = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'meu_site'

    def __str__(self):
        return f"Inquérito de {self.user.username} ({'concluído' if self.concluido else 'pendente'})"

# Cria o PerfilAluno automaticamente ao cadastrar um novo User
@receiver(post_save, sender=User)
def criar_perfil_aluno(sender, instance, created, **kwargs):
    if created:
        PerfilAluno.objects.create(user=instance)

# Adiciona esta classe no final do teu meu_site/models.py

class PerguntaQuiz(models.Model):
    # Organiza as perguntas por categorias/missões
    CATEGORIAS = [
        ('fotossintese', 'Fotossíntese'),
        ('mitose', 'Mitose'),
        ('meiose', 'Meiose'),
    ]
    
    missao = models.CharField(max_length=50, choices=CATEGORIAS, default='fotossintese')
    enunciado = models.TextField(verbose_name="Pergunta")
    
    # As 4 opções possíveis para o aluno clicar
    opcao_a = models.CharField(max_length=250, verbose_name="Opção A")
    opcao_b = models.CharField(max_length=250, verbose_name="Opção B")
    opcao_c = models.CharField(max_length=250, verbose_name="Opção C")
    opcao_d = models.CharField(max_length=250, verbose_name="Opção D")
    
    # Define qual delas é a correta ('A', 'B', 'C' ou 'D')
    RESPOSTAS_POSSIVEIS = [
        ('A', 'Opção A'),
        ('B', 'Opção B'),
        ('C', 'Opção C'),
        ('D', 'Opção D'),
    ]
    resposta_correta = models.CharField(max_length=1, choices=RESPOSTAS_POSSIVEIS, verbose_name="Resposta Correta")
    
    # Quantos pontos de XP o aluno ganha se acertar nesta pergunta
    xp_recompensa = models.IntegerField(default=50, verbose_name="XP de Recompensa")

    class Meta:
        app_label = 'meu_site'
        verbose_name = "Pergunta de Quiz"
        verbose_name_plural = "Perguntas de Quiz"

    def __str__(self):
        return f"[{self.get_missao_display()}] {self.enunciado[:40]}..."

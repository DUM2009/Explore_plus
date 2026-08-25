from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save  # Importação necessária
from django.dispatch import receiver          # Importação necessária
from django.utils import timezone

class PerfilAluno(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    pontos_xp = models.IntegerField(default=0)
    nivel = models.IntegerField(default=1)
    titulo_atual = models.CharField(max_length=100, default="Explorador Aprendiz")
    progresso_missoes = models.JSONField(default=dict, blank=True)
    conquistas = models.JSONField(default=dict, blank=True)
    criado_em = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'meu_site'

    def __str__(self):
        return f"Perfil de {self.user.username} - Nível {self.nivel}"

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

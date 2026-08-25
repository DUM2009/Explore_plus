from django.contrib import admin
from .models import PerfilAluno, PerguntaQuiz

# 1. Configuração para ver os Perfis dos Alunos
@admin.register(PerfilAluno)
class PerfilAlunoAdmin(admin.ModelAdmin):
    list_display = ('user', 'pontos_xp', 'nivel', 'titulo_atual')
    list_filter = ('nivel',)
    search_fields = ('user__username', 'user__email', 'titulo_atual')
    ordering = ('-pontos_xp',)

# 2. Configuração para ver o teu Banco de Perguntas de Biologia
@admin.register(PerguntaQuiz)
class PerguntaQuizAdmin(admin.ModelAdmin):
    list_display = ('missao', 'enunciado', 'resposta_correta', 'xp_recompensa')
    list_filter = ('missao', 'resposta_correta')
    search_fields = ('enunciado',)

# 3. Personalização Visual do Painel
admin.site.site_header = 'Explore+ Administração'
admin.site.site_title = 'Explore+ Admin'
admin.site.index_title = 'Gestão da plataforma de Gamificação'

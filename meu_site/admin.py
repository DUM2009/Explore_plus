from django.contrib import admin
from .models import PerfilAluno, PerguntaQuiz


@admin.register(PerfilAluno)
class PerfilAlunoAdmin(admin.ModelAdmin):
	list_display = ('user', 'pontos_xp', 'nivel', 'titulo_atual', 'criado_em')
	list_filter = ('nivel', 'criado_em')
	search_fields = ('user__username', 'user__email', 'titulo_atual')
	ordering = ('-pontos_xp', '-criado_em')

	class Media:
		css = {
			'all': ('admin-custom.css',),
		}


@admin.register(PerguntaQuiz)
class PerguntaQuizAdmin(admin.ModelAdmin):
	list_display = ('enunciado_resumido', 'missao', 'resposta_correta', 'xp_recompensa')
	list_filter = ('missao', 'resposta_correta')
	search_fields = ('enunciado', 'opcao_a', 'opcao_b', 'opcao_c', 'opcao_d')
	ordering = ('missao', 'id')
	list_per_page = 25

	@admin.display(description='Pergunta')
	def enunciado_resumido(self, obj):
		return obj.enunciado[:90]

	class Media:
		css = {
			'all': ('admin-custom.css',),
		}


admin.site.site_header = 'Explore+ Administração'
admin.site.site_title = 'Explore+ Admin'
admin.site.index_title = 'Gestão da plataforma'

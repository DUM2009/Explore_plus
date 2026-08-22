from django.contrib import admin
from .models import PerfilAluno

# Isto obriga o modelo a aparecer no painel visual da administração
admin.site.register(PerfilAluno)

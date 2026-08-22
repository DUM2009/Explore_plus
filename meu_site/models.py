from django.db import models
from django.contrib.auth.models import User

class PerfilAluno(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    pontos_xp = models.IntegerField(default=0)
    nivel = models.IntegerField(default=1)
    titulo_atual = models.CharField(max_length=100, default="Explorador Aprendiz")

    class Meta:
        # Isto obriga o Django a entender que este modelo pertence à app 'meu_site'
        app_label = 'meu_site'

    def __str__(self):
        return f"Perfil de {self.user.username} - Nível {self.nivel}"

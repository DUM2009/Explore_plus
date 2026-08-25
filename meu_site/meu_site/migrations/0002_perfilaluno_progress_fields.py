from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [
        ('meu_site', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='perfilaluno',
            name='progresso_missoes',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='perfilaluno',
            name='conquistas',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name='perfilaluno',
            name='criado_em',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
    ]

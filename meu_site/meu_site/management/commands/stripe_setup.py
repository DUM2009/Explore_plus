import stripe
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

NOME_PRODUTO = 'SuperExplore'
PRECO_CENTIMOS = 499
MOEDA = 'eur'


class Command(BaseCommand):
    help = (
        "Cria (de forma idempotente) o Produto e o Preço do Stripe para a "
        "subscrição SuperExplore, usando STRIPE_SECRET_KEY do .env. "
        "Corre uma vez por conta/modo Stripe (teste e, mais tarde, live)."
    )

    def handle(self, *args, **options):
        if not settings.STRIPE_SECRET_KEY:
            raise CommandError(
                'STRIPE_SECRET_KEY não está definida no .env — define a tua '
                'chave secreta de teste (sk_test_...) antes de correr este comando.'
            )

        client = stripe.StripeClient(
            api_key=settings.STRIPE_SECRET_KEY,
            stripe_version=settings.STRIPE_API_VERSION,
        )

        produto = next(
            (p for p in client.products.list(active=True) if p.name == NOME_PRODUTO),
            None,
        )
        if produto is None:
            produto = client.products.create(name=NOME_PRODUTO)
            self.stdout.write(self.style.SUCCESS(f'Produto criado: {produto.id}'))
        else:
            self.stdout.write(f'Produto já existia: {produto.id}')

        preco = next(
            (
                p for p in client.prices.list(product=produto.id, active=True)
                if p.currency == MOEDA
                and p.unit_amount == PRECO_CENTIMOS
                and p.recurring
                and p.recurring.interval == 'month'
            ),
            None,
        )
        if preco is None:
            preco = client.prices.create(
                product=produto.id,
                currency=MOEDA,
                unit_amount=PRECO_CENTIMOS,
                recurring={'interval': 'month'},
            )
            self.stdout.write(self.style.SUCCESS(f'Preço criado: {preco.id}'))
        else:
            self.stdout.write(f'Preço já existia: {preco.id}')

        self.stdout.write(self.style.SUCCESS(
            f'\nColoca isto no teu .env:\nSTRIPE_PRICE_ID_PRO={preco.id}'
        ))

"""
Management command: seed_passwords

Utility to create a test admin user for development.

Usage:
    python manage.py seed_passwords --create-dev-admin \
        --admin-email admin@exam-e.local \
        --admin-password admin1234
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = 'Creates a dev superuser.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--create-dev-admin',
            action='store_true',
            default=False,
            help='Create a dev superuser if one does not already exist.',
        )
        parser.add_argument(
            '--admin-id',
            default='ADMIN001',
            help='university_id for the dev superuser (default: ADMIN001).',
        )
        parser.add_argument(
            '--admin-email',
            default='admin@exam-e.local',
            help='Email for the dev superuser (default: admin@exam-e.local).',
        )
        parser.add_argument(
            '--admin-password',
            default='changeme123',
            help='Password for the dev superuser (default: changeme123).',
        )
        parser.add_argument(
            '--admin-name',
            default='Dev Admin',
            help='full_name for the dev superuser (default: Dev Admin).',
        )

    def handle(self, *args, **options):

        # ── Create Dev Superuser ─────────────────────────────────────────────
        if options['create_dev_admin']:
            email = options['admin_email']
            uid = options['admin_id']
            if User.objects.filter(email=email).exists():
                self.stdout.write(
                    self.style.WARNING(f'Dev admin "{email}" already exists — skipped.')
                )
            else:
                User.objects.create_superuser(
                    email=email,
                    university_id=uid,
                    password=options['admin_password'],
                    full_name=options['admin_name'],
                )
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Dev superuser "{email}" created (ID: {uid}). '
                        f'Password: {options["admin_password"]}'
                    )
                )
        else:
            self.stdout.write('Use --create-dev-admin to create a superuser.')

        self.stdout.write(self.style.SUCCESS('seed_passwords complete.'))

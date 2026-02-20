"""
Management command: seed_passwords

Marks every existing user that still has the legacy `password_hash` stored
(i.e. the Django `password` field starts with `!invalid`) as having an
unusable password so that Django's auth stack treats them correctly.

Optionally, you can create a single test admin user for development.

Usage:
    # Mark all legacy users as needing a password reset (safe, non-destructive)
    python manage.py seed_passwords

    # Also create a dev superuser (skipped if university_id already exists)
    python manage.py seed_passwords --create-dev-admin --admin-id ADMIN001 --admin-password admin1234
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = (
        'Marks legacy users with an unusable Django password so they are '
        'prompted to reset it. Optionally creates a dev superuser.'
    )

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
        # ── Step 1: mark all legacy-password users unusable ──────────────────
        legacy = User.objects.filter(password='!invalid')
        count  = legacy.count()
        if count:
            legacy.update(password=User.objects.model().password if False else None)
            # bulk set to unusable via Python (update() bypasses set_unusable)
            ids = list(legacy.values_list('pk', flat=True))
            updated = 0
            for user in User.objects.filter(pk__in=ids):
                user.set_unusable_password()
                user.save(update_fields=['password'])
                updated += 1
            self.stdout.write(
                self.style.SUCCESS(
                    f'Marked {updated} legacy user(s) as having an unusable password.'
                )
            )
        else:
            self.stdout.write('No legacy-password users found — nothing to update.')

        # ── Step 2: migrate is_staff/is_superuser from role ─────────────────
        admin_updated = User.objects.filter(role='ADMIN', is_superuser=False).count()
        User.objects.filter(role='ADMIN').update(is_superuser=True, is_staff=True)
        coord_updated = User.objects.filter(role='COORDINATOR', is_staff=False).count()
        User.objects.filter(role='COORDINATOR').update(is_staff=True)
        if admin_updated or coord_updated:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Updated flags: {admin_updated} ADMIN(s), {coord_updated} COORDINATOR(s).'
                )
            )

        # ── Step 3: optionally create a dev superuser ────────────────────────
        if options['create_dev_admin']:
            uid = options['admin_id']
            if User.objects.filter(university_id=uid).exists():
                self.stdout.write(
                    self.style.WARNING(f'Dev admin "{uid}" already exists — skipped.')
                )
            else:
                User.objects.create_superuser(
                    university_id=uid,
                    password=options['admin_password'],
                    full_name=options['admin_name'],
                    email='admin@exam-e.local',
                )
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Dev superuser "{uid}" created. '
                        f'Password: {options["admin_password"]}'
                    )
                )

        self.stdout.write(self.style.SUCCESS('seed_passwords complete.'))

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='exampaper',
            name='markings_index',
            field=models.JSONField(blank=True, null=True),
        ),
    ]

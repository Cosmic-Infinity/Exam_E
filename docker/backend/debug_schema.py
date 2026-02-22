import os
import django
from django.db import connection

# Configure Django settings
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

def debug_schema():
    print("--- SCHEMA DEBUG ---")
    with connection.cursor() as cursor:
        cursor.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'courses';")
        columns = cursor.fetchall()
        print(f"Columns in 'courses' table: {columns}")

if __name__ == "__main__":
    debug_schema()

import os
import django
from django.conf import settings

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Student, User

print(f"DB Engine: {settings.DATABASES['default']['ENGINE']}")
print(f"DB Host: {settings.DATABASES['default']['HOST']}")
print(f"DB Name: {settings.DATABASES['default']['NAME']}")

print("Checking Users count...")
try:
    user_count = User.objects.count()
    print(f"Users found: {user_count}")
except Exception as e:
    print(f"Error fetching users: {e}")

print("Checking Students count...")
try:
    student_count = Student.objects.count()
    print(f"Students found: {student_count}")
except Exception as e:
    print(f"Error fetching students: {e}")

print("Checking first student...")
try:
    s = Student.objects.first()
    if s:
        print(f"Student: {s.user_id} - {s.user.email} - Stream: {s.stream}")
    else:
        print("No student found via ORM")
except Exception as e:
    print(f"Error fetching first student: {e}")

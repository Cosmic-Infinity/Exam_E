#!/bin/sh

# Wait for database (simple check or use wait-for-it)
# Here we assume the app handles it or we can add a check if needed.

# Run migrations
python manage.py migrate --noinput

# Collect static files
python manage.py collectstatic --noinput

# Execute the CMD passed in Dockerfile/compose
exec "$@"

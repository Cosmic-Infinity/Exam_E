import time
from django.core.cache import cache

FAILED_ATTEMPTS_PREFIX = 'auth:failed_attempts:'
ACCOUNT_LOCKOUT_PREFIX = 'auth:account_locked:'

MAX_FAILED_ATTEMPTS = 10
LOCKOUT_DURATION = 900
PROGRESSIVE_DELAY_THRESHOLD = 3

PROGRESSIVE_DELAYS = {
    3: 2,
    4: 5,
}
DEFAULT_PROGRESSIVE_DELAY = 10
IP_SOFT_LIMIT = 4000


def get_failed_attempts_key(email):
    return f"{FAILED_ATTEMPTS_PREFIX}{email.lower()}"


def get_lockout_key(email):
    return f"{ACCOUNT_LOCKOUT_PREFIX}{email.lower()}"


def increment_failed_attempts(email):
    key = get_failed_attempts_key(email)
    current_count = cache.get(key, 0)
    new_count = current_count + 1
    cache.set(key, new_count, LOCKOUT_DURATION + 60)
    return new_count


def reset_failed_attempts(email):
    cache.delete(get_failed_attempts_key(email))


def get_failed_attempts(email):
    return cache.get(get_failed_attempts_key(email), 0)


def lock_account(email, duration=LOCKOUT_DURATION):
    cache.set(get_lockout_key(email), True, duration)


def unlock_account(email):
    cache.delete(get_lockout_key(email))


def is_account_locked(email):
    return cache.get(get_lockout_key(email), False)


def get_progressive_delay(failed_attempts):
    if failed_attempts < PROGRESSIVE_DELAY_THRESHOLD:
        return 0
    return PROGRESSIVE_DELAYS.get(failed_attempts, DEFAULT_PROGRESSIVE_DELAY)


def apply_progressive_delay(failed_attempts):
    delay = get_progressive_delay(failed_attempts)
    if delay > 0:
        time.sleep(delay)


def check_login_security(email):
    if is_account_locked(email):
        return {
            'allowed': False,
            'error': 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.',
            'status_code': 403,
            'delay': 0,
        }

    failed_attempts = get_failed_attempts(email)
    delay = get_progressive_delay(failed_attempts)

    return {
        'allowed': True,
        'error': None,
        'status_code': None,
        'delay': delay,
    }


def handle_login_failure(email):
    failed_attempts = increment_failed_attempts(email)

    if failed_attempts >= MAX_FAILED_ATTEMPTS:
        lock_account(email)
        return {
            'locked': True,
            'attempts': failed_attempts,
            'error': 'Account locked: Too many failed login attempts. Try again in 15 minutes.',
            'status_code': 403,
        }

    return {
        'locked': False,
        'attempts': failed_attempts,
        'error': 'Invalid credentials',
        'status_code': 401,
    }


def handle_login_success(email):
    reset_failed_attempts(email)
    unlock_account(email)

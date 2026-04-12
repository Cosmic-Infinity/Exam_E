"""
auth_security.py

Smart, user-centric authentication security for shared network environments.
Implements account-based rate limiting, progressive delays, and lockout mechanisms.

Design:
  - Track failed login attempts per USERNAME (not IP) using Django cache
  - After 10 consecutive failed attempts: lock account for 10-15 minutes
  - After 3 failed attempts: introduce progressive delays (2s, 5s, 10s)
  - Reset counter on successful login
  - Maintain high IP-only soft limit (4000-5000/min) only for extreme abuse prevention

Security Goals:
  - Protect against brute-force attacks
  - Protect against credential stuffing
  - Works reliably with shared IPs (campus networks, NAT environments)
  - Scales to thousands of simultaneous users
"""

import time
from django.core.cache import cache
from django.conf import settings


# ─────────────────────────────────────────────────────────────────────────────
# Configuration Constants
# ─────────────────────────────────────────────────────────────────────────────

# Cache key prefixes for failed attempts and lockout state
FAILED_ATTEMPTS_PREFIX = 'auth:failed_attempts:'
ACCOUNT_LOCKOUT_PREFIX = 'auth:account_locked:'

# Security thresholds
MAX_FAILED_ATTEMPTS = 10  # Lock account after this many failed attempts
LOCKOUT_DURATION = 900  # 15 minutes in seconds
PROGRESSIVE_DELAY_THRESHOLD = 3  # Start delays after 3rd failed attempt

# Progressive delays (in seconds) by failed attempt count
# After 3 failed attempts: 2s delay
# After 4 failed attempts: 5s delay
# After 5+ failed attempts: 10s delay
PROGRESSIVE_DELAYS = {
    3: 2,
    4: 5,
}
DEFAULT_PROGRESSIVE_DELAY = 10  # For attempts >= 5

# Very high soft limit on IP level (only for extreme abuse)
# This prevents a single actor from making thousands of requests
IP_SOFT_LIMIT = 4000  # per minute per IP


# ─────────────────────────────────────────────────────────────────────────────
# Cache helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_failed_attempts_key(email):
    """Generate cache key for failed login attempts for a user."""
    return f"{FAILED_ATTEMPTS_PREFIX}{email.lower()}"


def get_lockout_key(email):
    """Generate cache key for account lockout status."""
    return f"{ACCOUNT_LOCKOUT_PREFIX}{email.lower()}"


# ─────────────────────────────────────────────────────────────────────────────
# Failed attempt tracking
# ─────────────────────────────────────────────────────────────────────────────

def increment_failed_attempts(email):
    """
    Increment the failed login attempt counter for a user.
    Returns the new attempt count.
    
    Cache TTL: set to LOCKOUT_DURATION + 60 seconds buffer to ensure
    the counter expires if no further login attempts occur.
    """
    key = get_failed_attempts_key(email)
    
    # Get current count or start at 0
    current_count = cache.get(key, 0)
    new_count = current_count + 1
    
    # Store with TTL of lockout duration + buffer
    cache.set(key, new_count, LOCKOUT_DURATION + 60)
    
    return new_count


def reset_failed_attempts(email):
    """
    Reset the failed login attempt counter (called on successful login).
    """
    key = get_failed_attempts_key(email)
    cache.delete(key)


def get_failed_attempts(email):
    """
    Get the current failed login attempt count for a user.
    Returns 0 if no attempts recorded.
    """
    key = get_failed_attempts_key(email)
    return cache.get(key, 0)


# ─────────────────────────────────────────────────────────────────────────────
# Account lockout management
# ─────────────────────────────────────────────────────────────────────────────

def lock_account(email, duration=LOCKOUT_DURATION):
    """
    Lock an account temporarily after too many failed attempts.
    
    Args:
        email: User's email address
        duration: Lock duration in seconds (default: 15 minutes)
    """
    key = get_lockout_key(email)
    cache.set(key, True, duration)


def unlock_account(email):
    """
    Manually unlock an account (admin action or password reset).
    """
    key = get_lockout_key(email)
    cache.delete(key)


def is_account_locked(email):
    """
    Check if an account is currently locked.
    Returns True if locked, False otherwise.
    """
    key = get_lockout_key(email)
    return cache.get(key, False)


# ─────────────────────────────────────────────────────────────────────────────
# Progressive delay logic
# ─────────────────────────────────────────────────────────────────────────────

def get_progressive_delay(failed_attempts):
    """
    Calculate progressive delay in seconds based on failed attempt count.
    
    Examples:
        - 0-2 attempts: 0s delay
        - 3 attempts: 2s delay
        - 4 attempts: 5s delay
        - 5+ attempts: 10s delay
    
    Args:
        failed_attempts: Current count of failed login attempts
        
    Returns:
        Delay in seconds
    """
    if failed_attempts < PROGRESSIVE_DELAY_THRESHOLD:
        return 0
    
    # Use specific delays from PROGRESSIVE_DELAYS dict, or default
    return PROGRESSIVE_DELAYS.get(failed_attempts, DEFAULT_PROGRESSIVE_DELAY)


def apply_progressive_delay(failed_attempts):
    """
    Apply progressive delay based on failed attempt count.
    This is called BEFORE processing the login to prevent rapid brute-force.
    
    Args:
        failed_attempts: Current count of failed login attempts
    """
    delay = get_progressive_delay(failed_attempts)
    if delay > 0:
        time.sleep(delay)


# ─────────────────────────────────────────────────────────────────────────────
# High-level security checks
# ─────────────────────────────────────────────────────────────────────────────

def check_login_security(email):
    """
    Perform all security checks before attempting login.
    
    Args:
        email: User's email address
        
    Returns:
        {
            'allowed': bool,
            'error': str or None,
            'status_code': int or None,
            'delay': float  # seconds to delay before response
        }
        
    Returns a dict with:
        - allowed: Whether login attempt should proceed
        - error: Human-readable error message (if not allowed)
        - status_code: HTTP status code to return (if not allowed)
        - delay: Delay to apply before processing
    """
    # 1. Check if account is locked
    if is_account_locked(email):
        return {
            'allowed': False,
            'error': 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.',
            'status_code': 403,  # Forbidden
            'delay': 0,
        }
    
    # 2. Get current failed attempts
    failed_attempts = get_failed_attempts(email)
    
    # 3. Apply progressive delay if needed
    delay = get_progressive_delay(failed_attempts)
    
    return {
        'allowed': True,
        'error': None,
        'status_code': None,
        'delay': delay,
    }


def handle_login_failure(email):
    """
    Handle a failed login attempt.
    
    - Increments failed attempt counter
    - Locks account if threshold is reached
    
    Args:
        email: User's email address
        
    Returns:
        {
            'locked': bool,  # True if account just got locked
            'attempts': int,  # New failed attempt count
            'error': str,  # Appropriate error message
            'status_code': int,  # HTTP status code
        }
    """
    failed_attempts = increment_failed_attempts(email)
    
    # Check if we've hit the lockout threshold
    if failed_attempts >= MAX_FAILED_ATTEMPTS:
        lock_account(email)
        return {
            'locked': True,
            'attempts': failed_attempts,
            'error': 'Account locked: Too many failed login attempts. Try again in 15 minutes.',
            'status_code': 403,  # Forbidden
        }
    
    # Still under threshold, return general invalid credentials error
    # (don't reveal how many attempts remaining)
    return {
        'locked': False,
        'attempts': failed_attempts,
        'error': 'Invalid credentials',
        'status_code': 401,  # Unauthorized
    }


def handle_login_success(email):
    """
    Handle a successful login attempt.
    
    - Resets failed attempt counter
    - Removes any account lockout
    
    Args:
        email: User's email address
    """
    reset_failed_attempts(email)
    unlock_account(email)

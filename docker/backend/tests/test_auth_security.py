"""
tests/test_auth_security.py

Test suite for the authentication security system.
Tests account-based rate limiting, progressive delays, and lockout mechanism.

Usage:
    python manage.py test tests.test_auth_security
    python manage.py test tests.test_auth_security.AuthSecurityTests.test_account_lockout
"""

from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
import time
from rest_framework_simplejwt.tokens import RefreshToken

from core.api.auth_security import (
    check_login_security,
    handle_login_failure,
    handle_login_success,
    get_failed_attempts,
    is_account_locked,
    lock_account,
    unlock_account,
    get_progressive_delay,
    FAILED_ATTEMPTS_PREFIX,
    ACCOUNT_LOCKOUT_PREFIX,
    MAX_FAILED_ATTEMPTS,
    PROGRESSIVE_DELAY_THRESHOLD,
)

User = get_user_model()


class AuthSecurityTests(TestCase):
    """Test core security functions without making HTTP requests."""
    
    def setUp(self):
        """Clear cache and create test user."""
        cache.clear()
        self.test_email = 'test@kiit.ac.in'
    
    def tearDown(self):
        """Clean up after each test."""
        cache.clear()
    
    # ────────────────────────────────────────────────────────────────────────
    # Test: Failed Attempt Tracking
    # ────────────────────────────────────────────────────────────────────────
    
    def test_increment_failed_attempts(self):
        """Test that failed attempts are tracked correctly."""
        email = self.test_email
        
        # Initial state
        self.assertEqual(get_failed_attempts(email), 0)
        
        # First failure
        handle_login_failure(email)
        self.assertEqual(get_failed_attempts(email), 1)
        
        # Second failure
        handle_login_failure(email)
        self.assertEqual(get_failed_attempts(email), 2)
        
        # Third failure
        handle_login_failure(email)
        self.assertEqual(get_failed_attempts(email), 3)
    
    def test_reset_failed_attempts_on_success(self):
        """Test that failed attempts are reset on successful login."""
        email = self.test_email
        
        # Fail 5 times
        for i in range(5):
            handle_login_failure(email)
        
        self.assertEqual(get_failed_attempts(email), 5)
        
        # Success should reset
        handle_login_success(email)
        self.assertEqual(get_failed_attempts(email), 0)
    
    # ────────────────────────────────────────────────────────────────────────
    # Test: Progressive Delays
    # ────────────────────────────────────────────────────────────────────────
    
    def test_progressive_delay_thresholds(self):
        """Test that progressive delays increase with failed attempts."""
        # 0-2 attempts: no delay
        self.assertEqual(get_progressive_delay(0), 0)
        self.assertEqual(get_progressive_delay(1), 0)
        self.assertEqual(get_progressive_delay(2), 0)
        
        # 3+ attempts: increasing delays
        self.assertEqual(get_progressive_delay(3), 2)   # 2 seconds
        self.assertEqual(get_progressive_delay(4), 5)   # 5 seconds
        self.assertEqual(get_progressive_delay(5), 10)  # 10 seconds
        self.assertEqual(get_progressive_delay(6), 10)  # 10 seconds
        self.assertEqual(get_progressive_delay(9), 10)  # 10 seconds
    
    def test_no_delay_before_threshold(self):
        """Test that no delay is applied before threshold."""
        email = self.test_email
        
        for i in range(PROGRESSIVE_DELAY_THRESHOLD - 1):
            handle_login_failure(email)
            result = check_login_security(email)
            self.assertEqual(result['delay'], 0, 
                f"Should have no delay at attempt {i+1}")
    
    def test_delay_after_threshold(self):
        """Test that delay is applied after threshold."""
        email = self.test_email
        
        # Reach threshold
        for i in range(PROGRESSIVE_DELAY_THRESHOLD):
            handle_login_failure(email)
        
        result = check_login_security(email)
        self.assertGreater(result['delay'], 0,
            f"Should have delay after {PROGRESSIVE_DELAY_THRESHOLD} attempts")
    
    # ────────────────────────────────────────────────────────────────────────
    # Test: Account Lockout
    # ────────────────────────────────────────────────────────────────────────
    
    def test_account_locked_after_max_attempts(self):
        """Test that account locks after MAX_FAILED_ATTEMPTS."""
        email = self.test_email
        
        # Below threshold: not locked
        for i in range(MAX_FAILED_ATTEMPTS - 1):
            handle_login_failure(email)
            self.assertFalse(is_account_locked(email),
                f"Account should not be locked at attempt {i+1}")
        
        # At threshold: locked
        handle_login_failure(email)
        self.assertTrue(is_account_locked(email),
            f"Account should be locked at attempt {MAX_FAILED_ATTEMPTS}")
    
    def test_locked_account_blocks_login(self):
        """Test that login is blocked when account is locked."""
        email = self.test_email
        
        # Lock the account
        lock_account(email)
        
        result = check_login_security(email)
        self.assertFalse(result['allowed'])
        self.assertEqual(result['status_code'], 403)
        self.assertIn('temporarily locked', result['error'])
    
    def test_manual_lock_and_unlock(self):
        """Test manual account locking and unlocking."""
        email = self.test_email
        
        # Initially not locked
        self.assertFalse(is_account_locked(email))
        
        # Lock it
        lock_account(email)
        self.assertTrue(is_account_locked(email))
        
        # Unlock it
        unlock_account(email)
        self.assertFalse(is_account_locked(email))
    
    def test_lockout_returns_403_status(self):
        """Test that locked accounts get 403 Forbidden."""
        email = self.test_email
        
        # Trigger lockout
        for i in range(MAX_FAILED_ATTEMPTS):
            handle_login_failure(email)
        
        result = check_login_security(email)
        self.assertEqual(result['status_code'], 403)
    
    # ────────────────────────────────────────────────────────────────────────
    # Test: Security Check Function
    # ────────────────────────────────────────────────────────────────────────
    
    def test_check_login_security_format(self):
        """Test that check_login_security returns correct dict format."""
        result = check_login_security(self.test_email)
        
        self.assertIn('allowed', result)
        self.assertIn('error', result)
        self.assertIn('status_code', result)
        self.assertIn('delay', result)
        
        # Fresh account should be allowed
        self.assertTrue(result['allowed'])
        self.assertIsNone(result['error'])
        self.assertIsNone(result['status_code'])
        self.assertEqual(result['delay'], 0)
    
    def test_check_login_security_multiple_calls(self):
        """Test that check_login_security doesn't modify state."""
        email = self.test_email
        
        # Multiple calls should be idempotent
        result1 = check_login_security(email)
        result2 = check_login_security(email)
        result3 = check_login_security(email)
        
        self.assertEqual(result1, result2)
        self.assertEqual(result2, result3)
    
    # ────────────────────────────────────────────────────────────────────────
    # Test: Handle Login Failure Function
    # ────────────────────────────────────────────────────────────────────────
    
    def test_handle_login_failure_response_format(self):
        """Test that handle_login_failure returns correct format."""
        result = handle_login_failure(self.test_email)
        
        self.assertIn('locked', result)
        self.assertIn('attempts', result)
        self.assertIn('error', result)
        self.assertIn('status_code', result)
        
        # First failure should not lock
        self.assertFalse(result['locked'])
        self.assertEqual(result['status_code'], 401)
        self.assertEqual(result['attempts'], 1)
    
    def test_handle_login_failure_returns_401_until_locked(self):
        """Test that 401 is returned until account is locked."""
        email = self.test_email
        
        for i in range(MAX_FAILED_ATTEMPTS - 1):
            result = handle_login_failure(email)
            self.assertEqual(result['status_code'], 401,
                f"Should return 401 at attempt {i+1}")
            self.assertFalse(result['locked'])
        
        # Final failure locks the account
        result = handle_login_failure(email)
        self.assertEqual(result['status_code'], 403)
        self.assertTrue(result['locked'])
    
    # ────────────────────────────────────────────────────────────────────────
    # Test: Cache Key Generation
    # ────────────────────────────────────────────────────────────────────────
    
    def test_cache_keys_are_email_based(self):
        """Test that cache keys use email addresses."""
        email = self.test_email
        
        # Increment to create cache entry
        handle_login_failure(email)
        
        # Check that cache keys exist
        expected_prefix = f'{FAILED_ATTEMPTS_PREFIX}{email.lower()}'
        cache_value = cache.get(expected_prefix)
        self.assertEqual(cache_value, 1)
    
    def test_email_case_insensitivity(self):
        """Test that email addresses are case-insensitive for caching."""
        email_lower = 'test@kiit.ac.in'
        email_upper = 'TEST@KIIT.AC.IN'
        
        # Fail with lowercase
        handle_login_failure(email_lower)
        
        # Check with uppercase
        attempts = get_failed_attempts(email_upper)
        self.assertEqual(attempts, 1,
            "Should retrieve same cache entry regardless of email case")


class LoginViewSecurityTests(TestCase):
    """Integration tests using the Django test client."""
    
    def setUp(self):
        """Create test user and client."""
        cache.clear()
        self.client = Client()
        
        # Create test user
        self.user = User.objects.create_user(
            email='student@kiit.ac.in',
            password='TestPassword123',
            university_id='2305101',
            full_name='Test Student',
            role='STUDENT',
        )
    
    def tearDown(self):
        """Clean up after tests."""
        cache.clear()
    
    # ────────────────────────────────────────────────────────────────────────
    # Test: Successful Login
    # ────────────────────────────────────────────────────────────────────────
    
    def test_successful_login_returns_200(self):
        """Test that valid credentials return 200 OK."""
        response = self.client.post('/api/auth/login/', {
            'email': 'student@kiit.ac.in',
            'password': 'TestPassword123',
        }, content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        self.assertIn('message', response.json())
        self.assertEqual(response.json()['message'], 'Login successful')
    
    def test_successful_login_sets_cookies(self):
        """Test that successful login sets auth cookies."""
        response = self.client.post('/api/auth/login/', {
            'email': 'student@kiit.ac.in',
            'password': 'TestPassword123',
        }, content_type='application/json')
        
        # Check cookies were set
        self.assertIn('access_token', response.cookies)
        self.assertIn('refresh_token', response.cookies)
    
    def test_successful_login_resets_failed_attempts(self):
        """Test that successful login resets failed attempt counter."""
        email = 'student@kiit.ac.in'
        
        # Fail a few times
        for i in range(3):
            self.client.post('/api/auth/login/', {
                'email': email,
                'password': 'WrongPassword',
            }, content_type='application/json')
        
        # Should have 3 failed attempts
        self.assertEqual(get_failed_attempts(email), 3)
        
        # Successful login should reset
        response = self.client.post('/api/auth/login/', {
            'email': email,
            'password': 'TestPassword123',
        }, content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(get_failed_attempts(email), 0)
    
    # ────────────────────────────────────────────────────────────────────────
    # Test: Invalid Credentials
    # ────────────────────────────────────────────────────────────────────────
    
    def test_invalid_credentials_returns_401(self):
        """Test that invalid credentials return 401."""
        response = self.client.post('/api/auth/login/', {
            'email': 'student@kiit.ac.in',
            'password': 'WrongPassword',
        }, content_type='application/json')
        
        self.assertEqual(response.status_code, 401)
        self.assertIn('error', response.json())
    
    def test_invalid_credentials_increments_counter(self):
        """Test that failed login increments counter."""
        email = 'student@kiit.ac.in'
        
        # Should start at 0
        self.assertEqual(get_failed_attempts(email), 0)
        
        # One failed attempt
        self.client.post('/api/auth/login/', {
            'email': email,
            'password': 'WrongPassword',
        }, content_type='application/json')
        
        self.assertEqual(get_failed_attempts(email), 1)
        
        # Second failed attempt
        self.client.post('/api/auth/login/', {
            'email': email,
            'password': 'AnotherWrongPassword',
        }, content_type='application/json')
        
        self.assertEqual(get_failed_attempts(email), 2)
    
    # ────────────────────────────────────────────────────────────────────────
    # Test: Account Lockout (Integration)
    # ────────────────────────────────────────────────────────────────────────
    
    def test_account_locks_after_10_failures(self):
        """Test that account locks after 10 failed attempts."""
        email = 'student@kiit.ac.in'
        
        # 10 failed attempts
        for i in range(10):
            response = self.client.post('/api/auth/login/', {
                'email': email,
                'password': 'WrongPassword',
            }, content_type='application/json')
            
            if i < 9:
                # Should not be locked yet
                self.assertEqual(response.status_code, 401,
                    f"Should be 401 at attempt {i+1}")
            else:
                # 10th attempt should lock
                pass  # Check next test
        
        # 11th attempt should be locked (403)
        response = self.client.post('/api/auth/login/', {
            'email': email,
            'password': 'TestPassword123',  # Even with correct password!
        }, content_type='application/json')
        
        self.assertEqual(response.status_code, 403)
        self.assertIn('temporarily locked', response.json()['error'])
    
    def test_locked_account_rejects_even_correct_password(self):
        """Test that locked account rejects login even with correct password."""
        email = 'student@kiit.ac.in'
        
        # Lock the account
        lock_account(email)
        
        # Try to login with correct password
        response = self.client.post('/api/auth/login/', {
            'email': email,
            'password': 'TestPassword123',
        }, content_type='application/json')
        
        self.assertEqual(response.status_code, 403)
        self.assertIn('temporarily locked', response.json()['error'])
    
    # ────────────────────────────────────────────────────────────────────────
    # Test: Shared IP (Multiple Users)
    # ────────────────────────────────────────────────────────────────────────
    
    def test_failed_attempts_isolated_by_email(self):
        """Test that failed attempts don't affect other users."""
        email1 = 'student@kiit.ac.in'
        email2 = 'another@kiit.ac.in'
        
        # Create second user
        User.objects.create_user(
            email=email2,
            password='Password456',
            university_id='2305102',
            full_name='Another Student',
            role='STUDENT',
        )
        
        # Fail login for user 1
        for i in range(3):
            self.client.post('/api/auth/login/', {
                'email': email1,
                'password': 'WrongPassword',
            }, content_type='application/json')
        
        # User 2 should have 0 failed attempts
        self.assertEqual(get_failed_attempts(email1), 3)
        self.assertEqual(get_failed_attempts(email2), 0)
        
        # User 2 should still be able to login
        response = self.client.post('/api/auth/login/', {
            'email': email2,
            'password': 'Password456',
        }, content_type='application/json')
        
        self.assertEqual(response.status_code, 200,
            "User 2 should login successfully despite User 1's failures")
    
    # ────────────────────────────────────────────────────────────────────────
    # Test: Edge Cases
    # ────────────────────────────────────────────────────────────────────────
    
    def test_missing_email_returns_400(self):
        """Test that missing email returns 400."""
        response = self.client.post('/api/auth/login/', {
            'password': 'TestPassword123',
        }, content_type='application/json')
        
        self.assertEqual(response.status_code, 400)
        self.assertIn('required', response.json()['error'])
    
    def test_missing_password_returns_400(self):
        """Test that missing password returns 400."""
        response = self.client.post('/api/auth/login/', {
            'email': 'student@kiit.ac.in',
        }, content_type='application/json')
        
        self.assertEqual(response.status_code, 400)
        self.assertIn('required', response.json()['error'])
    
    def test_inactive_user_returns_401(self):
        """Test that inactive user returns 401."""
        # Deactivate user
        self.user.is_active = False
        self.user.save()
        
        response = self.client.post('/api/auth/login/', {
            'email': 'student@kiit.ac.in',
            'password': 'TestPassword123',
        }, content_type='application/json')
        
        self.assertEqual(response.status_code, 401)
    
    def test_nonexistent_user_returns_401(self):
        """Test that nonexistent user returns 401."""
        response = self.client.post('/api/auth/login/', {
            'email': 'nonexistent@kiit.ac.in',
            'password': 'SomePassword',
        }, content_type='application/json')
        
        self.assertEqual(response.status_code, 401)


class TokenRevocationTests(TestCase):
    """Tests for immediate revocation behavior after token blacklisting."""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(
            email='revocation@kiit.ac.in',
            password='TestPassword123',
            university_id='2305999',
            full_name='Revocation User',
            role='STUDENT',
        )

    def test_blacklisted_refresh_forces_next_request_unauthorized(self):
        """A manually blacklisted refresh token should invalidate session immediately."""
        login_response = self.client.post('/api/auth/login/', {
            'email': 'revocation@kiit.ac.in',
            'password': 'TestPassword123',
        }, content_type='application/json')
        self.assertEqual(login_response.status_code, 200)

        ok_response = self.client.get('/api/me/')
        self.assertEqual(ok_response.status_code, 200)

        raw_refresh = self.client.cookies.get('refresh_token').value
        refresh = RefreshToken(raw_refresh)
        refresh.blacklist()

        revoked_response = self.client.get('/api/me/')
        self.assertEqual(revoked_response.status_code, 401)


class CacheExpirationTests(TestCase):
    """Test cache expiration and TTL behavior."""
    
    def setUp(self):
        cache.clear()
        self.test_email = 'expire@kiit.ac.in'
    
    def tearDown(self):
        cache.clear()
    
    def test_failed_attempts_expire(self):
        """Test that failed attempt counter expires."""
        email = self.test_email
        
        # Create a failed attempt with short TTL (for testing)
        # In production, this is LOCKOUT_DURATION + 60
        cache.set(f'{FAILED_ATTEMPTS_PREFIX}{email.lower()}', 5, timeout=1)
        
        # Should exist immediately
        self.assertEqual(get_failed_attempts(email), 5)
        
        # Wait for expiration
        time.sleep(1.1)
        
        # Should expire
        self.assertEqual(get_failed_attempts(email), 0)

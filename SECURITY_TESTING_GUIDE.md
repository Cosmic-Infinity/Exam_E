# Security Penetration Testing - Quick Reference Guide

## Overview

This guide explains how to run the comprehensive security penetration test suite for Exam_E.

## Prerequisites

- Docker containers running (`docker compose up -d`)
- Curl installed (macOS has it by default)
- Access to test credentials:
  - **Student:** `2305101@kiit.ac.in` / `Check@123`
  - **Faculty:** `kavita.mishra@example.com` / `Check@123`
  - **Admin:** `admin@kiit.ac.in` / `admin`

## Quick Start

```bash
cd /Users/prom1/Documents/Exam_E

# Run all tests with default settings
./scripts/security_pentest.sh

# Run with custom base URL
BASE_URL=https://yourdomain.com ./scripts/security_pentest.sh

# Run with custom credentials
STUDENT_EMAIL=2305102@kiit.ac.in STUDENT_PASS=Check@123 ./scripts/security_pentest.sh
```

## Test Phases Explained

| Phase | Name | Tests | Purpose |
|-------|------|-------|---------|
| **P0** | Authentication & Session Management | 6 | Verify login/session security |
| **P1** | Unauthenticated File Access | 5 | Ensure files require authentication |
| **P2** | Authenticated File Access | 4 | Verify authenticated students can access own files |
| **P3** | Cross-Student IDOR | 5 | Prevent students from accessing other students' papers |
| **P4** | Role-Based Access Control | 5 | Verify role separation (student/faculty/admin) |
| **P5** | Path Traversal & Special Cases | 4 | Block directory traversal attacks |
| **P6** | HTTP Header Injection | 2 | Verify headers can't bypass auth |
| **P7** | Authentication Bypass | 3 | Test JWT tampering/expiry handling |
| **P8** | CORS & CSRF Protection | 2 | Check cross-origin and CSRF safeguards |
| **P9** | Information Disclosure | 3 | Verify no sensitive info leaks in errors |
| **P10** | Rate Limiting & DOS | 1 | Check if rate limiting is implemented |
| **P11** | Input Validation & Injection | 3 | Test SQL/XSS/Command injection protection |

## Output Interpretation

### Success Output
```
=== TEST SUMMARY ===
Total Tests:  40
Passed:       40
Failed:        0

Pass Rate:    100%

✓ ALL TESTS PASSED - SECURITY HARDENING VERIFIED
```

### Failure Output
```
=== TEST SUMMARY ===
Total Tests:  40
Passed:       38
Failed:        2

Pass Rate:    95%

✗ SOME TESTS FAILED - REVIEW REQUIRED
```

**If failures occur:**
1. Check that containers are running: `docker compose ps`
2. Check backend logs: `docker compose logs backend | tail -50`
3. Verify test credentials are correct
4. Run individual test phase for debugging

## Individual Test Execution

To run specific test phases, edit `security_pentest.sh` and comment out unwanted phases:

```bash
# Example: Run only authentication tests (P0) and IDOR tests (P3)

# Comment out lines like:
# log_header "PHASE 1: ..."
# P1.1 test...
```

Or create a wrapper script:

```bash
#!/bin/bash
# run_specific_tests.sh

BASE_URL=http://localhost
STUDENT_EMAIL=2305101@kiit.ac.in
STUDENT_PASS=Check@123

# Run only P0 + P1
./scripts/security_pentest.sh 2>&1 | grep -E "^(===|TEST:|✓|✗|Total|Passed|Failed|Pass Rate)"
```

## Understanding Test Results

### Example: IDOR Test Failure

```
TEST: Student A accessing Student B's paper page ... ✗ FAIL (Expected: 404, Got: 200)
```

**What it means:** Student `2305101` was able to fetch a paper that belongs to student `2305102`.

**Why it's bad:** This is a critical **Insecure Direct Object Reference (IDOR)** vulnerability.

**How to fix:**
```python
# Ensure ownership check in views:
paper = get_object_or_404(
    ExamPaper,
    pk=pk,
    enrollment__student=request.user  # ← MUST include ownership filter
)
```

### Example: Path Traversal Test Failure

```
TEST: Authenticated path traversal attempt (/../) ... ✗ FAIL (Expected: 404, Got: 200)
```

**What it means:** A user can access files outside their intended directory using `../` sequences.

**Why it's bad:** Critical **Path Traversal** vulnerability. Could expose system files.

**How to fix:**
```python
# In file_gateway.py, ensure path normalization:
if normalized.startswith("../") or normalized == "..":
    raise FileAccessError("Path traversal detected")
```

## Continuous Testing

Run tests after any code changes:

```bash
# After modifying authentication code
./scripts/security_pentest.sh

# After updating file access logic
./scripts/security_pentest.sh

# Before deploying to production
./scripts/security_pentest.sh
```

## CI/CD Integration

Add to GitHub Actions (`.github/workflows/security.yml`):

```yaml
name: Security Tests

on: [push, pull_request]

jobs:
  pentest:
    runs-on: ubuntu-latest
    services:
      db:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: admin
      backend:
        image: exam_e_backend:latest
    steps:
      - uses: actions/checkout@v3
      - name: Run penetration tests
        run: |
          bash scripts/security_pentest.sh
          if [ $? -ne 0 ]; then
            echo "Security tests failed!"
            exit 1
          fi
```

## Manual Testing with Curl

Run individual curl commands directly:

### Test: Unauthenticated file access (should return 403)
```bash
curl -I http://localhost/Data/Papers/MidSem/CN/cn1.jpeg
```

### Test: Login as student
```bash
curl -X POST http://localhost/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"2305101@kiit.ac.in","password":"Check@123"}' \
  -c /tmp/cookies.txt
```

### Test: Access own paper (should return 200)
```bash
curl -I http://localhost/api/student/paper/2/page/1/ \
  -b /tmp/cookies.txt
```

### Test: IDOR attack - access other student's paper (should return 404)
```bash
curl -I http://localhost/api/student/paper/1/page/1/ \
  -b /tmp/cookies.txt
```

### Test: Role violation - student accessing teacher endpoint (should return 403)
```bash
curl -I http://localhost/api/teacher/papers/ \
  -b /tmp/cookies.txt
```

## Troubleshooting

### "Permission denied" when running script
```bash
chmod +x /Users/prom1/Documents/Exam_E/scripts/security_pentest.sh
```

### Containers not responding
```bash
# Check container status
docker compose ps

# View backend logs
docker compose logs -f backend

# Restart containers
docker compose restart
```

### Login failures
```bash
# Verify student exists and password is correct
docker compose exec db psql -U postgres -d exam_e \
  -c "SELECT email, role FROM users WHERE email='2305101@kiit.ac.in';"
```

### Test results vary between runs
- Some tests depend on database state (paper IDs, enrollments)
- Verify test data is consistent
- Use `docker compose down -v && docker compose up --build` to reset database

## Reporting

After successful test completion, document results:

1. **Save output to file:**
   ```bash
   ./scripts/security_pentest.sh | tee security_test_results_$(date +%Y%m%d_%H%M%S).txt
   ```

2. **Update documentation:**
   - Add test date and pass rate to `SECURITY_ASSESSMENT.md`
   - Document any new findings
   - Update remediation status

3. **Communicate to team:**
   ```markdown
   ## Security Test Results - [Date]

   ✅ All 40 security tests passed (100%)
   
   **Tested areas:**
   - Authentication & session management
   - File access controls
   - Cross-student IDOR prevention
   - Role-based access control
   - Path traversal blocking
   - Input validation & injection protection
   
   **Next review:** [Date + 1 month]
   ```

## Additional Resources

- **Full Report:** See `/Users/prom1/Documents/Exam_E/SECURITY_ASSESSMENT.md`
- **Hardening Guide:** Detailed remediation steps in SECURITY_ASSESSMENT.md
- **OWASP Top 10:** https://owasp.org/Top10/
- **Django Security:** https://docs.djangoproject.com/en/stable/topics/security/

---

**Last Updated:** March 17, 2026  
**Status:** ✅ Active  
**Maintainer:** Security Team


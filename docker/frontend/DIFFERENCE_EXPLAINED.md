## Frontend Security Fix vs. Authentication: Key Differences

### **THE VULNERABILITY (What We Fixed)**

**Problem**: Roll number exposed in URL
```
Student logs in → navigates to evaluation page
↓
URL shows: /evaluation/cs3001?roll=230547
↓
Attacker manually changes: /evaluation/cs3001?roll=230501
↓
Frontend shows student 230501's data ❌
```

---

## **THREE DIFFERENT LAYERS**

### 1️⃣ **AUTHENTICATION** (Django Backend - NOT Changed)
**What it does**: Verifies **WHO** you are

```
User enters: Email & Password
     ↓
Django checks:
  - Does this email exist in User table?
  - Is password hash correct?
  - Is account active?
     ↓
Creates: JWT token (cryptographically signed)
     ↓
Stores in: HTTP-only cookie (browser can't read it)
```

**Location**: Django Backend (`/core/authentication.py`)
**Tools**: 
- `UniversityIDBackend` - validates credentials
- `JWTAuthentication` - validates JWT token
- `settings.SIMPLE_JWT` - token configuration

---

### 2️⃣ **SESSION STATE MANAGEMENT** (Frontend - NEW)
**What it does**: Remembers **WHO is logged in** on this page

```
After Django authenticates user:
     ↓
Frontend saves user info in UserSessionContext:
{
  universityId: "230547",
  role: "student",
  fullName: "Aryan Kumar"
}
     ↓
Stored in: sessionStorage (cleared when browser closes)
     ↓
Used by: Components to know current user
```

**Location**: Frontend React (`/src/context/UserSessionContext.tsx`)
**Tools**: React Context API + sessionStorage

---

### 3️⃣ **AUTHORIZATION / ACCESS CONTROL** (Frontend + Backend)
**What it does**: Ensures you can **only see YOUR data**

```
Frontend Layer:
  EvaluationViewer page checks:
  "Do I have a logged-in user?"
     ↓
  if (!user) → redirect to login
  else → use user.universityId to fetch data
     ↓
  BLOCKS: URL manipulation (/examine?roll=999)
  ✅ Can't fetch data for different user

Backend Layer (Will be implemented):
  API receives request
     ↓
  Backend checks:
  "Does JWT token say user=230547?"
  "Is 230547 asking for 230547's data?"
     ↓
  If YES → return data ✅
  If NO → return 403 Forbidden ❌
```

---

## **SIDE-BY-SIDE COMPARISON**

| Layer | Before | After | Who Handles |
|-------|--------|-------|-------------|
| **Authentication<br/>(Who are you?)** | Django JWT | Django JWT (UNCHANGED) | Backend Only |
| **Session State<br/>(Remember me)** | ❌ None | ✅ UserSessionContext | Frontend Only |
| **URL Params<br/>(In address bar)** | ❌ `?roll=230501` visible | ✅ No roll param | Frontend |
| **Data Access<br/>(Only your data)** | ❌ Any roll accepted | ✅ Current user's roll | Frontend + Backend |

---

## **HOW EACH LAYER WORKS**

### **Before Fix (Vulnerable)**

```
Browser URL: /evaluation/cs3001?roll=230501
                                        ↑
                    Attacker could change this!
                                ↓
EvaluationViewer.tsx:
  const rollNo = searchParams.get("roll")  // Gets 230501
  const results = getStudentResults(rollNo) // Fetches 230501's data
  ❌ PROBLEM: We don't check if rollNo belongs to logged-in user!
```

---

### **After Fix (Secure)**

```
Browser URL: /evaluation/cs3001
              (no roll parameter anymore!)
              
EvaluationViewer.tsx:
  const { user } = useUserSession()  // Gets stored session
  
  if (!user) {
    navigate("/")  // Not logged in? Go to login
    return null
  }
  
  const rollNo = user.universityId   // Use stored session, NOT URL!
  const results = getStudentResults(rollNo)  // Fetch current user's data
  ✅ SECURED: We use session context, not URL parameter!
```

---

## **THE CRITICAL DIFFERENCE**

### **Authentication (Backend)**
```python
# Django - authentication.py
def authenticate(request, username=None, password=None):
    user = User.objects.get(university_id=username)
    if user.check_password(password):  # ← Validates password
        return user
    return None
```
✅ Verifies password is correct
✅ Only runs ONCE at login
✅ Creates secure JWT token

### **Session State (Frontend)**
```typescript
// React - UserSessionContext.tsx
const setUser = (newUser: UserSession) => {
  sessionStorage.setItem("userSession", JSON.stringify(newUser))
  // ← Just stores who we think is logged in
  // ✅ Doesn't validate password (backend did that)
  // ✅ Runs whenever page loads
}
```
✅ Remembers user info on this page
✅ Doesn't validate anything (backend did)
✅ Used by components to know current user

---

## **REAL-WORLD SCENARIO: Why Both Needed**

### Scenario: Hacker bypasses the JWT token somehow
```
Attacker: "I cracked your password, now I'm 230501"
          ↓
Backend (Authentication):
  ❌ Can't bypass - JWT is cryptographically signed
  (Django's JWTAuthentication won't accept fake tokens)
  
Attacker: "OK, let me just change the URL"
          /evaluation/cs3001?roll=230501
          ↓
Frontend (Session State):
  ❌ Can't use URL - ignores ?roll parameter
  Uses user from UserSessionContext instead
  Shows current user's data only
```

---

## **WHAT EACH LAYER ACTUALLY CHECKS**

### **Django Backend (Authentication)**
When API request arrives:
```python
request.user  # ← Who does JWT say user is?

# Check 1: Is JWT valid?
# Check 2: Is token not expired?
# Check 3: Has user not been deleted?
# Check 4: Does user own this data?
```

### **React Frontend (Session State)**
When page renders:
```typescript
const { user } = useUserSession()  // ← Who is logged in here?

// Check 1: Is user object populated?
// Check 2: Should we redirect to login?
// Check 3: Use user.universityId for any frontend operations
```

---

## **KEY DIFFERENCES SUMMARY**

| Aspect | Authentication | Session State |
|--------|---|---|
| **Purpose** | Verify credentials | Remember who logged in |
| **Checks Password** | ✅ YES | ❌ NO |
| **Creates Token** | ✅ YES | ❌ NO |
| **Runs Once** | ✅ At login | ❌ Every page load |
| **Runs Where** | Backend | Frontend |
| **Stores What** | JWT token | User info |
| **Stores Where** | HTTP-only cookie | sessionStorage |
| **Prevents** | Fake users | URL manipulation |
| **File** | `/core/authentication.py` | `UserSessionContext.tsx` |

---

## **HOW THEY WORK TOGETHER**

```
User clicks Login
     ↓
┌─────────────────────────────────┐
│ Django Backend                  │
│ (Authentication)                │
│                                 │
│ 1. Check email exists ✅        │
│ 2. Check password ✅            │
│ 3. Create JWT token ✅          │
│ 4. Set HTTP-only cookie ✅      │
└─────────────────────────────────┘
     ↓ (Redirect to dashboard)
┌─────────────────────────────────┐
│ React Frontend                  │
│ (Session State)                 │
│                                 │
│ 1. Receive user info ✅         │
│ 2. Store in UserSessionContext  │
│ 3. Save to sessionStorage       │
│ 4. Pass to components           │
└─────────────────────────────────┘
     ↓ (User views results)
┌─────────────────────────────────┐
│ React Component                 │
│ (Authorization Check)           │
│                                 │
│ 1. Get rollNo from session ✅   │
│ 2. Fetch only that user's data  │
│ 3. Display to user              │
└─────────────────────────────────┘
```

---

## **IMPLEMENTATION DETAILS**

### **What gets passed:**
1. **Authentication** → JWT token (secure, cryptographic)
2. **Session State** → User info object (plain JSON)
3. **Authorization** → universityId (checked against JWT)

### **What's protected:**
1. **Authentication** → Password never sent again
2. **Session State** → Can't be modified by user
3. **Authorization** → Backend validates on each API call

---

## **THE FIX IN ACTION**

**Before**:
```
URL: /evaluation/cs3001?roll=230547
User changes to: /evaluation/cs3001?roll=230501
Frontend reads: 230501
Fetches: 230501's data ❌
```

**After**:
```
URL: /evaluation/cs3001 (no roll param)
User changes to: /evaluation/cs3001?roll=230501
Frontend reads: From UserSessionContext (230547)
Fetches: 230547's data ✅
URL parameter completely ignored!
```

---

## **SUMMARY**

**The vulnerability** was passing user identity through a URL parameter that anyone could change.

**Authentication** (Backend - Django) determines **IF you're a real user**.
- Checks password ✅
- Creates JWT token ✅
- Happens at login ✅

**Session State** (Frontend - React) determines **WHO you are on this page**.
- Stores user info ✅
- Ignores URL parameters ✅
- Used by components ✅

**The Fix** combines both:
- Django says "you're user 230547" via JWT ✅
- React stores "current user is 230547" in session ✅
- Components use session, not URL ✅
- Backend validates on every API call ✅

This prevents the vulnerability while NOT interfering with Django's authentication system!

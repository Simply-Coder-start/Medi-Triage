# Appointment Booking Flow - Visual & Reference Guide

## User Flow Diagram

```
DOCTOR DASHBOARD
│
├─ Incoming Requests Panel
│  │
│  ├─ Request Item: "John Doe - Chest Pain"
│  │  └─ [View] Button
│  │     │
│  │     └─ MODAL OPENS
│  │        │
│  │        ├─ Request Details
│  │        │  ├─ Patient: John Doe
│  │        │  ├─ Symptom: Chest pain
│  │        │  ├─ Specialty: Cardiology
│  │        │  └─ Answers: [list]
│  │        │
│  │        └─ [Reject] [Accept & Book]
│  │           │
│  │           ├─ Reject → Request status = "rejected"
│  │           │           Request removed from list
│  │           │           Patient notified
│  │           │
│  │           └─ Accept & Book → BOOKING FORM APPEARS
│  │              │
│  │              ├─ Date Field (editable)
│  │              ├─ Start Time (editable)
│  │              ├─ End Time (editable)
│  │              ├─ Mode Dropdown (video/in-person/phone)
│  │              ├─ Notes Text Area (optional)
│  │              │
│  │              └─ [Cancel] [Confirm Booking]
│  │                 │
│  │                 ├─ Cancel → Back to request view
│  │                 │
│  │                 └─ Confirm → API CALL
│  │                    └─ POST /api/appointments/book
│  │                       │
│  │                       ├─ SUCCESS (200) ✓
│  │                       │  ├─ Toast: "✓ Appointment booked!"
│  │                       │  ├─ Modal closes
│  │                       │  ├─ Request removed from Incoming list
│  │                       │  ├─ Appointment added to My Appointments
│  │                       │  ├─ Request status → "booked"
│  │                       │  └─ Appointment status → "CONFIRMED"
│  │                       │
│  │                       ├─ CONFLICT (409) ⚠️
│  │                       │  ├─ Error message: "Slot already taken"
│  │                       │  ├─ Modal stays open
│  │                       │  ├─ Doctor can edit times
│  │                       │  └─ Try again
│  │                       │
│  │                       └─ ERROR (400/500) ❌
│  │                          ├─ Error message with details
│  │                          ├─ Modal stays open
│  │                          ├─ Form preserved
│  │                          └─ Try again
│  │
│  └─ My Appointments Panel
│     ├─ Appointment Item: "John Doe - Video Call"
│     │  ├─ Status: CONFIRMED
│     │  ├─ Time: Fri 14:30-14:45 UTC
│     │  ├─ Mode: Video
│     │  └─ [Done] [Cancel]
```

---

## Database State Transitions

### Request Status Lifecycle
```
Initial: NEW
  │
  ├─ Patient creates request
  │
Viewed: VIEWED
  │
  ├─ Doctor clicks "View" on request
  │
Final: BOOKED or REJECTED
  │
  ├─ BOOKED: Doctor completes appointment booking
  │   - request.status = "booked"
  │   - request.handled_by = doctor_id
  │   - request.handled_at = timestamp
  │   - appointment created with status CONFIRMED
  │
  └─ REJECTED: Doctor rejects request
      - request.status = "rejected"
      - No appointment created
```

### Appointment Status Lifecycle
```
After Booking: CONFIRMED
  │
  ├─ Appointment successfully created
  │
During Call: CONFIRMED
  │
  ├─ Doctor and patient have session
  │
After Completion: CONFIRMED or CANCELLED
  │
  ├─ CONFIRMED: Session completed normally
  │   - Doctor can mark as "Done"
  │
  └─ CANCELLED: Appointment cancelled before/during
      - Either doctor or patient initiates
      - PATCH /api/appointments/{id}/cancel
```

---

## API Call Sequence Diagram

```
Doctor Client                API Server              Database
│                             │                       │
├─ POST /appointments/book ─>│                       │
│ {requestId, doctorId,      │                       │
│  patientId, times, mode}   │                       │
│                             │ Validate inputs      │
│                             ├──────────────────> SELECT from requests
│                             │ <──────────────────
│                             │ Request exists? ✓
│                             │
│                             │ Check overlaps
│                             ├──────────────────> SELECT appointments
│                             │                     WHERE doctor_id = ? AND
│                             │                     start < ? AND end > ?
│                             │ <──────────────────
│                             │ No conflicts? ✓
│                             │
│                             │ BEGIN TRANSACTION
│                             │
│                             ├──────────────────> INSERT appointment
│                             │ <──────────────────
│                             │
│                             ├──────────────────> UPDATE request
│                             │                     status = 'booked'
│                             │ <──────────────────
│                             │
│                             │ COMMIT
│                             │
│ <─ 200 OK ────────────────  │
│ {ok, appointmentId, status} │
│                             │
├─ Handle Response ──────────┤
│ ✓ Show toast
│ ✓ Close modal
│ ✓ Refresh list
│ ✓ Update UI
```

---

## Backend Validation Pipeline

```
POST /api/appointments/book
│
├─ [1] Authentication
│  └─ Verify Bearer token
│     └─ Extract user → doctor
│
├─ [2] Input Format Validation
│  ├─ requestId is valid integer
│  ├─ doctorId is valid integer
│  ├─ patientId is valid integer
│  ├─ startTime is ISO datetime
│  ├─ endTime is ISO datetime
│  └─ mode is one of: video, in_person, phone
│
├─ [3] Business Logic Validation
│  ├─ Doctor can only book own appointments
│  │  └─ doctorId == current_user.id
│  │
│  ├─ Request exists and is bookable
│  │  ├─ SELECT request WHERE id = ?
│  │  └─ status IN ('new', 'viewed')
│  │
│  ├─ Patient exists
│  │  └─ SELECT user WHERE id = ? AND role = 'patient'
│  │
│  └─ Times are valid
│     ├─ startTime < endTime
│     ├─ startTime >= NOW()
│     └─ endTime >= NOW()
│
├─ [4] Concurrency Safety (Double-Booking Check)
│  │
│  └─ SELECT COUNT(*) FROM appointments
│     WHERE doctor_id = ?
│       AND status IN ('PENDING', 'CONFIRMED')
│       AND start_time < ?  ← endTime
│       AND end_time > ?    ← startTime
│     │
│     ├─ If count > 0 → 409 Conflict
│     └─ If count = 0 → Safe to proceed
│
├─ [5] Database Transaction
│  │
│  ├─ BEGIN TRANSACTION
│  │
│  ├─ INSERT INTO appointments (...)
│  │  VALUES (requestId, doctorId, patientId, startTime, endTime, mode, notes, ...)
│  │
│  ├─ UPDATE requests
│  │  SET status = 'booked', handled_by = doctorId, handled_at = NOW()
│  │  WHERE id = requestId
│  │
│  ├─ COMMIT ✓
│  │
│  └─ On error: ROLLBACK
│
└─ [6] Response
   ├─ Success (200 OK)
   │  └─ {ok: true, appointmentId, status, message}
   │
   ├─ Validation Error (400 Bad Request)
   │  └─ {detail: error_message}
   │
   ├─ Conflict (409 Conflict)
   │  └─ {detail: "Selected time slot is already taken..."}
   │
   └─ Server Error (500 Internal Server Error)
      └─ {detail: "Failed to book appointment..."}
```

---

## Frontend State Management

```javascript
// Booking State Variables
let currentBookingRequest = null;    // Current request being processed
let currentDoctorToken = null;       // Auth token for API calls
let currentDoctorId = null;          // Doctor's user ID

// Modal States
State 1: CLOSED
  └─ User clicks "View" on request
     └─ State 2: REQUEST_DETAIL (modal open, showing request)

State 2: REQUEST_DETAIL
  ├─ User clicks "Reject"
  │  └─ Call API → State 1: CLOSED
  │
  └─ User clicks "Accept & Book"
     └─ State 3: BOOKING_FORM (form appears, request details hidden)

State 3: BOOKING_FORM
  ├─ User clicks "Cancel"
  │  └─ State 2: REQUEST_DETAIL (form hidden, request details shown)
  │
  ├─ User clicks "Confirm Booking"
  │  ├─ Validate form
  │  ├─ Button disabled, show "Booking..."
  │  ├─ Call API
  │  │
  │  ├─ Success (200)
  │  │  ├─ Close modal
  │  │  ├─ Show success toast
  │  │  ├─ Refresh dashboard
  │  │  └─ State 1: CLOSED
  │  │
  │  └─ Error (400/409/500)
  │     ├─ Show error message
  │     ├─ Keep form open
  │     ├─ Re-enable button
  │     └─ State 3: BOOKING_FORM (user can edit and retry)
```

---

## Error Response Examples

### 400 Bad Request - Validation Error
```json
{
  "detail": "Start time must be before end time"
}
```

### 409 Conflict - Double-Booking
```json
{
  "detail": "Selected time slot is already taken. Please choose another time."
}
```

### 500 Server Error
```json
{
  "detail": "Failed to book appointment. Please try again."
}
```

---

## Database Schema Diagram

```
Users Table
├── id (PK)
├── username (UNIQUE)
├── password_hash
├── role ('patient' or 'doctor')
├── name
├── email
├── specialty (for doctors)
└── created_at

Requests Table (TriageRequest)
├── id (PK)
├── patient_id (FK → Users)
├── symptom
├── specialty
├── answers_json
├── status ('new'|'viewed'|'booked'|'rejected')
├── doctor_id (FK → Users, nullable)
├── handled_by (FK → Users, nullable) ← WHO HANDLED
├── handled_at (TIMESTAMP, nullable)   ← WHEN HANDLED
└── created_at

Appointments Table (NEW SCHEMA)
├── id (PK)
├── request_id (FK → Requests, nullable)
├── doctor_id (FK → Users, INDEX)
├── patient_id (FK → Users, INDEX)
├── start_time (DATETIME, INDEX)  ← UTC TIMESTAMP
├── end_time (DATETIME)           ← UTC TIMESTAMP
├── mode ('video'|'in_person'|'phone')
├── status ('PENDING'|'CONFIRMED'|'CANCELLED')
├── notes (TEXT)
├── created_by (FK → Users)       ← AUDIT: WHO CREATED
├── created_at (TIMESTAMP)        ← AUDIT: WHEN CREATED
└── INDEXES
    ├── (doctor_id, start_time, end_time)
    └── (patient_id)
```

---

## Overlap Detection Logic

```
Doctor Smith books:
  Appointment A: 14:30 - 14:45
  
Someone tries to book overlapping:
  
  Case 1: 14:35 - 14:50 → CONFLICT
  ────────────────────
  [A: 14:30────────14:45]
  [Try:        14:35────────14:50]
  
  Overlap detection: A.start(14:30) < Try.end(14:50) ✓
                    A.end(14:45) > Try.start(14:35) ✓
  → CONFLICT ❌
  
  
  Case 2: 14:45 - 15:00 → ALLOWED
  ──────────────────────
  [A: 14:30────────14:45]
  [Try:                  14:45──────15:00]
  
  Overlap detection: A.start(14:30) < Try.end(15:00) ✓
                    A.end(14:45) > Try.start(14:45) ✗ (Not greater)
  → NO CONFLICT ✓ (Back-to-back allowed)
  
  
  Case 3: 14:00 - 14:30 → ALLOWED
  ──────────────────────
  [Try: 14:00──────14:30]
  [A:              14:30────────14:45]
  
  Overlap detection: A.start(14:30) < Try.end(14:30) ✗ (Not less)
                    A.end(14:45) > Try.start(14:00) ✓
  → NO CONFLICT ✓ (Back-to-back allowed)
```

---

## File Organization

```
Project Root
├── index.html                          ← Frontend HTML (UPDATED)
├── app.js                              ← Frontend JS (UPDATED)
├── styles.css
├── docker-compose.yml
│
├── backend/
│  ├── app/
│  │  ├── __init__.py
│  │  ├── main.py                       ← Router registration (UPDATED)
│  │  ├── auth.py
│  │  ├── database.py
│  │  ├── models.py                     ← DB models (UPDATED)
│  │  ├── schemas.py                    ← Pydantic schemas (UPDATED)
│  │  │
│  │  └── routers/
│  │     ├── __init__.py
│  │     ├── auth.py
│  │     ├── patients.py
│  │     ├── doctors.py
│  │     ├── requests.py                ← Accept endpoint (UPDATED)
│  │     └── appointments.py             ← NEW: Booking logic (275 lines)
│  │
│  ├── requirements.txt
│  ├── api.py
│  └── ...
│
├── Documentation/
│  ├── IMPLEMENTATION_COMPLETE.md        ← This summary
│  ├── APPOINTMENT_BOOKING_API.md        ← API reference
│  ├── SETUP_AND_DEPLOYMENT.md           ← Setup guide
│  ├── TESTING_VALIDATION.md             ← Test matrix
│  └── test_booking.ps1                  ← Test script
```

---

## Quick Reference: Status Values

### Request Status
```
'new'       → Request just created
'viewed'    → Doctor viewed the request
'booked'    → Appointment successfully booked
'rejected'  → Doctor rejected the request
```

### Appointment Status
```
'PENDING'   → (rarely used, created as CONFIRMED)
'CONFIRMED' → Appointment confirmed by doctor
'CANCELLED' → Appointment cancelled by doctor or patient
```

### HTTP Status Codes
```
200 OK             → Booking successful
400 Bad Request    → Validation error (bad input)
409 Conflict       → Slot already taken (double-booking)
500 Server Error   → Unexpected server error
```

---

## Configuration Constants

```javascript
// Frontend defaults
suggestedStartOffset:  30 minutes  (from current time)
defaultDuration:       15 minutes
defaultMode:           'video'
toastDuration:         3000 ms
buttonDisableDuration: API response + 500ms

// API timeout
requestTimeout:        30 seconds (per fetch API default)
```

---

## Timezone Handling

```
User Input:           Local timezone (browser's Intl API)
Server Conversion:    ISO 8601 UTC format
Database Storage:     UTC timestamp
Display:              UTC with "UTC" label (or convert to user's timezone)

Example:
User in EST (UTC-5):  14:00 local time
Converted to UTC:     19:00 UTC
Sent to server:       "2025-12-15T19:00:00Z"
Stored in DB:         2025-12-15 19:00:00 (UTC)
Displayed to user:    2025-12-15 14:00 EST or 19:00 UTC
```

---

## Success Metrics / KPIs

Once deployed, monitor:

```
✓ Booking success rate
  Target: > 99% for valid bookings

✓ Double-booking rate
  Target: 0% (should never occur)

✓ Average response time
  Target: < 200ms (95th percentile < 500ms)

✓ Error rate
  Target: < 1% (400 errors only for bad input)

✓ Conflict rate (409)
  Target: < 5% (indicates real concurrency, acceptable)

✓ User satisfaction
  Target: > 90% (survey post-booking)
```

---

## Troubleshooting Quick Links

| Issue | Reference |
|-------|-----------|
| Modal won't open | SETUP_AND_DEPLOYMENT.md → Troubleshooting |
| 409 error (slot taken) | Overlap Detection Logic (above) |
| API not found | Check backend is running on :8000 |
| DB state out of sync | DB verification queries in TESTING_VALIDATION.md |
| Token invalid | SETUP_AND_DEPLOYMENT.md → Get token |

---

## Next Steps for Developers

1. **Review** `backend/app/routers/appointments.py`
2. **Test** using `test_booking.ps1` script
3. **Validate** all test scenarios in TESTING_VALIDATION.md
4. **Deploy** to staging environment
5. **Monitor** logs for `BOOK_APPOINTMENT` entries
6. **Gather** user feedback
7. **Enhance** with notifications/calendar sync

---

**END OF VISUAL GUIDE**

For detailed information, see the other documentation files:
- API Contract → APPOINTMENT_BOOKING_API.md
- Setup Instructions → SETUP_AND_DEPLOYMENT.md  
- Testing Procedures → TESTING_VALIDATION.md
- Implementation Details → IMPLEMENTATION_COMPLETE.md


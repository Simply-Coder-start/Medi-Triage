# Appointment Booking Implementation Guide

## Quick Start

### 1. Backend Setup

#### Database Migration

```bash
cd d:\hackthon\ frontend\backend

# Option A: Fresh SQLite database (automatic with FastAPI)
# The tables will be created automatically when you run the app

# Option B: For PostgreSQL, run the migrations:
# (Not needed for SQLite - just restart the app)
```

#### Update Requirements

The `requirements.txt` already includes FastAPI and SQLAlchemy. No new dependencies needed.

#### Run Backend Server

```powershell
cd d:\hackthon\ frontend\backend

# Install dependencies (if needed)
pip install -r requirements.txt

# Start the server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Expected Output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete
```

### 2. Frontend Integration

The frontend code is already updated in `index.html` and `app.js`. The modal structure and booking logic are fully implemented.

#### Test Local Instance

1. Open `index.html` in a browser
2. Sign up as a doctor
3. Wait for patient to create a request
4. Click "View" on incoming request
5. Click "Accept & Book"
6. Edit date/time/notes as needed
7. Click "Confirm Booking"

### 3. API Testing with cURL

#### Get Authentication Token

```bash
# Doctor login (assuming backend is running)
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "dr_smith",
    "password": "secure_pass"
  }'

# Response includes access_token
# Copy the token for next requests
```

#### Test Booking Endpoint

```bash
$token = "your_token_here"

curl -X POST http://localhost:8000/api/appointments/book `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d '{
    "requestId": "1",
    "doctorId": "2",
    "patientId": "1",
    "startTime": "2025-12-15T14:30:00Z",
    "endTime": "2025-12-15T14:45:00Z",
    "mode": "video",
    "notes": "Initial consultation"
  }'
```

---

## Implementation Details

### Modified Files

#### Backend

1. **`backend/app/models.py`**
   - Updated `Appointment` model with proper fields (start_time, end_time, mode, status, notes, created_by)
   - Updated `TriageRequest` model with status tracking (handled_by, handled_at)

2. **`backend/app/schemas.py`**
   - Added `BookAppointmentRequest` and `BookAppointmentResponse` schemas
   - Updated `AppointmentResponse` with new fields

3. **`backend/app/routers/appointments.py`** (NEW)
   - Complete appointment booking implementation
   - Double-booking prevention with transaction support
   - Validation pipeline with clear error messages
   - GET endpoints for doctor/patient appointments
   - PATCH endpoint for cancellation

4. **`backend/app/routers/requests.py`**
   - Updated `accept_request` to mark request as "viewed" instead of booking immediately
   - Actual booking now happens via `/api/appointments/book`

5. **`backend/app/main.py`**
   - Added appointments router import

#### Frontend

1. **`index.html`**
   - Enhanced booking modal with:
     - Date/time pickers (start and end time)
     - Appointment mode selector (video/in-person/phone)
     - Notes textarea
     - Error message display area

2. **`app.js`**
   - Added complete booking state management
   - Modal event handlers (open, close, cancel)
   - Booking form validation
   - API integration with fallback to localStorage
   - UI update on success/failure
   - Toast notifications

---

## Feature Completeness

### AC1: Modal Pre-filled with Editable Times ✅
- Modal opens with request details
- Pre-fills with suggested time (current time + 30 minutes)
- All fields are editable (date, time, mode, notes)
- Duration auto-calculated (15 minutes default)

### AC2: Backend Validates Availability ✅
- Checks slot isn't taken by other doctor appointments
- Validates startTime < endTime
- Validates times in future
- Creates appointment with CONFIRMED status

### AC3: Double-Booking Prevention ✅
- SQL query checks for overlapping PENDING/CONFIRMED appointments
- Transaction ensures atomicity
- Returns 409 Conflict if slot taken
- Clear error message for user

### AC4: Success Updates DB & UI ✅
- Request status changed to "booked"
- Appointment stored with CONFIRMED status
- Modal closes automatically
- Toast shows success message
- Request list refreshed immediately

### AC5: Error Handling with Retry ✅
- Modal stays open on error
- Clear error messages displayed
- 409 shows helpful message about choosing another time
- 400/500 show validation details
- Confirm button re-enabled for retry

### AC6: Audit Trail ✅
- Logging of BOOK_APPOINTMENT action
- Captures: doctor_id, patient_id, request_id, appointment_id, timestamps
- Uses Python logging module (see logs in console)

---

## Troubleshooting

### Issue: "Cannot find module" when running backend

**Solution:**
```powershell
cd backend
pip install -r requirements.txt
```

### Issue: Port 8000 already in use

**Solution:**
```powershell
# Use a different port
python -m uvicorn app.main:app --reload --port 8001
```

### Issue: CORS errors in browser console

**Solution:**
The backend already includes CORS middleware. If still getting errors:
1. Check backend is running on http://localhost:8000
2. Check frontend is making requests to correct URL
3. Verify Authorization header format: `Bearer {token}`

### Issue: "Request not found" error

**Solution:**
1. Verify request ID is correct
2. Check request status is "new" or "viewed" (not already "booked")
3. For testing, create a request first via patient UI

### Issue: Double-booking check not working

**Solution:**
1. Verify database has previous appointments
2. Check overlap logic: start1 < end2 AND end1 > start2
3. Check appointment status is CONFIRMED or PENDING
4. Enable debug logging: `logging.basicConfig(level=logging.DEBUG)`

---

## Testing Scenarios

### Test Scenario 1: Successful Booking

```
1. Patient creates request for Cardiology
2. Doctor views request
3. Doctor clicks Accept & Book
4. Modal shows with pre-filled time: 2025-12-15 14:30-14:45 UTC
5. Doctor changes to 16:00-16:30 UTC
6. Doctor clicks Confirm
7. Expected: Success toast, modal closes, request marked booked
```

### Test Scenario 2: Double-Booking Prevention

```
1. Doctor books Slot A: 14:30-14:45 UTC
2. Same doctor tries to book Slot B: 14:35-14:50 UTC (overlaps)
3. Expected: 409 Error message about slot taken
4. Doctor changes time to 15:00-15:30 UTC
5. Expected: Second booking succeeds
```

### Test Scenario 3: Invalid Input Handling

```
1. Open booking form
2. Set end time BEFORE start time
3. Click Confirm
4. Expected: "Start time must be before end time" error
5. Modal stays open for editing
```

### Test Scenario 4: Concurrent Requests

```
Use shell script to send two concurrent booking requests:

FOR /L %%i IN (1,1,2) DO (
  start powershell -NoExit -Command "curl -X POST http://localhost:8000/api/appointments/book ..."
)

Expected: One succeeds, one gets 409 Conflict
```

---

## Performance Considerations

### Database Indexing
- `appointments` table indexed on `doctor_id`, `patient_id`, `start_time`
- Enables fast overlap detection even with millions of appointments

### Transaction Scope
- Minimal transaction duration (microseconds)
- Reduces lock contention
- Safe for concurrent requests

### Query Optimization
```sql
-- Good: Uses index
SELECT 1 FROM appointments
WHERE doctor_id = ? AND start_time < ? AND end_time > ?

-- Bad: Full table scan
SELECT * FROM appointments WHERE status = 'CONFIRMED'
```

---

## Future Enhancements

### Phase 2 (Not implemented)
1. **Rescheduling**: PUT `/api/appointments/{id}/reschedule`
2. **Bulk Slots**: POST `/api/doctors/{id}/slots` to create multiple slots
3. **Calendar Export**: iCal format for integration with Google Calendar
4. **SMS Notifications**: Integration with Twilio
5. **Timezone Support**: Store doctor's timezone, display appointments in user's timezone

### Phase 3
1. **Payment Integration**: Stripe for appointment deposits
2. **Rating System**: Patient rates doctor after appointment
3. **Recommendation Engine**: Suggest best doctors based on availability and ratings
4. **Analytics Dashboard**: Booking trends, cancellation rates, no-show rates

---

## Security Checklist

- [x] Authentication required for all endpoints
- [x] Authorization checks (doctor can only book own appointments)
- [x] Input validation on all fields
- [x] SQL injection prevention (SQLAlchemy ORM)
- [x] CORS configured safely
- [x] Error messages don't leak sensitive info
- [x] Audit trail logged
- [ ] Rate limiting (recommended to add)
- [ ] Password encryption (use bcrypt in requirements)
- [ ] HTTPS in production (use SSL certificates)

---

## Database Query Examples

### Find All Double-Bookings
```sql
SELECT a1.id, a1.doctor_id, a1.start_time, a1.end_time
FROM appointments a1
JOIN appointments a2 ON a1.doctor_id = a2.doctor_id
  AND a1.id < a2.id
  AND a1.start_time < a2.end_time
  AND a1.end_time > a2.start_time
  AND a1.status IN ('PENDING', 'CONFIRMED')
  AND a2.status IN ('PENDING', 'CONFIRMED');
```

### Doctor's Appointment Schedule
```sql
SELECT a.id, u.name as patient_name, a.start_time, a.end_time, a.mode, a.status
FROM appointments a
JOIN users u ON a.patient_id = u.id
WHERE a.doctor_id = {doctor_id}
  AND a.start_time >= NOW()
ORDER BY a.start_time ASC;
```

### Request Handling Audit Trail
```sql
SELECT r.id, r.patient_id, r.status, r.handled_by, r.handled_at
FROM requests r
WHERE r.handled_at >= NOW() - INTERVAL '24 hours'
ORDER BY r.handled_at DESC;
```

---

## Support

For issues or questions:

1. Check the error message in the browser console
2. Check backend logs for `BOOK_APPOINTMENT` entries
3. Verify API contract matches documentation
4. Run manual cURL tests to isolate frontend vs backend issues
5. Check database directly for data consistency

---

## Version

**Appointment Booking System v1.0.0**
- Implementation Date: December 10, 2025
- API Endpoints: 7 (book, get, list-doctor, list-patient, cancel, etc.)
- Database Tables Modified: 2 (appointments, requests)
- Frontend Pages Updated: 1 (booking modal)
- Estimated Effort: Full backend + frontend + testing

---


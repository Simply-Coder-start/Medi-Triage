# Complete Testing & Validation Guide

## Executive Summary

This document provides comprehensive testing procedures to validate all Acceptance Criteria (AC1-AC6) for the Appointment Booking Flow implementation.

---

## Test Environment Setup

### Prerequisites
- Backend running: `python -m uvicorn app.main:app --reload --port 8000`
- Frontend: Open `index.html` in modern browser (Chrome, Firefox, Safari, Edge)
- Tools: PowerShell or bash terminal, cURL (for API tests)
- Optional: Postman for API testing

### Database State
```sql
-- Clear previous test data
DELETE FROM appointments;
DELETE FROM requests;
DELETE FROM users WHERE role = 'doctor' AND username LIKE 'test_%';
DELETE FROM users WHERE role = 'patient' AND username LIKE 'testpat_%';
```

---

## AC1: Modal Pre-filled with Proposed Time, Editable by Doctor

### Test 1.1: Modal Opens on Accept & Book Click

**Steps:**
1. Sign up as doctor: `Dr. Smith`
2. Patient creates request with symptom "chest pain"
3. Doctor logs in → views incoming requests
4. Doctor clicks "View" on request
5. Request detail modal appears
6. Doctor clicks "Accept & Book" button
7. **Verify**: Booking form appears with pre-filled values

**Expected Result:**
- Modal transitions smoothly from request view to booking form
- Form fields visible: date, time, end-time, mode, notes
- Confirm Booking button present and enabled

---

### Test 1.2: Pre-filled Times Match Request

**Steps:**
1. Request created at: 2025-12-10 10:00:00 UTC
2. Patient requests appointment for "next available"
3. Doctor opens Accept & Book
4. **Verify**: Start date field shows suggested time (approx 30 min from now)
5. **Verify**: End time auto-calculated (15 min duration)

**Expected Result:**
```
bookDate.value = "2025-12-10" (today's date)
bookTime.value = "11:30" (30 mins from request time)
bookEndTime.value = "11:45" (15 mins after start)
bookMode.value = "video"
bookNotes.value = "" (empty, ready for doctor input)
```

---

### Test 1.3: Doctor Can Edit All Fields

**Steps:**
1. Booking form is open
2. Doctor changes date to tomorrow: "2025-12-11"
3. Doctor changes start time to "14:00"
4. Doctor changes end time to "14:30"
5. Doctor changes mode to "in_person"
6. Doctor adds notes: "Bring test results from last visit"
7. **Verify**: All changes are reflected in form

**Expected Result:**
```
All form fields accept user input
No validation errors until Submit
Changes persist when switching focus between fields
```

---

## AC2: Backend Validates Availability & Creates CONFIRMED Appointment

### Test 2.1: Valid Booking Creates CONFIRMED Appointment

**Steps:**
1. Prepare booking request:
```bash
curl -X POST http://localhost:8000/api/appointments/book \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "1",
    "doctorId": "2",
    "patientId": "1",
    "startTime": "2025-12-15T14:30:00Z",
    "endTime": "2025-12-15T14:45:00Z",
    "mode": "video",
    "notes": "Initial assessment"
  }'
```

2. Send request
3. **Verify**: Response status is 200 OK
4. **Verify**: Response contains appointmentId
5. **Verify**: Status field = "CONFIRMED"

**Expected Response:**
```json
{
  "ok": true,
  "appointmentId": "42",
  "status": "CONFIRMED",
  "message": "Appointment booked successfully"
}
```

---

### Test 2.2: Backend Validates Time Sequence

**Steps:**
1. Send booking with endTime BEFORE startTime:
```bash
curl -X POST http://localhost:8000/api/appointments/book \
  -d '{
    "startTime": "2025-12-15T14:45:00Z",
    "endTime": "2025-12-15T14:30:00Z"
  }'
```

2. **Verify**: Response status is 400 Bad Request
3. **Verify**: Error message: "Start time must be before end time"
4. **Verify**: No appointment created in database

---

### Test 2.3: Backend Validates Request Exists

**Steps:**
1. Send booking with invalid requestId: "99999"
2. **Verify**: Response status is 400 Bad Request
3. **Verify**: Error message contains "Request not found"

---

### Test 2.4: Backend Validates Patient Exists

**Steps:**
1. Send booking with invalid patientId: "99999"
2. **Verify**: Response status is 400 Bad Request
3. **Verify**: Error message contains "Patient not found"

---

## AC3: Double-Booking Prevention via Atomic Transaction

### Test 3.1: Concurrent Bookings - Only One Succeeds

**Setup:**
Create two booking requests for same time slot by same doctor.

**Steps:**
1. Open two browser tabs with doctor logged in
2. Tab A: Start booking with slot 14:30-14:45
3. Tab B: Start booking with slot 14:35-14:50 (overlaps by 10 mins)
4. Tab A: Submit booking → Get 200 OK, appointment created
5. Tab B: Submit booking immediately → Get 409 Conflict
6. **Verify**: Only ONE appointment exists in database

**Expected Results:**
```
Tab A Response (200 OK):
{
  "ok": true,
  "appointmentId": "1",
  "status": "CONFIRMED"
}

Tab B Response (409 Conflict):
{
  "detail": "Selected time slot is already taken. Please choose another time."
}

Database: Only 1 appointment with doctor_id=2 and time range 14:30-14:45
```

---

### Test 3.2: Back-to-Back Bookings Are Allowed

**Steps:**
1. Book Slot A: 14:30-14:45
2. Book Slot B: 14:45-15:00 (same doctor, no overlap)
3. **Verify**: Both bookings succeed (200 OK for both)

**Expected Result:**
```
Two appointments created:
- Appointment 1: 14:30-14:45 CONFIRMED
- Appointment 2: 14:45-15:00 CONFIRMED
No conflict error
```

---

### Test 3.3: Cancelled Appointments Don't Block New Bookings

**Steps:**
1. Book Slot A: 14:30-14:45 → Success
2. Cancel Slot A
3. Book Slot C: 14:30-14:45 → Success (same time, same doctor)
4. **Verify**: Can re-book cancelled slot

**Expected Result:**
```
Second booking succeeds because cancelled status is excluded
SQL query: AND status IN ('PENDING', 'CONFIRMED')
Excludes status = 'CANCELLED'
```

---

## AC4: Success Updates DB State & Refreshes UI

### Test 4.1: Request Status Changes to BOOKED

**Steps:**
1. Before booking: Request status = "viewed"
2. Doctor books appointment
3. API returns 200 OK
4. Check database: SELECT status FROM requests WHERE id = 1
5. **Verify**: status = "booked"

**Database Check:**
```sql
SELECT id, status, handled_by, handled_at FROM requests WHERE id = 1;

Expected output:
| id | status | handled_by | handled_at          |
|----|--------|------------|---------------------|
| 1  | booked | 2          | 2025-12-10 12:15:00 |
```

---

### Test 4.2: Appointment Saved with Correct Fields

**Steps:**
1. Book appointment with specific values
2. Query database: SELECT * FROM appointments WHERE id = {appointmentId}
3. **Verify**: All fields match request

**Database Check:**
```sql
SELECT * FROM appointments WHERE id = 42;

Expected output:
| id | request_id | doctor_id | patient_id | start_time          | end_time            | mode  | status      |
|----|------------|-----------|------------|---------------------|---------------------|-------|-------------|
| 42 | 1          | 2         | 1          | 2025-12-15 14:30:00 | 2025-12-15 14:45:00 | video | CONFIRMED   |
```

---

### Test 4.3: Modal Closes on Success

**Steps:**
1. Booking form open in modal
2. Doctor submits valid booking
3. Wait for API response (200 OK)
4. **Verify**: Modal closes automatically
5. **Verify**: Request list refreshed

**Expected Behavior:**
```
1. Confirm button becomes disabled and shows "Booking..."
2. API responds with 200 OK
3. Modal backdrop fades out
4. Doctor's dashboard refreshes
5. Booked request removed from "Incoming Requests" list
6. Success toast appears: "✓ Appointment booked successfully!"
```

---

### Test 4.4: Request Removed from Incoming List

**Steps:**
1. Request visible in doctor's "Incoming Requests"
2. Doctor books appointment
3. Appointment creation succeeds
4. **Verify**: Request no longer appears in "Incoming Requests"
5. **Verify**: Appointment appears in "My Appointments" section

**Expected Result:**
```
Before booking:
- Incoming Requests (1): John Doe - Chest pain

After booking:
- Incoming Requests: (empty)
- Appointments (1): John Doe - Video Call - Fri 14:30 (Confirmed)
```

---

## AC5: Error Handling with Retry

### Test 5.1: 409 Error Shows Helpful Message

**Steps:**
1. Doctor creates two booking requests in rapid succession
2. First succeeds (14:30-14:45)
3. Second fails (14:35-14:50 overlaps)
4. **Verify**: Error message is specific and helpful

**Expected Error Message:**
```
"Selected time slot is already taken. Please choose another time."
```

NOT generic message like:
```
"Error occurred" or "Failed to process request"
```

---

### Test 5.2: Modal Stays Open on 409

**Steps:**
1. Booking form open
2. Doctor submits for time slot that's taken
3. Get 409 Conflict response
4. **Verify**: Modal remains open
5. **Verify**: Form fields still have values (not cleared)
6. **Verify**: Confirm button is re-enabled

**Expected Behavior:**
```
- Error message appears in red: bookError div
- Modal doesn't close
- Form values preserved
- Doctor can edit times and retry
- No reload/refresh of page
```

---

### Test 5.3: 400 Validation Error Handling

**Steps:**
1. Submit booking with endTime = startTime
2. **Verify**: 400 Bad Request response
3. **Verify**: Clear error message: "Start time must be before end time"
4. **Verify**: Modal stays open
5. **Verify**: Doctor can fix and resubmit

---

### Test 5.4: 500 Server Error Handling

**Steps:**
1. (Simulate server error by stopping backend mid-request)
2. Doctor submits booking
3. **Verify**: 500 error caught gracefully
4. **Verify**: Error message: "Failed to book appointment. Please try again."
5. **Verify**: User can retry without losing data

---

### Test 5.5: Network Error Handling

**Steps:**
1. Open browser DevTools → Network tab
2. Block/throttle network connection
3. Doctor submits booking
4. **Verify**: Timeout handled gracefully
5. **Verify**: User sees helpful error message
6. **Verify**: Can retry when network restored

---

## AC6: Audit Trail Logging

### Test 6.1: Log Entry Created on Successful Booking

**Steps:**
1. Doctor books appointment
2. Check backend logs/console output
3. **Verify**: Entry contains required fields

**Expected Log Entry:**
```
BOOK_APPOINTMENT: doctor_id=2, patient_id=1, request_id=1, 
appointment_id=42, start_time=2025-12-15T14:30:00Z, end_time=2025-12-15T14:45:00Z
```

---

### Test 6.2: Audit Trail in Database

**Steps:**
1. Book appointment
2. Query appointments table
3. Check created_by and created_at fields

**Database Check:**
```sql
SELECT id, created_by, created_at FROM appointments WHERE id = 42;

Expected output:
| id | created_by | created_at          |
|----|------------|---------------------|
| 42 | 2          | 2025-12-10 12:15:00 |
```

---

### Test 6.3: Request Update Tracked

**Steps:**
1. Book appointment
2. Query requests table
3. **Verify**: handled_by and handled_at fields set

**Database Check:**
```sql
SELECT id, handled_by, handled_at FROM requests WHERE id = 1;

Expected output:
| id | handled_by | handled_at          |
|----|------------|---------------------|
| 1  | 2          | 2025-12-10 12:15:00 |
```

---

## Integration Tests

### Test I1: End-to-End Patient → Request → Booking → Confirmation

**Scenario:** Complete user journey

**Steps:**
1. **Patient Signs Up**
   ```
   Name: Alice Johnson
   Email: alice@test.com
   ```

2. **Patient Creates Triage Request**
   ```
   Symptom: Persistent headaches and dizziness
   Specialty: Neurology
   Answers: [3 days, Slowly, Yes, No, No, No, No, No, No, Intermittent]
   ```

3. **Doctor Signs Up**
   ```
   Name: Dr. Neurology Expert
   Specialty: Neurology
   Location: Downtown Medical Center
   ```

4. **Doctor Views Incoming Request**
   - Dashboard shows: Alice Johnson - Neurology
   - Click "View" button

5. **Doctor Accepts & Books**
   - Modal opens with request details
   - Default time: 2 hours from now
   - Doctor edits to: tomorrow 10:00-10:30 AM
   - Mode: In-person
   - Notes: "Neuro exam required"
   - Click "Confirm Booking"

6. **Verify Success**
   - Modal closes
   - Toast: "✓ Appointment booked successfully!"
   - Request removed from Incoming list
   - Appointment appears in My Appointments: "Alice Johnson - In-person - Tomorrow 10:00"
   - Patient sees appointment in their list

7. **Database Verification**
   ```sql
   SELECT r.id, r.status, a.id, a.status 
   FROM requests r 
   LEFT JOIN appointments a ON r.id = a.request_id 
   WHERE r.patient_id = {alice_id};
   
   Expected:
   | request_id | request_status | appointment_id | appointment_status |
   |------------|----------------|----------------|-------------------|
   | 1          | booked         | 1              | CONFIRMED          |
   ```

---

### Test I2: Timezone Handling

**Scenario:** Verify times stored in UTC

**Steps:**
1. Doctor's local time: 14:00 (assuming UTC+5)
2. Doctor selects appointment at local time: 14:00-14:30
3. Backend converts to UTC: 09:00-09:30
4. **Verify**: Database stores: "2025-12-15 09:00:00" (UTC)

**Database Check:**
```sql
SELECT start_time, end_time FROM appointments WHERE id = 1;
-- Should be in UTC format, not local time
```

---

## Edge Cases & Boundary Tests

### Test E1: Booking at System Boundaries

**Steps:**
1. Book appointment at midnight boundary: 23:45-00:15 (crosses day)
2. **Verify**: Works correctly across date boundaries
3. **Verify**: Database stores correct times

---

### Test E2: Very Short Appointments

**Steps:**
1. Book 1-minute appointment: 14:00-14:01
2. **Verify**: Allowed (no minimum duration enforcement)
3. **Verify**: Overlap detection still works

---

### Test E3: Very Long Appointments

**Steps:**
1. Book 12-hour appointment: 08:00-20:00
2. **Verify**: Allowed (no maximum duration enforcement)
3. **Verify**: Blocks overlapping bookings correctly

---

### Test E4: Booking in Far Future

**Steps:**
1. Book appointment 1 year from now
2. **Verify**: Allowed
3. **Verify**: Time stored correctly

---

### Test E5: Multiple Doctors on Same Patient

**Steps:**
1. Create two doctors: Dr. Smith (Cardiology), Dr. Jones (Neurology)
2. Patient creates two requests
3. Both doctors book appointments (overlapping times)
4. **Verify**: Both succeed (different doctors can have same time slots)

**Expected Result:**
```
Doctor Smith: 14:30-14:45 ✓
Doctor Jones: 14:30-14:45 ✓
(No conflict because different doctors)
```

---

### Test E6: Doctor Books Multiple Patients Same Time

**Steps:**
1. Doctor books Patient A: 14:30-14:45
2. Doctor tries to book Patient B: 14:30-14:45 (same time)
3. **Verify**: Second booking fails with 409

**Expected Result:**
```
409 Conflict - even though different patients,
same doctor cannot have overlapping appointments
```

---

## Performance Tests

### Test P1: Booking Response Time

**Steps:**
1. Measure time from form submit to response
2. **Verify**: Response time < 500ms under normal load

**Expected Result:**
```
Typical timing:
- Validation: 1-5ms
- Database queries: 10-50ms
- Transaction commit: 10-30ms
- Total: 30-100ms (excellent)
```

---

### Test P2: Large Database (1000 appointments)

**Steps:**
1. Create 1000 appointments in database
2. Doctor books new appointment
3. **Verify**: Response still < 500ms (indexed query)

**Why This Matters:**
- Overlap detection queries indexed on doctor_id and start_time
- Should perform equally well with 100 or 1,000,000 appointments

---

## Security Tests

### Test S1: Authorization - Only Doctor Can Book

**Steps:**
1. Get patient's token
2. Try to call POST /api/appointments/book as patient
3. **Verify**: 403 Forbidden response

**Expected Error:**
```json
{
  "detail": "Only doctors can book appointments"
}
```

---

### Test S2: Doctor Cannot Book for Another Doctor

**Steps:**
1. Doctor A's token
2. Try to book with doctorId = Doctor B's ID
3. **Verify**: 403 Forbidden

**Expected Error:**
```json
{
  "detail": "You can only book appointments for yourself"
}
```

---

### Test S3: SQL Injection Prevention

**Steps:**
1. Try SQL injection in notes field:
```json
{
  "notes": "'; DROP TABLE appointments; --"
}
```

2. **Verify**: Treated as literal string, not executed
3. **Verify**: Appointment created with notes containing the literal injection attempt

---

### Test S4: Invalid Token Rejected

**Steps:**
1. Provide invalid/expired token
2. **Verify**: 401 Unauthorized

---

## Regression Tests

### Test R1: Existing Accept Request Endpoint Still Works

**Steps:**
1. Call POST /api/requests/{id}/accept
2. **Verify**: Request marked as "viewed" (not "booked" anymore)
3. **Verify**: No appointment created yet

---

### Test R2: Reject Request Still Works

**Steps:**
1. Call POST /api/requests/{id}/reject
2. **Verify**: Request status = "rejected"
3. **Verify**: Request removed from doctor's incoming list

---

### Test R3: Patient Can Still View Appointments

**Steps:**
1. Patient logs in
2. Navigate to My Appointments
3. **Verify**: Shows all CONFIRMED appointments
4. **Verify**: Can see doctor name, time, mode

---

## Checklist for Production Deployment

- [ ] All 6 ACs tested and passing
- [ ] No error in browser console
- [ ] No unhandled exceptions in backend logs
- [ ] Database integrity verified (no orphaned records)
- [ ] Audit trail populated correctly
- [ ] Response times acceptable under load
- [ ] Security tests passing
- [ ] UI responsive on mobile
- [ ] Accessibility compliant (keyboard navigation, screen readers)
- [ ] Documentation updated and accurate
- [ ] Code reviewed by team
- [ ] Backup taken before deployment
- [ ] Rollback plan documented

---

## Known Limitations & Future Work

### Current Implementation Limitations
1. **No SMS/Email Notifications** - Logged but not sent
2. **No Timezone Conversion** - Always UTC display
3. **No Payment Processing** - Free appointments only
4. **No Cancellation Notifications** - One-way communication
5. **No Rescheduling** - Must cancel and rebook
6. **No Bulk Slot Creation** - One appointment at a time

### Future Enhancements
1. Send patient confirmation email/SMS
2. Calendar integration (Google Calendar, Outlook)
3. Automated reminders 24 hours before
4. Ratings and reviews
5. Doctor availability calendar view
6. Appointment rescheduling endpoint
7. Bulk slot upload for doctors
8. Payment processing (Stripe)
9. Waitlist management
10. Video call integration (Zoom, Jitsi)

---

## Support & Debugging

### Enable Debug Logging
```python
# In appointments.py
import logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
```

### Common Issues

**Issue: "Request not found" error**
```
Solution: Verify request exists and is not already booked
SELECT * FROM requests WHERE id = {id};
```

**Issue: Double-booking not prevented**
```
Solution: Check if appointments have wrong status
SELECT * FROM appointments WHERE doctor_id = {id} AND status NOT IN ('CONFIRMED', 'PENDING');
```

**Issue: Modal not closing after successful booking**
```
Solution: Check browser console for JavaScript errors
Open DevTools → Console tab
```

---

## Test Report Template

```
Test Execution Report
Date: 2025-12-10
Tester: [Name]
Environment: [Local/Staging/Production]

Results:
✓ AC1: Modal pre-filled and editable
✓ AC2: Backend validation working
✓ AC3: Double-booking prevented
✓ AC4: Database updated correctly
✓ AC5: Error handling working
✓ AC6: Audit trail logged

Issues Found: [None/List issues]
Recommendations: [Future enhancements]

Sign-off: [Tester] - [Date]
```

---

END OF TESTING GUIDE

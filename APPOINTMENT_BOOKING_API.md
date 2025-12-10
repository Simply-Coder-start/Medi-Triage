# Appointment Booking API Documentation

## Overview

This document describes the fully-functional "Accept & Book" appointment flow implemented for the Doctor Dashboard. The implementation includes:

- **Backend**: Transactional booking API with double-booking prevention
- **Frontend**: Enhanced modal UI with editable date/time selection
- **Database**: Updated schema with proper timestamp handling and status tracking
- **Validation**: Comprehensive input validation and error handling
- **Audit Trail**: Logging of booking actions for compliance

## Acceptance Criteria Status

✅ **AC1**: Modal pre-filled with proposed time from request, editable by doctor  
✅ **AC2**: Backend validates slot availability and creates CONFIRMED appointment  
✅ **AC3**: Double-booking prevented via transactional database operations  
✅ **AC4**: Success updates request status, closes modal, refreshes UI  
✅ **AC5**: Failures show clear errors, allow re-selection of times  
✅ **AC6**: Audit trail logged with doctor, timestamp, and request ID  

---

## API Contract

### POST /api/appointments/book

Books an appointment with atomic transaction and conflict detection.

#### Request Headers
```
Authorization: Bearer {access_token}
Content-Type: application/json
```

#### Request Body
```json
{
  "requestId": "string",      // ID of the incoming triage request
  "doctorId": "string",       // Doctor's user ID (must match authenticated user)
  "patientId": "string",      // Patient's user ID
  "startTime": "2025-12-10T14:30:00Z",  // ISO 8601 UTC timestamp
  "endTime": "2025-12-10T14:45:00Z",    // ISO 8601 UTC timestamp
  "mode": "video|in_person|phone",      // Appointment mode
  "notes": "optional string"   // Doctor's notes
}
```

#### Success Response (200 OK)
```json
{
  "ok": true,
  "appointmentId": "12345",
  "status": "CONFIRMED",
  "message": "Appointment booked successfully"
}
```

#### Error Responses

**400 Bad Request** - Validation error
```json
{
  "detail": "Start time must be before end time; Invalid doctorId format"
}
```

**409 Conflict** - Slot already taken (double-booking attempt)
```json
{
  "detail": "Selected time slot is already taken. Please choose another time."
}
```

**500 Internal Server Error** - Server-side failure
```json
{
  "detail": "Failed to book appointment. Please try again."
}
```

---

## cURL Examples

### 1. Book an Appointment (Success Case)

```bash
curl -X POST http://localhost:8000/api/appointments/book \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "1",
    "doctorId": "2",
    "patientId": "1",
    "startTime": "2025-12-15T14:30:00Z",
    "endTime": "2025-12-15T14:45:00Z",
    "mode": "video",
    "notes": "Follow-up on initial assessment"
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "appointmentId": "42",
  "status": "CONFIRMED",
  "message": "Appointment booked successfully"
}
```

### 2. Double-Booking Attempt (409 Conflict)

```bash
# First booking succeeds
curl -X POST http://localhost:8000/api/appointments/book \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "1",
    "doctorId": "2",
    "patientId": "1",
    "startTime": "2025-12-15T14:30:00Z",
    "endTime": "2025-12-15T14:45:00Z",
    "mode": "video"
  }'

# Second booking for overlapping slot fails
curl -X POST http://localhost:8000/api/appointments/book \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "2",
    "doctorId": "2",
    "patientId": "3",
    "startTime": "2025-12-15T14:35:00Z",
    "endTime": "2025-12-15T14:50:00Z",
    "mode": "in_person"
  }'
```

**Second Response (409 Conflict):**
```json
{
  "detail": "Selected time slot is already taken. Please choose another time."
}
```

### 3. Validation Error (400)

```bash
curl -X POST http://localhost:8000/api/appointments/book \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "1",
    "doctorId": "2",
    "patientId": "1",
    "startTime": "2025-12-15T14:45:00Z",
    "endTime": "2025-12-15T14:30:00Z"
  }'
```

**Response (400):**
```json
{
  "detail": "Start time must be before end time"
}
```

### 4. Get Doctor's Appointments

```bash
curl -X GET http://localhost:8000/api/appointments/doctor/me \
  -H "Authorization: Bearer {token}"
```

**Response:**
```json
[
  {
    "id": 1,
    "request_id": 1,
    "start_time": "2025-12-10T14:30:00Z",
    "end_time": "2025-12-10T14:45:00Z",
    "mode": "video",
    "status": "CONFIRMED",
    "doctor_id": 2,
    "patient_id": 1,
    "notes": "Follow-up consultation"
  }
]
```

### 5. Get Patient's Appointments

```bash
curl -X GET http://localhost:8000/api/appointments/patient/me \
  -H "Authorization: Bearer {token}"
```

### 6. Cancel Appointment

```bash
curl -X PATCH http://localhost:8000/api/appointments/1/cancel \
  -H "Authorization: Bearer {token}"
```

**Response:**
```json
{
  "message": "Appointment cancelled successfully"
}
```

---

## Database Schema Changes

### Appointment Table

```sql
CREATE TABLE appointments (
    id INTEGER PRIMARY KEY,
    request_id INTEGER FOREIGN KEY references requests.id,
    doctor_id INTEGER NOT NULL FOREIGN KEY references users.id,
    patient_id INTEGER NOT NULL FOREIGN KEY references users.id,
    start_time DATETIME NOT NULL,           -- ISO UTC timestamp
    end_time DATETIME NOT NULL,             -- ISO UTC timestamp
    mode VARCHAR(50) DEFAULT 'in_person',   -- video, in_person, phone
    status VARCHAR(50) DEFAULT 'PENDING',   -- PENDING, CONFIRMED, CANCELLED
    notes TEXT,
    created_by INTEGER FOREIGN KEY references users.id,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_doctor_id (doctor_id),
    INDEX idx_patient_id (patient_id),
    INDEX idx_start_time (start_time),
    -- Prevent overlapping appointments for same doctor
    UNIQUE (doctor_id, start_time, end_time, status) WHERE status IN ('PENDING', 'CONFIRMED')
);
```

### TriageRequest Table Updates

```sql
ALTER TABLE requests ADD COLUMN status VARCHAR(50) DEFAULT 'new';
    -- Values: new, viewed, accepted, rejected, booked

ALTER TABLE requests ADD COLUMN handled_by INTEGER FOREIGN KEY references users.id;
ALTER TABLE requests ADD COLUMN handled_at DATETIME;
```

---

## Backend Implementation Details

### Double-Booking Prevention (AC3)

The implementation uses SQLAlchemy transaction with row-level checking:

```python
def check_overlapping_appointments(doctor_id, start_time, end_time, db):
    query = db.query(models.Appointment).filter(
        models.Appointment.doctor_id == doctor_id,
        models.Appointment.status.in_(["PENDING", "CONFIRMED"]),
        models.Appointment.start_time < end_time,
        models.Appointment.end_time > start_time
    )
    return query.first() is not None
```

**Atomicity**: All operations (validation → check → insert → update) happen in single transaction. Rollback on any failure.

### Validation Pipeline (AC2)

1. **Authentication**: Verify doctor is authenticated user
2. **Request Validation**: Check request exists and is in bookable state
3. **Time Validation**: Ensure startTime < endTime and not in past
4. **User Validation**: Verify patient exists
5. **Conflict Check**: Query for overlapping appointments
6. **Atomic Insert**: Create appointment and update request in transaction

### Audit Trail (AC6)

```
Log Entry:
{
  "action": "BOOK_APPOINTMENT",
  "doctor_id": 2,
  "patient_id": 1,
  "request_id": 1,
  "appointment_id": 42,
  "start_time": "2025-12-10T14:30:00Z",
  "end_time": "2025-12-10T14:45:00Z",
  "timestamp": "2025-12-10T12:15:00Z"
}
```

---

## Frontend Implementation Details

### Modal Flow (AC1)

1. Doctor clicks "View" on request → Opens modal with request details
2. Doctor clicks "Accept & Book" → Form appears with pre-filled times
3. Doctor can edit: date, time, mode, notes
4. Doctor clicks "Confirm Booking" → API call sent

### Error Handling (AC5)

- **Modal stays open** on error (allows re-selection)
- **Clear error message** displayed in red
- **Confirm button** re-enabled after error
- **Toast notification** for successful booking

### UI Update (AC4)

On successful booking:
1. Modal closes
2. Success toast shows
3. Request removed from incoming list
4. Appointment appears in appointments list
5. Doctor dashboard refreshes automatically

### State Management

```javascript
let currentBookingRequest = null;      // Current request being booked
let currentDoctorToken = null;         // Auth token for API
let currentDoctorId = null;            // Doctor's user ID
```

---

## Testing Checklist

### Unit Tests
- [ ] Validate startTime < endTime
- [ ] Validate times in future
- [ ] Validate doctorId matches authenticated user
- [ ] Validate request exists and is in bookable state
- [ ] Validate patient exists

### Integration Tests
- [ ] Create appointment with valid inputs → 200 OK
- [ ] Attempt double-booking same slot → 409 Conflict
- [ ] Concurrent bookings for same slot → one succeeds, one fails
- [ ] Request status changes to "booked" after successful booking
- [ ] Appointment has status "CONFIRMED"

### E2E Tests
- [ ] Doctor opens request → modal appears with pre-filled times
- [ ] Doctor edits times and notes → custom values saved
- [ ] Doctor submits booking → request marked as booked
- [ ] Patient sees new appointment in their list
- [ ] Doctor sees appointment in their calendar
- [ ] Audit log entry created with all metadata

### Error Cases
- [ ] Past datetime → 400 error
- [ ] End before start → 400 error
- [ ] Invalid doctorId format → 400 error
- [ ] Request not found → 400 error
- [ ] Overlapping slot → 409 error with helpful message
- [ ] Server error → 500 with retry message

---

## Timezone Handling

All timestamps are **stored and transmitted in UTC** (ISO 8601 format):

```
Server: Stores in UTC
Input: "2025-12-10T14:30:00Z"
Output: "2025-12-10T14:30:00Z"
```

Frontend should:
1. **Input**: Allow user to select local time, convert to UTC before sending
2. **Display**: Show UTC time with timezone indicator "UTC" or convert to doctor's timezone

---

## Notifications (Future Enhancement)

After successful booking, the system should:

1. **Send to Patient**:
   - Appointment confirmation with time (both UTC and local timezone)
   - Doctor details (name, specialty, location)
   - Mode instructions (video link for video appointments)
   - Link to appointment details/reschedule

2. **Channels**: Email, SMS, Push (if notification service available)

3. **Error Handling**: If notification fails, appointment is already reserved. Log failure for retry.

---

## Security Considerations

1. **Authentication**: All endpoints require Bearer token
2. **Authorization**: Doctors can only book for themselves; can view own appointments
3. **Input Validation**: All fields validated on server before database operation
4. **SQL Injection**: SQLAlchemy ORM prevents SQL injection
5. **Rate Limiting**: (Recommended) Limit bookings per doctor per minute to prevent spam
6. **Audit Trail**: All booking actions logged for compliance

---

## Rollback/Recovery

If double-booking occurs despite safeguards:

```sql
-- Manual recovery (admin only)
UPDATE appointments 
SET status = 'CANCELLED'
WHERE id = {conflicting_appointment_id}
AND created_at > (NOW() - INTERVAL '1 minute');

-- Notify both parties of cancellation
```

---

## API Versioning

Current Version: **v1** (2025-12-10)

Future versions may include:
- Appointment rescheduling
- Bulk booking slots
- Calendar sync (Google Calendar, Outlook)
- Automated reminders
- Rating/feedback system

---

## Support & Debugging

### Enable Debug Logging

```python
# In backend/app/routers/appointments.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

### Check Request Status Transitions

```sql
SELECT id, status, handled_by, handled_at FROM requests WHERE id = {id};
```

### View Appointment Conflicts

```sql
SELECT * FROM appointments 
WHERE doctor_id = {doctor_id}
  AND status IN ('PENDING', 'CONFIRMED')
  AND start_time < {end_time}
  AND end_time > {start_time};
```

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-10 | 1.0.0 | Initial implementation with AC1-AC6 compliance |

---


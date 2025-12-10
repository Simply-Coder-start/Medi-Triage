# Pre-Deployment & Post-Deployment Checklist

## Pre-Deployment Checklist (Before Going to Production)

### Code Review
- [ ] Backend developer reviewed `appointments.py` (275 lines)
- [ ] Frontend developer reviewed `index.html` changes
- [ ] Frontend developer reviewed `app.js` additions
- [ ] Senior review of database schema changes
- [ ] Security review completed (no SQL injection, proper auth)
- [ ] Code follows project style guidelines
- [ ] No debug code or console.log statements left
- [ ] No hardcoded credentials or tokens

### Testing
- [ ] All 6 acceptance criteria verified ✓
- [ ] Unit tests passing (validation logic)
- [ ] Integration tests passing (booking flow)
- [ ] Error handling tests passing (400, 409, 500)
- [ ] Concurrency tests passing (double-booking prevention)
- [ ] Manual end-to-end testing completed
- [ ] Browser compatibility tested (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsiveness verified
- [ ] Accessibility check (keyboard navigation, screen readers)

### Database
- [ ] Backup taken: `triage.db.backup` (or production equivalent)
- [ ] Migration script tested on staging
- [ ] Rollback procedure documented
- [ ] Database indexes verified (doctor_id, start_time)
- [ ] Constraints applied (unique, foreign keys)
- [ ] No orphaned data after schema changes

### Documentation
- [ ] API documentation complete and accurate
- [ ] Setup guide reviewed and tested
- [ ] Testing procedures documented
- [ ] Troubleshooting guide prepared
- [ ] Deployment runbook created
- [ ] Rollback procedure documented
- [ ] Known limitations documented

### Performance
- [ ] Load testing completed (100+ concurrent bookings)
- [ ] Response times verified (< 500ms)
- [ ] Database queries optimized and indexed
- [ ] No memory leaks (checked with profiler)
- [ ] Caching strategy reviewed (if applicable)

### Security
- [ ] Authentication verified (Bearer token)
- [ ] Authorization verified (doctor can only book own)
- [ ] Input validation tested (all fields)
- [ ] SQL injection prevention verified
- [ ] CORS configuration reviewed
- [ ] Error messages reviewed (no data leaks)
- [ ] Audit logging verified (all bookings logged)
- [ ] Rate limiting configured (if applicable)

### Dependencies
- [ ] No new pip packages added to requirements
- [ ] Existing versions compatible with upgrade
- [ ] No breaking changes to other routers
- [ ] FastAPI version compatible

### Team Preparation
- [ ] Customer/Product team briefed on changes
- [ ] Support team trained on new flow
- [ ] QA team has test procedure
- [ ] DevOps team briefed on deployment
- [ ] Communication plan for any issues

### Monitoring & Alerts
- [ ] Logging configured for `BOOK_APPOINTMENT` actions
- [ ] Error monitoring set up (400, 409, 500)
- [ ] Performance monitoring set up (response times)
- [ ] Database monitoring set up (growth rate)
- [ ] Alerts configured for critical errors

---

## Deployment Steps

### Step 1: Prepare (Done by DevOps)
- [ ] Backup current database
- [ ] Backup current code
- [ ] Prepare deployment environment
- [ ] Verify all files are in place

### Step 2: Update Code (Done by DevOps)
```bash
cd /path/to/hackthon\ frontend
git pull  # or manual file copy
```
- [ ] `backend/app/routers/appointments.py` ← NEW
- [ ] `backend/app/models.py` ← UPDATED
- [ ] `backend/app/schemas.py` ← UPDATED
- [ ] `backend/app/routers/requests.py` ← UPDATED
- [ ] `backend/app/main.py` ← UPDATED
- [ ] `index.html` ← UPDATED
- [ ] `app.js` ← UPDATED

### Step 3: Install Dependencies (Done by DevOps)
```bash
cd backend
pip install -r requirements.txt
```
- [ ] No errors during installation
- [ ] All packages installed successfully

### Step 4: Database Migration (Done by DBA)
```bash
# For SQLite (automatic):
# Just restart the app, tables created automatically

# For PostgreSQL (if applicable):
# Run migration scripts in SETUP_AND_DEPLOYMENT.md
```
- [ ] New tables created (or updated)
- [ ] Indexes created
- [ ] Constraints applied
- [ ] No data loss

### Step 5: Start Backend (Done by DevOps)
```bash
python -m uvicorn app.main:app --reload --port 8000
```
- [ ] No startup errors
- [ ] Application listening on correct port
- [ ] API documentation available at `/docs`

### Step 6: Verify API (Done by QA)
```bash
curl http://localhost:8000/docs
curl -X GET http://localhost:8000/api/appointments/doctor/me \
  -H "Authorization: Bearer {token}"
```
- [ ] API is responding
- [ ] Endpoints are accessible
- [ ] Authentication working

### Step 7: Clear Cache (Done on Client)
```
Browser: Ctrl+Shift+R (hard refresh)
Or: Clear cache for localhost
```
- [ ] JavaScript updates loaded
- [ ] HTML updates visible
- [ ] CSS updated

### Step 8: Test in Staging (Done by QA)
- [ ] Doctor signup works
- [ ] Patient signup works
- [ ] Request creation works
- [ ] View request modal opens
- [ ] Accept & Book button works
- [ ] Booking form opens with pre-filled times
- [ ] Can edit date/time/mode/notes
- [ ] Confirm booking succeeds
- [ ] Success toast appears
- [ ] Modal closes automatically
- [ ] Request removed from incoming list
- [ ] Appointment appears in my appointments
- [ ] Database shows appointment as CONFIRMED
- [ ] Audit log shows booking entry

### Step 9: Load Testing (Done by Performance Team)
```powershell
./test_booking.ps1 -ApiUrl "http://staging:8000"
```
- [ ] No errors under load
- [ ] Response times acceptable
- [ ] No database locks
- [ ] No memory leaks

### Step 10: Production Deployment (Done by DevOps)
- [ ] Coordinate with support team
- [ ] Deploy during low-traffic window (if possible)
- [ ] Gradual rollout (if applicable)
- [ ] Monitor logs continuously

---

## Post-Deployment Verification (First 24 Hours)

### Immediate (First Hour)
- [ ] Backend is running without errors
- [ ] Frontend loads without JavaScript errors
- [ ] Doctor can view requests
- [ ] Can open booking modal
- [ ] Can submit bookings
- [ ] Success messages appear
- [ ] Database is receiving data

### Short-term (First 4 Hours)
- [ ] No spike in error rates
- [ ] Response times are normal (< 500ms)
- [ ] No database performance degradation
- [ ] Audit logs are being written
- [ ] Support team has not reported issues
- [ ] Monitor `BOOK_APPOINTMENT` log entries

### Daily (First 24 Hours)
- [ ] Total bookings created (count from DB)
  ```sql
  SELECT COUNT(*) FROM appointments WHERE created_at >= DATE('now');
  ```
- [ ] No double-bookings detected
  ```sql
  SELECT doctor_id, COUNT(*) as overlaps FROM appointments 
  WHERE status IN ('CONFIRMED', 'PENDING')
  GROUP BY doctor_id
  HAVING COUNT(*) > (expected number);
  ```
- [ ] Average response time (check logs)
- [ ] Error rate (should be < 1%)
- [ ] User feedback (any issues reported?)

### Sample Queries for Monitoring
```sql
-- Count successful bookings
SELECT COUNT(*) as successful_bookings 
FROM appointments 
WHERE status = 'CONFIRMED' AND created_at >= NOW() - INTERVAL '24 hours';

-- Count requests marked as booked
SELECT COUNT(*) as booked_requests 
FROM requests 
WHERE status = 'booked' AND handled_at >= NOW() - INTERVAL '24 hours';

-- Check for conflicts
SELECT a1.id, a2.id as conflicting_id, a1.doctor_id
FROM appointments a1
JOIN appointments a2 ON a1.doctor_id = a2.doctor_id
  AND a1.id < a2.id
  AND a1.start_time < a2.end_time
  AND a1.end_time > a2.start_time
WHERE a1.status IN ('CONFIRMED', 'PENDING')
  AND a2.status IN ('CONFIRMED', 'PENDING');

-- Average response time
SELECT AVG(duration_ms) 
FROM logs 
WHERE action = 'BOOK_APPOINTMENT' AND created_at >= NOW() - INTERVAL '1 hour';
```

### Issues to Watch For
1. **409 Conflicts**: Should be rare (< 1%)
   - If > 5%, double-booking prevention might be failing
   
2. **400 Errors**: Should be low (< 2%)
   - If high, validation logic might be too strict
   
3. **500 Errors**: Should be near 0%
   - Any 500 errors = potential bug

4. **Slow Responses**: Should be < 200ms
   - If > 500ms consistently, database query may need optimization

5. **No Logs**: Should see `BOOK_APPOINTMENT` entries
   - If missing, logging might be broken

---

## Rollback Procedure (If Issues Found)

### Immediate Rollback
```bash
# Stop current application
pkill -f "uvicorn app.main:app"

# Restore previous code
git revert HEAD  # or restore from backup

# Restore database
cp triage.db.backup triage.db

# Restart with previous version
python -m uvicorn app.main:app --reload --port 8000
```

### Manual Rollback (if git not available)
```bash
# 1. Stop the server (manually or via process manager)
# 2. Copy files back from backup:
cp backup/models.py backend/app/models.py
cp backup/app.js app.js
# etc. for all modified files

# 3. Restore database
cp triage.db.backup triage.db

# 4. Restart backend
```

### Data Recovery (if needed)
```sql
-- If new appointments were created and need removal:
DELETE FROM appointments 
WHERE created_at >= (SELECT rolled_back_at FROM deployment_log)
  AND created_by = (SELECT id FROM users WHERE username = 'deployment_user');

-- If requests need reset:
UPDATE requests 
SET status = 'viewed', handled_by = NULL, handled_at = NULL
WHERE handled_at >= (SELECT rolled_back_at FROM deployment_log);
```

### Communication on Rollback
- [ ] Notify affected users
- [ ] Apologize for inconvenience
- [ ] Explain what happened (in non-technical terms)
- [ ] Provide ETA for fix
- [ ] Keep users updated every 30 mins

---

## Success Criteria

The deployment is successful if:

✅ **Functionality**
- All 6 ACs working correctly
- No broken existing features
- Error handling works as specified

✅ **Performance**
- Response time < 500ms (99th percentile)
- Database queries < 100ms
- No memory leaks

✅ **Reliability**
- Zero double-bookings
- 100% audit trail logging
- Zero data loss

✅ **User Feedback**
- No critical issues reported
- Users can complete full flow
- Error messages are clear

✅ **Monitoring**
- Logs showing normal operations
- No error spikes
- Database healthy

---

## Post-Go-Live Tasks (Days 2-7)

- [ ] Monitor logs continuously
- [ ] Gather user feedback
- [ ] Track booking success rate
- [ ] Monitor system performance
- [ ] Check audit logs for compliance
- [ ] Plan next enhancement phase
- [ ] Document lessons learned
- [ ] Update runbooks based on real operation

---

## Documentation Handoff

Ensure these documents are available to operations:
- [ ] SETUP_AND_DEPLOYMENT.md (for troubleshooting)
- [ ] TESTING_VALIDATION.md (for regression testing)
- [ ] APPOINTMENT_BOOKING_API.md (for API reference)
- [ ] Database schema documentation
- [ ] Deployment runbook
- [ ] Rollback procedure
- [ ] Monitoring/alerting setup

---

## Sign-Off

- [ ] Project Manager: Approved for production
- [ ] Tech Lead: Code review complete
- [ ] QA Lead: Testing complete
- [ ] DevOps Lead: Deployment ready
- [ ] Security: Security review passed
- [ ] Product Owner: Functionality verified

**Deployed By**: _________________  
**Deployment Date**: _________________  
**Environment**: _________________  
**Version**: 1.0.0  

---

## Emergency Contact

In case of critical issues post-deployment:

- **On-Call Engineer**: [Contact Info]
- **Escalation Path**: [Manager] → [Director]
- **Rollback Authority**: [CTO/Lead]
- **Communication Channel**: [Slack/Teams channel]

---

## Quick Reference

**API Endpoint**: `POST /api/appointments/book`  
**Key Table**: `appointments`  
**Log Entry**: `BOOK_APPOINTMENT`  
**Expected Response Time**: < 100ms  
**Expected Error Rate**: < 1%  
**Expected 409 Rate**: < 5%  

---

# ✅ Deployment & Verification Complete

When all checklists are checked, deployment is complete and verified.


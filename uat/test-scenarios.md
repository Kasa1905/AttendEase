# Club Attendance Manager - UAT Test Scenarios

This document outlines the key test scenarios for User Acceptance Testing (UAT) in the staging environment. The scenarios are designed to verify that the application meets all functional and non-functional requirements.

## Prerequisites

- The staging environment is fully deployed and accessible at https://staging.clubattendance.example
- UAT data has been seeded using the `/opt/club-attendance/scripts/seed-uat.sh` script
- You have access to the test user accounts (see Test Users section below)

## Test Users

All users have the same password: `UAT_Staging2025!`

| Role | Email | Description |
|------|-------|-------------|
| Admin | admin.uat@clubattendance.example | Full administrative access |
| Manager | manager.uat@clubattendance.example | Event and duty management access |
| Active Member | active.member.uat@clubattendance.example | Regular club member with good attendance |
| Regular Member | regular.member.uat@clubattendance.example | Club member with average attendance |
| Irregular Member | irregular.member.uat@clubattendance.example | Club member with poor attendance |
| Suspended Member | suspended.member.uat@clubattendance.example | Club member currently suspended |
| Inactive Member | inactive.member.uat@clubattendance.example | Deactivated club member |
| Guest | guest.uat@clubattendance.example | Limited access guest user |

## Test Scenario Categories

### 1. Authentication and Authorization

| ID | Scenario | Steps | Expected Result | Test User |
|----|----------|-------|----------------|-----------|
| AUTH-01 | Login with valid credentials | 1. Navigate to login page<br>2. Enter email and password<br>3. Click "Login" | User is authenticated and redirected to dashboard | Any user |
| AUTH-02 | Login with invalid credentials | 1. Navigate to login page<br>2. Enter incorrect email or password<br>3. Click "Login" | Error message displayed, user remains on login page | Any user |
| AUTH-03 | Access control verification | 1. Login as different user types<br>2. Attempt to access restricted areas | Admin and Manager can access all areas<br>Members can access only permitted areas<br>Guests have very limited access | All users |
| AUTH-04 | Password reset flow | 1. Click "Forgot Password" on login page<br>2. Enter email address<br>3. Check email for reset link (simulated in staging)<br>4. Click link and set new password | Password is reset successfully | Any user |
| AUTH-05 | Session timeout | 1. Login and remain inactive for session timeout period<br>2. Attempt to perform an action | User is redirected to login page | Any user |

### 2. Event Management

| ID | Scenario | Steps | Expected Result | Test User |
|----|----------|-------|----------------|-----------|
| EVENT-01 | Create new event | 1. Navigate to Events section<br>2. Click "Create Event"<br>3. Fill out event details<br>4. Save event | Event is created and appears in the events list | Admin, Manager |
| EVENT-02 | Edit existing event | 1. Select an existing event<br>2. Click "Edit"<br>3. Modify event details<br>4. Save changes | Event is updated with new details | Admin, Manager |
| EVENT-03 | Delete event | 1. Select an existing event<br>2. Click "Delete"<br>3. Confirm deletion | Event is removed from the system | Admin |
| EVENT-04 | View event details | 1. Select an event from the list<br>2. View event details page | Event details are displayed correctly | All users |
| EVENT-05 | Create recurring event | 1. Create new event<br>2. Enable "Recurring" option<br>3. Set recurrence pattern<br>4. Save event | Recurring event instances are created according to pattern | Admin, Manager |
| EVENT-06 | Filter events | 1. Navigate to Events section<br>2. Use filter options (date range, event type, etc.) | Events list is filtered according to criteria | All users |

### 3. Attendance Management

| ID | Scenario | Steps | Expected Result | Test User |
|----|----------|-------|----------------|-----------|
| ATT-01 | Mark attendance for event | 1. Navigate to an active event<br>2. Select attendees<br>3. Mark them as present/late/absent<br>4. Save attendance | Attendance is recorded for the selected users | Admin, Manager |
| ATT-02 | Self check-in for event | 1. Login as a member<br>2. Navigate to today's event<br>3. Click "Check In" | Attendance is recorded for the user | Member users |
| ATT-03 | Edit attendance record | 1. Navigate to past event<br>2. Select an attendance record<br>3. Modify status<br>4. Save changes | Attendance record is updated | Admin, Manager |
| ATT-04 | View attendance history | 1. Navigate to Attendance section<br>2. Select a user or event<br>3. View attendance history | Attendance records are displayed correctly | Admin, Manager |
| ATT-05 | Generate attendance report | 1. Navigate to Reports section<br>2. Select "Attendance Report"<br>3. Set date range and filters<br>4. Generate report | Report is generated with correct data | Admin, Manager |
| ATT-06 | Excuse absence | 1. Select an absence record<br>2. Click "Mark as Excused"<br>3. Enter reason<br>4. Save changes | Absence is marked as excused | Admin, Manager |

### 4. Duty Session Management

| ID | Scenario | Steps | Expected Result | Test User |
|----|----------|-------|----------------|-----------|
| DUTY-01 | Create duty session | 1. Navigate to Duty Management<br>2. Click "Create Session"<br>3. Assign user, date, and time<br>4. Save session | Duty session is created | Admin, Manager |
| DUTY-02 | Mark duty session completion | 1. Navigate to active duty session<br>2. Click "Mark Completed"<br>3. Save changes | Duty session is marked as completed | Admin, Manager, Assigned Member |
| DUTY-03 | Reassign duty session | 1. Select an upcoming duty session<br>2. Click "Reassign"<br>3. Select new user<br>4. Save changes | Duty session is reassigned to new user | Admin, Manager |
| DUTY-04 | View duty schedule | 1. Navigate to Duty Calendar<br>2. View upcoming sessions | Duty calendar shows all scheduled sessions | All users |
| DUTY-05 | View personal duty schedule | 1. Login as member<br>2. Navigate to My Duties<br>3. View assigned duties | Member sees their assigned duty sessions | Member users |
| DUTY-06 | Generate duty report | 1. Navigate to Reports<br>2. Select "Duty Report"<br>3. Set filters<br>4. Generate report | Report shows duty completion statistics | Admin, Manager |

### 5. Leave Request Management

| ID | Scenario | Steps | Expected Result | Test User |
|----|----------|-------|----------------|-----------|
| LEAVE-01 | Submit leave request | 1. Navigate to Leave Requests<br>2. Click "New Request"<br>3. Enter dates and reason<br>4. Submit request | Leave request is submitted and pending approval | Member users |
| LEAVE-02 | Approve leave request | 1. Navigate to Leave Requests<br>2. Select a pending request<br>3. Click "Approve"<br>4. Add optional note | Request is approved and user is notified | Admin, Manager |
| LEAVE-03 | Reject leave request | 1. Navigate to Leave Requests<br>2. Select a pending request<br>3. Click "Reject"<br>4. Add rejection reason | Request is rejected and user is notified | Admin, Manager |
| LEAVE-04 | View leave history | 1. Navigate to Leave History<br>2. View past requests | Leave request history is displayed | All users (own requests), Admin, Manager (all requests) |
| LEAVE-05 | Cancel leave request | 1. Select a pending leave request<br>2. Click "Cancel Request"<br>3. Confirm cancellation | Request is cancelled | Member who submitted the request |

### 6. Strike Management

| ID | Scenario | Steps | Expected Result | Test User |
|----|----------|-------|----------------|-----------|
| STRIKE-01 | Issue strike | 1. Navigate to user profile<br>2. Click "Issue Strike"<br>3. Enter reason and severity<br>4. Save changes | Strike is recorded for the user | Admin, Manager |
| STRIKE-02 | View strike history | 1. Navigate to user profile<br>2. View Strikes tab | All strikes for the user are displayed | Admin, Manager, User (own strikes) |
| STRIKE-03 | Suspend user | 1. Navigate to user with multiple strikes<br>2. Click "Suspend User"<br>3. Enter reason and duration<br>4. Confirm suspension | User is suspended for the specified duration | Admin |
| STRIKE-04 | Remove strike | 1. Navigate to user's strikes<br>2. Select a strike<br>3. Click "Remove"<br>4. Confirm removal | Strike is removed from the user's record | Admin |

### 7. User Management

| ID | Scenario | Steps | Expected Result | Test User |
|----|----------|-------|----------------|-----------|
| USER-01 | Create new user | 1. Navigate to Users<br>2. Click "Add User"<br>3. Enter user details<br>4. Save user | New user is created | Admin |
| USER-02 | Edit user profile | 1. Select a user<br>2. Click "Edit"<br>3. Modify user details<br>4. Save changes | User profile is updated | Admin, User (own profile) |
| USER-03 | Deactivate user | 1. Select a user<br>2. Click "Deactivate"<br>3. Confirm deactivation | User is deactivated and cannot login | Admin |
| USER-04 | Reactivate user | 1. Select a deactivated user<br>2. Click "Activate"<br>3. Confirm activation | User is reactivated and can login | Admin |
| USER-05 | Change user role | 1. Select a user<br>2. Click "Change Role"<br>3. Select new role<br>4. Save changes | User's role is updated with new permissions | Admin |
| USER-06 | Bulk import users | 1. Navigate to Users<br>2. Click "Import Users"<br>3. Upload CSV file<br>4. Confirm import | Multiple users are created from the CSV data | Admin |

### 8. Notifications

| ID | Scenario | Steps | Expected Result | Test User |
|----|----------|-------|----------------|-----------|
| NOTIF-01 | View notifications | 1. Click notification icon<br>2. View list of notifications | Notifications are displayed correctly | All users |
| NOTIF-02 | Mark notification as read | 1. Open notifications<br>2. Click on a notification | Notification is marked as read | All users |
| NOTIF-03 | Clear all notifications | 1. Open notifications<br>2. Click "Clear All"<br>3. Confirm action | All notifications are marked as read | All users |
| NOTIF-04 | Receive event notification | 1. Admin creates new required event<br>2. Login as member | Member receives notification about new event | Member users |
| NOTIF-05 | Receive duty reminder | 1. Wait for automatic reminders<br>2. Check notifications | Duty reminders are received before scheduled duty | Users with upcoming duties |

### 9. Reports and Analytics

| ID | Scenario | Steps | Expected Result | Test User |
|----|----------|-------|----------------|-----------|
| REPORT-01 | Generate attendance summary | 1. Navigate to Reports<br>2. Select "Attendance Summary"<br>3. Set date range<br>4. Generate report | Report shows attendance statistics | Admin, Manager |
| REPORT-02 | Export report as CSV | 1. Generate any report<br>2. Click "Export as CSV"<br>3. Save file | Report data is exported in CSV format | Admin, Manager |
| REPORT-03 | View attendance trends | 1. Navigate to Dashboard<br>2. View attendance trend chart | Chart shows attendance trends over time | Admin, Manager |
| REPORT-04 | Generate user activity report | 1. Navigate to Reports<br>2. Select "User Activity"<br>3. Set filters<br>4. Generate report | Report shows user activity statistics | Admin |
| REPORT-05 | View duty completion report | 1. Navigate to Reports<br>2. Select "Duty Completion"<br>3. Set filters<br>4. Generate report | Report shows duty completion statistics | Admin, Manager |

### 10. Mobile Responsiveness

| ID | Scenario | Steps | Expected Result | Test User |
|----|----------|-------|----------------|-----------|
| MOBILE-01 | Login on mobile device | 1. Access site on mobile device<br>2. Login with credentials | Login works correctly on mobile | Any user |
| MOBILE-02 | Check-in on mobile | 1. Access site on mobile<br>2. Navigate to event<br>3. Perform check-in | Check-in works correctly on mobile | Member users |
| MOBILE-03 | View calendar on mobile | 1. Access site on mobile<br>2. Navigate to calendar view | Calendar displays correctly on mobile | Any user |
| MOBILE-04 | Responsive layout testing | 1. Access various pages on mobile<br>2. Test layout and functionality | All pages are usable on mobile devices | Any user |

## Additional Test Cases

Additional test cases for specific features and edge cases are available in the detailed test plan. Contact the QA team for more information.

## Issue Reporting

If you encounter any issues during UAT, please report them using the following format:

1. Test scenario ID (if applicable)
2. Steps to reproduce
3. Expected result
4. Actual result
5. Screenshots or video (if available)
6. Browser/device information

Submit issues through the project management system with the label "UAT-Issue" for tracking.

## UAT Sign-off

Once UAT is completed successfully, the designated stakeholders will need to sign off on the system before it can be deployed to production.

---

For questions or assistance with UAT, please contact the project manager or technical lead.
# UAT Test Data Guide

This guide provides detailed information about the test data available in the staging environment for User Acceptance Testing (UAT). Understanding this data will help testers execute test scenarios efficiently.

## Overview

The UAT environment is pre-populated with a comprehensive set of test data that simulates a real-world club attendance management scenario. This includes:

- User accounts with various roles and statuses
- Events with different types and schedules
- Attendance records with various statuses
- Duty sessions (completed, upcoming, missed)
- Leave requests (approved, rejected, pending)
- Strikes and disciplinary actions
- Notifications

All test data is designed to provide realistic scenarios while being easily identifiable as test data.

## Data Generation

The test data was generated using the seeder scripts located in `/backend/seeders/uat/`. These scripts create consistent, predictable data that can be refreshed if needed. The main seeder scripts are:

- `001-uat-users.js` - Creates test user accounts
- `002-uat-attendance-data.js` - Creates events and attendance records
- `003-uat-duty-sessions.js` - Creates duty sessions
- `004-uat-leave-requests.js` - Creates leave requests
- `005-uat-strikes.js` - Creates strike records
- `006-uat-notifications.js` - Creates notifications

To refresh the test data, you can run:

```bash
/opt/club-attendance/scripts/seed-uat.sh
```

## Test Users

All test user accounts use the same password: `UAT_Staging2025!`

### Admin Users

| Username | Email | Role | Description |
|----------|-------|------|-------------|
| Admin User | admin.uat@clubattendance.example | Admin | Full system access |
| System Admin | sysadmin.uat@clubattendance.example | Admin | Technical admin with full access |

### Manager Users

| Username | Email | Role | Description |
|----------|-------|------|-------------|
| Primary Manager | manager.uat@clubattendance.example | Manager | Main manager for testing |
| Event Manager | event.manager.uat@clubattendance.example | Manager | Specialized in event management |
| Duty Manager | duty.manager.uat@clubattendance.example | Manager | Specialized in duty management |

### Member Users

| Username | Email | Role | Status | Attendance | Strikes |
|----------|-------|------|--------|------------|---------|
| Active Member | active.member.uat@clubattendance.example | Member | Active | Excellent (>90%) | 0 |
| Regular Member | regular.member.uat@clubattendance.example | Member | Active | Good (75-90%) | 0 |
| Irregular Member | irregular.member.uat@clubattendance.example | Member | Active | Fair (50-75%) | 1 |
| Problem Member | problem.member.uat@clubattendance.example | Member | Active | Poor (<50%) | 2 |
| New Member | new.member.uat@clubattendance.example | Member | Active | N/A (new) | 0 |
| Suspended Member | suspended.member.uat@clubattendance.example | Member | Suspended | Poor (<50%) | 3 |
| Inactive Member | inactive.member.uat@clubattendance.example | Member | Inactive | N/A | 0 |

### Guest Users

| Username | Email | Role | Description |
|----------|-------|------|-------------|
| Guest User | guest.uat@clubattendance.example | Guest | Limited access guest account |
| Prospective Member | prospective.uat@clubattendance.example | Guest | Guest interested in joining |

## Events Data

The UAT environment includes events spanning multiple months, with a focus on recent and upcoming events.

### Event Types

| Event Type | Description | Attendance Required | Count |
|------------|-------------|---------------------|-------|
| General Meeting | Regular club meetings | Yes | 12 |
| Special Event | One-time special events | Yes | 5 |
| Workshop | Educational workshops | No | 8 |
| Competition | Club competitions | Yes | 3 |
| Social | Social gatherings | No | 6 |
| Board Meeting | Administrative meetings | Yes (for officers) | 6 |
| Volunteer Activity | Community service | No | 4 |

### Event Distribution

- Past events (completed): 24
- Current events (today): 1-2 (depending on time of day)
- Future events (scheduled): 18

## Attendance Records

The system contains attendance records for all past events. The distribution of attendance statuses varies by user:

- Active Member: 90% Present, 5% Late, 5% Excused Absent
- Regular Member: 75% Present, 15% Late, 10% Excused Absent
- Irregular Member: 50% Present, 15% Late, 15% Excused Absent, 20% Unexcused Absent
- Problem Member: 40% Present, 10% Late, 10% Excused Absent, 40% Unexcused Absent
- Suspended Member: 30% Present, 10% Late, 10% Excused Absent, 50% Unexcused Absent

## Duty Sessions

The UAT environment includes various duty sessions:

- Completed duties: 45
- Missed duties: 12
- Upcoming duties: 18

Each member has been assigned duties according to their status:

- Active Member: 10 completed, 0 missed, 2 upcoming
- Regular Member: 8 completed, 1 missed, 2 upcoming
- Irregular Member: 5 completed, 3 missed, 1 upcoming
- Problem Member: 3 completed, 5 missed, 0 upcoming
- Suspended Member: 2 completed, 3 missed, 0 upcoming (suspended from duty)
- New Member: 0 completed, 0 missed, 2 upcoming

## Leave Requests

The system contains leave requests with various statuses:

- Approved: 15
- Rejected: 8
- Pending: 6

Each active member has at least one leave request in the system:

- Active Member: 2 approved, 0 rejected, 1 pending
- Regular Member: 2 approved, 1 rejected, 1 pending
- Irregular Member: 1 approved, 2 rejected, 1 pending
- Problem Member: 0 approved, 3 rejected, 1 pending
- New Member: 0 approved, 0 rejected, 1 pending

## Strikes

Strikes are distributed as follows:

- Irregular Member: 1 strike (minor infraction)
- Problem Member: 2 strikes (1 minor, 1 major infraction)
- Suspended Member: 3 strikes (2 major, 1 critical infraction) - leading to suspension

## Notifications

Each user account has various notifications:

- Unread notifications: 3-8 per user
- Read notifications: 5-20 per user

Notification types include:
- Event reminders
- Duty assignments
- Strike notifications
- Leave request status updates
- System announcements

## Data Visibility

Users can only see data according to their role permissions:

- Admins: All data in the system
- Managers: All member data and events
- Members: Their own data, upcoming events, and public information
- Guests: Public information only

## Special Test Scenarios

The test data includes special scenarios for specific testing:

1. **Suspension scenario** - The suspended member has a complete history leading to their suspension
2. **Leave conflict scenario** - Some leave requests overlap with events for testing conflict resolution
3. **Duty reassignment scenario** - Several duty sessions have been reassigned between members
4. **Strike appeal scenario** - One strike for the problem member is marked as "under appeal"
5. **Data import scenario** - The inactive member was imported from a CSV file

## Identifying Test Data

All test data in the UAT environment follows these patterns:

- User emails end with `@clubattendance.example`
- User names include "UAT" in the display name
- Event titles include "[UAT]" prefix
- Test data IDs are in specific ranges (10000-19999)

## Data Reset

If test data becomes corrupted or needs to be refreshed:

1. Contact the system administrator
2. Request a data reset using the seed script
3. Allow up to 10 minutes for the reset to complete
4. Confirm that test users can log in with the standard password

Do not modify test data directly in the database, as this may cause inconsistencies.

## Additional Data

If additional test data is required for specific test scenarios, please contact the QA team with your requirements.

---

For questions about the test data or to report data inconsistencies, contact the QA team or system administrator.
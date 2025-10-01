**Future Minerals Forum (FMF) Private Invitation System - Complete
Structure**

**System Overview**

A comprehensive event management platform for the Future Minerals Forum
that handles attendee registrations, user management, invitations, and
administrative workflows.

**1. Entity Structure**

**Core Entities**

**User (Built-in + Extended)**

{

\"built_in\": \[\"id\", \"email\", \"full_name\", \"role\"\],

\"extended\": {

\"system_role\": \[\"Admin\", \"Super User\", \"User\"\],

[\"user_type\": \[Founding Partner, Strategic Partner, Platinum Sponsor,
Palladium Sponsor, Gold Sponsor, Silver Sponsor,
Exhibitor, In-kind Sponsor.\],]{.mark} [[user only]{.mark},,, N/A for
Admin and super user]{.underline}

\"name\": \"string\",

\"company_name\": \"string\",

\"mobile\": \"string\",

\"avatar_url\": \"string\",

**[Unlimited for Admin and superuser]{.underline}**
\"registration_slots\": {\"VIP\": , \"Partner\": , \"Exhibitor\": ,
\"Media\": }, **[For User Should as per allowed slot for each user
type]{.underline}**

\"used_slots\": {\"VIP\": 0, \"Partner\": 0, \"Exhibitor\": 0,
\"Media\": 0},

\"account_status\": \[\"active\", \"inactive\"\],

\"last_login_date\": \"datetime\"

}

}

**Attendee (Main Registration Entity)**

{

\"personal_info\": {

\"title\": \"enum\", \"first_name\": \"string\", \"last_name\":
\"string\",

\"email\": \"email\", \"mobile_number\": \"string\", \"country_code\":
\"string\",

\"nationality\": \"string\", \"country_of_residence\": \"string\",

\"date_of_birth\": \"date\", \"religion\": \"enum\"

},

\"professional_info\": {

\"organization\": \"string\", \"job_title\": \"string\", \"level\":
\"enum\",

\"level_specify\": \"string\", \"work_address\": \"string\",

\"work_city\": \"string\", \"work_country\": \"string\",

\"linkedin_account\": \"string\"

},

\"identification\": {

\"id_type\": \[\"National ID\", \"Iqama\", \"Passport\"\],

\"id_number\": \"string\", \"issue_date\": \"date\",

\"need_visa\": \"boolean\", \"expiry_date\": \"date\", \"issue_place\":
\"string\"

},

\"documents\": {

\"face_photo_url\": \"string\", \"id_photo_url\": \"string\"

},

\"survey_data\": {

\"areas_of_interest\": \"array\", \"primary_nature_of_business\":
\"enum\",

\"previous_attendance\": \"boolean\", \"previous_years\": \"array\"

},

\"system_fields\": {

\"attendee_type\": \[\"VIP\", \"Partner\", \"Exhibitor\", \"Media\"\],

\"status\": \[\"pending\", \"approved\", \"declined\",
\"change_requested\"\],

\"registered_by\": \"string\", \"registration_method\": \"enum\",

\"badge_generated\": \"boolean\", \"badge_qr_code\": \"string\"

}

}

**Supporting Entities**

- **Invitation**: Manages invitation codes and usage tracking

- **EmailTemplate**: Stores customizable email templates

- **SystemSetting**: Global system configuration settings

- **PartnershipType**: Defines partnership levels and slot allocations
  and add new partner (user_type)

- **SlotRequest**: Handles requests for additional registration slots

- **Notification**: System notifications for admin and super user.

**2. Page Structure**

**Public Pages**

- **PublicRegistration**: Self-service registration with invitation
  codes (no login Required) invitation link work one time.

- [**ProfileSetup**: First-time user profile completion and password
  change.]{.mark}

**Protected Pages**

**Main Dashboard**

- **Dashboard**: Overview with stats, recent activities, quick actions
  (admin only)

**Attendee Management**

- **Attendees**: Complete attendee list with filtering, approval,
  modification requests

- **Registration**: Single attendee registration form (manual entry)
  user and super user

**Administrative Pages**

- **SystemUsers**: User account management, roles, slots allocation
  (admin) (limited access for super user as he can add users only and
  modify their information)

- **PrivateInvitations**: Bulk invitation generation and management

- **Settings**: System configuration, email templates, module activation

- **Requests**: Slot increase requests management

- **PartnershipManagement**: Partnership type configuration

- **AnalyticsDashboard**: Event analytics and reporting

**3. Component Architecture**

**Layout Components**

- **Layout.js**: Root layout wrapper

- **AuthenticatedLayout**: Main app layout with navigation

- **ProtectedRoute**: Permission-based route protection

**Feature Components**

**Dashboard Components**

- **StatsCard**: Metric display cards

- **RecentActivities**: Activity feed component

**Registration Components**

- **PhotoUpload**: File upload with validation

- **countryCodes**: Country code data

- **countries**: Country list data

**Settings Components**

- **EmailTemplateEditor**: Template customization

- **EmailActivationSettings**: Email system toggles

- **ModuleActivationSettings**: Feature module controls

**User Components**

- **ProfilePhotoUpload**: Avatar upload

- **ProfileSettings**: User profile management

**Common Components**

- **Toast**: Notification system

- **NotificationCenter**: System notifications

**4. Backend Functions**

**Email Functions**

- **sendWelcomeEmail**: Approval notifications

- **sendInvitationEmail**: Invitation distribution

- **sendModificationRequestEmail**: Registration change requests

- **sendPasswordResetInstructions**: Password reset guidance

- **sendNewUserRequestEmail**: New user creation requests

**Registration Functions**

- **registerWithInvitation**: Invitation-based registration

- **validateInvitation**: Invitation code verification

- **getAttendeeForModification**: Secure attendee data retrieval

- **updateAttendeeRegistration**: Registration updates

**System Functions**

- **createNotification**: Notification creation

- **generateInvitations**: Bulk invitation generation

- **createSlotRequestsWithUsers**: Slot request management

**5. Permission System**

**Role Hierarchy**

1.  **App Admin** (system_role: \'Admin\'): Full application management

2.  **Super User** (system_role: \'Super User\'): Limited administrative
    access

3.  **User** (system_role: \'User\'): Standard user with registration
    slots

**Permission Matrix**

| **Action**            | **App Admin**               | **Super User**  | **User**                                                                                          |
|-----------------------|-----------------------------|-----------------|---------------------------------------------------------------------------------------------------|
| Manage Users          | ✅ (except Platform Admins) | ✅ (Users only) | ❌                                                                                                |
| View All Attendees    | ✅                          | ✅              | Own only and modification before approval and request for modification if application is approved |
| Approve Registrations | ✅                          | ❌              | ❌                                                                                                |
| System Settings       | ✅                          | ❌              | ❌                                                                                                |
| Generate Invitations  | ✅                          | ❌              | ❌                                                                                                |
| Manage Partnerships   | ✅                          | ❌              | ❌                                                                                                |

**6. Key Workflows**

**Registration Workflow**

1.  **Invitation Creation** → Admin generates codes

2.  **Registration** → User fills form with invitation/manual entry

3.  **Review** → Admin reviews and approves/declines

4.  **Approval** → Welcome email sent, badge QR generated

5.  **Modification** → Admin can request changes for pending
    registrations

**User Management Workflow**

1.  **Admin** → Admin can create super user or user with initial
    password

2.  **Super user**  → super user can create user with initial password

3.  **User Receive Welcome Email with login information**

4.  **Setup** → New user completes profile setup and change password

5.  **Slot Assignment** → as per the user (partner) type

**Invitation Workflow**

1.  **Generation** → Admin creates bulk invitations []{dir="rtl"} or
    single invitation ({\"VIP\": , \"Partner\": , \"Exhibitor\": ,
    \"Media\" )

2.  **Distribution** → Invitations sent via email with public link (no
    password Required and link in valid for one time only)

3.  **Usage** → Recipients register (validation required link not used
    before)

4.  **Tracking** → System tracks usage and expiration

**7. Data Flow**

**Authentication Flow**

- Session-based authentication

- Role-based access control

- Module-level permissions

**Registration Data Flow**

- Form validation (client-side)

- English-only field validation

- Photo upload to cloud storage

- Database persistence with RLS

- Email notifications

- Status tracking

**Notification System**

- Real-time notifications

- Email integration

- Role-based targeting

- Activity tracking

**8. Security Features**

**Row Level Security (RLS)**

- Users see only their own data

- Admin override permissions

- Cross-user data protection

**Validation Systems**

- English-only input validation

- Age verification (18+ requirement)

- File type/size restrictions

**Access Controls**

- Route-level protection

- Component-level permissions

- Function-level authorization

- Module activation controls

**9. Integration Points**

**External Services**

- **Resend**: Email delivery service

- **Supabase or external DB**: Infrastructure, authentication and cloud
  storage

**APIs**

- Entity CRUD operations

- Function invocations

- File upload endpoints

- Authentication endpoints

This system provides a complete event management solution with
sophisticated user management, flexible registration workflows, and
comprehensive administrative controls while maintaining security and
scalability.
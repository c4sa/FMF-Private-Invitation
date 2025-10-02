# SMTP Configuration for Future Minerals Forum

## Environment Variables Setup

Create a `.env` file in the root directory with the following configuration:

### Option 1: Custom SMTP (if DNS is working)
```env
# SMTP Configuration for Future Minerals Forum
# Choose your SMTP provider: 'gmail', 'outlook', or 'custom'
SMTP_PROVIDER=custom

# SMTP Credentials for Future Minerals Forum
SMTP_USER=noreply@futuremineralsforum.com.sa
SMTP_PASS=Core@Code25

# SMTP Settings for custom provider
SMTP_HOST=mail.futuremineralsforum.com.sa
SMTP_PORT=465
SMTP_SECURE=true

# Email Settings
SMTP_FROM=noreply@futuremineralsforum.com.sa
```

### Option 2: Gmail SMTP (Fallback - Recommended)
```env
# SMTP Configuration using Gmail
SMTP_PROVIDER=gmail
SMTP_USER=shozabimdad90@gmail.com
SMTP_PASS=vvjc spgl ebmr lkwf
SMTP_FROM=shozabimdad90@gmail.com
```

### Option 3: Alternative Custom SMTP (if main server is down)
```env
# Alternative SMTP Configuration
SMTP_PROVIDER=custom
SMTP_USER=noreply@futuremineralsforum.com.sa
SMTP_PASS=Core@Code25
SMTP_HOST=futuremineralsforum.com.sa
SMTP_PORT=587
SMTP_SECURE=false
SMTP_FROM=noreply@futuremineralsforum.com.sa
```

## Configuration Details

- **Provider**: Custom SMTP (not Gmail or Outlook)
- **Host**: mail.futuremineralsforum.com.sa
- **Port**: 465 (SSL/TLS)
- **Security**: SSL/TLS enabled (secure: true)
- **Authentication**: Required
- **From Address**: noreply@futuremineralsforum.com.sa

## How to Apply

1. Create a `.env` file in the project root
2. Copy the configuration above into the `.env` file
3. Restart your server/application
4. Test email sending functionality

## Notes

- Port 465 is used for SSL/TLS encrypted connections
- The system will automatically use these settings when SMTP_PROVIDER is set to 'custom'
- All emails will be sent from noreply@futuremineralsforum.com.sa

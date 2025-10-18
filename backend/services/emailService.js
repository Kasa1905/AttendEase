const nodemailer = require('nodemailer');

let transporter;

function initTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Verify transporter configuration in development
    if (process.env.NODE_ENV !== 'production') {
      transporter.verify((error, success) => {
        if (error) {
          console.error('SMTP transporter verification failed:', error);
        } else {
          console.log('SMTP transporter is ready to send emails');
        }
      });
    }
  }
  return transporter;
}

async function sendStrikeWarningEmail(userEmail, userName, strikeCount) {
  try {
    const transporter = initTransporter();
    const fromEmail = process.env.SMTP_FROM || 'noreply@clubattendance.com';
    const fromName = process.env.SMTP_FROM_NAME || 'Club Attendance System';

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: userEmail,
      subject: 'Strike Warning - Club Attendance System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">Strike Warning</h2>
          <p>Dear ${userName},</p>
          <p>You currently have <strong>${strikeCount} active strikes</strong> in the Club Attendance System.</p>
          <p><strong>Important:</strong> If you receive 5 or more active strikes, your account will be suspended for 7 days.</p>
          <p>Please ensure you:</p>
          <ul>
            <li>Log your hourly work during duty sessions</li>
            <li>Complete at least 2 hours (120 minutes) of duty per session</li>
            <li>Take breaks of no more than 30 minutes</li>
          </ul>
          <p>Contact your core team if you have any questions or concerns.</p>
          <p>Best regards,<br>Club Attendance System</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Strike warning email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending strike warning email:', error);
    throw error;
  }
}

async function sendSuspensionEmail(userEmail, userName, suspensionEndDate) {
  try {
    const transporter = initTransporter();
    const fromEmail = process.env.SMTP_FROM || 'noreply@clubattendance.com';
    const fromName = process.env.SMTP_FROM_NAME || 'Club Attendance System';

    const formattedEndDate = new Date(suspensionEndDate).toLocaleDateString();

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: userEmail,
      subject: 'Account Suspended - Club Attendance System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">Account Suspended</h2>
          <p>Dear ${userName},</p>
          <p>Your account has been <strong>suspended</strong> due to multiple strikes.</p>
          <p><strong>Suspension Details:</strong></p>
          <ul>
            <li>Suspension End Date: <strong>${formattedEndDate}</strong></li>
            <li>Duration: 7 days</li>
          </ul>
          <p>During suspension, you will not be able to:</p>
          <ul>
            <li>Log attendance</li>
            <li>Start duty sessions</li>
            <li>Access student features</li>
          </ul>
          <p>Please contact your core team to discuss your situation and resolve outstanding strikes.</p>
          <p>Best regards,<br>Club Attendance System</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Suspension email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending suspension email:', error);
    throw error;
  }
}

async function sendStrikeNotificationToTeachers(studentName, strikeReason, strikeCount) {
  try {
    // In a real implementation, you'd fetch all teacher emails from the database
    // For now, we'll send to a configured teacher notification email
    const teacherEmail = process.env.TEACHER_NOTIFICATION_EMAIL;
    if (!teacherEmail) {
      console.log('Teacher notification email not configured');
      return;
    }

    const transporter = initTransporter();
    const fromEmail = process.env.SMTP_FROM || 'noreply@clubattendance.com';
    const fromName = process.env.SMTP_FROM_NAME || 'Club Attendance System';

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: teacherEmail,
      subject: `Student Strike Alert - ${studentName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1976d2;">Student Strike Alert</h2>
          <p>Dear Teacher,</p>
          <p>This is to inform you that student <strong>${studentName}</strong> has received a strike.</p>
          <p><strong>Details:</strong></p>
          <ul>
            <li>Reason: ${strikeReason}</li>
            <li>Current Strike Count: ${strikeCount}</li>
          </ul>
          <p>Please monitor this student's attendance and performance.</p>
          <p>Best regards,<br>Club Attendance System</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Teacher strike notification email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending teacher strike notification:', error);
    throw error;
  }
}

async function sendStrikeNotificationToCoreTeam(studentName, strikeReason, strikeCount) {
  try {
    // In a real implementation, you'd fetch all core team emails from the database
    // For now, we'll send to a configured core team notification email
    const coreTeamEmail = process.env.CORE_TEAM_NOTIFICATION_EMAIL;
    if (!coreTeamEmail) {
      console.log('Core team notification email not configured');
      return;
    }

    const transporter = initTransporter();
    const fromEmail = process.env.SMTP_FROM || 'noreply@clubattendance.com';
    const fromName = process.env.SMTP_FROM_NAME || 'Club Attendance System';

    const escalationLevel = strikeCount >= 5 ? 'CRITICAL - Account Suspended' :
                          strikeCount >= 3 ? 'WARNING - Near Suspension' : 'INFO';

    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: coreTeamEmail,
      subject: `[${escalationLevel}] Student Strike Alert - ${studentName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${strikeCount >= 5 ? '#d32f2f' : strikeCount >= 3 ? '#f57c00' : '#1976d2'};">Student Strike Alert</h2>
          <p>Dear Core Team,</p>
          <p>Student <strong>${studentName}</strong> has received a strike that requires your attention.</p>
          <p><strong>Details:</strong></p>
          <ul>
            <li>Reason: ${strikeReason}</li>
            <li>Current Strike Count: ${strikeCount}</li>
            <li>Escalation Level: ${escalationLevel}</li>
          </ul>
          ${strikeCount >= 5 ? '<p style="color: #d32f2f; font-weight: bold;">⚠️ The student\'s account has been suspended for 7 days.</p>' : ''}
          ${strikeCount >= 3 ? '<p style="color: #f57c00; font-weight: bold;">⚠️ The student is approaching suspension threshold.</p>' : ''}
          <p>Please review and resolve strikes as appropriate.</p>
          <p>Best regards,<br>Club Attendance System</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Core team strike notification email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending core team strike notification:', error);
    throw error;
  }
}

module.exports = {
  sendStrikeWarningEmail,
  sendSuspensionEmail,
  sendStrikeNotificationToTeachers,
  sendStrikeNotificationToCoreTeam
};
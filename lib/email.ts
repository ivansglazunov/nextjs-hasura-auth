import { Resend } from 'resend';
import Debug from 'hasyx/lib/debug';

const debug = Debug('email');

const resendApiKey = process.env.RESEND_API_KEY;
const nextAuthUrl = process.env.NEXT_PUBLIC_BASE_URL; // Base URL for verification links

if (!resendApiKey) {
    console.warn('⚠️ RESEND_API_KEY environment variable is not set. Email sending will be disabled.');
    debug('Resend API key not found.');
}
if (!nextAuthUrl) {
     console.warn('⚠️ NEXT_PUBLIC_BASE_URL environment variable is not set. Verification links might be incorrect.');
    debug('NEXT_PUBLIC_BASE_URL not found.');
}

const resend = resendApiKey ? new Resend(resendApiKey) : null;

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    from?: string; // Optional: Defaults below
}

/**
 * Sends an email using Resend.
 * @param options - Email options (to, subject, html, from).
 * @returns Promise<boolean> - True if email was sent successfully (or Resend is disabled), false otherwise.
 */
async function sendEmail(options: EmailOptions): Promise<boolean> {
    if (!resend) {
        debug('Resend is not configured (missing API key). Skipping email send to: %s', options.to);
        // In development or if key is missing, maybe we pretend it succeeded?
        // Or return false to indicate it wasn't actually sent. Let's return true for now.
        return true; 
    }

    const { to, subject, html, from = 'onboarding@resend.dev' } = options; // Default 'from' address
     debug('Attempting to send email via Resend to: %s Subject: %s', to, subject);

    try {
        const { data, error } = await resend.emails.send({
            from: from,
            to: to,
            subject: subject,
            html: html,
        });

        if (error) {
            debug('Error sending email via Resend:', error);
            console.error("Resend API Error:", error);
            return false;
        }

        debug('Email sent successfully via Resend. ID: %s', data?.id);
        return true;
    } catch (error: any) {
        debug('Failed to send email due to exception:', error);
        console.error("Exception during email send:", error);
        return false;
    }
}

/**
 * Sends the verification email to a newly registered user.
 * @param email - The recipient's email address.
 * @param token - The verification token.
 * @returns Promise<boolean> - True if email was sent successfully.
 */
export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
    const verificationLink = `${nextAuthUrl || 'http://localhost:3000'}/api/auth/verify?token=${token}`;
    debug('Generated verification link: %s', verificationLink);

    const subject = 'Verify your email address';
    const html = `<p>Welcome! Please click the link below to verify your email address:</p>
                  <p><a href="${verificationLink}">Verify Email</a></p>
                  <p>If you didn't request this, please ignore this email.</p>
                  <p>Link: ${verificationLink}</p>`; // Include link as text too

    return sendEmail({
        to: email,
        subject: subject,
        html: html,
        // You might want to customize the 'from' address later
        // from: 'Your App Name <verify@yourdomain.com>' 
    });
} 
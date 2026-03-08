import { Resend } from 'resend';

// You will need to add RESEND_API_KEY to your .env file
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(to: string, subject: string, html: string) {
    try {
        const { data, error } = await resend.emails.send({
            from: 'Bodhi Prism <reports@resend.dev>', // You can customize this once you verify a domain
            to: [to],
            subject: subject,
            html: html,
        });

        if (error) {
            console.error('Email error:', error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (err) {
        console.error('Email exception:', err);
        return { success: false, error: err };
    }
}

import {ApiError} from "./ApiError";
import nodemailer from "nodemailer";

type SendPasswordResetEmailInput = {
    to: string;
    resetLink: string;
    userName?: string;
};

async function sendGmailEmail(input: SendPasswordResetEmailInput) {
    const gmailUser = process.env.GMAIL_USER;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
    const fromEmail = process.env.GMAIL_FROM_EMAIL || gmailUser;

    if (!gmailUser || !gmailAppPassword || !fromEmail) {
        throw new ApiError(503, "Email service is not configured");
    }

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: gmailUser,
            pass: gmailAppPassword,
        },
    });

    await transporter.sendMail({
        from: fromEmail,
        to: input.to,
        subject: "Reset your Canvas.io password",
        text: `${input.userName ? `Hi ${input.userName},\n\n` : ""}Reset your Canvas.io password here: ${input.resetLink}\n\nThis link expires in 30 minutes. If you did not request this, ignore this email.`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
                <h2 style="margin-bottom: 12px;">Reset your Canvas.io password</h2>
                <p>${input.userName ? `Hi ${input.userName},` : "Hi,"} a password reset was requested for your account.</p>
                <p>Click the link below to choose a new password. This link expires in 30 minutes.</p>
                <p><a href="${input.resetLink}">${input.resetLink}</a></p>
                <p>If you did not request this, you can ignore this message.</p>
            </div>
        `,
    });
}

export async function sendPasswordResetEmail(input: SendPasswordResetEmailInput) {
    await sendGmailEmail(input);
}
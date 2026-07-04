import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendWelcomeEmail(email: string, firstName: string, tempPassword: string) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "MediCare - Tu cuenta ha sido creada",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0f766e;">Bienvenido a MediCare</h2>
          <p>Hola ${firstName},</p>
          <p>Tu cuenta ha sido creada por el administrador.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 8px 0 0 0;"><strong>Contraseña temporal:</strong> ${tempPassword}</p>
          </div>
          <p style="color: #dc2626;"><strong>Importante:</strong> Por favor, inicia sesión y cambia tu contraseña inmediatamente.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #6b7280; font-size: 12px;">© ${new Date().getFullYear()} MediCare</p>
        </div>
      `,
    });
    console.log(`[Email] Welcome email sent to ${email}`);
  } catch (error) {
    console.error(`[Email] Failed to send welcome email to ${email}:`, error);
  }
}

export async function sendPasswordChangeNotification(email: string, firstName: string) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: "MediCare - Tu contraseña ha sido cambiada",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0f766e;">Contraseña cambiada</h2>
          <p>Hola ${firstName},</p>
          <p>Tu contraseña ha sido cambiada exitosamente.</p>
          <p>Si no realizaste este cambio, contacta al administrador inmediatamente.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="color: #6b7280; font-size: 12px;">© ${new Date().getFullYear()} MediCare</p>
        </div>
      `,
    });
  } catch (error) {
    console.error(`[Email] Failed to send password change notification to ${email}:`, error);
  }
}

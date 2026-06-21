import nodemailer from "nodemailer";
import QRCode from "qrcode";

const BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";

function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

export interface TicketEmailPayload {
  to: string;
  guestName: string;
  eventTitle: string;
  eventStart: Date | null;
  eventEnd: Date | null;
  venueLabel: string | null;
  ticketToken: string;
  slug: string;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

async function generateQRBuffer(token: string): Promise<Buffer> {
  // QR encodes only the token — no guest PII.
  return QRCode.toBuffer(token, {
    width: 260,
    margin: 2,
    color: { dark: "#0D0D12", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });
}

const QR_CID = "qrcode@pyramidoftirana";

function buildHtml(p: TicketEmailPayload): string {
  const eventUrl = `${BASE_URL}/events/${p.slug}`;
  const dateLabel = formatDate(p.eventStart);
  const timeLabel =
    p.eventStart && p.eventEnd
      ? `${formatTime(p.eventStart)} – ${formatTime(p.eventEnd)}`
      : p.eventStart
        ? formatTime(p.eventStart)
        : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your ticket — ${p.eventTitle}</title>
</head>
<body style="margin:0;padding:0;background:#0D0D12;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0D0D12;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" role="presentation" style="max-width:520px;width:100%;margin:0 auto;">

          <!-- Brand -->
          <tr>
            <td style="padding:0 0 24px 0;text-align:center;">
              <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;">
                <polygon points="17,4 31,29 3,29" stroke="#C8F000" stroke-width="1.8" fill="none"/>
              </svg>
              <div style="margin-top:9px;font-size:10px;font-weight:600;letter-spacing:.18em;color:#7D8799;text-transform:uppercase;">Pyramid of Tirana</div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#151821;border:1px solid rgba(255,255,255,.08);border-radius:20px;overflow:hidden;">

              <!-- Lime top bar -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr><td style="height:4px;background:linear-gradient(90deg,#C8F000,#6EE7B7);font-size:0;line-height:0;">&nbsp;</td></tr>
              </table>

              <!-- Header section -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:32px 36px 0;">
                <tr>
                  <td style="padding-bottom:6px;">
                    <div style="font-size:10px;font-weight:600;letter-spacing:.16em;color:#7D8799;text-transform:uppercase;">YOUR TICKET IS CONFIRMED</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:26px;">
                    <h1 style="margin:0;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-.02em;line-height:1.1;">${p.eventTitle}</h1>
                  </td>
                </tr>

                <!-- Date + Venue -->
                <tr>
                  <td style="padding-bottom:24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td width="48%" style="padding:14px;background:rgba(255,255,255,.04);border-radius:10px;vertical-align:top;">
                          <div style="font-size:9px;font-weight:600;letter-spacing:.14em;color:#7D8799;text-transform:uppercase;margin-bottom:5px;">DATE</div>
                          <div style="font-size:13px;font-weight:600;color:#ffffff;">${dateLabel}</div>
                          ${timeLabel ? `<div style="font-size:12px;font-weight:500;color:#C8F000;margin-top:3px;">${timeLabel}</div>` : ""}
                        </td>
                        <td width="4%"></td>
                        <td width="48%" style="padding:14px;background:rgba(255,255,255,.04);border-radius:10px;vertical-align:top;">
                          <div style="font-size:9px;font-weight:600;letter-spacing:.14em;color:#7D8799;text-transform:uppercase;margin-bottom:5px;">VENUE</div>
                          <div style="font-size:13px;font-weight:600;color:#ffffff;">${p.venueLabel ?? "Pyramid of Tirana"}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Guest name -->
                <tr>
                  <td style="padding-bottom:4px;">
                    <div style="font-size:9px;font-weight:600;letter-spacing:.14em;color:#7D8799;text-transform:uppercase;">REGISTERED AS</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:28px;">
                    <div style="font-size:17px;font-weight:700;color:#ffffff;">${p.guestName}</div>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="padding-bottom:24px;">
                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr><td style="height:1px;background:rgba(255,255,255,.07);font-size:0;line-height:0;">&nbsp;</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- QR Code section -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:0 36px 32px;">
                <tr>
                  <td style="text-align:center;padding-bottom:10px;">
                    <div style="font-size:9px;font-weight:600;letter-spacing:.16em;color:#7D8799;text-transform:uppercase;margin-bottom:18px;">SCAN TO CHECK IN</div>
                    <!-- QR code on white tile so scanners work reliably -->
                    <div style="display:inline-block;background:#ffffff;border-radius:16px;padding:16px;">
                      <img src="cid:${QR_CID}" width="220" height="220" alt="QR check-in code" style="display:block;border:0;" />
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Token strip -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(200,240,0,.05);border-top:1px solid rgba(200,240,0,.12);">
                <tr>
                  <td style="padding:16px 36px;">
                    <div style="font-size:9px;font-weight:600;letter-spacing:.14em;color:#7D8799;text-transform:uppercase;margin-bottom:5px;">TICKET TOKEN</div>
                    <div style="font-size:11px;font-weight:600;color:#C8F000;word-break:break-all;">${p.ticketToken}</div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 0;text-align:center;">
              <div style="font-size:11px;color:#4B5563;line-height:1.7;">
                Questions? Visit <a href="${eventUrl}" style="color:#C8F000;text-decoration:none;">the event page</a>
                or reply to this email.<br/>
                You received this because you registered for an event at the Pyramid of Tirana.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendTicketEmail(payload: TicketEmailPayload): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[email] GMAIL_USER / GMAIL_APP_PASSWORD not set — skipping ticket email");
    return false;
  }
  try {
    const qrBuffer = await generateQRBuffer(payload.ticketToken);
    await transporter.sendMail({
      from: `"Pyramid of Tirana" <${process.env.GMAIL_USER}>`,
      to: payload.to,
      subject: `Your ticket for ${payload.eventTitle} ✓`,
      html: buildHtml(payload),
      attachments: [
        {
          filename: "ticket-qr.png",
          content: qrBuffer,
          cid: QR_CID,   // referenced as cid:qrcode@pyramidoftirana in the HTML
        },
      ],
    });
    return true;
  } catch (err) {
    console.error("[email] Failed to send ticket email:", err);
    return false;
  }
}

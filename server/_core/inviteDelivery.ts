type InviteEmailInput = {
  to: string;
  condominiumName: string;
  inviteUrl: string;
  expiresAt: Date;
};

export async function sendInviteEmail(input: InviteEmailInput) {
  // Prefer the explicitly configured Brevo account. Do not retry through another
  // provider after an ambiguous failure: the first provider may have accepted it.
  const brevoKey = process.env.BREVO_API_KEY;
  const apiKey = brevoKey || process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL;
  if (!apiKey || !from) return { status: "not_configured" as const };

  const subject = `Convite para acessar o ${input.condominiumName}`;
  const text =
    `Olá!\n\nVocê foi convidado para acessar o ${input.condominiumName} no CondoHub.\n\n` +
    `Acesse seu convite: ${input.inviteUrl}\n\n` +
    `O link é válido até ${new Intl.DateTimeFormat("pt-BR").format(input.expiresAt)}.`;
  const provider = brevoKey ? "Brevo" : "Resend";

  // Resend accepts display-name addresses; Brevo uses a structured sender.
  const displayAddress = from.match(/^\s*([^<>]+)\s*<([^<>]+)>\s*$/);
  const sender = {
    email: displayAddress ? displayAddress[2].trim() : from.trim(),
    name: displayAddress ? displayAddress[1].trim() : "CondoHub",
  };

  try {
    const response = await fetch(
      brevoKey
        ? "https://api.brevo.com/v3/smtp/email"
        : "https://api.resend.com/emails",
      {
        method: "POST",
        headers: brevoKey
          ? {
              "api-key": apiKey,
              "Content-Type": "application/json",
            }
          : {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify(
          brevoKey
            ? {
                sender,
                to: [{ email: input.to }],
                subject,
                textContent: text,
                htmlContent:
                  `<p>Olá!</p><p>Você foi convidado para acessar o ${escapeHtml(input.condominiumName)} no CondoHub.</p>` +
                  `<p><a href="${escapeHtml(input.inviteUrl)}">Acessar convite</a></p>` +
                  `<p>O link é válido até ${new Intl.DateTimeFormat("pt-BR").format(input.expiresAt)}.</p>`,
              }
            : {
                from,
                to: [input.to],
                subject,
                text,
              }
        ),
      }
    );

    if (!response.ok) {
      console.error(`[Invites] ${provider} delivery failed:`, response.status);
      return { status: "failed" as const };
    }
    return { status: "sent" as const };
  } catch {
    return { status: "failed" as const };
  }
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    character =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!
  );
}

export function normalizePhone(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return null;

  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return /^55\d{10,11}$/.test(withCountry) ? withCountry : null;
}

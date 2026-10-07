type InviteEmailInput = {
  to: string;
  condominiumName: string;
  inviteUrl: string;
  expiresAt: Date;
};

export async function sendInviteEmail(input: InviteEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL;
  if (!apiKey || !from) return { status: "not_configured" as const };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `Convite para acessar o ${input.condominiumName}`,
      text:
        `Olá!\n\nVocê foi convidado para acessar o ${input.condominiumName} no CondoHub.\n\n` +
        `Acesse seu convite: ${input.inviteUrl}\n\n` +
        `O link é válido até ${new Intl.DateTimeFormat("pt-BR").format(input.expiresAt)}.`,
    }),
  });

  if (!response.ok) {
    console.error("[Invites] Resend delivery failed:", response.status, await response.text());
    return { status: "failed" as const };
  }
  return { status: "sent" as const };
}

export function normalizePhone(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.startsWith("55") ? digits : `55${digits}`;
}

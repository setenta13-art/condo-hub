import { supabaseAdminFetch } from "./supabase.js";

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as any;
  } catch {
    return text;
  }
}

async function request(path: string, init: RequestInit = {}) {
  const response = await supabaseAdminFetch(path, init);
  const data = await readJson(response);
  if (!response.ok) {
    const message =
      data?.message ??
      data?.error_description ??
      data?.error ??
      (typeof data === "string" ? data : "Supabase request failed");
    throw new Error(message);
  }
  return data;
}

const isoDate = (value: unknown) => value ? new Date(String(value)) : null;

export function mapUser(row: any) {
  return {
    id: Number(row.id),
    openId: row.open_id ?? null,
    name: row.name ?? null,
    email: row.email ?? null,
    loginMethod: row.login_method ?? null,
    role: row.role,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    lastSignedIn: new Date(row.last_signed_in),
  };
}

export function mapOrganization(row: any) {
  return {
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapCondominium(row: any) {
  return {
    id: Number(row.id),
    organizationId: Number(row.organization_id),
    name: row.name,
    address: row.address ?? null,
    city: row.city ?? null,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapBlock(row: any) {
  return {
    id: Number(row.id),
    condominiumId: Number(row.condominium_id),
    name: row.name,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapUnit(row: any) {
  return {
    id: Number(row.id),
    condominiumId: Number(row.condominium_id),
    blockId: row.block_id == null ? null : Number(row.block_id),
    identifier: row.identifier,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapMembership(row: any) {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    condominiumId: Number(row.condominium_id),
    role: row.role,
    unit: row.unit ?? null,
    block: row.block ?? null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapAnnouncement(row: any) {
  return {
    id: Number(row.id),
    condominiumId: Number(row.condominium_id),
    authorId: Number(row.author_id),
    title: row.title,
    summary: row.summary,
    body: row.body,
    category: row.category,
    isPinned: Boolean(row.is_pinned),
    publishedAt: new Date(row.published_at),
    archivedAt: isoDate(row.archived_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapTicket(row: any) {
  return {
    id: Number(row.id),
    condominiumId: Number(row.condominium_id),
    openedById: Number(row.opened_by_id),
    assignedToId: row.assigned_to_id == null ? null : Number(row.assigned_to_id),
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    priority: row.priority,
    block: row.block ?? null,
    unit: row.unit ?? null,
    resolvedAt: isoDate(row.resolved_at),
    closedAt: isoDate(row.closed_at),
    reopenedAt: isoDate(row.reopened_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapDocument(row: any) {
  return {
    id: Number(row.id),
    condominiumId: Number(row.condominium_id),
    uploadedById: Number(row.uploaded_by_id),
    title: row.title,
    description: row.description ?? null,
    category: row.category,
    fileUrl: row.file_url,
    fileKey: row.file_key,
    mimeType: row.mime_type ?? null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapInvitation(row: any) {
  return {
    id: Number(row.id),
    condominiumId: Number(row.condominium_id),
    createdById: Number(row.created_by_id),
    acceptedById: row.accepted_by_id == null ? null : Number(row.accepted_by_id),
    email: row.email ?? null,
    phone: row.phone ?? null,
    token: row.token,
    role: row.role,
    unit: row.unit ?? null,
    block: row.block ?? null,
    status: row.status,
    expiresAt: new Date(row.expires_at),
    acceptedAt: isoDate(row.accepted_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function listUserScopes(userId: number) {
  const membershipRows = await request(
    `memberships?user_id=eq.${userId}&select=*&order=created_at.asc`,
  ) as any[];
  const result = [];

  for (const membershipRow of membershipRows) {
    const membership = mapMembership(membershipRow);
    const condominiumRows = await request(
      `condominiums?id=eq.${membership.condominiumId}&status=eq.active&select=*&limit=1`,
    ) as any[];
    if (!condominiumRows[0]) continue;

    const condominium = mapCondominium(condominiumRows[0]);
    const organizationRows = await request(
      `organizations?id=eq.${condominium.organizationId}&select=*&limit=1`,
    ) as any[];
    if (!organizationRows[0]) continue;

    result.push({
      membership,
      condominium,
      organization: mapOrganization(organizationRows[0]),
    });
  }

  return result;
}

export async function getUserScope(
  userId: number,
  isPlatformAdmin = false,
  preferredMembershipId?: number | null,
) {
  const scopes = await listUserScopes(userId);
  const preferred = preferredMembershipId
    ? scopes.find(scope => scope.membership.id === preferredMembershipId)
    : undefined;

  if (preferred) return preferred;
  if (scopes[0]) return scopes[0];

  if (!isPlatformAdmin) return undefined;

  const condominiumRows = await request(
    "condominiums?status=eq.active&select=*&order=created_at.asc&limit=1",
  ) as any[];
  if (!condominiumRows[0]) return undefined;

  const condominium = mapCondominium(condominiumRows[0]);
  const organizationRows = await request(
    `organizations?id=eq.${condominium.organizationId}&select=*&limit=1`,
  ) as any[];
  if (!organizationRows[0]) return undefined;

  return {
    membership: undefined,
    condominium,
    organization: mapOrganization(organizationRows[0]),
  };
}

export async function getAnnouncements(condominiumId: number) {
  const rows = await request(
    `announcements?condominium_id=eq.${condominiumId}&archived_at=is.null&select=*&order=is_pinned.desc,published_at.desc`,
  ) as any[];
  return rows.map(mapAnnouncement);
}

export async function getTickets(
  condominiumId: number,
  userId: number,
  isStaff: boolean,
  block?: string | null,
  unit?: string | null,
) {
  const rows = await request(
    `tickets?condominium_id=eq.${condominiumId}&select=*&order=created_at.desc`,
  ) as any[];
  const mapped = rows.map(mapTicket);
  if (isStaff) return mapped;

  return mapped.filter(ticket =>
    ticket.openedById === userId ||
    Boolean(unit && ticket.unit === unit && (block ? ticket.block === block : true)),
  );
}

export async function getDocuments(condominiumId: number) {
  const rows = await request(
    `documents?condominium_id=eq.${condominiumId}&select=*&order=created_at.desc`,
  ) as any[];
  return rows.map(mapDocument);
}

export async function getUnitCount(condominiumId: number) {
  const response = await supabaseAdminFetch(
    `units?condominium_id=eq.${condominiumId}&status=eq.active&select=id`,
    {
      headers: { Prefer: "count=exact" },
    },
  );
  if (!response.ok) throw new Error("Não foi possível contar as unidades.");
  const contentRange = response.headers.get("content-range");
  const total = contentRange?.split("/")[1];
  return total && total !== "*" ? Number(total) : 0;
}

export async function createAnnouncement(input: {
  condominiumId: number;
  authorId: number;
  title: string;
  summary: string;
  body: string;
  category: string;
  isPinned: boolean;
}) {
  await request("announcements", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      condominium_id: input.condominiumId,
      author_id: input.authorId,
      title: input.title,
      summary: input.summary,
      body: input.body,
      category: input.category,
      is_pinned: input.isPinned,
    }),
  });
}

export async function createTicket(input: {
  condominiumId: number;
  openedById: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  assignedToId: number;
  block?: string | null;
  unit?: string | null;
}) {
  const rows = await request("tickets?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      condominium_id: input.condominiumId,
      opened_by_id: input.openedById,
      assigned_to_id: input.assignedToId,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      status: "assigned",
      block: input.block ?? null,
      unit: input.unit ?? null,
    }),
  }) as any[];
  return mapTicket(rows[0]);
}

export async function updateTicketStatus(
  id: number,
  condominiumId: number,
  status: string,
) {
  await request(
    `tickets?id=eq.${id}&condominium_id=eq.${condominiumId}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        status,
        ...(status === "resolved" ? { resolved_at: new Date().toISOString() } : {}),
        ...(status === "closed" ? { closed_at: new Date().toISOString() } : {}),
        ...(status === "open" ? { reopened_at: new Date().toISOString(), resolved_at: null, closed_at: null } : {}),
      }),
    },
  );
}


export async function getTicketById(id: number, condominiumId: number) {
  const rows = await request(
    `tickets?id=eq.${id}&condominium_id=eq.${condominiumId}&select=*&limit=1`,
  ) as any[];
  return rows[0] ? mapTicket(rows[0]) : undefined;
}

export async function assignTicket(
  id: number,
  condominiumId: number,
  assignedToId: number,
) {
  await request(`tickets?id=eq.${id}&condominium_id=eq.${condominiumId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ assigned_to_id: assignedToId, status: "assigned" }),
  });
}

export async function createTicketEvent(input: {
  ticketId: number;
  actorId?: number | null;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  assignedToId?: number | null;
  note?: string | null;
}) {
  await request("ticket_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      ticket_id: input.ticketId,
      actor_id: input.actorId ?? null,
      event_type: input.eventType,
      from_status: input.fromStatus ?? null,
      to_status: input.toStatus ?? null,
      assigned_to_id: input.assignedToId ?? null,
      note: input.note ?? null,
    }),
  });
}

export async function listTicketEvents(ticketId: number) {
  const rows = await request(
    `ticket_events?ticket_id=eq.${ticketId}&select=*&order=created_at.asc`,
  ) as any[];
  return rows.map(row => ({
    id: Number(row.id),
    ticketId: Number(row.ticket_id),
    actorId: row.actor_id == null ? null : Number(row.actor_id),
    eventType: row.event_type as string,
    fromStatus: row.from_status ?? null,
    toStatus: row.to_status ?? null,
    assignedToId: row.assigned_to_id == null ? null : Number(row.assigned_to_id),
    note: row.note ?? null,
    createdAt: new Date(row.created_at),
  }));
}

export async function addTicketMessage(ticketId: number, authorId: number, body: string) {
  const rows = await request("ticket_messages?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ticket_id: ticketId, author_id: authorId, body }),
  }) as any[];
  const row = rows[0];
  return {
    id: Number(row.id),
    ticketId: Number(row.ticket_id),
    authorId: Number(row.author_id),
    body: row.body as string,
    createdAt: new Date(row.created_at),
  };
}

export async function listTicketMessages(ticketId: number) {
  const rows = await request(
    `ticket_messages?ticket_id=eq.${ticketId}&select=*&order=created_at.asc`,
  ) as any[];
  return rows.map(row => ({
    id: Number(row.id),
    ticketId: Number(row.ticket_id),
    authorId: Number(row.author_id),
    body: row.body as string,
    createdAt: new Date(row.created_at),
  }));
}

export async function createNotification(input: {
  userId: number;
  condominiumId: number;
  ticketId?: number | null;
  kind: string;
  title: string;
  body?: string | null;
}) {
  await request("notifications", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      user_id: input.userId,
      condominium_id: input.condominiumId,
      ticket_id: input.ticketId ?? null,
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
    }),
  });
}

export async function listNotifications(userId: number, condominiumId: number) {
  const rows = await request(
    `notifications?user_id=eq.${userId}&condominium_id=eq.${condominiumId}&select=*&order=created_at.desc&limit=50`,
  ) as any[];
  return rows.map(row => ({
    id: Number(row.id),
    userId: Number(row.user_id),
    condominiumId: Number(row.condominium_id),
    ticketId: row.ticket_id == null ? null : Number(row.ticket_id),
    kind: row.kind as string,
    title: row.title as string,
    body: row.body ?? null,
    readAt: isoDate(row.read_at),
    createdAt: new Date(row.created_at),
  }));
}

export async function markNotificationRead(id: number, userId: number) {
  await request(`notifications?id=eq.${id}&user_id=eq.${userId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ read_at: new Date().toISOString() }),
  });
}

export async function markAllNotificationsRead(userId: number, condominiumId: number) {
  await request(
    `notifications?user_id=eq.${userId}&condominium_id=eq.${condominiumId}&read_at=is.null`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ read_at: new Date().toISOString() }),
    },
  );
}

export async function updateAnnouncement(
  id: number,
  condominiumId: number,
  input: { title: string; summary: string; body: string; category: string; isPinned: boolean },
) {
  await request(`announcements?id=eq.${id}&condominium_id=eq.${condominiumId}&archived_at=is.null`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      title: input.title,
      summary: input.summary,
      body: input.body,
      category: input.category,
      is_pinned: input.isPinned,
    }),
  });
}

export async function archiveAnnouncement(id: number, condominiumId: number) {
  await request(`announcements?id=eq.${id}&condominium_id=eq.${condominiumId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ archived_at: new Date().toISOString(), is_pinned: false }),
  });
}

export async function markAnnouncementRead(announcementId: number, userId: number) {
  const rows = await request(
    `announcement_reads?announcement_id=eq.${announcementId}&user_id=eq.${userId}&select=*&limit=1`,
  ) as any[];
  if (!rows[0]) {
    await request("announcement_reads", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ announcement_id: announcementId, user_id: userId }),
    });
  }
  const updated = await request(
    `announcement_reads?announcement_id=eq.${announcementId}&user_id=eq.${userId}&select=*&limit=1`,
  ) as any[];
  return updated[0] ? new Date(updated[0].read_at) : null;
}

export async function getAnnouncementRead(announcementId: number, userId: number) {
  const rows = await request(
    `announcement_reads?announcement_id=eq.${announcementId}&user_id=eq.${userId}&select=read_at&limit=1`,
  ) as any[];
  return rows[0]?.read_at ? new Date(rows[0].read_at) : null;
}

export async function createDocument(input: {
  condominiumId: number;
  uploadedById: number;
  title: string;
  description?: string;
  category: string;
  fileUrl: string;
  fileKey: string;
  mimeType?: string;
}) {
  await request("documents", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      condominium_id: input.condominiumId,
      uploaded_by_id: input.uploadedById,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      file_url: input.fileUrl,
      file_key: input.fileKey,
      mime_type: input.mimeType ?? null,
    }),
  });
}

export async function getInvitationByToken(token: string) {
  const rows = await request(
    `invitations?token=eq.${encodeURIComponent(token)}&select=*&limit=1`,
  ) as any[];
  return rows[0] ? mapInvitation(rows[0]) : undefined;
}

export async function listInvitations(condominiumId: number) {
  const rows = await request(
    `invitations?condominium_id=eq.${condominiumId}&select=*&order=created_at.desc`,
  ) as any[];
  return rows.map(mapInvitation);
}


export async function listPendingInvitationsByEmail(email: string) {
  const rows = await request(
    `invitations?status=eq.pending&email=ilike.${encodeURIComponent(email)}&select=*&order=created_at.asc`,
  ) as any[];
  return rows
    .map(mapInvitation)
    .filter(invitation => invitation.expiresAt.getTime() > Date.now());
}

export async function listBlocks(condominiumId: number) {
  const rows = await request(
    `blocks?condominium_id=eq.${condominiumId}&select=*&order=name.asc`,
  ) as any[];
  return rows.map(mapBlock);
}

export async function listUnits(condominiumId: number, activeOnly = false) {
  const status = activeOnly ? "&status=eq.active" : "";
  const rows = await request(
    `units?condominium_id=eq.${condominiumId}${status}&select=*&order=identifier.asc`,
  ) as any[];
  return rows.map(mapUnit);
}

export async function createInvitation(input: {
  condominiumId: number;
  createdById: number;
  email: string | null;
  phone?: string | null;
  token: string;
  role: string;
  unit: string | null;
  block: string | null;
  expiresAt: Date;
}) {
  const rows = await request("invitations?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      condominium_id: input.condominiumId,
      created_by_id: input.createdById,
      email: input.email,
      phone: input.phone ?? null,
      token: input.token,
      role: input.role,
      unit: input.unit,
      block: input.block,
      expires_at: input.expiresAt.toISOString(),
    }),
  }) as any[];
  return mapInvitation(rows[0]);
}

export async function revokeInvitation(id: number, condominiumId: number) {
  await request(
    `invitations?id=eq.${id}&condominium_id=eq.${condominiumId}&status=eq.pending`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "revoked" }),
    },
  );
}

export async function acceptInvitationRpc(token: string, userId: number, userEmail: string | null) {
  return request("rpc/accept_invitation", {
    method: "POST",
    body: JSON.stringify({
      p_token: token,
      p_user_id: userId,
      p_user_email: userEmail,
    }),
  });
}

export async function getUserById(id: number) {
  const rows = await request(`app_users?id=eq.${id}&select=*&limit=1`) as any[];
  return rows[0] ? mapUser(rows[0]) : undefined;
}

export async function updateUserName(id: number, name: string) {
  await request(`app_users?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ name }),
  });
}

export async function listMemberships(condominiumId: number) {
  const rows = await request(
    `memberships?condominium_id=eq.${condominiumId}&select=*&order=block.asc.nullslast,unit.asc.nullslast`,
  ) as any[];
  return rows.map(mapMembership);
}

export async function updateMembership(
  id: number,
  condominiumId: number,
  input: { role: string; unit: string | null; block: string | null },
) {
  await request(
    `memberships?id=eq.${id}&condominium_id=eq.${condominiumId}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(input),
    },
  );
}

export async function removeMembership(id: number, condominiumId: number) {
  await request(
    `memberships?id=eq.${id}&condominium_id=eq.${condominiumId}`,
    { method: "DELETE" },
  );
}

export async function getOrganization(id: number) {
  const rows = await request(`organizations?id=eq.${id}&select=*&limit=1`) as any[];
  return rows[0] ? mapOrganization(rows[0]) : undefined;
}

export async function listOrganizations() {
  const rows = await request("organizations?select=*&order=name.asc") as any[];
  return rows.map(mapOrganization);
}

export async function listCondominiums() {
  const rows = await request("condominiums?select=*&order=created_at.desc") as any[];
  return rows.map(mapCondominium);
}

export async function getCondominiumById(id: number) {
  const rows = await request(`condominiums?id=eq.${id}&select=*&limit=1`) as any[];
  return rows[0] ? mapCondominium(rows[0]) : undefined;
}

export async function createOrganization(name: string, slug: string) {
  const rows = await request("organizations?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ name, slug }),
  }) as any[];
  return mapOrganization(rows[0]);
}

export async function createCondominium(input: {
  organizationId: number;
  name: string;
  address: string | null;
  city: string | null;
}) {
  const rows = await request("condominiums?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      organization_id: input.organizationId,
      name: input.name,
      address: input.address,
      city: input.city,
      status: "active",
    }),
  }) as any[];
  return mapCondominium(rows[0]);
}

export async function ensureMembership(
  userId: number,
  condominiumId: number,
  role: string,
) {
  await request("memberships", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: userId,
      condominium_id: condominiumId,
      role,
    }),
  });
}

export async function createBlock(condominiumId: number, name: string) {
  const rows = await request("blocks?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ condominium_id: condominiumId, name }),
  }) as any[];
  return mapBlock(rows[0]);
}

export async function createUnit(
  condominiumId: number,
  blockId: number | null,
  identifier: string,
) {
  const rows = await request("units?select=*", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      condominium_id: condominiumId,
      block_id: blockId,
      identifier,
      status: "active",
    }),
  }) as any[];
  return mapUnit(rows[0]);
}

export async function setCondominiumStatus(id: number, status: string) {
  await request(`condominiums?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status }),
  });
}


export async function listAllBlocks() {
  const rows = await request("blocks?select=*&order=name.asc") as any[];
  return rows.map(mapBlock);
}

export async function listAllUnits() {
  const rows = await request("units?select=*&order=identifier.asc") as any[];
  return rows.map(mapUnit);
}

// Legacy compatibility for the old Manus SDK. The public Vercel path is
// Supabase-only; these exports remain so the historical Express build compiles.
export async function getUserByOpenId(openId: string) {
  const rows = await request(
    `app_users?open_id=eq.${encodeURIComponent(openId)}&select=*&limit=1`,
  ) as any[];
  return rows[0] ? mapUser(rows[0]) : undefined;
}

export async function upsertUser(user: {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  role?: "user" | "admin";
  lastSignedIn?: Date;
}) {
  const existing = await getUserByOpenId(user.openId);
  if (!existing) {
    throw new Error(
      "Legacy Manus user creation is disabled after the Supabase Auth migration.",
    );
  }

  await request(
    `app_users?id=eq.${existing.id}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        ...(user.name !== undefined ? { name: user.name } : {}),
        ...(user.email !== undefined ? { email: user.email } : {}),
        ...(user.loginMethod !== undefined ? { login_method: user.loginMethod } : {}),
        ...(user.role !== undefined ? { role: user.role } : {}),
        last_signed_in: (user.lastSignedIn ?? new Date()).toISOString(),
      }),
    },
  );
}

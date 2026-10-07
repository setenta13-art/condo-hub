-- Cover foreign keys introduced by operational workflows.
create index if not exists announcement_reads_user_id_idx on public.announcement_reads(user_id);
create index if not exists notifications_condominium_id_idx on public.notifications(condominium_id);
create index if not exists notifications_ticket_id_idx on public.notifications(ticket_id);
create index if not exists ticket_events_actor_id_idx on public.ticket_events(actor_id);
create index if not exists ticket_events_assigned_to_id_idx on public.ticket_events(assigned_to_id);
create index if not exists ticket_messages_author_id_idx on public.ticket_messages(author_id);

-- Harden function execution and add missing foreign-key indexes.

revoke all on function public.accept_invitation(text, bigint, text) from public;
revoke all on function public.accept_invitation(text, bigint, text) from anon;
revoke all on function public.accept_invitation(text, bigint, text) from authenticated;
grant execute on function public.accept_invitation(text, bigint, text) to service_role;

alter function public.set_updated_at() set search_path = public, pg_temp;

create index if not exists announcements_author_id_idx
  on public.announcements(author_id);
create index if not exists condominiums_organization_id_idx
  on public.condominiums(organization_id);
create index if not exists documents_uploaded_by_id_idx
  on public.documents(uploaded_by_id);
create index if not exists invitations_accepted_by_id_idx
  on public.invitations(accepted_by_id);
create index if not exists invitations_created_by_id_idx
  on public.invitations(created_by_id);
create index if not exists tickets_assigned_to_id_idx
  on public.tickets(assigned_to_id);
create index if not exists tickets_opened_by_id_idx
  on public.tickets(opened_by_id);
create index if not exists units_block_id_idx
  on public.units(block_id);

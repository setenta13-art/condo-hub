-- Preserve every existing membership. Each role is an explicit selectable context.
create unique index if not exists memberships_user_condo_role_scope_uidx
  on public.memberships (user_id, condominium_id, role, coalesce(block, ''), coalesce(unit, ''));
drop index if exists public.memberships_user_condo_scope_uidx;

create or replace function public.accept_invitation(p_token text, p_user_id bigint, p_user_email text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_invitation public.invitations%rowtype;
  v_membership_id bigint;
  v_email text;
begin
  -- Only the trusted server may call this RPC; identity comes from its verified session.
  select lower(trim(a.email)) into v_email from public.app_users a
    join auth.users u on u.id = a.auth_user_id
   where a.id = p_user_id and u.email_confirmed_at is not null
     and lower(trim(u.email)) = lower(trim(a.email));
  if v_email is null or v_email <> lower(trim(coalesce(p_user_email, ''))) then
    return jsonb_build_object('ok', false, 'code', 'EMAIL_MISMATCH', 'message', 'Identidade não confirmada para este convite.');
  end if;

  select * into v_invitation from public.invitations where token = p_token for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Este convite não foi encontrado.');
  end if;
  if v_invitation.email is not null and lower(trim(v_invitation.email)) <> v_email then
    return jsonb_build_object('ok', false, 'code', 'EMAIL_MISMATCH', 'message', 'Este convite foi enviado para outro e-mail.');
  end if;
  if not exists (select 1 from public.condominiums where id = v_invitation.condominium_id and status = 'active') then
    return jsonb_build_object('ok', false, 'code', 'UNAVAILABLE', 'message', 'O condomínio deste convite não está ativo.');
  end if;

  select id into v_membership_id from public.memberships
   where user_id = p_user_id and condominium_id = v_invitation.condominium_id
     and role = v_invitation.role::text::public.membership_role
     and coalesce(block, '') = coalesce(v_invitation.block, '')
     and coalesce(unit, '') = coalesce(v_invitation.unit, '');
  if v_invitation.status = 'accepted' and v_invitation.accepted_by_id = p_user_id and v_membership_id is not null then
    return jsonb_build_object('ok', true, 'condominiumId', v_invitation.condominium_id, 'membershipId', v_membership_id, 'alreadyAccepted', true);
  end if;
  if v_invitation.status <> 'pending' then
    return jsonb_build_object('ok', false, 'code', 'UNAVAILABLE', 'message', 'Este convite não está mais disponível.');
  end if;
  if v_invitation.expires_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'EXPIRED', 'message', 'Este convite expirou. Solicite um novo link à administração.');
  end if;

  insert into public.memberships (user_id, condominium_id, role, unit, block)
    values (p_user_id, v_invitation.condominium_id, v_invitation.role::text::public.membership_role, v_invitation.unit, v_invitation.block)
    on conflict do nothing;
  select id into v_membership_id from public.memberships
   where user_id = p_user_id and condominium_id = v_invitation.condominium_id
     and role = v_invitation.role::text::public.membership_role
     and coalesce(block, '') = coalesce(v_invitation.block, '')
     and coalesce(unit, '') = coalesce(v_invitation.unit, '');
  if v_membership_id is null then
    raise exception 'Unable to create invitation membership';
  end if;
  update public.invitations set status = 'accepted', accepted_by_id = p_user_id, accepted_at = now(), email = coalesce(email, v_email) where id = v_invitation.id;
  return jsonb_build_object('ok', true, 'condominiumId', v_invitation.condominium_id, 'membershipId', v_membership_id);
end;
$$;
revoke all on function public.accept_invitation(text, bigint, text) from public, anon, authenticated;
grant execute on function public.accept_invitation(text, bigint, text) to service_role;

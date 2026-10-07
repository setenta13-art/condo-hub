-- Block 1: reliable onboarding, multiple unit memberships and hybrid invitations.

alter table public.memberships
  drop constraint if exists memberships_user_id_condominium_id_key;

create unique index if not exists memberships_user_condo_scope_uidx
  on public.memberships (
    user_id,
    condominium_id,
    coalesce(block, ''),
    coalesce(unit, '')
  );

alter table public.invitations
  add column if not exists phone varchar(30);

create index if not exists invitations_phone_idx
  on public.invitations(phone);

create or replace function public.accept_invitation(
  p_token text,
  p_user_id bigint,
  p_user_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.invitations%rowtype;
  v_membership_id bigint;
begin
  select * into v_invitation
    from public.invitations
   where token = p_token
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND', 'message', 'Este convite não foi encontrado.');
  end if;

  if v_invitation.status <> 'pending' then
    return jsonb_build_object(
      'ok', false,
      'code', 'UNAVAILABLE',
      'message', case
        when v_invitation.status = 'accepted' then 'Este convite já foi utilizado.'
        else 'Este convite não está mais disponível.'
      end
    );
  end if;

  if v_invitation.expires_at <= timezone('utc', now()) then
    update public.invitations set status = 'expired' where id = v_invitation.id;
    return jsonb_build_object('ok', false, 'code', 'EXPIRED', 'message', 'Este convite expirou. Solicite um novo link à administração.');
  end if;

  if v_invitation.email is not null
     and lower(trim(v_invitation.email)) <> lower(trim(coalesce(p_user_email, ''))) then
    return jsonb_build_object('ok', false, 'code', 'EMAIL_MISMATCH', 'message', 'Este convite foi enviado para outro e-mail.');
  end if;

  insert into public.memberships (user_id, condominium_id, role, unit, block)
  values (
    p_user_id,
    v_invitation.condominium_id,
    v_invitation.role::text::public.membership_role,
    v_invitation.unit,
    v_invitation.block
  )
  on conflict do nothing;

  select id into v_membership_id
    from public.memberships
   where user_id = p_user_id
     and condominium_id = v_invitation.condominium_id
     and coalesce(block, '') = coalesce(v_invitation.block, '')
     and coalesce(unit, '') = coalesce(v_invitation.unit, '')
   order by id
   limit 1;

  if v_membership_id is null then
    return jsonb_build_object('ok', false, 'code', 'MEMBERSHIP_ERROR', 'message', 'Não foi possível criar o vínculo deste acesso.');
  end if;

  update public.memberships
     set role = v_invitation.role::text::public.membership_role
   where id = v_membership_id;

  update public.invitations
     set status = 'accepted',
         accepted_by_id = p_user_id,
         accepted_at = timezone('utc', now()),
         email = coalesce(email, nullif(lower(trim(p_user_email)), ''))
   where id = v_invitation.id
     and status = 'pending';

  if not found then
    return jsonb_build_object('ok', false, 'code', 'CONFLICT', 'message', 'Este convite acabou de ser utilizado. Atualize a página para continuar.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'condominiumId', v_invitation.condominium_id,
    'membershipId', v_membership_id
  );
end;
$$;

revoke all on function public.accept_invitation(text, bigint, text) from public;
grant execute on function public.accept_invitation(text, bigint, text) to service_role;

insert into public.app_users (
  auth_user_id, open_id, name, email, login_method, last_signed_in
)
select
  u.id,
  u.id::text,
  coalesce(nullif(u.raw_user_meta_data->>'name', ''), u.email),
  lower(u.email),
  'supabase',
  coalesce(u.last_sign_in_at, timezone('utc', now()))
from auth.users u
where not exists (
  select 1 from public.app_users a where a.auth_user_id = u.id
);

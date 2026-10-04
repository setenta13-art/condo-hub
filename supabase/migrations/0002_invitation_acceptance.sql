-- Align invitation persistence with product rules and make acceptance atomic.
-- Resident unit requirement remains enforced by the API; email is optional.

alter table public.invitations alter column email drop not null;
alter table public.invitations alter column unit drop not null;

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
begin
  select *
    into v_invitation
    from public.invitations
   where token = p_token
   for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'NOT_FOUND',
      'message', 'Este convite não foi encontrado.'
    );
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
    update public.invitations
       set status = 'expired'
     where id = v_invitation.id;

    return jsonb_build_object(
      'ok', false,
      'code', 'EXPIRED',
      'message', 'Este convite expirou. Solicite um novo link à administração.'
    );
  end if;

  if v_invitation.email is not null
     and lower(v_invitation.email) <> lower(coalesce(p_user_email, '')) then
    return jsonb_build_object(
      'ok', false,
      'code', 'EMAIL_MISMATCH',
      'message', 'Este convite foi enviado para outro e-mail.'
    );
  end if;

  update public.invitations
     set status = 'accepted',
         accepted_by_id = p_user_id,
         accepted_at = timezone('utc', now())
   where id = v_invitation.id
     and status = 'pending';

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'CONFLICT',
      'message', 'Este convite acabou de ser utilizado. Atualize a página para continuar.'
    );
  end if;

  insert into public.memberships (user_id, condominium_id, role, unit, block)
  values (
    p_user_id,
    v_invitation.condominium_id,
    v_invitation.role::text::public.membership_role,
    v_invitation.unit,
    v_invitation.block
  )
  on conflict (user_id, condominium_id) do nothing;

  return jsonb_build_object(
    'ok', true,
    'condominiumId', v_invitation.condominium_id
  );
end;
$$;

revoke all on function public.accept_invitation(text, bigint, text) from public;
grant execute on function public.accept_invitation(text, bigint, text) to service_role;

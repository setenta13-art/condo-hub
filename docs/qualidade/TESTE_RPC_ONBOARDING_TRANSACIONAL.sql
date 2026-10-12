-- Execute after the migration, only using synthetic rows inside a rollback.
begin;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  uid bigint; other_uid bigint; org bigint; condo bigint; condo_b bigint;
  tok text := 'qa_' || replace(gen_random_uuid()::text, '-', '');
  staff_tok text := 'qa_' || replace(gen_random_uuid()::text, '-', '');
  result jsonb; first_result jsonb; n bigint;
begin
  insert into auth.users (id, email, email_confirmed_at) values (a, a::text || '@example.invalid', now()), (b, b::text || '@example.invalid', now());
  insert into public.app_users(auth_user_id, email) values (a, a::text || '@example.invalid') returning id into uid;
  insert into public.app_users(auth_user_id, email) values (b, b::text || '@example.invalid') returning id into other_uid;
  insert into public.organizations(name,slug) values ('QA rollback', 'qa-' || a::text) returning id into org;
  insert into public.condominiums(organization_id,name) values (org,'QA A') returning id into condo;
  insert into public.condominiums(organization_id,name) values (org,'QA B') returning id into condo_b;
  insert into public.invitations(condominium_id,created_by_id,email,token,role,unit,block,expires_at)
    values (condo,uid,a::text || '@example.invalid',tok,'resident','101','A',now()+interval '1 day');
  result := public.accept_invitation(tok,other_uid,b::text || '@example.invalid');
  if result->>'code' <> 'EMAIL_MISMATCH' then raise exception 'email mismatch test failed'; end if;
  result := public.accept_invitation(tok,uid,b::text || '@example.invalid');
  if result->>'code' <> 'EMAIL_MISMATCH' then raise exception 'identity spoof test failed'; end if;
  first_result := public.accept_invitation(tok,uid,a::text || '@example.invalid');
  if first_result->>'ok' <> 'true' then raise exception 'first acceptance failed: %', first_result; end if;
  result := public.accept_invitation(tok,uid,a::text || '@example.invalid');
  if result->>'ok' <> 'true' or result->>'membershipId' <> first_result->>'membershipId' then raise exception 'idempotency failed'; end if;
  insert into public.invitations(condominium_id,created_by_id,email,token,role,unit,block,expires_at)
    values (condo,uid,a::text || '@example.invalid',staff_tok,'staff','101','A',now()+interval '1 day');
  result := public.accept_invitation(staff_tok,uid,a::text || '@example.invalid');
  if result->>'ok' <> 'true' then raise exception 'second role failed'; end if;
  select count(*) into n from public.memberships where user_id=uid and condominium_id=condo;
  if n <> 2 then raise exception 'roles were overwritten'; end if;
  tok := 'qa_' || replace(gen_random_uuid()::text, '-', '');
  insert into public.invitations(condominium_id,created_by_id,email,token,role,unit,expires_at)
    values (condo_b,uid,a::text || '@example.invalid',tok,'resident','201',now()+interval '1 day');
  result := public.accept_invitation(tok,uid,a::text || '@example.invalid');
  if result->>'ok' <> 'true' or (result->>'condominiumId')::bigint <> condo_b then raise exception 'second condominium failed'; end if;
  select count(*) into n from public.app_users where auth_user_id=a;
  if n <> 1 then raise exception 'identity duplicated'; end if;
  tok := 'qa_' || replace(gen_random_uuid()::text, '-', '');
  insert into public.invitations(condominium_id,created_by_id,email,token,role,expires_at)
    values (condo,uid,a::text || '@example.invalid',tok,'manager',now()-interval '1 day');
  result := public.accept_invitation(tok,uid,a::text || '@example.invalid');
  if result->>'code' <> 'EXPIRED' then raise exception 'expiry failed'; end if;
  update public.invitations set status='revoked',expires_at=now()+interval '1 day' where token=tok;
  result := public.accept_invitation(tok,uid,a::text || '@example.invalid');
  if result->>'code' <> 'UNAVAILABLE' then raise exception 'revocation failed'; end if;
  update public.condominiums set status='inactive' where id=condo_b;
  result := public.accept_invitation(staff_tok,uid,a::text || '@example.invalid');
  if result->>'ok' <> 'true' then raise exception 'other condominium state leaked'; end if;
  if has_function_privilege('anon','public.accept_invitation(text,bigint,text)','execute') or has_function_privilege('authenticated','public.accept_invitation(text,bigint,text)','execute') then raise exception 'RPC exposed'; end if;
end;
$$;
rollback;
select 'PASS: identity, email mismatch, idempotency, multiple roles, multiple condominiums, expiry, revocation, RPC grants; synthetic records rolled back' as result;

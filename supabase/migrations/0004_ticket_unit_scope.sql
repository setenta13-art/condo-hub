-- Add unit scope to tickets for shared unit-level visibility.
alter table public.tickets
  add column if not exists block varchar(40),
  add column if not exists unit varchar(40);

create index if not exists tickets_condominium_unit_idx
  on public.tickets(condominium_id, block, unit);

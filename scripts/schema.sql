-- ============================================================
-- Vértice Finanças — Schema Supabase
-- Execute no SQL Editor do Supabase (menu esquerdo > SQL Editor)
-- ============================================================

-- Pessoas cadastradas pelo usuário
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  color text not null,
  created_at timestamptz default now()
);

-- Categorias customizadas
create table if not exists custom_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('income','expense')),
  color text not null,
  created_at timestamptz default now()
);

-- Lançamentos (pix + cartão na mesma tabela, diferenciados pelo campo source)
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  source text not null check (source in ('pix','credit')),
  date date not null,
  date_only_month boolean default false,
  description text not null,
  amount numeric(12,2) not null,
  category text not null,
  is_fixed boolean default false,
  installment_group uuid,
  installment_num int,
  installment_total int,
  created_at timestamptz default now()
);

-- Relação N:N entre transações e pessoas
create table if not exists transaction_people (
  transaction_id uuid references transactions(id) on delete cascade,
  person_id uuid references people(id) on delete cascade,
  primary key (transaction_id, person_id)
);

-- Preferências do usuário (estado dos cards colapsados, orçamentos, acertos)
create table if not exists user_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  collapsed_cards jsonb default '{}'::jsonb,
  budgets jsonb default '{}'::jsonb,
  settlements jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- ── RLS (Row Level Security) ──────────────────────────────────────────────────
alter table people enable row level security;
alter table custom_categories enable row level security;
alter table transactions enable row level security;
alter table transaction_people enable row level security;
alter table user_prefs enable row level security;

-- Cada usuário só lê/escreve o que é seu
create policy "people_own" on people
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "cats_own" on custom_categories
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "txns_own" on transactions
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- transaction_people: acesso via JOIN com transactions
create policy "txn_people_own" on transaction_people
  for all using (
    exists (
      select 1 from transactions
      where id = transaction_id
        and user_id = auth.uid()
    )
  );

create policy "prefs_own" on user_prefs
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Índices ────────────────────────────────────────────────────────────────────
create index if not exists idx_txns_user_date
  on transactions(user_id, date desc);

create index if not exists idx_txns_installment_group
  on transactions(installment_group)
  where installment_group is not null;

create index if not exists idx_people_user
  on people(user_id);

create index if not exists idx_cats_user
  on custom_categories(user_id);

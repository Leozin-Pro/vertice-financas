-- ============================================================
-- Migração — Orçamento por categoria + Acerto de contas
-- Execute no SQL Editor do Supabase (menu esquerdo > SQL Editor)
-- Seguro rodar mais de uma vez (if not exists).
-- ============================================================

-- Tetos de gasto mensal por categoria: { "Alimentação - Mercado": 800, ... }
alter table user_prefs
  add column if not exists budgets jsonb default '{}'::jsonb;

-- Acertos por mês/pessoa: { "2026-06|<person_uuid>": "2026-06-10", ... }
alter table user_prefs
  add column if not exists settlements jsonb default '{}'::jsonb;

import { supabase } from './supabase.js';
import { showToast } from '../ui/components/toast.js';

// Cached current user id — needed to satisfy RLS (auth.uid() = user_id) on inserts.
let _cachedUserId = null;
async function userId() {
  if (_cachedUserId) return _cachedUserId;
  const { data: { user } } = await supabase.auth.getUser();
  _cachedUserId = user?.id || null;
  return _cachedUserId;
}

// ── LOAD ALL ─────────────────────────────────────────────────────────────────

export async function loadAll() {
  const [txnRes, peopleRes, catsRes, prefsRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, transaction_people(person_id)')
      .order('date', { ascending: false }),
    supabase.from('people').select('*').order('created_at'),
    supabase.from('custom_categories').select('*').order('created_at'),
    supabase.from('user_prefs').select('collapsed_cards').maybeSingle(),
  ]);

  for (const res of [txnRes, peopleRes, catsRes]) {
    if (res.error) throw res.error;
  }

  // Reconstruct transactions with people array (compatible with legacy STATE shape)
  const rawTxns = txnRes.data || [];
  const pix = [];
  const credit = [];

  for (const row of rawTxns) {
    const t = {
      id: row.id,
      date: row.date,
      dateOnlyMonth: row.date_only_month,
      desc: row.description,
      amount: Number(row.amount),
      category: row.category,
      isFixed: row.is_fixed,
      installmentGroup: row.installment_group || null,
      installmentNum: row.installment_num || null,
      installmentTotal: row.installment_total || null,
      people: (row.transaction_people || []).map(r => r.person_id),
    };
    if (row.source === 'pix') pix.push(t);
    else credit.push(t);
  }

  return {
    pix,
    credit,
    people: peopleRes.data || [],
    customCategories: catsRes.data
      ? catsRes.data.map(c => ({ id: c.id, name: c.name, type: c.type, color: c.color }))
      : [],
    collapsedCards: prefsRes.data?.collapsed_cards || {},
  };
}

// ── TRANSACTIONS ──────────────────────────────────────────────────────────────

export async function insertTransactions(txns, source) {
  const uid = await userId();
  const rows = txns.map(t => ({
    id: t.id,
    user_id: uid,
    source,
    date: t.date,
    date_only_month: t.dateOnlyMonth,
    description: t.desc,
    amount: t.amount,
    category: t.category,
    is_fixed: t.isFixed,
    installment_group: t.installmentGroup || null,
    installment_num: t.installmentNum || null,
    installment_total: t.installmentTotal || null,
  }));

  const { data, error } = await supabase.from('transactions').insert(rows).select('id');
  if (error) { showToast('Erro ao salvar lançamentos: ' + error.message, 'error'); throw error; }

  // Insert people joins
  const joins = [];
  for (const t of txns) {
    for (const pid of (t.people || [])) {
      joins.push({ transaction_id: t.id, person_id: pid });
    }
  }
  if (joins.length > 0) {
    const { error: je } = await supabase.from('transaction_people').insert(joins);
    if (je) { showToast('Erro ao salvar pessoas: ' + je.message, 'error'); }
  }

  return data;
}

export async function updateTransaction(t, source) {
  const { error } = await supabase
    .from('transactions')
    .update({
      source,
      date: t.date,
      date_only_month: t.dateOnlyMonth,
      description: t.desc,
      amount: t.amount,
      category: t.category,
      is_fixed: t.isFixed,
      installment_group: t.installmentGroup || null,
      installment_num: t.installmentNum || null,
      installment_total: t.installmentTotal || null,
    })
    .eq('id', t.id);
  if (error) { showToast('Erro ao atualizar: ' + error.message, 'error'); return; }

  // Replace people joins
  await supabase.from('transaction_people').delete().eq('transaction_id', t.id);
  const joins = (t.people || []).map(pid => ({ transaction_id: t.id, person_id: pid }));
  if (joins.length > 0) await supabase.from('transaction_people').insert(joins);
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) showToast('Erro ao excluir: ' + error.message, 'error');
}

export async function deleteTransactionGroup(installmentGroup) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('installment_group', installmentGroup);
  if (error) showToast('Erro ao excluir grupo: ' + error.message, 'error');
}

export async function deleteAllTransactions() {
  const { error } = await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) showToast('Erro ao apagar tudo: ' + error.message, 'error');
}

// ── PEOPLE ────────────────────────────────────────────────────────────────────

export async function upsertPerson(p) {
  const uid = await userId();
  const { error } = await supabase.from('people').upsert({
    id: p.id,
    user_id: uid,
    name: p.name,
    color: p.color,
  });
  if (error) showToast('Erro ao salvar pessoa: ' + error.message, 'error');
}

export async function deletePerson(id) {
  const { error } = await supabase.from('people').delete().eq('id', id);
  if (error) showToast('Erro ao excluir pessoa: ' + error.message, 'error');
}

export async function deleteAllPeople() {
  const { error } = await supabase.from('people').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) showToast('Erro ao apagar pessoas: ' + error.message, 'error');
}

// ── CATEGORIES ────────────────────────────────────────────────────────────────

export async function upsertCategory(c) {
  const uid = await userId();
  const { error } = await supabase.from('custom_categories').upsert({
    id: c.id,
    user_id: uid,
    name: c.name,
    type: c.type,
    color: c.color,
  });
  if (error) showToast('Erro ao salvar categoria: ' + error.message, 'error');
}

export async function deleteCategory(id) {
  const { error } = await supabase.from('custom_categories').delete().eq('id', id);
  if (error) showToast('Erro ao excluir categoria: ' + error.message, 'error');
}

export async function deleteAllCategories() {
  const { error } = await supabase.from('custom_categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (error) showToast('Erro ao apagar categorias: ' + error.message, 'error');
}

// ── PREFS ─────────────────────────────────────────────────────────────────────

export async function savePrefs(collapsedCards) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('user_prefs').upsert({
    user_id: user.id,
    collapsed_cards: collapsedCards,
    updated_at: new Date().toISOString(),
  });
}

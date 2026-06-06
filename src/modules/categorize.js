import { STATE } from './state.js';

export const RULES = [
  ['Assinaturas', ['netflix','spotify','amazon prime','disney','hbo','globoplay','youtube premium','deezer','apple.com/bill','icloud','google one','adobe','microsoft','office 365','dropbox','notion','chatgpt','openai','anthropic','claude.ai','crunchyroll','paramount','star plus','tidal','duolingo','linkedin premium','gympass','totalpass']],
  ['Alimentação - Delivery', ['ifood','rappi','uber eats','99food','aiqfome','james delivery']],
  ['Alimentação - Mercado', ['supermerc','mercado','atacad','assai','carrefour','pao de acucar','extra','big ','dia ','sams club','hortifruti','sacolao','st marche','zona sul','prezunic','bistek','angeloni','condor','americanas saude','americana saude','pague menos']],
  ['Alimentação - Restaurante', ['restaurante','lanchonete','padaria','pizzaria','hamburg','sushi','churrasc','cafeteria','cafe ','starbucks','burger','mcdonald','bk ','subway','outback','giraffas','habibs','spoleto','china in box']],
  ['Transporte - App', ['uber','99 ','99app','99pop','indrive','cabify','blablacar']],
  ['Transporte - Combustível', ['posto','combust','shell','petrobras','ipiranga','ale ','gasolina','etanol','alcool']],
  ['Transporte - Público', ['metro','onibus','bilhete unico','riocard','sptrans','vlt','trem','barca']],
  ['Transporte - Outros', ['estacionamento','zona azul','pedagio','autopass','sem parar','conectcar']],
  ['Saúde', ['farmacia','drogaria','droga','panvel','pacheco','raia','drogasil','venancio','hospital','clinica','laboratorio','exame','medico','dentista','psicolog','unimed','amil','bradesco saude','sulamerica','hapvida','plano de saude','credpago','saude','saúde']],
  ['Educação', ['escola','colegio','universidade','faculdade','curso','udemy','coursera','alura','rocketseat','livro','livraria','saraiva','cultura','amazon kindle']],
  ['Lazer', ['cinema','ingresso','sympla','show','teatro','parque','steam','playstation','xbox','nintendo','riot','blizzard','games','bar ','pub ','boteco','cerveja']],
  ['Vestuário', ['zara','renner','c&a','riachuelo','marisa','shein','nike','adidas','centauro','netshoes','dafiti','amaro','farm','animale','calcado','sapato','roupa']],
  ['Casa - Aluguel/Condomínio', ['aluguel','condominio','imobiliaria']],
  ['Casa - Utilidades', ['energia','luz ','enel','cpfl','light','cemig','copel','elektro','copasa','sabesp','cedae','agua','gas ','comgas','net ','vivo','claro','tim','oi ','algar','sky','internet','telefon']],
  ['Casa - Manutenção/Móveis', ['leroy','telhanorte','c&c','tok stok','etna','mobly','madeira madeira','obramax','casas bahia','magazine luiza','magalu','americanas','submarino','geladeira','fogao','sofa']],
  ['Beleza/Cuidados', ['cabeleireiro','salao','manicure','barbearia','spa ','massagem','academia','smart fit','bodytech','bio ritmo','o boticario','natura','sephora','perfumaria','ballet','dança','danca']],
  ['Pet', ['petz','cobasi','petlove','petshop','veterin','racao']],
  ['Salário', ['salario','provento','folha pagamento','holerite']],
  ['Renda Extra', ['freelance','servico prestado','autonomo','comissao','bonus']],
  ['Investimentos - Rendimentos', ['rendimento','dividendo','jcp','juros sobre capital','resgate']],
  ['Investimentos - Aplicação', ['cdb','tesouro','renda fixa','xp invest','rico ','inter invest','nuinvest','clear','btg','aplicacao']],
  ['Saques/Tarifas', ['saque','tarifa','iof','juros','anuidade','manuten','encargos','multa']],
  ['Doações/Caridade', ['doacao','igreja','ong ']],
];

export function getAllCategories(isIncome) {
  const base = isIncome
    ? ['Salário','Renda Extra','Investimentos - Rendimentos','Transferência Recebida','Outras Entradas']
    : Array.from(new Set(
        RULES.map(r => r[0])
          .filter(c => !['Salário','Renda Extra','Investimentos - Rendimentos'].includes(c))
          .concat(['Outros'])
      ));
  const custom = (STATE.customCategories || [])
    .filter(c => c.type === (isIncome ? 'income' : 'expense'))
    .map(c => c.name);
  return [...base, ...custom];
}

export function categoryColor(name) {
  const custom = (STATE.customCategories || []).find(c => c.name === name);
  return custom ? custom.color : null;
}

export function categorize(desc, isIncome) {
  const d = (desc || '').toLowerCase();
  if (isIncome) {
    if (/salario|provento|folha pagamento|holerite/.test(d)) return 'Salário';
    if (/freelance|servico prestado|autonomo|comissao|bonus/.test(d)) return 'Renda Extra';
    if (/rendimento|dividendo|jcp|juros sobre capital|resgate/.test(d)) return 'Investimentos - Rendimentos';
    if (/pix recebido|recebido|credito|transferencia recebida|ted recebido|doc recebido/.test(d)) return 'Transferência Recebida';
    return 'Outras Entradas';
  }
  for (const [cat, kws] of RULES) {
    if (['Salário','Renda Extra','Investimentos - Rendimentos'].includes(cat)) continue;
    for (const k of kws) { if (d.includes(k)) return cat; }
  }
  return 'Outros';
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vfiuhmdcgstlebcntzdv.supabase.co';
const supabaseKey = 'sb_publishable_s5qta6N9VOAYcoMXyfKmhw__EC9jD2H';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Querying public.criar_ordem_producao via RPC...');
  const { data, error } = await supabase.rpc('criar_ordem_producao', {
    p_pedidos_ids: [],
    p_observacoes: null,
    p_criado_por: null
  });
  console.log('Result:', { data, error });
}

check();

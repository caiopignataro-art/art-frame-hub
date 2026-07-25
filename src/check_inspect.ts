import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vfiuhmdcgstlebcntzdv.supabase.co';
const supabaseKey = 'sb_publishable_s5qta6N9VOAYcoMXyfKmhw__EC9jD2H';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Querying public.ordens_producao_itens...');
  const { data, error } = await supabase.from('ordens_producao_itens').select('*').limit(1);
  console.log('Result:', { data, error });
}

check();

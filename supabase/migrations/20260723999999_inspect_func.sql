CREATE TABLE public.inspect_func_result AS
SELECT proname, proargnames, proargtypes::text[], pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = pronamespace
WHERE nspname = 'public' AND proname LIKE '%criar_ordem_producao%';

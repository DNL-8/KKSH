-- Webhook Outbox dashboard queries (Postgres)
-- Uso:
--   docker compose exec db psql -U postgres -d study_leveling -f /dev/stdin < backend/scripts/sql/webhook_outbox_dashboard.sql

-- 1) Queue depth por status
select status, count(*) as total
from webhook_outbox
group by status
order by status;

-- 2) Itens prontos para processamento agora
select count(*) as ready_now
from webhook_outbox
where status in ('pending', 'retry')
  and next_attempt_at <= now();

-- 3) Locks expirados (podem indicar worker travado/restart)
select count(*) as expired_processing_locks
from webhook_outbox
where status = 'processing'
  and locked_until < now();

-- 4) Dead-letter recentes (ultimas 24h)
select
  count(*) as dead_last_24h
from webhook_outbox
where status = 'dead'
  and dead_at >= now() - interval '24 hours';

-- 5) Top eventos em dead-letter (ultimas 24h)
select
  event,
  count(*) as total_dead
from webhook_outbox
where status = 'dead'
  and dead_at >= now() - interval '24 hours'
group by event
order by total_dead desc
limit 20;

-- 6) Ultimos 20 dead-letter com detalhe
select
  id,
  webhook_id,
  event,
  attempt_count,
  last_status_code,
  left(coalesce(last_error, ''), 120) as last_error_short,
  dead_at
from webhook_outbox
where status = 'dead'
order by dead_at desc nulls last, updated_at desc
limit 20;

-- 7) Throughput de sent por minuto (ultimos 30 minutos)
select
  date_trunc('minute', delivered_at) as minute_bucket,
  count(*) as sent_count
from webhook_outbox
where status = 'sent'
  and delivered_at >= now() - interval '30 minutes'
group by minute_bucket
order by minute_bucket asc;

-- 8) Latencia de fila ate entrega (mediana/p95) ultimas 24h
select
  percentile_cont(0.50) within group (
    order by extract(epoch from (delivered_at - created_at))
  ) as p50_seconds,
  percentile_cont(0.95) within group (
    order by extract(epoch from (delivered_at - created_at))
  ) as p95_seconds
from webhook_outbox
where status = 'sent'
  and delivered_at is not null
  and created_at is not null
  and delivered_at >= now() - interval '24 hours';

-- 9) Taxa de retries por evento (ultimas 24h)
select
  event,
  sum(case when status = 'retry' then 1 else 0 end) as currently_retrying,
  sum(case when attempt_count > 0 then 1 else 0 end) as ever_retried
from webhook_outbox
where created_at >= now() - interval '24 hours'
group by event
order by ever_retried desc, currently_retrying desc;

-- 10) Itens com maior numero de tentativas ainda nao entregues
select
  id,
  webhook_id,
  event,
  status,
  attempt_count,
  next_attempt_at,
  updated_at
from webhook_outbox
where status in ('pending', 'processing', 'retry', 'dead')
order by attempt_count desc, updated_at desc
limit 20;

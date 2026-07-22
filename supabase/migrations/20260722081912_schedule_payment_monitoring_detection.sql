-- Phase 2 scheduled payment monitoring.
-- The Cron job invokes the observation-only Phase 1 detector inside Postgres.

create extension if not exists pg_cron;

create function public.run_payment_monitoring_cycle(
  p_observed_at timestamp with time zone default now()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_observed_at timestamp with time zone := p_observed_at;
  v_detected_count integer;
begin
  if v_observed_at is null then
    raise exception using
      errcode = '22023',
      message = 'Observation time is required.';
  end if;

  if not pg_catalog.pg_try_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'smart-business-profile:payment-monitoring-cycle',
      0::bigint
    )
  ) then
    return jsonb_build_object(
      'observed_at', v_observed_at,
      'outcome', 'skipped',
      'skipped', true,
      'incident_candidates_detected', 0
    );
  end if;

  -- The detector receives one stable timestamp for the complete cycle. Any
  -- detector error propagates so Cron records a failed run and the transaction
  -- rolls back its incident writes.
  v_detected_count := public.detect_payment_monitoring_incidents(v_observed_at);

  return jsonb_build_object(
    'observed_at', v_observed_at,
    'outcome', 'completed',
    'skipped', false,
    'incident_candidates_detected', v_detected_count
  );
end;
$$;

revoke all on function public.run_payment_monitoring_cycle(timestamp with time zone)
  from public, anon, authenticated;
grant execute on function public.run_payment_monitoring_cycle(timestamp with time zone)
  to service_role, postgres;

do $$
begin
  -- pg_cron uses the case-sensitive job name as its stable operational key;
  -- scheduling the same name updates rather than duplicates that job.
  perform cron.schedule(
    'payment-monitoring-detection',
    '*/5 * * * *',
    'select public.run_payment_monitoring_cycle();'
  );
end;
$$;

notify pgrst, 'reload schema';

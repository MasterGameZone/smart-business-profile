-- Adds the supporting index for the subscription webhook event owner foreign key.

create index subscription_webhook_events_owner_id_idx
on public.subscription_webhook_events (owner_id);

notify pgrst, 'reload schema';

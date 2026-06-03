-- 033: Retire the Kit (ConvertKit) sync now that MailerLite is verified.
--
-- The Supabase -> MailerLite sync (migration 032) was confirmed end-to-end
-- on 2026-06-02: a real anon-path signup synced into the "Thresan Launch
-- List" group with signup_source + interests fields. So we stop syncing new
-- signups to Kit to avoid double-sending. Existing Kit subscribers stay in
-- Kit (the real list is in Supabase); this only stops NEW writes.
--
-- Reversible: re-create trg_sync_waitlist_to_kit / re-schedule the cron from
-- migrations 028-030 if ever needed. The kit_api_key Vault secret is left in
-- place (harmless) in case of rollback.

-- 1) Stop syncing new signups to Kit (the insert trigger).
drop trigger if exists trg_sync_waitlist_to_kit on public.thresan_waitlist;

-- 2) Stop the 2-minute Kit auto-tagging sweep.
select cron.unschedule('kit-tag-sync');

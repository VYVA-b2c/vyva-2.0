-- The event trigger helper runs with elevated privileges and is only invoked by
-- PostgreSQL itself. Application-facing roles must never be able to call it.
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

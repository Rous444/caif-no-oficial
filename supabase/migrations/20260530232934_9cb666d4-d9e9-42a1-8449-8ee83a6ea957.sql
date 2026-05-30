ALTER FUNCTION public.prevent_appointment_overlap() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_appointment_overlap() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

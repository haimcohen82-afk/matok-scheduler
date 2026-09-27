-- Manager-only, on-demand inspection of all machine-extracted text.
-- No table access or candidate text is granted to anonymous users.
create or replace function public.admin_get_onboarding_text(p_record_id uuid)
returns text language plpgsql stable security definer set search_path=public,pg_temp
as $f$
declare v_text text;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  select extracted_text into v_text from public.staff_onboarding_records where id=p_record_id;
  if not found then raise exception 'onboarding_record_not_found'; end if;
  return coalesce(v_text,'');
end $f$;
revoke execute on function public.admin_get_onboarding_text(uuid) from public,anon,authenticated;
grant execute on function public.admin_get_onboarding_text(uuid) to authenticated;

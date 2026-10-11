create or replace function public.admin_hr_link_onboarding_record(
  p_case_id uuid,p_record_id uuid
) returns boolean
language plpgsql security definer set search_path=public,pg_temp
as $f$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.staff_onboarding_records where id=p_record_id)
    then raise exception 'onboarding_record_not_found'; end if;
  update public.hr_candidate_cases
    set onboarding_record_id=p_record_id,status='intake_received',updated_at=now()
    where id=p_case_id;
  if not found then raise exception 'case_not_found'; end if;
  return true;
end $f$;
revoke execute on function public.admin_hr_link_onboarding_record(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_hr_link_onboarding_record(uuid,uuid) to authenticated;

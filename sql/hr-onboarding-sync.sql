-- Keep HR candidate cases synchronized when the existing onboarding flow
-- approves or links a staff onboarding record.
create or replace function public.sync_hr_case_from_onboarding()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $f$
begin
  if new.staff_id is not null then
    update public.hr_candidate_cases
      set staff_id=new.staff_id,status='hired',updated_at=now()
      where onboarding_record_id=new.id;
  elsif new.review_status='approved' then
    update public.hr_candidate_cases
      set status='ready',updated_at=now()
      where onboarding_record_id=new.id and status<>'hired';
  end if;
  return new;
end $f$;

drop trigger if exists trg_sync_hr_case_from_onboarding on public.staff_onboarding_records;
create trigger trg_sync_hr_case_from_onboarding
after update of staff_id,review_status on public.staff_onboarding_records
for each row execute function public.sync_hr_case_from_onboarding();

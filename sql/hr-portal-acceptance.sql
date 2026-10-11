-- Rollback-style acceptance for the restored HR workflow.
-- Synthetic rows are explicitly deleted before completion.
do $test$
declare
  v_admin uuid;
  v_case uuid;
  v_fit uuid;
  v_intake uuid;
  v_onboarding uuid;
  v_detail jsonb;
  v_phone text:='05977'||lpad((floor(random()*100000))::int::text,5,'0');
begin
  select id into v_admin from public.profiles where role='admin' and is_active=true limit 1;
  if v_admin is null then raise exception 'no_active_admin'; end if;
  perform set_config('request.jwt.claim.sub',v_admin::text,true);

  v_case:=public.admin_hr_create_case('בדיקת פורטל למחיקה',v_phone,'qa@example.invalid');
  perform public.admin_hr_save_interview(v_case,
    '{"availability":"בוקר וערב","sales_experience":"כן","friday":"כן","notes":"QA"}'::jsonb,
    'continue',5);

  v_fit:=public.admin_hr_create_form_invite(v_case,'fit');
  if (public.hr_public_form_status(v_fit)->>'open')<>'true' then raise exception 'fit_not_open'; end if;
  perform public.hr_public_form_submit(v_fit,
    jsonb_build_object('full_name','בדיקת פורטל למחיקה','phone',v_phone,'consent',true,
      'experience','מכירות','social_media','Instagram','friday','כל שישי'));
  if (public.hr_public_form_status(v_fit)->>'open')<>'false' then raise exception 'fit_reuse_not_blocked'; end if;

  v_intake:=public.admin_hr_create_form_invite(v_case,'intake');
  perform public.hr_public_form_submit(v_intake,
    jsonb_build_object('full_name','בדיקת פורטל למחיקה','phone',v_phone,'consent',true,
      'city','חולון','address','דב הוז 1','preferred_role','מכירה','preferred_start','2026-10-20'));

  select onboarding_record_id into v_onboarding from public.hr_candidate_cases where id=v_case;
  if v_onboarding is null then raise exception 'onboarding_record_not_created'; end if;
  if not exists(select 1 from public.staff_onboarding_records where id=v_onboarding and details->>'city'='חולון')
    then raise exception 'onboarding_details_missing'; end if;

  v_detail:=public.admin_hr_get_case(v_case);
  if jsonb_array_length(v_detail->'responses')<>2 then raise exception 'response_count_wrong'; end if;
  if coalesce(v_detail->'interview'->>'decision','')<>'continue' then raise exception 'interview_missing'; end if;

  delete from public.hr_candidate_cases where id=v_case;
  delete from public.staff_onboarding_records where id=v_onboarding;

  if exists(select 1 from public.hr_candidate_cases where id=v_case) then raise exception 'case_cleanup_failed'; end if;
  if exists(select 1 from public.staff_onboarding_records where id=v_onboarding) then raise exception 'onboarding_cleanup_failed'; end if;
end $test$;

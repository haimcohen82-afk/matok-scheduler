-- MATOK onboarding nonpersistent security/logic verification.
-- Run as a single transaction (migration runner). Test records are deleted.
do $test$
declare
  v_admin uuid;
  v_token uuid;
  v_invite uuid;
  v_result jsonb;
  v_n integer;
begin
  if has_function_privilege('anon','public.admin_list_onboarding_records()','EXECUTE')
      or has_function_privilege('anon','public.admin_create_onboarding_invite()','EXECUTE')
      or has_function_privilege('anon','public.admin_approve_onboarding_new(uuid,text,text,text,text,text,jsonb)','EXECUTE')
  then raise exception 'private manager function erroneously accessible to anon'; end if;
  if not has_function_privilege('anon','public.onboarding_form_status(uuid)','EXECUTE')
      or not has_function_privilege('anon','public.onboarding_submit_form(uuid,jsonb)','EXECUTE')
  then raise exception 'anonymous single-use form functions are not accessible'; end if;
  if exists (select 1 from pg_class where relname in ('staff_onboarding_records','staff_onboarding_invites')
             and not relrowsecurity)
  then raise exception 'onboarding private table RLS disabled'; end if;

  -- Use an existing admin JWT claim inside this disposable transaction.
  select p.id into v_admin from public.profiles p
    where p.role='admin' and p.is_active=true limit 1;
  if v_admin is null then raise exception 'no active admin available for smoke test'; end if;
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  v_token:=public.admin_create_onboarding_invite();
  select id into v_invite from public.staff_onboarding_invites where token=v_token;
  if v_invite is null then raise exception 'invitation not created'; end if;
  v_result:=public.onboarding_form_status(v_token);
  if v_result->>'open'<>'true' then raise exception 'fresh invitation inaccessible'; end if;

  begin
    perform public.onboarding_submit_form(v_token,
      '{"full_name":"בדיקת מערכת","phone":"0501234567"}'::jsonb);
    raise exception 'missing consent unexpectedly accepted';
  exception when others then
    if sqlerrm<>'consent_required' then raise; end if;
  end;
  v_result:=public.onboarding_submit_form(v_token,
    '{"full_name":"בדיקת מערכת","phone":"0501234567","consent":true,"email":"qa@example.invalid"}'::jsonb);
  if v_result->>'submitted'<>'true' then raise exception 'valid form not saved'; end if;
  select count(*) into v_n from public.staff_onboarding_records r
    where r.invite_id=v_invite and r.details->>'full_name'='בדיקת מערכת';
  if v_n<>1 then raise exception 'wrong candidate intake count'; end if;
  if public.onboarding_form_status(v_token)->>'open'<>'false' then
    raise exception 'submitted token remains active'; end if;

  begin
    perform public.onboarding_submit_form(v_token,
      '{"full_name":"בדיקת מערכת","phone":"0501234567","consent":true}'::jsonb);
    raise exception 'reused token unexpectedly accepted';
  exception when others then
    if sqlerrm<>'invalid_or_expired_form' then raise; end if;
  end;

  -- No test applicant or token remains in production.
  delete from public.staff_onboarding_records where invite_id=v_invite;
  delete from public.staff_onboarding_invites where id=v_invite;
  if exists(select 1 from public.staff_onboarding_invites where id=v_invite) then
    raise exception 'test invitation cleanup failed'; end if;
end $test$;

-- Nonpersistent acceptance check for direct employee materialization.
-- All row mutations occur inside a PL/pgSQL exception subtransaction and are rolled back.
do $test$
declare
  v_admin uuid;
  v_record uuid;
  v_result jsonb;
  v_staff uuid;
  v_phone text:='0599007788';
  v_marker text:='MATOK QA DIRECT ROLLBACK';
  v_count integer;
begin
  select id into v_admin from public.profiles where role='admin' and is_active=true limit 1;
  if v_admin is null then raise exception 'no_active_admin'; end if;
  perform set_config('request.jwt.claim.sub',v_admin::text,true);

  begin
    insert into public.staff_onboarding_records(source,details,confidence,review_status)
    values(
      'uploaded_file',
      jsonb_build_object(
        'full_name',v_marker,'first_name','MATOK','last_name','QA',
        'identity_number','123456782','identity_valid',true,
        'phone',v_phone,'email','matok.qa@example.invalid','city','חולון',
        'address','בדיקה 1','preferred_role','מכירה',
        'preferred_start','21.10.2026','hourly_wage','35',
        'pos_employee_number','26000','weekly_rest_day','שבת'
      ),
      '{"full_name":"high","identity_number":"high","phone":"high","preferred_start":"high","hourly_wage":"high","pos_employee_number":"high"}'::jsonb,
      'pending'
    ) returning id into v_record;

    v_result:=public.admin_materialize_onboarding_employee(v_record);
    v_staff:=(v_result->>'staff_id')::uuid;
    if v_staff is null then raise exception 'staff_not_created'; end if;
    if not exists(select 1 from public.staff where id=v_staff and full_name=v_marker and is_active=true)
      then raise exception 'staff_core_not_created'; end if;
    if not exists(select 1 from public.staff_private_profiles where staff_id=v_staff
      and identity_number='123456782' and city='חולון' and pos_employee_number='26000')
      then raise exception 'private_profile_not_created'; end if;
    if not exists(select 1 from public.staff_payroll_profiles where staff_id=v_staff
      and hourly_rate=35 and employment_start=date '2026-10-21')
      then raise exception 'payroll_profile_not_created'; end if;
    raise exception '__MATOK_ROLLBACK_DIRECT_TEST__';
  exception when others then
    if sqlerrm<>'__MATOK_ROLLBACK_DIRECT_TEST__' then raise; end if;
  end;

  select count(*) into v_count from public.staff where full_name=v_marker or phone=v_phone;
  if v_count<>0 then raise exception 'rollback_failed_staff_residue'; end if;
  select count(*) into v_count from public.staff_onboarding_records where details->>'full_name'=v_marker;
  if v_count<>0 then raise exception 'rollback_failed_intake_residue'; end if;
end $test$;

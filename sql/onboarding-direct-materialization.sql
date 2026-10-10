-- MATOK SIDIR: direct employee materialization from a reviewed intake record.
-- Additive. Existing employee records are not modified by this migration.

alter table public.staff_private_profiles
  add column if not exists bank_details text,
  add column if not exists emergency_contact text,
  add column if not exists direct_manager text,
  add column if not exists employment_scope text,
  add column if not exists pos_employee_number text,
  add column if not exists hourly_wage numeric,
  add column if not exists payment_terms text,
  add column if not exists weekly_rest_day text,
  add column if not exists health_fund text;

create or replace function public.admin_upsert_staff_private_profile(p_staff_id uuid,p_details jsonb)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $f$
declare
  v_old public.staff_private_profiles%rowtype;
  v_identity text;
  v_valid boolean;
  v_rate numeric;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.staff where id=p_staff_id) then raise exception 'staff_not_found'; end if;
  if p_details is null or jsonb_typeof(p_details)<>'object' or length(p_details::text)>22000 then
    raise exception 'invalid_profile_details'; end if;

  select * into v_old from public.staff_private_profiles where staff_id=p_staff_id;
  v_identity:=regexp_replace(coalesce(p_details->>'identity_number',v_old.identity_number,''),'[^0-9A-Za-z]','','g');
  if v_identity='' then v_identity:=null; end if;
  v_valid:=case when p_details ? 'identity_valid' then (p_details->>'identity_valid')::boolean else v_old.identity_valid end;
  begin
    v_rate:=nullif(regexp_replace(coalesce(p_details->>'hourly_wage',''),'[^0-9.]','','g'),'')::numeric;
  exception when others then v_rate:=null;
  end;

  insert into public.staff_private_profiles(
    staff_id,first_name,last_name,identity_type,identity_number,identity_valid,
    email,city,address,birth_date,preferred_start,bank_details,emergency_contact,
    direct_manager,employment_scope,pos_employee_number,hourly_wage,payment_terms,
    weekly_rest_day,health_fund,source_details,updated_at,updated_by
  ) values(
    p_staff_id,
    coalesce(nullif(btrim(left(p_details->>'first_name',100)),''),v_old.first_name),
    coalesce(nullif(btrim(left(p_details->>'last_name',100)),''),v_old.last_name),
    coalesce(nullif(btrim(left(p_details->>'identity_type',40)),''),v_old.identity_type,'תעודת זהות'),
    coalesce(v_identity,v_old.identity_number),v_valid,
    coalesce(nullif(btrim(left(p_details->>'email',180)),''),v_old.email),
    coalesce(nullif(btrim(left(p_details->>'city',100)),''),v_old.city),
    coalesce(nullif(btrim(left(p_details->>'address',250)),''),v_old.address),
    coalesce(nullif(btrim(left(p_details->>'birth_date',50)),''),v_old.birth_date),
    coalesce(nullif(btrim(left(p_details->>'preferred_start',50)),''),v_old.preferred_start),
    coalesce(nullif(btrim(left(p_details->>'bank_details',350)),''),v_old.bank_details),
    coalesce(nullif(btrim(left(p_details->>'emergency_contact',350)),''),v_old.emergency_contact),
    coalesce(nullif(btrim(left(p_details->>'direct_manager',120)),''),v_old.direct_manager),
    coalesce(nullif(btrim(left(p_details->>'employment_scope',250)),''),v_old.employment_scope),
    coalesce(nullif(btrim(left(p_details->>'pos_employee_number',50)),''),v_old.pos_employee_number),
    coalesce(v_rate,v_old.hourly_wage),
    coalesce(nullif(btrim(left(p_details->>'payment_terms',250)),''),v_old.payment_terms),
    coalesce(nullif(btrim(left(p_details->>'weekly_rest_day',80)),''),v_old.weekly_rest_day),
    coalesce(nullif(btrim(left(p_details->>'health_fund',100)),''),v_old.health_fund),
    coalesce(v_old.source_details,'{}'::jsonb)||p_details,
    now(),auth.uid()
  )
  on conflict(staff_id) do update set
    first_name=excluded.first_name,last_name=excluded.last_name,
    identity_type=excluded.identity_type,identity_number=excluded.identity_number,
    identity_valid=excluded.identity_valid,email=excluded.email,city=excluded.city,
    address=excluded.address,birth_date=excluded.birth_date,preferred_start=excluded.preferred_start,
    bank_details=excluded.bank_details,emergency_contact=excluded.emergency_contact,
    direct_manager=excluded.direct_manager,employment_scope=excluded.employment_scope,
    pos_employee_number=excluded.pos_employee_number,hourly_wage=excluded.hourly_wage,
    payment_terms=excluded.payment_terms,weekly_rest_day=excluded.weekly_rest_day,
    health_fund=excluded.health_fund,
    source_details=public.staff_private_profiles.source_details||excluded.source_details,
    updated_at=now(),updated_by=auth.uid();
  return true;
end $f$;

create or replace function public.admin_get_staff_private_profile(p_staff_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path=public,pg_temp
as $f$
declare v_profile jsonb;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  select jsonb_build_object(
    'staff_id',p.staff_id,'first_name',p.first_name,'last_name',p.last_name,
    'identity_type',p.identity_type,'identity_number',p.identity_number,'identity_valid',p.identity_valid,
    'email',p.email,'city',p.city,'address',p.address,'birth_date',p.birth_date,
    'preferred_start',p.preferred_start,'bank_details',p.bank_details,
    'emergency_contact',p.emergency_contact,'direct_manager',p.direct_manager,
    'employment_scope',p.employment_scope,'pos_employee_number',p.pos_employee_number,
    'hourly_wage',p.hourly_wage,'payment_terms',p.payment_terms,
    'weekly_rest_day',p.weekly_rest_day,'health_fund',p.health_fund,
    'source_details',p.source_details,'updated_at',p.updated_at
  ) into v_profile
  from public.staff_private_profiles p where p.staff_id=p_staff_id;
  return coalesce(v_profile,'{}'::jsonb);
end $f$;

create or replace function public.admin_materialize_onboarding_employee(p_record_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $f$
declare
  v_row public.staff_onboarding_records%rowtype;
  v_details jsonb;
  v_name text;
  v_phone text;
  v_email text;
  v_user text;
  v_base text;
  v_pin text;
  v_rand bytea;
  v_role text;
  v_staff uuid;
  v_rate numeric:=0;
  v_start date;
  v_start_text text;
  v_friday text;
  v_settings jsonb;
  v_profile_details jsonb;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  select * into v_row from public.staff_onboarding_records where id=p_record_id for update;
  if not found or v_row.review_status<>'pending' then raise exception 'not_pending'; end if;
  v_details:=coalesce(v_row.details,'{}'::jsonb);
  if coalesce(v_details->>'identity_number','')<>'' and coalesce((v_details->>'identity_valid')::boolean,false)=false then
    raise exception 'identity_requires_review';
  end if;
  v_profile_details:=v_details;
  if coalesce(v_row.confidence->>'bank_details','low')<>'high' then
    v_profile_details:=v_profile_details-'bank_details';
  end if;
  v_name=btrim(coalesce(v_details->>'full_name',''));
  v_phone=btrim(coalesce(v_details->>'phone',''));
  if length(v_name)<2 or length(regexp_replace(v_phone,'[^0-9]','','g'))<9 then
    raise exception 'name_and_phone_required'; end if;
  if exists(select 1 from public.staff s where regexp_replace(s.phone,'[^0-9]','','g')=regexp_replace(v_phone,'[^0-9]','','g'))
    then raise exception 'phone_matches_existing_employee'; end if;

  v_email=lower(btrim(coalesce(v_details->>'email','')));
  v_base:=regexp_replace(split_part(v_email,'@',1),'[^a-z0-9._-]','','g');
  if length(v_base)<4 then v_base:='matok'||right(regexp_replace(v_phone,'[^0-9]','','g'),6); end if;
  v_base:=left(v_base,20);
  v_user:=v_base;
  while exists(select 1 from public.staff where lower(username)=lower(v_user)) loop
    v_user:=left(v_base,20)||'_'||substr(replace(gen_random_uuid()::text,'-',''),1,3);
  end loop;

  v_rand:=gen_random_bytes(2);
  v_pin:=lpad(((get_byte(v_rand,0)*256+get_byte(v_rand,1)) % 10000)::text,4,'0');

  v_role:=btrim(coalesce(v_details->>'preferred_role',''));
  if v_role ilike '%קופה%' then v_role:='קופה';
  elsif v_role ilike '%אחרא%' then v_role:='אחראית משמרת';
  else v_role:='מכירה';
  end if;

  v_friday:=btrim(coalesce(v_details->>'friday',''));
  v_settings:=jsonb_build_object(
    'morning',true,'evening',true,
    'friday',case when v_friday ilike '%לסירוג%' then 'alternate'
                  when v_friday ilike '%כל%' then 'every'
                  when v_friday ilike '%לא%' then 'none' else 'alternate' end,
    'notes',left(coalesce(v_details->>'notes','נקלט אוטומטית מקובץ קליטת עובד'),900)
  );

  v_staff:=public.admin_save_staff_v2(null,jsonb_build_object(
    'full_name',v_name,'phone',v_phone,'username',v_user,
    'role_name',v_role,'is_active',true,'settings',v_settings
  ),v_pin);

  perform public.admin_upsert_staff_private_profile(v_staff,v_profile_details);

  begin
    v_rate:=coalesce(nullif(regexp_replace(coalesce(v_details->>'hourly_wage',''),'[^0-9.]','','g'),'')::numeric,0);
  exception when others then v_rate:=0;
  end;
  v_start_text=replace(replace(btrim(coalesce(v_details->>'preferred_start','')),'/','.'),'-','.');
  begin
    if v_start_text ~ '^[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{4}$' then
      v_start:=to_date(v_start_text,'DD.MM.YYYY');
    elsif v_start_text ~ '^[0-9]{4}\.[0-9]{1,2}\.[0-9]{1,2}$' then
      v_start:=to_date(v_start_text,'YYYY.MM.DD');
    end if;
  exception when others then v_start:=null;
  end;
  perform public.admin_save_payroll_profile(v_staff,v_rate,v_start,
    'נקלט אוטומטית מקובץ קליטת עובד');

  update public.staff_onboarding_records
    set staff_id=v_staff,review_status='approved',reviewed_at=now(),reviewed_by=auth.uid()
    where id=p_record_id;

  return jsonb_build_object(
    'staff_id',v_staff,'full_name',v_name,'username',v_user,'pin',v_pin,
    'hourly_rate',v_rate,'employment_start',v_start,'created',true
  );
end $f$;

revoke execute on function public.admin_materialize_onboarding_employee(uuid) from public,anon,authenticated;
grant execute on function public.admin_materialize_onboarding_employee(uuid) to authenticated;

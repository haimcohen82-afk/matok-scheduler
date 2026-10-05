-- Structured employee import and manager-private staff profile.
-- Additive migration. Existing staff, schedules and onboarding rows remain unchanged.

create table if not exists public.staff_private_profiles (
  staff_id uuid primary key references public.staff(id) on delete cascade,
  first_name text,
  last_name text,
  identity_type text,
  identity_number text,
  identity_valid boolean,
  email text,
  city text,
  address text,
  birth_date text,
  preferred_start text,
  source_details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.staff_private_profiles enable row level security;
revoke all on public.staff_private_profiles from public,anon,authenticated;

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
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.staff where id=p_staff_id) then raise exception 'staff_not_found'; end if;
  if p_details is null or jsonb_typeof(p_details)<>'object' or length(p_details::text)>22000 then
    raise exception 'invalid_profile_details'; end if;

  select * into v_old from public.staff_private_profiles where staff_id=p_staff_id;
  v_identity:=regexp_replace(coalesce(p_details->>'identity_number',v_old.identity_number,''),'[^0-9A-Za-z]','','g');
  if v_identity='' then v_identity:=null; end if;
  v_valid:=case
    when p_details ? 'identity_valid' then (p_details->>'identity_valid')::boolean
    else v_old.identity_valid
  end;

  insert into public.staff_private_profiles(
    staff_id,first_name,last_name,identity_type,identity_number,identity_valid,
    email,city,address,birth_date,preferred_start,source_details,updated_at,updated_by
  ) values(
    p_staff_id,
    coalesce(nullif(btrim(left(p_details->>'first_name',100)),''),v_old.first_name),
    coalesce(nullif(btrim(left(p_details->>'last_name',100)),''),v_old.last_name),
    coalesce(nullif(btrim(left(p_details->>'identity_type',40)),''),v_old.identity_type,'תעודת זהות'),
    coalesce(v_identity,v_old.identity_number),
    v_valid,
    coalesce(nullif(btrim(left(p_details->>'email',180)),''),v_old.email),
    coalesce(nullif(btrim(left(p_details->>'city',100)),''),v_old.city),
    coalesce(nullif(btrim(left(p_details->>'address',250)),''),v_old.address),
    coalesce(nullif(btrim(left(p_details->>'birth_date',50)),''),v_old.birth_date),
    coalesce(nullif(btrim(left(p_details->>'preferred_start',50)),''),v_old.preferred_start),
    coalesce(v_old.source_details,'{}'::jsonb)||p_details,
    now(),auth.uid()
  )
  on conflict(staff_id) do update set
    first_name=excluded.first_name,last_name=excluded.last_name,
    identity_type=excluded.identity_type,identity_number=excluded.identity_number,
    identity_valid=excluded.identity_valid,email=excluded.email,city=excluded.city,
    address=excluded.address,birth_date=excluded.birth_date,
    preferred_start=excluded.preferred_start,
    source_details=public.staff_private_profiles.source_details||excluded.source_details,
    updated_at=now(),updated_by=auth.uid();
  return true;
end $f$;

create or replace function public.admin_get_staff_private_profile(p_staff_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $f$
declare v_profile jsonb;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  select jsonb_build_object(
    'staff_id',p.staff_id,'first_name',p.first_name,'last_name',p.last_name,
    'identity_type',p.identity_type,'identity_number',p.identity_number,
    'identity_valid',p.identity_valid,'email',p.email,'city',p.city,
    'address',p.address,'birth_date',p.birth_date,'preferred_start',p.preferred_start,
    'source_details',p.source_details,'updated_at',p.updated_at
  ) into v_profile
  from public.staff_private_profiles p where p.staff_id=p_staff_id;
  return coalesce(v_profile,'{}'::jsonb);
end $f$;

create or replace function public.admin_import_onboarding_batch(
  p_rows jsonb,p_text text,p_path text,p_filename text)
returns uuid[]
language plpgsql
security definer
set search_path=public,pg_temp
as $f$
declare
  v_entry jsonb;
  v_details jsonb;
  v_confidence jsonb;
  v_ids uuid[]:='{}'::uuid[];
  v_id uuid;
  v_count integer;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'invalid_batch_rows'; end if;
  v_count:=jsonb_array_length(p_rows);
  if v_count<1 or v_count>200 then raise exception 'batch_row_limit'; end if;
  if length(coalesce(p_text,''))>120000 or length(coalesce(p_filename,''))>220
     or length(coalesce(p_path,''))>300 then raise exception 'onboarding_file_too_large'; end if;
  if p_path is null or p_path='' or not exists(
     select 1 from storage.objects where bucket_id='staff-onboarding-originals' and name=p_path)
     then raise exception 'original_document_missing'; end if;

  for v_entry in select value from jsonb_array_elements(p_rows)
  loop
    v_details:=coalesce(v_entry->'details','{}'::jsonb);
    v_confidence:=coalesce(v_entry->'confidence','{}'::jsonb);
    if jsonb_typeof(v_details)<>'object' or jsonb_typeof(v_confidence)<>'object'
       or length(v_details::text)>22000 then raise exception 'invalid_batch_row'; end if;
    if coalesce(btrim(v_details->>'full_name'),'')=''
       and coalesce(btrim(v_details->>'identity_number'),'')=''
       and coalesce(btrim(v_details->>'phone'),'')=''
       then continue; end if;

    insert into public.staff_onboarding_records(
      source,details,confidence,extracted_text,original_path,original_name)
    values('uploaded_file',v_details,v_confidence,coalesce(p_text,''),p_path,p_filename)
    returning id into v_id;
    v_ids:=array_append(v_ids,v_id);
  end loop;
  if coalesce(array_length(v_ids,1),0)=0 then raise exception 'no_employee_rows_found'; end if;
  return v_ids;
end $f$;

-- Approval persists the structured private profile automatically.
create or replace function public.admin_approve_onboarding_new(
 p_record_id uuid,p_name text,p_phone text,p_username text,p_code text,
 p_role text,p_settings jsonb)
returns uuid
language plpgsql
security definer
set search_path=public,pg_temp
as $f$
declare
  v_row public.staff_onboarding_records%rowtype;
  v_staff uuid;
  v_payload jsonb;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  select * into v_row from public.staff_onboarding_records where id=p_record_id for update;
  if not found or v_row.review_status<>'pending' then raise exception 'not_pending'; end if;
  if exists(select 1 from public.staff where
      regexp_replace(phone,'[^0-9]','','g')=regexp_replace(p_phone,'[^0-9]','','g'))
    then raise exception 'phone_matches_existing_employee'; end if;
  v_payload=jsonb_build_object(
    'full_name',p_name,'phone',p_phone,'username',p_username,
    'role_name',coalesce(nullif(p_role,''),'מכירה'),'is_active',true,
    'settings',coalesce(p_settings,'{}'::jsonb)
  );
  v_staff:=public.admin_save_staff_v2(null,v_payload,p_code);
  perform public.admin_upsert_staff_private_profile(v_staff,v_row.details);
  update public.staff_onboarding_records
    set staff_id=v_staff,review_status='approved',reviewed_at=now(),reviewed_by=auth.uid()
    where id=p_record_id;
  return v_staff;
end $f$;

-- Existing employee linkage enriches the private manager profile without
-- overwriting roster, payroll, portal permissions or login credentials.
create or replace function public.admin_link_onboarding_existing(p_record_id uuid,p_staff_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $f$
declare v_details jsonb;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.staff where id=p_staff_id) then raise exception 'staff_not_found'; end if;
  select details into v_details from public.staff_onboarding_records
    where id=p_record_id and review_status='pending' for update;
  if not found then raise exception 'not_pending_or_not_found'; end if;
  perform public.admin_upsert_staff_private_profile(p_staff_id,v_details);
  update public.staff_onboarding_records
    set staff_id=p_staff_id,review_status='approved',reviewed_at=now(),reviewed_by=auth.uid()
    where id=p_record_id;
  return true;
end $f$;

revoke execute on function public.admin_upsert_staff_private_profile(uuid,jsonb) from public,anon,authenticated;
revoke execute on function public.admin_get_staff_private_profile(uuid) from public,anon,authenticated;
revoke execute on function public.admin_import_onboarding_batch(jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.admin_upsert_staff_private_profile(uuid,jsonb) to authenticated;
grant execute on function public.admin_get_staff_private_profile(uuid) to authenticated;
grant execute on function public.admin_import_onboarding_batch(jsonb,text,text,text) to authenticated;

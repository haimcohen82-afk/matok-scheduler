-- MATOK SIDIR onboarding: additive, private, admin-approved.
-- New objects only; existing staff records and payroll documents are untouched.
create table if not exists public.staff_onboarding_invites (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '7 days'),
  submitted_at timestamptz,
  constraint invite_valid_expiry check (expires_at > created_at)
);
create table if not exists public.staff_onboarding_records (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid unique references public.staff_onboarding_invites(id) on delete set null,
  source text not null check (source in ('questionnaire','uploaded_file')),
  details jsonb not null default '{}'::jsonb,
  confidence jsonb not null default '{}'::jsonb,
  extracted_text text not null default '',
  original_path text,
  original_name text,
  review_status text not null default 'pending' check (review_status in ('pending','approved')),
  staff_id uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);
create index if not exists staff_onboard_records_date on public.staff_onboarding_records(created_at desc);
create index if not exists staff_onboard_records_staff on public.staff_onboarding_records(staff_id);
alter table public.staff_onboarding_invites enable row level security;
alter table public.staff_onboarding_records enable row level security;
revoke all on public.staff_onboarding_invites, public.staff_onboarding_records from public, anon, authenticated;

-- Original files are manager-only. There are no public upload policies.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('staff-onboarding-originals','staff-onboarding-originals',false,12582912,
        array['application/pdf','image/jpeg','image/png','image/webp',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'text/plain','text/csv'])
on conflict(id) do nothing;

drop policy if exists matok_onboard_admin_read on storage.objects;
create policy matok_onboard_admin_read on storage.objects for select to authenticated
  using(bucket_id='staff-onboarding-originals' and public.is_admin());
drop policy if exists matok_onboard_admin_write on storage.objects;
create policy matok_onboard_admin_write on storage.objects for insert to authenticated
  with check(bucket_id='staff-onboarding-originals' and public.is_admin());
drop policy if exists matok_onboard_admin_delete on storage.objects;
create policy matok_onboard_admin_delete on storage.objects for delete to authenticated
  using(bucket_id='staff-onboarding-originals' and public.is_admin());

create or replace function public.admin_create_onboarding_invite()
returns uuid language plpgsql security definer set search_path=public,pg_temp
as $f$
declare v_token uuid;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  insert into public.staff_onboarding_invites default values returning token into v_token;
  return v_token;
end $f$;

-- No employee or invitation details are exposed in the unauthenticated response.
create or replace function public.onboarding_form_status(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp
as $f$
begin
  if exists(select 1 from public.staff_onboarding_invites
    where token=p_token and expires_at>now() and submitted_at is null)
  then return '{"open":true}'::jsonb; end if;
  return '{"open":false}'::jsonb;
end $f$;

-- Single-use token: atomic row lock prevents double submission.
-- Whitelist fields and bound lengths; never accept a candidate-supplied staff ID or login PIN.
create or replace function public.onboarding_submit_form(p_token uuid,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $f$
declare v_invite public.staff_onboarding_invites%rowtype; v_name text; v_phone text; v_details jsonb;
begin
  select * into v_invite from public.staff_onboarding_invites
  where token=p_token and expires_at>now() and submitted_at is null for update;
  if not found then raise exception 'invalid_or_expired_form'; end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' or length(p_data::text)>14000 then
    raise exception 'invalid_form_payload'; end if;
  v_name=btrim(left(coalesce(p_data->>'full_name',''),150));
  v_phone=regexp_replace(coalesce(p_data->>'phone',''),'[^0-9+]','','g');
  if length(v_name)<2 or length(v_phone)<9 or length(v_phone)>16 then
    raise exception 'name_and_phone_required'; end if;
  if p_data->>'consent'<>'true' then raise exception 'consent_required'; end if;
  v_details=jsonb_build_object(
    'full_name',v_name,'phone',v_phone,
    'email',left(coalesce(p_data->>'email',''),180),
    'city',left(coalesce(p_data->>'city',''),100),
    'address',left(coalesce(p_data->>'address',''),200),
    'preferred_role',left(coalesce(p_data->>'preferred_role',''),90),
    'available_shifts',left(coalesce(p_data->>'available_shifts',''),400),
    'friday',left(coalesce(p_data->>'friday',''),50),
    'preferred_start',left(coalesce(p_data->>'preferred_start',''),50),
    'experience',left(coalesce(p_data->>'experience',''),1500),
    'notes',left(coalesce(p_data->>'notes',''),1500)
  );
  insert into public.staff_onboarding_records(invite_id,source,details)
  values(v_invite.id,'questionnaire',v_details);
  update public.staff_onboarding_invites set submitted_at=now() where id=v_invite.id;
  return '{"submitted":true}'::jsonb;
end $f$;

-- Manager-only RPCs return full onboarding profiles; anonymous users cannot list candidates.
create or replace function public.admin_list_onboarding_records()
returns table(id uuid,source text,details jsonb,confidence jsonb,original_path text,
 original_name text,review_status text,staff_id uuid,created_at timestamptz,
 reviewed_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp
as $f$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  return query select r.id,r.source,r.details,r.confidence,r.original_path,
     r.original_name,r.review_status,r.staff_id,r.created_at,r.reviewed_at
    from public.staff_onboarding_records r order by r.created_at desc limit 500;
end $f$;

create or replace function public.admin_import_onboarding_file(
  p_details jsonb,p_confidence jsonb,p_text text,p_path text,p_filename text)
returns uuid language plpgsql security definer set search_path=public,pg_temp
as $f$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if length(coalesce(p_details::text,''))>22000 or length(coalesce(p_text,''))>120000
    or length(coalesce(p_filename,''))>220 or length(coalesce(p_path,''))>300
    then raise exception 'onboarding_file_too_large'; end if;
  if p_path is null or p_path='' or not exists(
    select 1 from storage.objects where bucket_id='staff-onboarding-originals' and name=p_path)
    then raise exception 'original_document_missing'; end if;
  insert into public.staff_onboarding_records(source,details,confidence,extracted_text,original_path,original_name)
  values('uploaded_file',coalesce(p_details,'{}'::jsonb),coalesce(p_confidence,'{}'::jsonb),
    coalesce(p_text,''),p_path,p_filename) returning id into v_id;
  return v_id;
end $f$;

create or replace function public.admin_update_onboarding_record(p_record_id uuid,p_details jsonb)
returns boolean language plpgsql security definer set search_path=public,pg_temp
as $f$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if jsonb_typeof(p_details)<>'object' or length(p_details::text)>22000 then
    raise exception 'invalid_onboarding_details'; end if;
  update public.staff_onboarding_records set details=p_details
    where id=p_record_id and review_status='pending';
  if not found then raise exception 'not_pending_or_not_found'; end if;
  return true;
end $f$;

-- Explicit manager approval atomically creates a staff account from reviewed data.
-- Credentials are passed directly to the existing hardened staff RPC and never stored in intake.
create or replace function public.admin_approve_onboarding_new(
 p_record_id uuid,p_name text,p_phone text,p_username text,p_code text,
 p_role text,p_settings jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp
as $f$
declare v_row public.staff_onboarding_records%rowtype; v_staff uuid; v_payload jsonb;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  select * into v_row from public.staff_onboarding_records where id=p_record_id for update;
  if not found or v_row.review_status<>'pending' then raise exception 'not_pending'; end if;
  if exists(select 1 from public.staff where
      regexp_replace(phone,'[^0-9]','','g')=regexp_replace(p_phone,'[^0-9]','','g'))
    then raise exception 'phone_matches_existing_employee'; end if;
  v_payload=jsonb_build_object('full_name',p_name,'phone',p_phone,
    'username',p_username,'role_name',coalesce(nullif(p_role,''),'מכירה'),
    'is_active',true,'settings',coalesce(p_settings,'{}'::jsonb));
  v_staff:=public.admin_save_staff_v2(null,v_payload,p_code);
  update public.staff_onboarding_records set staff_id=v_staff,review_status='approved',
    reviewed_at=now(),reviewed_by=auth.uid() where id=p_record_id;
  return v_staff;
end $f$;

-- Link imported information to an existing staff card without overwriting their payroll,
-- schedule, access rights, or identity details.
create or replace function public.admin_link_onboarding_existing(p_record_id uuid,p_staff_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp
as $f$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.staff where id=p_staff_id) then raise exception 'staff_not_found';end if;
  update public.staff_onboarding_records set staff_id=p_staff_id,review_status='approved',
    reviewed_at=now(),reviewed_by=auth.uid()
    where id=p_record_id and review_status='pending';
  if not found then raise exception 'not_pending_or_not_found'; end if;
  return true;
end $f$;

revoke execute on function public.admin_create_onboarding_invite() from public,anon,authenticated;
revoke execute on function public.onboarding_form_status(uuid) from public,anon,authenticated;
revoke execute on function public.onboarding_submit_form(uuid,jsonb) from public,anon,authenticated;
revoke execute on function public.admin_list_onboarding_records() from public,anon,authenticated;
revoke execute on function public.admin_import_onboarding_file(jsonb,jsonb,text,text,text) from public,anon,authenticated;
revoke execute on function public.admin_update_onboarding_record(uuid,jsonb) from public,anon,authenticated;
revoke execute on function public.admin_approve_onboarding_new(uuid,text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke execute on function public.admin_link_onboarding_existing(uuid,uuid) from public,anon,authenticated;
grant execute on function public.onboarding_form_status(uuid) to anon,authenticated;
grant execute on function public.onboarding_submit_form(uuid,jsonb) to anon,authenticated;
grant execute on function public.admin_create_onboarding_invite() to authenticated;
grant execute on function public.admin_list_onboarding_records() to authenticated;
grant execute on function public.admin_import_onboarding_file(jsonb,jsonb,text,text,text) to authenticated;
grant execute on function public.admin_update_onboarding_record(uuid,jsonb) to authenticated;
grant execute on function public.admin_approve_onboarding_new(uuid,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.admin_link_onboarding_existing(uuid,uuid) to authenticated;

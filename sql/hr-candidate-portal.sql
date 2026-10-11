-- SIDIR HR candidate/new-employee portal.
-- Additive only: existing staff, onboarding, payroll and schedule objects are untouched.

create table if not exists public.hr_candidate_cases (
  id uuid primary key default gen_random_uuid(),
  full_name text not null default '',
  phone text not null default '',
  email text not null default '',
  status text not null default 'new'
    check (status in ('new','interview','fit_sent','fit_received','intake_sent','intake_received','ready','hired','rejected')),
  staff_id uuid references public.staff(id) on delete set null,
  onboarding_record_id uuid references public.staff_onboarding_records(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.hr_candidate_interviews (
  case_id uuid primary key references public.hr_candidate_cases(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  decision text not null default 'pending'
    check (decision in ('pending','continue','hold','reject')),
  rating integer check (rating between 1 and 5),
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid()
);

create table if not exists public.hr_candidate_form_invites (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.hr_candidate_cases(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  form_type text not null check (form_type in ('fit','intake')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '7 days'),
  submitted_at timestamptz,
  created_by uuid default auth.uid()
);

create table if not exists public.hr_candidate_form_responses (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.hr_candidate_cases(id) on delete cascade,
  invite_id uuid not null unique references public.hr_candidate_form_invites(id) on delete cascade,
  form_type text not null check (form_type in ('fit','intake')),
  response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.hr_candidate_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.hr_candidate_cases(id) on delete cascade,
  document_type text not null default 'other',
  original_name text not null default '',
  storage_path text not null,
  status text not null default 'received'
    check (status in ('required','sent','received','reviewed','approved')),
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create index if not exists hr_cases_status_idx on public.hr_candidate_cases(status,updated_at desc);
create index if not exists hr_invites_case_idx on public.hr_candidate_form_invites(case_id,created_at desc);
create index if not exists hr_docs_case_idx on public.hr_candidate_documents(case_id,created_at desc);

alter table public.hr_candidate_cases enable row level security;
alter table public.hr_candidate_interviews enable row level security;
alter table public.hr_candidate_form_invites enable row level security;
alter table public.hr_candidate_form_responses enable row level security;
alter table public.hr_candidate_documents enable row level security;
revoke all on public.hr_candidate_cases, public.hr_candidate_interviews,
  public.hr_candidate_form_invites, public.hr_candidate_form_responses,
  public.hr_candidate_documents from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'staff-hr-documents','staff-hr-documents',false,15728640,
  array['application/pdf','image/jpeg','image/png','image/webp',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain','text/csv']
)
on conflict(id) do nothing;

drop policy if exists matok_hr_admin_read on storage.objects;
create policy matok_hr_admin_read on storage.objects for select to authenticated
  using(bucket_id='staff-hr-documents' and public.is_admin());
drop policy if exists matok_hr_admin_insert on storage.objects;
create policy matok_hr_admin_insert on storage.objects for insert to authenticated
  with check(bucket_id='staff-hr-documents' and public.is_admin());
drop policy if exists matok_hr_admin_delete on storage.objects;
create policy matok_hr_admin_delete on storage.objects for delete to authenticated
  using(bucket_id='staff-hr-documents' and public.is_admin());

create or replace function public.admin_hr_create_case(p_full_name text,p_phone text,p_email text default '')
returns uuid
language plpgsql security definer set search_path=public,pg_temp
as $f$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if length(btrim(coalesce(p_full_name,'')))<2 then raise exception 'name_required'; end if;
  if length(regexp_replace(coalesce(p_phone,''),'[^0-9]','','g'))<9 then raise exception 'phone_required'; end if;
  insert into public.hr_candidate_cases(full_name,phone,email)
  values(left(btrim(p_full_name),150),left(btrim(p_phone),30),left(btrim(coalesce(p_email,'')),180))
  returning id into v_id;
  return v_id;
end $f$;

create or replace function public.admin_hr_list_cases()
returns table(
  id uuid,full_name text,phone text,email text,status text,staff_id uuid,
  onboarding_record_id uuid,created_at timestamptz,updated_at timestamptz
)
language plpgsql stable security definer set search_path=public,pg_temp
as $f$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  return query select c.id,c.full_name,c.phone,c.email,c.status,c.staff_id,
    c.onboarding_record_id,c.created_at,c.updated_at
  from public.hr_candidate_cases c order by c.updated_at desc limit 500;
end $f$;

create or replace function public.admin_hr_get_case(p_case_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp
as $f$
declare v_result jsonb;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  select jsonb_build_object(
    'case',to_jsonb(c),
    'interview',coalesce((select to_jsonb(i) from public.hr_candidate_interviews i where i.case_id=c.id),'{}'::jsonb),
    'responses',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.hr_candidate_form_responses r where r.case_id=c.id),'[]'::jsonb),
    'invites',coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc) from public.hr_candidate_form_invites v where v.case_id=c.id),'[]'::jsonb),
    'documents',coalesce((select jsonb_agg(to_jsonb(d) order by d.created_at desc) from public.hr_candidate_documents d where d.case_id=c.id),'[]'::jsonb)
  ) into v_result
  from public.hr_candidate_cases c where c.id=p_case_id;
  if v_result is null then raise exception 'case_not_found'; end if;
  return v_result;
end $f$;

create or replace function public.admin_hr_update_case(
  p_case_id uuid,p_full_name text,p_phone text,p_email text,p_status text)
returns boolean
language plpgsql security definer set search_path=public,pg_temp
as $f$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if p_status not in ('new','interview','fit_sent','fit_received','intake_sent','intake_received','ready','hired','rejected')
    then raise exception 'invalid_status'; end if;
  update public.hr_candidate_cases set
    full_name=left(btrim(coalesce(p_full_name,full_name)),150),
    phone=left(btrim(coalesce(p_phone,phone)),30),
    email=left(btrim(coalesce(p_email,email)),180),
    status=p_status,updated_at=now()
  where id=p_case_id;
  if not found then raise exception 'case_not_found'; end if;
  return true;
end $f$;

create or replace function public.admin_hr_save_interview(
  p_case_id uuid,p_answers jsonb,p_decision text,p_rating integer)
returns boolean
language plpgsql security definer set search_path=public,pg_temp
as $f$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if jsonb_typeof(coalesce(p_answers,'{}'::jsonb))<>'object' or length(coalesce(p_answers,'{}'::jsonb)::text)>18000
    then raise exception 'invalid_interview'; end if;
  if p_decision not in ('pending','continue','hold','reject') then raise exception 'invalid_decision'; end if;
  if p_rating is not null and (p_rating<1 or p_rating>5) then raise exception 'invalid_rating'; end if;
  insert into public.hr_candidate_interviews(case_id,answers,decision,rating,updated_at,updated_by)
  values(p_case_id,coalesce(p_answers,'{}'::jsonb),p_decision,p_rating,now(),auth.uid())
  on conflict(case_id) do update set answers=excluded.answers,decision=excluded.decision,
    rating=excluded.rating,updated_at=now(),updated_by=auth.uid();
  update public.hr_candidate_cases set status=case when p_decision='reject' then 'rejected' else 'interview' end,
    updated_at=now() where id=p_case_id;
  return true;
end $f$;

create or replace function public.admin_hr_create_form_invite(p_case_id uuid,p_form_type text)
returns uuid
language plpgsql security definer set search_path=public,pg_temp
as $f$
declare v_token uuid;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if p_form_type not in ('fit','intake') then raise exception 'invalid_form_type'; end if;
  if not exists(select 1 from public.hr_candidate_cases where id=p_case_id) then raise exception 'case_not_found'; end if;
  insert into public.hr_candidate_form_invites(case_id,form_type)
  values(p_case_id,p_form_type) returning token into v_token;
  update public.hr_candidate_cases set
    status=case when p_form_type='fit' then 'fit_sent' else 'intake_sent' end,
    updated_at=now()
  where id=p_case_id;
  return v_token;
end $f$;

create or replace function public.hr_public_form_status(p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp
as $f$
declare v_type text;
begin
  select form_type into v_type from public.hr_candidate_form_invites
  where token=p_token and submitted_at is null and expires_at>now();
  if not found then return '{"open":false}'::jsonb; end if;
  return jsonb_build_object('open',true,'form_type',v_type);
end $f$;

create or replace function public.hr_public_form_submit(p_token uuid,p_data jsonb)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $f$
declare
  v_invite public.hr_candidate_form_invites%rowtype;
  v_case public.hr_candidate_cases%rowtype;
  v_name text; v_phone text; v_response jsonb; v_onboarding uuid;
begin
  select * into v_invite from public.hr_candidate_form_invites
  where token=p_token and submitted_at is null and expires_at>now() for update;
  if not found then raise exception 'invalid_or_expired_form'; end if;
  select * into v_case from public.hr_candidate_cases where id=v_invite.case_id for update;
  if not found then raise exception 'case_not_found'; end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' or length(p_data::text)>18000 then
    raise exception 'invalid_form_payload'; end if;
  if coalesce(p_data->>'consent','')<>'true' then raise exception 'consent_required'; end if;
  v_name=left(btrim(coalesce(p_data->>'full_name',v_case.full_name)),150);
  v_phone=left(btrim(coalesce(p_data->>'phone',v_case.phone)),30);
  if length(v_name)<2 or length(regexp_replace(v_phone,'[^0-9]','','g'))<9 then
    raise exception 'name_and_phone_required'; end if;

  v_response=jsonb_build_object(
    'full_name',v_name,'phone',v_phone,
    'email',left(coalesce(p_data->>'email',''),180),
    'city',left(coalesce(p_data->>'city',''),100),
    'address',left(coalesce(p_data->>'address',''),250),
    'identity_number',left(coalesce(p_data->>'identity_number',''),30),
    'preferred_role',left(coalesce(p_data->>'preferred_role',''),100),
    'available_shifts',left(coalesce(p_data->>'available_shifts',''),500),
    'friday',left(coalesce(p_data->>'friday',''),100),
    'preferred_start',left(coalesce(p_data->>'preferred_start',''),50),
    'experience',left(coalesce(p_data->>'experience',''),1800),
    'social_media',left(coalesce(p_data->>'social_media',''),800),
    'register_experience',left(coalesce(p_data->>'register_experience',''),800),
    'independent_arrival',left(coalesce(p_data->>'independent_arrival',''),300),
    'availability_notes',left(coalesce(p_data->>'availability_notes',''),1200),
    'why_matok',left(coalesce(p_data->>'why_matok',''),1600),
    'notes',left(coalesce(p_data->>'notes',''),1600)
  );

  insert into public.hr_candidate_form_responses(case_id,invite_id,form_type,response)
  values(v_case.id,v_invite.id,v_invite.form_type,v_response);

  if v_invite.form_type='intake' then
    insert into public.staff_onboarding_records(source,details,confidence)
    values('questionnaire',v_response,'{}'::jsonb) returning id into v_onboarding;
    update public.hr_candidate_cases set onboarding_record_id=v_onboarding,status='intake_received',
      full_name=v_name,phone=v_phone,email=coalesce(nullif(v_response->>'email',''),email),updated_at=now()
    where id=v_case.id;
  else
    update public.hr_candidate_cases set status='fit_received',full_name=v_name,phone=v_phone,
      email=coalesce(nullif(v_response->>'email',''),email),updated_at=now()
    where id=v_case.id;
  end if;

  update public.hr_candidate_form_invites set submitted_at=now() where id=v_invite.id;
  return jsonb_build_object('submitted',true,'form_type',v_invite.form_type);
end $f$;

create or replace function public.admin_hr_register_document(
  p_case_id uuid,p_document_type text,p_storage_path text,p_original_name text,p_note text default '')
returns uuid
language plpgsql security definer set search_path=public,pg_temp
as $f$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.hr_candidate_cases where id=p_case_id) then raise exception 'case_not_found'; end if;
  if not exists(select 1 from storage.objects where bucket_id='staff-hr-documents' and name=p_storage_path)
    then raise exception 'source_document_missing'; end if;
  insert into public.hr_candidate_documents(case_id,document_type,storage_path,original_name,note)
  values(p_case_id,left(coalesce(p_document_type,'other'),80),p_storage_path,
    left(coalesce(p_original_name,''),220),left(coalesce(p_note,''),1000))
  returning id into v_id;
  update public.hr_candidate_cases set updated_at=now() where id=p_case_id;
  return v_id;
end $f$;

create or replace function public.admin_hr_update_document_status(p_document_id uuid,p_status text)
returns boolean
language plpgsql security definer set search_path=public,pg_temp
as $f$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if p_status not in ('required','sent','received','reviewed','approved') then raise exception 'invalid_status'; end if;
  update public.hr_candidate_documents set status=p_status where id=p_document_id;
  if not found then raise exception 'document_not_found'; end if;
  return true;
end $f$;

create or replace function public.admin_hr_link_staff(p_case_id uuid,p_staff_id uuid)
returns boolean
language plpgsql security definer set search_path=public,pg_temp
as $f$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.staff where id=p_staff_id) then raise exception 'staff_not_found'; end if;
  update public.hr_candidate_cases set staff_id=p_staff_id,status='hired',updated_at=now()
  where id=p_case_id;
  if not found then raise exception 'case_not_found'; end if;
  return true;
end $f$;

revoke execute on function public.admin_hr_create_case(text,text,text) from public,anon,authenticated;
revoke execute on function public.admin_hr_list_cases() from public,anon,authenticated;
revoke execute on function public.admin_hr_get_case(uuid) from public,anon,authenticated;
revoke execute on function public.admin_hr_update_case(uuid,text,text,text,text) from public,anon,authenticated;
revoke execute on function public.admin_hr_save_interview(uuid,jsonb,text,integer) from public,anon,authenticated;
revoke execute on function public.admin_hr_create_form_invite(uuid,text) from public,anon,authenticated;
revoke execute on function public.admin_hr_register_document(uuid,text,text,text,text) from public,anon,authenticated;
revoke execute on function public.admin_hr_update_document_status(uuid,text) from public,anon,authenticated;
revoke execute on function public.admin_hr_link_staff(uuid,uuid) from public,anon,authenticated;
revoke execute on function public.hr_public_form_status(uuid) from public,anon,authenticated;
revoke execute on function public.hr_public_form_submit(uuid,jsonb) from public,anon,authenticated;

grant execute on function public.admin_hr_create_case(text,text,text) to authenticated;
grant execute on function public.admin_hr_list_cases() to authenticated;
grant execute on function public.admin_hr_get_case(uuid) to authenticated;
grant execute on function public.admin_hr_update_case(uuid,text,text,text,text) to authenticated;
grant execute on function public.admin_hr_save_interview(uuid,jsonb,text,integer) to authenticated;
grant execute on function public.admin_hr_create_form_invite(uuid,text) to authenticated;
grant execute on function public.admin_hr_register_document(uuid,text,text,text,text) to authenticated;
grant execute on function public.admin_hr_update_document_status(uuid,text) to authenticated;
grant execute on function public.admin_hr_link_staff(uuid,uuid) to authenticated;
grant execute on function public.hr_public_form_status(uuid) to anon,authenticated;
grant execute on function public.hr_public_form_submit(uuid,jsonb) to anon,authenticated;

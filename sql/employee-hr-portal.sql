-- MATOK employee recruitment / HR portal.
-- Additive only. Existing staff/onboarding/payroll data is untouched.

create table if not exists public.staff_candidate_hr_invites (
  id uuid primary key default gen_random_uuid(),
  token uuid not null unique default gen_random_uuid(),
  form_type text not null check(form_type in ('suitability')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '7 days'),
  submitted_at timestamptz,
  constraint staff_candidate_hr_invites_expiry check(expires_at>created_at)
);

create table if not exists public.staff_candidate_hr_forms (
  id uuid primary key default gen_random_uuid(),
  form_type text not null check(form_type in ('interview','suitability')),
  source text not null check(source in ('manager','candidate')),
  full_name text not null,
  phone text not null,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'submitted' check(status in ('draft','submitted','reviewed')),
  staff_id uuid references public.staff(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_candidate_hr_documents (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  phone text,
  staff_id uuid references public.staff(id) on delete set null,
  doc_type text not null check(doc_type in ('cv','id_copy','interview','onboarding','certificate','other')),
  original_name text not null,
  storage_path text not null unique,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists staff_candidate_hr_forms_phone_idx
  on public.staff_candidate_hr_forms((regexp_replace(phone,'[^0-9]','','g')),created_at desc);
create index if not exists staff_candidate_hr_docs_phone_idx
  on public.staff_candidate_hr_documents((regexp_replace(coalesce(phone,''),'[^0-9]','','g')),created_at desc);

alter table public.staff_candidate_hr_invites enable row level security;
alter table public.staff_candidate_hr_forms enable row level security;
alter table public.staff_candidate_hr_documents enable row level security;

revoke all on public.staff_candidate_hr_invites,public.staff_candidate_hr_forms,public.staff_candidate_hr_documents
  from public,anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'candidate-hr-documents','candidate-hr-documents',false,12582912,
  array['application/pdf','image/jpeg','image/png','image/webp',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain','text/csv']
) on conflict(id) do nothing;

drop policy if exists matok_candidate_hr_admin_read on storage.objects;
create policy matok_candidate_hr_admin_read on storage.objects for select to authenticated
  using(bucket_id='candidate-hr-documents' and public.is_admin());

drop policy if exists matok_candidate_hr_admin_write on storage.objects;
create policy matok_candidate_hr_admin_write on storage.objects for insert to authenticated
  with check(bucket_id='candidate-hr-documents' and public.is_admin());

drop policy if exists matok_candidate_hr_admin_delete on storage.objects;
create policy matok_candidate_hr_admin_delete on storage.objects for delete to authenticated
  using(bucket_id='candidate-hr-documents' and public.is_admin());

create or replace function public.admin_create_candidate_hr_invite(
  p_form_type text default 'suitability'
) returns uuid
language plpgsql security definer set search_path=public,pg_temp
as $f$
declare v_token uuid;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if p_form_type<>'suitability' then raise exception 'unsupported_form_type'; end if;
  insert into public.staff_candidate_hr_invites(form_type)
  values(p_form_type) returning token into v_token;
  return v_token;
end $f$;

create or replace function public.candidate_hr_form_status(p_token uuid)
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp
as $f$
declare v_type text;
begin
  select form_type into v_type from public.staff_candidate_hr_invites
  where token=p_token and expires_at>now() and submitted_at is null;
  if not found then return '{"open":false}'::jsonb; end if;
  return jsonb_build_object('open',true,'form_type',v_type);
end $f$;

create or replace function public.candidate_hr_submit(p_token uuid,p_data jsonb)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $f$
declare
  v_inv public.staff_candidate_hr_invites%rowtype;
  v_name text;
  v_phone text;
  v_answers jsonb;
begin
  select * into v_inv from public.staff_candidate_hr_invites
  where token=p_token and expires_at>now() and submitted_at is null for update;
  if not found then raise exception 'invalid_or_expired_form'; end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' or length(p_data::text)>18000
    then raise exception 'invalid_form_payload'; end if;
  if coalesce(p_data->>'consent','')<>'true' then raise exception 'consent_required'; end if;

  v_name=btrim(left(coalesce(p_data->>'full_name',''),150));
  v_phone=regexp_replace(coalesce(p_data->>'phone',''),'[^0-9+]','','g');
  if length(v_name)<2 or length(regexp_replace(v_phone,'[^0-9]','','g'))<9
    then raise exception 'name_and_phone_required'; end if;

  v_answers=jsonb_build_object(
    'preferred_shifts',left(coalesce(p_data->>'preferred_shifts',''),120),
    'friday_availability',left(coalesce(p_data->>'friday_availability',''),120),
    'start_date',left(coalesce(p_data->>'start_date',''),50),
    'sales_experience',left(coalesce(p_data->>'sales_experience',''),1200),
    'cashier_experience',left(coalesce(p_data->>'cashier_experience',''),500),
    'social_media',left(coalesce(p_data->>'social_media',''),700),
    'independent_arrival',left(coalesce(p_data->>'independent_arrival',''),300),
    'customer_service',left(coalesce(p_data->>'customer_service',''),1200),
    'commitment',left(coalesce(p_data->>'commitment',''),700),
    'notes',left(coalesce(p_data->>'notes',''),1200)
  );

  insert into public.staff_candidate_hr_forms(
    form_type,source,full_name,phone,answers,status
  ) values('suitability','candidate',v_name,v_phone,v_answers,'submitted');

  update public.staff_candidate_hr_invites set submitted_at=now() where id=v_inv.id;
  return '{"submitted":true}'::jsonb;
end $f$;

create or replace function public.admin_save_candidate_interview(
  p_full_name text,p_phone text,p_answers jsonb
) returns uuid
language plpgsql security definer set search_path=public,pg_temp
as $f$
declare v_id uuid; v_phone text;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if length(btrim(coalesce(p_full_name,'')))<2 then raise exception 'name_required'; end if;
  v_phone=regexp_replace(coalesce(p_phone,''),'[^0-9+]','','g');
  if length(regexp_replace(v_phone,'[^0-9]','','g'))<9 then raise exception 'phone_required'; end if;
  if p_answers is null or jsonb_typeof(p_answers)<>'object' or length(p_answers::text)>22000
    then raise exception 'invalid_answers'; end if;
  insert into public.staff_candidate_hr_forms(
    form_type,source,full_name,phone,answers,status,created_by
  ) values(
    'interview','manager',left(btrim(p_full_name),150),v_phone,p_answers,'submitted',auth.uid()
  ) returning id into v_id;
  return v_id;
end $f$;

create or replace function public.admin_list_candidate_hr_forms()
returns table(
  id uuid,form_type text,source text,full_name text,phone text,answers jsonb,
  status text,staff_id uuid,created_at timestamptz,updated_at timestamptz
)
language plpgsql stable security definer set search_path=public,pg_temp
as $f$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  return query
    select f.id,f.form_type,f.source,f.full_name,f.phone,f.answers,
      f.status,f.staff_id,f.created_at,f.updated_at
    from public.staff_candidate_hr_forms f
    order by f.created_at desc limit 500;
end $f$;

create or replace function public.admin_register_candidate_hr_document(
  p_full_name text,p_phone text,p_staff_id uuid,p_doc_type text,
  p_original_name text,p_storage_path text
) returns uuid
language plpgsql security definer set search_path=public,pg_temp
as $f$
declare v_id uuid;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if p_doc_type not in ('cv','id_copy','interview','onboarding','certificate','other')
    then raise exception 'invalid_doc_type'; end if;
  if p_staff_id is not null and not exists(select 1 from public.staff where id=p_staff_id)
    then raise exception 'staff_not_found'; end if;
  if not exists(select 1 from storage.objects
    where bucket_id='candidate-hr-documents' and name=p_storage_path)
    then raise exception 'document_missing'; end if;

  insert into public.staff_candidate_hr_documents(
    full_name,phone,staff_id,doc_type,original_name,storage_path
  ) values(
    nullif(left(btrim(coalesce(p_full_name,'')),150),''),
    nullif(left(btrim(coalesce(p_phone,'')),40),''),
    p_staff_id,p_doc_type,left(p_original_name,220),p_storage_path
  ) returning id into v_id;
  return v_id;
end $f$;

create or replace function public.admin_list_candidate_hr_documents()
returns table(
  id uuid,full_name text,phone text,staff_id uuid,doc_type text,
  original_name text,storage_path text,created_at timestamptz
)
language plpgsql stable security definer set search_path=public,pg_temp
as $f$
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  return query
    select d.id,d.full_name,d.phone,d.staff_id,d.doc_type,
      d.original_name,d.storage_path,d.created_at
    from public.staff_candidate_hr_documents d
    order by d.created_at desc limit 1000;
end $f$;

create or replace function public.admin_link_candidate_hr_to_staff(p_phone text,p_staff_id uuid)
returns integer
language plpgsql security definer set search_path=public,pg_temp
as $f$
declare v_count integer:=0; v_norm text;
begin
  if not public.is_admin() then raise exception 'not_authorized'; end if;
  if not exists(select 1 from public.staff where id=p_staff_id) then raise exception 'staff_not_found'; end if;
  v_norm:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  update public.staff_candidate_hr_forms
    set staff_id=p_staff_id,updated_at=now()
    where regexp_replace(phone,'[^0-9]','','g')=v_norm and staff_id is null;
  get diagnostics v_count=row_count;
  update public.staff_candidate_hr_documents
    set staff_id=p_staff_id
    where regexp_replace(coalesce(phone,''),'[^0-9]','','g')=v_norm and staff_id is null;
  return v_count;
end $f$;

revoke execute on function public.admin_create_candidate_hr_invite(text) from public,anon,authenticated;
revoke execute on function public.candidate_hr_form_status(uuid) from public,anon,authenticated;
revoke execute on function public.candidate_hr_submit(uuid,jsonb) from public,anon,authenticated;
revoke execute on function public.admin_save_candidate_interview(text,text,jsonb) from public,anon,authenticated;
revoke execute on function public.admin_list_candidate_hr_forms() from public,anon,authenticated;
revoke execute on function public.admin_register_candidate_hr_document(text,text,uuid,text,text,text) from public,anon,authenticated;
revoke execute on function public.admin_list_candidate_hr_documents() from public,anon,authenticated;
revoke execute on function public.admin_link_candidate_hr_to_staff(text,uuid) from public,anon,authenticated;

grant execute on function public.candidate_hr_form_status(uuid) to anon,authenticated;
grant execute on function public.candidate_hr_submit(uuid,jsonb) to anon,authenticated;
grant execute on function public.admin_create_candidate_hr_invite(text) to authenticated;
grant execute on function public.admin_save_candidate_interview(text,text,jsonb) to authenticated;
grant execute on function public.admin_list_candidate_hr_forms() to authenticated;
grant execute on function public.admin_register_candidate_hr_document(text,text,uuid,text,text,text) to authenticated;
grant execute on function public.admin_list_candidate_hr_documents() to authenticated;
grant execute on function public.admin_link_candidate_hr_to_staff(text,uuid) to authenticated;

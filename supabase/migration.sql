-- ============================================================
-- SLEEPOVER — FULL DATABASE MIGRATION
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- SECTION 1: TABLES
-- ============================================================

-- 1.1 trips
create table trips (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  destination           text,
  start_date            date,
  end_date              date,
  base_currency         text not null default 'USD',
  budget_total          numeric(12,2),
  notes                 text,
  invite_token          text not null unique,
  home_timezone         text not null default 'UTC',
  destination_timezone  text not null default 'UTC',
  created_at            timestamptz not null default now()
);

create index trips_invite_token_idx on trips(invite_token);


-- 1.2 travelers
create table travelers (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  name        text not null,
  color       text not null default '#6366f1',
  device_id   text not null,
  is_owner    boolean not null default false,
  joined_at   timestamptz not null default now(),
  unique(trip_id, device_id)
);

create index travelers_trip_id_idx  on travelers(trip_id);
create index travelers_device_id_idx on travelers(device_id);


-- 1.3 currencies
create table currencies (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references trips(id) on delete cascade,
  code         text not null,
  rate_to_base numeric(18,8) not null,
  label        text,
  unique(trip_id, code)
);

create index currencies_trip_id_idx on currencies(trip_id);


-- 1.4 itinerary_items
create table itinerary_items (
  id              uuid primary key default gen_random_uuid(),
  trip_id         uuid not null references trips(id) on delete cascade,
  day_number      integer not null,
  start_time      time,
  end_time        time,
  title           text not null,
  location_name   text,
  latitude        double precision,
  longitude       double precision,
  category        text not null default 'other'
                    check (category in ('food','sight','transport','lodging','activity','flight','other')),
  notes           text,
  color           text,
  order_in_day    integer not null default 0,
  document_id     uuid,   -- FK added after documents table is created
  flight_number   text,
  check_in_time   time,
  check_out_time  time
);

create index itinerary_items_trip_id_idx  on itinerary_items(trip_id);
create index itinerary_items_trip_day_idx on itinerary_items(trip_id, day_number, order_in_day);


-- 1.5 expenses
create table expenses (
  id                   uuid primary key default gen_random_uuid(),
  trip_id              uuid not null references trips(id) on delete cascade,
  title                text not null,
  amount_original      numeric(12,2) not null,
  currency             text not null,
  amount_in_base       numeric(12,2) not null,
  date                 date not null,
  category             text not null default 'other'
                         check (category in ('lodging','food','transport','activities','other')),
  paid_by_traveler_id  uuid not null references travelers(id) on delete restrict,
  split_mode           text not null default 'equal'
                         check (split_mode in ('equal','custom','percentage','itemized')),
  receipt_photo_path   text,
  created_at           timestamptz not null default now()
);

create index expenses_trip_id_idx   on expenses(trip_id);
create index expenses_trip_date_idx on expenses(trip_id, date);


-- 1.6 expense_splits
create table expense_splits (
  id                    uuid primary key default gen_random_uuid(),
  expense_id            uuid not null references expenses(id) on delete cascade,
  traveler_id           uuid not null references travelers(id) on delete cascade,
  share_amount_in_base  numeric(12,2) not null,
  unique(expense_id, traveler_id)
);

create index expense_splits_expense_id_idx  on expense_splits(expense_id);
create index expense_splits_traveler_id_idx on expense_splits(traveler_id);


-- 1.7 tasks
create table tasks (
  id                      uuid primary key default gen_random_uuid(),
  trip_id                 uuid not null references trips(id) on delete cascade,
  title                   text not null,
  description             text,
  due_date                date,
  due_time                time,
  category                text not null default 'general'
                            check (category in ('pre-trip','booking','packing','on-trip','post-trip','general')),
  is_done                 boolean not null default false,
  created_by_traveler_id  uuid references travelers(id) on delete set null,
  source                  text not null default 'manual'
                            check (source in ('manual','auto-generated')),
  created_at              timestamptz not null default now()
);

create index tasks_trip_id_idx       on tasks(trip_id);
create index tasks_trip_category_idx on tasks(trip_id, category);


-- 1.8 task_assignees
create table task_assignees (
  task_id     uuid not null references tasks(id) on delete cascade,
  traveler_id uuid not null references travelers(id) on delete cascade,
  primary key (task_id, traveler_id)
);

create index task_assignees_task_id_idx     on task_assignees(task_id);
create index task_assignees_traveler_id_idx on task_assignees(traveler_id);


-- 1.9 documents
create table documents (
  id                    uuid primary key default gen_random_uuid(),
  trip_id               uuid not null references trips(id) on delete cascade,
  filename              text not null,
  file_path             text not null,
  file_size_bytes       bigint not null,
  mime_type             text not null,
  category              text not null default 'other'
                          check (category in ('identity','visas','flights','accommodation','transport','activities','insurance','other')),
  is_shared             boolean not null default true,
  uploader_traveler_id  uuid not null references travelers(id) on delete restrict,
  uploaded_at           timestamptz not null default now()
);

create index documents_trip_id_idx    on documents(trip_id);
create index documents_uploader_idx   on documents(uploader_traveler_id);
create index documents_trip_shared_idx on documents(trip_id, is_shared);


-- 1.10 document_links
create table document_links (
  document_id        uuid not null references documents(id) on delete cascade,
  itinerary_item_id  uuid not null references itinerary_items(id) on delete cascade,
  primary key (document_id, itinerary_item_id)
);

create index document_links_doc_id_idx  on document_links(document_id);
create index document_links_item_id_idx on document_links(itinerary_item_id);


-- Now add the deferred FK from itinerary_items → documents
alter table itinerary_items
  add constraint itinerary_items_document_id_fk
  foreign key (document_id) references documents(id) on delete set null;


-- 1.11 reminders
create table reminders (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references trips(id) on delete cascade,
  traveler_id      uuid references travelers(id) on delete cascade,
  title            text not null,
  description      text,
  fire_at          timestamptz not null,
  source_type      text not null
                     check (source_type in ('flight','hotel','activity','packing','budget','weather','general')),
  source_id        uuid,
  is_dismissed     boolean not null default false,
  is_acknowledged  boolean not null default false,
  created_at       timestamptz not null default now()
);

create index reminders_trip_id_idx     on reminders(trip_id);
create index reminders_traveler_id_idx on reminders(traveler_id);
create index reminders_fire_at_idx     on reminders(fire_at);


-- 1.12 dismissed_reminders
create table dismissed_reminders (
  traveler_id            uuid not null references travelers(id) on delete cascade,
  reminder_template_key  text not null,
  dismissed_at           timestamptz not null default now(),
  primary key (traveler_id, reminder_template_key)
);

create index dismissed_reminders_traveler_idx on dismissed_reminders(traveler_id);


-- ============================================================
-- SECTION 2: HELPER FUNCTION
-- ============================================================

create or replace function current_traveler_id()
returns uuid
language sql stable security definer
as $$
  select id
  from travelers
  where device_id = current_setting('request.headers', true)::json->>'x-device-id'
  limit 1;
$$;


-- ============================================================
-- SECTION 3: ROW LEVEL SECURITY
-- ============================================================

-- trips
alter table trips enable row level security;

create policy "trips_select" on trips for select
  using (id in (select trip_id from travelers where id = current_traveler_id()));

create policy "trips_insert" on trips for insert
  with check (true);

create policy "trips_update" on trips for update
  using (id in (select trip_id from travelers where id = current_traveler_id()));

create policy "trips_delete" on trips for delete
  using (id in (select trip_id from travelers where id = current_traveler_id() and is_owner = true));


-- travelers
alter table travelers enable row level security;

create policy "travelers_select" on travelers for select
  using (trip_id in (select trip_id from travelers where id = current_traveler_id()));

create policy "travelers_insert" on travelers for insert
  with check (true);

create policy "travelers_update" on travelers for update
  using (id = current_traveler_id());

create policy "travelers_delete" on travelers for delete
  using (
    id = current_traveler_id()
    or trip_id in (select trip_id from travelers where id = current_traveler_id() and is_owner = true)
  );


-- currencies
alter table currencies enable row level security;

create policy "currencies_all" on currencies for all
  using (trip_id in (select trip_id from travelers where id = current_traveler_id()))
  with check (trip_id in (select trip_id from travelers where id = current_traveler_id()));


-- itinerary_items
alter table itinerary_items enable row level security;

create policy "itinerary_items_all" on itinerary_items for all
  using (trip_id in (select trip_id from travelers where id = current_traveler_id()))
  with check (trip_id in (select trip_id from travelers where id = current_traveler_id()));


-- expenses
alter table expenses enable row level security;

create policy "expenses_select" on expenses for select
  using (trip_id in (select trip_id from travelers where id = current_traveler_id()));

create policy "expenses_insert" on expenses for insert
  with check (trip_id in (select trip_id from travelers where id = current_traveler_id()));

create policy "expenses_update" on expenses for update
  using (
    paid_by_traveler_id = current_traveler_id()
    or trip_id in (select trip_id from travelers where id = current_traveler_id() and is_owner = true)
  );

create policy "expenses_delete" on expenses for delete
  using (
    paid_by_traveler_id = current_traveler_id()
    or trip_id in (select trip_id from travelers where id = current_traveler_id() and is_owner = true)
  );


-- expense_splits
alter table expense_splits enable row level security;

create policy "expense_splits_select" on expense_splits for select
  using (
    expense_id in (
      select e.id from expenses e
      join travelers t on t.trip_id = e.trip_id
      where t.id = current_traveler_id()
    )
  );

create policy "expense_splits_insert" on expense_splits for insert
  with check (
    expense_id in (
      select e.id from expenses e
      join travelers t on t.trip_id = e.trip_id
      where t.id = current_traveler_id()
    )
  );

create policy "expense_splits_modify" on expense_splits for all
  using (
    expense_id in (
      select e.id from expenses e
      where e.paid_by_traveler_id = current_traveler_id()
    )
  );


-- tasks
alter table tasks enable row level security;

create policy "tasks_select" on tasks for select
  using (trip_id in (select trip_id from travelers where id = current_traveler_id()));

create policy "tasks_insert" on tasks for insert
  with check (trip_id in (select trip_id from travelers where id = current_traveler_id()));

create policy "tasks_update" on tasks for update
  using (trip_id in (select trip_id from travelers where id = current_traveler_id()));

create policy "tasks_delete" on tasks for delete
  using (
    created_by_traveler_id = current_traveler_id()
    or trip_id in (select trip_id from travelers where id = current_traveler_id() and is_owner = true)
  );


-- task_assignees
alter table task_assignees enable row level security;

create policy "task_assignees_all" on task_assignees for all
  using (
    task_id in (
      select tk.id from tasks tk
      join travelers t on t.trip_id = tk.trip_id
      where t.id = current_traveler_id()
    )
  )
  with check (
    task_id in (
      select tk.id from tasks tk
      join travelers t on t.trip_id = tk.trip_id
      where t.id = current_traveler_id()
    )
  );


-- documents
alter table documents enable row level security;

create policy "documents_select" on documents for select
  using (
    (is_shared = true and trip_id in (select trip_id from travelers where id = current_traveler_id()))
    or (is_shared = false and uploader_traveler_id = current_traveler_id())
  );

create policy "documents_insert" on documents for insert
  with check (
    trip_id in (select trip_id from travelers where id = current_traveler_id())
    and uploader_traveler_id = current_traveler_id()
  );

create policy "documents_modify" on documents for all
  using (uploader_traveler_id = current_traveler_id());


-- document_links
alter table document_links enable row level security;

create policy "document_links_all" on document_links for all
  using (
    document_id in (
      select d.id from documents d
      join travelers t on t.trip_id = d.trip_id
      where t.id = current_traveler_id()
    )
  )
  with check (
    document_id in (
      select d.id from documents d
      join travelers t on t.trip_id = d.trip_id
      where t.id = current_traveler_id()
    )
  );


-- reminders
alter table reminders enable row level security;

create policy "reminders_select" on reminders for select
  using (
    trip_id in (select trip_id from travelers where id = current_traveler_id())
    and (traveler_id is null or traveler_id = current_traveler_id())
  );

create policy "reminders_insert" on reminders for insert
  with check (trip_id in (select trip_id from travelers where id = current_traveler_id()));

create policy "reminders_modify" on reminders for all
  using (
    trip_id in (select trip_id from travelers where id = current_traveler_id())
    and (traveler_id is null or traveler_id = current_traveler_id())
  );


-- dismissed_reminders
alter table dismissed_reminders enable row level security;

create policy "dismissed_reminders_all" on dismissed_reminders for all
  using (traveler_id = current_traveler_id())
  with check (traveler_id = current_traveler_id());


-- ============================================================
-- SECTION 4: STORAGE BUCKETS
-- ============================================================

-- Create the documents bucket (private, 20MB limit)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  20971520,  -- 20 MB in bytes
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
);

-- Create the receipts bucket (private, 10MB limit)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,  -- 10 MB in bytes
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
);

-- Storage RLS: documents bucket
create policy "documents_bucket_select"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from documents d
      join travelers t on t.trip_id = d.trip_id
      where d.file_path = name
        and t.id = current_traveler_id()
        and (d.is_shared = true or d.uploader_traveler_id = current_traveler_id())
    )
  );

create policy "documents_bucket_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and exists (select 1 from travelers where id = current_traveler_id())
  );

create policy "documents_bucket_delete"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from documents
      where file_path = name
        and uploader_traveler_id = current_traveler_id()
    )
  );

-- Storage RLS: receipts bucket
create policy "receipts_bucket_select"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and exists (
      select 1 from expenses e
      join travelers t on t.trip_id = e.trip_id
      where e.receipt_photo_path = name
        and t.id = current_traveler_id()
    )
  );

create policy "receipts_bucket_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and exists (select 1 from travelers where id = current_traveler_id())
  );

create policy "receipts_bucket_delete"
  on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and exists (
      select 1 from expenses e
      where e.receipt_photo_path = name
        and e.paid_by_traveler_id = current_traveler_id()
    )
  );


-- ============================================================
-- SECTION 5: REALTIME PUBLICATION
-- ============================================================

alter publication supabase_realtime add table trips;
alter publication supabase_realtime add table travelers;
alter publication supabase_realtime add table currencies;
alter publication supabase_realtime add table itinerary_items;
alter publication supabase_realtime add table expenses;
alter publication supabase_realtime add table expense_splits;
alter publication supabase_realtime add table tasks;
alter publication supabase_realtime add table task_assignees;
alter publication supabase_realtime add table documents;
alter publication supabase_realtime add table document_links;
alter publication supabase_realtime add table reminders;
-- dismissed_reminders is intentionally excluded (per-device, no sync needed)


-- ============================================================
-- END OF MIGRATION
-- ============================================================

-- ============================================================
-- SECTION 6: PUBLIC JOIN HELPERS
-- (Security-definer RPCs that let an unauthenticated browser
--  resolve a trip by invite_token and join it before any
--  device_id-based RLS policy applies.)
-- ============================================================

-- Public lookup: returns a trip's *minimal* metadata when the caller
-- presents a valid invite_token. Bypasses RLS via security definer.
create or replace function public.trip_by_token(p_token text)
returns table (
  id uuid,
  name text,
  destination text,
  start_date date,
  end_date date,
  base_currency text,
  budget_total numeric,
  notes text,
  invite_token text,
  home_timezone text,
  destination_timezone text,
  created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select id, name, destination, start_date, end_date, base_currency,
         budget_total, notes, invite_token, home_timezone,
         destination_timezone, created_at
  from trips
  where invite_token = p_token
  limit 1;
$$;

grant execute on function public.trip_by_token(text) to anon, authenticated;

-- Public traveler list for a token (used to render avatars before join).
create or replace function public.travelers_by_token(p_token text)
returns table (
  id uuid,
  trip_id uuid,
  name text,
  color text,
  device_id text,
  is_owner boolean,
  joined_at timestamptz
) language sql stable security definer set search_path = public as $$
  select t.id, t.trip_id, t.name, t.color, t.device_id, t.is_owner, t.joined_at
  from travelers t
  join trips tr on tr.id = t.trip_id
  where tr.invite_token = p_token
  order by t.joined_at asc;
$$;

grant execute on function public.travelers_by_token(text) to anon, authenticated;

-- Atomic join: creates trip+owner traveler in one shot.
create or replace function public.create_trip(
  p_name text,
  p_destination text,
  p_start_date date,
  p_end_date date,
  p_base_currency text,
  p_budget_total numeric,
  p_notes text,
  p_invite_token text,
  p_home_timezone text,
  p_destination_timezone text,
  p_traveler_name text,
  p_traveler_color text,
  p_device_id text
) returns table (trip_id uuid, traveler_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_trip uuid;
  v_traveler uuid;
begin
  insert into trips (name, destination, start_date, end_date, base_currency,
                     budget_total, notes, invite_token, home_timezone,
                     destination_timezone)
  values (p_name, p_destination, p_start_date, p_end_date, p_base_currency,
          p_budget_total, p_notes, p_invite_token, p_home_timezone,
          p_destination_timezone)
  returning id into v_trip;

  insert into travelers (trip_id, name, color, device_id, is_owner)
  values (v_trip, p_traveler_name, p_traveler_color, p_device_id, true)
  returning id into v_traveler;

  return query select v_trip, v_traveler;
end;
$$;

grant execute on function public.create_trip(text, text, date, date, text, numeric, text, text, text, text, text, text, text) to anon, authenticated;

-- Atomic join via existing token. If device already joined, returns existing traveler.
create or replace function public.join_trip(
  p_token text,
  p_name text,
  p_color text,
  p_device_id text
) returns table (trip_id uuid, traveler_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_trip uuid;
  v_traveler uuid;
begin
  select id into v_trip from trips where invite_token = p_token;
  if v_trip is null then
    raise exception 'invalid invite token';
  end if;

  select id into v_traveler from travelers
   where trip_id = v_trip and device_id = p_device_id;

  if v_traveler is null then
    insert into travelers (trip_id, name, color, device_id, is_owner)
    values (v_trip, p_name, p_color, p_device_id, false)
    returning id into v_traveler;
  end if;

  return query select v_trip, v_traveler;
end;
$$;

grant execute on function public.join_trip(text, text, text, text) to anon, authenticated;

-- List trips a device has joined. Read-only; bypasses RLS.
create or replace function public.trips_for_device(p_device_id text)
returns table (
  id uuid,
  name text,
  destination text,
  start_date date,
  end_date date,
  invite_token text,
  joined_at timestamptz,
  is_owner boolean
) language sql stable security definer set search_path = public as $$
  select tr.id, tr.name, tr.destination, tr.start_date, tr.end_date,
         tr.invite_token, t.joined_at, t.is_owner
  from travelers t
  join trips tr on tr.id = t.trip_id
  where t.device_id = p_device_id
  order by t.joined_at desc;
$$;

grant execute on function public.trips_for_device(text) to anon, authenticated;

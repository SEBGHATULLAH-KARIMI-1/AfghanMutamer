-- اسکیمای دیتابیس سیستم مدیریت حج و عمره (PostgreSQL / Neon)
-- idempotent است: چندبار اجرا شود مشکلی پیش نمی‌آید.
-- ستون seq فقط برای حفظ ترتیب «جدیدترین اول» است و به فرانت داده نمی‌شود.

-- ───────────── نقش‌ها و کاربران ─────────────
create table if not exists roles (
  seq         bigint generated always as identity,
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  label       text not null,
  permissions jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  constraint roles_name_key unique (name)
);

create table if not exists users (
  seq           bigint generated always as identity,
  id            text primary key default gen_random_uuid()::text,
  username      text not null,
  password_hash text not null,
  name          text not null,
  role          text not null references roles(name) on update cascade on delete restrict,
  created_at    timestamptz not null default now()
);
create unique index if not exists users_username_uniq on users (lower(username));

-- ───────────── شرکت‌ها ─────────────
create table if not exists companies (
  seq            bigint generated always as identity,
  id             text primary key default gen_random_uuid()::text,
  name           text not null,
  phone          text not null default '',
  address        text not null default '',
  email          text not null default '',
  contact_person text not null default '',
  created_at     timestamptz not null default now()
);
create unique index if not exists companies_name_uniq on companies (lower(btrim(name)));

-- ───────────── زائران ─────────────
-- با حذف شرکت، زائران حذف نمی‌شوند و فقط از شرکت جدا می‌شوند (company_id = null)
create table if not exists pilgrims (
  seq                  bigint generated always as identity,
  id                   text primary key default gen_random_uuid()::text,
  company_id           text references companies(id) on delete set null,
  full_name            text not null default '',
  father_name          text not null default '',
  last_name            text not null default '',
  gender               text not null default 'مرد',
  dob                  date,
  phone                text not null default '',
  address              text not null default '',
  passport_number      text not null default '',
  passport_issue_date  date,
  passport_expiry_date date,
  travel_type          text not null default 'عمره',
  caravan_number       text not null default '',
  status               text not null default 'در انتظار',
  photo                text not null default '',
  family_group         text not null default '',
  package_price        numeric(16,2) check (package_price is null or package_price >= 0),
  currency             text not null default 'افغانی',
  final_price          numeric(16,2) check (final_price is null or final_price >= 0),
  stay_duration        integer,
  created_at           date not null default current_date
);
create unique index if not exists pilgrims_passport_uniq
  on pilgrims (upper(btrim(passport_number))) where btrim(passport_number) <> '';
create index if not exists pilgrims_company_idx on pilgrims (company_id);

-- ───────────── پرداخت‌ها ─────────────
-- با حذف زائر، پرداخت‌هایش می‌مانند (مثل رفتار فعلی فرانت)؛ pilgrim_name نام را نگه می‌دارد
create sequence if not exists receipt_seq start 10000;

create table if not exists payments (
  seq            bigint generated always as identity,
  id             text primary key default gen_random_uuid()::text,
  receipt_number text not null,
  pilgrim_id     text references pilgrims(id) on delete set null,
  pilgrim_name   text not null default '',
  amount         numeric(16,2) not null check (amount > 0),
  payment_type   text not null default 'نقدی',
  "date"         date not null,
  description    text not null default '',
  status         text not null default 'پرداخت شده',
  currency       text not null default 'افغانی',
  exchange_rate  numeric(14,4),
  usd_amount     numeric(16,4),
  created_at     timestamptz not null default now()
);
create unique index if not exists payments_receipt_uniq on payments (receipt_number);
create index if not exists payments_pilgrim_idx on payments (pilgrim_id);
create index if not exists payments_date_idx on payments ("date");

-- ───────────── کارمندان ─────────────
create table if not exists employees (
  seq           bigint generated always as identity,
  id            text primary key default gen_random_uuid()::text,
  employee_code text not null default '',
  name          text not null,
  "position"    text not null default '',
  phone         text not null default '',
  email         text not null default '',
  salary        numeric(16,2),
  currency      text not null default 'افغانی',
  join_date     date,
  status        text not null default 'فعال',
  photo         text not null default '',
  created_at    timestamptz not null default now()
);

-- ───────────── مصارف ─────────────
create table if not exists expenses (
  seq         bigint generated always as identity,
  id          text primary key default gen_random_uuid()::text,
  "date"      date not null,
  "type"      text not null default 'مصرف',
  category    text not null default '',
  person      text not null default '',
  amount      numeric(16,2) not null check (amount > 0),
  description text not null default '',
  currency    text not null default 'افغانی',
  created_at  timestamptz not null default now()
);
create index if not exists expenses_date_idx on expenses ("date");

-- برای دیتابیس‌هایی که قبل از افزودن این ستون ساخته شده‌اند
alter table employees add column if not exists currency text not null default 'افغانی';

-- ───────────── گزارش فعالیت‌ها و تنظیمات ─────────────
create table if not exists activity_logs (
  seq        bigint generated always as identity,
  id         text primary key default gen_random_uuid()::text,
  username   text not null default 'system',
  action     text not null,
  details    text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key   text primary key,
  value jsonb not null
);

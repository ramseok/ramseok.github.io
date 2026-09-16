-- 포트폴리오 관리자 — Supabase 셋업 (SQL Editor 에서 전체 실행, 1회)
-- 만들어지는 것: portfolio 테이블 · RLS 정책 · 공개 버킷 'portfolio' · 스토리지 정책
-- 쓰기 권한은 아래 owner_email 계정에만 허용된다. 먼저 Authentication → Users 에서 같은 이메일로 계정을 만들 것.

-- ── 0. 관리자 이메일 (본인 계정으로 바꿀 것) ──
create or replace function public.portfolio_owner_email() returns text
language sql immutable as $$ select 'kimseoknam@icloud.com'::text $$;

create or replace function public.is_portfolio_owner() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = public.portfolio_owner_email()
$$;

-- ── 1. 테이블 ──
create table if not exists public.portfolio (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.portfolio enable row level security;

drop policy if exists "portfolio public read"  on public.portfolio;
drop policy if exists "portfolio owner insert" on public.portfolio;
drop policy if exists "portfolio owner update" on public.portfolio;

create policy "portfolio public read"  on public.portfolio for select using (true);
create policy "portfolio owner insert" on public.portfolio for insert to authenticated with check (public.is_portfolio_owner());
create policy "portfolio owner update" on public.portfolio for update to authenticated using (public.is_portfolio_owner()) with check (public.is_portfolio_owner());
-- 삭제 정책 없음 = 삭제 불가

-- ── 2. 이미지·파일 버킷 (공개 읽기, 관리자만 업로드/수정/삭제) ──
insert into storage.buckets (id, name, public)
values ('portfolio', 'portfolio', true)
on conflict (id) do update set public = true;

drop policy if exists "portfolio files public read" on storage.objects;
drop policy if exists "portfolio files owner insert" on storage.objects;
drop policy if exists "portfolio files owner update" on storage.objects;
drop policy if exists "portfolio files owner delete" on storage.objects;

create policy "portfolio files public read"   on storage.objects for select using (bucket_id = 'portfolio');
create policy "portfolio files owner insert"  on storage.objects for insert to authenticated with check (bucket_id = 'portfolio' and public.is_portfolio_owner());
create policy "portfolio files owner update"  on storage.objects for update to authenticated using (bucket_id = 'portfolio' and public.is_portfolio_owner());
create policy "portfolio files owner delete"  on storage.objects for delete to authenticated using (bucket_id = 'portfolio' and public.is_portfolio_owner());

-- 확인용: select id, updated_at from public.portfolio;

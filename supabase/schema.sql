-- =====================================================================
--  KINGSMEN SEEDING — Supabase schema (Postgres + RLS + trigger tính tiền)
--  Cách dùng: mở Supabase → SQL Editor → dán TOÀN BỘ file này → Run.
--  Chạy lại được nhiều lần (idempotent ở mức hợp lý).
-- =====================================================================

-- ---------- 0. EXTENSIONS ----------
create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ---------- 1. ENUMS ----------
do $$ begin
  create type vai_tro_enum as enum ('MARKETING','SALES','ADMIN');
exception when duplicate_object then null; end $$;
do $$ begin
  create type trang_thai_enum as enum ('NHAP','CHO_DUYET','DAT','KHONG_DAT','DA_CHI');
exception when duplicate_object then null; end $$;
do $$ begin
  create type cmt_loai_enum as enum ('MINH_DANG','DAO');
exception when duplicate_object then null; end $$;

-- ---------- 2. BẢNG ----------

-- profiles: hồ sơ người dùng, 1-1 với auth.users
create table if not exists profiles (
  id         uuid primary key references auth.users on delete cascade,
  ho_ten     text not null,
  email      text,
  vai_tro    vai_tro_enum not null default 'SALES',
  active     boolean not null default true,
  created_at timestamptz default now()
);

-- pricing: 1 dòng cấu hình đơn giá (id luôn = 1)
create table if not exists pricing (
  id                int primary key default 1,
  don_gia_post      numeric not null default 15000,
  don_gia_cmt       numeric not null default 3000,
  min_nhac_kingsmen int default 6,
  min_usp           int default 2,
  constraint pricing_singleton check (id = 1)
);
insert into pricing (id) values (1) on conflict (id) do nothing;

-- THƯ VIỆN CHUNG: groups
create table if not exists groups (
  id         uuid primary key default gen_random_uuid(),
  ten_group  text not null,
  link       text,
  loai       text,
  so_member  int default 0,
  active     boolean default true,
  uu_tien    boolean default false,
  updated_by uuid references profiles(id),
  updated_at timestamptz default now()
);

-- THƯ VIỆN CHUNG: content_topics (chủ đề/nội dung POST)
create table if not exists content_topics (
  id         uuid primary key default gen_random_uuid(),
  chu_de     text not null,
  noi_dung   text,
  loai_bai   text,
  muc_tieu   text,
  tags       text[] default '{}',
  active     boolean default true,
  uu_tien    boolean default false,
  created_by uuid references profiles(id),
  updated_at timestamptz default now()
);

-- THƯ VIỆN CHUNG: cmt_suggestions (gợi ý cmt)
create table if not exists cmt_suggestions (
  id             uuid primary key default gen_random_uuid(),
  noi_dung_goi_y text not null,
  tuyen          text,
  loai_bai       text,
  tags           text[] default '{}',
  thu_tu         int default 0,
  active         boolean default true,
  created_by     uuid references profiles(id),
  updated_at     timestamptz default now()
);

-- post_seedings
create table if not exists post_seedings (
  id              uuid primary key default gen_random_uuid(),
  topic_id        uuid references content_topics(id),
  sales_id        uuid not null references profiles(id),
  group_id        uuid references groups(id),
  link_bai        text,
  react           int default 0,
  so_cmt_seeding  int default 0,
  so_cmt_tu_nhien int default 0,
  trang_thai      trang_thai_enum not null default 'NHAP',
  reviewed_by     uuid references profiles(id),
  reviewed_at     timestamptz,
  ly_do_loai      text default '',
  thanh_tien      numeric default 0,
  ky_thanh_toan   text,
  created_at      timestamptz default now()
);

-- cmt_seedings
create table if not exists cmt_seedings (
  id              uuid primary key default gen_random_uuid(),
  loai            cmt_loai_enum not null,
  post_seeding_id uuid references post_seedings(id) on delete set null,
  post_link       text,
  suggestion_id   uuid references cmt_suggestions(id),
  sales_id        uuid not null references profiles(id),
  so_cmt_seeding  int default 0,
  react           int default 0,
  so_cmt_tu_nhien int default 0,
  trang_thai      trang_thai_enum not null default 'NHAP',
  reviewed_by     uuid references profiles(id),
  reviewed_at     timestamptz,
  ly_do_loai      text default '',
  thanh_tien      numeric default 0,
  ky_thanh_toan   text,
  created_at      timestamptz default now()
);

-- cmt_proofs (ảnh báo cáo — 1 cmt có nhiều ảnh)
create table if not exists cmt_proofs (
  id             uuid primary key default gen_random_uuid(),
  cmt_seeding_id uuid not null references cmt_seedings(id) on delete cascade,
  image_url      text not null,
  uploaded_at    timestamptz default now()
);

-- audit (nhật ký)
create table if not exists audit (
  id        uuid primary key default gen_random_uuid(),
  at        timestamptz default now(),
  by_id     uuid references profiles(id),
  by_name   text,
  action    text,
  entity    text,
  entity_id text,
  detail    text
);

-- index hay dùng
create index if not exists idx_post_sales   on post_seedings(sales_id);
create index if not exists idx_post_status  on post_seedings(trang_thai);
create index if not exists idx_cmt_sales    on cmt_seedings(sales_id);
create index if not exists idx_cmt_status   on cmt_seedings(trang_thai);
create index if not exists idx_proof_parent on cmt_proofs(cmt_seeding_id);

-- ---------- 3. HÀM TIỆN ÍCH ----------

-- vai trò của user hiện tại
create or replace function my_role() returns vai_tro_enum
  language sql stable security definer set search_path = public as
$$ select vai_tro from profiles where id = auth.uid() $$;

-- là Marketing hoặc Admin?
create or replace function is_staff() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce(my_role() in ('MARKETING','ADMIN'), false) $$;

-- ---------- 4. TRIGGER TỰ TÍNH TIỀN KHI NGHIỆM THU ----------
-- Khi trang_thai -> DAT: tính thành tiền theo pricing, ghi người/giờ duyệt, kỳ.
-- Khi -> KHONG_DAT: tiền = 0. (Chạy phía DB nên client không tự chế được tiền.)
create or replace function calc_thanh_tien() returns trigger
  language plpgsql security definer set search_path = public as
$$
declare p pricing%rowtype;
begin
  select * into p from pricing where id = 1;

  if NEW.trang_thai = 'DAT' and (OLD.trang_thai is distinct from 'DAT') then
    if TG_TABLE_NAME = 'post_seedings' then
      NEW.thanh_tien := p.don_gia_post;
    else
      NEW.thanh_tien := coalesce(NEW.so_cmt_seeding,0) * p.don_gia_cmt;
    end if;
    NEW.reviewed_by   := auth.uid();
    NEW.reviewed_at   := now();
    NEW.ky_thanh_toan := to_char(now(),'YYYY-MM');
    NEW.ly_do_loai    := '';

  elsif NEW.trang_thai = 'KHONG_DAT' and (OLD.trang_thai is distinct from 'KHONG_DAT') then
    NEW.thanh_tien  := 0;
    NEW.reviewed_by := auth.uid();
    NEW.reviewed_at := now();
  end if;

  return NEW;
end $$;

drop trigger if exists trg_post_calc on post_seedings;
create trigger trg_post_calc before update on post_seedings
  for each row execute function calc_thanh_tien();

drop trigger if exists trg_cmt_calc on cmt_seedings;
create trigger trg_cmt_calc before update on cmt_seedings
  for each row execute function calc_thanh_tien();

-- ---------- 5. TỰ TẠO PROFILE KHI CÓ USER MỚI ----------
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as
$$
begin
  insert into public.profiles (id, ho_ten, email, vai_tro)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'ho_ten', split_part(new.email,'@',1)),
          new.email, 'SALES')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- 6. BẬT RLS ----------
alter table profiles        enable row level security;
alter table pricing         enable row level security;
alter table groups          enable row level security;
alter table content_topics  enable row level security;
alter table cmt_suggestions enable row level security;
alter table post_seedings   enable row level security;
alter table cmt_seedings    enable row level security;
alter table cmt_proofs      enable row level security;
alter table audit           enable row level security;

-- ---------- 7. POLICIES ----------
-- Xoá policy cũ nếu chạy lại
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname='public' loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- PROFILES: ai đăng nhập cũng đọc được (để hiện tên Sales); tự sửa mình, Admin sửa tất cả
create policy p_prof_sel on profiles for select to authenticated using (true);
create policy p_prof_upd on profiles for update to authenticated
  using (id = auth.uid() or my_role() = 'ADMIN')
  with check (id = auth.uid() or my_role() = 'ADMIN');
create policy p_prof_ins on profiles for insert to authenticated
  with check (id = auth.uid() or my_role() = 'ADMIN');

-- PRICING: đọc chung, chỉ Admin sửa
create policy p_price_sel on pricing for select to authenticated using (true);
create policy p_price_upd on pricing for update to authenticated
  using (my_role() = 'ADMIN') with check (my_role() = 'ADMIN');

-- THƯ VIỆN: đọc chung; chỉ Marketing/Admin thêm/sửa/xoá
create policy p_grp_sel on groups for select to authenticated using (true);
create policy p_grp_all on groups for all to authenticated
  using (is_staff()) with check (is_staff());

create policy p_top_sel on content_topics for select to authenticated using (true);
create policy p_top_all on content_topics for all to authenticated
  using (is_staff()) with check (is_staff());

create policy p_cmtsug_sel on cmt_suggestions for select to authenticated using (true);
create policy p_cmtsug_all on cmt_suggestions for all to authenticated
  using (is_staff()) with check (is_staff());

-- POST_SEEDINGS
--  Đọc: Sales thấy của mình, staff thấy tất cả
create policy p_post_sel on post_seedings for select to authenticated
  using (sales_id = auth.uid() or is_staff());
--  Thêm: Sales tạo bản ghi của chính mình
create policy p_post_ins on post_seedings for insert to authenticated
  with check (sales_id = auth.uid());
--  Sales sửa item của mình khi Nháp/Bị loại, và chỉ được đưa về NHAP/CHO_DUYET (không tự Đạt)
create policy p_post_upd_sales on post_seedings for update to authenticated
  using (sales_id = auth.uid() and trang_thai in ('NHAP','KHONG_DAT'))
  with check (sales_id = auth.uid() and trang_thai in ('NHAP','CHO_DUYET'));
--  Staff duyệt: đổi sang DAT/KHONG_DAT/DA_CHI
create policy p_post_upd_staff on post_seedings for update to authenticated
  using (is_staff()) with check (is_staff());
--  Xoá: chủ nhân khi còn nháp, hoặc admin
create policy p_post_del on post_seedings for delete to authenticated
  using ((sales_id = auth.uid() and trang_thai = 'NHAP') or my_role() = 'ADMIN');

-- CMT_SEEDINGS (giống post)
create policy p_cmt_sel on cmt_seedings for select to authenticated
  using (sales_id = auth.uid() or is_staff());
create policy p_cmt_ins on cmt_seedings for insert to authenticated
  with check (sales_id = auth.uid());
create policy p_cmt_upd_sales on cmt_seedings for update to authenticated
  using (sales_id = auth.uid() and trang_thai in ('NHAP','KHONG_DAT'))
  with check (sales_id = auth.uid() and trang_thai in ('NHAP','CHO_DUYET'));
create policy p_cmt_upd_staff on cmt_seedings for update to authenticated
  using (is_staff()) with check (is_staff());
create policy p_cmt_del on cmt_seedings for delete to authenticated
  using ((sales_id = auth.uid() and trang_thai = 'NHAP') or my_role() = 'ADMIN');

-- CMT_PROOFS: đọc nếu là chủ cmt hoặc staff; thêm nếu là chủ cmt
create policy p_proof_sel on cmt_proofs for select to authenticated
  using (is_staff() or exists (select 1 from cmt_seedings c where c.id = cmt_seeding_id and c.sales_id = auth.uid()));
create policy p_proof_ins on cmt_proofs for insert to authenticated
  with check (exists (select 1 from cmt_seedings c where c.id = cmt_seeding_id and c.sales_id = auth.uid()));
create policy p_proof_del on cmt_proofs for delete to authenticated
  using (my_role() = 'ADMIN' or exists (select 1 from cmt_seedings c where c.id = cmt_seeding_id and c.sales_id = auth.uid()));

-- AUDIT: staff đọc; ai đăng nhập cũng ghi được log của mình
create policy p_audit_sel on audit for select to authenticated using (is_staff());
create policy p_audit_ins on audit for insert to authenticated with check (by_id = auth.uid());

-- ---------- 8. REALTIME (hàng chờ duyệt cập nhật tức thì) ----------
do $$ begin
  alter publication supabase_realtime add table post_seedings;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table cmt_seedings;
exception when duplicate_object then null; end $$;

-- =====================================================================
--  SAU KHI CHẠY XONG:
--  1) Vào Authentication → Users → tạo user cho từng người (hoặc để họ
--     tự đăng nhập lần đầu bằng OTP email).
--  2) Nâng quyền cho chính bạn thành ADMIN (đổi email cho đúng):
--       update profiles set vai_tro='ADMIN'
--       where email = 'ban@congty.com';
--  3) Tạo Storage bucket tên "proofs" (Public) để lưu ảnh báo cáo.
--     (policy storage đặt trong file storage.sql)
-- =====================================================================

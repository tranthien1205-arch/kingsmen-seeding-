-- =====================================================================
--  STORAGE — bucket "proofs" cho ảnh báo cáo CMT
--  Cách dùng: Storage → New bucket → tên "proofs" → BẬT "Public bucket".
--  Sau đó chạy file này trong SQL Editor để đặt quyền upload.
-- =====================================================================

-- Cho phép người đã đăng nhập upload ảnh vào bucket proofs
drop policy if exists p_proofs_insert on storage.objects;
create policy p_proofs_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs');

-- Cho phép đọc ảnh (bucket đã Public nên link ảnh xem được;
-- policy này để chắc chắn với API list/download)
drop policy if exists p_proofs_select on storage.objects;
create policy p_proofs_select on storage.objects for select to public
  using (bucket_id = 'proofs');

-- Cho phép chủ ảnh / staff xoá
drop policy if exists p_proofs_delete on storage.objects;
create policy p_proofs_delete on storage.objects for delete to authenticated
  using (bucket_id = 'proofs' and (owner = auth.uid() or public.is_staff()));

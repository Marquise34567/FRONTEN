-- Allow authenticated users to upload to the uploads bucket under their own UID prefix.
-- Update the bucket_id if you use a different input bucket name.

create policy "uploads_insert_own" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'uploads'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "uploads_update_own" on storage.objects
for update to authenticated
using (
  bucket_id = 'uploads'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'uploads'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "uploads_select_own" on storage.objects
for select to authenticated
using (
  bucket_id = 'uploads'
  and split_part(name, '/', 1) = auth.uid()::text
);

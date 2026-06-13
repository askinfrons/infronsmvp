-- Create storage bucket for message attachments
-- Run this in Supabase SQL Editor

-- Create bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Practice users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'message-attachments');

-- Allow everyone to view files (needed for client portal)
CREATE POLICY "Anyone can view files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'message-attachments');

-- Allow practice users to delete their own files
CREATE POLICY "Practice users can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'message-attachments');

/*
  # StegoVault Database Schema

  1. New Tables
    - `stego_images`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `filename` (text)
      - `original_filename` (text)
      - `storage_path` (text)
      - `file_size` (bigint)
      - `real_salt` (text) - salt for real password derivation
      - `real_iv` (text) - IV for real file encryption
      - `duress_salt` (text) - salt for duress password derivation
      - `duress_iv` (text) - IV for duress file encryption
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `stego_images` table
    - Add policies for authenticated users to:
      - Select their own stego images
      - Insert their own stego images
      - Update their own stego images
      - Delete their own stego images
*/

CREATE TABLE IF NOT EXISTS stego_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  filename text NOT NULL,
  original_filename text NOT NULL,
  storage_path text NOT NULL,
  file_size bigint DEFAULT 0,
  real_salt text NOT NULL,
  real_iv text NOT NULL,
  duress_salt text NOT NULL,
  duress_iv text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE stego_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stego images"
  ON stego_images FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stego images"
  ON stego_images FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stego images"
  ON stego_images FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own stego images"
  ON stego_images FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_stego_images_user_id ON stego_images(user_id);
CREATE INDEX IF NOT EXISTS idx_stego_images_created_at ON stego_images(created_at DESC);
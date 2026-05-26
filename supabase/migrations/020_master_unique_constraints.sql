-- Add unique constraints per user for CSV upsert support
ALTER TABLE suppliers
  ADD CONSTRAINT suppliers_user_name_key UNIQUE (user_id, name);

ALTER TABLE delivery_destinations
  ADD CONSTRAINT delivery_destinations_user_name_key UNIQUE (user_id, name);

ALTER TABLE carriers
  ADD CONSTRAINT carriers_user_name_key UNIQUE (user_id, name);

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_user_name_key UNIQUE (user_id, name);

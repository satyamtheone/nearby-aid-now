
-- Clean all data from tables for fresh start
DELETE FROM messages;
DELETE FROM help_requests;
DELETE FROM user_locations;

-- Reset sequences if needed
ALTER SEQUENCE IF EXISTS messages_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS help_requests_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS user_locations_id_seq RESTART WITH 1;

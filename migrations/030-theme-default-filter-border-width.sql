-- Reduces active filter tab border width by 1px

-- Up
UPDATE theme SET data = JSON_MERGE_PATCH(data, '{"style":{"filter":{"tabs":{"active":{"border":{"bottom":"2px solid #555555"}}}}}}') WHERE id = 'default';

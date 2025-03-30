-- 删除索引
DROP INDEX IF EXISTS idx_recent_tracks_accessed_at;
DROP INDEX IF EXISTS idx_custom_tracks_user_course_unit;
DROP INDEX IF EXISTS idx_custom_tracks_sort;

-- 删除表
DROP TABLE IF EXISTS recently_played_tracks;
DROP TABLE IF EXISTS user_track_progress;
DROP TABLE IF EXISTS custom_tracks; 
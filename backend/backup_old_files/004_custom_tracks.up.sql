-- 自定义音轨表
CREATE TABLE IF NOT EXISTS custom_tracks (
    id VARCHAR(50) PRIMARY KEY,
    course_id VARCHAR(50) NOT NULL,
    unit_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    chinese_name VARCHAR(255),
    file_path VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    duration FLOAT NOT NULL,
    format VARCHAR(50) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_custom_tracks_user_course_unit ON custom_tracks (user_id, course_id, unit_id);
CREATE INDEX IF NOT EXISTS idx_custom_tracks_sort ON custom_tracks (sort_order);

-- 用户音轨进度表
CREATE TABLE IF NOT EXISTS user_track_progress (
    user_id VARCHAR(50) NOT NULL,
    track_id VARCHAR(50) NOT NULL,
    position FLOAT NOT NULL DEFAULT 0,
    completion_rate FLOAT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, track_id)
);

-- 最近播放记录表
CREATE TABLE IF NOT EXISTS recently_played_tracks (
    user_id VARCHAR(50) NOT NULL,
    track_id VARCHAR(50) NOT NULL,
    position FLOAT NOT NULL DEFAULT 0,
    accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, track_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_recent_tracks_accessed_at ON recently_played_tracks (user_id, accessed_at DESC); 
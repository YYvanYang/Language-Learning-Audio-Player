-- 初始化数据库脚本
-- 包含最小可用的英语课程示例数据

-- 清理已存在的表
DROP TABLE IF EXISTS user_track_progress;
DROP TABLE IF EXISTS recently_played_tracks;
DROP TABLE IF EXISTS custom_tracks;
DROP TABLE IF EXISTS tracks;
DROP TABLE IF EXISTS units;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS users;

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 创建课程表
CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    language VARCHAR(50) NOT NULL,
    level VARCHAR(50) NOT NULL,
    cover_image VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 创建单元表
CREATE TABLE IF NOT EXISTS units (
    id VARCHAR(50) PRIMARY KEY,
    course_id VARCHAR(50) NOT NULL REFERENCES courses(id),
    title VARCHAR(100) NOT NULL,
    description TEXT,
    content TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 创建音轨表
CREATE TABLE IF NOT EXISTS tracks (
    id VARCHAR(50) PRIMARY KEY,
    unit_id VARCHAR(50) NOT NULL REFERENCES units(id),
    title VARCHAR(255) NOT NULL,
    chinese_name VARCHAR(255),
    file_path VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    duration FLOAT NOT NULL DEFAULT 0,
    format VARCHAR(50) NOT NULL DEFAULT 'mp3',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 创建用户进度表
CREATE TABLE IF NOT EXISTS user_track_progress (
    user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    track_id VARCHAR(50) NOT NULL REFERENCES tracks(id),
    position FLOAT NOT NULL DEFAULT 0,
    completion_rate FLOAT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, track_id)
);

-- 创建最近播放记录表
CREATE TABLE IF NOT EXISTS recently_played_tracks (
    user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    track_id VARCHAR(50) NOT NULL REFERENCES tracks(id),
    position FLOAT NOT NULL DEFAULT 0,
    accessed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, track_id)
);

-- 创建自定义音轨表
CREATE TABLE IF NOT EXISTS custom_tracks (
    id VARCHAR(50) PRIMARY KEY,
    course_id VARCHAR(50) NOT NULL REFERENCES courses(id),
    unit_id VARCHAR(50) NOT NULL REFERENCES units(id),
    user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    chinese_name VARCHAR(255),
    file_path VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    duration FLOAT NOT NULL DEFAULT 0,
    format VARCHAR(50) NOT NULL DEFAULT 'mp3',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_units_course_id ON units(course_id);
CREATE INDEX idx_tracks_unit_id ON tracks(unit_id);
CREATE INDEX idx_custom_tracks_user_course_unit ON custom_tracks(user_id, course_id, unit_id);
CREATE INDEX idx_user_track_progress_user_id ON user_track_progress(user_id);
CREATE INDEX idx_recently_played_tracks_user_id ON recently_played_tracks(user_id, accessed_at DESC);

-- 插入测试用户 (密码: password123)
INSERT INTO users (id, username, email, password_hash, role)
VALUES 
    ('user_1', 'testuser', 'test@example.com', '$2a$10$6jM.hIVYH5ZF9Pf/7ZO2zuPLpOF1/K1LQQNr1wNrY7BHs1cVxqkX.', 'user'),
    ('admin_1', 'admin', 'admin@example.com', '$2a$10$6jM.hIVYH5ZF9Pf/7ZO2zuPLpOF1/K1LQQNr1wNrY7BHs1cVxqkX.', 'admin');

-- 插入英语课程数据
INSERT INTO courses (id, title, description, language, level, cover_image)
VALUES
    -- 英语课程 PEP 小学版
    ('course_1', '英语(PEP)', '人教版小学英语教材，适合小学生使用', '英语', '初级', '/images/courses/english_pep.jpg'),
    -- 日语入门课程
    ('course_2', '日语入门', '适合零基础学习日语的学生', '日语', '入门', '/images/courses/japanese_intro.jpg');

-- 插入英语课程单元
INSERT INTO units (id, course_id, title, description, content, sort_order)
VALUES
    -- 英语课程单元
    ('unit_1_1', 'course_1', 'Unit 1 - Greetings', '基础问候语', '<p>本单元将学习基本的英语问候语，包括如何向他人打招呼、介绍自己以及简单对话练习。</p><p>通过学习本单元，学生将能够用英语进行简单的日常交流。</p>', 1),
    ('unit_1_2', 'course_1', 'Unit 2 - Numbers', '数字与计数', '<p>本单元将学习英语中的数字表达，从1到100的基本计数，以及如何表达年龄、电话号码等。</p>', 2),
    ('unit_1_3', 'course_1', 'Unit 3 - Colors', '颜色词汇', '<p>本单元将学习英语中的颜色词汇，以及如何描述物体的颜色。</p>', 3),
    
    -- 日语课程单元
    ('unit_2_1', 'course_2', 'Unit 1 - あいさつ', '问候语', '<p>本单元将学习日语的基本问候语，如"こんにちは"（你好）、"さようなら"（再见）等。</p>', 1),
    ('unit_2_2', 'course_2', 'Unit 2 - 自己紹介', '自我介绍', '<p>本单元将学习如何用日语进行自我介绍，包括姓名、国籍、职业等。</p>', 2);

-- 插入英语课程音轨
INSERT INTO tracks (id, unit_id, title, chinese_name, file_path, file_size, duration, format, sort_order)
VALUES
    -- Unit 1 音轨
    ('track_1_1_1', 'unit_1_1', 'Dialogue 1 - Hello', '对话 1 - 你好', 'audio/course_1/unit_1_1/track_1.mp3', 1024000, 65.2, 'mp3', 1),
    ('track_1_1_2', 'unit_1_1', 'Dialogue 2 - Nice to meet you', '对话 2 - 很高兴认识你', 'audio/course_1/unit_1_1/track_2.mp3', 1536000, 78.4, 'mp3', 2),
    ('track_1_1_3', 'unit_1_1', 'Vocabulary Practice', '词汇练习', 'audio/course_1/unit_1_1/track_3.mp3', 2048000, 120.5, 'mp3', 3),
    ('track_1_1_4', 'unit_1_1', 'Pronunciation Drill', '发音训练', 'audio/course_1/unit_1_1/track_4.mp3', 1843200, 94.3, 'mp3', 4),
    ('track_1_1_5', 'unit_1_1', 'Song - Hello to You', '歌曲 - 你好', 'audio/course_1/unit_1_1/track_5.mp3', 3072000, 157.1, 'mp3', 5),
    
    -- Unit 2 音轨
    ('track_1_2_1', 'unit_1_2', 'Dialogue 1 - Counting', '对话 1 - 数数', 'audio/course_1/unit_1_2/track_1.mp3', 1228800, 62.9, 'mp3', 1),
    ('track_1_2_2', 'unit_1_2', 'Dialogue 2 - How old are you?', '对话 2 - 你几岁了？', 'audio/course_1/unit_1_2/track_2.mp3', 1638400, 83.8, 'mp3', 2),
    ('track_1_2_3', 'unit_1_2', 'Number Song', '数字歌', 'audio/course_1/unit_1_2/track_3.mp3', 2560000, 130.9, 'mp3', 3),
    
    -- Unit 3 音轨
    ('track_1_3_1', 'unit_1_3', 'Dialogue - What color is it?', '对话 - 这是什么颜色？', 'audio/course_1/unit_1_3/track_1.mp3', 1331200, 68.1, 'mp3', 1),
    ('track_1_3_2', 'unit_1_3', 'Color Words', '颜色词汇', 'audio/course_1/unit_1_3/track_2.mp3', 1024000, 52.4, 'mp3', 2),
    ('track_1_3_3', 'unit_1_3', 'Rainbow Song', '彩虹歌', 'audio/course_1/unit_1_3/track_3.mp3', 2457600, 125.6, 'mp3', 3);

-- 插入一些日语音轨示例
INSERT INTO tracks (id, unit_id, title, chinese_name, file_path, file_size, duration, format, sort_order)
VALUES
    -- 日语 Unit 1 音轨
    ('track_2_1_1', 'unit_2_1', 'あいさつ①', '问候语①', 'audio/course_2/unit_2_1/track_1.mp3', 1433600, 73.3, 'mp3', 1),
    ('track_2_1_2', 'unit_2_1', 'あいさつ②', '问候语②', 'audio/course_2/unit_2_1/track_2.mp3', 1638400, 83.8, 'mp3', 2),
    
    -- 日语 Unit 2 音轨
    ('track_2_2_1', 'unit_2_2', '自己紹介①', '自我介绍①', 'audio/course_2/unit_2_2/track_1.mp3', 1945600, 99.5, 'mp3', 1),
    ('track_2_2_2', 'unit_2_2', '自己紹介②', '自我介绍②', 'audio/course_2/unit_2_2/track_2.mp3', 2048000, 104.7, 'mp3', 2);

-- 插入示例用户进度
INSERT INTO user_track_progress (user_id, track_id, position, completion_rate, last_updated)
VALUES
    ('user_1', 'track_1_1_1', 45.2, 69.3, NOW() - INTERVAL '2 days'),
    ('user_1', 'track_1_1_2', 28.7, 36.6, NOW() - INTERVAL '1 day'),
    ('user_1', 'track_1_2_1', 62.9, 100.0, NOW() - INTERVAL '5 days');

-- 插入最近播放记录
INSERT INTO recently_played_tracks (user_id, track_id, position, accessed_at)
VALUES
    ('user_1', 'track_1_1_2', 28.7, NOW() - INTERVAL '1 day'),
    ('user_1', 'track_1_1_1', 45.2, NOW() - INTERVAL '2 days'),
    ('user_1', 'track_1_2_1', 62.9, NOW() - INTERVAL '5 days');

-- 插入示例自定义音轨
INSERT INTO custom_tracks (id, course_id, unit_id, user_id, title, chinese_name, file_path, file_size, duration, format, sort_order)
VALUES
    ('custom_1', 'course_1', 'unit_1_1', 'user_1', 'My Voice Recording', '我的录音', 'audio/custom/sample-recording-1.mp3', 512000, 26.4, 'mp3', 1),
    ('custom_2', 'course_1', 'unit_1_2', 'user_1', 'Number Practice', '数字练习', 'audio/custom/sample-recording-2.mp3', 768000, 39.3, 'mp3', 1); 
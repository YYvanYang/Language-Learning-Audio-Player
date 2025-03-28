-- 初始化数据库脚本

-- 创建用户表
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    activation_token VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

-- 创建课程表
CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    image_url VARCHAR(255),
    language VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建课程单元表
CREATE TABLE IF NOT EXISTS units (
    id VARCHAR(36) PRIMARY KEY,
    course_id VARCHAR(36) NOT NULL REFERENCES courses(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    order_number INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建音轨表
CREATE TABLE IF NOT EXISTS tracks (
    id VARCHAR(36) PRIMARY KEY,
    unit_id VARCHAR(36) NOT NULL REFERENCES units(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_path VARCHAR(255) NOT NULL,
    duration NUMERIC(10, 2) NOT NULL,
    format VARCHAR(20) NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(36) REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建用户书签表
CREATE TABLE IF NOT EXISTS bookmarks (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    track_id VARCHAR(36) NOT NULL REFERENCES tracks(id),
    time_point NUMERIC(10, 2) NOT NULL,
    label VARCHAR(255),
    color VARCHAR(20),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, track_id, time_point)
);

-- 创建用户课程关联表
CREATE TABLE IF NOT EXISTS user_courses (
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    course_id VARCHAR(36) NOT NULL REFERENCES courses(id),
    access_level VARCHAR(20) NOT NULL DEFAULT 'student',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, course_id)
);

-- 创建测试用户 (密码: password123)
INSERT INTO users (id, email, name, password_hash, role)
VALUES 
('usr_1234567890', 'admin@example.com', '管理员', '$2a$10$3qQO8EDaI0woXNGblvnhIOR429DP5ZQ9JpSfuhP535G9rQnZjj0Ry', 'admin'),
('usr_0987654321', 'user@example.com', '测试用户', '$2a$10$3qQO8EDaI0woXNGblvnhIOR429DP5ZQ9JpSfuhP535G9rQnZjj0Ry', 'user')
ON CONFLICT (email) DO NOTHING;

-- 创建测试课程
INSERT INTO courses (id, title, description, image_url, language)
VALUES
('course_1', '初级中文课程', '适合初学者的中文课程', '/static/images/courses/chinese_beginner.jpg', '中文'),
('course_2', '中级中文课程', '适合有基础的学习者', '/static/images/courses/chinese_intermediate.jpg', '中文')
ON CONFLICT (id) DO NOTHING;

-- 创建测试单元
INSERT INTO units (id, course_id, title, description, order_number)
VALUES
('unit_1', 'course_1', '基础问候语', '学习最常用的中文问候语和自我介绍', 1),
('unit_2', 'course_1', '数字和时间表达', '学习中文的数字和时间表达方式', 2),
('unit_3', 'course_1', '食物和饮料', '学习与食物和饮料相关的常用词汇和表达', 3)
ON CONFLICT (id) DO NOTHING;

-- 设置用户课程访问权限
INSERT INTO user_courses (user_id, course_id, access_level)
VALUES
('usr_1234567890', 'course_1', 'admin'),
('usr_1234567890', 'course_2', 'admin'),
('usr_0987654321', 'course_1', 'student')
ON CONFLICT (user_id, course_id) DO NOTHING; 
-- GAMS Database Schema

CREATE DATABASE IF NOT EXISTS gams_db;
USE gams_db;

-- Users Table (Authentication Identity)
CREATE TABLE users (
    userId INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) UNIQUE NOT NULL,
    role ENUM('admin', 'teacher', 'student') NOT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Students Table
CREATE TABLE students (
    studentId INT PRIMARY KEY,
    userId INT NOT NULL UNIQUE,
    fullName VARCHAR(255) NOT NULL,
    nickname VARCHAR(100),
    citizenId VARCHAR(20) UNIQUE NOT NULL,
    yearLevel INT CHECK (yearLevel BETWEEN 1 AND 4),
    entryYear INT NOT NULL,
    status ENUM('active', 'inactive', 'graduated') DEFAULT 'active',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
);

-- Teachers Table
CREATE TABLE teachers (
    teacherId INT PRIMARY KEY AUTO_INCREMENT,
    userId INT NOT NULL UNIQUE,
    fullName VARCHAR(255) NOT NULL,
    nickname VARCHAR(100),
    citizenId VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    status ENUM('active', 'inactive') DEFAULT 'active',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE
);

-- Activities Table
CREATE TABLE activities (
    activityId INT PRIMARY KEY AUTO_INCREMENT,
    createdByTeacherId INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    targetYearLevels JSON,
    startDate DATETIME NOT NULL,
    endDate DATETIME NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (createdByTeacherId) REFERENCES teachers(teacherId) ON DELETE CASCADE
);

-- Scoring Criteria Table
CREATE TABLE criteria (
    criteriaId INT PRIMARY KEY AUTO_INCREMENT,
    activityId INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    maxScore DECIMAL(10, 2) DEFAULT 0,
    weight DECIMAL(5, 2) DEFAULT 1.0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (activityId) REFERENCES activities(activityId) ON DELETE CASCADE
);

-- Activity Graders Table
CREATE TABLE activity_graders (
    activityGraderId INT PRIMARY KEY AUTO_INCREMENT,
    activityId INT NOT NULL,
    teacherId INT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_activity_grader (activityId, teacherId),
    FOREIGN KEY (activityId) REFERENCES activities(activityId) ON DELETE CASCADE,
    FOREIGN KEY (teacherId) REFERENCES teachers(teacherId) ON DELETE CASCADE
);

CREATE TABLE `groups` (
    groupId INT PRIMARY KEY AUTO_INCREMENT,
    activityId INT NOT NULL,
    groupName VARCHAR(255) NOT NULL,
    description TEXT,
    createdByStudentId INT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (activityId) REFERENCES activities(activityId) ON DELETE CASCADE,
    FOREIGN KEY (createdByStudentId) REFERENCES students(studentId) ON DELETE CASCADE
);

CREATE TABLE group_members (
    groupMemberId INT PRIMARY KEY AUTO_INCREMENT,
    groupId INT NOT NULL,
    studentId INT NOT NULL,
    joinedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_group_member (groupId, studentId),
        FOREIGN KEY (groupId) REFERENCES `groups`(groupId) ON DELETE CASCADE,
    FOREIGN KEY (studentId) REFERENCES students(studentId) ON DELETE CASCADE
);

-- Grades Table (per activity, group, grader, criterion)
CREATE TABLE grades (
    gradeId INT PRIMARY KEY AUTO_INCREMENT,
    activityId INT NOT NULL,
    groupId INT NOT NULL,
    teacherId INT NOT NULL,
    criteriaId INT NOT NULL,
    score VARCHAR(10),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_grade (activityId, groupId, teacherId, criteriaId),
    FOREIGN KEY (activityId) REFERENCES activities(activityId) ON DELETE CASCADE,
        FOREIGN KEY (groupId) REFERENCES `groups`(groupId) ON DELETE CASCADE,
    FOREIGN KEY (teacherId) REFERENCES teachers(teacherId) ON DELETE CASCADE,
    FOREIGN KEY (criteriaId) REFERENCES criteria(criteriaId) ON DELETE CASCADE
);

-- Grader Comments Table
CREATE TABLE grader_comments (
    commentId INT PRIMARY KEY AUTO_INCREMENT,
    activityId INT NOT NULL,
    groupId INT NOT NULL,
    teacherId INT NOT NULL,
    comment TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_comment (activityId, groupId, teacherId),
    FOREIGN KEY (activityId) REFERENCES activities(activityId) ON DELETE CASCADE,
    FOREIGN KEY (groupId) REFERENCES `groups`(groupId) ON DELETE CASCADE,
    FOREIGN KEY (teacherId) REFERENCES teachers(teacherId) ON DELETE CASCADE
);

-- Grader Submission Status Table
CREATE TABLE grader_submission_status (
    statusId INT PRIMARY KEY AUTO_INCREMENT,
    activityId INT NOT NULL,
    teacherId INT NOT NULL,
    status ENUM('draft', 'submitted') DEFAULT 'draft',
    submittedAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_submission_status (activityId, teacherId),
    FOREIGN KEY (activityId) REFERENCES activities(activityId) ON DELETE CASCADE,
    FOREIGN KEY (teacherId) REFERENCES teachers(teacherId) ON DELETE CASCADE
);

-- Grading Scale Table (Global)
CREATE TABLE grading_scale (
    scaleId INT PRIMARY KEY AUTO_INCREMENT,
    minScore DECIMAL(10, 2) NOT NULL,
    maxScore DECIMAL(10, 2) NOT NULL,
    grade VARCHAR(10) NOT NULL,
    gpa DECIMAL(3, 2),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_range (minScore, maxScore)
);

-- Indexes for Performance
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_students_userId ON students(userId);
CREATE INDEX idx_students_yearLevel ON students(yearLevel);
CREATE INDEX idx_teachers_userId ON teachers(userId);
CREATE INDEX idx_activities_createdBy ON activities(createdByTeacherId);
CREATE INDEX idx_activities_dates ON activities(startDate, endDate);
CREATE INDEX idx_criteria_activityId ON criteria(activityId);
CREATE INDEX idx_grades_activityId ON grades(activityId);
CREATE INDEX idx_grades_groupId ON grades(groupId);
CREATE INDEX idx_grades_teacherId ON grades(teacherId);
CREATE INDEX idx_groups_activityId ON `groups`(activityId);
CREATE INDEX idx_group_members_studentId ON group_members(studentId);

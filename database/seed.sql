-- Seed Data for GAMS

USE gams_db;

-- Insert Admin User
INSERT INTO users (userId, username, role, status) VALUES (1, 'Admin', 'admin', 'active');

-- Sample Grading Scale
INSERT INTO grading_scale (minScore, maxScore, grade, gpa) VALUES
(80, 100, 'A', 4.0),
(75, 79.99, 'B+', 3.5),
(70, 74.99, 'B', 3.0),
(65, 69.99, 'C+', 2.5),
(60, 64.99, 'C', 2.0),
(55, 59.99, 'D+', 1.5),
(50, 54.99, 'D', 1.0),
(0, 49.99, 'F', 0.0);

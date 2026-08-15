CREATE DATABASE IF NOT EXISTS habit_tracker;
USE habit_tracker;

CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS habits (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  target INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_habits_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_habits_user (user_id)
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  habit_id INT NOT NULL,
  value VARCHAR(50) NOT NULL DEFAULT 'done',
  log_date DATE NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_logs_habit FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
  CONSTRAINT uq_daily_habit UNIQUE (user_id, habit_id, log_date),
  INDEX idx_logs_habit_date (habit_id, log_date)
);

INSERT INTO users (id, name) VALUES (1, 'Demo User')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO habits (user_id, name, target) VALUES
(1, 'Sleep 8 hours', 1),
(1, 'Exercise', 1),
(1, 'Drink water', 8)
ON DUPLICATE KEY UPDATE name = VALUES(name);

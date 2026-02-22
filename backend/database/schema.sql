-- Demand Intake Process Tracker - Database Schema
CREATE DATABASE IF NOT EXISTS demand_intake;
USE demand_intake;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role ENUM('requestor', 'scrub_team', 'committee', 'admin') NOT NULL DEFAULT 'requestor',
    department VARCHAR(255),
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Intake Requests table
CREATE TABLE IF NOT EXISTS intake_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_title VARCHAR(500) NOT NULL,
    domain VARCHAR(255),
    estimated_budget DECIMAL(15,2),
    type_of_request VARCHAR(255),
    priority_level ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    date_of_submission DATE,
    estimated_completion_date DATE,
    status ENUM('draft', 'submitted', 'scrub_review', 'scrub_questions', 'committee_review', 'committee_questions', 'approved', 'rejected', 'development') DEFAULT 'draft',
    requestor_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (requestor_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Requestor Information table
CREATE TABLE IF NOT EXISTS requestor_info (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL UNIQUE,
    department VARCHAR(255),
    phone VARCHAR(50),
    manager_name VARCHAR(255),
    business_unit VARCHAR(255),
    cost_center VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES intake_requests(id) ON DELETE CASCADE
);

-- Project Specifications table
CREATE TABLE IF NOT EXISTS project_specs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL UNIQUE,
    description TEXT,
    business_justification TEXT,
    expected_outcomes TEXT,
    technical_requirements TEXT,
    dependencies TEXT,
    risks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES intake_requests(id) ON DELETE CASCADE
);

-- Scrub Reviews table
CREATE TABLE IF NOT EXISTS scrub_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    reviewer_id INT NOT NULL,
    decision ENUM('approve', 'reject', 'need_info') NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES intake_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Committee Reviews table
CREATE TABLE IF NOT EXISTS committee_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    reviewer_id INT NOT NULL,
    decision ENUM('approve', 'reject', 'need_info') NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES intake_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES intake_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Attachments table
CREATE TABLE IF NOT EXISTS attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    uploaded_by INT NOT NULL,
    original_name VARCHAR(500) NOT NULL,
    filename VARCHAR(500) NOT NULL,
    filepath VARCHAR(1000) NOT NULL,
    mimetype VARCHAR(255),
    size INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES intake_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
);

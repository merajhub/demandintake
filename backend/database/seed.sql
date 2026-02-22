-- Demand Intake Process Tracker - Seed Data
USE demand_intake;

-- Insert demo users (password is 'password123' for all users, bcrypt hashed)
INSERT INTO users (email, password_hash, full_name, role, department) VALUES
('john.gilbert@company.com', '$2a$10$8K1p/a0dR1xqM8K3hF7cSOePqWJQf8x7X3J9KzG5GVfN4lHXpKemi', 'John Gilbert', 'requestor', 'Engineering'),
('sarah.chen@company.com', '$2a$10$8K1p/a0dR1xqM8K3hF7cSOePqWJQf8x7X3J9KzG5GVfN4lHXpKemi', 'Sarah Chen', 'scrub_team', 'IT Governance'),
('mike.johnson@company.com', '$2a$10$8K1p/a0dR1xqM8K3hF7cSOePqWJQf8x7X3J9KzG5GVfN4lHXpKemi', 'Mike Johnson', 'committee', 'Executive'),
('admin@company.com', '$2a$10$8K1p/a0dR1xqM8K3hF7cSOePqWJQf8x7X3J9KzG5GVfN4lHXpKemi', 'Admin User', 'admin', 'IT');

-- Insert sample intake requests
INSERT INTO intake_requests (project_title, domain, estimated_budget, type_of_request, priority_level, date_of_submission, estimated_completion_date, status, requestor_id) VALUES
('Cloud Migration Phase 2', 'Infrastructure', 150000.00, 'New Project', 'high', '2026-02-01', '2026-08-01', 'submitted', 1),
('Customer Portal Redesign', 'Digital', 75000.00, 'Enhancement', 'medium', '2026-02-05', '2026-06-15', 'scrub_review', 1),
('Data Analytics Dashboard', 'Analytics', 200000.00, 'New Project', 'critical', '2026-01-15', '2026-07-30', 'approved', 1);

-- Insert requestor info for sample requests
INSERT INTO requestor_info (request_id, department, phone, manager_name, business_unit, cost_center) VALUES
(1, 'Engineering', '555-0101', 'David Smith', 'Technology', 'CC-1001'),
(2, 'Engineering', '555-0101', 'David Smith', 'Technology', 'CC-1001'),
(3, 'Engineering', '555-0101', 'David Smith', 'Technology', 'CC-1001');

-- Insert project specs for sample requests
INSERT INTO project_specs (request_id, description, business_justification, expected_outcomes, technical_requirements) VALUES
(1, 'Migrate remaining on-premise servers to cloud infrastructure', 'Reduce operational costs by 40% and improve scalability', 'Full cloud migration with zero downtime', 'AWS/Azure, Kubernetes, CI/CD pipelines'),
(2, 'Redesign the customer-facing portal with modern UI/UX', 'Improve customer satisfaction score by 25%', 'New responsive portal with improved navigation', 'Angular, Node.js, PostgreSQL'),
(3, 'Build a comprehensive analytics dashboard for business KPIs', 'Enable data-driven decision making across departments', 'Real-time dashboards with drill-down capabilities', 'Power BI, SQL Server, Python');

-- Insert a sample scrub review
INSERT INTO scrub_reviews (request_id, reviewer_id, decision, remarks) VALUES
(2, 2, 'approve', 'Project scope is well-defined. Budget is reasonable for the proposed deliverables.');

-- Insert sample comments
INSERT INTO comments (request_id, user_id, message) VALUES
(1, 2, 'Please provide more details about the current server inventory.'),
(1, 1, 'Updated the project specs with the full server inventory list.');

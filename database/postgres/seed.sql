INSERT INTO users (name, email, password_hash, role)
VALUES ('Admin User', 'admin@riskiq.local', '$2a$10$zUvoeXHdsswZp4hDwxKuQeiiPpQ3ZkrmNAzjn.2R9Owp97wq58NFi', 'Admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO rules (external_rule_id, regulator, description, field_name, requirement, severity)
VALUES
  ('RBI-INT-DISCLOSURE-001', 'RBI', 'Interest disclosure must exist', 'interest_rates', 'must_exist', 'HIGH'),
  ('RBI-AMOUNT-001', 'RBI', 'Loan amount must be present', 'amounts', 'must_exist', 'HIGH'),
  ('KYC-NAME-001', 'RBI', 'Customer name must be captured', 'names', 'must_exist', 'MEDIUM'),
  ('LEGAL-CLAUSE-001', 'RBI', 'At least one financial clause should be present', 'clauses', 'min_count_1', 'LOW')
ON CONFLICT (external_rule_id) DO NOTHING;

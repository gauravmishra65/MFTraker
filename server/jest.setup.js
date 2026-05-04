// Provide minimal env so config/env.ts parses during unit tests.
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-32-chars-minimum-please";
process.env.NODE_ENV = "test";

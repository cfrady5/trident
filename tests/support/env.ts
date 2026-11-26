// Test environment: an isolated database; dev providers only.
process.env.APP_ENV = "test";
process.env.APP_URL = "http://localhost:3000";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/trident_test";
process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-123";
process.env.AUTH_PROVIDER = "local";
process.env.STORAGE_PROVIDER = "local";
process.env.LOCAL_STORAGE_DIR = ".data/test-storage";
process.env.EMAIL_PROVIDER = "dev_outbox";
process.env.AI_PROVIDER = "none";
process.env.STAFF_NOTIFICATION_EMAILS = "";

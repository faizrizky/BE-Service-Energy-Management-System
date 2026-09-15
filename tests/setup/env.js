// Env deterministik untuk test. Diset sebelum modul apa pun di-require supaya
// dotenv (yang tidak menimpa env yang sudah ada) tidak memakai nilai dari .env lokal.
process.env.NODE_ENV = "test";
process.env.TZ = "Asia/Jakarta";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.JWT_EXPIRES_IN = "1h";
process.env.JWT_REFRESH_EXPIRES_DAYS = "7";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/ems_test";
process.env.REDIS_HOST = "127.0.0.1";
process.env.REDIS_PORT = "6379";
process.env.REDIS_PASSWORD = "";
process.env.CHIRPSTACK_MIDDLEWARE_URL = "http://chirpstack.test";
process.env.CHIRPSTACK_APPLICATION_ID = "app-test";
process.env.CHIRPSTACK_DEVICE_PROFILE_ID = "profile-test";
process.env.TURNSTILE_SECRET_KEY = "";
process.env.ALLOWED_ORIGINS = "";
process.env.LOGIN_MAX_FAILED_ATTEMPTS = "5";
process.env.LOGIN_LOCKOUT_MINUTES = "15";
process.env.ENERGY_RETENTION_DAYS = "90";
